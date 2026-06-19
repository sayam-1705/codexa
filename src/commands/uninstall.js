import { rmSync, existsSync } from 'fs';
import { resolve } from 'path';
import { homedir } from 'os';
import chalk from 'chalk';
import { createInterface } from 'readline';
import { removeHook, isHookInstalled } from '../git/hooks.js';


function promptYesNo(question) {
  return new Promise((resolve) => {
    const rl = createInterface({
      input: process.stdin,
      output: process.stdout,
    });
    rl.question(`${question} (y/N): `, (answer) => {
      rl.close();
      resolve(answer.toLowerCase() === 'y');
    });
  });
}

export async function uninstallCommand(options) {
  const { yes, purgeGlobal } = options;
  const repoPath = process.cwd();
  
  if (!yes) {
    const confirm = await promptYesNo('Are you sure you want to remove Codexa from this repository?');
    if (!confirm) {
      console.log('Uninstall cancelled.');
      return;
    }
  }

  const actions = [];

  try {
    if (isHookInstalled(repoPath)) {
      removeHook(repoPath);
      actions.push('Removed pre-commit hook.');
    }
  } catch (err) {
    // Ignore hook errors
  }

  const configPath = resolve(repoPath, 'codexa.config.json');
  if (existsSync(configPath)) {
    rmSync(configPath);
    actions.push('Deleted codexa.config.json.');
  }

  const ignorePath = resolve(repoPath, '.codexaignore');
  if (existsSync(ignorePath)) {
    rmSync(ignorePath);
    actions.push('Deleted .codexaignore.');
  }

  const codexaDir = resolve(repoPath, '.codexa');
  if (existsSync(codexaDir)) {
    rmSync(codexaDir, { recursive: true, force: true });
    actions.push('Deleted .codexa/ directory.');
  }

  if (purgeGlobal) {
    const globalDir = resolve(homedir(), '.codexa');
    if (existsSync(globalDir)) {
      rmSync(globalDir, { recursive: true, force: true });
      actions.push('Deleted global ~/.codexa/ directory.');
    }
  }

  console.log(chalk.bold('\nUninstall Summary:'));
  if (actions.length === 0) {
    console.log('No Codexa files found to remove.');
  } else {
    for (const action of actions) {
      console.log(chalk.green(`✓ ${action}`));
    }
  }

  console.log(chalk.dim('\nRun `npm uninstall -g codexa-toolkit` to remove the CLI itself.'));
}
