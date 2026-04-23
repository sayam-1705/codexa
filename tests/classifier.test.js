import { describe, it, expect } from 'vitest';
import { classifyErrors } from '../src/core/classifier.js';
import { createError, SEVERITIES, BLAME_CATEGORIES } from '../src/core/schema.js';

describe('classifier', () => {
  describe('classifyErrors with blameMode=strict', () => {
    it('returns only yours errors in blocking/warnings/minor', async () => {
      const errors = [
        createError({
          file: '/src/file.js',
          line: 5,
          col: 1,
          message: 'undefined',
          rule: 'no-undef',
          severity: SEVERITIES.CRITICAL,
          language: 'javascript',
        }),
        createError({
          file: '/src/file.js',
          line: 50,
          col: 1,
          message: 'unused',
          rule: 'no-unused-vars',
          severity: SEVERITIES.MODERATE,
          language: 'javascript',
        }),
      ];

      const changedLinesMap = new Map([
        ['/src/file.js', [{ start: 1, end: 10 }]],
      ]);

      const result = await classifyErrors(errors, changedLinesMap, { blameMode: 'strict' });

      expect(result.blocking).toHaveLength(1);
      expect(result.warnings).toHaveLength(0);
      expect(result.preexisting).toHaveLength(1);
    });

    it('moves preexisting errors to preexisting array', async () => {
      const errors = [
        createError({
          file: '/src/file.js',
          line: 50,
          col: 1,
          message: 'unused',
          rule: 'no-unused-vars',
          severity: SEVERITIES.MODERATE,
          language: 'javascript',
        }),
      ];

      const changedLinesMap = new Map([
        ['/src/file.js', [{ start: 1, end: 10 }]],
      ]);

      const result = await classifyErrors(errors, changedLinesMap, { blameMode: 'strict' });

      expect(result.warnings).toHaveLength(0);
      expect(result.preexisting).toHaveLength(1);
      expect(result.preexisting[0].blameCategory).toBe(BLAME_CATEGORIES.PREEXISTING);
    });
  });

  describe('classifyErrors with blameMode=warn', () => {
    it('returns ALL errors but tags preexisting correctly', async () => {
      const errors = [
        createError({
          file: '/src/file.js',
          line: 5,
          col: 1,
          message: 'undefined',
          rule: 'no-undef',
          severity: SEVERITIES.CRITICAL,
          language: 'javascript',
        }),
        createError({
          file: '/src/file.js',
          line: 50,
          col: 1,
          message: 'unused',
          rule: 'no-unused-vars',
          severity: SEVERITIES.MODERATE,
          language: 'javascript',
        }),
      ];

      const changedLinesMap = new Map([
        ['/src/file.js', [{ start: 1, end: 10 }]],
      ]);

      const result = await classifyErrors(errors, changedLinesMap, { blameMode: 'warn' });

      expect(result.blocking).toHaveLength(1);
      expect(result.preexisting).toHaveLength(1);
    });
  });

  describe('classifyErrors with blameMode=off', () => {
    it('returns all errors, ignores blameCategory', async () => {
      const errors = [
        createError({
          file: '/src/file.js',
          line: 5,
          col: 1,
          message: 'undefined',
          rule: 'no-undef',
          severity: SEVERITIES.CRITICAL,
          language: 'javascript',
        }),
        createError({
          file: '/src/file.js',
          line: 50,
          col: 1,
          message: 'unused',
          rule: 'no-unused-vars',
          severity: SEVERITIES.MODERATE,
          language: 'javascript',
        }),
      ];

      const changedLinesMap = new Map([
        ['/src/file.js', [{ start: 1, end: 10 }]],
      ]);

      const result = await classifyErrors(errors, changedLinesMap, { blameMode: 'off' });

      expect(result.blocking).toHaveLength(1);
      expect(result.warnings).toHaveLength(1);
      expect(result.preexisting).toHaveLength(0);
    });
  });

  describe('classifyErrors severity bucketing', () => {
    it('correctly separates CRITICAL into blocking array', async () => {
      const errors = [
        createError({
          file: '/src/file.js',
          line: 5,
          col: 1,
          message: 'critical issue',
          rule: 'no-undef',
          severity: SEVERITIES.CRITICAL,
          language: 'javascript',
        }),
      ];

      const changedLinesMap = new Map([
        ['/src/file.js', [{ start: 1, end: 10 }]],
      ]);

      const result = await classifyErrors(errors, changedLinesMap, { blameMode: 'strict' });

      expect(result.blocking).toHaveLength(1);
      expect(result.warnings).toHaveLength(0);
      expect(result.minor).toHaveLength(0);
    });

    it('correctly separates MODERATE into warnings array', async () => {
      const errors = [
        createError({
          file: '/src/file.js',
          line: 5,
          col: 1,
          message: 'moderate issue',
          rule: 'no-unused-vars',
          severity: SEVERITIES.MODERATE,
          language: 'javascript',
        }),
      ];

      const changedLinesMap = new Map([
        ['/src/file.js', [{ start: 1, end: 10 }]],
      ]);

      const result = await classifyErrors(errors, changedLinesMap, { blameMode: 'strict' });

      expect(result.blocking).toHaveLength(0);
      expect(result.warnings).toHaveLength(1);
      expect(result.minor).toHaveLength(0);
    });

    it('correctly separates MINOR into minor array', async () => {
      const errors = [
        createError({
          file: '/src/file.js',
          line: 5,
          col: 1,
          message: 'minor issue',
          rule: 'semi',
          severity: SEVERITIES.MINOR,
          language: 'javascript',
        }),
      ];

      const changedLinesMap = new Map([
        ['/src/file.js', [{ start: 1, end: 10 }]],
      ]);

      const result = await classifyErrors(errors, changedLinesMap, { blameMode: 'strict' });

      expect(result.blocking).toHaveLength(0);
      expect(result.warnings).toHaveLength(0);
      expect(result.minor).toHaveLength(1);
    });

    it('never puts MINOR errors into blocking array', async () => {
      const errors = [
        createError({
          file: '/src/file.js',
          line: 5,
          col: 1,
          message: 'minor issue',
          rule: 'semi',
          severity: SEVERITIES.MINOR,
          language: 'javascript',
        }),
      ];

      const changedLinesMap = new Map([
        ['/src/file.js', [{ start: 1, end: 10 }]],
      ]);

      const result = await classifyErrors(errors, changedLinesMap, { blameMode: 'off' });

      expect(result.blocking).toHaveLength(0);
      expect(result.minor).toHaveLength(1);
    });
  });

  describe('preexisting errors never block', () => {
    it('even CRITICAL preexisting errors go to preexisting array', async () => {
      const errors = [
        createError({
          file: '/src/file.js',
          line: 100,
          col: 1,
          message: 'critical but preexisting',
          rule: 'no-undef',
          severity: SEVERITIES.CRITICAL,
          language: 'javascript',
        }),
      ];

      const changedLinesMap = new Map([
        ['/src/file.js', [{ start: 1, end: 10 }]],
      ]);

      const result = await classifyErrors(errors, changedLinesMap, { blameMode: 'strict' });

      expect(result.blocking).toHaveLength(0);
      expect(result.preexisting).toHaveLength(1);
    });
  });

  describe('empty input handling', () => {
    it('returns empty arrays for empty error list', async () => {
      const result = await classifyErrors([], new Map(), {});

      expect(result.blocking).toEqual([]);
      expect(result.warnings).toEqual([]);
      expect(result.minor).toEqual([]);
      expect(result.preexisting).toEqual([]);
    });

    it('returns empty arrays for null error list', async () => {
      const result = await classifyErrors(null, new Map(), {});

      expect(result.blocking).toEqual([]);
      expect(result.warnings).toEqual([]);
      expect(result.minor).toEqual([]);
      expect(result.preexisting).toEqual([]);
    });
  });

  describe('default blameMode', () => {
    it('defaults to strict when blameMode not specified', async () => {
      const errors = [
        createError({
          file: '/src/file.js',
          line: 50,
          col: 1,
          message: 'unused',
          rule: 'no-unused-vars',
          severity: SEVERITIES.MODERATE,
          language: 'javascript',
        }),
      ];

      const changedLinesMap = new Map([
        ['/src/file.js', [{ start: 1, end: 10 }]],
      ]);

      const result = await classifyErrors(errors, changedLinesMap, {});

      expect(result.warnings).toHaveLength(0);
      expect(result.preexisting).toHaveLength(1);
    });
  });
});
