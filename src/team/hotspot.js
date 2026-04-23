/**
 * Hotspot detection module
 * Identifies error-prone files and rules with priority calculation
 */

/**
 * Detect hotspots from linter results
 * Combines error count, severity weighting, and recency
 * @param {Array} errors - All errors from linting (blocking + warnings + minor)
 * @param {Object} options - { maxHotspots: number, weighing: 'count'|'severity' }
 * @returns {Array} - Sorted hotspots with priority
 */
export function detectHotspots(errors, options = {}) {
  const { maxHotspots = 10, weighting = 'severity' } = options;

  if (!errors || errors.length === 0) {
    return [];
  }

  // Group errors by file
  const fileErrors = {};
  for (const error of errors) {
    if (!fileErrors[error.file]) {
      fileErrors[error.file] = [];
    }
    fileErrors[error.file].push(error);
  }

  // Calculate priority per file
  const hotspots = Object.entries(fileErrors)
    .map(([file, fileErrorList]) => {
      const errorCount = fileErrorList.length;

      // Weight by severity: blocking=3, warning=2, minor=1
      let severityScore = 0;
      for (const err of fileErrorList) {
        if (err.severity === 'CRITICAL' || err.level === 'blocking') {
          severityScore += 3;
        } else if (err.severity === 'MODERATE' || err.level === 'warning') {
          severityScore += 2;
        } else {
          severityScore += 1;
        }
      }

      // Priority based on weighting strategy
      const priority =
        weighting === 'severity'
          ? severityScore / (errorCount || 1)
          : errorCount;

      // Extract unique rules
      const rules = [...new Set(fileErrorList.map((e) => e.rule || e.code))];

      return {
        file,
        errorCount,
        severityScore,
        priority,
        rules,
        mostCommonRule:
          rules.length > 0
            ? fileErrorList.reduce((max, err) => {
                const rule = err.rule || err.code;
                return max === rule || !max
                  ? rule
                  : fileErrorList.filter((e) => (e.rule || e.code) === rule).length >
                    fileErrorList.filter((e) => (e.rule || e.code) === max).length
                  ? rule
                  : max;
              }, rules[0])
            : null,
      };
    })
    .sort((a, b) => b.priority - a.priority)
    .slice(0, maxHotspots);

  return hotspots;
}

/**
 * Generate recommendations for hotspots
 * Suggests actions based on file patterns and rule frequency
 * @param {Array} hotspots - From detectHotspots
 * @returns {Array} - Recommendations with actionability
 */
export function generateRecommendations(hotspots) {
  const recommendations = [];

  if (hotspots.length === 0) {
    return [];
  }

  // Recommendation 1: Top file to refactor
  const topFile = hotspots[0];
  recommendations.push({
    priority: 'HIGH',
    type: 'refactor',
    target: topFile.file,
    reason: `${topFile.errorCount} errors, primarily rule "${topFile.mostCommonRule}"`,
    action: `Review and refactor ${topFile.file} to address ${topFile.mostCommonRule}`,
    impact: 'high',
  });

  // Recommendation 2: Common rule to address
  const ruleFrequency = {};
  for (const hs of hotspots) {
    for (const rule of hs.rules) {
      ruleFrequency[rule] = (ruleFrequency[rule] || 0) + 1;
    }
  }

  const mostFrequentRule = Object.entries(ruleFrequency).sort((a, b) => b[1] - a[1])[0];
  if (mostFrequentRule) {
    recommendations.push({
      priority: 'MEDIUM',
      type: 'rule-suppression',
      target: mostFrequentRule[0],
      reason: `Appears in ${mostFrequentRule[1]} hotspots`,
      action: `Review rule "${mostFrequentRule[0]}" config or suppress in specific files`,
      impact: 'medium',
    });
  }

  // Recommendation 3: Bulk cleanup if many files affected
  if (hotspots.length > 5) {
    recommendations.push({
      priority: 'MEDIUM',
      type: 'bulk-cleanup',
      target: 'codebase',
      reason: `${hotspots.length} files with high error density`,
      action: 'Consider team-wide cleanup sprint for top issues',
      impact: 'medium',
    });
  }

  return recommendations;
}

/**
 * Merge new hotspots with existing tracked hotspots
 * Maintains history and detects improving/worsening trends
 * @param {Array} existingHotspots - Previously tracked hotspots
 * @param {Array} newHotspots - Current run hotspots
 * @returns {Array} - Merged with trend indicators
 */
export function mergeHotspots(existingHotspots = [], newHotspots = []) {
  const merged = {};

  // Add existing hotspots with decay
  for (const hs of existingHotspots) {
    merged[hs.file] = {
      ...hs,
      previousErrorCount: hs.errorCount,
      trend: 'stable',
    };
  }

  // Update or add new hotspots
  for (const hs of newHotspots) {
    if (merged[hs.file]) {
      const prev = merged[hs.file].previousErrorCount || merged[hs.file].errorCount;
      merged[hs.file] = {
        ...hs,
        previousErrorCount: prev,
        trend: hs.errorCount < prev ? 'improving' : hs.errorCount > prev ? 'worsening' : 'stable',
      };
    } else {
      merged[hs.file] = {
        ...hs,
        previousErrorCount: 0,
        trend: 'new',
      };
    }
  }

  return Object.values(merged)
    .sort((a, b) => b.priority - a.priority)
    .slice(0, 10);
}
