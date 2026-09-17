# CI Integration

Codexa supports CI mode for pull requests and merge gates. `codexa check --ci` scans the full supported repository even when the checkout has no staged files. Use `--base` to narrow that scan to files changed from a base branch, or `--staged` only when an index snapshot is intentional.

## Basic GitHub Actions Workflow

```yaml
name: codexa
on:
  pull_request:
  push:
    branches: [main]

jobs:
  check:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 20
      - run: npm install -g codexa-toolkit
      - run: codexa check --ci --base main --all-files
```

## Suggested Team Config

```json
{
  "team": {
    "enforceOnCI": true
  },
  "ci": {
    "outputFormat": "json",
    "failOn": "CRITICAL",
    "postPRComment": true,
    "badge": true
  }
}
```

## Exit Behavior

- exit 0: run passed current threshold
- exit 1: threshold failed or runtime failure

## Common Tweaks

- Use `ci.failOn: MODERATE` for stricter CI.
- Use `--base origin/main` in fork-heavy workflows.
- Disable PR comments if your org blocks bot comments.
