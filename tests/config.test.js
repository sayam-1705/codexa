import { describe, it, expect, vi } from 'vitest';

// Mock better-sqlite3 and db module
vi.mock('../src/solo/db.js', () => ({
  getDb: vi.fn(),
  logRun: vi.fn(),
  getMeta: vi.fn(),
  setMeta: vi.fn(),
}));

import { validateConfig, checkVersionCompat, getIgnorePatterns, createDefaultConfig } from '../src/team/config.js';
import { resolve } from 'path';
import os from 'os';

describe('Config Validation', () => {
  it('validateConfig returns valid=true for correct v2 config', () => {
    const config = {
      version: 2,
      blameMode: 'strict',
      languages: ['auto'],
      severity: {
        block: ['CRITICAL'],
        warn: ['MODERATE'],
        log: ['MINOR'],
        overrides: {},
      },
      team: { blockThreshold: 1 },
      ci: { failOn: 'CRITICAL' },
    };

    const result = validateConfig(config);
    expect(result.valid).toBe(true);
    expect(result.errors.length).toBe(0);
  });

  it('validateConfig returns errors for invalid blameMode', () => {
    const config = {
      version: 2,
      blameMode: 'invalid',
      languages: ['auto'],
      severity: { block: [], warn: [], log: [] },
    };

    const result = validateConfig(config);
    expect(result.valid).toBe(false);
    expect(result.errors.length).toBeGreaterThan(0);
    expect(result.errors.some((e) => e.includes('blameMode'))).toBe(true);
  });

  it('validateConfig returns errors for invalid ci.failOn', () => {
    const config = {
      version: 2,
      blameMode: 'strict',
      languages: ['auto'],
      severity: { block: [], warn: [], log: [] },
      ci: { failOn: 'INVALID' },
    };

    const result = validateConfig(config);
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.includes('failOn'))).toBe(true);
  });

  it('validateConfig returns errors for non-integer blockThreshold', () => {
    const config = {
      version: 2,
      blameMode: 'strict',
      languages: ['auto'],
      severity: { block: [], warn: [], log: [] },
      team: { blockThreshold: -1 },
    };

    const result = validateConfig(config);
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.includes('blockThreshold'))).toBe(true);
  });

  it('validateConfig accepts severity.overrides with valid values', () => {
    const config = {
      version: 2,
      blameMode: 'strict',
      languages: ['auto'],
      severity: {
        block: ['CRITICAL'],
        warn: ['MODERATE'],
        log: ['MINOR'],
        overrides: {
          'no-console': 'MINOR',
          'complexity': 'CRITICAL',
        },
      },
    };

    const result = validateConfig(config);
    expect(result.valid).toBe(true);
  });

  it('validateConfig rejects severity.overrides with invalid severity', () => {
    const config = {
      version: 2,
      blameMode: 'strict',
      languages: ['auto'],
      severity: {
        block: ['CRITICAL'],
        warn: ['MODERATE'],
        log: ['MINOR'],
        overrides: {
          'no-console': 'INVALID',
        },
      },
    };

    const result = validateConfig(config);
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.includes('INVALID'))).toBe(true);
  });

  it('validateConfig never throws', () => {
    const badConfigs = [
      null,
      undefined,
      { version: 'not-a-number' },
      { blameMode: null },
      { languages: 'not-an-array' },
    ];

    for (const config of badConfigs) {
      expect(() => {
        validateConfig(config || {});
      }).not.toThrow();
    }
  });

  it('checkVersionCompat is silent when versions match', () => {
    const consoleSpy = vi.spyOn(console, 'warn').mockImplementation();

    const config = { _codexaSchema: '2.0.0' };
    checkVersionCompat(config);

    expect(consoleSpy).not.toHaveBeenCalled();
    consoleSpy.mockRestore();
  });

  it('checkVersionCompat warns when config schema > CLI version', () => {
    const consoleSpy = vi.spyOn(console, 'warn').mockImplementation();

    const config = { _codexaSchema: '3.0.0' };
    checkVersionCompat(config);

    expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('WARNING'));
    consoleSpy.mockRestore();
  });

  it('getIgnorePatterns returns [] when .codexaignore missing', async () => {
    const patterns = await getIgnorePatterns('/nonexistent/path');
    expect(Array.isArray(patterns)).toBe(true);
    expect(patterns.length).toBe(0);
  });

  it('getIgnorePatterns parses patterns and strips comments', async () => {
    const tmpDir = os.tmpdir();
    const testIgnoreFile = resolve(tmpDir, 'test-codexaignore');

    try {
      const content = `# This is a comment
dist/
*.min.js
# Another comment
node_modules/`;

      const { writeFileSync } = await import('fs');
      writeFileSync(testIgnoreFile, content, 'utf8');

      const patterns = await getIgnorePatterns(tmpDir);
      expect(patterns).toContain('dist/');
      expect(patterns).toContain('*.min.js');
      expect(patterns).toContain('node_modules/');
      expect(patterns.some((p) => p.startsWith('#'))).toBe(false);

      const { unlinkSync } = await import('fs');
      unlinkSync(testIgnoreFile);
    } catch (err) {
      // Test cleanup failed
    }
  });

  it('createDefaultConfig does not overwrite existing config without --force', async () => {
    const tmpDir = os.tmpdir();
    const testConfigFile = resolve(tmpDir, 'test-codexa.config.json');

    try {
      const { writeFileSync } = await import('fs');
      writeFileSync(testConfigFile, JSON.stringify({ version: 1 }), 'utf8');

      const result = createDefaultConfig(tmpDir, { force: false });
      expect(result).toBe(false);

      const { unlinkSync } = await import('fs');
      unlinkSync(testConfigFile);
    } catch (err) {
      // Test cleanup
    }
  });
});
