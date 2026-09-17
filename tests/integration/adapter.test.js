import { describe, expect, it } from 'vitest';
import { loadAdapter } from '../../src/plugins/loader.js';
import { validateAdapter } from '../../src/plugins/interface.js';
import { join, resolve } from 'path';
import { fileURLToPath } from 'url';

const fixture = resolve(fileURLToPath(new URL('../fixtures/community-adapter', import.meta.url)));

describe('community adapter integration', () => {
  it('loads, detects, lints, and exposes the fix contract', async () => {
    const adapter = await loadAdapter(fixture);
    expect(adapter.language).toBe('fixture');
    expect(await adapter.detect('/tmp')).toBe(true);
    expect(await adapter.lint([join('/tmp', 'sample.fixture')])).toEqual([]);
    await expect(adapter.fix('/tmp/sample.fixture', 'FIXTURE')).resolves.toMatchObject({
      success: false,
      diff: null,
    });
  });

  it('rejects malformed adapters with missing required methods', () => {
    const result = validateAdapter({
      name: 'broken',
      language: 'broken',
      extensions: ['.broken'],
    });
    expect(result.valid).toBe(false);
    expect(result.errors).toEqual(expect.arrayContaining([
      'adapter.detect must be a function',
      'adapter.lint must be a function',
      'adapter.fix must be a function',
    ]));
  });
});
