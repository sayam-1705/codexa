import { readFileSync, writeFileSync, existsSync, realpathSync } from 'fs';
import { execFileSync } from 'child_process';
import { relative, resolve, sep } from 'path';

import { buildEslintOptions } from '../profiles/eslintConfig.js';
import { savePattern } from '../learning/patterns.js';

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

    if (error.repoPath) {
      const root = realpathSync(resolve(error.repoPath));
      const target = realpathSync(resolve(error.file));
      const relativeTarget = relative(root, target);
      if (relativeTarget === '..' || relativeTarget.startsWith(`..${sep}`)) {
        return { success: false, diff: null, message: 'Fix target is outside the repository' };
      }
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

    const eslint = new ESLint(buildEslintOptions({ rule: error.rule, fix: true }));

    const results = await eslint.lintFiles([filePath]);

    // Check if ESLint made changes
    if (results[0] && results[0].output) {
      const after = results[0].output;
      writeFileSync(filePath, after, 'utf8');

      const diff = computeDiff(before, after);
      saveAcceptedPattern(error, before, after);
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
      execFileSync('ruff', ['check', '--fix', '--select', ruffCode, filePath], {
        stdio: 'pipe',
      });
    } catch (e) {
      // ruff returns exit code 1 even on successful fixes, so don't fail here
    }

    const after = readFileSync(filePath, 'utf8');

    if (before !== after) {
      const diff = computeDiff(before, after);
      saveAcceptedPattern(error, before, after);
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

function saveAcceptedPattern(error, before, after) {
  if (!error.repoPath) return;

  const beforeLines = before.split(/\r?\n/);
  const afterLines = after.split(/\r?\n/);
  const changedLine = beforeLines.findIndex((line, index) => line !== afterLines[index]);
  if (changedLine < 0) return;

  try {
    savePattern(error.repoPath, {
      file: error.file,
      rule: error.rule,
      language: error.language,
      before: beforeLines[changedLine],
      after: afterLines[changedLine] || '',
    });
  } catch {
    // Pattern storage is supplemental and must not invalidate a successful fix.
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
      const eslint = new ESLint(buildEslintOptions());
      const results = await eslint.lintFiles([filePath]);
      return results[0]?.messages || [];
    } else if (language === 'python') {
      const output = execFileSync('ruff', ['check', '--output-format=json', filePath], {
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
