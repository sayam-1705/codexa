import { describe, it, expect } from 'vitest';
import { generateHTMLReport } from '../src/team/html-report.js';

describe('HTML Report Generator', () => {
  it('generates valid HTML with required structure', () => {
    const dashboardData = {
      teamName: 'Engineering',
      timestamp: new Date().toISOString(),
      codebaseTotalRuns: 100,
      contributors: [],
      leaderboard: [],
      topRules: [],
      hotspots: [],
      summary: {
        totalContributors: 5,
        averageCleanRunRate: 85,
        totalFixesAccepted: 50,
      },
    };

    const html = generateHTMLReport(dashboardData);

    expect(html).toContain('<!DOCTYPE html>');
    expect(html).toContain('<html');
    expect(html).toContain('</html>');
    expect(html).toContain('Engineering');
  });

  it('includes summary statistics', () => {
    const dashboardData = {
      teamName: 'Test Team',
      timestamp: new Date().toISOString(),
      codebaseTotalRuns: 42,
      contributors: [],
      leaderboard: [],
      topRules: [],
      hotspots: [],
      summary: {
        totalContributors: 3,
        averageCleanRunRate: 90,
        totalFixesAccepted: 25,
      },
    };

    const html = generateHTMLReport(dashboardData);

    expect(html).toContain('42');
    expect(html).toContain('90%');
  });

  it('renders leaderboard when present', () => {
    const dashboardData = {
      teamName: 'Test',
      timestamp: new Date().toISOString(),
      codebaseTotalRuns: 1,
      contributors: [],
      leaderboard: [
        { rank: 1, displayName: 'Alice', value: 95 },
        { rank: 2, displayName: 'Bob', value: 85 },
      ],
      topRules: [],
      hotspots: [],
      summary: {},
    };

    const html = generateHTMLReport(dashboardData);

    expect(html).toContain('Alice');
    expect(html).toContain('Bob');
    expect(html).toContain('#1');
    expect(html).toContain('#2');
  });

  it('escapes HTML special characters', () => {
    const dashboardData = {
      teamName: 'Team <script>alert("xss")</script>',
      timestamp: new Date().toISOString(),
      codebaseTotalRuns: 1,
      contributors: [],
      leaderboard: [],
      topRules: [{ rule: '<script>', count: 1, contributors: 1 }],
      hotspots: [{ file: 'test<1>.js', errorCount: 5, priority: 3, trend: 'stable' }],
      summary: {},
    };

    const html = generateHTMLReport(dashboardData);

    expect(html).not.toContain('<script>');
    expect(html).toContain('&lt;script&gt;');
    expect(html).toContain('test&lt;1&gt;.js');
  });

  it('renders contributors table', () => {
    const dashboardData = {
      teamName: 'Test',
      timestamp: new Date().toISOString(),
      codebaseTotalRuns: 1,
      contributors: [
        {
          displayName: 'Alice',
          totalRuns: 10,
          cleanRunRate: 90,
          currentStreak: 5,
          languages: ['javascript', 'python'],
        },
      ],
      leaderboard: [],
      topRules: [],
      hotspots: [],
      summary: {},
    };

    const html = generateHTMLReport(dashboardData);

    expect(html).toContain('Alice');
    expect(html).toContain('10');
    expect(html).toContain('javascript');
  });

  it('includes inline CSS and no external dependencies', () => {
    const dashboardData = {
      teamName: 'Test',
      timestamp: new Date().toISOString(),
      codebaseTotalRuns: 1,
      contributors: [],
      leaderboard: [],
      topRules: [],
      hotspots: [],
      summary: {},
    };

    const html = generateHTMLReport(dashboardData);

    expect(html).toContain('<style>');
    expect(html).toContain('</style>');
    expect(html).not.toContain('href="');
    expect(html).not.toContain('src="http');
  });
});
