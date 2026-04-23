import { describe, it, expect } from 'vitest';
import { validateAdapter } from '../src/plugins/interface.js';

describe('LinterAdapter Interface', () => {
  it('validateAdapter returns valid=true for correctly shaped adapter', () => {
    const adapter = {
      name: 'Test',
      language: 'test',
      version: '1.0.0',
      extensions: ['.test'],
      linter: 'test-linter',
      license: 'MIT',
      detect: async () => true,
      lint: async () => [],
      fix: async () => ({ success: false, diff: null, message: 'N/A' }),
    };

    const result = validateAdapter(adapter);

    expect(result.valid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  it('validateAdapter returns errors when detect is not a function', () => {
    const adapter = {
      name: 'Test',
      language: 'test',
      detect: 'not a function',
      lint: async () => [],
      fix: async () => ({ success: false, diff: null, message: 'N/A' }),
    };

    const result = validateAdapter(adapter);

    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.includes('detect'))).toBe(true);
  });

  it('validateAdapter returns errors when lint is not a function', () => {
    const adapter = {
      name: 'Test',
      language: 'test',
      detect: async () => true,
      lint: null,
      fix: async () => ({ success: false, diff: null, message: 'N/A' }),
    };

    const result = validateAdapter(adapter);

    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.includes('lint'))).toBe(true);
  });

  it('validateAdapter returns errors when fix is not a function', () => {
    const adapter = {
      name: 'Test',
      language: 'test',
      detect: async () => true,
      lint: async () => [],
      fix: 'not a function',
    };

    const result = validateAdapter(adapter);

    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.includes('fix'))).toBe(true);
  });

  it('validateAdapter returns warnings (not errors) when name is missing', () => {
    const adapter = {
      language: 'test',
      detect: async () => true,
      lint: async () => [],
      fix: async () => ({ success: false, diff: null, message: 'N/A' }),
    };

    const result = validateAdapter(adapter);

    expect(result.valid).toBe(true);
    expect(result.warnings.some((w) => w.includes('name'))).toBe(true);
  });

  it('validateAdapter returns warnings when extensions is missing', () => {
    const adapter = {
      name: 'Test',
      language: 'test',
      detect: async () => true,
      lint: async () => [],
      fix: async () => ({ success: false, diff: null, message: 'N/A' }),
    };

    const result = validateAdapter(adapter);

    expect(result.valid).toBe(true);
    expect(result.warnings.some((w) => w.includes('extensions'))).toBe(true);
  });

  it('validateAdapter never throws', () => {
    const badInputs = [
      null,
      undefined,
      {},
      { detect: true },
      { lint: true },
      { fix: true },
      'not an object',
      123,
    ];

    for (const input of badInputs) {
      expect(() => validateAdapter(input)).not.toThrow();
    }
  });

  it('validateAdapter returns valid=false when all three methods missing', () => {
    const adapter = {
      name: 'Test',
      language: 'test',
    };

    const result = validateAdapter(adapter);

    expect(result.valid).toBe(false);
    expect(result.errors.length).toBe(3);
  });
});
