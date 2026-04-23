# CLI Reference

Complete command reference for Codexa v1.0.0.

## Global Options

Usage:

```bash
codexa <command> [options]
```

Options:

- `-v, --version` (boolean, default: `false`) Print Codexa version, Node.js version, adapter list, and Ollama status.
- `-h, --help` (boolean, default: `false`) Print command index and links to docs/issues.

Exit codes:

- `0` Success.
- `1` Invalid command, invalid arguments, or runtime failure.

## codexa init

Usage:

```bash
codexa init
codexa init --team
```

Description:

Initializes Codexa in the current git repository with a first-run sequence. It detects supported languages, creates config, installs the pre-commit hook, and runs a non-blocking demo check on the last commit.

Flags:

- `--team` (boolean, default: `true` when run from current implementation) Generate team-oriented defaults.

Examples:

```bash
codexa init
codexa init --team
```

Exit codes:

- `0` Initialization completed.
- `1` Not a git repository or a fatal setup error occurred.

## codexa check

Usage:

```bash
codexa check
codexa check --ci --base <branch> --all-files --output <fmt>
```

Description:

Runs lint checks on staged files by default and opens the interactive TUI in terminal mode. In CI mode it emits machine-readable output and returns a status code according to configured thresholds.

Flags:

- `--ci` (boolean, default: `false`) Force CI mode.
- `--base <branch>` (string, default: unset) Compare against a base branch when combined with CI/all-files workflows.
- `--all-files` (boolean, default: `false`) Check all supported files.
- `--output <fmt>` (string, default: `json`) CI output format hint (`json | text`).

Examples:

```bash
codexa check
codexa check --ci --base main
```

Exit codes:

- `0` No blocking conditions met.
- `1` Blocking thresholds were met or runtime failed.

## codexa explain <file>:<line>

Usage:

```bash
codexa explain <file>:<line>
```

Description:

Explains an issue at a specific source location and can include AI-assisted context when Ollama is available. Use this command to understand why a rule triggered and how to resolve it.

Flags:

- No command-specific flags.

Examples:

```bash
codexa explain src/auth.ts:32
codexa explain src/utils.py:18
```

Exit codes:

- `0` Explanation generated.
- `1` Invalid location or command/runtime error.

## codexa history

Usage:

```bash
codexa history
codexa history --days <n> --limit <n>
```

Description:

Shows previously accepted fixes and learned patterns used by Codexa's recommendation engine. Useful for reviewing repeated issues and team conventions.

Flags:

- `--days <n>` (number, default: `30`) Look-back window.
- `--limit <n>` (number, default: `20`) Maximum entries shown.

Examples:

```bash
codexa history
codexa history --days 14 --limit 50
```

Exit codes:

- `0` History loaded and displayed.
- `1` No history or runtime failure.

## codexa report

Usage:

```bash
codexa report
codexa report --days <n> --html
```

Description:

Prints trend analytics for solo workflows, including severity breakdowns and streak context. Use HTML mode when sharing report output outside the terminal.

Flags:

- `--days <number>` (number, default: `30`) Trend window in days.
- `--html` (boolean, default: `false`) Generate an HTML report artifact.

Examples:

```bash
codexa report
codexa report --days 7 --html
```

Exit codes:

- `0` Report generated.
- `1` Runtime/database error.

## codexa stats

Usage:

```bash
codexa stats
codexa stats --json
```

Description:

Displays lifetime quality metrics, trend signal, streak data, and recurring rule frequencies. This is the high-level personal KPI view for solo usage.

Flags:

- `--json` (boolean, default: `false`) Emit raw JSON stats.

Examples:

```bash
codexa stats
codexa stats --json
```

Exit codes:

- `0` Stats generated.
- `1` Runtime/database error.

## codexa config validate

Usage:

```bash
codexa config validate
```

Description:

Validates codexa.config.json against the active schema and semantic rules. It prints specific field failures and suggested correction paths.

Flags:

- No command-specific flags.

Examples:

```bash
codexa config validate
codexa config validate && echo "config ok"
```

Exit codes:

- `0` Config is valid.
- `1` Config is invalid or unreadable.

