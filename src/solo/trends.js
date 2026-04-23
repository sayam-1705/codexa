import { getDb, getDailyErrorCounts, getErrorFrequency, getLifetimeStats } from './db.js';

/**
 * Get trend data for report generation.
 * @param {string} repoPath - Repository path
 * @param {number} days - Look back N days (default 30)
 * @returns {Object} - Trend data including daily counts, top rules, etc.
 */
export function getTrendData(repoPath, days = 30) {
  const dailyCounts = getDailyErrorCounts(repoPath, days);
  const errorFreq = getErrorFrequency(repoPath, days);
  const lifetime = getLifetimeStats(repoPath);

  // Calculate metrics
  const totalErrors = dailyCounts.reduce((sum, d) => sum + (d.count || 0), 0);
  const totalCritical = dailyCounts.reduce((sum, d) => sum + (d.critical_count || 0), 0);
  const cleanDays = dailyCounts.filter((d) => d.count === 0).length;
  const totalDays = dailyCounts.length;
  const cleanDaysPercent = totalDays > 0 ? Math.round((cleanDays / totalDays) * 100) : 0;

  return {
    period: { days, from: dailyCounts[dailyCounts.length - 1]?.date, to: dailyCounts[0]?.date },
    dailyCounts,
    totalErrors,
    totalCritical,
    cleanDays,
    totalDays,
    cleanDaysPercent,
    errorFrequency: errorFreq,
    lifetime,
  };
}

/**
 * Get top recurring errors (rules causing most issues).
 * @param {string} repoPath - Repository path
 * @param {number} limit - Top N rules (default 5)
 * @param {number} days - Look back N days (default 30)
 * @returns {Array} - Array of {rule, count, severity, percentage}
 */
export function getTopRecurringErrors(repoPath, limit = 5, days = 30) {
  const errorFreq = getErrorFrequency(repoPath, days);

  const total = errorFreq.reduce((sum, e) => sum + e.count, 0);

  return errorFreq.slice(0, limit).map((e) => ({
    rule: e.rule,
    count: e.count,
    severity: e.severity,
    percentage: total > 0 ? Math.round((e.count / total) * 100) : 0,
  }));
}

/**
 * Calculate improvement score (0-100) based on error trend.
 * Score factors:
 *   - CRITICAL errors: -5 pts each
 *   - MODERATE errors: -2 pts each
 *   - MINOR errors: -0.5 pts each
 *   - Weekly trend: bonus if improving
 * @param {string} repoPath - Repository path
 * @returns {Object} - {score, trend, details}
 */
export function getImprovementScore(repoPath) {
  const db = getDb();

  // Get weekly data
  const twoWeeks = db
    .prepare(
      `
    SELECT
      DATE(r.timestamp) as date,
      SUM(CASE WHEN el.severity = 'CRITICAL' THEN 1 ELSE 0 END) as critical_count,
      SUM(CASE WHEN el.severity = 'MODERATE' THEN 1 ELSE 0 END) as moderate_count,
      SUM(CASE WHEN el.severity = 'MINOR' THEN 1 ELSE 0 END) as minor_count
    FROM runs r
    LEFT JOIN errors_log el ON r.id = el.run_id
    WHERE r.repo_path = ? AND r.timestamp >= date('now', '-14 days')
    GROUP BY DATE(r.timestamp)
    ORDER BY date DESC
  `
    )
    .all(repoPath);

  if (twoWeeks.length === 0) {
    return { score: 100, trend: 'none', details: 'No data' };
  }

  // Split into this week and last week
  const thisWeek = twoWeeks.slice(0, 7);
  const lastWeek = twoWeeks.slice(7, 14);

  // Calculate weighted error scores
  const calcScore = (days) => {
    let penalties = 0;
    for (const day of days) {
      penalties +=
        (day.critical_count || 0) * 5 +
        (day.moderate_count || 0) * 2 +
        (day.minor_count || 0) * 0.5;
    }
    return penalties;
  };

  const thisWeekScore = calcScore(thisWeek);
  const lastWeekScore = calcScore(lastWeek);

  // Determine trend
  let trend = 'stable';
  if (thisWeekScore < lastWeekScore * 0.8) {
    trend = 'improving';
  } else if (thisWeekScore > lastWeekScore * 1.2) {
    trend = 'declining';
  }

  // Final score: 100 - penalty, clamped to 0-100
  const finalScore = Math.max(0, Math.min(100, 100 - thisWeekScore));

  return {
    score: Math.round(finalScore),
    trend,
    details: {
      thisWeekPenalty: thisWeekScore,
      lastWeekPenalty: lastWeekScore,
      improvement: trend === 'improving' ? Math.round(((lastWeekScore - thisWeekScore) / lastWeekScore) * 100) : 0,
    },
  };
}

/**
 * Get weekly summary for report.
 * @param {string} repoPath - Repository path
 * @returns {Object} - {week, runs, errors, fixes, patternHits}
 */
export function getWeeklySummary(repoPath) {
  const db = getDb();

  const week = db
    .prepare(
      `
    SELECT
      COUNT(id) as runs,
      SUM(errors_found) as errors,
      SUM(fixes_accepted) as fixes,
      SUM(pattern_hits) as pattern_hits,
      SUM(CASE WHEN commit_allowed = 1 THEN 1 ELSE 0 END) as successful_commits
    FROM runs
    WHERE repo_path = ? AND timestamp >= date('now', '-7 days')
  `
    )
    .get(repoPath);

  return {
    week: 'last 7 days',
    runs: week?.runs || 0,
    errors: week?.errors || 0,
    fixes: week?.fixes || 0,
    patternHits: week?.pattern_hits || 0,
    successfulCommits: week?.successful_commits || 0,
  };
}

/**
 * Get error breakdown by severity.
 * @param {string} repoPath - Repository path
 * @param {number} days - Look back N days (default 30)
 * @returns {Object} - {critical, moderate, minor, total}
 */
export function getErrorBreakdown(repoPath, days = 30) {
  const db = getDb();

  const cutoffDate = new Date(Date.now() - days * 24 * 60 * 60 * 1000)
    .toISOString()
    .split('T')[0];

  const result = db
    .prepare(
      `
    SELECT
      SUM(CASE WHEN el.severity = 'CRITICAL' THEN 1 ELSE 0 END) as critical,
      SUM(CASE WHEN el.severity = 'MODERATE' THEN 1 ELSE 0 END) as moderate,
      SUM(CASE WHEN el.severity = 'MINOR' THEN 1 ELSE 0 END) as minor,
      COUNT(el.id) as total
    FROM errors_log el
    JOIN runs r ON el.run_id = r.id
    WHERE r.repo_path = ? AND r.timestamp >= ?
  `
    )
    .get(repoPath, cutoffDate);

  return {
    critical: result?.critical || 0,
    moderate: result?.moderate || 0,
    minor: result?.minor || 0,
    total: result?.total || 0,
  };
}
