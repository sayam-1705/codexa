export const SEVERITIES = {
  CRITICAL: 'CRITICAL',
  MODERATE: 'MODERATE',
  MINOR: 'MINOR',
};

export const BLAME_CATEGORIES = {
  YOURS: 'yours',
  PREEXISTING: 'preexisting',
  UNKNOWN: 'unknown',
};

export function createError(fields) {
  const required = ['file', 'line', 'col', 'message', 'rule', 'severity', 'language'];

  for (const field of required) {
    if (!(field in fields)) {
      throw new Error(`Missing required field: ${field}`);
    }
  }

  if (!Object.values(SEVERITIES).includes(fields.severity)) {
    throw new Error(
      `Invalid severity: ${fields.severity}. Must be one of: ${Object.values(SEVERITIES).join(', ')}`
    );
  }

  const blameCategory = fields.blameCategory || BLAME_CATEGORIES.UNKNOWN;
  if (!Object.values(BLAME_CATEGORIES).includes(blameCategory)) {
    throw new Error(
      `Invalid blameCategory: ${blameCategory}. Must be one of: ${Object.values(BLAME_CATEGORIES).join(', ')}`
    );
  }

  const error = {
    file: fields.file,
    line: fields.line,
    col: fields.col,
    message: fields.message,
    rule: fields.rule,
    severity: fields.severity,
    language: fields.language,
    isInDiff: fields.isInDiff !== undefined ? fields.isInDiff : false,
    blameCategory,
  };

  return Object.freeze(error);
}
