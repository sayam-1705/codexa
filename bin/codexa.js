#!/usr/bin/env node

import { Command } from 'commander';
import { installAdapter, listAdapters, removeAdapter } from '../src/plugins/registry.js';
import { readFileSync, existsSync, writeFileSync } from 'fs';
import { join } from 'path';
import ora from 'ora';
import chalk from 'chalk';
import { loadConfig } from '../src/team/config.js';

const pkg = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8'));
const CLI_VERSION = pkg.version;

async function printVersion() {
  const nodeVersion = process.version;
  const adapterNames = listAdapters().installed.map((a) => a.name).join(', ') || 'none';

  console.log(`codexa ${CLI_VERSION}`);
  console.log(`Node.js ${nodeVersion}`);
  console.log(`Adapters: ${adapterNames}`);
}



const rawArgs = process.argv.slice(2);
if (rawArgs.length === 1 && (rawArgs[0] === '-v' || rawArgs[0] === '--version')) {
  await printVersion();
  process.exit(0);
}



async function checkCommand(options) {
  const repoPath = process.cwd();

  try {
    const { getStagedFiles } = await import('../src/git/diff.js');
    const { runLinter } = await import('../src/core/runner.js');
    const { renderResults } = await import('../src/tui/renderer.js');
    const { runCICheck } = await import('../src/team/ci.js');
    const { filterBaselineFindings, loadBaseline } = await import('../src/core/baseline.js');

    // Load config
    const config = await loadConfig(repoPath);

    // CI mode
    if (options.ci) {
      const result = await runCICheck(repoPath, config, {
        allFiles: options.allFiles !== false,
        staged: options.staged,
        baseBranch: options.base,
        outputFormat: options.output,
      });
      process.exitCode = result.exitCode;
      return result;
    }

    // Interactive mode
    const stagedFiles = await getStagedFiles(repoPath);

    if (!stagedFiles.length) {
      console.log('No staged files to check.');
      process.exitCode = 0; return;
    }

    // Show spinner while linting
    const spinner = ora('Linting staged files...').start();
    const baseline = loadBaseline(repoPath);
    const classified = filterBaselineFindings(await runLinter(stagedFiles, repoPath, { ...config, snapshot: 'index' }), repoPath, baseline);
    spinner.stop();

    // Only force CI mode if --ci flag is explicitly set
    const ciMode = options.ci;

    // Render results (TUI or CI JSON)
    await renderResults(classified, config, { ciMode });
  } catch (err) {
    if (options.ci) {
      console.log(JSON.stringify({
        error: `Check failed: ${err.message}`,
        fix: 'Run codexa config validate, ensure Git is available, and rerun codexa check --ci.',
      }));
      process.exitCode = 1;
      return;
    }
    console.error('Error running linters:', err.message);
    process.exitCode = 1;
  }
}

async function baselineCommand(action) {
  const repoPath = process.cwd();
  if (action !== 'update') {
    console.error('Usage: codexa baseline update');
    process.exitCode = 1; return;
  }
  try {
    const { discoverSupportedFiles } = await import('../src/core/files.js');
    const { runLinter } = await import('../src/core/runner.js');
    const { saveBaseline } = await import('../src/core/baseline.js');
    const config = await loadConfig(repoPath);
    const files = await discoverSupportedFiles(repoPath, config);
    const result = await runLinter(files, repoPath, config);

    // A baseline must only be created from a complete, successful analysis.
    // If any adapter failed, the scan is incomplete and cannot produce a valid baseline.
    const adapterFailures = result.adapterFailures || [];
    if (adapterFailures.length > 0) {
      console.error(
        `Cannot update baseline: ${adapterFailures.length} adapter failure(s) mean the scan is incomplete.\n` +
        adapterFailures.map(f => `  [${f.name}] ${f.error}`).join('\n')
      );
      process.exitCode = 1; return;
    }

    const findings = [...result.blocking, ...result.warnings, ...result.minor, ...result.preexisting];
    const path = saveBaseline(repoPath, findings);
    console.log(`Baseline updated with ${findings.length} finding(s): ${path}`);
  } catch (err) {
    console.error(`Could not update baseline: ${err.message}`);
    process.exitCode = 1; return;
  }
}

