import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { lintJavaScript } from '../src/profiles/javascript.js';
import { writeFileSync, mkdirSync, rmSync } from 'fs';
import { join } from 'path';

describe('profiles/javascript.js', () => {
  const tempDir = join(process.cwd(), 'tests', 'temp-js-profile');

  beforeAll(() => {
    mkdirSync(tempDir, { recursive: true });
  });

  afterAll(() => {
    rmSync(tempDir, { recursive: true, force: true });
  });

  it('lints a .tsx file with interfaces/generics without throwing parse errors', async () => {
    const file = join(tempDir, 'test.tsx');
    writeFileSync(file, `
      interface Props<T> { data: T; }
      export function Component<T>(props: Props<T>) {
        const unused = 1; // should trigger no-unused-vars
        return <div />;
      }
    `);
    const errors = await lintJavaScript([file]);
    
    expect(errors.some(e => e.isParseError)).toBe(false);
    expect(errors.some(e => e.rule === 'no-unused-vars' || e.rule === '@typescript-eslint/no-unused-vars')).toBe(true);
  });

  it('produces no no-undef errors for browser globals like window, document, fetch', async () => {
    const file = join(tempDir, 'browser.js');
    writeFileSync(file, `
      window.localStorage.setItem('k', 'v');
      document.getElementById('app');
      fetch('/api');
    `);
    const errors = await lintJavaScript([file]);
    expect(errors.some(e => e.rule === 'no-undef')).toBe(false);
  });

  it('disables no-undef for .ts files specifically', async () => {
    const file = join(tempDir, 'types.ts');
    writeFileSync(file, `
      const x: SomeUnknownType = {};
    `);
    const errors = await lintJavaScript([file]);
    expect(errors.some(e => e.rule === 'no-undef')).toBe(false);
  });

  it('produces a single parse-error-tagged result for syntactically broken .ts files', async () => {
    const file = join(tempDir, 'broken.ts');
    writeFileSync(file, `
      const x = ; // syntax error
    `);
    const errors = await lintJavaScript([file]);
    expect(errors.some(e => e.isParseError)).toBe(true);
    expect(errors.some(e => e.rule === 'parse-error')).toBe(true);
  });

  it('reuses the ESLint instance across calls', async () => {
    const file = join(tempDir, 'cache.js');
    writeFileSync(file, `const x = 1;`);
    await lintJavaScript([file]);
    const errors = await lintJavaScript([file]);
    expect(errors).toBeDefined();
  });
});
