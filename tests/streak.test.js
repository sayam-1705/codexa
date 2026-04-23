import { describe, it, expect, beforeEach, vi } from 'vitest';

// Mock db module before importing streak
vi.mock('../src/solo/db.js', () => ({
  getDb: vi.fn(() => ({
    prepare: (query) => ({
      all: () => [],
    }),
  })),
  logRun: vi.fn(),
  getMeta: vi.fn(),
  setMeta: vi.fn(),
}));

import * as streakModule from '../src/solo/streak.js';
import { getDb } from '../src/solo/db.js';

const testRepoPath = '/test/repo';

describe('Streak System', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should return 0 streak when no clean runs', () => {
    vi.mocked(getDb).mockReturnValue({
      prepare: () => ({
        all: () => [
          { id: 1, commit_allowed: 0, errors_blocked: 1 },
          { id: 2, commit_allowed: 0, errors_blocked: 1 },
        ],
      }),
    });

    const streak = streakModule.getCurrentStreak(testRepoPath);
    expect(streak).toBe(0);
  });

  it('should count consecutive clean runs', () => {
    vi.mocked(getDb).mockReturnValue({
      prepare: () => ({
        all: () => [
          { id: 3, commit_allowed: 1, errors_blocked: 0 },
          { id: 2, commit_allowed: 1, errors_blocked: 0 },
          { id: 1, commit_allowed: 1, errors_blocked: 0 },
        ],
      }),
    });

    const streak = streakModule.getCurrentStreak(testRepoPath);
    expect(streak).toBe(3);
  });

  it('should break streak on blocked commit', () => {
    vi.mocked(getDb).mockReturnValue({
      prepare: () => ({
        all: () => [
          { id: 4, commit_allowed: 1, errors_blocked: 0 },
          { id: 3, commit_allowed: 0, errors_blocked: 1 },
          { id: 2, commit_allowed: 1, errors_blocked: 0 },
          { id: 1, commit_allowed: 1, errors_blocked: 0 },
        ],
      }),
    });

    const streak = streakModule.getCurrentStreak(testRepoPath);
    expect(streak).toBe(1);
  });

  it('should find best streak', () => {
    vi.mocked(getDb).mockReturnValue({
      prepare: () => ({
        all: () => [
          { id: 1, commit_allowed: 1, errors_blocked: 0 },
          { id: 2, commit_allowed: 1, errors_blocked: 0 },
          { id: 3, commit_allowed: 0, errors_blocked: 1 },
          { id: 4, commit_allowed: 1, errors_blocked: 0 },
          { id: 5, commit_allowed: 1, errors_blocked: 0 },
          { id: 6, commit_allowed: 1, errors_blocked: 0 },
        ],
      }),
    });

    const best = streakModule.getBestStreak(testRepoPath);
    expect(best).toBe(3);
  });

  it('should return correct streak display for clean run', () => {
    vi.mocked(getDb).mockReturnValue({
      prepare: () => ({
        all: () => [{ id: 1, commit_allowed: 1, errors_blocked: 0 }],
      }),
    });

    const display = streakModule.getStreakDisplay(testRepoPath);
    expect(display.current).toBe(1);
    expect(display.display).toContain('clean run');
    expect(display.level).toBe('clean');
  });

  it('should return hot display for 12-day streak', () => {
    const runs = Array.from({ length: 12 }, (_, i) => ({
      id: 12 - i,
      commit_allowed: 1,
      errors_blocked: 0,
    }));

    vi.mocked(getDb).mockReturnValue({
      prepare: () => ({
        all: () => runs,
      }),
    });

    const display = streakModule.getStreakDisplay(testRepoPath);
    expect(display.current).toBe(12);
    expect(display.display).toContain('🔥');
    expect(display.level).toBe('hot');
  });

  it('should return legendary display for 20-day streak', () => {
    const runs = Array.from({ length: 20 }, (_, i) => ({
      id: 20 - i,
      commit_allowed: 1,
      errors_blocked: 0,
    }));

    vi.mocked(getDb).mockReturnValue({
      prepare: () => ({
        all: () => runs,
      }),
    });

    const display = streakModule.getStreakDisplay(testRepoPath);
    expect(display.current).toBe(20);
    expect(display.display).toContain('💎');
    expect(display.level).toBe('legendary');
  });

  it('should detect streak at risk', () => {
    vi.mocked(getDb).mockReturnValue({
      prepare: () => ({
        all: () => [
          { id: 2, commit_allowed: 1, errors_blocked: 0 },
          { id: 1, commit_allowed: 1, errors_blocked: 0 },
        ],
      }),
    });

    expect(streakModule.isStreakAtRisk(testRepoPath, 1)).toBe(true);
    expect(streakModule.isStreakAtRisk(testRepoPath, 0)).toBe(false);
  });

  it('should return no risk when no streak', () => {
    vi.mocked(getDb).mockReturnValue({
      prepare: () => ({
        all: () => [],
      }),
    });

    expect(streakModule.isStreakAtRisk(testRepoPath, 5)).toBe(false);
  });

  it('should handle empty repository gracefully', () => {
    vi.mocked(getDb).mockReturnValue({
      prepare: () => ({
        all: () => [],
      }),
    });

    const streak = streakModule.getCurrentStreak(testRepoPath);
    expect(streak).toBe(0);

    const display = streakModule.getStreakDisplay(testRepoPath);
    expect(display.current).toBe(0);
    expect(display.level).toBe('none');
  });
});