const program = new Command();

program
  .name('codexa')
  .version(CLI_VERSION, '-v, --version', 'Show version')
  .helpOption('-h, --help', 'Show help');

program
  .command('init')
  .description('Initialize Codexa in a git repository')
  .option('--team', 'Create a team configuration (default: solo)')
  .option('--no-team', 'Create a solo configuration (default: if --team is omitted)')
  .action(async (options) => {
    try {
      const { initCommand } = await import('../src/commands/init.js');
      await initCommand(options);
    } catch (err) {
      console.error(err.message);
      process.exitCode = 1; return;
    }
  });

program
  .command('check')
  .description('Run linters on staged files (called by pre-commit hook)')
  .option('--ci', 'Force CI mode (JSON output, no TUI)')
  .option('--base <branch>', 'Compare against base branch')
  .option('--all-files', 'Lint all supported repository files (default in CI mode)')
  .option('--staged', 'In CI mode, lint only staged index content')
  .option('--output <fmt>', 'json | text (default: json in CI mode)', 'json')
  .action(checkCommand);

program
  .command('baseline <action>')
  .description('Explicitly update the repository finding baseline')
  .action(baselineCommand);

program
  .command('explain <loc>')
  .description('Explain an error at file:line')
  .action(async (loc) => {
    const match = /^(.+):(\d+)$/.exec(loc);
    if (!match) {
      console.error('Invalid location. Fix: use file:line (example: src/app.js:42).');
      process.exitCode = 1; return;
    }

    const filePath = join(process.cwd(), match[1]);
    const lineNumber = Number(match[2]);

    if (!existsSync(filePath)) {
      console.error(`File not found: ${match[1]}\nFix: verify the relative path and rerun codexa explain <file>:<line>.`);
      process.exitCode = 1; return;
    }

    const lines = readFileSync(filePath, 'utf8').split('\n');
    if (lineNumber < 1 || lineNumber > lines.length) {
      console.error(`Invalid line number: ${lineNumber}\nFix: choose a value between 1 and ${lines.length}.`);
      process.exitCode = 1; return;
    }

    const targetLine = lines[lineNumber - 1];
    const { findErrorAtLocation } = await import('../src/core/locate.js');
    const error = await findErrorAtLocation(filePath, lineNumber);
    console.log(chalk.bold(`\n${match[1]}:${lineNumber}`));
    if (error) {
      console.log(chalk.red(`${error.rule || 'unknown'}: ${error.message}`));
      console.log(chalk.dim(targetLine));
    } else {
      console.log(chalk.yellow('No Codexa finding at this location.'));
    }
  });

program
  .command('history')
  .description('Show past fix patterns')
  .option('--days <number>', 'Look back N days (default: 30)', '30')
  .option('--limit <number>', 'Show max N entries (default: 20)', '20')
  .action(async (options) => {
    const { getHistory, getHistoryStats } = await import('../src/learning/history.js');
    const repoPath = process.cwd();
    const days = Number.parseInt(options.days, 10) || 30;
    const limit = Number.parseInt(options.limit, 10) || 20;

    const history = getHistory(repoPath, 500);
    const since = Date.now() - days * 24 * 60 * 60 * 1000;
    const filtered = history
      .filter((entry) => Date.parse(entry.timestamp) >= since)
      .slice(0, limit);

    if (filtered.length === 0) {
      console.log(`No history entries in the last ${days} day(s).`);
      return;
    }

    const stats = getHistoryStats(repoPath);
    console.log(chalk.bold(`\nHistory (${filtered.length} entries)`));
    console.log(chalk.dim(`Success rate: ${stats?.successRate ?? 0}%`));
    for (const entry of filtered) {
      const status = entry.commitAllowed ? chalk.green('PASS') : chalk.red('BLOCK');
      console.log(`${status} ${entry.timestamp} files=${entry.filesChecked} errors=${entry.errorsFound} fixed=${entry.fixesAccepted}`);
    }
  });

