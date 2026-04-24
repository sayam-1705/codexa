# Team Setup

End-to-end onboarding for team usage.

## 1. Team Lead Bootstrap

```bash
npm install -g codexa-toolkit
codexa config init --team
git add codexa.config.json .codexaignore
git commit -m "chore(codexa): add team policy"
```

## 2. Enforce in CI

Add Codexa workflow and set required checks in branch protection.

## 3. Contributor Onboarding

```bash
npm install -g codexa-toolkit
codexa init
```

Contributors inherit team config from repository files.

## 4. Team Reporting

Use dashboard/report commands in CI or local review:

```bash
codexa dashboard
codexa report --days 14
```

## 5. Policy Recommendations

- Keep `blameMode` on strict.
- Start with `ci.failOn` = CRITICAL for smoother adoption.
- Raise to MODERATE once the baseline stabilizes.