## codexa config show

Usage:

```bash
codexa config show
codexa config show --json
```

Description:

Prints the effective configuration currently applied in this repository. Helpful for debugging merged defaults and confirming CI/team behavior.

Flags:

- `--json` (boolean, default: `true` in current output) JSON output mode.

Examples:

```bash
codexa config show
codexa config show --json
```

Exit codes:

- `0` Config printed.
- `1` Config load failed.

## codexa config init

Usage:

```bash
codexa config init
codexa config init --team
```

Description:

Creates a fresh codexa.config.json and optional .codexaignore defaults for shared repositories. Use this when bootstrapping a team repo before first commit policy enforcement.

Flags:

- `--team` (boolean, default: `false` when omitted) Create team-focused defaults.
- `--force` (boolean, default: `false`) Overwrite existing config (if supported by current command path).

Examples:

```bash
codexa config init --team
codexa config init --team --force
```

Exit codes:

- `0` Config initialized or already valid for usage.
- `1` Write failure or invalid environment.

## codexa config set

Usage:

```bash
codexa config set <key> <value>
```

Description:

Updates a single configuration field using dotted key syntax and validates the full config before persisting. Failed validation does not modify the file.

Flags:

- No command-specific flags.

Examples:

```bash
codexa config set ci.failOn MODERATE
codexa config set team.blockThreshold 2
```

Exit codes:

- `0` Field updated.
- `1` Validation failed or write/load error.

## codexa dashboard

Usage:

```bash
codexa dashboard
codexa dashboard --contributor <name> --top <n> --html
```

Description:

Shows team-level quality data such as contributors, hotspots, and leaderboard trends. Use HTML mode for sharing dashboards in pull request or wiki workflows.

Flags:

- `--contributor <name>` (string, default: unset) Filter view to one contributor.
- `--top <n>` (number, default: `5`) Number of hotspots/rules to show.
- `--html` (boolean, default: `false`) Generate HTML output.

Examples:

```bash
codexa dashboard
codexa dashboard --contributor alice --top 10
```

Exit codes:

- `0` Dashboard rendered.
- `1` Team data unavailable or runtime error.

## codexa add-language

Usage:

```bash
codexa add-language <package>
```

Description:

Installs a community adapter package and registers it in the user adapter registry. The adapter is validated before becoming active.

Flags:

- No command-specific flags.

Examples:

```bash
codexa add-language codexa-adapter-go
codexa add-language codexa-adapter-rust
```

Exit codes:

- `0` Adapter installed and registered.
- `1` npm/install/validation failure.

## codexa list-languages

Usage:

```bash
codexa list-languages
```

Description:

Lists installed adapters and known community adapters that are not installed yet. Use this to verify environment state and available integrations.

Flags:

- No command-specific flags.

Examples:

```bash
codexa list-languages
codexa list-languages | findstr python
```

Exit codes:

- `0` Command completed.
- `1` Registry read failure.

## codexa remove-language

Usage:

```bash
codexa remove-language <name>
```

Description:

Removes a community adapter from the active registry (built-in adapters are protected). This does not uninstall npm packages automatically.

Flags:

- No command-specific flags.

Examples:

```bash
codexa remove-language go
codexa remove-language rust
```

Exit codes:

- `0` Adapter removed.
- `1` Adapter missing, built-in, or registry update failed.

**Description**
Unregisters an adapter from Codexa. Built-in adapters (JavaScript, Python) cannot be removed.

**Examples**
```bash
codexa remove-language codexa-adapter-go
```

**Exit Codes**
- `0` — Success
- `1` — Adapter not found or attempt to remove built-in adapter

---

## Global Options

All commands support:
- `-h, --help` — Show help for the command
- `-v, --version` — Show Codexa version and environment info

**Examples**
```bash
codexa --version
codexa check --help
```

---

## Environment Variables

- `CODEXA_HOME` — Override config directory (default: `~/.codexa`)
- `OLLAMA_HOST` — Override Ollama connection (default: `http://localhost:11434`)
- `NODE_ENV` — Set to `test` to skip some validations
