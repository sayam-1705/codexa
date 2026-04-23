/**
 * Example Codexa Language Adapter
 *
 * This is a template for creating custom language adapters for Codexa.
 * Copy this template to build an adapter for your language of choice.
 *
 * See: https://github.com/anthropics/codexa/wiki/Writing-Adapters
 */

// Import Codexa utilities to use in your adapter
// These are exported from the main codexa package
import { createError, SEVERITIES } from 'codexa/schema';
import { execSync } from 'child_process';
import { existsSync, readFileSync } from 'fs';
import { resolve } from 'path';

/**
 * Define your adapter
 * Export a default object implementing the LinterAdapter interface
 */
const MyLanguageAdapter = {
  /**
   * Adapter metadata — displayed in CLI and used for routing
   */
  name: 'MyLanguage',                           // Human-friendly display name
  language: 'mylang',                            // Canonical ID (snake_case)
  version: '0.1.0',                              // Adapter version
  extensions: ['.mylang', '.ml'],                // File extensions handled
  linter: 'my-linter',                           // Underlying linter tool
  license: 'MIT',                                // SPDX license ID
  homepage: 'https://github.com/you/codexa-adapter-mylang',  // Optional

  /**
   * REQUIRED: Detect if this adapter applies to a repository
   *
   * This method is called at startup for EVERY adapter to determine
   * which ones should be loaded for the current repository.
   *
   * Rules:
   * - MUST return a boolean (true = adapter should load)
   * - MUST complete in under 200ms (blocking startup otherwise)
   * - MUST never throw — return false on error
   *
   * @param {string} repoPath - Absolute path to repository root
   * @returns {Promise<boolean>}
   */
  async detect(repoPath) {
    try {
      // Check for language-specific config file
      // Example: Cargo.toml for Rust, go.mod for Go, etc.
      if (existsSync(resolve(repoPath, 'mylang.config'))) {
        return true;
      }

      // Alternatively, check for files in the repo root
      // (shallow check, don't recurse)
      const fs = require('fs');
      const entries = fs.readdirSync(repoPath, { withFileTypes: true });
      for (const entry of entries) {
        if (entry.isFile() && entry.name.endsWith('.mylang')) {
          return true;
        }
      }

      return false;
    } catch (err) {
      // IMPORTANT: Never throw. Return false if anything goes wrong.
      return false;
    }
  },

  /**
   * REQUIRED: Lint files and return normalized error array
   *
   * Your linter (e.g., Clippy for Rust, golangci-lint for Go) is
   * called here. Parse its output and convert each error to Codexa
   * format using createError() from the schema module.
   *
   * Rules:
   * - Every error MUST be built with createError()
   * - isInDiff is ALWAYS false here (blame engine sets it later)
   * - Return [] for empty files array (don't throw)
   * - Skip unreadable files gracefully (don't crash)
   * - Respect config.ignore patterns (optional: filter results)
   *
   * @param {string[]} files - Absolute paths to files to lint
   * @param {Object} config - Codexa config object
   * @returns {Promise<Object[]>} - Array of Codexa error objects
   */
  async lint(files, config) {
    // Filter to files your adapter handles
    const myFiles = files.filter((f) =>
      MyLanguageAdapter.extensions.some((ext) => f.endsWith(ext))
    );

    if (myFiles.length === 0) {
      return [];
    }

    try {
      // Example: shell out to linter tool
      // Replace this with your actual linter invocation
      const output = execSync(
        `my-linter ${myFiles.join(' ')} --format=json`,
        { encoding: 'utf8' }
      );

      const results = JSON.parse(output);

      // Convert to Codexa format
      const errors = [];
      for (const result of results) {
        // Example structure — adapt to your linter's output
        const severity = result.level === 'error' ? 'CRITICAL' : 'MODERATE';
        const error = createError({
          file: result.file,
          line: result.line,
          col: result.column,
          message: result.message,
          rule: result.rule || result.code,
          severity,
          language: MyLanguageAdapter.language,
        });
        errors.push(error);
      }

      return errors;
    } catch (err) {
      // Handle linter failure gracefully
      console.error(`[${MyLanguageAdapter.name}] Lint error: ${err.message}`);
      return [];
    }
  },

  /**
   * REQUIRED: Apply auto-fix to a linting error
   *
   * Implement auto-fixing if your linter supports it.
   * If not, return { success: false, diff: null, message: '...' }
   *
   * Rules:
   * - Return FixResult shape: { success, diff, message }
   * - Never corrupt files — use atomic writes
   * - Re-lint after fixing to confirm it worked
   *
   * @param {string} file - Absolute path to file
   * @param {string} rule - Rule ID (e.g., 'no-unwrap')
   * @param {Object} config - Codexa config object
   * @returns {Promise<FixResult>}
   */
  async fix(file, rule, config) {
    // Example: if your linter supports --fix
    try {
      const before = readFileSync(file, 'utf8');

      // Shell out to linter with --fix flag
      execSync(`my-linter ${file} --fix --rule=${rule}`, {
        stdio: 'pipe',
      });

      const after = readFileSync(file, 'utf8');
      const diff = before !== after ? `Fixed ${rule}` : null;

      return {
        success: diff !== null,
        diff,
        message: diff ? `Applied fix for ${rule}` : 'No changes needed',
      };
    } catch (err) {
      // If no auto-fix available
      return {
        success: false,
        diff: null,
        message: `No auto-fix available for rule: ${rule}`,
      };
    }
  },
};

export default MyLanguageAdapter;
