# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project follows [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.1.4] - 2026-09-18

### Fixed

- **Baseline fingerprinting**: Use `path.relative()` instead of string slicing to correctly compute relative file paths across all platforms, including Windows drive letters.
- **Baseline integrity**: Added corrupted baseline file detection with clear error messaging; baseline update now refuses to save when adapter failures are present during initialization.
- **Baseline filtering**: Fixed `filterBaselineFindings` to preserve warnings and minor findings when they match the baseline, and correctly move baseline findings into the `preexisting` category.
- **Linter runner**: Added adapter failure policy support (`fail`, `warn`, `ignore`); added 30-second adapter lint timeout; adapter failures now filter by the configured language selection.
- **Init command**: Fixed exit handling to use `process.exitCode` instead of `process.exit(1)`; added `--team`/`--no-team` flags; cleanup incomplete initialization by removing hooks and baseline files when scan fails; improved adapter failure reporting during initialization.
- **Uninstall command**: Added retry logic (`maxRetries: 3`, `retryDelay: 100ms`) to file deletions for robustness on Windows and busy filesystems.
- **Git hooks**: Fixed hook installation to preserve existing non-Codexa hooks with backup; added idempotent check to skip re-installation when a Codexa hook already exists; added `unlinkSync` import for hook cleanup.
- **CI mode**: Fixed `--all-files` default behavior and added `--staged` flag; improved CI verification step to test blocking on new findings and validate JSON output structure.
- **Cross-platform**: Fixed Windows drive letter case normalization in `relativeRepositoryPath`; resolved platform smoke test failures on Windows and macOS.
- **CI/CD pipeline**: Fixed workflow issues preventing Windows integration and platform smoke tests from passing.
- **Testing**: Fixed failing test cases and resolved Node.js integration test issues.
- **Homebrew formula**: Updated SHA256 checksum for the published tarball.

### Changed

- Updated `vitest` devDependency from `3.1.4` to `^3.2.7` for improved test runner stability.
- Updated documentation with comprehensive feature list matching implemented functionality.

## [1.1.3]

### Fixed
- Load the documented JSON configuration and preserve legacy baselines during fingerprint upgrades.
- Correct analytics database access, portable SARIF paths, CLI digest wiring, and recursive language detection.
- Correct the GitHub Actions template to install `codexa-toolkit` and honor `ci.postPRComment`.

## [1.1.2]

### Changed
- Consolidate the mainline implementation into the next release after the divergent `v1.1.2` tag.
- Include team summaries, baseline management, CI/SARIF output, and adapter registry improvements.

## [1.1.0]

### Added
- `codexa uninstall` command to completely remove Codexa from a repository.
- `codexa doctor` command to check environment health and dependencies.
- `codexa fix <loc>` command to programmatically trigger fixes.
- `team.blockThreshold` config to customize strict blocking behavior.
- SARIF format support for CI output (`ci.outputFormat = "sarif"`).

### Changed
- ESLint integration now shares a single process-cached instance for massive speedups.
- CLI output replaces interactive React/Ink TUI with pure terminal text.
- TypeScript parsing is now active by default in all projects.

### Fixed
- Fixed JS adapter crashes on browser globals by enabling browser globals in the ESLint configuration.
- Fixed severe JS parse errors being swallowed; they are now logged as MODERATE blocking errors.
- Fixed atomic writing bug in `src/team/summary.js`.

### Removed
- Removed heavy TUI dependencies (`react`, `ink`, `@inkjs/ui`).
