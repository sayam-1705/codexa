import { describe, it, expect, beforeEach, vi } from 'vitest';

// Mock db module before importing trends
vi.mock('../src/solo/db.js', () => ({
  getDb: vi.fn(() => ({
    prepare: () => ({
      all: () => [],
      get: () => null,
    }),
  })),
  logRun: vi.fn(),
  getMeta: vi.fn(),
  setMeta: vi.fn(),
  getDailyErrorCounts: vi.fn(() => []),
  getErrorFrequency: vi.fn(() => []),
  getLifetimeStats: vi.fn(() => ({})),
}));

import * as trendsModule from '../src/solo/trends.js';

const testRepoPath = '/test/repo';

describe('Trends Analysis', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should get trend data for period', () => {
    const trend = trendsModule.getTrendData(testRepoPath, 30);
    expect(trend.period.days).toBe(30);
    expect(trend).toHaveProperty('dailyCounts');
    expect(trend).toHaveProperty('totalErrors');
  });

  it('should return top recurring errors', () => {
    const top = trendsModule.getTopRecurringErrors(testRepoPath, 2, 30);
    expect(top).toBeDefined();
    expect(Array.isArray(top)).toBe(true);
  });

  it('should calculate percentage for top errors', () => {
    const top = trendsModule.getTopRecurringErrors(testRepoPath, 5, 30);
    if (top.length > 0) {
      expect(top[0]).toHaveProperty('percentage');
    }
  });

  it('should get improvement score', () => {
    const score = trendsModule.getImprovementScore(testRepoPath);
    expect(score).toHaveProperty('score');
    expect(score).toHaveProperty('trend');
    expect(score.score).toBeGreaterThanOrEqual(0);
    expect(score.score).toBeLessThanOrEqual(100);
  });

  it('should get weekly summary', () => {
    const summary = trendsModule.getWeeklySummary(testRepoPath);
    expect(summary).toHaveProperty('runs');
    expect(summary).toHaveProperty('errors');
    expect(summary).toHaveProperty('fixes');
  });

  it('should get error breakdown by severity', () => {
    const breakdown = trendsModule.getErrorBreakdown(testRepoPath, 30);
    expect(breakdown).toHaveProperty('critical');
    expect(breakdown).toHaveProperty('moderate');
    expect(breakdown).toHaveProperty('minor');
    expect(breakdown).toHaveProperty('total');
  });

  it('should handle empty repository', () => {
    const trend = trendsModule.getTrendData(testRepoPath, 30);
    expect(trend.totalErrors).toBeGreaterThanOrEqual(0);
  });

  it('should return empty top errors for empty data', () => {
    const top = trendsModule.getTopRecurringErrors(testRepoPath, 5, 30);
    expect(Array.isArray(top)).toBe(true);
  });

  it('should clamp improvement score 0-100', () => {
    const score = trendsModule.getImprovementScore(testRepoPath);
    expect(score.score).toBeLessThanOrEqual(100);
    expect(score.score).toBeGreaterThanOrEqual(0);
  });
});
