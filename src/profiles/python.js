import { execFile } from 'child_process';
import { promisify } from 'util';
import { createError, SEVERITIES } from '../core/schema.js';

const execFileAsync = promisify(execFile);

const SEVERITY_MAP = {
  [SEVERITIES.CRITICAL]: ['E9', 'F8', 'F4'], // syntax errors, undefined names, import errors
  [SEVERITIES.MODERATE]: ['C9', 'B'], // complexity, bugbear
  [SEVERITIES.MINOR]: ['E1', 'E2', 'E3', 'E4', 'E5', 'E6', 'E7', 'W', 'I'], // style errors, warnings, isort
};

function mapSeverity(errorCode) {
  for (const [severity, prefixes] of Object.entries(SEVERITY_MAP)) {
    for (const prefix of prefixes) {
      if (errorCode.startsWith(prefix)) {
        return severity;
      }
    }
  }
  return SEVERITIES.MINOR; // default
}

export async function lintPython(files) {
  const pyFiles = files.filter(f => f.endsWith('.py'));

  if (!pyFiles.length) {
    return [];
  }

  try {
    const { stdout } = await execFileAsync('ruff', ['check', '--output-format=json', ...pyFiles]);
    let results = [];
    if (stdout.trim()) {
      results = JSON.parse(stdout);
    }

    const errors = [];
    for (const result of results) {
      const severity = mapSeverity(result.code);
      const error = createError({
        file: result.filename,
        line: result.location.row,
        col: result.location.column,
        message: result.message,
        rule: result.code,
        severity,
        language: 'python',
        isInDiff: false,
      });
      errors.push(error);
    }

    return errors;
  } catch (err) {
    if (err.code === 'ENOENT') {
      throw new Error(
        'ruff is not installed or not on PATH.\n' +
        'Fix: pip install ruff OR brew install ruff, then rerun codexa check.'
      );
    }
    // ruff exits with code 1 if it found issues, but stdout is still valid JSON
    if (err.stdout) {
      try {
        const results = JSON.parse(err.stdout);
        const errors = [];
        for (const result of results) {
          const severity = mapSeverity(result.code);
          const error = createError({
            file: result.filename,
            line: result.location.row,
            col: result.location.column,
            message: result.message,
            rule: result.code,
            severity,
            language: 'python',
            isInDiff: false,
          });
          errors.push(error);
        }
        return errors;
      } catch (parseErr) {
        throw new Error(
          `ruff returned output that could not be parsed as JSON: ${parseErr.message}.\n` +
          'Fix: run "ruff check --output-format=json <file.py>" manually to inspect the raw output.'
        );
      }
    }
    throw new Error(
      `ruff failed: ${err.message}.\n` +
      'Fix: run "ruff check --output-format=json <file.py>" manually and confirm ruff is up to date.'
    );
  }
}
