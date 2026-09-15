import { getEnabledAdapters } from '../plugins/registry.js';
import { classifyErrors } from './classifier.js';
import { buildChangedLinesMap } from './blame.js';
import { getDb, logRun } from '../solo/db.js';
import { getCurrentStreak, getStreakDisplay } from '../solo/streak.js';
import { updateSummary } from '../team/summary.js';
import { runGit } from '../git/command.js';
import { materializeIndexFiles } from '../git/diff.js';
import { readFileSync } from 'fs';
import { logCommitCheck } from '../learning/history.js';
import { findMatchingPattern } from '../learning/matcher.js';

async function runLinterInternal(stagedFiles, repoPath = process.cwd(), config = {}, snapshot = null) {
  if (!stagedFiles || !stagedFiles.length) {
    return {
      blocking: [],
      warnings: [],
      minor: [],
      preexisting: [],
      runId: null,
      streak: 0,
      streakDisplay: '✓ Ready to commit',
      filesChecked: 0,
      durationMs: 0,
    };
  }

  const startTime = Date.now();

  // Load enabled adapters
  const loadedAdapters = await getEnabledAdapters(repoPath);
  // Failed adapters follow the same language selection as loaded adapters.
  // An adapter excluded by configuration must not block the current check.
  const adapterFailures = (loadedAdapters.failedAdapters || []).filter((failure) =>
    adapterMatchesLanguage(failure, config.languages)
  );
  const adapters = selectAdapters(loadedAdapters, config.languages);

  if (adapters.length === 0) {
    const policy = config?.adapterFailurePolicy || 'fail';
    const hasAdapterFailures = adapterFailures.length > 0;
    const adapterFailureBlocks = hasAdapterFailures && policy === 'fail';

    if (hasAdapterFailures && policy === 'warn') {
      console.error(
        `[codexa] WARNING: ${adapterFailures.length} adapter(s) failed but adapterFailurePolicy=warn — check may be incomplete.`
      );
    } else if (hasAdapterFailures && policy === 'ignore') {
      console.error(
        `[codexa] WARNING: adapterFailurePolicy=ignore — adapter failures suppressed. Check may be incomplete.`
      );
    }

    return {
      blocking: [],
      warnings: [],
      minor: [],
      preexisting: [],
      runId: null,
      streak: 0,
      streakDisplay: '✓ Ready to commit',
      filesChecked: stagedFiles.length,
      durationMs: 0,
      adapterFailures,
      adapterFailureBlocks,
      commitAllowed: !adapterFailureBlocks,
    };
  }

  // Run each adapter on its matching files in parallel
  const lintPromises = adapters.map(async (adapter) => {
    // Filter files to adapter's supported extensions
    const adapterFiles = (snapshot?.files || stagedFiles).filter((file) =>
      adapter.extensions.some((ext) => file.endsWith(ext))
    );

    if (adapterFiles.length === 0) {
      return { adapter, errors: [] };
    }

    try {
      return { adapter, errors: await adapter.lint(adapterFiles, config) };
    } catch (error) {
      return {
        adapter,
        errors: [],
        failure: {
          name: adapter.name || adapter.language,
          language: adapter.language,
          phase: 'lint',
          error: error.message,
        },
      };
    }
  });

  // Get changed lines map for blame engine
  const changedLinesMap = await buildChangedLinesMap(repoPath, stagedFiles);

  // Run all linters in parallel
  const lintResults = await Promise.all(lintPromises);
  const changedLinesMapResult = changedLinesMap;
  const lintFailures = lintResults.filter((result) => result.failure).map((result) => result.failure);
  const rawErrors = lintResults.flatMap((result) => result.errors).map(error => snapshot ? snapshot.mapFinding(error) : error);

  // Classify errors by severity and blame
  const classified = await classifyErrors(rawErrors, changedLinesMapResult, config);
  classified.filesChecked = stagedFiles.length;
  classified.durationMs = Date.now() - startTime;

  let patternHits = 0;
  const addPatternMatches = (errors) => errors.map((error) => {
    try {
      const fileLines = readFileSync(error.file, 'utf8').split(/\r?\n/);
      const patternMatch = findMatchingPattern(error, fileLines, repoPath);
      if (patternMatch) {
        patternHits += 1;
        return Object.freeze({ ...error, patternMatch });
      }
    } catch {
      // Pattern suggestions are best-effort and must not affect linting.
    }
    return error;
  });

  classified.blocking = addPatternMatches(classified.blocking);
  classified.warnings = addPatternMatches(classified.warnings);
  classified.minor = addPatternMatches(classified.minor);
  classified.patternHits = patternHits;
  classified.adapterFailures = [...adapterFailures, ...lintFailures];

  // Calculate stats for logging
  const errorsBlocked = classified.blocking.length;
  const blockThreshold = config?.team?.blockThreshold || 1;
  const policy = config?.adapterFailurePolicy || 'fail';
  const hasAdapterFailures = classified.adapterFailures && classified.adapterFailures.length > 0;

  // Apply adapter failure policy:
  //   fail   (default) — adapter failure → check incomplete → enforcement fails → non-zero exit → commit blocked
  //   warn              — adapter failure → warning shown → check continues → does not block on its own
  //   ignore            — adapter failure → intentionally ignored
  //
  // WARNING: adapterFailurePolicy=ignore allows checks to pass when an adapter
  // cannot complete analysis. Use only when adapter failures are expected and
  // acceptable in your workflow; never use as the default for production repositories.
  let adapterFailureBlocks = false;
  if (hasAdapterFailures && policy === 'fail') {
    adapterFailureBlocks = true;
  } else if (hasAdapterFailures && policy === 'warn') {
    console.error(
      `[codexa] WARNING: ${classified.adapterFailures.length} adapter(s) failed but adapterFailurePolicy=warn — check may be incomplete.`
    );
  } else if (hasAdapterFailures && policy === 'ignore') {
    console.error(
      `[codexa] WARNING: adapterFailurePolicy=ignore — adapter failures suppressed. Check may be incomplete.`
    );
  }
  // 'warn': adapter failures logged but don't block
  // 'ignore': adapter failures ignored entirely
  const commitAllowed = !adapterFailureBlocks && errorsBlocked < blockThreshold;
  classified.adapterFailureBlocks = adapterFailureBlocks;
  classified.commitAllowed = commitAllowed;

  try {
    logCommitCheck(repoPath, {
      filesChecked: stagedFiles.length,
      errorsFound: rawErrors.length,
      errorsBlocked,
      patternHits,
      commitAllowed,
    });
  } catch {
    // History is supplemental and must not affect lint results.
  }

  // Persist to database
  try {
    const db = getDb();
    const durationMs = Date.now() - startTime;

    // Transform errors for logging
    const errorsForLog = rawErrors.map((error) => ({
      file: error.file,
      line: error.line,
      rule: error.rule,
      severity: error.severity,
      language: error.language,
      blameCategory: error.blameCategory,
      wasFixed: error.wasFixed || false,
    }));

    const runData = {
      timestamp: new Date().toISOString(),
      repoPath,
      language: adapters.map((a) => a.language).join(',') || 'mixed',
      filesChecked: stagedFiles.length,
      errorsFound: rawErrors.length,
      errorsBlocked,
      patternHits,
      commitAllowed,
      durationMs,
      errors: errorsForLog,
    };

    const runId = logRun(db, runData);

    // Get streak info
    const streak = getCurrentStreak(repoPath);
    const streakDisplay = getStreakDisplay(repoPath).display;
    const streakAtRisk = streak > 0 && errorsBlocked >= blockThreshold;

    // Add metadata to classified results
    classified.runId = runId;
    classified.streak = streak;
    classified.streakDisplay = streakDisplay;
    classified.streakAtRisk = streakAtRisk;

    // Update team summary (non-blocking)
    try {
      const authorEmail = runGit(['config', 'user.email'], repoPath).trim();
      const authorName = runGit(['config', 'user.name'], repoPath).trim();

      const runResult = {
        commit_allowed: commitAllowed,
        blocking: classified.blocking,
        warnings: classified.warnings,
        minor: classified.minor,
        streak,
        language: runData.language,
        fixes_accepted: 0, // Will be populated by interactive mode
      };

      if (config.team?.leaderboard?.optIn === true) {
        updateSummary(repoPath, runResult, authorEmail, authorName);
      }
    } catch (summaryErr) {
      // Non-blocking: team summary errors should not fail the lint check
      // Silently ignore if git config not available or summary update fails
    }
  } catch (err) {
    // Non-blocking: database errors should not fail the lint check
    console.error(
      `Codexa could not write supplemental run metrics: ${err.message}\n` +
      'Lint results are still valid; ensure the Codexa data directory is writable if metrics are needed.'
    );
    classified.runId = null;
    classified.streak = 0;
    classified.streakDisplay = '✓ Ready to commit';
    classified.streakAtRisk = false;
  }

  return classified;
}

