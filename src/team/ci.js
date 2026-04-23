import { runLinter } from '../core/runner.js';
import { execSync } from 'child_process';
import { readdirSync, statSync } from 'fs';
import { resolve, relative } from 'path';

const CODEXA_VERSION = '1.0.0';

/**
 * Run Codexa in CI mode.
 * @param {string} repoPath - Repository path
 * @param {Object} config - Config object
 * @param {Object} options - { allFiles, baseBranch, outputFormat }
 */
export async function runCICheck(repoPath, config, options = {}) {
  const { allFiles, baseBranch, outputFormat } = options;

  try {
    let stagedFiles = [];

    if (allFiles) {
      // Get all supported files from repo
      stagedFiles = getAllSupportedFiles(repoPath);

      if (baseBranch) {
        // Filter to only changed files in diff
        stagedFiles = getChangedFiles(repoPath, baseBranch, stagedFiles);
      }
    } else {
      // Get staged files (default git check mode)
      stagedFiles = getStagedFiles(repoPath);
    }

    // Run linter
    const classified = await runLinter(stagedFiles, repoPath, config);

    // Format output
    const output = formatCIOutput(classified, repoPath, config);

    // Print JSON to stdout (no ANSI codes)
    console.log(JSON.stringify(output, null, 2));

    // Determine exit code
    let exitCode = 0;
    if (config.ci.failOn === 'CRITICAL' && classified.blocking.length > 0) {
      exitCode = 1;
    } else if (
      config.ci.failOn === 'MODERATE' &&
      (classified.blocking.length > 0 || classified.warnings.length > 0)
    ) {
      exitCode = 1;
    } else if (
      config.ci.failOn === 'any' &&
      (classified.blocking.length > 0 ||
        classified.warnings.length > 0 ||
        classified.minor.length > 0)
    ) {
      exitCode = 1;
    }

    process.exit(exitCode);
  } catch (err) {
    console.error(
      JSON.stringify(
        {
          error: `CI check failed: ${err.message}`,
          fix: 'Run codexa config validate, ensure git is available, and rerun codexa check --ci.',
        },
        null,
        2
      )
    );
    process.exit(1);
  }
}

/**
 * Format CI output as JSON structure.
 * @param {Object} result - Linter result
 * @param {string} repoPath - Repository path
 * @param {Object} config - Config
 * @returns {Object} - Formatted output
 */
export function formatCIOutput(result, repoPath, config) {
  let status = 'clean';
  if (result.blocking.length > 0) {
    status = 'blocked';
  } else if (result.warnings.length > 0) {
    status = 'warned';
  }

  const output = {
    codexa: CODEXA_VERSION,
    timestamp: new Date().toISOString(),
    repo: repoPath,
    branch: getCurrentBranch(),
    result: status,
    failOn: config.ci.failOn,
    blocking: result.blocking || [],
    warnings: result.warnings || [],
    minor: result.minor || [],
    preexisting: result.preexisting || [],
    summary: {
      total:
        (result.blocking?.length || 0) +
        (result.warnings?.length || 0) +
        (result.minor?.length || 0),
      blocking: result.blocking?.length || 0,
      warnings: result.warnings?.length || 0,
      minor: result.minor?.length || 0,
      preexisting: result.preexisting?.length || 0,
      filesChecked: result.filesChecked || 0,
      durationMs: result.durationMs || 0,
    },
  };

  // Add badge if enabled
  if (config.ci && config.ci.badge) {
    const badgeUrl =
      status === 'blocked'
        ? 'https://img.shields.io/badge/codexa-blocked-FF4444'
        : status === 'warned'
          ? 'https://img.shields.io/badge/codexa-warnings-F5C842'
          : 'https://img.shields.io/badge/codexa-clean-00E5A0';

    output.badge = {
      url: badgeUrl,
      markdown: `![Codexa](${badgeUrl})`,
    };
  }

  return output;
}

// Helper functions

function getStagedFiles(repoPath) {
  try {
    const output = execSync('git diff --cached --name-only', {
      cwd: repoPath,
      encoding: 'utf8',
    });
    return output.split('\n').filter((f) => f.length > 0);
  } catch (err) {
    return [];
  }
}

function getAllSupportedFiles(repoPath) {
  const extensions = [
    '.js',
    '.jsx',
    '.ts',
    '.tsx',
    '.py',
    '.mjs',
    '.cjs',
    '.d.ts',
  ];
  const files = [];

  function walk(dir) {
    try {
      const entries = readdirSync(dir);

      for (const entry of entries) {
        const fullPath = resolve(dir, entry);
        const stat = statSync(fullPath);
        const ext = entry.substring(entry.lastIndexOf('.'));

        if (stat.isDirectory()) {
          if (!['.git', 'node_modules', 'dist', 'build', '.codexa'].includes(entry)) {
            walk(fullPath);
          }
        } else if (extensions.includes(ext)) {
          files.push(relative(repoPath, fullPath));
        }
      }
    } catch (err) {
      // Ignore read errors
    }
  }

  walk(repoPath);
  return files;
}

function getChangedFiles(repoPath, baseBranch, allFiles) {
  try {
    const target = baseBranch.startsWith('origin/') ? baseBranch : `origin/${baseBranch}`;
    const output = execSync(`git diff ${target}...HEAD --name-only`, {
      cwd: repoPath,
      encoding: 'utf8',
      stdio: ['pipe', 'pipe', 'pipe'],
    });
    const changedSet = new Set(output.split('\n').filter((f) => f.length > 0));
    return allFiles.filter((f) => changedSet.has(f));
  } catch (err) {
    return allFiles;
  }
}

function getCurrentBranch() {
  try {
    return execSync('git rev-parse --abbrev-ref HEAD', {
      encoding: 'utf8',
    }).trim();
  } catch (err) {
    return 'unknown';
  }
}
