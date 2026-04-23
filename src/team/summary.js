import { readFileSync, writeFileSync, existsSync } from 'fs';
import { resolve } from 'path';

const SUMMARY_PATH = '.codexa/codexa-summary.json';

const EMPTY_SUMMARY = {
  version: 1,
  lastUpdated: new Date().toISOString(),
  contributors: {},
  codebase: {
    totalRuns: 0,
    topRules: [],
    hotspots: [],
    lastUpdated: new Date().toISOString(),
  },
};

/**
 * Load team summary from codexa-summary.json
 * @param {string} repoPath - Repository path
 * @returns {Object} - Parsed summary or empty template
 */
export function loadSummary(repoPath) {
  const summaryPath = resolve(repoPath, SUMMARY_PATH);

  if (!existsSync(summaryPath)) {
    return { ...EMPTY_SUMMARY };
  }

  try {
    const content = readFileSync(summaryPath, 'utf8');
    return JSON.parse(content);
  } catch (err) {
    console.error(`Failed to parse summary: ${err.message}`);
    return { ...EMPTY_SUMMARY };
  }
}

/**
 * Update team summary after a linter run
 * @param {string} repoPath - Repository path
 * @param {Object} runResult - Result from runLinter()
 * @param {string} authorEmail - Git author email
 * @param {string} authorName - Git author name
 * @returns {Object} - Updated summary
 */
export function updateSummary(repoPath, runResult, authorEmail, authorName) {
  const summary = loadSummary(repoPath);
  const now = new Date().toISOString();

  // Initialize contributor entry if missing
  if (!summary.contributors[authorEmail]) {
    summary.contributors[authorEmail] = {
      displayName: authorName,
      totalRuns: 0,
      cleanRuns: 0,
      blockedRuns: 0,
      totalErrorsFound: 0,
      totalFixesAccepted: 0,
      currentStreak: 0,
      bestStreak: 0,
      topRules: [],
      lastActive: now,
      languages: [],
    };
  }

  const contributor = summary.contributors[authorEmail];

  // Update contributor stats
  contributor.totalRuns += 1;
  contributor.lastActive = now;
  contributor.displayName = authorName; // Keep name fresh

  if (runResult.commit_allowed) {
    contributor.cleanRuns += 1;
  } else {
    contributor.blockedRuns += 1;
  }

  contributor.totalErrorsFound +=
    (runResult.blocking?.length || 0) +
    (runResult.warnings?.length || 0) +
    (runResult.minor?.length || 0);

  contributor.totalFixesAccepted += runResult.fixes_accepted || 0;

  // Update streak (simplified: just track from result)
  if (runResult.streak !== undefined) {
    contributor.currentStreak = runResult.streak;
    if (runResult.streak > contributor.bestStreak) {
      contributor.bestStreak = runResult.streak;
    }
  }

  // Track languages
  if (runResult.language && !contributor.languages.includes(runResult.language)) {
    contributor.languages.push(runResult.language);
  }

  // Update top rules for this contributor
  const ruleCountMap = {};
  for (const error of [
    ...(runResult.blocking || []),
    ...(runResult.warnings || []),
    ...(runResult.minor || []),
  ]) {
    ruleCountMap[error.rule] = (ruleCountMap[error.rule] || 0) + 1;
  }

  const newRules = Object.entries(ruleCountMap)
    .map(([rule, count]) => ({ rule, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 5);

  // Merge with existing rules
  const existingRules = contributor.topRules || [];
  const mergedRules = {};

  for (const r of existingRules) {
    mergedRules[r.rule] = r.count;
  }

  for (const r of newRules) {
    mergedRules[r.rule] = (mergedRules[r.rule] || 0) + r.count;
  }

  contributor.topRules = Object.entries(mergedRules)
    .map(([rule, count]) => ({ rule, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 5);

  // Update codebase totals
  summary.codebase.totalRuns += 1;
  summary.codebase.lastUpdated = now;

  // Recalculate codebase topRules
  const allRules = {};
  const ruleContributors = {};

  for (const contrib of Object.values(summary.contributors)) {
    for (const rule of contrib.topRules || []) {
      allRules[rule.rule] = (allRules[rule.rule] || 0) + rule.count;
      if (!ruleContributors[rule.rule]) {
        ruleContributors[rule.rule] = new Set();
      }
      ruleContributors[rule.rule].add(contrib.displayName);
    }
  }

  summary.codebase.topRules = Object.entries(allRules)
    .map(([rule, count]) => ({
      rule,
      count,
      contributors: ruleContributors[rule]?.size || 0,
    }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 10);

  summary.lastUpdated = now;

  // Atomic write
  writeSummaryAtomic(repoPath, summary);

  return summary;
}

/**
 * Get stats for a single contributor
 * @param {Object} summary - Summary object
 * @param {string} email - Contributor email
 * @returns {Object|null} - Contributor stats or null
 */
export function getContributorStats(summary, email) {
  return summary.contributors[email] || null;
}

/**
 * Get leaderboard for a specific metric
 * @param {Object} summary - Summary object
 * @param {string} metric - 'currentStreak' | 'totalFixesAccepted' | 'cleanRunRate'
 * @param {string[]} optInEmails - Emails opted in to leaderboard
 * @returns {Array} - Top 10 contributors, sorted by metric desc
 */
export function getLeaderboard(summary, metric, optInEmails = []) {
  const optInSet = new Set(optInEmails);

  return Object.entries(summary.contributors)
    .filter(([email]) => optInSet.has(email))
    .map(([email, stats]) => {
      let value;

      if (metric === 'currentStreak') {
        value = stats.currentStreak;
      } else if (metric === 'totalFixesAccepted') {
        value = stats.totalFixesAccepted;
      } else if (metric === 'cleanRunRate') {
        value = stats.totalRuns > 0 ? Math.round((stats.cleanRuns / stats.totalRuns) * 100) : 0;
      }

      return {
        email,
        displayName: stats.displayName,
        value,
      };
    })
    .sort((a, b) => b.value - a.value)
    .slice(0, 10);
}

// Helper functions

function writeSummaryAtomic(repoPath, summary) {
  const summaryPath = resolve(repoPath, SUMMARY_PATH);
  const tempPath = summaryPath + '.tmp';

  try {
    writeFileSync(tempPath, JSON.stringify(summary, null, 2), 'utf8');
    // Rename is atomic on most filesystems
    const fs = require('fs');
    fs.renameSync(tempPath, summaryPath);
  } catch (err) {
    throw new Error(`Failed to write summary: ${err.message}`);
  }
}
