import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { writeFileSync, mkdirSync, rmSync } from 'fs';
import { resolve } from 'path';
import { applyFix } from '../src/tui/FixEngine.js';
import { tmpdir } from 'os';

describe('FixEngine', () => {
  let tempDir;

  beforeEach(() => {
    tempDir = resolve(tmpdir(), `codexa-test-${Date.now()}`);
    mkdirSync(tempDir, { recursive: true });
  });

  afterEach(() => {
    if (tempDir) {
      rmSync(tempDir, { recursive: true, force: true });
    }
  });

  it('should handle missing files gracefully', async () => {
    const error = {
      file: '/nonexistent/file.js',
      line: 1,
      col: 5,
      message: 'test',
      rule: 'test-rule',
      language: 'javascript',
    };

    const result = await applyFix(error);

    expect(result.success).toBe(false);
    expect(result.diff).toBeNull();
  });

  it('should return false for unfixable rule (no-undef)', async () => {
    const testFile = resolve(tempDir, 'test.js');
    writeFileSync(testFile, 'console.log(undefinedVar);');

    const error = {
      file: testFile,
      line: 1,
      col: 13,
      message: "'undefinedVar' is not defined",
      rule: 'no-undef',
      language: 'javascript',
    };

    const result = await applyFix(error);

    // ESLint might fail config, or return no-fix
    expect(result.success).toBe(false);
    expect(result.message).toBeDefined();
  });

  it('should not crash when file does not exist', async () => {
    const error = {
      file: resolve(tempDir, 'nonexistent.js'),
      line: 1,
      col: 1,
      message: 'test',
      rule: 'test-rule',
      language: 'javascript',
    };

    const result = await applyFix(error);

    expect(result).toBeDefined();
    expect(result).toHaveProperty('success');
    expect(result).toHaveProperty('message');
  });

  it('should return structured result object with required fields', async () => {
    const testFile = resolve(tempDir, 'test.js');
    writeFileSync(testFile, 'var x = 1;');

    const error = {
      file: testFile,
      line: 1,
      col: 1,
      message: "'x' is never reassigned",
      rule: 'prefer-const',
      language: 'javascript',
    };

    const result = await applyFix(error);

    expect(result).toHaveProperty('success');
    expect(result).toHaveProperty('diff');
    expect(result).toHaveProperty('message');
    expect(typeof result.success).toBe('boolean');
    expect(typeof result.message).toBe('string');
  });

  it('should handle invalid language gracefully', async () => {
    const testFile = resolve(tempDir, 'test.unknown');
    writeFileSync(testFile, 'some content');

    const error = {
      file: testFile,
      line: 1,
      col: 1,
      message: 'test',
      rule: 'test-rule',
      language: 'unknown-lang',
    };

    const result = await applyFix(error);

    expect(result.success).toBe(false);
    expect(result.message).toContain('not supported');
  });

  it('should return false when error object lacks required fields', async () => {
    const error = {
      line: 1,
      // missing file
    };

    const result = await applyFix(error);

    expect(result.success).toBe(false);
    expect(result.message).toBeDefined();
  });
});