program
  .command('dashboard')
  .description('Show team quality dashboard')
  .option('--contributor <name>', 'Filter to specific contributor')
  .option('--top <number>', 'Show top N hotspots (default: 5)', '5')
  .option('--html', 'Write dashboard to codexa-dashboard.html')
  .action(async (options) => {
    const repoPath = process.cwd();
    const { getDb } = await import('../src/solo/db.js');
    const { getDashboardData, formatDashboardTerminal } = await import('../src/team/dashboard.js');

    const config = await loadConfig(repoPath);
    const data = getDashboardData(repoPath, getDb(), config);

    if (options.contributor) {
      data.contributors = data.contributors.filter((c) =>
        c.displayName.toLowerCase().includes(options.contributor.toLowerCase())
      );
    }

    const top = Number.parseInt(options.top, 10) || 5;
    data.hotspots = (data.hotspots || []).slice(0, top);

    if (options.html) {
      const { generateHTMLReport } = await import('../src/team/html-report.js');
      const html = generateHTMLReport(data, config);
      writeFileSync(join(repoPath, 'codexa-dashboard.html'), html, 'utf8');
      console.log('Dashboard HTML written to codexa-dashboard.html');
      return;
    }

    console.log(formatDashboardTerminal(data));
  });

program
  .command('config <subcommand> [args...]')
  .description('Manage Codexa configuration')
  .option('--team', 'Create a team configuration')
  .option('--force', 'Overwrite an existing configuration')
  .action(async (subcommand, args, command) => {
    const {
      configValidateCommand,
      configShowCommand,
      configInitCommand,
      configSetCommand,
    } = await import('../src/commands/config.js');

    const options = typeof command?.opts === 'function' ? command.opts() : { ...command };
    for (const arg of args) {
      if (arg.startsWith('--')) {
        options[arg.slice(2)] = true;
      }
    }

    if (subcommand === 'validate') {
      await configValidateCommand();
    } else if (subcommand === 'show') {
      await configShowCommand();
    } else if (subcommand === 'init') {
      await configInitCommand(options);
    } else if (subcommand === 'set' && args.length >= 2) {
      await configSetCommand(args[0], args[1]);
    } else {
      console.error(`Unknown config subcommand: ${subcommand}`);
      process.exitCode = 1; return;
    }
  });

program
  .command('add-language <package>')
  .description('Install a community language adapter')
  .action(async (packageName) => {
    try {
      const adapter = await installAdapter(packageName);
      console.log(
        chalk.green(`\n✓ Adapter installed: ${adapter.name}`)
      );
      console.log(`  Language:      ${adapter.language}`);
      console.log(`  Extensions:    ${adapter.extensions.join(', ')}`);
      console.log(`  Linter:        ${adapter.linter}`);
      console.log(`  Version:       ${adapter.version}`);
      if (adapter.license) {
        console.log(`  License:       ${adapter.license}`);
      }
      console.log('');
      console.log(chalk.dim('Run codexa list-languages to see all installed adapters.'));
    } catch (err) {
      console.error(chalk.red(`✗ ${err.message}`));
      process.exitCode = 1; return;
    }
  });

program
  .command('list-languages')
  .description('List installed and available language adapters')
  .action(() => {
    try {
      const { installed, community } = listAdapters();

      console.log('');
      console.log(chalk.bold('INSTALLED ADAPTERS'));
      console.log(chalk.dim('════════════════════════════════════════════'));
      for (const adapter of installed) {
        const version = adapter.isBuiltin ? 'builtin' : adapter.version;
        const status = adapter.enabled ? chalk.green('enabled') : chalk.dim('disabled');
        console.log(`${adapter.name.padEnd(12)} ${version.padEnd(20)} ${status}`);
      }

      if (community.length > 0) {
        console.log('');
        console.log(chalk.bold('COMMUNITY ADAPTERS'));
        for (const adapter of community) {
          const status = adapter.status === 'not-published'
            ? chalk.yellow('not published')
            : chalk.dim('available');
          console.log(`${adapter.package.padEnd(25)} ${adapter.linter.padEnd(18)} ${status}`);
        }
      }

      console.log('');
      console.log('Install a published package: codexa add-language <package-name>');
      console.log(chalk.dim('════════════════════════════════════════════'));
    } catch (err) {
      console.error(chalk.red(`✗ ${err.message}`));
      process.exitCode = 1; return;
    }
  });

