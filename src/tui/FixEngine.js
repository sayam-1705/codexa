import {
  readFileSync,
  writeFileSync,
  existsSync,
  realpathSync,
  lstatSync,
  statSync,
  mkdtempSync,
  rmSync,
  renameSync,
  chmodSync,
} from 'fs';
import { execFileSync } from 'child_process';
import { dirname, relative, resolve, sep, basename, join } from 'path';

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

    if (error.language !== 'javascript' && error.language !== 'typescript' && error.language !== 'python') {
      return {
        success: false,
        diff: null,
        message: 'Auto-fix not supported for this language',
      };
    }

    if (!error.repoPath) {
      return { success: false, diff: null, message: 'Repository root is required for auto-fix' };
    }

    const root = realpathSync(resolve(error.repoPath));
    const targetPath = resolve(error.file);
    const targetStats = lstatSync(targetPath);
    if (!targetStats.isFile() || targetStats.isSymbolicLink()) {
      return { success: false, diff: null, message: 'Fix target must be a regular file' };
    }
    const target = realpathSync(targetPath);
    const relativeTarget = relative(root, target);
    if (relativeTarget === '..' || relativeTarget.startsWith(`..${sep}`) || relativeTarget === '') {
      return { success: false, diff: null, message: 'Fix target is outside the repository' };
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
  let tempDir;
  try {
    const { ESLint } = await import('eslint');
    const filePath = error.file;
    const before = readFileSync(filePath, 'utf8');
    const mode = statSync(filePath).mode & 0o7777;

    const eslint = new ESLint(buildEslintOptions({ rule: error.rule, fix: true }));

    const results = await eslint.lintText(before, { filePath });

    // Check if ESLint made changes
    if (results[0] && results[0].output) {
      const after = preserveNewlineStyle(before, results[0].output);
      const verification = await verifyEslintContent(ESLint, after, filePath, error.rule);
      if (!verification.verified) {
        return { success: false, diff: null, message: verification.message };
      }

      tempDir = mkdtempSync(join(dirname(filePath), `.${basename(filePath)}.codexa-`));
      const tempPath = join(tempDir, basename(filePath));
      writeFileSync(tempPath, after, { encoding: 'utf8', mode });
      chmodSync(tempPath, mode);
      renameSync(tempPath, filePath);

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
  } finally {
    if (tempDir) rmSync(tempDir, { recursive: true, force: true });
  }
}

/**
 * Fix using ruff command-line
 */
async function fixWithRuff(error) {
  let tempDir;
  try {
    const filePath = error.file;
    const before = readFileSync(filePath, 'utf8');
    const mode = statSync(filePath).mode & 0o7777;
    tempDir = mkdtempSync(join(dirname(filePath), `.${basename(filePath)}.codexa-`));
    const tempPath = join(tempDir, basename(filePath));
    writeFileSync(tempPath, before, { encoding: 'utf8', mode });
    chmodSync(tempPath, mode);

    // Map error.rule to ruff rule code (e.g., 'E501', 'F841')
    // For now, assume error.rule is already a ruff code
    const ruffCode = error.rule.toUpperCase();

    try {
      execFileSync('ruff', ['check', '--fix', '--select', ruffCode, tempPath], {
        stdio: 'pipe',
      });
    } catch (e) {
      // ruff returns exit code 1 even on successful fixes, so don't fail here
    }

    const after = preserveNewlineStyle(before, readFileSync(tempPath, 'utf8'));

    if (before !== after) {
      const verification = verifyRuffContent(tempPath, ruffCode);
      if (!verification.verified) {
        return { success: false, diff: null, message: verification.message };
      }
      writeFileSync(tempPath, after, { encoding: 'utf8', mode });
      chmodSync(tempPath, mode);
      renameSync(tempPath, filePath);
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
  } finally {
    if (tempDir) rmSync(tempDir, { recursive: true, force: true });
  }
}

async function verifyEslintContent(ESLint, content, filePath, rule) {
  const verificationEslint = new ESLint(buildEslintOptions({ rule, fix: false }));
  const result = await verificationEslint.lintText(content, { filePath });
  const messages = result[0]?.messages || [];
  if (messages.some((message) => message.fatal || message.ruleId === rule)) {
    return { verified: false, message: `ESLint verification failed for ${rule}` };
  }
  return { verified: true };
}

function verifyRuffContent(filePath, rule) {
  try {
    const output = execFileSync('ruff', ['check', '--output-format=json', '--select', rule, filePath], {
      encoding: 'utf8',
      stdio: ['pipe', 'pipe', 'pipe'],
    });
    const findings = output.trim() ? JSON.parse(output) : [];
    return findings.length === 0
      ? { verified: true }
      : { verified: false, message: `Ruff verification found ${rule}` };
  } catch (err) {
    if (err.stdout !== undefined) {
      try {
        const findings = err.stdout.trim() ? JSON.parse(err.stdout) : [];
        return findings.length === 0
          ? { verified: true }
          : { verified: false, message: `Ruff verification found ${rule}` };
      } catch {
        // Fall through to the explicit verification failure below.
      }
    }
    return { verified: false, message: `Ruff verification failed: ${err.message}` };
  }
}

function preserveNewlineStyle(before, after) {
  if (before.includes('\r\n') && !after.includes('\r\n')) {
    return after.replace(/\n/g, '\r\n');
  }
  return after;
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
      return { status: 'clean', findings: results[0]?.messages || [] };
    } else if (language === 'python') {
      const output = execFileSync('ruff', ['check', '--output-format=json', filePath], {
        encoding: 'utf8',
        stdio: ['pipe', 'pipe', 'ignore'],
      });
      return { status: 'clean', findings: JSON.parse(output || '[]') };
    }
  } catch (err) {
    if (err.stdout !== undefined) {
      try {
        const findings = JSON.parse(err.stdout || '[]');
        return { status: findings.length ? 'findings' : 'clean', findings };
      } catch {
        // Report malformed linter output below.
      }
    }
    return { status: 'failed', findings: [], message: err.message };
  }

  return { status: 'failed', findings: [], message: `Unsupported language: ${language}` };
}
