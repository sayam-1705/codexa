import { describe, it, expect } from 'vitest';
import { formatSarifOutput } from '../src/team/ci.js';

describe('SARIF Output', () => {
  it('formats errors correctly', () => {
    const result = {
      blocking: [{ file: 'test.js', line: 1, col: 1, rule: 'no-undef', message: 'msg', severity: 'CRITICAL' }],
      warnings: [{ file: 'test.js', line: 2, col: 1, rule: 'no-unused', message: 'msg', severity: 'MODERATE' }],
      minor: [],
      preexisting: []
    };

    const sarif = formatSarifOutput(result, '/repo', {});
    
    expect(sarif.$schema).toBeDefined();
    expect(sarif.version).toBe('2.1.0');
    expect(sarif.runs[0].results).toHaveLength(2);
    expect(sarif.runs[0].results[0].level).toBe('error');
    expect(sarif.runs[0].results[1].level).toBe('warning');
  });
});
