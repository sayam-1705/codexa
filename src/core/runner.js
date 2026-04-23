import { getEnabledAdapters } from '../plugins/registry.js';
import { classifyErrors } from './classifier.js';
import { buildChangedLinesMap } from './blame.js';
import { getDb, logRun } from '../solo/db.js';
import { getCurrentStreak, getStreakDisplay } from '../solo/streak.js';
import { updateSummary } from '../team/summary.js';
import { execSync } from 'child_process';

export async function runLinter(stagedFiles, repoPath = process.cwd(), config = {}) {
  if (!stagedFiles || !stagedFiles.length) {
    return {
      blocking: [],
      warnings: [],
      minor: [],
      preexisting: [],
      runId: null,
      streak: 0,
      streakDisplay: '✓ Ready to commit',
    };
  }

  const startTime = Date.now();

  // Load enabled adapters
  const adapters = await getEnabledAdapters(repoPath);

  if (adapters.length === 0) {
    return {
      blocking: [],
      warnings: [],
      minor: [],
      preexisting: [],
      runId: null,
      streak: 0,
      streakDisplay: '✓ Ready to commit',
    };
  }

  // Run each adapter on its matching files in parallel
  const lintPromises = adapters.map(async (adapter) => {
    // Filter files to adapter's supported extensions
    const adapterFiles = stagedFiles.filter((file) =>
      adapter.extensions.some((ext) => file.endsWith(ext))
    );

    if (adapterFiles.length === 0) {
      return [];
    }

    return await adapter.lint(adapterFiles, config);
  });

  // Get changed lines map for blame engine
  const changedLinesMap = await buildChangedLinesMap(repoPath, stagedFiles);

  // Run all linters in parallel
  const lintResults = await Promise.all([...lintPromises, Promise.resolve(changedLinesMap)]);
  const changedLinesMapResult = lintResults[lintResults.length - 1];
  const rawErrors = lintResults.slice(0, -1).flat();

  // Classify errors by severity and blame
  const classified = await classifyErrors(rawErrors, changedLinesMapResult, config);

  // Calculate stats for logging
  const errorsBlocked = classified.blocking.length;
  const commitAllowed = errorsBlocked === 0;

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
      commitAllowed,
      durationMs,
      errors: errorsForLog,
    };

    const runId = logRun(db, runData);

    // Get streak info
    const streak = getCurrentStreak(repoPath);
    const streakDisplay = getStreakDisplay(repoPath).display;
    const streakAtRisk = streak > 0 && errorsBlocked > 0;

    // Add metadata to classified results
    classified.runId = runId;
    classified.streak = streak;
    classified.streakDisplay = streakDisplay;
    classified.streakAtRisk = streakAtRisk;

    // Update team summary (non-blocking)
    try {
      const authorEmail = execSync('git config user.email', { cwd: repoPath, encoding: 'utf8' }).trim();
      const authorName = execSync('git config user.name', { cwd: repoPath, encoding: 'utf8' }).trim();

      const runResult = {
        commit_allowed: commitAllowed,
        blocking: classified.blocking,
        warnings: classified.warnings,
        minor: classified.minor,
        streak,
        language: runData.language,
        fixes_accepted: 0, // Will be populated by interactive mode
      };

      updateSummary(repoPath, runResult, authorEmail, authorName);
    } catch (summaryErr) {
      // Non-blocking: team summary errors should not fail the lint check
      // Silently ignore if git config not available or summary update fails
    }
  } catch (err) {
    // Non-blocking: database errors should not fail the lint check
    console.error(
      `Codexa could not write run metrics to .codexa/codexa.db: ${err.message}\n` +
      'Fix: ensure the repository is writable and rerun codexa check. Lint results are still valid.'
    );
    classified.runId = null;
    classified.streak = 0;
    classified.streakDisplay = '✓ Ready to commit';
    classified.streakAtRisk = false;
  }

  return classified;
}
