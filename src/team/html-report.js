/**
 * Generate self-contained HTML reports from dashboard data
 * Static HTML with embedded CSS and JavaScript, no external dependencies
 */

/**
 * Generate static HTML report
 * @param {Object} dashboardData - From getDashboardData()
 * @param {Object} config - Config with team.name, ci settings
 * @returns {string} - Complete HTML document
 */
export function generateHTMLReport(dashboardData) {
  const {
    teamName = 'Team Code Quality',
    timestamp = new Date().toISOString(),
    codebaseTotalRuns = 0,
    contributors = [],
    leaderboard = [],
    topRules = [],
    hotspots = [],
    summary = {},
  } = dashboardData;

  const formattedDate = new Date(timestamp).toLocaleString();

  // Escape HTML to prevent injection
  const esc = (str) => {
    if (!str) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  };

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${esc(teamName)} - Code Quality Report</title>
  <style>
    * {
      margin: 0;
      padding: 0;
      box-sizing: border-box;
    }

    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, sans-serif;
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      color: #333;
      min-height: 100vh;
      padding: 20px;
    }

    .container {
      max-width: 1200px;
      margin: 0 auto;
      background: white;
      border-radius: 12px;
      box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);
      overflow: hidden;
    }

    .header {
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      color: white;
      padding: 40px;
      text-align: center;
    }

    .header h1 {
      font-size: 2.5em;
      margin-bottom: 10px;
    }

    .header p {
      font-size: 0.95em;
      opacity: 0.9;
    }

    .content {
      padding: 40px;
    }

    .stats-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
      gap: 20px;
      margin-bottom: 40px;
    }

    .stat-card {
      background: #f8f9fa;
      border-left: 4px solid #667eea;
      padding: 20px;
      border-radius: 8px;
    }

    .stat-label {
      font-size: 0.85em;
      color: #666;
      margin-bottom: 8px;
      text-transform: uppercase;
      letter-spacing: 0.5px;
    }

    .stat-value {
      font-size: 2em;
      font-weight: 700;
      color: #333;
    }

    .section {
      margin-bottom: 40px;
    }

    .section-title {
      font-size: 1.5em;
      color: #333;
      margin-bottom: 20px;
      padding-bottom: 10px;
      border-bottom: 2px solid #eee;
    }

    table {
      width: 100%;
      border-collapse: collapse;
      margin-bottom: 20px;
    }

    thead {
      background: #f8f9fa;
      border-bottom: 2px solid #ddd;
    }

    th {
      text-align: left;
      padding: 12px;
      font-weight: 600;
      color: #333;
    }

    td {
      padding: 12px;
      border-bottom: 1px solid #eee;
    }

    tr:hover {
      background: #f8f9fa;
    }

    .badge {
      display: inline-block;
      padding: 4px 12px;
      border-radius: 20px;
      font-size: 0.85em;
      font-weight: 500;
    }

    .badge-success {
      background: #d4edda;
      color: #155724;
    }

    .badge-warning {
      background: #fff3cd;
      color: #856404;
    }

    .badge-danger {
      background: #f8d7da;
      color: #721c24;
    }

    .progress-bar {
      width: 100%;
      height: 8px;
      background: #eee;
      border-radius: 4px;
      overflow: hidden;
    }

    .progress-fill {
      height: 100%;
      background: linear-gradient(90deg, #667eea, #764ba2);
      transition: width 0.3s ease;
    }

    .empty-state {
      text-align: center;
      padding: 40px;
      color: #999;
    }

    .footer {
      background: #f8f9fa;
      padding: 20px 40px;
      text-align: center;
      font-size: 0.85em;
      color: #666;
      border-top: 1px solid #eee;
    }

    @media (max-width: 768px) {
      .header h1 {
        font-size: 1.8em;
      }

      .stats-grid {
        grid-template-columns: 1fr;
      }

      table {
        font-size: 0.9em;
      }

      th, td {
        padding: 8px;
      }
    }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>📊 ${esc(teamName)}</h1>
      <p>Code Quality Dashboard</p>
      <p style="font-size: 0.85em; margin-top: 10px;">Generated ${formattedDate}</p>
    </div>

    <div class="content">
      <!-- Summary Stats -->
      <div class="stats-grid">
        <div class="stat-card">
          <div class="stat-label">Total Runs</div>
          <div class="stat-value">${codebaseTotalRuns}</div>
        </div>
        <div class="stat-card">
          <div class="stat-label">Contributors</div>
          <div class="stat-value">${summary.totalContributors || 0}</div>
        </div>
        <div class="stat-card">
          <div class="stat-label">Avg. Clean Rate</div>
          <div class="stat-value">${summary.averageCleanRunRate || 0}%</div>
        </div>
        <div class="stat-card">
          <div class="stat-label">Fixes Accepted</div>
          <div class="stat-value">${summary.totalFixesAccepted || 0}</div>
        </div>
      </div>

      <!-- Leaderboard -->
      ${leaderboard.length > 0 ? `
      <div class="section">
        <h2 class="section-title">🏆 Top Contributors</h2>
        <table>
          <thead>
            <tr>
              <th>Rank</th>
              <th>Contributor</th>
              <th>Clean Run Rate</th>
              <th>Progress</th>
            </tr>
          </thead>
          <tbody>
            ${leaderboard
              .slice(0, 10)
              .map(
                (item) => `
            <tr>
              <td><strong>#${item.rank}</strong></td>
              <td>${esc(item.displayName)}</td>
              <td><span class="badge badge-success">${item.value}%</span></td>
              <td>
                <div class="progress-bar">
                  <div class="progress-fill" style="width: ${item.value}%"></div>
                </div>
              </td>
            </tr>
            `
              )
              .join('')}
          </tbody>
        </table>
      </div>
      ` : ''}

      <!-- Top Rules -->
      ${topRules.length > 0 ? `
      <div class="section">
        <h2 class="section-title">⚠️ Most Common Issues</h2>
        <table>
          <thead>
            <tr>
              <th>Rule</th>
              <th>Occurrences</th>
              <th>Affected Contributors</th>
            </tr>
          </thead>
          <tbody>
            ${topRules
              .slice(0, 10)
              .map(
                (rule) => `
            <tr>
              <td><code>${esc(rule.rule)}</code></td>
              <td><strong>${rule.count}</strong></td>
              <td>${rule.contributors} team members</td>
            </tr>
            `
              )
              .join('')}
          </tbody>
        </table>
      </div>
      ` : ''}

      <!-- Hotspots -->
      ${hotspots.length > 0 ? `
      <div class="section">
        <h2 class="section-title">🔥 Hotspots</h2>
        <table>
          <thead>
            <tr>
              <th>File</th>
              <th>Error Count</th>
              <th>Severity</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            ${hotspots
              .slice(0, 10)
              .map(
                (hs) => `
            <tr>
              <td><code>${esc(hs.file)}</code></td>
              <td>${hs.errorCount}</td>
              <td><span class="badge ${hs.priority > 3 ? 'badge-danger' : 'badge-warning'}">Priority ${Math.round(hs.priority)}</span></td>
              <td>${esc(hs.trend)}</td>
            </tr>
            `
              )
              .join('')}
          </tbody>
        </table>
      </div>
      ` : ''}

      <!-- Contributors -->
      ${contributors.length > 0 ? `
      <div class="section">
        <h2 class="section-title">👥 All Contributors</h2>
        <table>
          <thead>
            <tr>
              <th>Name</th>
              <th>Runs</th>
              <th>Clean Rate</th>
              <th>Current Streak</th>
              <th>Languages</th>
            </tr>
          </thead>
          <tbody>
            ${contributors
              .map(
                (c) => `
            <tr>
              <td>${esc(c.displayName)}</td>
              <td>${c.totalRuns}</td>
              <td><span class="badge badge-success">${c.cleanRunRate}%</span></td>
              <td>${c.currentStreak} <small>${c.currentStreak > 0 ? '🔥' : ''}</small></td>
              <td>${(c.languages || []).join(', ')}</td>
            </tr>
            `
              )
              .join('')}
          </tbody>
        </table>
      </div>
      ` : '<div class="empty-state">No contributors yet</div>'}
    </div>

    <div class="footer">
      <p>Generated by Codexa • Code Quality Guardian</p>
    </div>
  </div>
</body>
</html>`;
}
