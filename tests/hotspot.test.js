import { describe, it, expect } from 'vitest';
import { detectHotspots, generateRecommendations, mergeHotspots } from '../src/team/hotspot.js';

describe('Hotspots', () => {
  it('detectHotspots returns empty array for empty errors', () => {
    const hotspots = detectHotspots([]);
    expect(hotspots).toEqual([]);
  });

  it('detectHotspots groups errors by file', () => {
    const errors = [
      { file: 'src/a.js', rule: 'no-undef', level: 'blocking' },
      { file: 'src/a.js', rule: 'no-console', level: 'warning' },
      { file: 'src/b.js', rule: 'no-undef', level: 'blocking' },
    ];

    const hotspots = detectHotspots(errors);

    expect(hotspots.length).toBe(2);
    expect(hotspots.map((h) => h.file)).toContain('src/a.js');
    expect(hotspots.map((h) => h.file)).toContain('src/b.js');
  });

  it('detectHotspots calculates priority by severity score', () => {
    const errors = [
      { file: 'src/a.js', rule: 'rule1', level: 'blocking' },
      { file: 'src/a.js', rule: 'rule2', level: 'warning' },
      { file: 'src/b.js', rule: 'rule3', level: 'warning' },
    ];

    const hotspots = detectHotspots(errors, { weighting: 'severity' });

    // src/a.js: 3+2=5 severity / 2 errors = 2.5
    // src/b.js: 2 severity / 1 error = 2.0
    expect(hotspots[0].file).toBe('src/a.js');
  });

  it('detectHotspots respects maxHotspots limit', () => {
    const errors = [];
    for (let i = 0; i < 20; i++) {
      errors.push({ file: `src/file${i}.js`, rule: 'rule', level: 'blocking' });
    }

    const hotspots = detectHotspots(errors, { maxHotspots: 5 });
    expect(hotspots.length).toBe(5);
  });

  it('detectHotspots identifies mostCommonRule', () => {
    const errors = [
      { file: 'src/a.js', rule: 'no-undef', level: 'blocking' },
      { file: 'src/a.js', rule: 'no-undef', level: 'blocking' },
      { file: 'src/a.js', rule: 'no-console', level: 'warning' },
    ];

    const hotspots = detectHotspots(errors);

    expect(hotspots[0].mostCommonRule).toBe('no-undef');
  });

  it('generateRecommendations returns action items', () => {
    const hotspots = [
      {
        file: 'src/a.js',
        errorCount: 10,
        priority: 5,
        rules: ['no-undef', 'no-console'],
        mostCommonRule: 'no-undef',
      },
      {
        file: 'src/b.js',
        errorCount: 5,
        priority: 3,
        rules: ['no-undef'],
        mostCommonRule: 'no-undef',
      },
    ];

    const recommendations = generateRecommendations(hotspots);

    expect(recommendations.length).toBeGreaterThan(0);
    expect(recommendations[0]).toHaveProperty('action');
    expect(recommendations[0]).toHaveProperty('priority');
  });

  it('generateRecommendations recommends bulk cleanup for many hotspots', () => {
    const hotspots = Array.from({ length: 10 }, (_, i) => ({
      file: `src/file${i}.js`,
      errorCount: 5 + i,
      priority: 5 - i * 0.4,
      rules: ['rule'],
      mostCommonRule: 'rule',
    }));

    const recommendations = generateRecommendations(hotspots);

    expect(recommendations.some((r) => r.type === 'bulk-cleanup')).toBe(true);
  });

  it('mergeHotspots detects improving trend', () => {
    const existing = [
      { file: 'src/a.js', errorCount: 10, priority: 5, rules: [], mostCommonRule: null },
    ];
    const newHotspots = [
      { file: 'src/a.js', errorCount: 5, priority: 4, rules: [], mostCommonRule: null },
    ];

    const merged = mergeHotspots(existing, newHotspots);

    expect(merged[0].trend).toBe('improving');
  });

  it('mergeHotspots detects worsening trend', () => {
    const existing = [
      { file: 'src/a.js', errorCount: 5, priority: 3, rules: [], mostCommonRule: null },
    ];
    const newHotspots = [
      { file: 'src/a.js', errorCount: 15, priority: 5, rules: [], mostCommonRule: null },
    ];

    const merged = mergeHotspots(existing, newHotspots);

    expect(merged[0].trend).toBe('worsening');
  });
});
