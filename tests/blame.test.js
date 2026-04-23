import { describe, it, expect } from 'vitest';
import { classifyByDiff } from '../src/core/blame.js';
import { createError, SEVERITIES, BLAME_CATEGORIES } from '../src/core/schema.js';

describe('blame', () => {
  describe('classifyByDiff', () => {
    it('sets isInDiff=true for error on a changed line', () => {
      const errors = [
        createError({
          file: '/src/file.js',
          line: 5,
          col: 1,
          message: 'test',
          rule: 'test',
          severity: SEVERITIES.MINOR,
          language: 'javascript',
        }),
      ];

      const changedLinesMap = new Map([
        ['/src/file.js', [{ start: 1, end: 10 }]],
      ]);

      const result = classifyByDiff(errors, changedLinesMap);

      expect(result[0].isInDiff).toBe(true);
    });

    it('sets isInDiff=false for error on an unchanged line', () => {
      const errors = [
        createError({
          file: '/src/file.js',
          line: 50,
          col: 1,
          message: 'test',
          rule: 'test',
          severity: SEVERITIES.MINOR,
          language: 'javascript',
        }),
      ];

      const changedLinesMap = new Map([
        ['/src/file.js', [{ start: 1, end: 10 }, { start: 20, end: 30 }]],
      ]);

      const result = classifyByDiff(errors, changedLinesMap);

      expect(result[0].isInDiff).toBe(false);
    });

    it('sets blameCategory=yours for changed-line errors', () => {
      const errors = [
        createError({
          file: '/src/file.js',
          line: 5,
          col: 1,
          message: 'test',
          rule: 'test',
          severity: SEVERITIES.MINOR,
          language: 'javascript',
        }),
      ];

      const changedLinesMap = new Map([
        ['/src/file.js', [{ start: 1, end: 10 }]],
      ]);

      const result = classifyByDiff(errors, changedLinesMap);

      expect(result[0].blameCategory).toBe(BLAME_CATEGORIES.YOURS);
    });

    it('sets blameCategory=preexisting for unchanged-line errors', () => {
      const errors = [
        createError({
          file: '/src/file.js',
          line: 50,
          col: 1,
          message: 'test',
          rule: 'test',
          severity: SEVERITIES.MINOR,
          language: 'javascript',
        }),
      ];

      const changedLinesMap = new Map([
        ['/src/file.js', [{ start: 1, end: 10 }]],
      ]);

      const result = classifyByDiff(errors, changedLinesMap);

      expect(result[0].blameCategory).toBe(BLAME_CATEGORIES.PREEXISTING);
    });

    it('sets blameCategory=unknown for files not in diff map', () => {
      const errors = [
        createError({
          file: '/src/unknown.js',
          line: 5,
          col: 1,
          message: 'test',
          rule: 'test',
          severity: SEVERITIES.MINOR,
          language: 'javascript',
        }),
      ];

      const changedLinesMap = new Map([
        ['/src/file.js', [{ start: 1, end: 10 }]],
      ]);

      const result = classifyByDiff(errors, changedLinesMap);

      expect(result[0].blameCategory).toBe(BLAME_CATEGORIES.UNKNOWN);
      expect(result[0].isInDiff).toBe(false);
    });

    it('does NOT mutate the original error objects', () => {
      const error = createError({
        file: '/src/file.js',
        line: 5,
        col: 1,
        message: 'test',
        rule: 'test',
        severity: SEVERITIES.MINOR,
        language: 'javascript',
      });

      const errors = [error];
      const changedLinesMap = new Map([
        ['/src/file.js', [{ start: 1, end: 10 }]],
      ]);

      classifyByDiff(errors, changedLinesMap);

      // Original should still have default blameCategory
      expect(error.blameCategory).toBe(BLAME_CATEGORIES.UNKNOWN);
    });

    it('handles multiple changed ranges correctly', () => {
      const errors = [
        createError({
          file: '/src/file.js',
          line: 25,
          col: 1,
          message: 'test',
          rule: 'test',
          severity: SEVERITIES.MINOR,
          language: 'javascript',
        }),
      ];

      const changedLinesMap = new Map([
        ['/src/file.js', [{ start: 1, end: 10 }, { start: 20, end: 30 }, { start: 50, end: 60 }]],
      ]);

      const result = classifyByDiff(errors, changedLinesMap);

      expect(result[0].isInDiff).toBe(true);
      expect(result[0].blameCategory).toBe(BLAME_CATEGORIES.YOURS);
    });

    it('handles boundary line numbers correctly', () => {
      const error1 = createError({
        file: '/src/file.js',
        line: 1,
        col: 1,
        message: 'start boundary',
        rule: 'test',
        severity: SEVERITIES.MINOR,
        language: 'javascript',
      });

      const error2 = createError({
        file: '/src/file.js',
        line: 10,
        col: 1,
        message: 'end boundary',
        rule: 'test',
        severity: SEVERITIES.MINOR,
        language: 'javascript',
      });

      const changedLinesMap = new Map([
        ['/src/file.js', [{ start: 1, end: 10 }]],
      ]);

      const result = classifyByDiff([error1, error2], changedLinesMap);

      expect(result[0].isInDiff).toBe(true);
      expect(result[1].isInDiff).toBe(true);
    });
  });
});
