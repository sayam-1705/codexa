import { describe, expect, it } from 'vitest';
import { fingerprintFinding, filterBaselineFindings, saveBaseline, loadBaseline, getBaselineVersion } from '../src/core/baseline.js';
import { mkdtempSync, readFileSync, rmSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { createHash } from 'crypto';

const finding = (overrides = {}) => ({
  file: '/tmp/codexa-baseline/src/app.js',
  rule: 'no-console',
  message: 'Unexpected console statement',
  severity: 'CRITICAL',
  ...overrides,
});

describe('baseline fingerprints', () => {
  it('treats the same finding on different lines as the same baseline fingerprint', () => {
    expect(fingerprintFinding(finding({ line: 2 }), '/tmp/codexa-baseline'))
      .toBe(fingerprintFinding(finding({ line: 20 }), '/tmp/codexa-baseline'));
  });

  it('filters accepted blocking findings into preexisting output', () => {
    const current = { blocking: [finding()], warnings: [], minor: [], preexisting: [] };
    const baseline = new Set([fingerprintFinding(finding(), '/tmp/codexa-baseline')]);
    const filtered = filterBaselineFindings(current, '/tmp/codexa-baseline', baseline);
    expect(filtered.blocking).toHaveLength(0);
    expect(filtered.preexisting).toHaveLength(1);
  });

  it('continues honoring v1 baselines during upgrade', () => {
    const current = { blocking: [], warnings: [finding({ line: 12 })], minor: [], preexisting: [] };
    const legacyIdentity = createHash('sha256')
      .update(['src/app.js', 'no-console', '', 'Unexpected console statement'].join('\0'))
      .digest('hex');
    const legacyBaseline = new Set([legacyIdentity]);
    const filtered = filterBaselineFindings(current, '/tmp/codexa-baseline', legacyBaseline);
    expect(filtered.warnings).toHaveLength(0);
  });

  it('writes and reads deterministic sorted fingerprints', () => {
    const repo = mkdtempSync(join(tmpdir(), 'codexa-baseline-test-'));
    try {
      saveBaseline(repo, [finding({ file: `${repo}/z.js` }), finding({ file: `${repo}/a.js` })]);
      const parsed = JSON.parse(readFileSync(join(repo, '.codexa', 'baseline.json'), 'utf8'));
      expect(parsed.fingerprints).toEqual([...parsed.fingerprints].sort());
      expect(loadBaseline(repo)).toBeInstanceOf(Set);
      expect(getBaselineVersion(repo)).toBe(2);
    } finally {
      rmSync(repo, { recursive: true, force: true });
    }
  });
});