program
  .command('remove-language <name>')
  .description('Remove an installed language adapter')
  .action(async (name) => {
    try {
      if (name === 'javascript' || name === 'python') {
        console.error(chalk.red('✗ Cannot remove built-in adapters.'));
        process.exitCode = 1; return;
      }

      removeAdapter(name);
      console.log(chalk.green(`✓ Adapter removed: ${name}`));
      console.log(chalk.dim('Note: npm package is NOT globally uninstalled.'));
      console.log(chalk.dim('To fully remove: npm uninstall -g codexa-adapter-' + name));
    } catch (err) {
      console.error(chalk.red(`✗ ${err.message}`));
      process.exitCode = 1; return;
    }
  });

program
  .command('report')
  .description('Show code quality report with trends')
  .option('--days <number>', 'Look back N days (default: 30)', '30')
  .action(async (options) => {
    const { reportCommand } = await import('../src/commands/report.js');
    await reportCommand(options);
  });

program
  .command('digest')
  .description('Show the weekly coding digest when due')
  .action(async () => {
    const { printDigest } = await import('../src/solo/digest.js');
    printDigest(process.cwd());
  });

program
  .command('stats')
  .description('Show lifetime statistics and metrics')
  .action(async (options) => {
    const { statsCommand } = await import('../src/commands/stats.js');
    await statsCommand(options);
  });

program
  .command('help [command]')
  .description('Show help for a command, or list all commands')
  .action((commandName) => {
    if (commandName) {
      const cmd = program.commands.find((c) => c.name() === commandName);
      if (cmd) {
        cmd.outputHelp();
      } else {
        console.error(`Unknown command: ${commandName}`);
        console.log('Run "codexa help" to see all commands.');
        process.exitCode = 1; return;
      }
    } else {
      program.outputHelp();
    }
  });

program
  .command('uninstall')
  .alias('revoke')
  .description('Remove Codexa from this repository (hook, config, .codexa/ data)')
  .option('--yes', 'Skip confirmation prompts')
  .option('--purge-global', 'Also remove ~/.codexa (adapter registry) — affects ALL repos')
  .action(async (options) => {
    const { uninstallCommand } = await import('../src/commands/uninstall.js');
    await uninstallCommand(options);
  });

program
  .command('doctor')
  .description('Check environment for issues')
  .option('--strict', 'Exit with error code if any check fails')
  .action(async (options) => {
    const { doctorCommand } = await import('../src/commands/doctor.js');
    await doctorCommand(options);
  });

program
  .command('fix <loc>')
  .description('Apply an auto-fix at file:line (where supported)')
  .action(async (loc) => {
    const match = /^(.+):(\d+)$/.exec(loc);
    if (!match) {
      console.error('Invalid location. Fix: use file:line (example: src/app.js:42).');
      process.exitCode = 1; return;
    }

    const filePath = join(process.cwd(), match[1]);
    const lineNumber = Number(match[2]);

    if (!existsSync(filePath)) {
      console.error(`File not found: ${match[1]}\nFix: verify the relative path and rerun codexa fix <file>:<line>.`);
      process.exitCode = 1; return;
    }

    const { findErrorAtLocation } = await import('../src/core/locate.js');
    const error = await findErrorAtLocation(filePath, lineNumber);

    if (!error) {
      console.error(`No fixable error found at ${match[1]}:${lineNumber}`);
      process.exitCode = 1; return;
    }

    const { applyFix } = await import('../src/tui/FixEngine.js');
    const result = await applyFix({ ...error, repoPath: process.cwd() });

    if (result.success) {
      console.log(chalk.green('✓ ' + result.message));
      if (result.diff) {
        console.log(chalk.dim(result.diff));
      }
    } else {
      console.error(chalk.red('✗ ' + result.message));
      process.exitCode = 1; return;
    }
  });

// Commander does not await async action handlers when using parse().  Awaiting
// parseAsync keeps short-lived CLI processes alive until checks, CI output, and
// cleanup have completed.
await program.parseAsync(process.argv);
