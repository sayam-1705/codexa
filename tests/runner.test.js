import { describe, it, expect, vi, beforeEach } from 'vitest';
import { resolve } from 'path';
import { runLinter } from '../src/core/runner.js';

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
    async () => {
      const result = await runLinter([]);
      expect(result.blocking).toEqual([]);
      expect(result.warnings).toEqual([]);
      expect(result.minor).toEqual([]);
      expect(result.preexisting).toEqual([]);
      expect(result.runId).toBeNull();
      expect(result.streak).toBe(0);
    },
    { timeout: 10000 }
  );

  it(
    'runLinter(null) returns classified result with empty arrays',
    async () => {
      const result = await runLinter(null);
      expect(result.blocking).toEqual([]);
      expect(result.warnings).toEqual([]);
      expect(result.minor).toEqual([]);
      expect(result.preexisting).toEqual([]);
      expect(result.runId).toBeNull();
      expect(result.streak).toBe(0);
    },
    { timeout: 10000 }
  );

  it(
    'runLinter() returns classified result for unsupported file extensions',
    async () => {
      const result = await runLinter(['/path/to/file.md', '/path/to/readme.txt']);
      expect(result.blocking).toEqual([]);
      expect(result.warnings).toEqual([]);
      expect(result.minor).toEqual([]);
      expect(result.preexisting).toEqual([]);
    },
    { timeout: 10000 }
  );

  it(
    'runLinter() returns normalized error objects with all required fields',
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
    },
    { timeout: 10000 }
  );

  it(
    'runLinter() correctly groups files by language before linting',
    async () => {
      const jsFixture = resolve('tests/fixtures/js-errors.js');
      const tsFixture = resolve('tests/fixtures/ts-errors.ts');
      const result = await runLinter([jsFixture, tsFixture]);

      const allErrors = [...result.blocking, ...result.warnings, ...result.minor, ...result.preexisting];
      const languages = new Set(allErrors.map(e => e.language));
      expect(languages.size).toBeGreaterThan(0);
    },
    { timeout: 10000 }
  );
});
