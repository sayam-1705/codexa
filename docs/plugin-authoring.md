# Plugin Authoring Guide

Build language adapters for Codexa.

## Overview

A Codexa adapter is an npm package that implements the `LinterAdapter` interface. Adapters are loaded at runtime and route files to the appropriate linter.

## Getting Started

1. Copy the [adapter template](../templates/adapter-template/)
2. Implement the three required methods: `detect()`, `lint()`, `fix()`
3. Publish to npm as `codexa-adapter-<language>`

## LinterAdapter Interface

All adapters must export a default object with these properties and methods:

### Metadata

```javascript
{
  name: 'Go',                              // Human-friendly name
  language: 'go',                          // Canonical ID (snake_case)
  version: '0.1.0',                        // Adapter version
  extensions: ['.go'],                     // File extensions handled
  linter: 'golangci-lint',                 // Underlying tool name
  license: 'MIT',                          // SPDX license ID
  homepage: 'https://github.com/you/...'   // Optional homepage
}
```

### `detect(repoPath): Promise<boolean>`

**Purpose**: Quickly determine if this adapter applies to the repository.

**Rules**:
- MUST complete in under 200ms
- MUST return `true` or `false` (never throw)
- MUST not recurse deeply (shallow file checks only)
- Used at startup to load only applicable adapters

**Example** (Go):
```javascript
async detect(repoPath) {
  try {
    // Check for go.mod
    if (existsSync(resolve(repoPath, 'go.mod'))) {
      return true;
    }

    // Check for .go files in root
    const entries = readdirSync(repoPath, { withFileTypes: true });
    for (const entry of entries) {
      if (entry.isFile() && entry.name.endsWith('.go')) {
        return true;
      }
    }

    return false;
  } catch (err) {
    return false;  // NEVER throw
  }
}
```

### `lint(files, config): Promise<object[]>`

**Purpose**: Run the underlying linter and convert output to Codexa format.

**Rules**:
- Filter input `files` to your supported extensions
- Return empty array if no matching files
- Use `createError()` to build error objects (required)
- `isInDiff` is ALWAYS `false` here (blame engine sets it later)

**Returns**: Array of error objects from `createError()`

**Example** (Go):
```javascript
async lint(files, config) {
  // Filter to .go files
  const goFiles = files.filter(f => f.endsWith('.go'));

  if (goFiles.length === 0) {
    return [];
  }

  try {
    // Shell out to linter
    const output = execSync(
      `golangci-lint run ${goFiles.join(' ')} --format json`,
      { encoding: 'utf8' }
    );

    const results = JSON.parse(output);

    // Convert to Codexa format
    return results.map(issue => createError({
      file: issue.Filename,
      line: issue.Line,
      col: issue.Column,
      message: issue.Text,
      rule: issue.FromLinter,
      severity: 'MODERATE',
      language: 'go'
    }));
  } catch (err) {
    console.error(`[${this.name}] Lint error: ${err.message}`);
    return [];
  }
}
```

### `fix(file, rule, config): Promise<FixResult>`

**Purpose**: Apply an auto-fix for a specific rule.

**Rules**:
- Return `{ success: false, diff: null, message: '...' }` if not fixable
- Use atomic writes (never corrupt files)
- Re-lint after fixing to confirm it worked

**Returns**: FixResult object
```javascript
{
  success: boolean,      // Was fix applied?
  diff: string | null,   // Description of changes
  message: string        // User-facing message
}
```

**Example** (Go):
```javascript
async fix(file, rule, config) {
  const before = readFileSync(file, 'utf8');

  try {
    // Shell out to gofmt or similar
    execSync(`gofmt -w ${file}`, { stdio: 'pipe' });

    const after = readFileSync(file, 'utf8');
    const changed = before !== after;

    return {
      success: changed,
      diff: changed ? `Applied ${rule}` : null,
      message: changed ? `Fixed ${rule}` : 'No changes needed'
    };
  } catch (err) {
    return {
      success: false,
      diff: null,
      message: `Cannot auto-fix ${rule}: ${err.message}`
    };
  }
}
```

## Error Creation

Import from `codexa-toolkit/schema`:

```javascript
import { createError, SEVERITIES } from 'codexa-toolkit/schema';

const error = createError({
  file: '/path/to/file.go',
  line: 42,
  col: 5,
  message: 'unused variable',
  rule: 'unused',
  severity: SEVERITIES.MODERATE,  // or 'CRITICAL', 'MINOR'
  language: 'go'
});
```

Required fields: `file`, `line`, `col`, `message`, `rule`, `severity`, `language`

Optional fields: `isInDiff` (default false), `blameCategory` (default 'unknown')

## Publishing

1. **Naming**: Package must be named `codexa-adapter-<language>`
   ```json
   {
     "name": "codexa-adapter-go",
     "version": "0.1.0"
   }
   ```

2. **Dependencies**: Declare `codexa-toolkit` as a peer dependency
   ```json
   {
     "peerDependencies": {
       "codexa-toolkit": ">=1.0.0"
     }
   }
   ```

3. **Keywords**: Include in package.json
   ```json
   {
     "keywords": ["codexa", "codexa-adapter", "go"]
   }
   ```

4. **Publish**: `npm publish --access public`

5. **Register**: Create a pull request to add your adapter to the [community registry](../src/plugins/registry.js)

## Example: Complete Adapter

See [templates/adapter-template/](../templates/adapter-template/index.js) for a fully commented example.

## Testing Your Adapter

```javascript
import { describe, it, expect } from 'vitest';
import GoAdapter from './index.js';

describe('Go Adapter', () => {
  it('detects go.mod', async () => {
    const result = await GoAdapter.detect('/path/to/go/project');
    expect(result).toBe(true);
  });

  it('lints go files', async () => {
    const errors = await GoAdapter.lint(['/test.go'], {});
    expect(Array.isArray(errors)).toBe(true);
    for (const error of errors) {
      expect(error).toHaveProperty('file');
      expect(error).toHaveProperty('line');
      expect(Object.isFrozen(error)).toBe(true);
    }
  });
});
```

## Common Pitfalls

- **Throwing in detect()**: Always return false on error, never throw
- **Slow detect()**: Recursing deeply or running subprocesses. Keep it under 200ms
- **Not filtering files**: Lint method must check file extensions
- **Forgetting createError()**: All errors must go through createError for validation
- **Shell injection**: Always quote file paths when shelling out: `cmd ${escapedPath}`

## Getting Help

- Ask in [GitHub Discussions](https://github.com/sayam-1705/codexa/discussions)
- See [cli-reference.md](./cli-reference.md#codexa-add-language--package-) for installation docs
