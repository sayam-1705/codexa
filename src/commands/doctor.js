import { readFileSync, existsSync, accessSync, constants } from 'fs';
import { resolve } from 'path';
import { homedir } from 'os';
import { execFileSync } from 'child_process';
import chalk from 'chalk';
import { loadConfig } from '../team/config.js';
import { isHookInstalled } from '../git/hooks.js';
import { getBaselineVersion } from '../core/baseline.js';

function check(label, condition, info = '') {
  if (condition) {
    console.log(chalk.green(`✓ ${label}`) + (info ? chalk.dim(` (${info})`) : ''));
    return true;
  } else {
    console.log(chalk.red(`✗ ${label}`) + (info ? chalk.dim(` (${info})`) : ''));
    return false;
  }
}

export async function doctorCommand(options) {
  const { strict } = options;
  const repoPath = process.cwd();
  let allPassed = true;

  console.log(chalk.bold('\nCodexa Doctor\n'));

  // 1. Node.js version
  const nodeVersion = process.versions.node;
  const major = parseInt(nodeVersion.split('.')[0], 10);
  allPassed &= check('Node.js version', major >= 18, `v${nodeVersion}`);

  // 2. Git repo
  const isGit = existsSync(resolve(repoPath, '.git'));
  allPassed &= check('Git repository detected', isGit);

  // 3. Hook installed
  const hasHook = isHookInstalled(repoPath);
  allPassed &= check('Codexa pre-commit hook installed', hasHook);

  // 4. Config valid
  try {
    await loadConfig(repoPath);
    allPassed &= check('Configuration valid', true);
  } catch (err) {
    allPassed &= check('Configuration valid', false, err.message);
  }

  // 5. ESLint resolvable
  try {
    const { ESLint } = await import('eslint');
    const { buildEslintOptions } = await import('../profiles/eslintConfig.js');
    new ESLint(buildEslintOptions());
    allPassed &= check('ESLint resolvable and config works', true);
  } catch (err) {
    allPassed &= check('ESLint resolvable and config works', false, err.message);
  }

  // 6. Baseline format
  try {
    const baselineVersion = getBaselineVersion(repoPath);
    if (baselineVersion === 1) {
      console.warn(chalk.yellow('! Legacy baseline format detected: run codexa baseline update after reviewing existing findings.'));
    } else {
      check('Baseline format current', true, baselineVersion ? `v${baselineVersion}` : 'Not created yet');
    }
  } catch (err) {
    allPassed &= check('Baseline format readable', false, err.message);
  }

  // 7. ruff on PATH
  try {
    const ruffVersion = execFileSync('ruff', ['--version'], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim();
    check('ruff available (Python linter)', true, ruffVersion);
  } catch (err) {
    check('ruff available (Python linter)', false, 'Not found on PATH');
  }

  // 8. .codexa writable
  const codexaDir = resolve(repoPath, '.codexa');
  if (existsSync(codexaDir)) {
    try {
      accessSync(codexaDir, constants.W_OK);
      allPassed &= check('.codexa/ directory writable', true);
    } catch (err) {
      allPassed &= check('.codexa/ directory writable', false, 'Permission denied');
    }
  } else {
    check('.codexa/ directory writable', true, 'Does not exist yet');
  }

  // 9. adapters.json readable
  const globalDir = process.env.CODEXA_HOME || resolve(homedir(), '.codexa');
  const adaptersPath = resolve(globalDir, 'adapters.json');
  if (existsSync(adaptersPath)) {
    try {
      JSON.parse(readFileSync(adaptersPath, 'utf8'));
      allPassed &= check('~/.codexa/adapters.json valid', true);
    } catch (err) {
      allPassed &= check('~/.codexa/adapters.json valid', false, 'Invalid JSON');
    }
  } else {
    check('~/.codexa/adapters.json valid', true, 'Does not exist yet');
  }

  console.log();
  if (strict && !allPassed) {
    process.exit(1);
  }
}
