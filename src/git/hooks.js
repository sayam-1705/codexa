import { writeFileSync, readFileSync, chmodSync, existsSync, rmSync } from 'fs';
import { join } from 'path';

const HOOK_HEADER = '# codexa-managed — do not remove this line';

const HOOK_SCRIPT = `#!/bin/sh
# codexa-managed — do not remove this line
npx codexa check
if [ $? -ne 0 ]; then
  exit 1
fi
`;

export function installHook(repoPath) {
  const hookPath = join(repoPath, '.git', 'hooks', 'pre-commit');

  // Create hooks directory if it doesn't exist
  const hooksDir = join(repoPath, '.git', 'hooks');
  if (!existsSync(hooksDir)) {
    throw new Error(`Cannot install hook: ${hooksDir} does not exist`);
  }

  writeFileSync(hookPath, HOOK_SCRIPT);
  chmodSync(hookPath, 0o755);
}

export function removeHook(repoPath) {
  const hookPath = join(repoPath, '.git', 'hooks', 'pre-commit');

  if (!existsSync(hookPath)) {
    return; // Hook doesn't exist, nothing to remove
  }

  const content = readFileSync(hookPath, 'utf8');
  if (content.includes(HOOK_HEADER)) {
    rmSync(hookPath);
  }
}

export function isHookInstalled(repoPath) {
  const hookPath = join(repoPath, '.git', 'hooks', 'pre-commit');

  if (!existsSync(hookPath)) {
    return false;
  }

  const content = readFileSync(hookPath, 'utf8');
  return content.includes(HOOK_HEADER);
}
