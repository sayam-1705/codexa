# Troubleshooting

Common issues and solutions.

---

## Installation & Setup

### `command not found: codexa`

**Cause**: npm global path not in `$PATH`

**Fix**:
```bash
# Check where npm installs global packages
npm config get prefix

# Add to ~/.bashrc or ~/.zshrc
export PATH="$(npm config get prefix)/bin:$PATH"

# Reload shell
source ~/.bashrc  # or ~/.zshrc
```

---

### `Error: Not a git repository`

**Cause**: Running `codexa init` outside a git repo

**Fix**:
```bash
git init
codexa init
```

---

### `No supported languages detected`

**Cause**: Project uses languages not yet installed (Go, Rust, etc.)

**Fix**:
```bash
# Install adapter for your language
codexa add-language codexa-adapter-go
codexa add-language codexa-adapter-rust

# Then re-run init
codexa init
```

---

## Configuration

### `Config error: version is invalid`

**Cause**: `codexa.config.json` has an invalid schema version

**Fix**:
```bash
# Check current version
codexa config show

# Update to latest
codexa config set version 1.0.0

# Validate
codexa config validate
```

---

### `Error loading team config`

**Cause**: `codexa.config.json` has syntax errors or missing fields

**Fix**:
```bash
# Validate config
codexa config validate

# View config
codexa config show

# Recreate if broken
mv codexa.config.json codexa.config.json.backup
codexa config init --team
```

---

## Linting & Commits

### `Hook failed: linter not found`

**Cause**: Required linter (ESLint, ruff) not installed in the project

**Fix** (JavaScript/TypeScript):
```bash
npm install --save-dev eslint
```

**Fix** (Python):
```bash
pip install ruff
# or
brew install ruff
```

---

### `git commit --no-verify works even though allowForceCommit is false`

**Cause**: Pre-commit hook not installed or disabled

**Fix**:
```bash
# Reinstall hook
codexa init

# Check hook exists
cat .git/hooks/pre-commit

# Make executable
chmod +x .git/hooks/pre-commit
```

---

### `TUI not rendering (stuck spinner)`

**Cause**: Terminal doesn't support interactive output (e.g., in CI)

**Fix**: Codexa automatically switches to JSON output when `stdout` is not a TTY. If you're seeing this locally:
```bash
# Check if stdout is a TTY
[[ -t 1 ]] && echo "TTY" || echo "Not TTY"

# Force CI mode
codexa check --ci
```

---

## AI Suggestions

### `Cannot connect to Ollama at localhost:11434`

**Cause**: Ollama service not running

**Fix**:
```bash
# Start Ollama
ollama serve

# In another terminal, verify it's running
curl http://localhost:11434/api/tags

# In Codexa, AI suggestions will now work
codexa check
```

---

### `Ollama error: model not found`

**Cause**: Model hasn't been pulled yet

**Fix**:
```bash
# Pull the recommended model
ollama pull deepseek-coder:6.7b

# Or use another model
ollama pull llama2
ollama pull mistral

# Configure Codexa to use it
codexa config set ollama.model llama2
```

---

### `Ollama suggestions are slow`

**Cause**: Model is too large for your hardware, or suggestions are being streamed

**Fix**: Use a smaller model
```bash
ollama pull deepseek-coder:1.3b
codexa config set ollama.model deepseek-coder:1.3b
```

---

## Team & CI

### `CI check failed: CRITICAL errors found`

**Cause**: Code quality threshold not met

**Fix**: Either fix the errors or lower the threshold
```bash
# View blocking errors
codexa check --ci

# Fix them
git add -u
git commit --amend

# Or adjust threshold
codexa config set ci.failOn MODERATE
```

---

### `GitHub Actions: codexa command not found`

**Cause**: `codexa` not installed in CI environment

**Fix**: Add to GitHub Actions workflow
```yaml
- name: Install Codexa
  run: npm install -g @codexa/cli

- name: Run Codexa
  run: codexa check --ci
```

---

### `Team dashboard shows no data`

**Cause**: No commit history or database not initialized

**Fix**:
```bash
# Make a test commit
echo "# Test" >> README.md
git add README.md
git commit -m "test"

# Try dashboard again
codexa dashboard
```

---

## Adapters

### `Cannot find adapter: codexa-adapter-go`

**Cause**: Adapter not installed or npm installation failed

**Fix**:
```bash
# Try manual installation
npm install -g codexa-adapter-go

# Or reinstall from registry
codexa list-languages
codexa add-language codexa-adapter-go

# Verify it's installed
codexa list-languages | grep go
```

---

### `Adapter errors crash Codexa`

**Cause**: Adapter has a bug and throws an error

**Fix**: Report the issue
```bash
# Get adapter version
codexa list-languages

# Check adapter GitHub repo for issues/fix

# In the meantime, disable the adapter
codexa remove-language <adapter-name>
```

Codexa should handle adapter crashes gracefully. If it crashes completely, this is a bug. Report it.

---

## Performance

### `codexa check is slow (> 5 seconds)`

**Cause**: Large file set, slow linter, or slow adapter

**Troubleshoot**:
```bash
# Check which files are being linted
git diff --cached --name-only

# See if a specific adapter is slow
codexa check --ci  # capture output

# Profile Codexa
time codexa check

# Try with fewer files
git diff --cached --name-only | head -5 | xargs codexa check  # (with staged setup)
```

**Fix**: 
- Run linter on fewer files: `git add` only specific files
- Use ignore patterns to exclude slow files: `.codexaignore`
- Upgrade your machine :)

---

## Uninstalling

### How do I remove Codexa?

```bash
# Remove npm package
npm uninstall -g @codexa/cli

# Remove config and data (optional)
rm -rf ~/.codexa

# Remove from repo
rm -rf codexa.config.json .codexaignore .codexa/

# Remove git hook
rm .git/hooks/pre-commit
```

---

## Reporting Issues

If you hit something not listed here:

1. Check [GitHub Issues](https://github.com/sayam-1705/codexa/issues)
2. Search [GitHub Discussions](https://github.com/sayam-1705/codexa/discussions)
3. [Open a new issue](https://github.com/sayam-1705/codexa/issues/new) with:
   - `codexa --version` output
   - Your config (redact sensitive data)
   - Exact error message
   - Steps to reproduce

Help us fix it!
