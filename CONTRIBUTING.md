# Contributing to Codexa

Thanks for contributing to Codexa.

## Development Setup

```bash
git clone https://github.com/your-org/codexa.git
cd codexa
npm install
npm test
node ./bin/codexa.js init
```

## Project Structure Overview

src/commands contains CLI command handlers and user-facing terminal output. Keep commands thin and delegate business logic to dedicated modules.

src/core contains lint orchestration, classification, schema, and blame-aware run flow. This is the main quality pipeline and should stay deterministic.

src/git contains git integration such as staged diff retrieval and pre-commit hook lifecycle. Keep shell interactions bounded and failure messages actionable.

src/ai contains Ollama integration, prompts, and caching for AI suggestions. This layer must gracefully degrade when Ollama is unavailable.

src/learning contains learned history and pattern matching helpers used to prioritize recurring fixes over time.

src/plugins contains adapter contracts, dynamic loading, and registry management for built-in and community language support.

src/profiles contains built-in lint profiles (JavaScript and Python). Each profile should return normalized schema errors only.

src/tui contains Ink rendering and interaction behavior for check/fix workflows.

src/solo contains local analytics (streaks, trends, digest) for individual developer reporting.

src/team contains team analytics, CI payload shaping, dashboards, badges, and hotspot modeling.

## Running Tests

```bash
vitest run
vitest --watch
vitest run tests/config.test.js
```

All tests must pass before opening a pull request.

## Adding a Language Adapter

- Read [docs/plugin-authoring.md](./docs/plugin-authoring.md)
- Start from [templates/adapter-template/](./templates/adapter-template/)
- Publish as codexa-adapter-<language>
- Open a PR to list the adapter in the community registry

## Pull Request Process

1. Branch naming: use prefixes like feat/, fix/, docs/, refactor/, test/.
2. Commit message format: Conventional Commits (for example: fix(init): improve demo step output).
3. Required checks: all tests pass and no regression in command behavior.
4. Dependencies: do not add new dependencies without prior discussion in issue/discussion.

## Code Style

- ESM only.
- No TypeScript in src/.
- Use createError() for normalized lint errors.
- Use async/await for all I/O paths.
- No mutable global state.

## Community

- Use GitHub Discussions for questions and design conversations.
- Use Issues for confirmed bugs and actionable feature requests only.
