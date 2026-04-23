import { describe, it, expect } from 'vitest';
import { getSeverity } from '../src/core/severity.js';
import { SEVERITIES } from '../src/core/schema.js';

describe('getSeverity', () => {
  describe('JavaScript / TypeScript rules', () => {
    it('maps no-undef to CRITICAL', () => {
      expect(getSeverity('no-undef', 'javascript')).toBe(SEVERITIES.CRITICAL);
      expect(getSeverity('no-undef', 'typescript')).toBe(SEVERITIES.CRITICAL);
    });

    it('maps no-unused-vars to MODERATE', () => {
      expect(getSeverity('no-unused-vars', 'javascript')).toBe(SEVERITIES.MODERATE);
      expect(getSeverity('no-unused-vars', 'typescript')).toBe(SEVERITIES.MODERATE);
      expect(getSeverity('@typescript-eslint/no-unused-vars', 'typescript')).toBe(SEVERITIES.MODERATE);
    });

    it('maps prefer-const to MINOR', () => {
      expect(getSeverity('prefer-const', 'javascript')).toBe(SEVERITIES.MINOR);
      expect(getSeverity('eqeqeq', 'javascript')).toBe(SEVERITIES.MINOR);
      expect(getSeverity('semi', 'javascript')).toBe(SEVERITIES.MINOR);
    });

    it('maps @typescript-eslint/ban-ts-comment to CRITICAL', () => {
      expect(getSeverity('@typescript-eslint/ban-ts-comment', 'typescript')).toBe(SEVERITIES.CRITICAL);
    });

    it('maps prettier rules to MINOR', () => {
      expect(getSeverity('prettier/indent', 'javascript')).toBe(SEVERITIES.MINOR);
    });
  });

  describe('Python / ruff rules', () => {
    it('maps E901 (SyntaxError) to CRITICAL', () => {
      expect(getSeverity('E901', 'python')).toBe(SEVERITIES.CRITICAL);
    });

    it('maps F821 (Undefined name) to CRITICAL', () => {
      expect(getSeverity('F821', 'python')).toBe(SEVERITIES.CRITICAL);
    });

    it('maps C901 (Complexity) to MODERATE', () => {
      expect(getSeverity('C901', 'python')).toBe(SEVERITIES.MODERATE);
    });

    it('maps F841 (Unused variable) to MODERATE', () => {
      expect(getSeverity('F841', 'python')).toBe(SEVERITIES.MODERATE);
    });

    it('maps E501 (Line too long) to MINOR', () => {
      expect(getSeverity('E501', 'python')).toBe(SEVERITIES.MINOR);
    });

    it('maps I001 (isort) to MINOR', () => {
      expect(getSeverity('I001', 'python')).toBe(SEVERITIES.MINOR);
    });

    it('maps B series (bugbear) to MODERATE', () => {
      expect(getSeverity('B008', 'python')).toBe(SEVERITIES.MODERATE);
    });

    it('maps UP series (pyupgrade) to MINOR', () => {
      expect(getSeverity('UP009', 'python')).toBe(SEVERITIES.MINOR);
    });
  });

  describe('fallback behavior', () => {
    it('defaults to MODERATE for unknown rules', () => {
      expect(getSeverity('unknown-rule-xyz', 'javascript')).toBe(SEVERITIES.MODERATE);
      expect(getSeverity('unknown-rule-xyz', 'python')).toBe(SEVERITIES.MODERATE);
    });

    it('defaults to MODERATE for unknown language', () => {
      expect(getSeverity('some-rule', 'unknown-language')).toBe(SEVERITIES.MODERATE);
    });

    it('defaults to MODERATE for null/undefined inputs', () => {
      expect(getSeverity(null, 'javascript')).toBe(SEVERITIES.MODERATE);
      expect(getSeverity('rule', null)).toBe(SEVERITIES.MODERATE);
    });
  });
});
