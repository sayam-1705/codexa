# CODEXA

<p>
  <img src="landing/public/favicon.svg" width="40" height="40" alt="Codexa Logo" align="center">
  <strong>CODEXA</strong>
</p>

Blame-aware pre-commit guardian for code quality. Codexa establishes a clean baseline first, then blocks newly introduced issues in staged changes.

[![npm version](https://img.shields.io/npm/v/codexa-toolkit?style=flat&color=00E5A0)](https://www.npmjs.com/package/codexa-toolkit)
[![License: MIT](https://img.shields.io/badge/license-MIT-00E5A0)](./LICENSE)
[![Node.js >=18](https://img.shields.io/badge/node-%3E%3D18-00E5A0)](https://nodejs.org/en/)
[![Codexa Health](https://img.shields.io/badge/codexa-clean-00E5A0)](./docs/ci-integration.md)

<!-- Add terminal demo GIF here -->

## Two-phase workflow

`codexa init` scans every supported file in the repository. Existing findings are reported and the baseline remains **not ready** until the scan is clean. Only then does Codexa write `.codexa/baseline.json` and enable incremental enforcement.

After initialization, `codexa check` evaluates the staged Git index snapshot, not unstaged working-tree edits. Findings already represented by the baseline remain historical context and do not block unrelated changes; new findings still go through configured policy.

## Why Codexa

- Blame-aware: only your errors block commits. Pre-existing issues are visible, never blocking.
- Auto-fix: codexa fix command applies applicable fixes. Fewer context switches, fewer bypasses.
- Deterministic: findings are normalized, fingerprinted, sorted, and emitted through the same policy path for local and CI checks.

## Quick Start - Solo

```bash
npm install -g codexa-toolkit
cd your-project
codexa init
# Resolve all reported issues, then verify the clean baseline.
codexa init
git add . && git commit -m "first protected commit"

# Daily workflow
git add path/to/changed-file.js
codexa check
git commit -m "change"

# Explicitly accept a reviewed set of findings as the new baseline.
codexa baseline update
```

## Quick Start - Team

```bash
# Each contributor
npm install -g codexa-toolkit

# Team lead (one time)
codexa config init --team
git add codexa.config.json .codexaignore
git commit -m "add codexa team config"

# Team members
codexa init
```

## Features

| Feature                    | Solo | Team       |
| -------------------------- | ---- | ---------- |
| Blame-aware linting        | Y    | Y          |
| Auto-fix                   | Y    | Y          |
| Code quality enforcement   | Y    | Y          |
| .codexa/ learning folder   | Y    | Y (shared) |
| Clean commit streak        | Y    | -          |
| codexa report + sparklines | Y    | -          |
| Weekly digest              | Y    | -          |
| Shared team config         | -    | Y          |
| GitHub Actions CI          | -    | Y          |
| Team dashboard             | -    | Y          |
| Hotspot detection          | -    | Y          |
| Plugin system              | Y    | Y          |

## Supported Languages

- Built-in: JavaScript, TypeScript, Python
- Planned community adapters (not published on npm yet): Go, Rust, Ruby, and Java. Use the [adapter authoring guide](./docs/plugin-authoring.md) to create or publish one.

Codexa can install any published package that implements the adapter interface:

```bash
codexa add-language <published-adapter-package>
```

Python linting is supported, but its adapter does not provide automatic fixes; `codexa fix` reports those cases without changing files.

## Configuration

Minimal codexa.config.json:

```json
{
  "version": 2,
  "blameMode": "strict",
  "languages": ["auto"],
  "severity": {
    "block": ["CRITICAL"],
    "warn": ["MODERATE"],
    "log": ["MINOR"],
    "overrides": {
      "no-console": "MODERATE"
    }
  },
  "ignore": ["dist", "build", "node_modules"],
  "team": {
    "name": "Engineering",
    "enforceOnCI": true,
    "blockThreshold": 1
  },
  "ci": {
    "outputFormat": "json",
    "failOn": "CRITICAL",
    "badge": true
  }
}
```

Full reference: [docs/configuration.md](./docs/configuration.md)

## `.codexaignore`

Codexa combines Git's built-in exclusions with repository-local `.codexaignore` patterns. Patterns are root-relative, support `*` globs, and are applied after built-in exclusions. Ignored files are not discovered during the initial scan or incremental checks.

## Hooks, fixes, and CI

`codexa init` resolves the active hook directory through Git, including `core.hooksPath` and worktrees. Existing `pre-commit` hooks are preserved and run before Codexa; uninstall restores them. Autofixes operate on working-tree files and must be staged again before commit. CI uses the same normalized findings and policy, and supports JSON and SARIF output.

## Development

```bash
npm install
npm test
npm run lint
```

## Requirements

- Node.js >= 18
- Git >= 2.0
- Python + ruff (for Python repos)

## Contributing

- Contribution guide: [CONTRIBUTING.md](./CONTRIBUTING.md)
- Adapter template: [templates/adapter-template/](./templates/adapter-template/)
- Plugin authoring docs: [docs/plugin-authoring.md](./docs/plugin-authoring.md)

## License

MIT
