import { describe, it, expect, beforeEach } from 'vitest';
import { writeFileSync, mkdirSync, rmSync } from 'fs';
import { resolve } from 'path';
import os from 'os';
import jsAdapter from '../src/plugins/adapters/javascript.js';
import pyAdapter from '../src/plugins/adapters/python.js';

describe('Built-in Adapters', () => {
  let testDir;

  beforeEach(() => {
    testDir = resolve(os.tmpdir(), `codexa-adapter-test-${Date.now()}`);
    mkdirSync(testDir, { recursive: true });
  });

  afterEach(() => {
    try {
      rmSync(testDir, { recursive: true, force: true });
    } catch (e) {
      // Ignore cleanup errors
    }
  });

  // JavaScript Adapter Tests
  describe('JavaScript Adapter', () => {
    it('detect returns true when package.json exists', async () => {
      writeFileSync(resolve(testDir, 'package.json'), '{}', 'utf8');
      const result = await jsAdapter.detect(testDir);
      expect(result).toBe(true);
    });

    it('detect returns true when .ts files exist', async () => {
      writeFileSync(resolve(testDir, 'test.ts'), 'let x: number = 1;', 'utf8');
      const result = await jsAdapter.detect(testDir);
      expect(result).toBe(true);
    });

    it('detect returns false on error (never throws)', async () => {
      const result = await jsAdapter.detect('/nonexistent/path/12345');
      expect(result).toBe(false);
    });

    it('lint returns empty array for empty files', async () => {
      const result = await jsAdapter.lint([], {});
      expect(result).toEqual([]);
    });

    it('lint returns normalized error objects', async () => {
      // Create a JS file with intentional error
      const jsFile = resolve(testDir, 'test.js');
      writeFileSync(jsFile, 'var x = 1;', 'utf8');

      const result = await jsAdapter.lint([jsFile], {});
      expect(Array.isArray(result)).toBe(true);
      // Errors should have standard Codexa fields
      if (result.length > 0) {
        expect(result[0]).toHaveProperty('file');
        expect(result[0]).toHaveProperty('line');
        expect(result[0]).toHaveProperty('rule');
      }
    });

    it('fix returns valid FixResult shape', async () => {
      const result = await jsAdapter.fix(
        resolve(testDir, 'test.js'),
        'no-var',
        {}
      );
      expect(result).toHaveProperty('success');
      expect(result).toHaveProperty('diff');
      expect(result).toHaveProperty('message');
    });
  });

  // Python Adapter Tests
  describe('Python Adapter', () => {
    it('detect returns true when .py files exist', async () => {
      writeFileSync(resolve(testDir, 'test.py'), 'x = 1', 'utf8');
      const result = await pyAdapter.detect(testDir);
      expect(result).toBe(true);
    });

    it('detect returns true when pyproject.toml exists', async () => {
      writeFileSync(
        resolve(testDir, 'pyproject.toml'),
        '[tool.poetry]',
        'utf8'
      );
      const result = await pyAdapter.detect(testDir);
      expect(result).toBe(true);
    });

    it('detect returns true when requirements.txt exists', async () => {
      writeFileSync(resolve(testDir, 'requirements.txt'), 'django==3.0', 'utf8');
      const result = await pyAdapter.detect(testDir);
      expect(result).toBe(true);
    });

    it('detect returns false on error (never throws)', async () => {
      const result = await pyAdapter.detect('/nonexistent/path/67890');
      expect(result).toBe(false);
    });

    it('lint returns empty array for empty files', async () => {
      const result = await pyAdapter.lint([], {});
      expect(result).toEqual([]);
    });

    it('fix returns not implemented result', async () => {
      const result = await pyAdapter.fix(resolve(testDir, 'test.py'), 'E501', {});
      expect(result.success).toBe(false);
      expect(result.diff).toBeNull();
      expect(result.message).toContain('No auto-fix available');
    });
  });

  // Adapter Metadata Tests
  describe('Adapter Metadata', () => {
    it('JavaScript adapter has all required metadata', () => {
      expect(jsAdapter.name).toBeDefined();
      expect(jsAdapter.language).toBe('javascript');
      expect(jsAdapter.version).toBeDefined();
      expect(Array.isArray(jsAdapter.extensions)).toBe(true);
      expect(jsAdapter.linter).toBeDefined();
      expect(jsAdapter.license).toBeDefined();
    });

    it('Python adapter has all required metadata', () => {
      expect(pyAdapter.name).toBeDefined();
      expect(pyAdapter.language).toBe('python');
      expect(pyAdapter.version).toBeDefined();
      expect(Array.isArray(pyAdapter.extensions)).toBe(true);
      expect(pyAdapter.linter).toBeDefined();
      expect(pyAdapter.license).toBeDefined();
    });

    it('JavaScript extensions include TypeScript', () => {
      expect(jsAdapter.extensions).toContain('.ts');
      expect(jsAdapter.extensions).toContain('.tsx');
    });

    it('Python extensions are correct', () => {
      expect(pyAdapter.extensions).toContain('.py');
      expect(pyAdapter.extensions).toContain('.pyi');
    });
  });
});
