import { getDb } from './db.js';

/**
 * Get the current clean streak (consecutive commits with no CRITICAL errors in diff).
 * @param {string} repoPath - Repository path
 * @returns {number} - Current streak count (0 if no streak)
 */
export function getCurrentStreak(repoPath) {
  const db = getDb();

  // Get recent runs, ordered newest first
  const runs = db
    .prepare(
      `
    SELECT id, commit_allowed, errors_blocked FROM runs
    WHERE repo_path = ?
    ORDER BY timestamp DESC
    LIMIT 100
  `
    )
    .all(repoPath);

  let streak = 0;

  // Walk backward from most recent, count consecutive clean runs
  for (const run of runs) {
    // Clean run: commit was allowed AND no blocking errors
    if (run.commit_allowed && !run.errors_blocked) {
      streak++;
    } else {
      break; // Streak broken
    }
  }

  return streak;
}

/**
 * Get the best (longest) clean streak ever recorded.
 * @param {string} repoPath - Repository path
 * @returns {number} - Best streak count
 */
export function getBestStreak(repoPath) {
  const db = getDb();

  // Get all runs ordered by timestamp (oldest first)
  const runs = db
    .prepare(
      `
    SELECT id, commit_allowed, errors_blocked FROM runs
    WHERE repo_path = ?
    ORDER BY timestamp ASC
  `
    )
    .all(repoPath);

  let currentStreak = 0;
  let bestStreak = 0;

  for (const run of runs) {
    if (run.commit_allowed && !run.errors_blocked) {
      currentStreak++;
      bestStreak = Math.max(bestStreak, currentStreak);
    } else {
      currentStreak = 0;
    }
  }

  return bestStreak;
}

/**
 * Get human-readable streak display.
 * @param {string} repoPath - Repository path
 * @returns {Object} - {current, best, display, level}
 *   display: "✓ 5-commit clean run" | "🔥 12-day streak" | "💎 legendary"
 *   level: "clean" | "hot" | "legendary"
 */
export function getStreakDisplay(repoPath) {
  const db = getDb();

  // Get current streak
  const currentStreak = getCurrentStreak(repoPath);

  // Get best streak
  const bestStreak = getBestStreak(repoPath);

  let display = '';
  let level = 'none';

  if (currentStreak === 0) {
    display = '✓ Ready to commit';
    level = 'none';
  } else if (currentStreak < 5) {
    display = `✓ ${currentStreak}-commit clean run`;
    level = 'clean';
  } else if (currentStreak < 15) {
    display = `🔥 ${currentStreak}-day streak`;
    level = 'hot';
  } else {
    display = `💎 ${currentStreak}-day legendary streak!`;
    level = 'legendary';
  }

  return {
    current: currentStreak,
    best: bestStreak,
    display,
    level,
  };
}

/**
 * Check if current streak is at risk (blocking errors present).
 * @param {string} repoPath - Repository path
 * @param {number} errorsBlocked - Count of blocking errors in current check
 * @returns {boolean} - True if streak > 0 AND errorsBlocked > 0
 */
export function isStreakAtRisk(repoPath, errorsBlocked) {
  const streak = getCurrentStreak(repoPath);
  return streak > 0 && errorsBlocked > 0;
}

/**
 * Get streak data for a repository (used by report/stats).
 * @param {string} repoPath - Repository path
 * @returns {Object} - {current, best, display, atRisk}
 */
export function getStreakData(repoPath) {
  const display = getStreakDisplay(repoPath);
  const db = getDb();

  // Get most recent run to check if at risk
  const lastRun = db
    .prepare(
      `
    SELECT errors_blocked FROM runs
    WHERE repo_path = ?
    ORDER BY timestamp DESC
    LIMIT 1
  `
    )
    .get(repoPath);

  const atRisk = lastRun ? isStreakAtRisk(repoPath, lastRun.errors_blocked) : false;

  return {
    current: display.current,
    best: display.best,
    display: display.display,
    level: display.level,
    atRisk,
  };
}
