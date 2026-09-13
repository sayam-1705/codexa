import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import {
  loadRegistry,
  listAdapters,
  removeAdapter,
  installAdapter,
  getEnabledAdapters,
} from '../src/plugins/registry.js';
import { existsSync, rmSync, mkdirSync } from 'fs';
import { tmpdir } from 'os';
import { resolve } from 'path';

describe('Adapter Registry', () => {
  let testHomeDir;

  beforeEach(() => {
    testHomeDir = resolve(tmpdir(), `codexa-registry-test-${Date.now()}-${Math.random().toString(36).slice(2)}`);
    mkdirSync(testHomeDir, { recursive: true });
    process.env.CODEXA_HOME = testHomeDir;
  });

  afterEach(() => {
    delete process.env.CODEXA_HOME;
    if (testHomeDir && existsSync(testHomeDir)) {
      try {
        rmSync(testHomeDir, { recursive: true, force: true });
      } catch (e) {
        // Ignore
      }
    }
  });

  it('loadRegistry returns built-ins when adapters.json missing', () => {
    const registry = loadRegistry();

    expect(registry).toHaveProperty('version', 1);
    expect(registry).toHaveProperty('adapters');
    expect(Array.isArray(registry.adapters)).toBe(true);
  });

  it('loadRegistry includes javascript and python built-in entries', () => {
    const registry = loadRegistry();

    const js = registry.adapters.find((a) => a.name === 'javascript');
    const py = registry.adapters.find((a) => a.name === 'python');

    expect(js).toBeDefined();
    expect(js.package).toBe('builtin');
    expect(py).toBeDefined();
    expect(py.package).toBe('builtin');
  });

  it('listAdapters marks built-ins correctly', () => {
    const { installed } = listAdapters();

    const js = installed.find((a) => a.name === 'javascript');
    const py = installed.find((a) => a.name === 'python');

    expect(js.isBuiltin).toBe(true);
    expect(py.isBuiltin).toBe(true);
  });

  it('listAdapters includes COMMUNITY_REGISTRY entries', () => {
    const { community } = listAdapters();

    expect(community.length).toBeGreaterThan(0);
    expect(community.find((c) => c.name === 'go')).toMatchObject({ status: 'not-published' });
    expect(community.find((c) => c.name === 'rust')).toMatchObject({ status: 'not-published' });
  });

  it('rejects planned adapters before attempting npm installation', async () => {
    await expect(installAdapter('codexa-adapter-go')).rejects.toThrow(
      'is listed as a planned community adapter but is not published on npm yet'
    );
  });

  it('removeAdapter throws when removing a built-in adapter', () => {
    expect(() => removeAdapter('javascript')).toThrow(
      'Cannot remove built-in adapters'
    );
  });

  it('getEnabledAdapters returns only enabled adapters', async () => {
    const adapters = await getEnabledAdapters('/test/repo');

    // Should have at least javascript and python
    expect(adapters.length).toBeGreaterThanOrEqual(2);

    // Each adapter should have wrapped methods
    expect(adapters[0]).toHaveProperty('detect');
    expect(adapters[0]).toHaveProperty('lint');
    expect(adapters[0]).toHaveProperty('fix');
  });

  it('getEnabledAdapters wraps detect() so it never throws', async () => {
    const adapters = await getEnabledAdapters('/test/repo');

    // Call detect() - should never throw even on bad path
    for (const adapter of adapters) {
      const result = await adapter.detect('/nonexistent/path/12345/67890');
      expect(typeof result).toBe('boolean');
    }
  });
});
