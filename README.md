# CODEXA

![Codexa Logo Placeholder](docs/assets/logo-placeholder.svg)

AI pre-commit guardian. Blame-aware. Auto-fix. Learns your codebase.

[![npm version](https://img.shields.io/npm/v/codexa?style=flat&color=00E5A0)](https://www.npmjs.com/package/codexa)
[![License: MIT](https://img.shields.io/badge/license-MIT-00E5A0)](./LICENSE)
[![Node.js >=18](https://img.shields.io/badge/node-%3E%3D18-00E5A0)](https://nodejs.org/en/)
[![Codexa Health](https://img.shields.io/badge/codexa-clean-00E5A0)](./docs/ci-integration.md)

<!-- Add terminal demo GIF here -->

Record with VHS or asciinema and convert to GIF.
Recommended flow: codexa init -> git commit -> TUI -> [x] fix -> clean commit.

## Why Codexa

- Blame-aware: only your errors block commits. Pre-existing issues are visible, never blocking.
- Auto-fix: one keypress applies applicable fixes. Fewer context switches, fewer bypasses.
- Learns: .codexa/patterns.json remembers accepted fixes and prioritizes them next time.

## Quick Start - Solo

```bash
npm install -g codexa
cd your-project
codexa init
git add . && git commit -m "first protected commit"
```

## Quick Start - Team

```bash
# Each contributor
npm install -g codexa

# Team lead (one time)
codexa config init --team
git add codexa.config.json .codexaignore
git commit -m "add codexa team config"

# Team members
codexa init
```

## Features

| Feature | Solo | Team |
| --- | --- | --- |
| Blame-aware linting | Y | Y |
| Interactive TUI | Y | Y |
| Auto-fix [x] | Y | Y |
| AI suggestions (Ollama) | Y | Y |
| .codexa/ learning folder | Y | Y (shared) |
| Clean commit streak | Y | - |
| codexa report + sparklines | Y | - |
| Weekly digest | Y | - |
| Shared team config | - | Y |
| GitHub Actions CI | - | Y |
| Team dashboard | - | Y |
| Hotspot detection | - | Y |
| Plugin system | Y | Y |

## Supported Languages

- Built-in: JavaScript, TypeScript, Python
- Community adapters:

```bash
codexa add-language codexa-adapter-go
```

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

## Requirements

- Node.js >= 18
- Git >= 2.0
- Python + ruff (for Python repos)
- Ollama (optional, for AI suggestions)

## Contributing

- Contribution guide: [CONTRIBUTING.md](./CONTRIBUTING.md)
- Adapter template: [templates/adapter-template/](./templates/adapter-template/)
- Plugin authoring docs: [docs/plugin-authoring.md](./docs/plugin-authoring.md)

## License

MIT
