import { describe, expect, it } from 'vitest';
import { fingerprintFinding, filterBaselineFindings, saveBaseline, loadBaseline } from '../src/core/baseline.js';
import { mkdtempSync, readFileSync, rmSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';

const finding = (overrides = {}) => ({
  file: '/tmp/codexa-baseline/src/app.js',
  rule: 'no-console',
  message: 'Unexpected console statement',
  severity: 'CRITICAL',
  ...overrides,
});

describe('baseline fingerprints', () => {
  it('distinguishes findings by line number', () => {
    expect(fingerprintFinding(finding({ line: 2 }), '/tmp/codexa-baseline'))
      .not.toBe(fingerprintFinding(finding({ line: 20 }), '/tmp/codexa-baseline'));
  });

  it('filters accepted blocking findings into preexisting output', () => {
    const current = { blocking: [finding()], warnings: [], minor: [], preexisting: [] };
    const baseline = new Set([fingerprintFinding(finding(), '/tmp/codexa-baseline')]);
    const filtered = filterBaselineFindings(current, '/tmp/codexa-baseline', baseline);
    expect(filtered.blocking).toHaveLength(0);
    expect(filtered.preexisting).toHaveLength(1);
  });

  it('writes and reads deterministic sorted fingerprints', () => {
    const repo = mkdtempSync(join(tmpdir(), 'codexa-baseline-test-'));
    try {
      saveBaseline(repo, [finding({ file: `${repo}/z.js` }), finding({ file: `${repo}/a.js` })]);
      const parsed = JSON.parse(readFileSync(join(repo, '.codexa', 'baseline.json'), 'utf8'));
      expect(parsed.fingerprints).toEqual([...parsed.fingerprints].sort());
      expect(loadBaseline(repo)).toBeInstanceOf(Set);
    } finally {
      rmSync(repo, { recursive: true, force: true });
    }
  });
});
