import { existsSync, writeFileSync, rmSync } from 'fs';
import { join } from 'path';
import chalk from 'chalk';
import ora from 'ora';
import { detectLanguages } from '../core/detector.js';
import { discoverSupportedFiles } from '../core/files.js';
import { saveBaseline } from '../core/baseline.js';
import { repositoryRoot } from '../git/command.js';
import { installHook, isHookInstalled, removeHook } from '../git/hooks.js';
import { loadConfig, createDefaultConfig } from '../team/config.js';

export async function initCommand(options) {
  const repoPath = process.cwd();
  let baselineReady = false;
  let scanResults = null;

  try {
    repositoryRoot(repoPath);
  } catch (err) {
    console.error(chalk.red('\n✗ This folder is not a git repository.'));
    console.error(chalk.dim('  Why: Codexa installs a pre-commit hook in .git/hooks.'));
    console.error(chalk.dim('  Fix: run git init, then run codexa init again.'));
    process.exitCode = 1; return;
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
      console.log(chalk.dim('  See docs/plugin-authoring.md to add a community adapter.'));
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
      // Determine team/solo mode: --team forces team, --no-team forces solo, default solo
      let isTeam = false;
      if (options.team === true) {
        isTeam = true;
      } else if (options.noTeam === true) {
        isTeam = false;
      }
      // If neither flag provided, isTeam remains false (solo default)

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

  // Step 4: Establish the initial scan from the complete supported repository.
  try {
    const config = await loadConfig(repoPath);
    const initialFiles = await discoverSupportedFiles(repoPath, config);

    if (initialFiles.length > 0) {
      const demoSpinner = ora(`Scanning ${initialFiles.length} supported files...`).start();
      try {
        const { runLinter } = await import('../core/runner.js');
        const results = await runLinter(initialFiles, repoPath, { ...config, blameMode: 'off' });
        const totalErrors = (results.blocking || []).length + (results.warnings || []).length + (results.minor || []).length;

        if (totalErrors > 0) {
          demoSpinner.succeed(`${totalErrors} issue${totalErrors === 1 ? '' : 's'} found`);
          console.log(chalk.dim(`\nBASELINE NOT READY: ${totalErrors} issue${totalErrors === 1 ? '' : 's'} must be resolved before incremental enforcement.`));

          const allErrors = [
            ...(results.blocking || []),
            ...(results.warnings || []),
            ...(results.minor || []),
          ];

          for (const error of allErrors) {
            const severityColor = error.severity === 'CRITICAL' ? 'red' : error.severity === 'MODERATE' ? 'yellow' : 'green';
            const sev = chalk[severityColor](`[${error.severity}]`);
            const relFile = error.file.startsWith(repoPath)
              ? error.file.slice(repoPath.length + 1).replace(/\\/g, '/')
              : String(error.file).replace(/\\/g, '/');
            console.log(`${sev} ${chalk.cyan(`${relFile}:${error.line}`)} ${chalk.dim(error.rule)}`);
          }

          console.log(chalk.dim('Resolve the issues, then run codexa init again to verify the baseline.'));
          process.exitCode = 1;
        } else {
          scanResults = results;
          const adapterFailures = results?.adapterFailures || [];
          if (adapterFailures.length > 0) {
            demoSpinner.fail('Initial scan found adapter failures');
            console.log(chalk.dim('BASELINE NOT READY: adapter failures must be resolved.'));
            console.log(chalk.dim('  Adapter failures:'));
            for (const failure of adapterFailures) {
              console.log(chalk.dim(`    [${failure.name}] ${failure.error}`));
            }
            process.exitCode = 1;
          } else {
            saveBaseline(repoPath, []);
            baselineReady = true;
            demoSpinner.succeed('BASELINE READY: the supported repository scan is clean.');
          }
        }
      } catch (err) {
        demoSpinner.fail('Initial scan failed');
        throw new Error(`Initial scan failed: ${err.message}`);
      }
    } else {
      console.error(chalk.dim('No supported files were available for the initial scan.'));
      process.exitCode = 1;
    }
  } catch (err) {
    console.error(chalk.red(`\n✗ ${err.message}`));
    console.error(chalk.dim('  Fix: resolve the analyzer or Git error, then rerun codexa init.'));
    process.exitCode = 1;
  }

  if (!baselineReady) {
    try {
      removeHook(repoPath);
      rmSync(join(repoPath, '.codexa', 'baseline.json'), { force: true });
      console.log(chalk.dim('Enforcement state reverted because initialization did not produce a valid baseline.'));
    } catch (err) {
      console.error(chalk.red(`Could not remove the incomplete initialization hook: ${err.message}`));
    }
  }

  // Prevent baseline save when adapter failures occurred
  if (baselineReady === false && process.exitCode !== 1) {
    const adapterFailures = (scanResults?.adapterFailures || []);
    if (adapterFailures.length > 0) {
      console.log(chalk.dim('BASELINE NOT READY: adapter failures must be resolved.'));
      console.log(chalk.dim('  Adapter failures:'));
      for (const failure of adapterFailures) {
        console.log(chalk.dim(`    [${failure.name}] ${failure.error}`));
      }
      process.exitCode = 1;
    }
  }

  // Final summary box
  console.log('');
  console.log(chalk.cyan('╔══════════════════════════════════════╗'));
  console.log(chalk.cyan(`║  ${baselineReady ? 'Codexa is ready.' : 'Baseline is not ready.'}                 ║`));
  console.log(chalk.cyan('║                                     ║'));
  console.log(chalk.cyan('║  Stage files and commit to begin.   ║'));
  console.log(chalk.cyan('║  Every commit is now protected.     ║'));
  console.log(chalk.cyan('╚══════════════════════════════════════╝'));
  console.log('');
}
