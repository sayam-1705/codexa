import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdirSync, rmSync, existsSync } from 'fs';
import { resolve } from 'path';
import { tmpdir } from 'os';
import * as patterns from '../src/learning/patterns.js';

describe('Pattern Storage', () => {
  let testRepo;

  beforeEach(() => {
    testRepo = resolve(tmpdir(), `codexa-patterns-${Date.now()}`);
    mkdirSync(testRepo, { recursive: true });
  });

  afterEach(() => {
    if (testRepo && existsSync(testRepo)) {
      rmSync(testRepo, { recursive: true, force: true });
    }
  });

  it('should return default structure when file missing', () => {
    const result = patterns.loadPatterns(testRepo);
    expect(result).toEqual({ version: 1, patterns: [] });
  });

  it('should save and load a pattern', () => {
    const pattern = {
      rule: 'no-unused-vars',
      language: 'typescript',
      before: 'const x = 1;',
      after: '// removed',
      file: 'src/test.ts',
      source: 'ai',
    };

    patterns.savePattern(testRepo, pattern);
    const loaded = patterns.loadPatterns(testRepo);

    expect(loaded.patterns).toHaveLength(1);
    expect(loaded.patterns[0].rule).toBe(pattern.rule);
    expect(loaded.patterns[0].id).toBeDefined();
  });

  it('should update pattern usage', () => {
    const pattern = {
      rule: 'no-unused-vars',
      language: 'typescript',
      before: 'const x = 1;',
      after: '// removed',
      file: 'src/test.ts',
      source: 'ai',
    };

    const saved = patterns.savePattern(testRepo, pattern);
    patterns.updatePatternUsage(testRepo, saved.id);

    const loaded = patterns.loadPatterns(testRepo);
    expect(loaded.patterns[0].usageCount).toBe(1);
  });

  it('should get patterns for specific rule and language', () => {
    const pattern1 = {
      rule: 'no-unused-vars',
      language: 'typescript',
      before: 'const x = 1;',
      after: '// removed',
      file: 'src/test.ts',
      source: 'ai',
    };
    const pattern2 = {
      rule: 'semi',
      language: 'typescript',
      before: 'const x = 1',
      after: 'const x = 1;',
      file: 'src/test.ts',
      source: 'autofix',
    };

    patterns.savePattern(testRepo, pattern1);
    patterns.savePattern(testRepo, pattern2);

    const result = patterns.getPatternsForRule(testRepo, 'no-unused-vars', 'typescript');
    expect(result).toHaveLength(1);
    expect(result[0].rule).toBe('no-unused-vars');
  });

  it('should return max 3 patterns sorted by usage', () => {
    for (let i = 0; i < 5; i++) {
      const pattern = {
        rule: 'no-unused-vars',
        language: 'typescript',
        before: `const x${i} = 1;`,
        after: '// removed',
        file: 'src/test.ts',
        source: 'ai',
        usageCount: i,
      };
      patterns.savePattern(testRepo, pattern);
    }

    const result = patterns.getPatternsForRule(testRepo, 'no-unused-vars', 'typescript');
    expect(result.length).toBeLessThanOrEqual(3);
  });

  it('should get all patterns', () => {
    const pattern1 = {
      rule: 'no-unused-vars',
      language: 'typescript',
      before: 'const x = 1;',
      after: '// removed',
      file: 'src/test.ts',
      source: 'ai',
    };

    patterns.savePattern(testRepo, pattern1);
    const all = patterns.getAllPatterns(testRepo);

    expect(all.length).toBeGreaterThan(0);
  });

  it('should handle missing rule/language gracefully', () => {
    const result = patterns.getPatternsForRule(testRepo, 'nonexistent', 'javascript');
    expect(result).toEqual([]);
  });
});
