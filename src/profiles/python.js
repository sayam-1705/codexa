import { execFile } from 'child_process';
import { promisify } from 'util';
import { createError, SEVERITIES } from '../core/schema.js';

const execFileAsync = promisify(execFile);



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
      const error = createError({
        file: result.filename,
        line: result.location.row,
        col: result.location.column,
        message: result.message,
        rule: result.code,
        severity: SEVERITIES.MINOR,
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
          const error = createError({
            file: result.filename,
            line: result.location.row,
            col: result.location.column,
            message: result.message,
            rule: result.code,
            severity: SEVERITIES.MINOR,
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
