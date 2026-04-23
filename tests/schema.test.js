import { describe, it, expect } from 'vitest';
import { createError, SEVERITIES, BLAME_CATEGORIES } from '../src/core/schema.js';

describe('schema', () => {
  describe('createError', () => {
    it('returns a frozen object with all required fields', () => {
      const error = createError({
        file: '/path/to/file.js',
        line: 10,
        col: 5,
        message: 'Test error',
        rule: 'test-rule',
        severity: SEVERITIES.CRITICAL,
        language: 'javascript',
      });

      expect(Object.isFrozen(error)).toBe(true);
      expect(error.file).toBe('/path/to/file.js');
      expect(error.line).toBe(10);
      expect(error.col).toBe(5);
      expect(error.message).toBe('Test error');
      expect(error.rule).toBe('test-rule');
      expect(error.severity).toBe(SEVERITIES.CRITICAL);
      expect(error.language).toBe('javascript');
    });

    it('throws if file is missing', () => {
      expect(() =>
        createError({
          line: 10,
          col: 5,
          message: 'Test error',
          rule: 'test-rule',
          severity: SEVERITIES.CRITICAL,
          language: 'javascript',
        })
      ).toThrow('Missing required field: file');
    });

    it('throws if line is missing', () => {
      expect(() =>
        createError({
          file: '/path/to/file.js',
          col: 5,
          message: 'Test error',
          rule: 'test-rule',
          severity: SEVERITIES.CRITICAL,
          language: 'javascript',
        })
      ).toThrow('Missing required field: line');
    });

    it('throws if message is missing', () => {
      expect(() =>
        createError({
          file: '/path/to/file.js',
          line: 10,
          col: 5,
          rule: 'test-rule',
          severity: SEVERITIES.CRITICAL,
          language: 'javascript',
        })
      ).toThrow('Missing required field: message');
    });

    it('throws if rule is missing', () => {
      expect(() =>
        createError({
          file: '/path/to/file.js',
          line: 10,
          col: 5,
          message: 'Test error',
          severity: SEVERITIES.CRITICAL,
          language: 'javascript',
        })
      ).toThrow('Missing required field: rule');
    });

    it('throws if severity is not CRITICAL|MODERATE|MINOR', () => {
      expect(() =>
        createError({
          file: '/path/to/file.js',
          line: 10,
          col: 5,
          message: 'Test error',
          rule: 'test-rule',
          severity: 'INVALID',
          language: 'javascript',
        })
      ).toThrow('Invalid severity');
    });

    it('sets isInDiff to false by default', () => {
      const error = createError({
        file: '/path/to/file.js',
        line: 10,
        col: 5,
        message: 'Test error',
        rule: 'test-rule',
        severity: SEVERITIES.CRITICAL,
        language: 'javascript',
      });

      expect(error.isInDiff).toBe(false);
    });

    it('respects explicit isInDiff values', () => {
      const error = createError({
        file: '/path/to/file.js',
        line: 10,
        col: 5,
        message: 'Test error',
        rule: 'test-rule',
        severity: SEVERITIES.CRITICAL,
        language: 'javascript',
        isInDiff: true,
      });

      expect(error.isInDiff).toBe(true);
    });

    it('sets blameCategory to unknown by default', () => {
      const error = createError({
        file: '/path/to/file.js',
        line: 10,
        col: 5,
        message: 'Test error',
        rule: 'test-rule',
        severity: SEVERITIES.CRITICAL,
        language: 'javascript',
      });

      expect(error.blameCategory).toBe(BLAME_CATEGORIES.UNKNOWN);
    });

    it('respects explicit blameCategory values', () => {
      const errorYours = createError({
        file: '/path/to/file.js',
        line: 10,
        col: 5,
        message: 'Test error',
        rule: 'test-rule',
        severity: SEVERITIES.CRITICAL,
        language: 'javascript',
        blameCategory: BLAME_CATEGORIES.YOURS,
      });

      expect(errorYours.blameCategory).toBe(BLAME_CATEGORIES.YOURS);

      const errorPreexisting = createError({
        file: '/path/to/file.js',
        line: 10,
        col: 5,
        message: 'Test error',
        rule: 'test-rule',
        severity: SEVERITIES.CRITICAL,
        language: 'javascript',
        blameCategory: BLAME_CATEGORIES.PREEXISTING,
      });

      expect(errorPreexisting.blameCategory).toBe(BLAME_CATEGORIES.PREEXISTING);
    });

    it('throws if blameCategory is invalid', () => {
      expect(() =>
        createError({
          file: '/path/to/file.js',
          line: 10,
          col: 5,
          message: 'Test error',
          rule: 'test-rule',
          severity: SEVERITIES.CRITICAL,
          language: 'javascript',
          blameCategory: 'invalid-category',
        })
      ).toThrow('Invalid blameCategory');
    });
  });

  describe('SEVERITIES', () => {
    it('contains exactly CRITICAL, MODERATE, MINOR', () => {
      expect(Object.keys(SEVERITIES).sort()).toEqual(['CRITICAL', 'MINOR', 'MODERATE']);
      expect(SEVERITIES.CRITICAL).toBe('CRITICAL');
      expect(SEVERITIES.MODERATE).toBe('MODERATE');
      expect(SEVERITIES.MINOR).toBe('MINOR');
    });
  });

  describe('BLAME_CATEGORIES', () => {
    it('contains exactly YOURS, PREEXISTING, UNKNOWN', () => {
      expect(Object.keys(BLAME_CATEGORIES).sort()).toEqual(['PREEXISTING', 'UNKNOWN', 'YOURS']);
      expect(BLAME_CATEGORIES.YOURS).toBe('yours');
      expect(BLAME_CATEGORIES.PREEXISTING).toBe('preexisting');
      expect(BLAME_CATEGORIES.UNKNOWN).toBe('unknown');
    });
  });
});
