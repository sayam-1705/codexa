import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';

// Mock db module before importing anything that uses it
vi.mock('../src/solo/db.js', () => ({
  getDb: vi.fn(),
  logRun: vi.fn(),
  getMeta: vi.fn(),
  setMeta: vi.fn(),
  getDailyErrorCounts: vi.fn(() => []),
  getErrorFrequency: vi.fn(() => []),
  getLifetimeStats: vi.fn(() => ({})),
}));

vi.mock('../src/solo/streak.js', () => ({
  getCurrentStreak: vi.fn(() => 0),
  getStreakDisplay: vi.fn(() => ({
    current: 0,
    best: 0,
    display: '✓ Ready to commit',
    level: 'none',
  })),
}));

import { formatCIOutput } from '../src/team/ci.js';

describe('CI Mode', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('formatCIOutput includes all required top-level fields', () => {
    const result = {
      blocking: [],
      warnings: [],
      minor: [],
      preexisting: [],
      filesChecked: 5,
      durationMs: 100,
    };

    const config = {
      ci: { failOn: 'CRITICAL', badge: false },
    };

    const output = formatCIOutput(result, '/test/repo', config);

    expect(output).toHaveProperty('codexa');
    expect(output).toHaveProperty('timestamp');
    expect(output).toHaveProperty('repo');
    expect(output).toHaveProperty('branch');
    expect(output).toHaveProperty('result');
    expect(output).toHaveProperty('failOn');
    expect(output).toHaveProperty('summary');
  });

  it('formatCIOutput sets result=blocked when blocking errors exist', () => {
    const result = {
      blocking: [{ file: 'test.js', line: 10, rule: 'no-undef' }],
      warnings: [],
      minor: [],
      preexisting: [],
    };

    const config = { ci: { failOn: 'CRITICAL', badge: false } };
    const output = formatCIOutput(result, '/test/repo', config);

    expect(output.result).toBe('blocked');
  });

  it('formatCIOutput sets result=warned when warnings but no blocking', () => {
    const result = {
      blocking: [],
      warnings: [{ file: 'test.js', line: 5, rule: 'no-console' }],
      minor: [],
      preexisting: [],
    };

    const config = { ci: { failOn: 'CRITICAL', badge: false } };
    const output = formatCIOutput(result, '/test/repo', config);

    expect(output.result).toBe('warned');
  });

  it('formatCIOutput sets result=clean when all arrays empty', () => {
    const result = {
      blocking: [],
      warnings: [],
      minor: [],
      preexisting: [],
    };

    const config = { ci: { failOn: 'CRITICAL', badge: false } };
    const output = formatCIOutput(result, '/test/repo', config);

    expect(output.result).toBe('clean');
  });

  it('formatCIOutput includes badge data when config.ci.badge=true', () => {
    const result = {
      blocking: [],
      warnings: [],
      minor: [],
      preexisting: [],
    };

    const config = { ci: { failOn: 'CRITICAL', badge: true } };
    const output = formatCIOutput(result, '/test/repo', config);

    expect(output).toHaveProperty('badge');
    expect(output.badge).toHaveProperty('url');
    expect(output.badge).toHaveProperty('markdown');
  });

  it('formatCIOutput omits badge when config.ci.badge=false', () => {
    const result = {
      blocking: [],
      warnings: [],
      minor: [],
      preexisting: [],
    };

    const config = { ci: { failOn: 'CRITICAL', badge: false } };
    const output = formatCIOutput(result, '/test/repo', config);

    expect(output).not.toHaveProperty('badge');
  });

  it('CI JSON output contains no ANSI escape codes', () => {
    const result = {
      blocking: [{ file: 'test.js', line: 1, rule: 'test', message: 'Test error' }],
      warnings: [],
      minor: [],
      preexisting: [],
    };

    const config = { ci: { failOn: 'CRITICAL', badge: true } };
    const output = formatCIOutput(result, '/test/repo', config);
    const json = JSON.stringify(output);

    // Check for ANSI escape codes
    expect(json).not.toMatch(/\x1b\[/);
  });

  it('formatCIOutput summary totals are correct', () => {
    const result = {
      blocking: [
        { file: 'a.js', line: 1, rule: 'rule1' },
        { file: 'b.js', line: 2, rule: 'rule2' },
      ],
      warnings: [{ file: 'c.js', line: 3, rule: 'rule3' }],
      minor: [{ file: 'd.js', line: 4, rule: 'rule4' }],
      preexisting: [{ file: 'e.js', line: 5, rule: 'rule5' }],
      filesChecked: 10,
    };

    const config = { ci: { failOn: 'CRITICAL', badge: false } };
    const output = formatCIOutput(result, '/test/repo', config);

    expect(output.summary.total).toBe(4);
    expect(output.summary.blocking).toBe(2);
    expect(output.summary.warnings).toBe(1);
    expect(output.summary.minor).toBe(1);
    expect(output.summary.preexisting).toBe(1);
    expect(output.summary.filesChecked).toBe(10);
  });

  it('formatCIOutput badge URL reflects result status', () => {
    const configs = {
      blocked: {
        blocking: [{ file: 'a.js', line: 1, rule: 'test' }],
        warnings: [],
        minor: [],
        preexisting: [],
      },
      warned: {
        blocking: [],
        warnings: [{ file: 'a.js', line: 1, rule: 'test' }],
        minor: [],
        preexisting: [],
      },
      clean: {
        blocking: [],
        warnings: [],
        minor: [],
        preexisting: [],
      },
    };

    const config = { ci: { failOn: 'CRITICAL', badge: true } };

    for (const [status, result] of Object.entries(configs)) {
      const output = formatCIOutput(result, '/test/repo', config);
      expect(output.badge.url).toContain(
        status === 'clean'
          ? '00E5A0'
          : status === 'warned'
            ? 'F5C842'
            : 'FF4444'
      );
    }
  });

  it('formatCIOutput failOn matches config setting', () => {
    const result = {
      blocking: [],
      warnings: [],
      minor: [],
      preexisting: [],
    };

    const failOnValues = ['CRITICAL', 'MODERATE', 'any'];

    for (const failOn of failOnValues) {
      const config = { ci: { failOn, badge: false } };
      const output = formatCIOutput(result, '/test/repo', config);
      expect(output.failOn).toBe(failOn);
    }
  });
});
