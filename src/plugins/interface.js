/**
 * LinterAdapter Interface — the contract all language adapters must implement
 * Community adapters must export an object implementing these three methods
 * plus required metadata fields.
 *
 * This is the foundation of the Codexa plugin ecosystem.
 */

/**
 * Detect if this adapter should handle files in a repository
 * @param {string} repoPath - Absolute path to repository root
 * @returns {Promise<boolean>} - true if adapter applies to this repo
 *
 * Rules:
 * - MUST complete in under 200ms (used at startup for every adapter)
 * - Should check for language config files OR file extensions
 * - MUST never throw — return false on any error
 * - Examples: check for package.json, go.mod, Cargo.toml, .py files, etc.
 */

/**
 * Lint files and return normalized error array
 * @param {string[]} files - Absolute paths to files to lint
 * @param {Object} config - Codexa config object
 * @returns {Promise<Object[]>} - Array of CodexaError objects from schema.js
 *
 * Rules:
 * - Every error MUST use createError() from 'codexa-toolkit/schema'
 * - isInDiff is always false here (blame engine sets it in Phase 2)
 * - MUST handle empty files array — return []
 * - MUST skip unreadable files without crashing
 * - MUST respect config.ignore patterns
 */

/**
 * Apply auto-fix to a linting error
 * @param {string} file - Absolute path to file
 * @param {string} rule - Rule ID to fix
 * @param {Object} config - Codexa config object
 * @returns {Promise<FixResult>} - { success, diff, message }
 *
 * FixResult shape:
 * {
 *   success: boolean,
 *   diff: string | null,
 *   message: string
 * }
 *
 * Rules:
 * - If no auto-fix for rule: return { success: false, diff: null,
 *   message: 'No auto-fix available for: <rule>' }
 * - MUST never corrupt files — write atomically or not at all
 * - Should re-lint after fixing to confirm change was applied
 */

/**
 * Validate an adapter object against the LinterAdapter interface
 * @param {Object} adapter - Candidate adapter object
 * @returns {Object} - { valid: boolean, errors: string[], warnings: string[] }
 *
 * Errors (invalid = adapter is rejected):
 * - adapter.detect is not a function
 * - adapter.lint is not a function
 * - adapter.fix is not a function
 * - adapter.name is missing, empty, or not a string
 * - adapter.language is missing, empty, or not a string
 * - adapter.extensions is not a non-empty array of valid extensions
 *
 * Warnings (valid but incomplete):
 * - adapter.version is not a string
 * - adapter.linter is missing
 *
 * NEVER throws. Always returns the result object.
 */
export function validateAdapter(adapter) {
  const errors = [];
  const warnings = [];

  if (!adapter || typeof adapter !== 'object') {
    errors.push('Adapter is null, undefined, or not an object');
    return { valid: false, errors, warnings };
  }

  // Check required methods
  if (typeof adapter.detect !== 'function') {
    errors.push('adapter.detect must be a function');
  }
  if (typeof adapter.lint !== 'function') {
    errors.push('adapter.lint must be a function');
  }
  if (typeof adapter.fix !== 'function') {
    errors.push('adapter.fix must be a function');
  }

  // Check required metadata as errors (needed for proper adapter operation)
  if (!adapter.name || typeof adapter.name !== 'string' || adapter.name.trim() === '') {
    errors.push('adapter.name is missing, empty, or not a string');
  }

  if (!adapter.language || typeof adapter.language !== 'string' || adapter.language.trim() === '') {
    errors.push('adapter.language is missing, empty, or not a string');
  }

  if (!Array.isArray(adapter.extensions) || adapter.extensions.length === 0) {
    errors.push('adapter.extensions must be a non-empty array of file extensions');
  } else {
    for (const ext of adapter.extensions) {
      if (typeof ext !== 'string' || !ext.startsWith('.') || ext.length < 2) {
        errors.push(`adapter.extensions contains invalid extension: ${ext}`);
      }
    }
  }

  // Check optional metadata
  if (adapter.version !== undefined && typeof adapter.version !== 'string') {
    warnings.push('adapter.version should be a string');
  }

  if (adapter.linter === undefined || !adapter.linter) {
    warnings.push('adapter.linter is recommended for community adapters');
  }

  const valid = errors.length === 0;

  return { valid, errors, warnings };
}

/**
 * Validate the structure of lint results returned by an adapter.
 * @param {any} results - The value returned by adapter.lint()
 * @returns {Object} - { valid: boolean, errors: string[] }
 *
 * NEVER throws.
 */
export function validateLintResult(results) {
  const errors = [];

  if (!Array.isArray(results)) {
    errors.push('Adapter lint() must return an array');
    return { valid: false, errors };
  }

  for (let i = 0; i < results.length; i++) {
    const item = results[i];
    if (!item || typeof item !== 'object') {
      errors.push(`Lint result[${i}] is not an object`);
      continue;
    }
    const required = ['file', 'line', 'col', 'message', 'rule', 'severity', 'language'];
    for (const field of required) {
      if (!(field in item)) {
        errors.push(`Lint result[${i}] missing required field: ${field}`);
      }
    }
    if ('file' in item && (typeof item.file !== 'string' || !item.file)) {
      errors.push(`Lint result[${i}].file must be a non-empty string`);
    }
    for (const field of ['line', 'col']) {
      if (field in item && (!Number.isInteger(item[field]) || item[field] < 1)) {
        errors.push(`Lint result[${i}].${field} must be a positive integer`);
      }
    }
    for (const field of ['message', 'rule', 'severity', 'language']) {
      if (field in item && (typeof item[field] !== 'string' || !item[field])) {
        errors.push(`Lint result[${i}].${field} must be a non-empty string`);
      }
    }
  }

  return { valid: errors.length === 0, errors };
}
