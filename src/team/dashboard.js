import { loadSummary, getLeaderboard } from './summary.js';

/**
 * Get dashboard data aggregated from team summary and local DB
 * @param {string} repoPath - Repository path
 * @param {Object} db - Database instance (for future enhancements)
 * @param {Object} config - Config object with team.name, ci settings
 * @returns {Object} - Dashboard data ready for terminal/HTML rendering
 */
export function getDashboardData(repoPath, db, config) {
  const summary = loadSummary(repoPath);

  // Aggregate contributor stats with computed metrics
  const contributors = Object.entries(summary.contributors).map(([email, stats]) => {
    const cleanRunRate =
      stats.totalRuns > 0
        ? Math.round((stats.cleanRuns / stats.totalRuns) * 100)
        : 0;

    return {
      email,
      displayName: stats.displayName,
      totalRuns: stats.totalRuns,
      cleanRuns: stats.cleanRuns,
      blockedRuns: stats.blockedRuns,
      cleanRunRate,
      totalErrorsFound: stats.totalErrorsFound,
      totalFixesAccepted: stats.totalFixesAccepted,
      currentStreak: stats.currentStreak,
      bestStreak: stats.bestStreak,
      topRules: stats.topRules || [],
      languages: stats.languages || [],
      lastActive: stats.lastActive,
    };
  });

  // Calculate trend per contributor (improving/stable/declining)
  // For now, use streak direction as proxy. Future: compare blocked runs in last 10 vs prior 10
  const contributorsWithTrend = contributors.map((c) => ({
    ...c,
    trend: c.currentStreak > 0 ? 'improving' : c.blockedRuns > 0 ? 'declining' : 'stable',
  }));

  // Get hotspots (top error-prone files/rules from summary)
  const hotspots = summary.codebase.hotspots || [];

  // Get leaderboard (only opted-in contributors)
  const optedInEmails = (config.team?.leaderboardOptIn || []).filter((email) =>
    contributors.some((c) => c.email === email)
  );

  const leaderboard = getLeaderboard(summary, 'cleanRunRate', optedInEmails);

  // Get top rules codebase-wide
  const topRules = summary.codebase.topRules || [];

  // Return structured dashboard
  return {
    teamName: config.team?.name || 'Engineering',
    timestamp: summary.lastUpdated,
    codebaseTotalRuns: summary.codebase.totalRuns,
    contributors: contributorsWithTrend,
    leaderboard: leaderboard.map((item) => ({
      ...item,
      rank: leaderboard.indexOf(item) + 1,
    })),
    topRules,
    hotspots,
    summary: {
      totalContributors: contributors.length,
      averageCleanRunRate:
        contributors.length > 0
          ? Math.round(
              contributors.reduce((sum, c) => sum + c.cleanRunRate, 0) / contributors.length
            )
          : 0,
      totalErrorsFound: contributors.reduce((sum, c) => sum + c.totalErrorsFound, 0),
      totalFixesAccepted: contributors.reduce((sum, c) => sum + c.totalFixesAccepted, 0),
      mostActiveDays: [] // Placeholder for future calendar heatmap
    },
  };
}

/**
 * Format dashboard data for terminal display
 * @param {Object} dashboardData - From getDashboardData
 * @returns {string} - ANSI-formatted terminal output
 */
export function formatDashboardTerminal(dashboardData) {
  const lines = [];

  lines.push(`\n📊 ${dashboardData.teamName} Code Quality Dashboard`);
  lines.push(`Last updated: ${new Date(dashboardData.timestamp).toLocaleString()}`);
  lines.push('');

  // Summary stats
  lines.push(`Total runs: ${dashboardData.codebaseTotalRuns}`);
  lines.push(`Contributors: ${dashboardData.summary.totalContributors}`);
  lines.push(
    `Average clean run rate: ${dashboardData.summary.averageCleanRunRate}%`
  );
  lines.push(`Total errors found: ${dashboardData.summary.totalErrorsFound}`);
  lines.push('');

  // Top contributors
  if (dashboardData.leaderboard.length > 0) {
    lines.push('🏆 Top Contributors (by clean run rate):');
    for (const item of dashboardData.leaderboard.slice(0, 5)) {
      lines.push(`  ${item.rank}. ${item.displayName}: ${item.value}% clean runs`);
    }
    lines.push('');
  }

  // Top rules
  if (dashboardData.topRules.length > 0) {
    lines.push('⚠️  Most Common Issues:');
    for (const rule of dashboardData.topRules.slice(0, 5)) {
      lines.push(
        `  • ${rule.rule}: ${rule.count} occurrences (${rule.contributors} contributors)`
      );
    }
    lines.push('');
  }

  // Hotspots
  if (dashboardData.hotspots.length > 0) {
    lines.push('🔥 Hotspots:');
    for (const hs of dashboardData.hotspots.slice(0, 5)) {
      lines.push(`  • ${hs.file}: severity ${hs.priority}, ${hs.errorCount} errors`);
    }
  }

  return lines.join('\n');
}
