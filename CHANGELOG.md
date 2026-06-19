# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project follows [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.1.0]

### Added
- `codexa uninstall` command to completely remove Codexa from a repository.
- `codexa doctor` command to check environment health and dependencies.
- `codexa fix <loc>` command to programmatically trigger fixes.
- `team.blockThreshold` config to customize strict blocking behavior.
- SARIF format support for CI output (`ci.outputFormat = "sarif"`).
- `ai.enabled` configuration toggle to disable Ollama/AI probing.

### Changed
- ESLint integration now shares a single process-cached instance for massive speedups.
- CLI output replaces interactive React/Ink TUI with pure terminal text.
- TypeScript parsing is now active by default in all projects.
- `codexa explain` explicitly gates behind the `ai.enabled` config.

### Fixed
- Fixed JS adapter crashes on browser globals by integrating `globals` package.
- Fixed severe JS parse errors being swallowed; they are now logged as MODERATE blocking errors.
- Fixed atomic writing bug in `src/team/summary.js`.

### Removed
- Removed heavy TUI dependencies (`react`, `ink`, `@inkjs/ui`).
