# Launch Preparation Assets

## Hacker News Show HN Draft

Title:

Show HN: Codexa - pre-commit linter that only blames you for errors you actually wrote

Opening:

Most pre-commit linters punish teams for legacy issues they did not introduce, so people eventually bypass them. Codexa uses blame-aware filtering so only issues in your changed lines block your commit.

What makes it different:

- Blame engine separates newly introduced issues from pre-existing debt.
- Learning folder (`.codexa/`) remembers accepted fixes and reuses patterns.
- AI suggestions run locally through Ollama for offline-friendly workflows.

Technical details:

- Node.js CLI
- Ink TUI
- ESLint and ruff profiles
- Ollama local inference

Call to action:

```bash
npm install -g @codexa/cli
```

GitHub: https://github.com/sayam-1705/codexa

## Dev.to Article Outline

Title:

I built a pre-commit tool that only shows you errors YOU wrote

Sections:

1. The problem with existing pre-commit tools
2. How git blame-awareness works
3. The .codexa/ learning folder
4. Quick demo walkthrough
5. How to install and try it
6. What is coming next (plugin ecosystem)

## Reddit Launch Targets

- r/programming
  - Title: Codexa: pre-commit linting that only blocks issues from lines you changed
- r/webdev
  - Title: Built a blame-aware pre-commit guard for JS/TS projects (Codexa)
- r/Python
  - Title: Codexa now supports Python with blame-aware pre-commit checks
- r/typescript
  - Title: TypeScript pre-commit linting without legacy-noise blocking
- r/devops
  - Title: Codexa CI gating with blame-aware linting and local AI suggestions
