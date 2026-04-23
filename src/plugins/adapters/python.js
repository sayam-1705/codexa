/**
 * Python built-in adapter
 * Wraps src/profiles/python.js to implement LinterAdapter
 */

import { lintPython } from '../../profiles/python.js';
import { existsSync, readdirSync } from 'fs';
import { resolve } from 'path';

const adapter = {
  // Metadata
  name: 'Python',
  language: 'python',
  version: '0.1.0',
  extensions: ['.py', '.pyw', '.pyi'],
  linter: 'ruff',
  license: 'MIT',
  homepage: 'https://github.com/anthropics/codexa',

  /**
   * Detect if repository contains Python
   * Check for requirements.txt, pyproject.toml, setup.py, or .py files
   */
  async detect(repoPath) {
    try {
      // Check for config files
      const configFiles = ['requirements.txt', 'pyproject.toml', 'setup.py'];
      for (const file of configFiles) {
        if (existsSync(resolve(repoPath, file))) {
          return true;
        }
      }

      // Scan for Python files (shallow)
      const entries = readdirSync(repoPath, { withFileTypes: true });
      for (const entry of entries) {
        if (entry.isFile() && entry.name.endsWith('.py')) {
          return true;
        }
      }

      return false;
    } catch (err) {
      return false;
    }
  },

  /**
   * Lint Python files
   * Filter to .py files and delegate to lintPython
   */
  async lint(files, config) {
    // Filter to Python files
    const pyFiles = files.filter((f) =>
      adapter.extensions.some((ext) => f.endsWith(ext))
    );

    if (pyFiles.length === 0) {
      return [];
    }

    // Delegate to existing profile
    return await lintPython(pyFiles);
  },

  /**
   * Auto-fix a Python linting error
   * Currently returns not implemented
   */
  async fix(file, rule, config) {
    return {
      success: false,
      diff: null,
      message: `No auto-fix available for Python rule: ${rule}`,
    };
  },
};

export default adapter;
