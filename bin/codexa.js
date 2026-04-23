#!/usr/bin/env node

import { Command } from 'commander';
import { installAdapter, listAdapters, removeAdapter } from '../src/plugins/registry.js';
import { readFileSync, existsSync, writeFileSync } from 'fs';
import { join } from 'path';
import ora from 'ora';
import chalk from 'chalk';
import {
  isOllamaAvailable,
  getAvailableModels,
  selectBestModel,
} from '../src/ai/ollama.js';

const pkg = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8'));
const CLI_VERSION = pkg.version;

async function printVersion() {
  const nodeVersion = process.version;
  const adapterNames = listAdapters().installed.map((a) => a.name).join(', ') || 'none';

  let aiStatus = 'Ollama not running';
  if (await isOllamaAvailable()) {
    const models = await getAvailableModels();
    const selected = await selectBestModel(models);
    aiStatus = selected
      ? `Ollama connected (${selected})`
      : 'Ollama connected (no models found)';
  }

  console.log(`codexa ${CLI_VERSION}`);
  console.log(`Node.js ${nodeVersion}`);
  console.log(`Adapters: ${adapterNames}`);
  console.log(`AI: ${aiStatus}`);
}

function printHelp() {
  console.log('Usage: codexa <command> [options]');
  console.log('');
  console.log('AI pre-commit guardian. Blame-aware. Auto-fix. Learns.');
  console.log('');
  console.log('Commands:');
  console.log('  init                      Initialize Codexa in a repo');
  console.log('  check                     Lint staged files (runs automatically on commit)');
  console.log('  explain <loc>             Explain an error at file:line');
  console.log('  history                   Show past fix patterns');
  console.log('  report                    Show quality trend report');
  console.log('  stats                     Show lifetime statistics');
  console.log('  config                    Manage configuration');
  console.log('  dashboard                 Show team quality dashboard');
  console.log('  add-language              Install a community language adapter');
  console.log('  list-languages            List installed adapters');
  console.log('  remove-language           Remove a community adapter');
  console.log('');
  console.log('Options:');
  console.log('  -v, --version             Show version');
  console.log('  -h, --help                Show help');
  console.log('');
  console.log('Docs: https://codexa.dev/docs');
  console.log('Issues: https://github.com/sayam-1705/codexa/issues');
}

const rawArgs = process.argv.slice(2);
if (rawArgs.length === 1 && (rawArgs[0] === '-v' || rawArgs[0] === '--version')) {
  await printVersion();
  process.exit(0);
}

if (rawArgs.length === 1 && (rawArgs[0] === '-h' || rawArgs[0] === '--help')) {
  printHelp();
  process.exit(0);
}

function loadConfig(repoPath) {
  const configPath = join(repoPath, 'codexa.config.json');
  if (!existsSync(configPath)) {
    return { blameMode: 'strict' };
  }
  try {
    return JSON.parse(readFileSync(configPath, 'utf8'));
  } catch (err) {
    return { blameMode: 'strict' };
  }
}

