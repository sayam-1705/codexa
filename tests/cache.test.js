import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdirSync, rmSync, existsSync } from 'fs';
import { resolve } from 'path';
import { tmpdir } from 'os';
import * as cache from '../src/ai/cache.js';

describe('Suggestion Cache', () => {
  let testDir;

  beforeEach(() => {
    testDir = resolve(tmpdir(), `codexa-cache-test-${Date.now()}`);
    mkdirSync(testDir, { recursive: true });
  });

  afterEach(() => {
    if (testDir && existsSync(testDir)) {
      rmSync(testDir, { recursive: true, force: true });
    }
  });

  it('should return null on cache miss', () => {
    const error = {
      rule: 'no-unused-vars',
      language: 'javascript',
      line: 1,
      file: 'test.js',
    };
    const fileLines = ['const x = 1;', 'console.log(x);'];

    const result = cache.getCachedSuggestion(error, fileLines);
    expect(result).toBeNull();
  });

  it('should save and retrieve a suggestion', () => {
    const error = {
      rule: 'no-unused-vars',
      language: 'javascript',
      line: 1,
      file: 'test.js',
    };
    const fileLines = ['const x = 1;', 'console.log(x);'];
    const suggestion = 'Remove unused variable x';

    cache.saveSuggestion(error, fileLines, suggestion);
    const result = cache.getCachedSuggestion(error, fileLines);

    expect(result).not.toBeNull();
    expect(result.suggestion).toBe(suggestion);
  });

  it('should increment hitCount on repeat saves', () => {
    const error = {
      rule: 'no-unused-vars',
      language: 'javascript',
      line: 1,
      file: 'test.js',
    };
    const fileLines = ['const x = 1;'];
    const suggestion = 'Fix this';

    cache.saveSuggestion(error, fileLines, suggestion);
    const first = cache.getCachedSuggestion(error, fileLines);
    expect(first.hitCount).toBe(1);

    cache.saveSuggestion(error, fileLines, suggestion);
    const second = cache.getCachedSuggestion(error, fileLines);
    expect(second.hitCount).toBe(2);
  });

  it('should generate deterministic cache keys', () => {
    const error1 = {
      rule: 'no-unused-vars',
      language: 'javascript',
      line: 1,
    };
    const error2 = {
      rule: 'no-unused-vars',
      language: 'javascript',
      line: 1,
    };
    const fileLines = ['const x = 1;'];

    cache.saveSuggestion(error1, fileLines, 'suggestion1');

    // Same error should hit cache
    const result = cache.getCachedSuggestion(error2, fileLines);
    expect(result).not.toBeNull();
  });

  it('should return cache stats', () => {
    const error = {
      rule: 'no-unused-vars',
      language: 'javascript',
      line: 1,
    };

    cache.saveSuggestion(error, ['const x = 1;'], 'fix');

    const stats = cache.getCacheStats();
    expect(stats).toHaveProperty('totalEntries');
    expect(stats).toHaveProperty('totalSizeBytes');
    expect(stats.totalEntries).toBeGreaterThan(0);
  });

  it('should clear all cache entries', () => {
    const error = {
      rule: 'no-unused-vars',
      language: 'javascript',
      line: 1,
    };

    cache.saveSuggestion(error, ['const x = 1;'], 'fix');
    const cleared = cache.clearCache();
    expect(cleared).toBeGreaterThan(0);

    const result = cache.getCachedSuggestion(error, ['const x = 1;']);
    expect(result).toBeNull();
  });
});
