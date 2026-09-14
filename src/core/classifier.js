import { getSeverity } from './severity.js';
import { classifyByDiff } from './blame.js';
import { SEVERITIES, BLAME_CATEGORIES } from './schema.js';

export async function classifyErrors(errors, changedLinesMap, config = {}) {
  if (!errors || !errors.length) {
    return {
      blocking: [],
      warnings: [],
      minor: [],
      preexisting: [],
    };
  }

  // Step 1: Apply severity scoring to each error
  const withSeverity = errors.map(error => {
    const configuredSeverity = config.severity?.overrides?.[error.rule];
    const newError = {
      ...error,
      severity: configuredSeverity || getSeverity(error.rule, error.language),
    };
    return Object.freeze(newError);
  });

  // Step 2: Apply blame classification (already returns frozen objects)
  const withBlame = classifyByDiff(withSeverity, changedLinesMap);

  // Step 3: Apply blameMode logic
  const blameMode = config.blameMode || 'strict';

  const result = {
    blocking: [],
    warnings: [],
    minor: [],
    preexisting: [],
  };

  for (const error of withBlame) {
    const severityConfig = config.severity || {};
    const blockSeverities = severityConfig.block || [SEVERITIES.CRITICAL];
    const warnSeverities = severityConfig.warn || [SEVERITIES.MODERATE];
    const logSeverities = severityConfig.log || [SEVERITIES.MINOR];

    const isPreexisting = error.blameCategory === BLAME_CATEGORIES.PREEXISTING;

    // Determine configured bucket according to precedence: block > warn > log
    let targetBucket = 'minor';
    if (blockSeverities.includes(error.severity)) {
      targetBucket = 'blocking';
    } else if (warnSeverities.includes(error.severity)) {
      targetBucket = 'warnings';
    } else if (logSeverities.includes(error.severity)) {
      targetBucket = 'minor';
    } else {
      // Fallback if severity wasn't included in any bucket
      targetBucket = error.severity === SEVERITIES.CRITICAL ? 'blocking' : error.severity === SEVERITIES.MODERATE ? 'warnings' : 'minor';
    }

    if (blameMode === 'strict') {
      // In strict mode, only newly introduced findings can block. Pre-existing findings move to preexisting.
      if (isPreexisting) {
        result.preexisting.push(error);
      } else {
        result[targetBucket].push(error);
      }
    } else if (blameMode === 'warn') {
      // In warn mode, blame analysis still occurs and findings remain visible.
      // Newly introduced findings follow policy; pre-existing findings are softened so they never block.
      if (isPreexisting) {
        // Pre-existing findings move to preexisting but if targetBucket was blocking, they soften to warning/preexisting
        result.preexisting.push(error);
      } else {
        result[targetBucket].push(error);
      }
    } else if (blameMode === 'off') {
      // In off mode, blame is ignored completely and findings are treated uniformly according to severity/policy.
      result[targetBucket].push(error);
    }
  }

  return result;
}
