import { getTrendData, getTopRecurringErrors, getErrorBreakdown } from '../solo/trends.js';
import { getStreakData } from '../solo/streak.js';
import { renderSparkline } from '../solo/sparkline.js';

/**
 * Generate and print the report command output.
 * @param {Object} options - {days}
 */
export async function reportCommand(options) {
  const repoPath = process.cwd();
  const days = parseInt(options.days) || 30;

  try {
    // Fetch data
    const trend = getTrendData(repoPath, days);
    const topErrors = getTopRecurringErrors(repoPath, 5, days);
    const breakdown = getErrorBreakdown(repoPath, days);
    const streak = getStreakData(repoPath);

    // Build header
    const lines = [];
    lines.push('');
    lines.push('╔════════════════════════════════════════════════════════════════╗');
    lines.push('║                    CODEXA QUALITY REPORT                       ║');
    lines.push('╚════════════════════════════════════════════════════════════════╝');
    lines.push('');

    // Time period
    lines.push(`  📊 Period: Last ${days} days`);
    lines.push(`  📅 ${trend.period.from} to ${trend.period.to}`);
    lines.push('');

    // Overview
    lines.push('  ═══════════════════════════════════════════════════════════');
    lines.push('  OVERVIEW');
    lines.push('  ═══════════════════════════════════════════════════════════');
    lines.push(`  Lints run:           ${String(trend.lifetime.total_runs || 0).padEnd(4)}`);
    lines.push(`  Total errors found:  ${String(trend.totalErrors).padEnd(4)}`);
    lines.push(`  Clean days:          ${trend.cleanDays}/${trend.totalDays} (${trend.cleanDaysPercent}%)`);
    lines.push('');

    // Error breakdown
    lines.push('  ─────────────────────────────────────────────────────────');
    lines.push('  ERROR BREAKDOWN');
    lines.push('  ─────────────────────────────────────────────────────────');
    lines.push(`  🔴 CRITICAL:  ${String(breakdown.critical).padEnd(4)} (${breakdown.total > 0 ? Math.round((breakdown.critical / breakdown.total) * 100) : 0}%)`);
    lines.push(`  🟡 MODERATE:  ${String(breakdown.moderate).padEnd(4)} (${breakdown.total > 0 ? Math.round((breakdown.moderate / breakdown.total) * 100) : 0}%)`);
    lines.push(`  🟢 MINOR:     ${String(breakdown.minor).padEnd(4)} (${breakdown.total > 0 ? Math.round((breakdown.minor / breakdown.total) * 100) : 0}%)`);
    lines.push('');

    // Daily trend
    lines.push('  ─────────────────────────────────────────────────────────');
    lines.push('  DAILY ERROR TREND');
    lines.push('  ─────────────────────────────────────────────────────────');
    const dailyValues = trend.dailyCounts.map((d) => d.count || 0).reverse();
    lines.push(`  ${renderSparkline(dailyValues, { width: 50, showMinMax: true })}`);
    lines.push('');

    // Top recurring errors
    if (topErrors.length > 0) {
      lines.push('  ─────────────────────────────────────────────────────────');
      lines.push('  TOP RECURRING ERRORS');
      lines.push('  ─────────────────────────────────────────────────────────');
      for (const error of topErrors) {
        const percent = error.percentage || 0;
        const bar = '█'.repeat(Math.round(percent / 5));
        lines.push(
          `  ${error.rule.padEnd(25)} ${bar.padEnd(20)} ${error.count} (${percent}%)`
        );
      }
      lines.push('');
    }

    // Streak
    lines.push('  ─────────────────────────────────────────────────────────');
    lines.push('  STREAK STATUS');
    lines.push('  ─────────────────────────────────────────────────────────');
    lines.push(`  Current:  ${streak.display}`);
    lines.push(`  Best:     ${streak.best}-commit streak (${streak.level})`);
    lines.push('');

    // AI & Patterns
    if (trend.lifetime.total_ai_queries > 0 || trend.lifetime.total_pattern_hits > 0) {
      lines.push('  ─────────────────────────────────────────────────────────');
      lines.push('  AI & PATTERNS');
      lines.push('  ─────────────────────────────────────────────────────────');
      lines.push(`  AI queries made:     ${String(trend.lifetime.total_ai_queries || 0).padEnd(4)}`);
      lines.push(`  Pattern hits:        ${String(trend.lifetime.total_pattern_hits || 0).padEnd(4)}`);
      lines.push('');
    }

    // Summary
    lines.push('  ═══════════════════════════════════════════════════════════');
    lines.push('  Keep monitoring your code quality! 📈');
    lines.push('');

    console.log(lines.join('\n'));
  } catch (err) {
    console.error(`Error generating report: ${err.message}`);
    process.exit(1);
  }
}
