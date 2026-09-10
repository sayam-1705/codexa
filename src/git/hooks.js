import { writeFileSync, readFileSync, chmodSync, existsSync, rmSync, renameSync, mkdirSync } from 'fs';
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
npx --no-install codexa check
status=$?
${CODEXA_END}
exit $status
`;
}

export function installHook(repoPath) {
  const path = hookPath(repoPath);
  mkdirSync(dirname(path), { recursive: true });
  let backup;
  if (existsSync(path)) {
    const content = readFileSync(path, 'utf8');
    if (content.includes(CODEXA_START)) return path;
    backup = originalPath(path);
    if (!existsSync(backup)) renameSync(path, backup);
  }
  writeFileSync(path, hookScript(backup), 'utf8');
  chmodSync(path, 0o755);
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
