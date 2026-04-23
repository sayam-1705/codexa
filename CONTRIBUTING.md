# Contributing

Thanks for contributing to Codexa.

## Setup

```bash
git clone https://github.com/YOUR_USERNAME/codexa
cd codexa
npm install
```

## Running Tests

```bash
npm test
```

You can also run targeted Vitest commands during development:

```bash
vitest run
vitest --watch
vitest run tests/config.test.js
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

## Pull Request Process

1. Fork the repo
2. Create a branch: `git checkout -b feat/your-feature`
3. Commit with conventional commits: `feat: add X`
4. Push and open a PR against `main`
5. Ensure CI passes

All tests must pass before opening a pull request. If your change affects behavior, make sure command flows and CI checks still work as expected.

## Writing a Language Adapter

See [docs/plugin-authoring.md](./docs/plugin-authoring.md)

You can also start from [templates/adapter-template/](./templates/adapter-template/) and publish adapters as `codexa-adapter-<language>`.

## Code Style

- ESM only.
- No TypeScript in src/.
- Use createError() for normalized lint errors.
- Use async/await for all I/O paths.
- No mutable global state.

## Community

- Use GitHub Discussions for questions and design conversations.
- Use Issues for confirmed bugs and actionable feature requests only.
