import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { resolve } from 'path';
import os from 'os';
import { writeFileSync, mkdirSync, rmSync, existsSync } from 'fs';
import { randomUUID } from 'crypto';
import { loadSummary, updateSummary, getContributorStats, getLeaderboard } from '../src/team/summary.js';

describe('Team Summary', () => {
  let testDirs = [];
  let currentTestDir;

  beforeEach(() => {
    currentTestDir = null;
  });

  function createTestDir() {
    // Clean up any previous test directory
    if (currentTestDir && existsSync(currentTestDir)) {
      try {
        rmSync(currentTestDir, { recursive: true, force: true });
      } catch (err) {
        // Ignore if cleanup fails
      }
    }

    const uniqueId = randomUUID();
    const dir = resolve(os.tmpdir(), `summary-test-${uniqueId}`);
    mkdirSync(resolve(dir, '.codexa'), { recursive: true });
    currentTestDir = dir;
    testDirs.push(dir);
    return dir;
  }

  afterEach(() => {
    testDirs.forEach((dir) => {
      try {
        if (existsSync(dir)) {
          rmSync(dir, { recursive: true, force: true });
        }
      } catch (err) {
        // Ignore cleanup errors
      }
    });
    testDirs = [];
    currentTestDir = null;
  });

  it('loadSummary returns empty template when file missing', () => {
    const tmpDir = createTestDir();
    const summary = loadSummary(tmpDir);

    expect(summary).toHaveProperty('version', 1);
    expect(summary).toHaveProperty('lastUpdated');
    expect(summary).toHaveProperty('contributors');
    expect(summary.contributors).toEqual({});
    expect(summary.codebase.totalRuns).toBe(0);
  });

  it('loadSummary parses existing file correctly', () => {
    const tmpDir = createTestDir();
    const testSummary = {
      version: 1,
      lastUpdated: '2026-04-23T00:00:00.000Z',
      contributors: {
        'alice@example.com': {
          displayName: 'Alice',
          totalRuns: 5,
          cleanRuns: 4,
          blockedRuns: 1,
          totalErrorsFound: 3,
          totalFixesAccepted: 2,
          currentStreak: 2,
          bestStreak: 5,
          topRules: [],
          languages: ['javascript'],
          lastActive: '2026-04-23T00:00:00.000Z',
        },
      },
      codebase: { totalRuns: 5, topRules: [], hotspots: [] },
    };

    const summaryPath = resolve(tmpDir, '.codexa', 'codexa-summary.json');
    writeFileSync(summaryPath, JSON.stringify(testSummary), 'utf8');

    const loaded = loadSummary(tmpDir);

    expect(loaded.contributors['alice@example.com']).toEqual(testSummary.contributors['alice@example.com']);
  });

  it('updateSummary creates new contributor entry', () => {
    const tmpDir = createTestDir();
    const runResult = {
      commit_allowed: true,
      blocking: [],
      warnings: [],
      minor: [],
      streak: 1,
      language: 'javascript',
    };

    const summary = updateSummary(tmpDir, runResult, 'alice@example.com', 'Alice');

    expect(summary.contributors['alice@example.com']).toBeDefined();
    expect(summary.contributors['alice@example.com'].displayName).toBe('Alice');
    expect(summary.contributors['alice@example.com'].totalRuns).toBe(1);
    expect(summary.contributors['alice@example.com'].cleanRuns).toBe(1);
  });

  it('updateSummary increments blockedRuns for failed commits', () => {
    const tmpDir = createTestDir();
    const runResult = {
      commit_allowed: false,
      blocking: [{ rule: 'no-undef' }],
      warnings: [],
      minor: [],
      streak: 0,
      language: 'javascript',
    };

    const summary = updateSummary(tmpDir, runResult, 'alice@example.com', 'Alice');

    expect(summary.contributors['alice@example.com'].blockedRuns).toBe(1);
  });

  it.skip('updateSummary counts all error types toward totalErrorsFound', () => {
    const tmpDir = createTestDir();
    const runResult = {
      commit_allowed: false,
      blocking: [{ rule: 'rule1' }, { rule: 'rule2' }],
      warnings: [{ rule: 'rule3' }],
      minor: [{ rule: 'rule4' }],
      streak: 0,
      language: 'javascript',
    };

    const summary = updateSummary(tmpDir, runResult, 'alice@example.com', 'Alice');

    expect(summary.contributors['alice@example.com'].totalErrorsFound).toBe(4);
  });

  it('getContributorStats returns contributor data or null', () => {
    const summary = {
      contributors: {
        'alice@example.com': { displayName: 'Alice', totalRuns: 5 },
      },
    };

    const stats = getContributorStats(summary, 'alice@example.com');
    expect(stats).toEqual({ displayName: 'Alice', totalRuns: 5 });

    const missing = getContributorStats(summary, 'missing@example.com');
    expect(missing).toBeNull();
  });

  it('getLeaderboard filters by optInEmails', () => {
    const summary = {
      contributors: {
        'alice@example.com': {
          displayName: 'Alice',
          totalRuns: 10,
          cleanRuns: 9,
          blockedRuns: 1,
        },
        'bob@example.com': {
          displayName: 'Bob',
          totalRuns: 10,
          cleanRuns: 10,
          blockedRuns: 0,
        },
      },
    };

    const leaderboard = getLeaderboard(summary, 'cleanRunRate', ['alice@example.com']);

    expect(leaderboard.length).toBe(1);
    expect(leaderboard[0].displayName).toBe('Alice');
  });

  it('getLeaderboard sorts by metric descending', () => {
    const summary = {
      contributors: {
        'alice@example.com': {
          displayName: 'Alice',
          totalRuns: 10,
          cleanRuns: 8,
          blockedRuns: 2,
          currentStreak: 2,
        },
        'bob@example.com': {
          displayName: 'Bob',
          totalRuns: 10,
          cleanRuns: 10,
          blockedRuns: 0,
          currentStreak: 5,
        },
      },
    };

    const leaderboard = getLeaderboard(summary, 'currentStreak', [
      'alice@example.com',
      'bob@example.com',
    ]);

    expect(leaderboard[0].displayName).toBe('Bob');
    expect(leaderboard[0].value).toBe(5);
    expect(leaderboard[1].displayName).toBe('Alice');
    expect(leaderboard[1].value).toBe(2);
  });

  it('getLeaderboard returns max 10 contributors', () => {
    const contributors = {};
    for (let i = 0; i < 15; i++) {
      contributors[`user${i}@example.com`] = {
        displayName: `User${i}`,
        totalRuns: 10,
        cleanRuns: 10 - i,
        blockedRuns: i,
        currentStreak: i,
      };
    }

    const summary = { contributors };
    const optIns = Object.keys(contributors);

    const leaderboard = getLeaderboard(summary, 'currentStreak', optIns);

    expect(leaderboard.length).toBe(10);
  });

  it.skip('updateSummary updates codebase.totalRuns', () => {
    const tmpDir = createTestDir();
    const runResult = {
      commit_allowed: true,
      blocking: [],
      warnings: [],
      minor: [],
      streak: 1,
      language: 'javascript',
    };

    const summary1 = updateSummary(tmpDir, runResult, 'alice@example.com', 'Alice');
    expect(summary1.codebase.totalRuns).toBe(1);

    const summary2 = updateSummary(tmpDir, runResult, 'bob@example.com', 'Bob');
    expect(summary2.codebase.totalRuns).toBe(2);
  });
});
