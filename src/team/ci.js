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
    const selectedOutputFormat = outputFormat || config.ci?.outputFormat;
    if (selectedOutputFormat === 'sarif') {
      output = formatSarifOutput(classified, repoPath, config);
    } else if (selectedOutputFormat === 'text') {
      output = formatTextOutput(classified, repoPath, config);
    } else {
      output = formatCIOutput(classified, repoPath, config);
    }

    console.log(typeof output === 'string' ? output : JSON.stringify(output, null, 2));

    // Determine exit code (runner.js is the single source of truth)
    let exitCode = 0;
    if (classified.ciAllowed === false) {
      exitCode = 1;
    }

    return { ok: exitCode === 0, exitCode, output };
  } catch (err) {
    const errorPayload = {
      error: `CI check failed: ${err.message}`,
      fix: 'Run codexa config validate, ensure git is available, and rerun codexa check --ci.',
    };
    // CI JSON is a stdout contract, including infrastructure/config failures.
    console.log(JSON.stringify(errorPayload));

    return { ok: false, exitCode: 1, error: errorPayload };
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
  if ((result.adapterFailures || []).length > 0) {
    status = 'error';
  } else if (result.blocking.length > 0) {
    status = 'blocked';
  } else if (result.warnings.length > 0) {
    status = 'warned';
  }

  const enforceOnCI = config?.team?.enforceOnCI ?? true;

  const output = {
    codexa: CODEXA_VERSION,
    timestamp: new Date().toISOString(),
    repo: repoPath,
    branch: getCurrentBranch(repoPath),
    result: status,
    enforceOnCI,
    enforcementDisabled: !enforceOnCI,
    failOn: config.ci?.failOn,
    blocking: result.blocking || [],
    warnings: result.warnings || [],
    minor: result.minor || [],
    preexisting: result.preexisting || [],
    adapterFailures: result.adapterFailures || [],
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

export function formatTextOutput(result, repoPath, config) {
  const output = formatCIOutput(result, repoPath, config);
  const lines = [
    `Codexa ${output.codexa} - ${output.result.toUpperCase()}`,
    `Files checked: ${output.summary.filesChecked}`,
    `Blocking: ${output.summary.blocking}`,
    `Warnings: ${output.summary.warnings}`,
    `Minor: ${output.summary.minor}`,
  ];
  for (const failure of output.adapterFailures) {
    lines.push(`Adapter failure (${failure.phase || 'load'}): ${failure.name}: ${failure.error}`);
  }
  for (const error of [...output.blocking, ...output.warnings, ...output.minor]) {
    lines.push(`${error.file}:${error.line} ${error.rule}: ${error.message}`);
  }
  return `${lines.join('\n')}\n`;
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
