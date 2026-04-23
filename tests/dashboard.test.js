import { describe, it, expect, beforeEach, vi } from 'vitest';

// Mock summary module
vi.mock('../src/team/summary.js', () => ({
  loadSummary: vi.fn(),
  getLeaderboard: vi.fn(),
}));

import { getDashboardData, formatDashboardTerminal } from '../src/team/dashboard.js';
import { loadSummary, getLeaderboard } from '../src/team/summary.js';

describe('Dashboard', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('getDashboardData returns required top-level fields', () => {
    const mockSummary = {
      lastUpdated: new Date().toISOString(),
      contributors: {},
      codebase: {
        totalRuns: 0,
        topRules: [],
        hotspots: [],
      },
    };

    loadSummary.mockReturnValue(mockSummary);
    getLeaderboard.mockReturnValue([]);

    const config = { team: { name: 'Engineering' } };
    const data = getDashboardData('/test/repo', null, config);

    expect(data).toHaveProperty('teamName');
    expect(data).toHaveProperty('timestamp');
    expect(data).toHaveProperty('codebaseTotalRuns');
    expect(data).toHaveProperty('contributors');
    expect(data).toHaveProperty('leaderboard');
    expect(data).toHaveProperty('topRules');
    expect(data).toHaveProperty('hotspots');
    expect(data).toHaveProperty('summary');
  });

  it('getDashboardData calculates cleanRunRate per contributor', () => {
    const mockSummary = {
      lastUpdated: new Date().toISOString(),
      contributors: {
        'alice@example.com': {
          displayName: 'Alice',
          totalRuns: 10,
          cleanRuns: 8,
          blockedRuns: 2,
          totalErrorsFound: 5,
          totalFixesAccepted: 3,
          currentStreak: 2,
          bestStreak: 5,
          topRules: [],
          languages: [],
          lastActive: new Date().toISOString(),
        },
      },
      codebase: { totalRuns: 10, topRules: [], hotspots: [] },
    };

    loadSummary.mockReturnValue(mockSummary);
    getLeaderboard.mockReturnValue([]);

    const config = { team: { name: 'Engineering' } };
    const data = getDashboardData('/test/repo', null, config);

    expect(data.contributors[0].cleanRunRate).toBe(80);
  });

  it('getDashboardData includes all contributors', () => {
    const mockSummary = {
      lastUpdated: new Date().toISOString(),
      contributors: {
        'alice@example.com': {
          displayName: 'Alice',
          totalRuns: 10,
          cleanRuns: 8,
          blockedRuns: 2,
          totalErrorsFound: 0,
          totalFixesAccepted: 0,
          currentStreak: 0,
          bestStreak: 0,
          topRules: [],
          languages: [],
          lastActive: new Date().toISOString(),
        },
        'bob@example.com': {
          displayName: 'Bob',
          totalRuns: 5,
          cleanRuns: 5,
          blockedRuns: 0,
          totalErrorsFound: 0,
          totalFixesAccepted: 0,
          currentStreak: 0,
          bestStreak: 0,
          topRules: [],
          languages: [],
          lastActive: new Date().toISOString(),
        },
      },
      codebase: { totalRuns: 15, topRules: [], hotspots: [] },
    };

    loadSummary.mockReturnValue(mockSummary);
    getLeaderboard.mockReturnValue([]);

    const config = { team: { name: 'Engineering' } };
    const data = getDashboardData('/test/repo', null, config);

    expect(data.contributors.length).toBe(2);
    expect(data.contributors.map((c) => c.displayName)).toContain('Alice');
    expect(data.contributors.map((c) => c.displayName)).toContain('Bob');
  });

  it('getDashboardData assigns trend based on streak', () => {
    const mockSummary = {
      lastUpdated: new Date().toISOString(),
      contributors: {
        'alice@example.com': {
          displayName: 'Alice',
          totalRuns: 10,
          cleanRuns: 8,
          blockedRuns: 2,
          totalErrorsFound: 0,
          totalFixesAccepted: 0,
          currentStreak: 3,
          bestStreak: 5,
          topRules: [],
          languages: [],
          lastActive: new Date().toISOString(),
        },
      },
      codebase: { totalRuns: 10, topRules: [], hotspots: [] },
    };

    loadSummary.mockReturnValue(mockSummary);
    getLeaderboard.mockReturnValue([]);

    const config = { team: { name: 'Engineering' } };
    const data = getDashboardData('/test/repo', null, config);

    expect(data.contributors[0].trend).toBe('improving');
  });

  it('getDashboardData calculates average clean run rate', () => {
    const mockSummary = {
      lastUpdated: new Date().toISOString(),
      contributors: {
        'alice@example.com': {
          displayName: 'Alice',
          totalRuns: 10,
          cleanRuns: 8,
          blockedRuns: 2,
          totalErrorsFound: 0,
          totalFixesAccepted: 0,
          currentStreak: 0,
          bestStreak: 0,
          topRules: [],
          languages: [],
          lastActive: new Date().toISOString(),
        },
        'bob@example.com': {
          displayName: 'Bob',
          totalRuns: 10,
          cleanRuns: 10,
          blockedRuns: 0,
          totalErrorsFound: 0,
          totalFixesAccepted: 0,
          currentStreak: 0,
          bestStreak: 0,
          topRules: [],
          languages: [],
          lastActive: new Date().toISOString(),
        },
      },
      codebase: { totalRuns: 20, topRules: [], hotspots: [] },
    };

    loadSummary.mockReturnValue(mockSummary);
    getLeaderboard.mockReturnValue([]);

    const config = { team: { name: 'Engineering' } };
    const data = getDashboardData('/test/repo', null, config);

    expect(data.summary.averageCleanRunRate).toBe(90);
  });

  it('getDashboardData includes leaderboard with ranks', () => {
    const mockSummary = {
      lastUpdated: new Date().toISOString(),
      contributors: {
        'alice@example.com': {
          displayName: 'Alice',
          totalRuns: 10,
          cleanRuns: 8,
          blockedRuns: 2,
          totalErrorsFound: 0,
          totalFixesAccepted: 0,
          currentStreak: 0,
          bestStreak: 0,
          topRules: [],
          languages: [],
          lastActive: new Date().toISOString(),
        },
      },
      codebase: { totalRuns: 10, topRules: [], hotspots: [] },
    };

    loadSummary.mockReturnValue(mockSummary);
    getLeaderboard.mockReturnValue([{ displayName: 'Alice', value: 80, email: 'alice@example.com' }]);

    const config = { team: { name: 'Engineering', leaderboardOptIn: ['alice@example.com'] } };
    const data = getDashboardData('/test/repo', null, config);

    expect(data.leaderboard.length).toBe(1);
    expect(data.leaderboard[0]).toHaveProperty('rank');
    expect(data.leaderboard[0].rank).toBe(1);
  });

  it('getDashboardData aggregates total errors found', () => {
    const mockSummary = {
      lastUpdated: new Date().toISOString(),
      contributors: {
        'alice@example.com': {
          displayName: 'Alice',
          totalRuns: 10,
          cleanRuns: 8,
          blockedRuns: 2,
          totalErrorsFound: 15,
          totalFixesAccepted: 10,
          currentStreak: 0,
          bestStreak: 0,
          topRules: [],
          languages: [],
          lastActive: new Date().toISOString(),
        },
        'bob@example.com': {
          displayName: 'Bob',
          totalRuns: 5,
          cleanRuns: 5,
          blockedRuns: 0,
          totalErrorsFound: 5,
          totalFixesAccepted: 5,
          currentStreak: 0,
          bestStreak: 0,
          topRules: [],
          languages: [],
          lastActive: new Date().toISOString(),
        },
      },
      codebase: { totalRuns: 15, topRules: [], hotspots: [] },
    };

    loadSummary.mockReturnValue(mockSummary);
    getLeaderboard.mockReturnValue([]);

    const config = { team: { name: 'Engineering' } };
    const data = getDashboardData('/test/repo', null, config);

    expect(data.summary.totalErrorsFound).toBe(20);
    expect(data.summary.totalFixesAccepted).toBe(15);
  });

  it('formatDashboardTerminal outputs structured text', () => {
    const dashboardData = {
      teamName: 'Engineering',
      timestamp: new Date().toISOString(),
      codebaseTotalRuns: 100,
      summary: {
        totalContributors: 2,
        averageCleanRunRate: 85,
        totalErrorsFound: 50,
        totalFixesAccepted: 30,
      },
      contributors: [],
      leaderboard: [],
      topRules: [],
      hotspots: [],
    };

    const output = formatDashboardTerminal(dashboardData);

    expect(output).toContain('Engineering');
    expect(output).toContain('Last updated');
    expect(output).toContain('Total runs: 100');
    expect(output).toContain('Contributors: 2');
    expect(output).toContain('85%');
  });

  it('formatDashboardTerminal includes leaderboard section when data present', () => {
    const dashboardData = {
      teamName: 'Engineering',
      timestamp: new Date().toISOString(),
      codebaseTotalRuns: 100,
      summary: {
        totalContributors: 1,
        averageCleanRunRate: 80,
        totalErrorsFound: 20,
        totalFixesAccepted: 10,
      },
      contributors: [],
      leaderboard: [
        { rank: 1, displayName: 'Alice', value: 95, email: 'alice@example.com' },
      ],
      topRules: [],
      hotspots: [],
    };

    const output = formatDashboardTerminal(dashboardData);

    expect(output).toContain('Top Contributors');
    expect(output).toContain('Alice');
    expect(output).toContain('95%');
  });
});
