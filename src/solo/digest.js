import { getDb, getMeta, setMeta } from './db.js';
import { getStreakDisplay } from './streak.js';
import { getWeeklySummary, getErrorBreakdown } from './trends.js';

/**
 * Check if weekly digest should be shown.
 * Shows on:
 * - First commit of the week (Monday)
 * - After 7+ days since last digest
 * @param {string} repoPath - Repository path
 * @returns {boolean} - True if digest should show
 */
export function shouldShowDigest(repoPath) {
  const db = getDb();
  const lastDigestKey = `digest_shown_${repoPath}`;
  const lastDigestStr = getMeta(db, lastDigestKey);

  if (!lastDigestStr) {
    return true; // First time
  }

  const lastDigest = new Date(lastDigestStr);
  const now = new Date();
  const daysSince = Math.floor((now - lastDigest) / (1000 * 60 * 60 * 24));

  // Show if 7+ days have passed
  if (daysSince >= 7) {
    return true;
  }

  // Show if today is Monday and it's been at least 1 day
  const isoWeekday = now.getUTCDay(); // 0 = Sunday, 1 = Monday
  const monday = isoWeekday === 1;

  if (monday && daysSince >= 1) {
    return true;
  }

  return false;
}

/**
 * Generate a weekly digest of coding statistics.
 * @param {string} repoPath - Repository path
 * @returns {Object} - Digest data
 */
export function generateDigest(repoPath) {
  const weekly = getWeeklySummary(repoPath);
  const errorBreakdown = getErrorBreakdown(repoPath, 7);
  const streak = getStreakDisplay(repoPath);

  // Calculate stats
  const failureRate =
    weekly.runs > 0
      ? Math.round(((weekly.errors - weekly.fixes) / weekly.errors) * 100)
      : 0;

  const fixRate =
    weekly.errors > 0
      ? Math.round((weekly.fixes / weekly.errors) * 100)
      : 0;

  return {
    date: new Date().toISOString().split('T')[0],
    period: 'Last 7 days',
    stats: {
      runsExecuted: weekly.runs,
      errorsFound: weekly.errors,
      errorsCritical: errorBreakdown.critical,
      errorsModearte: errorBreakdown.moderate,
      errorsMinor: errorBreakdown.minor,
      fixesAccepted: weekly.fixes,
      patternHits: weekly.patternHits,
      successfulCommits: weekly.successfulCommits,
      fixRate,
      failureRate,
    },
    streak: {
      current: streak.current,
      best: streak.best,
      display: streak.display,
    },
  };
}

/**
 * Print the weekly digest to console.
 * @param {string} repoPath - Repository path
 */
export function printDigest(repoPath) {
  if (!shouldShowDigest(repoPath)) {
    return;
  }

  const digest = generateDigest(repoPath);
  const db = getDb();
  const lastDigestKey = `digest_shown_${repoPath}`;

  // Build output
  const lines = [
    '',
    '╔════════════════════════════════════════════════════════════════╗',
    '║                  CODEXA WEEKLY DIGEST                          ║',
    '╚════════════════════════════════════════════════════════════════╝',
    '',
    `  📅 ${digest.date} — ${digest.period}`,
    '',
    `  ✓ Commits checked:     ${String(digest.stats.runsExecuted).padEnd(3)} runs`,
    `  ✖ Errors found:        ${String(digest.stats.errorsFound).padEnd(3)} total`,
    `    ├─ Critical:         ${String(digest.stats.errorsCritical).padEnd(3)}`,
    `    ├─ Moderate:         ${String(digest.stats.errorsModearte).padEnd(3)}`,
    `    └─ Minor:            ${String(digest.stats.errorsMinor).padEnd(3)}`,
    '',
    `  🔧 Fixes accepted:     ${String(digest.stats.fixesAccepted).padEnd(3)} (${digest.stats.fixRate}%)`,
    `  💾 Pattern hits:       ${String(digest.stats.patternHits).padEnd(3)} reused`,
    `  ✅ Successful commits: ${String(digest.stats.successfulCommits).padEnd(3)}`,
    '',
    `  ${digest.streak.display}`,
    '  Best ever: ' + (digest.streak.best > 0 ? `${digest.streak.best}-commit streak` : 'No streak yet'),
    '',
    '  Keep up the great work! 🚀',
    '',
  ];

  console.log(lines.join('\n'));

  // Update meta
  setMeta(db, lastDigestKey, new Date().toISOString());
}
