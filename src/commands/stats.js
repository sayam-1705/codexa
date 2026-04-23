import { getLifetimeStats, getErrorFrequency } from '../solo/trends.js';
import { getStreakData } from '../solo/streak.js';
import { getImprovementScore, getWeeklySummary } from '../solo/trends.js';
import { renderGauge } from '../solo/sparkline.js';

/**
 * Generate and print the stats command output.
 * Shows lifetime statistics and improvement metrics.
 */
export async function statsCommand() {
  const repoPath = process.cwd();

  try {
    // Fetch data
    const lifetime = getLifetimeStats(repoPath);
    const topErrors = getErrorFrequency(repoPath, 365); // All time
    const streak = getStreakData(repoPath);
    const improvement = getImprovementScore(repoPath);
    const weekly = getWeeklySummary(repoPath);

    // Build output
    const lines = [];
    lines.push('');
    lines.push('╔════════════════════════════════════════════════════════════════╗');
    lines.push('║                   CODEXA LIFETIME STATS                        ║');
    lines.push('╚════════════════════════════════════════════════════════════════╝');
    lines.push('');

    // Time range
    if (lifetime.first_run) {
      const start = new Date(lifetime.first_run).toLocaleDateString();
      const end = new Date(lifetime.last_run).toLocaleDateString();
      lines.push(`  📆 Since: ${start} → ${end}`);
    }
    lines.push('');

    // Commits
    lines.push('  ═══════════════════════════════════════════════════════════');
    lines.push('  COMMIT HISTORY');
    lines.push('  ═══════════════════════════════════════════════════════════');
    lines.push(`  Total checks:        ${String(lifetime.total_runs || 0).padEnd(6)} runs`);
    lines.push(`  Successful:          ${String(lifetime.successful_commits || 0).padEnd(6)}`);
    lines.push(`  Forced:              ${String(lifetime.forced_commits || 0).padEnd(6)}`);
    const successRate =
      lifetime.total_runs && lifetime.total_runs > 0
        ? Math.round((lifetime.successful_commits / lifetime.total_runs) * 100)
        : 0;
    lines.push(`  Success rate:        ${successRate}%`);
    lines.push('');

    // Errors
    lines.push('  ─────────────────────────────────────────────────────────');
    lines.push('  ERROR STATISTICS');
    lines.push('  ─────────────────────────────────────────────────────────');
    lines.push(`  Total errors found:  ${String(lifetime.total_errors_found || 0).padEnd(6)}`);
    lines.push(`  Errors blocked:      ${String(lifetime.total_errors_blocked || 0).padEnd(6)}`);
    lines.push(`  Errors fixed:        ${String(lifetime.total_fixes_accepted || 0).padEnd(6)}`);
    lines.push('');

    // Fixes & AI
    lines.push('  ─────────────────────────────────────────────────────────');
    lines.push('  FIXES & LEARNING');
    lines.push('  ─────────────────────────────────────────────────────────');
    lines.push(
      `  Fixes accepted:      ${String(lifetime.total_fixes_accepted || 0).padEnd(6)}`
    );
    lines.push(`  AI queries:          ${String(lifetime.total_ai_queries || 0).padEnd(6)}`);
    lines.push(`  Pattern hits:        ${String(lifetime.total_pattern_hits || 0).padEnd(6)}`);
    const patternEfficiency =
      lifetime.total_ai_queries && lifetime.total_pattern_hits
        ? Math.round((lifetime.total_pattern_hits / (lifetime.total_ai_queries + lifetime.total_pattern_hits)) * 100)
        : 0;
    lines.push(`  Pattern hit rate:    ${patternEfficiency}%`);
    lines.push('');

    // Performance
    lines.push('  ─────────────────────────────────────────────────────────');
    lines.push('  PERFORMANCE');
    lines.push('  ─────────────────────────────────────────────────────────');
    const avgDuration = lifetime.avg_duration_ms
      ? Math.round(lifetime.avg_duration_ms)
      : 0;
    lines.push(`  Avg check time:      ${avgDuration}ms`);
    lines.push('');

    // Improvement score
    lines.push('  ─────────────────────────────────────────────────────────');
    lines.push('  IMPROVEMENT SCORE');
    lines.push('  ─────────────────────────────────────────────────────────');
    lines.push(`  ${renderGauge(improvement.score, '  Score')}`);
    lines.push(`  Trend:               ${improvement.trend.toUpperCase()}`);
    lines.push('');

    // Streak
    lines.push('  ─────────────────────────────────────────────────────────');
    lines.push('  STREAK RECORDS');
    lines.push('  ─────────────────────────────────────────────────────────');
    lines.push(`  Current:             ${streak.display}`);
    lines.push(`  Best ever:           ${streak.best}-commit streak`);
    lines.push('');

    // Weekly stats
    if (weekly.runs > 0) {
      lines.push('  ─────────────────────────────────────────────────────────');
      lines.push('  LAST 7 DAYS');
      lines.push('  ─────────────────────────────────────────────────────────');
      lines.push(`  Runs:                ${weekly.runs}`);
      lines.push(`  Errors:              ${weekly.errors}`);
      lines.push(`  Fixes:               ${weekly.fixes}`);
      lines.push(`  Pattern hits:        ${weekly.patternHits}`);
      lines.push('');
    }

    // Top errors all-time
    const allTimeTop = topErrors.slice(0, 5);
    if (allTimeTop.length > 0) {
      lines.push('  ─────────────────────────────────────────────────────────');
      lines.push('  TOP RECURRING ERRORS (ALL TIME)');
      lines.push('  ─────────────────────────────────────────────────────────');
      for (const error of allTimeTop) {
        lines.push(`  ${error.rule.padEnd(30)} ${String(error.count).padEnd(4)} occurrences`);
      }
      lines.push('');
    }

    lines.push('  ═══════════════════════════════════════════════════════════');
    lines.push('  You\'re on a journey to better code quality! 🚀');
    lines.push('');

    console.log(lines.join('\n'));
  } catch (err) {
    console.error(`Error generating stats: ${err.message}`);
    process.exit(1);
  }
}
