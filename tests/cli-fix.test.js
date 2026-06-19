import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { writeFileSync, mkdirSync, rmSync, existsSync } from 'fs';
import { resolve } from 'path';
import { tmpdir } from 'os';

// Mock heavy modules
vi.mock('../src/ai/ollama.js', () => ({
  isOllamaAvailable: vi.fn(() => false),
  getAvailableModels: vi.fn(() => []),
  selectBestModel: vi.fn(() => null),
}));

vi.mock('../src/team/config.js', () => ({
  loadConfig: vi.fn(async () => ({ blameMode: 'strict', ai: { enabled: true } })),
}));

vi.mock('../src/core/runner.js', () => ({
  runLinter: vi.fn(async () => ({
    blocking: [],
    warnings: [],
    minor: [],
    preexisting: [],
  })),
}));

import { findErrorAtLocation } from '../src/core/locate.js';
import { runLinter } from '../src/core/runner.js';

describe('findErrorAtLocation', () => {
  let tempDir;
  let testFile;

  beforeEach(() => {
    tempDir = resolve(tmpdir(), `codexa-locate-test-${Date.now()}`);
    mkdirSync(tempDir, { recursive: true });
    testFile = resolve(tempDir, 'test.js');
    writeFileSync(testFile, 'const x = 1;\nconsole.log(x);\n', 'utf8');
    vi.spyOn(process, 'cwd').mockReturnValue(tempDir);
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
    if (existsSync(tempDir)) {
      rmSync(tempDir, { recursive: true, force: true });
    }
  });

  it('returns null when no errors at location', async () => {
    runLinter.mockResolvedValue({
      blocking: [],
      warnings: [],
      minor: [],
      preexisting: [],
    });

    const result = await findErrorAtLocation(testFile, 1);
    expect(result).toBeNull();
  });

  it('returns matching error when present at given line', async () => {
    const error = { file: testFile, line: 2, col: 1, rule: 'no-console', severity: 'MODERATE', message: 'Unexpected console' };
    runLinter.mockResolvedValue({
      blocking: [],
      warnings: [error],
      minor: [],
      preexisting: [],
    });

    const result = await findErrorAtLocation(testFile, 2);
    expect(result).toBeDefined();
    expect(result.rule).toBe('no-console');
    expect(result.line).toBe(2);
  });

  it('returns null when error is on a different line', async () => {
    const error = { file: testFile, line: 2, col: 1, rule: 'no-console', severity: 'MODERATE', message: 'Unexpected console' };
    runLinter.mockResolvedValue({
      blocking: [],
      warnings: [error],
      minor: [],
      preexisting: [],
    });

    const result = await findErrorAtLocation(testFile, 5); // line 5, error on line 2
    expect(result).toBeNull();
  });

  it('searches blocking, warnings, minor, and preexisting', async () => {
    runLinter.mockResolvedValue({
      blocking: [{ file: testFile, line: 1, col: 1, rule: 'no-undef', severity: 'CRITICAL', message: 'Undef' }],
      warnings: [{ file: testFile, line: 2, col: 1, rule: 'no-console', severity: 'MODERATE', message: 'Console' }],
      minor: [{ file: testFile, line: 3, col: 1, rule: 'prefer-const', severity: 'MINOR', message: 'Prefer const' }],
      preexisting: [{ file: testFile, line: 4, col: 1, rule: 'eqeqeq', severity: 'MODERATE', message: 'Use ===' }],
    });

    expect(await findErrorAtLocation(testFile, 1)).toMatchObject({ rule: 'no-undef' });
    expect(await findErrorAtLocation(testFile, 2)).toMatchObject({ rule: 'no-console' });
    expect(await findErrorAtLocation(testFile, 3)).toMatchObject({ rule: 'prefer-const' });
    expect(await findErrorAtLocation(testFile, 4)).toMatchObject({ rule: 'eqeqeq' });
  });
});
