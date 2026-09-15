/**
 * Runner database error tolerance tests.
 *
 * Verifies that the runner returns a valid lint result even when the database
 * throws exceptions. The database is supplemental metrics only; failures must
 * never invalidate a lint result.
 */

import { describe, it, expect, vi } from 'vitest';

vi.mock('../src/solo/db.js', () => ({
  getDb: vi.fn(() => { throw new Error('SIMULATED database lock'); }),
  logRun: vi.fn(),
  closeDb: vi.fn(),
}));

vi.mock('../src/solo/streak.js', () => ({
  getCurrentStreak: vi.fn(() => 0),
  getStreakDisplay: vi.fn(() => ({ current: 0, best: 0, display: '✓', level: 'none' })),
}));

vi.mock('../src/learning/history.js', () => ({
  logCommitCheck: vi.fn(),
}));

vi.mock('../src/plugins/registry.js', () => ({
  getEnabledAdapters: vi.fn(async () =>
    Object.assign([], { failedAdapters: [] })
  ),
}));

import { runLinter } from '../src/core/runner.js';

describe('SQLite — runner tolerates database errors', () => {
  it('runLinter result is valid even when getDb throws', async () => {
    const result = await runLinter([], process.cwd(), {});
    expect(result).toMatchObject({ blocking: [], warnings: [], minor: [] });
  });

  it('runLinter result structure is complete and not undefined when DB fails', async () => {
    const result = await runLinter([], process.cwd(), {});
    // All required result fields must exist (not undefined)
    expect(result).toHaveProperty('blocking');
    expect(result).toHaveProperty('warnings');
    expect(result).toHaveProperty('minor');
    expect(result).toHaveProperty('adapterFailures');
    // No adapter failures should exist in a clean empty run
    expect(result.adapterFailures).toHaveLength(0);
  });
});
