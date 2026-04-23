import { existsSync, writeFileSync } from 'fs';
import { join } from 'path';
import chalk from 'chalk';
import ora from 'ora';
import { execSync } from 'child_process';
import { detectLanguages } from '../core/detector.js';
import { installHook, isHookInstalled } from '../git/hooks.js';
import { loadConfig, createDefaultConfig } from '../team/config.js';

export async function initCommand(options) {
  const repoPath = process.cwd();

  // Check for .git folder
  if (!existsSync(join(repoPath, '.git'))) {
    console.error(chalk.red('\n✗ This folder is not a git repository.'));
    console.error(chalk.dim('  Why: Codexa installs a pre-commit hook in .git/hooks.'));
    console.error(chalk.dim('  Fix: run git init, then run codexa init again.'));
    process.exit(1);
  }

  console.log('');

  // Step 1: Detect languages
  const detectSpinner = ora('Scanning project...').start();
  try {
    const languages = await detectLanguages(repoPath);

    if (languages.length > 0) {
      detectSpinner.succeed(`Detected: ${languages.map(l => chalk.cyan(l)).join('  ')}`);
    } else {
      detectSpinner.warn('No JS/TS/Python files detected.');
      console.log(chalk.dim('  Install a language adapter: codexa add-language codexa-adapter-go'));
    }
  } catch (err) {
    detectSpinner.warn('Detection skipped');
  }

  // Step 2: Configure Codexa
  const configSpinner = ora('Setting up config...').start();
  const configPath = join(repoPath, 'codexa.config.json');
  const configExists = existsSync(configPath);

  try {
    if (configExists) {
      configSpinner.succeed('Existing config found');
    } else {
      const isTeam = options && options.team !== false;

      if (isTeam) {
        createDefaultConfig(repoPath, { team: true });

        const ignoreFile = join(repoPath, '.codexaignore');
        if (!existsSync(ignoreFile)) {
          const defaultIgnore = `# Codexa ignore patterns (like .gitignore)

dist/
build/
*.min.js
*.generated.*
tests/fixtures/
src/legacy/
`;
          writeFileSync(ignoreFile, defaultIgnore, 'utf8');
        }
      } else {
        createDefaultConfig(repoPath, { team: false });
      }

      configSpinner.succeed('Config ready');
    }
  } catch (err) {
    configSpinner.fail('Setup failed');
    console.error(chalk.dim(`  Could not write codexa.config.json: ${err.message}`));
    console.error(chalk.dim('  Fix: check write permissions and retry codexa init.'));
  }

  // Step 3: Install hook
  const hookSpinner = ora('Installing git hook...').start();
  try {
    if (isHookInstalled(repoPath)) {
      hookSpinner.succeed('Hook already active');
    } else {
      installHook(repoPath);
      hookSpinner.succeed('Hook installed at .git/hooks/pre-commit');
    }
  } catch (err) {
    hookSpinner.fail('Hook setup failed');
    console.error(chalk.dim(`  ${err.message}`));
    console.error(chalk.dim('  Fix: ensure .git/hooks exists and is writable.'));
  }

  // Step 4: Demo lint on last commit
  try {
    // Skip silently if git history is unavailable.
    let lastCommitFiles = [];
    try {
      const output = execSync('git diff HEAD~1 --name-only', {
        cwd: repoPath,
        encoding: 'utf8',
        stdio: ['pipe', 'pipe', 'pipe'],
      });
      lastCommitFiles = output
        .trim()
        .split('\n')
        .filter(f => f.length > 0)
        .map(f => join(repoPath, f.replace(/\\/g, '/')));
    } catch (err) {
      lastCommitFiles = [];
    }

    if (lastCommitFiles.length > 0) {
      const demoSpinner = ora('Running demo check on your last commit...').start();
      try {
        const { runLinter } = await import('../core/runner.js');
        const config = configExists ? await loadConfig(repoPath) : {};
        const results = await runLinter(lastCommitFiles, repoPath, config);
        const totalErrors = (results.blocking || []).length + (results.warnings || []).length + (results.minor || []).length;

        if (totalErrors > 0) {
          demoSpinner.succeed(`${totalErrors} issue${totalErrors === 1 ? '' : 's'} found`);
          console.log(chalk.dim(`\nYour last commit had ${totalErrors} issue${totalErrors === 1 ? '' : 's'} - here is what Codexa would catch:`));

          const allErrors = [
            ...(results.blocking || []),
            ...(results.warnings || []),
            ...(results.minor || []),
          ].slice(0, 3);

          for (const error of allErrors) {
            const severityColor = error.severity === 'CRITICAL' ? 'red' : error.severity === 'MODERATE' ? 'yellow' : 'green';
            const sev = chalk[severityColor](`[${error.severity}]`);
            const relFile = error.file.startsWith(repoPath)
              ? error.file.slice(repoPath.length + 1).replace(/\\/g, '/')
              : String(error.file).replace(/\\/g, '/');
            console.log(`${sev} ${chalk.cyan(`${relFile}:${error.line}`)} ${chalk.dim(error.rule)}`);
          }

          if (totalErrors > 3) {
            console.log(chalk.dim(`... and ${totalErrors - 3} more`));
          }

          console.log(chalk.dim('Run git commit to trigger Codexa on your next commit.'));
        } else {
          demoSpinner.succeed('Your last commit was clean. Nice work.');
        }
      } catch (err) {
        // Demo is best-effort and should not interrupt init output.
      }
    }
  } catch (err) {
    // Silently skip demo on error.
  }

  // Final summary box
  console.log('');
  console.log(chalk.cyan('╔══════════════════════════════════════╗'));
  console.log(chalk.cyan('║  Codexa is ready.                   ║'));
  console.log(chalk.cyan('║                                     ║'));
  console.log(chalk.cyan('║  Stage files and commit to begin.   ║'));
  console.log(chalk.cyan('║  Every commit is now protected.     ║'));
  console.log(chalk.cyan('╚══════════════════════════════════════╝'));
  console.log('');
}
