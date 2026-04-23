/**
 * JavaScript / TypeScript built-in adapter
 * Wraps src/profiles/javascript.js to implement LinterAdapter
 */

import { lintJavaScript } from '../../profiles/javascript.js';
import { applyFix } from '../../tui/FixEngine.js';
import { existsSync, readdirSync } from 'fs';
import { resolve } from 'path';

const adapter = {
  // Metadata
  name: 'JavaScript / TypeScript',
  language: 'javascript',
  version: '0.1.0',
  extensions: ['.js', '.jsx', '.ts', '.tsx', '.mjs', '.cjs', '.d.ts'],
  linter: 'ESLint 8',
  license: 'MIT',
  homepage: 'https://github.com/anthropics/codexa',

  /**
   * Detect if repository contains JavaScript/TypeScript
   * Check for package.json or .js/.ts files
   */
  async detect(repoPath) {
    try {
      // Check for package.json
      if (existsSync(resolve(repoPath, 'package.json'))) {
        return true;
      }

      // Scan for JS/TS files (shallow)
      const entries = readdirSync(repoPath, { withFileTypes: true });
      for (const entry of entries) {
        if (entry.isFile()) {
          const name = entry.name.toLowerCase();
          if (
            name.endsWith('.js') ||
            name.endsWith('.ts') ||
            name.endsWith('.jsx') ||
            name.endsWith('.tsx')
          ) {
            return true;
          }
        }
      }

      return false;
    } catch (err) {
      return false;
    }
  },

  /**
   * Lint JavaScript/TypeScript files
   * Filter to supported extensions and delegate to lintJavaScript
   */
  async lint(files) {
    // Filter to supported extensions
    const jsFiles = files.filter((f) =>
      adapter.extensions.some((ext) => f.endsWith(ext))
    );

    if (jsFiles.length === 0) {
      return [];
    }

    // Delegate to existing profile
    return await lintJavaScript(jsFiles);
  },

  /**
   * Auto-fix a JavaScript linting error
   * Delegate to FixEngine
   */
  async fix(file, rule) {
    // Build a minimal error object
    const error = {
      file,
      rule,
      line: 0,
      column: 0,
      severity: 'MODERATE',
      message: `Fix ${rule}`,
      language: 'javascript',
    };

    // Delegate to FixEngine
    const result = await applyFix(error);
    return result || { success: false, diff: null, message: 'Fix failed' };
  },
};

export default adapter;
