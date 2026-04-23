# Configuration Reference

Complete field-by-field guide for codexa.config.json.

## Example Config

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
      "prefer-const": "MINOR"
    }
  },
  "ignore": ["node_modules", "dist", "build"],
  "team": {
    "name": "Engineering",
    "enforceOnCI": true,
    "blockThreshold": 1,
    "allowForceCommit": true,
    "forceCommitRequiresReason": true,
    "hotspotThreshold": 5,
    "weeklyReport": true,
    "leaderboard": {
      "enabled": true,
      "metrics": ["clean_commits", "fixes_accepted", "streak"],
      "optIn": true
    }
  },
  "ci": {
    "outputFormat": "json",
    "postPRComment": true,
    "failOn": "CRITICAL",
    "badge": true
  }
}
```

## Field Reference

### version

- Type: number
- Default: 2
- Allowed values: schema integer supported by current CLI
- What it does: Identifies config schema generation so Codexa can validate compatibility and apply default merging safely. Keep this aligned with the CLI's expected schema value when editing manually.
- Example:

```json
{ "version": 2 }
```

### blameMode

- Type: string
- Default: strict
- Allowed values: strict, warn, off
- What it does: Controls blame-aware commit blocking behavior. strict blocks only newly introduced issues; warn keeps blame analysis but softens enforcement; off treats all issues uniformly.
- Example:

```json
{ "blameMode": "strict" }
```

### languages

- Type: string[]
- Default: ["auto"]
- Allowed values: auto and installed adapter language ids
- What it does: Limits which adapters participate in lint runs. Use explicit language ids to stabilize behavior in polyglot repositories or CI.
- Example:

```json
{ "languages": ["javascript", "python"] }
```

### severity.block

- Type: string[]
- Default: ["CRITICAL"]
- Allowed values: CRITICAL, MODERATE, MINOR
- What it does: Defines severities that should block commit/CI pass conditions. Include more levels to increase strictness.
- Example:

```json
{ "severity": { "block": ["CRITICAL", "MODERATE"] } }
```

### severity.warn

- Type: string[]
- Default: ["MODERATE"]
- Allowed values: CRITICAL, MODERATE, MINOR
- What it does: Marks severities surfaced as warnings in report channels and TUI context panels. This helps teams highlight noisy-but-important findings.
- Example:

```json
{ "severity": { "warn": ["MODERATE"] } }
```

### severity.log

- Type: string[]
- Default: ["MINOR"]
- Allowed values: CRITICAL, MODERATE, MINOR
- What it does: Sets informational severities that should still be logged for trend tracking without blocking. Useful for observability and quality coaching.
- Example:

```json
{ "severity": { "log": ["MINOR"] } }
```

### severity.overrides

- Type: object (rule -> severity)
- Default: {}
- Allowed values: each value must be CRITICAL, MODERATE, or MINOR
- What it does: Overrides default rule severities for repository-specific policy. Use this to tune noisy rules down or elevate risky patterns up.
- Example:

```json
{ "severity": { "overrides": { "no-debugger": "CRITICAL" } } }
```

### ignore

- Type: string[]
- Default: ["node_modules", ".git", "dist", "build", "__pycache__", "*.min.js", "migrations/"]
- Allowed values: path patterns and globs
- What it does: Excludes files and directories from linting and analysis. Combine with .codexaignore for repo-local filter control.
- Example:

```json
{ "ignore": ["dist", "coverage", "generated/"] }
```

### team.name

- Type: string
- Default: Engineering
- Allowed values: any non-empty string
- What it does: Labels reports, dashboards, and team-facing output. Use a stable team name for readable CI and analytics artifacts.
- Example:

```json
{ "team": { "name": "Platform" } }
```

### team.enforceOnCI

- Type: boolean
- Default: true
- Allowed values: true, false
- What it does: Indicates whether CI should enforce Codexa policy as a merge gate. Teams can disable this temporarily during staged rollout.
- Example:

```json
{ "team": { "enforceOnCI": true } }
```

### team.blockThreshold

- Type: number
- Default: 1
- Allowed values: positive integer
- What it does: Sets how many blocking findings are allowed before the run is considered failed. Increase only when intentionally softening strict enforcement.
- Example:

```json
{ "team": { "blockThreshold": 1 } }
```

### team.allowForceCommit

- Type: boolean
- Default: true
- Allowed values: true, false
- What it does: Controls whether force-commit escape hatches are allowed by team policy. Disable for strict compliance repositories.
- Example:

```json
{ "team": { "allowForceCommit": false } }
```

### team.forceCommitRequiresReason

- Type: boolean
- Default: true
- Allowed values: true, false
- What it does: Requires explicit rationale metadata when force-commit is used. This improves auditability and helps review policy exceptions.
- Example:

```json
{ "team": { "forceCommitRequiresReason": true } }
```

### team.hotspotThreshold

- Type: number
- Default: 5
- Allowed values: positive integer
- What it does: Minimum repeated error count for a file/rule to be marked as hotspot in team dashboard output. Tune to reduce noise in large monorepos.
- Example:

```json
{ "team": { "hotspotThreshold": 7 } }
```

### team.weeklyReport

- Type: boolean
- Default: true
- Allowed values: true, false
- What it does: Enables weekly summary output generation for team quality trends. Disable for repos with alternative analytics pipelines.
- Example:

```json
{ "team": { "weeklyReport": true } }
```

### team.leaderboard.enabled

- Type: boolean
- Default: true
- Allowed values: true, false
- What it does: Toggles leaderboard sections in dashboards and report exports. Disable if leaderboard ranking is not desired in your culture.
- Example:

```json
{ "team": { "leaderboard": { "enabled": true } } }
```

### team.leaderboard.metrics

- Type: string[]
- Default: ["clean_commits", "fixes_accepted", "streak"]
- Allowed values: clean_commits, fixes_accepted, streak, quality_score
- What it does: Chooses metrics used for ranking contributors in leaderboard views. Pick values that align with your team's quality goals.
- Example:

```json
{ "team": { "leaderboard": { "metrics": ["quality_score", "streak"] } } }
```

### team.leaderboard.optIn

- Type: boolean
- Default: true
- Allowed values: true, false
- What it does: Requires contributor opt-in before appearing in leaderboard sections. Useful for privacy-forward or coaching-focused teams.
- Example:

```json
{ "team": { "leaderboard": { "optIn": true } } }
```

### ci.outputFormat

- Type: string
- Default: json
- Allowed values: json, sarif
- What it does: Selects CI serialization format for machine consumers. Use sarif when integrating with platforms expecting standardized security reports.
- Example:

```json
{ "ci": { "outputFormat": "json" } }
```

### ci.postPRComment

- Type: boolean
- Default: true
- Allowed values: true, false
- What it does: Enables posting summary feedback in pull request flows when your CI integration supports it. Disable if your org prohibits bot comments.
- Example:

```json
{ "ci": { "postPRComment": true } }
```

### ci.failOn

- Type: string
- Default: CRITICAL
- Allowed values: CRITICAL, MODERATE, any
- What it does: Defines the minimum severity that should fail CI. any is strictest and fails when any issue is present.
- Example:

```json
{ "ci": { "failOn": "MODERATE" } }
```

### ci.badge

- Type: boolean
- Default: true
- Allowed values: true, false
- What it does: Includes a Codexa badge URL payload in CI output for README/status surfaces. Disable when your CI output should remain minimal.
- Example:

```json
{ "ci": { "badge": true } }
```
```json
{
  "ci": {
    "outputFormat": "json"
  }
}
```

---

### `ci.postPRComment`

**Type**: `boolean`

**Default**: `true`

**Description**
If `true`, Codexa posts a comment on PRs with check results. Requires GitHub Actions configuration.

**Example**
```json
{
  "ci": {
    "postPRComment": true
  }
}
```

---

### `ci.failOn`

**Type**: `string`

**Default**: `"CRITICAL"`

**Allowed Values**: `"CRITICAL"` | `"MODERATE"` | `"any"`

**Description**
CI build fails if errors at or above this severity level are found.

**Example**
```json
{
  "ci": {
    "failOn": "CRITICAL"
  }
}
```

---

### `ci.badge`

**Type**: `boolean`

**Default**: `true`

**Description**
If `true`, Codexa generates a quality badge for README.md.

**Example**
```json
{
  "ci": {
    "badge": true
  }
}
```

---

## Complete Example

```json
{
  "version": "1.0.0",
  "blameMode": "strict",
  "languages": ["javascript", "python"],
  "severity": {
    "block": "CRITICAL",
    "warn": "MODERATE",
    "log": "MINOR",
    "overrides": {
      "prefer-const": "MINOR",
      "no-debugger": "CRITICAL"
    }
  },
  "ignore": [
    "node_modules/",
    "dist/",
    "*.min.js",
    "src/legacy/"
  ],
  "team": {
    "name": "Engineering Team",
    "enforceOnCI": true,
    "blockThreshold": 0,
    "allowForceCommit": false,
    "forceCommitRequiresReason": true,
    "hotspotThreshold": 5,
    "weeklyReport": true,
    "leaderboard": {
      "enabled": true,
      "metrics": ["clean_commits", "fixes_accepted", "streak"],
      "optIn": true
    }
  },
  "ci": {
    "outputFormat": "json",
    "postPRComment": true,
    "failOn": "CRITICAL",
    "badge": true
  }
}
```
