import { readFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const packagePath = resolve(__dirname, '../../package.json');
const pkg = JSON.parse(readFileSync(packagePath, 'utf8'));

/**
 * Determine whether to render TUI or output CI JSON
 */
export async function renderResults(classifiedResult, config, options = {}) {
  const { ciMode = false } = options;
  const isTTY = process.stdout.isTTY && !ciMode;

  if (!isTTY) {
    // CI mode: output structured JSON and exit
    outputCIJson(classifiedResult);
    return;
  }

  // Interactive mode: launch Ink TUI
  try {
    // Dynamic imports for JSX transpilation
    const React = await import('react');
    const { render } = await import('ink');
    const { default: App } = await import('./App.js');

    // Create component using React.createElement to avoid JSX parsing
    const component = React.createElement(App, {
      result: classifiedResult,
      config,
    });

    render(component);
  } catch (err) {
    console.error('TUI Error:', err.message);
    outputCIJson(classifiedResult);
  }
}

/**
 * Output structured JSON for CI environments
 */
export function outputCIJson(classifiedResult) {
  const { blocking, warnings, minor, preexisting } = classifiedResult;

  // Determine overall result status
  let result = 'clean';
  if (blocking.length > 0) {
    result = 'blocked';
  } else if (warnings.length > 0) {
    result = 'warned';
  }

  const output = {
    codexa: pkg.version || '0.1.0',
    timestamp: new Date().toISOString(),
    result,
    blocking: blocking.map(normalizeErrorForJson),
    warnings: warnings.map(normalizeErrorForJson),
    minor: minor.map(normalizeErrorForJson),
    preexisting: preexisting.map(normalizeErrorForJson),
    summary: {
      total: blocking.length + warnings.length + minor.length + preexisting.length,
      blocking: blocking.length,
      warnings: warnings.length,
      minor: minor.length,
      preexisting: preexisting.length,
    },
  };

  console.log(JSON.stringify(output));

  // Exit with appropriate code
  process.exit(result === 'blocked' ? 1 : 0);
}

/**
 * Normalize error object for JSON output
 */
function normalizeErrorForJson(error) {
  return {
    file: error.file,
    line: error.line,
    col: error.col,
    message: error.message,
    rule: error.rule,
    severity: error.severity,
    language: error.language,
    isInDiff: error.isInDiff,
    blameCategory: error.blameCategory,
  };
}
