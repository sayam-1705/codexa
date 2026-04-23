# Blame Mode

Blame mode decides which issues can block a commit.

## Modes

- strict: only issues introduced in changed lines can block.
- warn: all issues are shown, but pre-existing issues are warnings.
- off: blame separation is disabled; all issues are treated the same.

## Example

Scenario:

- Line 20 already had no-unused-vars before your branch.
- You changed line 45 and introduced prefer-const.

With strict mode:

- Line 20 issue is pre-existing and non-blocking.
- Line 45 issue is yours and can block.

With warn mode:

- Both issues are shown.
- Only your configured block severities fail commit/CI.

With off mode:

- Both are treated equally with no blame separation.

## Config

```json
{
  "blameMode": "strict"
}
```

## Recommended Team Policy

1. Start with strict.
2. Use warn only for temporary rollout phases.
3. Avoid off unless you intentionally want classic linter behavior.
