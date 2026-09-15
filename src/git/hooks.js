import { writeFileSync, readFileSync, chmodSync, existsSync, rmSync, renameSync, mkdirSync, unlinkSync } from 'fs';
import { dirname, resolve } from 'path';
import { gitPath } from './command.js';

const CODEXA_START = '# codexa-managed: start';
const CODEXA_END = '# codexa-managed: end';

function shellQuote(value) {
  return `'${String(value).replaceAll("'", "'\\''")}'`;
}

function hookPath(repoPath) {
  return resolve(repoPath, gitPath(repoPath, 'hooks'), 'pre-commit');
}

function originalPath(path) {
  return `${path}.codexa-original`;
}

function hookScript(backup) {
  const chain = backup ? `
if [ -x ${shellQuote(backup)} ]; then
  ${shellQuote(backup)} "$@"
  status=$?
  if [ $status -ne 0 ]; then exit $status; fi
fi
` : '';
  return `#!/bin/sh
# codexa-managed — do not remove this line
${CODEXA_START}${chain}
repo_root=$(git rev-parse --show-toplevel) || exit 1
if [ -x "$repo_root/node_modules/.bin/codexa" ]; then
  "$repo_root/node_modules/.bin/codexa" check
  status=$?
elif command -v codexa >/dev/null 2>&1; then
  codexa check
  status=$?
elif command -v npx >/dev/null 2>&1; then
  npx --no-install codexa check
  status=$?
else
  echo "Codexa executable not found; refusing to bypass pre-commit checks." >&2
  exit 127
fi
${CODEXA_END}
exit $status
`;
}

export function installHook(repoPath) {
  const path = hookPath(repoPath);
  mkdirSync(dirname(path), { recursive: true });

  // If already a Codexa hook, nothing to do
  if (existsSync(path)) {
    const content = readFileSync(path, 'utf8');
    if (content.includes(CODEXA_START)) return path;
  }

  let backup = null;
  // Preserve existing non-Codexa hook
  if (existsSync(path)) {
    backup = originalPath(path);
    if (existsSync(backup)) {
      throw new Error(`Cannot install Codexa hook: backup already exists at ${backup}`);
    }
    renameSync(path, backup);
  }

  // Write to temporary file first
  const tmpPath = `${path}.tmp`;
  try {
    writeFileSync(tmpPath, hookScript(backup), 'utf8');
    chmodSync(tmpPath, 0o755);
    renameSync(tmpPath, path);
  } catch (err) {
    // Cleanup temp file on failure
    try {
      if (existsSync(tmpPath)) unlinkSync(tmpPath);
    } catch {
      // Ignore cleanup errors
    }
    // Restore original hook if we moved it
    if (backup && existsSync(backup)) {
      try {
        if (existsSync(path)) rmSync(path);
        renameSync(backup, path);
      } catch {
        // Best-effort restoration
      }
    }
    throw err;
  }

  return path;
}

export function removeHook(repoPath) {
  const path = hookPath(repoPath);
  if (!existsSync(path)) {
    return; // Hook doesn't exist, nothing to remove
  }

  const content = readFileSync(path, 'utf8');
  if (content.includes(CODEXA_START)) {
    rmSync(path);
    const backup = originalPath(path);
    if (existsSync(backup)) renameSync(backup, path);
  }
}

export function isHookInstalled(repoPath) {
  const path = hookPath(repoPath);
  if (!existsSync(path)) {
    return false;
  }
  return readFileSync(path, 'utf8').includes(CODEXA_START);
}
