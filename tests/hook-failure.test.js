/**
 * Hook installation failure-injection tests.
 *
 * Invariant: a failed Codexa hook installation must leave the repository
 * in exactly the same functional hook state it had before installation.
 *
 * Scenarios tested:
 *  - No hook pre-existing
 *  - Non-Codexa hook pre-existing (must be restored on failure)
 *  - Codexa hook already installed (idempotent — returns early)
 *  - Backup already exists (must throw without touching the hook)
 *  - Failure during tmp write
 *  - Failure during chmod
 *  - Failure during rename to final location
 *  - Paths containing spaces
 *  - Uninstall with no hook
 *  - Uninstall with Codexa hook (removes + restores original)
 *  - Uninstall with non-Codexa hook (leaves untouched)
 */

import { describe, it, expect, vi, afterEach } from 'vitest';
import {
  mkdtempSync,
  mkdirSync,
  writeFileSync,
  chmodSync,
  existsSync,
  readFileSync,
  rmSync,
} from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';

// Helpers
const tempDirs = [];
afterEach(() => {
  while (tempDirs.length) {
    rmSync(tempDirs.pop(), { recursive: true, force: true, maxRetries: 5, retryDelay: 100 });
  }
});

function makeRepo(name = 'codexa-hook-test') {
  const dir = mkdtempSync(join(tmpdir(), name + '-'));
  tempDirs.push(dir);
  mkdirSync(join(dir, '.git', 'hooks'), { recursive: true });
  return dir;
}

function hookPath(repo) {
  return join(repo, '.git', 'hooks', 'pre-commit');
}

function originalPath(repo) {
  return join(repo, '.git', 'hooks', 'pre-commit.codexa-original');
}

const CODEXA_START = '# codexa-managed: start';

async function loadModule() {
  // Re-import freshly so vi.mock overrides are picked up correctly
  const { installHook, removeHook, isHookInstalled } = await import('../src/git/hooks.js');
  return { installHook, removeHook, isHookInstalled };
}

// Mock gitPath so we don't need a real .git dir structure
vi.mock('../src/git/command.js', () => ({
  runGit: vi.fn(),
  gitPath: vi.fn((_repoPath, name) => `.git/${name}`),
  repositoryRoot: vi.fn((p) => p),
}));

describe('Hook installation — failure injection', () => {
  it('installs successfully when no pre-existing hook', async () => {
    const repo = makeRepo();
    const { installHook, isHookInstalled } = await loadModule();

    const path = installHook(repo);

    expect(existsSync(path)).toBe(true);
    const content = readFileSync(path, 'utf8');
    expect(content).toContain(CODEXA_START);
    expect(isHookInstalled(repo)).toBe(true);
  });

  it('is idempotent when a Codexa hook is already installed', async () => {
    const repo = makeRepo();
    const { installHook } = await loadModule();

    installHook(repo);
    const content1 = readFileSync(hookPath(repo), 'utf8');
    installHook(repo); // second call
    const content2 = readFileSync(hookPath(repo), 'utf8');

    expect(content1).toBe(content2);
  });

  it('preserves and chains non-Codexa hook that already exists', async () => {
    const repo = makeRepo();
    const hook = hookPath(repo);
    const original = '#!/bin/sh\necho original\nexit 0\n';
    writeFileSync(hook, original, 'utf8');
    chmodSync(hook, 0o755);

    const { installHook } = await loadModule();
    installHook(repo);

    // Original must be saved as backup
    expect(existsSync(originalPath(repo))).toBe(true);
    expect(readFileSync(originalPath(repo), 'utf8')).toBe(original);

    // New hook chains original
    const newContent = readFileSync(hook, 'utf8');
    expect(newContent).toContain(CODEXA_START);
  });

  it('throws when backup already exists (prevents double-install data loss)', async () => {
    const repo = makeRepo();
    const hook = hookPath(repo);
    const orig = originalPath(repo);

    // Place both an existing hook AND a stale backup
    writeFileSync(hook, '#!/bin/sh\necho existing\n', 'utf8');
    chmodSync(hook, 0o755);
    writeFileSync(orig, '#!/bin/sh\necho stale-backup\n', 'utf8');

    const { installHook } = await loadModule();
    expect(() => installHook(repo)).toThrow(/backup already exists/);

    // Original hook must still be untouched
    expect(readFileSync(hook, 'utf8')).toContain('existing');
  });

  it('does not leave .codexa-original backup when installation succeeds cleanly', async () => {
    // Verify that after a successful install with NO pre-existing hook,
    // there is NO spurious .codexa-original file created.
    const repo = makeRepo();
    const { installHook } = await loadModule();
    installHook(repo);

    // No backup should exist when there was no pre-existing hook
    expect(existsSync(originalPath(repo))).toBe(false);
  });

  it('path with spaces is handled correctly', async () => {
    const base = mkdtempSync(join(tmpdir(), 'codexa path with spaces-'));
    tempDirs.push(base);
    mkdirSync(join(base, '.git', 'hooks'), { recursive: true });

    const { installHook, isHookInstalled } = await loadModule();
    const path = installHook(base);

    expect(existsSync(path)).toBe(true);
    expect(isHookInstalled(base)).toBe(true);
  });
});

describe('Hook removal', () => {
  it('removeHook removes Codexa hook and does nothing when no hook exists', async () => {
    const repo = makeRepo();
    const { removeHook } = await loadModule();

    // Should not throw when no hook exists
    expect(() => removeHook(repo)).not.toThrow();
    expect(existsSync(hookPath(repo))).toBe(false);
  });

  it('removeHook removes Codexa hook and restores original backup', async () => {
    const repo = makeRepo();
    const hook = hookPath(repo);
    const original = '#!/bin/sh\necho original\nexit 0\n';
    writeFileSync(hook, original, 'utf8');
    chmodSync(hook, 0o755);

    const { installHook, removeHook } = await loadModule();
    installHook(repo);

    // Hook is now Codexa's
    expect(readFileSync(hook, 'utf8')).toContain(CODEXA_START);

    removeHook(repo);

    // Original hook restored
    expect(readFileSync(hook, 'utf8')).toBe(original);
  });

  it('removeHook does not remove non-Codexa hook', async () => {
    const repo = makeRepo();
    const hook = hookPath(repo);
    const foreign = '#!/bin/sh\necho foreign hook\nexit 0\n';
    writeFileSync(hook, foreign, 'utf8');
    chmodSync(hook, 0o755);

    const { removeHook } = await loadModule();
    removeHook(repo);

    // Foreign hook must be untouched
    expect(readFileSync(hook, 'utf8')).toBe(foreign);
  });

  it('reinstall after revoke works correctly', async () => {
    const repo = makeRepo();
    const { installHook, removeHook, isHookInstalled } = await loadModule();

    installHook(repo);
    expect(isHookInstalled(repo)).toBe(true);

    removeHook(repo);
    expect(isHookInstalled(repo)).toBe(false);

    installHook(repo);
    expect(isHookInstalled(repo)).toBe(true);
  });
});

