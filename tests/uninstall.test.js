import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { writeFileSync, mkdirSync, rmSync, existsSync } from 'fs';
import { resolve } from 'path';
import { tmpdir } from 'os';

// Mock git hooks so tests don't touch real .git
vi.mock('../src/git/hooks.js', () => ({
  isHookInstalled: vi.fn(() => true),
  installHook: vi.fn(),
  removeHook: vi.fn(),
}));

import { uninstallCommand } from '../src/commands/uninstall.js';
import { isHookInstalled, removeHook } from '../src/git/hooks.js';

describe('uninstallCommand', () => {
  let tempDir;

  beforeEach(() => {
    tempDir = resolve(tmpdir(), `codexa-uninstall-test-${Date.now()}`);
    mkdirSync(tempDir, { recursive: true });
    vi.clearAllMocks();

    // Stub process.cwd to our temp dir
    vi.spyOn(process, 'cwd').mockReturnValue(tempDir);
  });

  afterEach(() => {
    vi.restoreAllMocks();
    if (existsSync(tempDir)) {
      rmSync(tempDir, { recursive: true, force: true });
    }
  });

  it('removes codexa.config.json when present', async () => {
    const configPath = resolve(tempDir, 'codexa.config.json');
    writeFileSync(configPath, JSON.stringify({ version: 2 }), 'utf8');

    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

    await uninstallCommand({ yes: true });

    expect(existsSync(configPath)).toBe(false);
    logSpy.mockRestore();
  });

  it('removes .codexaignore when present', async () => {
    const ignorePath = resolve(tempDir, '.codexaignore');
    writeFileSync(ignorePath, 'dist/\n', 'utf8');

    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

    await uninstallCommand({ yes: true });

    expect(existsSync(ignorePath)).toBe(false);
    logSpy.mockRestore();
  });

  it('removes .codexa/ directory when present', async () => {
    const codexaDir = resolve(tempDir, '.codexa');
    mkdirSync(codexaDir, { recursive: true });
    writeFileSync(resolve(codexaDir, 'summary.json'), '{}', 'utf8');

    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

    await uninstallCommand({ yes: true });

    expect(existsSync(codexaDir)).toBe(false);
    logSpy.mockRestore();
  });

  it('reports no files when nothing to remove', async () => {
    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    isHookInstalled.mockReturnValue(false);

    await uninstallCommand({ yes: true });

    const allOutput = logSpy.mock.calls.map(c => c.join(' ')).join('\n');
    expect(allOutput).toMatch(/No Codexa files found/);
    logSpy.mockRestore();
  });

  it('calls removeHook when hook is installed', async () => {
    isHookInstalled.mockReturnValue(true);
    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

    await uninstallCommand({ yes: true });

    expect(removeHook).toHaveBeenCalled();
    logSpy.mockRestore();
  });

  it('skips removeHook when hook is not installed', async () => {
    isHookInstalled.mockReturnValue(false);
    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

    await uninstallCommand({ yes: true });

    expect(removeHook).not.toHaveBeenCalled();
    logSpy.mockRestore();
  });
});
