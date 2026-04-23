import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import {
  loadRegistry,
  listAdapters,
  removeAdapter,
  getEnabledAdapters,
} from '../src/plugins/registry.js';
import { existsSync, rmSync } from 'fs';
import { homedir } from 'os';
import { resolve } from 'path';

describe('Adapter Registry', () => {
  const registryPath = resolve(homedir(), '.codexa', 'adapters.json');

  beforeEach(() => {
    // Clean up registry before each test
    if (existsSync(registryPath)) {
      try {
        rmSync(registryPath, { force: true });
      } catch (e) {
        // Ignore
      }
    }
  });

  afterEach(() => {
    // Clean up after tests
    if (existsSync(registryPath)) {
      try {
        rmSync(registryPath, { force: true });
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
    expect(community.some((c) => c.name === 'go')).toBe(true);
    expect(community.some((c) => c.name === 'rust')).toBe(true);
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