function selectAdapters(adapters, languages = ['auto']) {
  const normalizedLanguages = Array.isArray(languages) ? languages.map((language) => language.toLowerCase()) : languages;
  if (!Array.isArray(normalizedLanguages) || normalizedLanguages.length === 0 || normalizedLanguages.includes('auto')) {
    return adapters;
  }
  const selected = new Set(normalizedLanguages);
  return adapters.filter((adapter) =>
    selected.has(adapter.language.toLowerCase()) ||
    (selected.has('typescript') && adapter.language.toLowerCase() === 'javascript')
  );
}

function adapterMatchesLanguage(failure, languages = ['auto']) {
  if (!Array.isArray(languages) || languages.length === 0 || languages.some((language) => String(language).toLowerCase() === 'auto')) {
    return true;
  }
  const language = String(failure.language || failure.name || '').toLowerCase();
  return languages.some((candidate) => {
    const normalized = String(candidate).toLowerCase();
    return normalized === language || (normalized === 'typescript' && language === 'javascript');
  });
}

export async function runLinter(stagedFiles, repoPath = process.cwd(), config = {}) {
  if (config.snapshot !== 'index') return runLinterInternal(stagedFiles, repoPath, config);
  const snapshot = await materializeIndexFiles(repoPath, stagedFiles);
  try {
    return await runLinterInternal(stagedFiles, repoPath, config, snapshot);
  } finally {
    snapshot.cleanup();
  }
}