async function checkCommand(options) {
  const repoPath = process.cwd();

  try {
    const { getStagedFiles } = await import('../src/git/diff.js');
    const { runLinter } = await import('../src/core/runner.js');
    const { renderResults } = await import('../src/tui/renderer.js');
    const { runCICheck } = await import('../src/team/ci.js');

    // Load config
    const config = await loadConfig(repoPath);

    // CI mode
    if (options.ci) {
      return await runCICheck(repoPath, config, {
        allFiles: options.allFiles,
        baseBranch: options.base,
        outputFormat: options.output,
      });
    }

    // Interactive mode
    const stagedFiles = await getStagedFiles(repoPath);

    if (!stagedFiles.length) {
      console.log('No staged files to check.');
      process.exit(0);
    }

    // Show spinner while linting
    const spinner = ora('Linting staged files...').start();
    const classified = await runLinter(stagedFiles, repoPath, config);
    spinner.stop();

    // Determine if CI mode is forced
    const ciMode = options.ci || !process.stdout.isTTY;

    // Render results (TUI or CI JSON)
    await renderResults(classified, config, { ciMode });
  } catch (err) {
    console.error('Error running linters:', err.message);
    process.exit(1);
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
  .action(async (options) => {
    try {
      const { initCommand } = await import('../src/commands/init.js');
      await initCommand(options);
    } catch (err) {
      console.error(err.message);
      process.exit(1);
    }
  });

program
  .command('check')
  .description('Run linters on staged files (called by pre-commit hook)')
  .option('--ci', 'Force CI mode (JSON output, no TUI)')
  .option('--base <branch>', 'Compare against base branch')
  .option('--all-files', 'Lint all files not just staged')
  .option('--output <fmt>', 'json | text (default: json in CI mode)', 'json')
  .action(checkCommand);

program
  .command('explain <loc>')
  .description('Explain an error at file:line')
  .action(async (loc) => {
    const match = /^(.+):(\d+)$/.exec(loc);
    if (!match) {
      console.error('Invalid location. Fix: use file:line (example: src/app.js:42).');
      process.exit(1);
    }

    const filePath = join(process.cwd(), match[1]);
    const lineNumber = Number(match[2]);

    if (!existsSync(filePath)) {
      console.error(`File not found: ${match[1]}\nFix: verify the relative path and rerun codexa explain <file>:<line>.`);
      process.exit(1);
    }

    const lines = readFileSync(filePath, 'utf8').split('\n');
    if (lineNumber < 1 || lineNumber > lines.length) {
      console.error(`Invalid line number: ${lineNumber}\nFix: choose a value between 1 and ${lines.length}.`);
      process.exit(1);
    }

    const targetLine = lines[lineNumber - 1];
    console.log(chalk.bold(`\n${match[1]}:${lineNumber}`));
    console.log(chalk.dim(targetLine));

    try {
      if (await isOllamaAvailable()) {
        const { buildPrompt } = await import('../src/ai/prompt.js');
        const { getSuggestion } = await import('../src/ai/ollama.js');
        const models = await getAvailableModels();
        const model = await selectBestModel(models);

        if (model) {
          const prompt = buildPrompt(
            {
              file: match[1],
              line: lineNumber,
              message: 'Explain and suggest a fix for this line in commit-blocking context.',
              rule: 'unknown',
              severity: 'MODERATE',
              language: match[1].endsWith('.py') ? 'python' : 'javascript',
            },
            lines
          );

          const suggestion = await getSuggestion(prompt, model);
          if (suggestion.trim()) {
            console.log('');
            console.log(chalk.cyan('AI suggestion:'));
            console.log(suggestion.trim());
          }
        }
      }
    } catch {
      // Keep explain usable even when AI is unavailable.
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
    const { loadConfig } = await import('../src/team/config.js');
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
  .action(async (subcommand, args) => {
    const {
      configValidateCommand,
      configShowCommand,
      configInitCommand,
      configSetCommand,
    } = await import('../src/commands/config.js');

    const options = {};
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
      process.exit(1);
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
      process.exit(1);
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
        console.log(chalk.bold('KNOWN COMMUNITY ADAPTERS  not installed'));
        for (const adapter of community) {
          console.log(`${adapter.package.padEnd(25)} ${adapter.linter}`);
        }
      }

      console.log('');
      console.log('Install: codexa add-language <package-name>');
      console.log(chalk.dim('════════════════════════════════════════════'));
    } catch (err) {
      console.error(chalk.red(`✗ ${err.message}`));
      process.exit(1);
    }
  });

program
  .command('remove-language <name>')
  .description('Remove an installed language adapter')
  .action(async (name) => {
    try {
      if (name === 'javascript' || name === 'python') {
        console.error(chalk.red('✗ Cannot remove built-in adapters.'));
        process.exit(1);
      }

      removeAdapter(name);
      console.log(chalk.green(`✓ Adapter removed: ${name}`));
      console.log(chalk.dim('Note: npm package is NOT globally uninstalled.'));
      console.log(chalk.dim('To fully remove: npm uninstall -g codexa-adapter-' + name));
    } catch (err) {
      console.error(chalk.red(`✗ ${err.message}`));
      process.exit(1);
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
  .command('stats')
  .description('Show lifetime statistics and metrics')
  .action(async (options) => {
    const { statsCommand } = await import('../src/commands/stats.js');
    await statsCommand(options);
  });

program.parse(process.argv);
