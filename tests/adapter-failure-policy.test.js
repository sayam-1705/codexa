/**
 * Adapter Failure Policy — complete test matrix
 *
 * Case A: JS succeeds + Python succeeds → normal lint result
 * Case B: JS fails + Python succeeds, languages=auto → Python results returned, commitAllowed=false
 * Case C: JS succeeds + Python fails, languages=["python"] → failure, commitAllowed=false
 * Case D: JS fails + Python succeeds, languages=["python"] → JS failure NOT counted, commitAllowed=true
 * Case E: all selected adapters fail → commitAllowed=false
 * Case F: adapter fails to load (via registry failedAdapters) → adapter failure, no false clean result
 *
 * Policy matrix:
 *   fail   → adapterFailureBlocks=true, commitAllowed=false
 *   warn   → adapterFailureBlocks=false, commitAllowed=true (if no blocking errors)
 *   ignore → adapterFailureBlocks=false, commitAllowed=true (if no blocking errors)
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { resolve } from 'path';

vi.mock('../src/solo/db.js', () => ({
  getDb: vi.fn(() => null),
  logRun: vi.fn(() => 1),
}));

vi.mock('../src/solo/streak.js', () => ({
  getCurrentStreak: vi.fn(() => 0),
  getStreakDisplay: vi.fn(() => ({ current: 0, best: 0, display: '✓ Ready to commit', level: 'none' })),
}));

vi.mock('../src/learning/history.js', () => ({
  logCommitCheck: vi.fn(),
}));

vi.mock('../src/plugins/registry.js', () => ({
  getEnabledAdapters: vi.fn(),
}));

import { runLinter } from '../src/core/runner.js';
import { getEnabledAdapters } from '../src/plugins/registry.js';

const JS_FILE = resolve('tests/fixtures/js-errors.js');
const PY_FILE = resolve('tests/fixtures/py-errors.py');

function makeAdapter(language, extensions, lintImpl) {
  return {
    name: language,
    language,
    extensions,
    lint: lintImpl,
    fix: async () => ({ success: false, diff: null, message: 'n/a' }),
    detect: async () => true,
  };
}

function makeFailedAdapter(name, language) {
  return { name, language, phase: 'load', error: 'module missing' };
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe('Adapter failure policy — full test matrix', () => {
  // ── Case A ──────────────────────────────────────────────────────────────────
  it('Case A: both adapters succeed → normal result with commitAllowed dependent on findings', async () => {
    const jsAdapter = makeAdapter('javascript', ['.js'], async () => []);
    const pyAdapter = makeAdapter('python', ['.py'], async () => []);
    getEnabledAdapters.mockResolvedValueOnce(
      Object.assign([jsAdapter, pyAdapter], { failedAdapters: [] })
    );

    const result = await runLinter([JS_FILE, PY_FILE], process.cwd(), { adapterFailurePolicy: 'fail' });

    expect(result.adapterFailures).toHaveLength(0);
    expect(result.adapterFailureBlocks).toBe(false);
    // Both ran and returned clean
    expect(result.blocking).toHaveLength(0);
  });

  // ── Case B ──────────────────────────────────────────────────────────────────
  it('Case B: JS fails to load, Python succeeds, languages=auto → Python results returned, commitAllowed=false', async () => {
    const pyAdapter = makeAdapter('python', ['.py'], vi.fn(async () => []));
    getEnabledAdapters.mockResolvedValueOnce(
      Object.assign([pyAdapter], { failedAdapters: [makeFailedAdapter('javascript', 'javascript')] })
    );

    const result = await runLinter([PY_FILE], process.cwd(), {
      languages: ['auto'],
      adapterFailurePolicy: 'fail',
    });

    // Python adapter ran
    expect(pyAdapter.lint).toHaveBeenCalledOnce();
    // JS failure IS reported (auto mode includes all adapters)
    expect(result.adapterFailures).toHaveLength(1);
    expect(result.adapterFailures[0].language).toBe('javascript');
    expect(result.adapterFailureBlocks).toBe(true);
    expect(result.commitAllowed).toBe(false);
  });

  // ── Case C ──────────────────────────────────────────────────────────────────
  it('Case C: JS succeeds, Python fails during lint, languages=["python"] → failure, commitAllowed=false', async () => {
    const jsAdapter = makeAdapter('javascript', ['.js'], async () => []);
    const pyAdapter = makeAdapter('python', ['.py'], async () => { throw new Error('ruff not found'); });
    getEnabledAdapters.mockResolvedValueOnce(
      Object.assign([jsAdapter, pyAdapter], { failedAdapters: [] })
    );

    const result = await runLinter([PY_FILE], process.cwd(), {
      languages: ['python'],
      adapterFailurePolicy: 'fail',
    });

    // Python adapter ran and threw
    expect(result.adapterFailures.length).toBeGreaterThan(0);
    const pyFailure = result.adapterFailures.find(f => f.language === 'python');
    expect(pyFailure).toBeDefined();
    expect(pyFailure.phase).toBe('lint');
    expect(result.adapterFailureBlocks).toBe(true);
    expect(result.commitAllowed).toBe(false);
  });

  // ── Case D ──────────────────────────────────────────────────────────────────
  it('Case D: JS fails to load, Python succeeds, languages=["python"] → JS failure NOT counted, commitAllowed=true', async () => {
    const pyAdapter = makeAdapter('python', ['.py'], async () => []);
    getEnabledAdapters.mockResolvedValueOnce(
      Object.assign([pyAdapter], { failedAdapters: [makeFailedAdapter('javascript', 'javascript')] })
    );

    const result = await runLinter([PY_FILE], process.cwd(), {
      languages: ['python'],
      adapterFailurePolicy: 'fail',
    });

    // JS failure is excluded because languages=["python"] does not select it
    expect(result.adapterFailures).toHaveLength(0);
    expect(result.adapterFailureBlocks).toBe(false);
    expect(result.commitAllowed).toBe(true);
  });

  // ── Case E ──────────────────────────────────────────────────────────────────
  it('Case E: all selected adapters fail → commitAllowed=false, adapterFailureBlocks=true', async () => {
    getEnabledAdapters.mockResolvedValueOnce(
      Object.assign([], {
        failedAdapters: [
          makeFailedAdapter('javascript', 'javascript'),
          makeFailedAdapter('python', 'python'),
        ],
      })
    );

    const result = await runLinter([JS_FILE, PY_FILE], process.cwd(), {
      languages: ['auto'],
      adapterFailurePolicy: 'fail',
    });

    expect(result.adapterFailures).toHaveLength(2);
    expect(result.adapterFailureBlocks).toBe(true);
    expect(result.commitAllowed).toBe(false);
  });

  // ── Case F ──────────────────────────────────────────────────────────────────
  it('Case F: adapter fails to load → adapter failure recorded, result is NOT falsely clean', async () => {
    getEnabledAdapters.mockResolvedValueOnce(
      Object.assign([], {
        failedAdapters: [{ name: 'javascript', language: 'javascript', phase: 'load', error: 'cannot import' }],
      })
    );

    const result = await runLinter([JS_FILE], process.cwd(), { adapterFailurePolicy: 'fail' });

    expect(result.adapterFailures).toHaveLength(1);
    expect(result.adapterFailureBlocks).toBe(true);
    expect(result.commitAllowed).toBe(false);
    // Must not be a false "clean"
    expect(result.blocking.length + result.warnings.length + result.minor.length).toBe(0);
  });
});

describe('Adapter failure policy — three modes', () => {
  it('fail (default) — adapter failure blocks commit', async () => {
    getEnabledAdapters.mockResolvedValueOnce(
      Object.assign([], {
        failedAdapters: [makeFailedAdapter('python', 'python')],
      })
    );

    const result = await runLinter([PY_FILE], process.cwd(), {
      languages: ['python'],
      adapterFailurePolicy: 'fail',
    });

    expect(result.adapterFailures).toHaveLength(1);
    expect(result.adapterFailureBlocks).toBe(true);
    expect(result.commitAllowed).toBe(false);
  });

  it('warn — adapter failure reported but does not block commit', async () => {
    const stderrSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    getEnabledAdapters.mockResolvedValueOnce(
      Object.assign([], {
        failedAdapters: [makeFailedAdapter('python', 'python')],
      })
    );

    const result = await runLinter([PY_FILE], process.cwd(), {
      languages: ['python'],
      adapterFailurePolicy: 'warn',
    });

    expect(result.adapterFailures).toHaveLength(1);
    expect(result.adapterFailureBlocks).toBe(false);
    expect(result.commitAllowed).toBe(true);
    // A warning must be emitted to stderr so operators can see incomplete checks
    expect(stderrSpy).toHaveBeenCalledWith(expect.stringContaining('WARNING'));
    stderrSpy.mockRestore();
  });

  it('ignore — adapter failure suppressed but an explicit warning is emitted to stderr', async () => {
    const stderrSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    getEnabledAdapters.mockResolvedValueOnce(
      Object.assign([], {
        failedAdapters: [makeFailedAdapter('python', 'python')],
      })
    );

    const result = await runLinter([PY_FILE], process.cwd(), {
      languages: ['python'],
      adapterFailurePolicy: 'ignore',
    });

    expect(result.adapterFailures).toHaveLength(1);
    expect(result.adapterFailureBlocks).toBe(false);
    expect(result.commitAllowed).toBe(true);
    // Even with ignore, an explicit stderr warning must be emitted — never silently ignored
    expect(stderrSpy).toHaveBeenCalledWith(expect.stringContaining('ignore'));
    stderrSpy.mockRestore();
  });

  it('default policy when adapterFailurePolicy is not specified is "fail"', async () => {
    getEnabledAdapters.mockResolvedValueOnce(
      Object.assign([], {
        failedAdapters: [makeFailedAdapter('python', 'python')],
      })
    );

    // No adapterFailurePolicy in config → default must be 'fail'
    const result = await runLinter([PY_FILE], process.cwd(), { languages: ['python'] });

    expect(result.adapterFailureBlocks).toBe(true);
    expect(result.commitAllowed).toBe(false);
  });

  it('adapterMatchesLanguage correctly filters unselected adapters from failure tracking', async () => {
    // If languages=["python"] and JS adapter failed to load,
    // the JS failure must NOT appear in adapterFailures or block the check.
    const pyAdapter = makeAdapter('python', ['.py'], async () => []);
    getEnabledAdapters.mockResolvedValueOnce(
      Object.assign([pyAdapter], {
        failedAdapters: [
          makeFailedAdapter('javascript', 'javascript'),
          makeFailedAdapter('go', 'go'),
        ],
      })
    );

    const result = await runLinter([PY_FILE], process.cwd(), {
      languages: ['python'],
      adapterFailurePolicy: 'fail',
    });

    expect(result.adapterFailures).toHaveLength(0);
    expect(result.commitAllowed).toBe(true);
  });
});

