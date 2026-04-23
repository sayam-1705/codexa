import { readFileSync, writeFileSync, existsSync } from 'fs';
import { execSync } from 'child_process';
import { resolve, dirname } from 'path';

function getEslintOptions(rule = null, fix = false) {
  const rules = rule ? { [rule]: 'error' } : {};

  return {
    fix,
    useEslintrc: false,
    baseConfig: {
      env: {
        es2022: true,
        node: true,
      },
      parserOptions: {
        sourceType: 'module',
        ecmaVersion: 2022,
      },
      rules,
    },
  };
}

/**
 * Applies auto-fix for ESLint or ruff issues.
 * @param {Object} error - Error object with file, rule, language properties
 * @returns {Promise<{ success: boolean, diff: string | null, message: string }>}
 */
export async function applyFix(error) {
  try {
    if (!error.file || !existsSync(error.file)) {
      return {
        success: false,
        diff: null,
        message: 'File not found',
      };
    }

    if (error.language === 'javascript' || error.language === 'typescript') {
      return await fixWithEslint(error);
    } else if (error.language === 'python') {
      return await fixWithRuff(error);
    }

    return {
      success: false,
      diff: null,
      message: 'Auto-fix not supported for this language',
    };
  } catch (err) {
    return {
      success: false,
      diff: null,
      message: `Error: ${err.message}`,
    };
  }
}

/**
 * Fix using ESLint Node.js API
 */
async function fixWithEslint(error) {
  try {
    const { ESLint } = await import('eslint');
    const filePath = error.file;
    const before = readFileSync(filePath, 'utf8');

    const eslint = new ESLint(getEslintOptions(error.rule, true));

    const results = await eslint.lintFiles([filePath]);

    // Check if ESLint made changes
    if (results[0] && results[0].output) {
      const after = results[0].output;
      writeFileSync(filePath, after, 'utf8');

      const diff = computeDiff(before, after);
      return {
        success: true,
        diff,
        message: 'Fixed by ESLint',
      };
    }

    return {
      success: false,
      diff: null,
      message: 'No auto-fix available for this rule',
    };
  } catch (err) {
    return {
      success: false,
      diff: null,
      message: `ESLint error: ${err.message}`,
    };
  }
}

/**
 * Fix using ruff command-line
 */
async function fixWithRuff(error) {
  try {
    const filePath = error.file;
    const before = readFileSync(filePath, 'utf8');

    // Map error.rule to ruff rule code (e.g., 'E501', 'F841')
    // For now, assume error.rule is already a ruff code
    const ruffCode = error.rule.toUpperCase();

    try {
      execSync(`ruff check --fix --select ${ruffCode} "${filePath}"`, {
        stdio: 'pipe',
      });
    } catch (e) {
      // ruff returns exit code 1 even on successful fixes, so don't fail here
    }

    const after = readFileSync(filePath, 'utf8');

    if (before !== after) {
      const diff = computeDiff(before, after);
      return {
        success: true,
        diff,
        message: 'Fixed by ruff',
      };
    }

    return {
      success: false,
      diff: null,
      message: 'No auto-fix available for this rule',
    };
  } catch (err) {
    return {
      success: false,
      diff: null,
      message: `ruff error: ${err.message}`,
    };
  }
}

/**
 * Compute a simple line-by-line diff
 */
function computeDiff(before, after) {
  const beforeLines = before.split('\n');
  const afterLines = after.split('\n');

  const diffs = [];
  const maxLines = Math.max(beforeLines.length, afterLines.length);

  for (let i = 0; i < maxLines; i++) {
    const beforeLine = beforeLines[i] || '';
    const afterLine = afterLines[i] || '';

    if (beforeLine !== afterLine) {
      if (beforeLine) {
        diffs.push(`- ${beforeLine}`);
      }
      if (afterLine) {
        diffs.push(`+ ${afterLine}`);
      }
    }
  }

  return diffs.length > 0 ? diffs.join('\n') : null;
}

/**
 * Re-lint a file after a fix to confirm the issue is gone
 * This is used by the TUI to update the issue list in real-time
 */
export async function relintFile(filePath, language) {
  try {
    if (language === 'javascript' || language === 'typescript') {
      const { ESLint } = await import('eslint');
      const eslint = new ESLint(getEslintOptions());
      const results = await eslint.lintFiles([filePath]);
      return results[0]?.messages || [];
    } else if (language === 'python') {
      const output = execSync(`ruff check --output-format=json "${filePath}"`, {
        encoding: 'utf8',
        stdio: ['pipe', 'pipe', 'ignore'],
      });
      return JSON.parse(output || '[]');
    }
  } catch (err) {
    // Silently fail on re-lint errors
    return [];
  }

  return [];
}
