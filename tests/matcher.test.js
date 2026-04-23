import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdirSync, rmSync, existsSync } from 'fs';
import { resolve } from 'path';
import { tmpdir } from 'os';
import * as matcher from '../src/learning/matcher.js';
import * as patterns from '../src/learning/patterns.js';

describe('Pattern Matcher', () => {
  let testRepo;

  beforeEach(() => {
    testRepo = resolve(tmpdir(), `codexa-matcher-${Date.now()}`);
    mkdirSync(testRepo, { recursive: true });
  });

  afterEach(() => {
    if (testRepo && existsSync(testRepo)) {
      rmSync(testRepo, { recursive: true, force: true });
    }
  });

  it('should return null when no patterns exist', () => {
    const error = {
      rule: 'no-unused-vars',
      language: 'typescript',
      line: 1,
      file: 'src/test.ts',
    };
    const fileLines = ['const x = 1;'];

    const result = matcher.findMatchingPattern(error, fileLines, testRepo);
    expect(result).toBeNull();
  });

  it('should return null when best score < 80', () => {
    const error = {
      rule: 'no-unused-vars',
      language: 'typescript',
      line: 1,
      file: 'src/test.ts',
    };
    const fileLines = ['const x = 1;'];

    // Save a pattern with different language (low score)
    const pattern = {
      rule: 'no-unused-vars',
      language: 'javascript',
      before: 'const y = 2;',
      after: '// removed',
      file: 'src/other.js',
      source: 'ai',
    };
    patterns.savePattern(testRepo, pattern);

    const result = matcher.findMatchingPattern(error, fileLines, testRepo);
    expect(result).toBeNull(); // Different language won't score high enough
  });

  it('should return pattern when score >= 80', () => {
    const error = {
      rule: 'no-unused-vars',
      language: 'typescript',
      line: 1,
      file: 'src/test.ts',
    };
    const fileLines = ['const x = 1;'];

    // Save exact matching pattern
    const pattern = {
      rule: 'no-unused-vars',
      language: 'typescript',
      before: 'const x = 1;',
      after: '// removed',
      file: 'src/test.ts',
      source: 'ai',
    };
    patterns.savePattern(testRepo, pattern);

    const result = matcher.findMatchingPattern(error, fileLines, testRepo);
    expect(result).not.toBeNull();
    expect(result.score).toBeGreaterThanOrEqual(80);
  });

  it('should include message in result', () => {
    const error = {
      rule: 'no-unused-vars',
      language: 'typescript',
      line: 1,
      file: 'src/test.ts',
    };
    const fileLines = ['const x = 1;'];

    const pattern = {
      rule: 'no-unused-vars',
      language: 'typescript',
      before: 'const x = 1;',
      after: '// removed',
      file: 'src/test.ts',
      source: 'ai',
    };
    patterns.savePattern(testRepo, pattern);

    const result = matcher.findMatchingPattern(error, fileLines, testRepo);
    expect(result.message).toBeDefined();
    expect(result.message).toContain('test.ts');
  });

  it('should award points for exact rule match', () => {
    const error = {
      rule: 'semi',
      language: 'javascript',
      line: 1,
      file: 'src/test.js',
    };

    // High-scoring pattern: same rule and language
    const pattern = {
      rule: 'semi',
      language: 'javascript',
      before: 'const x = 1',
      after: 'const x = 1;',
      file: 'src/other.js',
      source: 'autofix',
    };
    patterns.savePattern(testRepo, pattern);

    const result = matcher.findMatchingPattern(error, ['const x = 1'], testRepo);
    expect(result).not.toBeNull();
  });

  it('should award points for before text match', () => {
    const error = {
      rule: 'no-unused-vars',
      language: 'typescript',
      line: 1,
      file: 'src/test.ts',
    };
    const fileLines = [
      'import x from "y";',
      'console.log("hello");',
      'export default x;',
    ];

    const pattern = {
      rule: 'no-unused-vars',
      language: 'typescript',
      before: 'import x from "y";',
      after: '// removed',
      file: 'src/other.ts',
      source: 'ai',
    };
    patterns.savePattern(testRepo, pattern);

    const result = matcher.findMatchingPattern(error, fileLines, testRepo);
    expect(result).not.toBeNull();
    expect(result.score).toBeGreaterThanOrEqual(80);
  });

  it('should apply pattern fix', () => {
    const pattern = {
      before: 'const x = 1;',
      after: 'const x = 1; // fixed',
    };

    const fileContent = 'const x = 1;\nconsole.log(x);';
    const result = matcher.applyPatternFix(fileContent, pattern);

    expect(result).toContain('// fixed');
  });
});
