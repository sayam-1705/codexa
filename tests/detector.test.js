import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import { mkdtempSync, writeFileSync, rmSync, mkdirSync } from 'fs';
import { join } from 'path';
import { detectLanguages } from '../src/core/detector.js';
import { tmpdir } from 'os';

// Mock the registry to avoid test isolation issues
vi.mock('../src/plugins/registry.js', () => ({
  getEnabledAdapters: vi.fn(async () => {
    const jsAdapter = await import('../src/plugins/adapters/javascript.js');
    const pyAdapter = await import('../src/plugins/adapters/python.js');
    return [jsAdapter.default, pyAdapter.default];
  }),
}));

describe('detectLanguages', () => {
  let testDir;

  beforeAll(() => {
    testDir = mkdtempSync(join(tmpdir(), 'codexa-test-'));
  });

  afterAll(() => {
    rmSync(testDir, { recursive: true, force: true });
  });

  it(
    'returns ["javascript"] for dir with only .js files',
    { timeout: 10000 },
    async () => {
      const dir = join(testDir, 'js-only');
      mkdirSync(dir, { recursive: true });
      writeFileSync(join(dir, 'test.js'), '');
      const result = await detectLanguages(dir);
      expect(result).toEqual(['javascript']);
    }
  );

  it(
    'returns ["javascript"] for dir with .ts files',
    { timeout: 10000 },
    async () => {
      const dir = join(testDir, 'ts-only');
      mkdirSync(dir, { recursive: true });
      writeFileSync(join(dir, 'test.ts'), '');
      const result = await detectLanguages(dir);
      expect(result).toEqual(['javascript']);
    }
  );

  it(
    'returns ["javascript"] when BOTH .js and .ts exist',
    { timeout: 10000 },
    async () => {
      const dir = join(testDir, 'js-and-ts');
      mkdirSync(dir, { recursive: true });
      writeFileSync(join(dir, 'test.js'), '');
      writeFileSync(join(dir, 'test.ts'), '');
      const result = await detectLanguages(dir);
      expect(result).toEqual(['javascript']);
    }
  );

  it(
    'returns ["python"] for dir with only .py files',
    { timeout: 10000 },
    async () => {
      const dir = join(testDir, 'py-only');
      mkdirSync(dir, { recursive: true });
      writeFileSync(join(dir, 'test.py'), '');
      const result = await detectLanguages(dir);
      expect(result).toEqual(['python']);
    }
  );

  it(
    'returns ["javascript", "python"] for mixed JS+Python repo',
    { timeout: 10000 },
    async () => {
      const dir = join(testDir, 'mixed-js-py');
      mkdirSync(dir, { recursive: true });
      writeFileSync(join(dir, 'test.js'), '');
      writeFileSync(join(dir, 'test.py'), '');
      const result = await detectLanguages(dir);
      expect(result).toEqual(['javascript', 'python']);
    }
  );

  it(
    'returns [] for dir with no supported files',
    { timeout: 10000 },
    async () => {
      const dir = join(testDir, 'no-supported');
      mkdirSync(dir, { recursive: true });
      writeFileSync(join(dir, 'readme.md'), '');
      const result = await detectLanguages(dir);
      expect(result).toEqual([]);
    }
  );

  it(
    'returns [] for dir that adapters do not detect',
    { timeout: 10000 },
    async () => {
      const dir = join(testDir, 'no-detection');
      mkdirSync(dir, { recursive: true });
      const result = await detectLanguages(dir);
      expect(result).toEqual([]);
    }
  );
});
