import { describe, it, expect, beforeEach, vi } from 'vitest';

// Mock db and other solo modules before importing digest
vi.mock('../src/solo/db.js', () => ({
  getDb: vi.fn(),
  logRun: vi.fn(),
  getMeta: vi.fn(),
  setMeta: vi.fn(),
}));

vi.mock('../src/solo/streak.js');
vi.mock('../src/solo/trends.js');

import * as digestModule from '../src/solo/digest.js';
import * as streakMod from '../src/solo/streak.js';
import * as trendsMod from '../src/solo/trends.js';
import * as dbMod from '../src/solo/db.js';

const testRepoPath = '/test/repo';

describe('Weekly Digest', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should show digest on first call', () => {
    vi.mocked(dbMod.getDb).mockReturnValue({});
    vi.mocked(dbMod.getMeta).mockReturnValue(null);

    const should = digestModule.shouldShowDigest(testRepoPath);
    expect(should).toBe(true);
  });

  it('should not show digest if less than 7 days have passed', () => {
    const now = new Date().toISOString();

    vi.mocked(dbMod.getDb).mockReturnValue({});
    vi.mocked(dbMod.getMeta).mockReturnValue(now);

    const should = digestModule.shouldShowDigest(testRepoPath);
    expect(should).toBe(false);
  });

  it('should show digest after 7+ days', () => {
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();

    vi.mocked(dbMod.getDb).mockReturnValue({});
    vi.mocked(dbMod.getMeta).mockReturnValue(sevenDaysAgo);

    const should = digestModule.shouldShowDigest(testRepoPath);
    expect(should).toBe(true);
  });

  it('should generate digest object', () => {
    vi.mocked(trendsMod.getWeeklySummary).mockReturnValue({
      runs: 5,
      errors: 10,
      fixes: 8,
      patternHits: 2,
      successfulCommits: 4,
    });
    vi.mocked(trendsMod.getErrorBreakdown).mockReturnValue({
      critical: 2,
      moderate: 5,
      minor: 3,
      total: 10,
    });
    vi.mocked(streakMod.getStreakDisplay).mockReturnValue({
      current: 5,
      best: 10,
      display: '🔥 5-day streak',
      level: 'hot',
    });

    const digest = digestModule.generateDigest(testRepoPath);

    expect(digest).toHaveProperty('date');
    expect(digest).toHaveProperty('period');
    expect(digest).toHaveProperty('stats');
    expect(digest).toHaveProperty('streak');
    expect(digest.stats.runsExecuted).toBe(5);
    expect(digest.stats.errorsFound).toBe(10);
  });

  it('should calculate fix rate percentage', () => {
    vi.mocked(trendsMod.getWeeklySummary).mockReturnValue({
      runs: 5,
      errors: 10,
      fixes: 8,
      patternHits: 2,
      successfulCommits: 4,
    });
    vi.mocked(trendsMod.getErrorBreakdown).mockReturnValue({
      critical: 2,
      moderate: 5,
      minor: 3,
      total: 10,
    });
    vi.mocked(streakMod.getStreakDisplay).mockReturnValue({
      current: 5,
      best: 10,
      display: '🔥 5-day streak',
      level: 'hot',
    });

    const digest = digestModule.generateDigest(testRepoPath);
    expect(digest.stats.fixRate).toBeGreaterThan(0);
    expect(digest.stats.fixRate).toBeLessThanOrEqual(100);
  });

  it('should include streak in digest', () => {
    vi.mocked(trendsMod.getWeeklySummary).mockReturnValue({
      runs: 5,
      errors: 10,
      fixes: 8,
      patternHits: 2,
      successfulCommits: 4,
    });
    vi.mocked(trendsMod.getErrorBreakdown).mockReturnValue({
      critical: 2,
      moderate: 5,
      minor: 3,
      total: 10,
    });
    vi.mocked(streakMod.getStreakDisplay).mockReturnValue({
      current: 5,
      best: 10,
      display: '🔥 5-day streak',
      level: 'hot',
    });

    const digest = digestModule.generateDigest(testRepoPath);
    expect(digest.streak.current).toBe(5);
    expect(digest.streak.best).toBe(10);
    expect(digest.streak.display).toContain('🔥');
  });

  it('should print digest without error', () => {
    vi.mocked(dbMod.getDb).mockReturnValue({});
    vi.mocked(dbMod.getMeta).mockReturnValue(null);
    vi.mocked(trendsMod.getWeeklySummary).mockReturnValue({
      runs: 5,
      errors: 10,
      fixes: 8,
      patternHits: 2,
      successfulCommits: 4,
    });
    vi.mocked(trendsMod.getErrorBreakdown).mockReturnValue({
      critical: 2,
      moderate: 5,
      minor: 3,
      total: 10,
    });
    vi.mocked(streakMod.getStreakDisplay).mockReturnValue({
      current: 5,
      best: 10,
      display: '🔥 5-day streak',
      level: 'hot',
    });

    const consoleSpy = vi.spyOn(console, 'log').mockImplementation();

    digestModule.printDigest(testRepoPath);

    expect(consoleSpy).toHaveBeenCalled();
    consoleSpy.mockRestore();
  });

  it('should update meta after printing digest', () => {
    vi.mocked(dbMod.getDb).mockReturnValue({});
    vi.mocked(dbMod.getMeta).mockReturnValue(null);
    vi.mocked(trendsMod.getWeeklySummary).mockReturnValue({
      runs: 5,
      errors: 10,
      fixes: 8,
      patternHits: 2,
      successfulCommits: 4,
    });
    vi.mocked(trendsMod.getErrorBreakdown).mockReturnValue({
      critical: 2,
      moderate: 5,
      minor: 3,
      total: 10,
    });
    vi.mocked(streakMod.getStreakDisplay).mockReturnValue({
      current: 5,
      best: 10,
      display: '🔥 5-day streak',
      level: 'hot',
    });

    vi.spyOn(console, 'log').mockImplementation();

    digestModule.printDigest(testRepoPath);

    expect(vi.mocked(dbMod.setMeta)).toHaveBeenCalled();

    vi.restoreAllMocks();
  });
});
