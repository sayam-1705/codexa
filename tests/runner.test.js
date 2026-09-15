import { describe, it, expect, vi, beforeEach } from 'vitest';
import { resolve } from 'path';
import { runLinter } from '../src/core/runner.js';
import { getEnabledAdapters } from '../src/plugins/registry.js';
import { logCommitCheck } from '../src/learning/history.js';

// Mock the solo modules to prevent better-sqlite3 issues
vi.mock('../src/solo/db.js', () => ({
  getDb: vi.fn(() => null),
  logRun: vi.fn(() => 1),
}));

vi.mock('../src/solo/streak.js', () => ({
  getCurrentStreak: vi.fn(() => 0),
  getStreakDisplay: vi.fn(() => ({
    current: 0,
    best: 0,
    display: '✓ Ready to commit',
    level: 'none',
  })),
}));

vi.mock('../src/learning/history.js', () => ({
  logCommitCheck: vi.fn(),
}));

// Mock the registry and loader to speed up tests
vi.mock('../src/plugins/registry.js', () => ({
  getEnabledAdapters: vi.fn(async () => {
    const jsAdapter = await import('../src/plugins/adapters/javascript.js');
    const pyAdapter = await import('../src/plugins/adapters/python.js');
    return [jsAdapter.default, pyAdapter.default];
  }),
}));

describe('runner', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it(
    'runLinter([]) returns classified result with empty arrays',
    { timeout: 10000 },
    async () => {
      const result = await runLinter([]);
      expect(result.blocking).toEqual([]);
      expect(result.warnings).toEqual([]);
      expect(result.minor).toEqual([]);
      expect(result.preexisting).toEqual([]);
      expect(result.runId).toBeNull();
      expect(result.streak).toBe(0);
    }
  );

  it('fails closed when every selected adapter failed to load', async () => {
    getEnabledAdapters.mockResolvedValueOnce(Object.assign([], {
      failedAdapters: [{ name: 'javascript', language: 'javascript', phase: 'load', error: 'module missing' }],
    }));

    const result = await runLinter(['/tmp/example.js'], process.cwd(), { adapterFailurePolicy: 'fail' });

    expect(result.adapterFailures).toHaveLength(1);
    expect(result.adapterFailureBlocks).toBe(true);
    expect(result.commitAllowed).toBe(false);
  });

  it('keeps successful adapters running but blocks auto mode when another adapter failed', async () => {
    const python = {
      name: 'Python', language: 'python', extensions: ['.py'],
      lint: vi.fn(async () => []),
    };
    getEnabledAdapters.mockResolvedValueOnce(Object.assign([python], {
      failedAdapters: [{ name: 'javascript', language: 'javascript', phase: 'load', error: 'module missing' }],
    }));

    const result = await runLinter([resolve('tests/fixtures/py-errors.py')], process.cwd(), { languages: ['auto'] });

    expect(python.lint).toHaveBeenCalledOnce();
    expect(result.adapterFailures).toHaveLength(1);
    expect(result.commitAllowed).toBe(false);
  });

  it('does not block a python-only check for an unselected JavaScript adapter failure', async () => {
    const python = {
      name: 'Python', language: 'python', extensions: ['.py'],
      lint: vi.fn(async () => []),
    };
    getEnabledAdapters.mockResolvedValueOnce(Object.assign([python], {
      failedAdapters: [{ name: 'javascript', language: 'javascript', phase: 'load', error: 'module missing' }],
    }));

    const result = await runLinter([resolve('tests/fixtures/py-errors.py')], process.cwd(), { languages: ['python'] });

    expect(python.lint).toHaveBeenCalledOnce();
    expect(result.adapterFailures).toEqual([]);
    expect(result.commitAllowed).toBe(true);
  });

  it.each(['warn', 'ignore'])('reports but does not block a selected adapter failure with %s policy', async (adapterFailurePolicy) => {
    getEnabledAdapters.mockResolvedValueOnce(Object.assign([], {
      failedAdapters: [{ name: 'python', language: 'python', phase: 'load', error: 'module missing' }],
    }));

    const result = await runLinter(['/tmp/example.py'], process.cwd(), {
      languages: ['python'],
      adapterFailurePolicy,
    });

    expect(result.adapterFailures).toHaveLength(1);
    expect(result.adapterFailureBlocks).toBe(false);
    expect(result.commitAllowed).toBe(true);
  });

  it(
    'runLinter(null) returns classified result with empty arrays',
    { timeout: 10000 },
    async () => {
      const result = await runLinter(null);
      expect(result.blocking).toEqual([]);
      expect(result.warnings).toEqual([]);
      expect(result.minor).toEqual([]);
      expect(result.preexisting).toEqual([]);
      expect(result.runId).toBeNull();
      expect(result.streak).toBe(0);
    }
  );

  it(
    'runLinter() returns classified result for unsupported file extensions',
    { timeout: 10000 },
    async () => {
      const result = await runLinter(['/path/to/file.md', '/path/to/readme.txt']);
      expect(result.blocking).toEqual([]);
      expect(result.warnings).toEqual([]);
      expect(result.minor).toEqual([]);
      expect(result.preexisting).toEqual([]);
    }
  );

  it(
    'runLinter() returns normalized error objects with all required fields',
    { timeout: 10000 },
    async () => {
      const fixture = resolve('tests/fixtures/js-errors.js');
      const result = await runLinter([fixture]);

      const allErrors = [...result.blocking, ...result.warnings, ...result.minor, ...result.preexisting];
      expect(allErrors.length).toBeGreaterThan(0);

      for (const error of allErrors) {
        expect(error).toHaveProperty('file');
        expect(error).toHaveProperty('line');
        expect(error).toHaveProperty('col');
        expect(error).toHaveProperty('message');
        expect(error).toHaveProperty('rule');
        expect(error).toHaveProperty('severity');
        expect(error).toHaveProperty('language');
        expect(error).toHaveProperty('isInDiff');
        expect(error).toHaveProperty('blameCategory');
        expect(Object.isFrozen(error)).toBe(true);
      }
    }
  );

  it('records non-empty checks in repository history', async () => {
    const fixture = resolve('tests/fixtures/js-errors.js');
    await runLinter([fixture]);

    expect(logCommitCheck).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({
        filesChecked: 1,
        errorsFound: expect.any(Number),
        errorsBlocked: expect.any(Number),
        patternHits: expect.any(Number),
      })
    );
  });

  it(
    'runLinter() correctly groups files by language before linting',
    { timeout: 10000 },
    async () => {
      const jsFixture = resolve('tests/fixtures/js-errors.js');
      const tsFixture = resolve('tests/fixtures/ts-errors.ts');
      const result = await runLinter([jsFixture, tsFixture]);

      const allErrors = [...result.blocking, ...result.warnings, ...result.minor, ...result.preexisting];
      const languages = new Set(allErrors.map(e => e.language));
      expect(languages.size).toBeGreaterThan(0);
    }
  );
});
