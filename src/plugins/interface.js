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
 * - Every error MUST use createError() from 'codexa-cli/schema'
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
 *
 * Warnings (valid but incomplete):
 * - adapter.name is missing or empty
 * - adapter.language is missing
 * - adapter.extensions is not an array
 *
 * NEVER throws. Always returns the result object.
 */
export function validateAdapter(adapter) {
  const errors = [];
  const warnings = [];

  if (!adapter) {
    errors.push('Adapter is null or undefined');
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

  // Check recommended metadata
  if (!adapter.name || typeof adapter.name !== 'string' || adapter.name.trim() === '') {
    warnings.push('adapter.name is missing or empty');
  }

  if (!adapter.language || typeof adapter.language !== 'string') {
    warnings.push('adapter.language is missing or not a string');
  }

  if (!Array.isArray(adapter.extensions)) {
    warnings.push('adapter.extensions should be an array of file extensions');
  }

  const valid = errors.length === 0;

  return { valid, errors, warnings };
}
