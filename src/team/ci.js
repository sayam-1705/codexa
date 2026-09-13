import { runLinter } from '../core/runner.js';
import { runGit } from '../git/command.js';
import { readFileSync } from 'fs';
import { relative } from 'path';
import { isAbsolute } from 'path';
import { getStagedFiles } from '../git/diff.js';
import { discoverSupportedFiles } from '../core/files.js';
import { filterBaselineFindings, loadBaseline } from '../core/baseline.js';

const CODEXA_VERSION = JSON.parse(readFileSync(new URL('../../package.json', import.meta.url), 'utf8')).version;

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
      stagedFiles = await discoverSupportedFiles(repoPath, config);

      if (baseBranch) {
        // Filter to only changed files in diff
        stagedFiles = getChangedFiles(repoPath, baseBranch, stagedFiles);
      }
    } else {
      // Get staged files (default git check mode)
      stagedFiles = await getStagedFiles(repoPath);
    }

    // Run linter
    const baseline = loadBaseline(repoPath);
    const scanConfig = allFiles ? config : { ...config, snapshot: 'index' };
    const classified = filterBaselineFindings(await runLinter(stagedFiles, repoPath, scanConfig), repoPath, baseline);

    // Format output
    let output;
    if ((outputFormat || config.ci?.outputFormat) === 'sarif') {
      output = formatSarifOutput(classified, repoPath, config);
    } else {
      output = formatCIOutput(classified, repoPath, config);
    }

    // Print JSON to stdout (no ANSI codes)
    console.log(JSON.stringify(output, null, 2));

    // Determine exit code
    let exitCode = 0;
    const blockThreshold = config?.team?.blockThreshold || 1;
    if (config.ci.failOn === 'CRITICAL' && classified.blocking.length >= blockThreshold) {
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
    branch: getCurrentBranch(repoPath),
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

export function formatSarifOutput(result, repoPath = process.cwd()) {
  const allErrors = [
    ...result.blocking,
    ...result.warnings,
    ...result.minor,
    ...result.preexisting,
  ];

  const results = allErrors.map(error => {
    let level = 'note';
    if (error.severity === 'CRITICAL') {
      level = 'error';
    } else if (error.severity === 'MODERATE') {
      level = 'warning';
    }

    return {
      ruleId: error.rule || 'unknown',
      level,
      message: {
        text: error.message
      },
      locations: [
        {
          physicalLocation: {
            artifactLocation: {
              uri: (isAbsolute(error.file) ? relative(repoPath, error.file) : error.file).replace(/\\/g, '/')
            },
            region: {
              startLine: error.line || 1,
              startColumn: error.col || 1
            }
          }
        }
      ]
    };
  });

  return {
    $schema: "https://json.schemastore.org/sarif-2.1.0.json",
    version: "2.1.0",
    runs: [
      {
        tool: {
          driver: {
            name: "codexa",
            informationUri: "https://github.com/sayam-1705/codexa",
            version: CODEXA_VERSION
          }
        },
        results
      }
    ]
  };
}

// Helper functions

function getChangedFiles(repoPath, baseBranch, allFiles) {
    const target = baseBranch.startsWith('origin/') ? baseBranch : `origin/${baseBranch}`;
    const output = runGit(['diff', `${target}...HEAD`, '--name-only'], repoPath);
    const changedSet = new Set(output.split('\n').filter((f) => f.length > 0));
    return allFiles.filter(file => changedSet.has(relative(repoPath, file).replace(/\\/g, '/')));
}

function getCurrentBranch(repoPath) {
  try {
    return runGit(['rev-parse', '--abbrev-ref', 'HEAD'], repoPath).trim();
  } catch (error) {
    return 'unknown';
  }
}
