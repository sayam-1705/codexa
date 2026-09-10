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
    // Apply blameMode filter
    if (blameMode === 'strict') {
      // Only include 'yours' errors in the output
        // Historical findings are excluded; unknown ownership remains enforceable.
        if (error.blameCategory === BLAME_CATEGORIES.PREEXISTING) {
        result.preexisting.push(error);
        continue;
      }
    } else if (blameMode === 'warn') {
      // Include all errors, preexisting get marked
      if (error.blameCategory === BLAME_CATEGORIES.PREEXISTING) {
        result.preexisting.push(error);
        continue;
      }
    } else if (blameMode === 'off') {
      // Include all errors regardless of blame category
      // (blameCategory is still set but ignored for filtering)
    }

    const severityConfig = config.severity || {};
    const blockSeverities = severityConfig.block || [SEVERITIES.CRITICAL];
    const warnSeverities = severityConfig.warn || [SEVERITIES.MODERATE];
    const logSeverities = severityConfig.log || [SEVERITIES.MINOR];

    // Apply configured policy buckets after blame filtering.
    if (blockSeverities.includes(error.severity) && error.blameCategory !== BLAME_CATEGORIES.PREEXISTING) {
      result.blocking.push(error);
    } else if (warnSeverities.includes(error.severity)) {
      result.warnings.push(error);
    } else if (logSeverities.includes(error.severity)) {
      result.minor.push(error);
    } else if (error.blameCategory === BLAME_CATEGORIES.PREEXISTING) {
      // CRITICAL preexisting errors never block
      result.preexisting.push(error);
    }
  }

  return result;
}
