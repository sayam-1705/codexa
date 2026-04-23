import chalk from 'chalk';
import { loadConfig, validateConfig, createDefaultConfig, getIgnorePatterns } from '../team/config.js';
import { writeFileSync, existsSync } from 'fs';
import { resolve } from 'path';

/**
 * Handle `codexa config validate` command.
 */
export async function configValidateCommand() {
  const repoPath = process.cwd();

  try {
    const config = await loadConfig(repoPath);
    const validation = validateConfig(config);

    if (validation.valid) {
      console.log(chalk.green('✓ Config is valid') + ` (schema ${config._codexaSchema})`);
      console.log('');
      console.log(chalk.dim('  Active settings:'));
      console.log(`    blameMode:          ${config.blameMode}`);
      console.log(`    team.enforceOnCI:   ${config.team.enforceOnCI}`);
      console.log(`    ci.failOn:          ${config.ci.failOn}`);
      console.log(`    ignore patterns:    ${config.ignore.length}`);
      console.log(`    severity overrides: ${Object.keys(config.severity.overrides).length}`);
    } else {
      console.log(chalk.red(`✖ Config has ${validation.errors.length} error(s):`));
      console.log('');
      for (const error of validation.errors) {
        console.log(chalk.red(`  ERROR  ${error}`));
      }
      console.log('');
      console.log(chalk.dim('Fix: update codexa.config.json or run codexa config set <key> <value>.'));
      process.exit(1);
    }
  } catch (err) {
    console.log(chalk.red(`✖ Could not load codexa.config.json: ${err.message}`));
    console.log(chalk.dim('Fix: create one with codexa config init --team (or codexa init).'));
    process.exit(1);
  }
}

/**
 * Handle `codexa config show` command.
 */
export async function configShowCommand() {
  const repoPath = process.cwd();

  try {
    const config = await loadConfig(repoPath);
    console.log(JSON.stringify(config, null, 2));
  } catch (err) {
    console.log(chalk.red(`✖ Could not read active config: ${err.message}`));
    console.log(chalk.dim('Fix: run codexa config validate for details, or recreate with codexa config init --team.'));
    process.exit(1);
  }
}

/**
 * Handle `codexa config init --team` command.
 */
export async function configInitCommand(options = {}) {
  const repoPath = process.cwd();

  try {
    const configPath = resolve(repoPath, 'codexa.config.json');
    const ignoreFile = resolve(repoPath, '.codexaignore');

    if (existsSync(configPath)) {
      console.log(chalk.yellow('Config already exists at codexa.config.json.'));
      console.log(chalk.dim('Fix: delete it first, or use codexa config set <key> <value> to edit fields.'));
      return;
    }

    // Write config
    createDefaultConfig(repoPath, { team: true, force: options.force });
    console.log(chalk.green('✓ Created codexa.config.json'));

    // Write .codexaignore if not exists
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
      console.log(chalk.green('✓ Created .codexaignore'));
    }

    console.log('');
    console.log(chalk.dim('  Commit both files to share with your team:'));
    console.log(`    git add codexa.config.json .codexaignore`);
    console.log(`    git commit -m "Add Codexa team config"`);
  } catch (err) {
    console.log(chalk.red(`✖ Failed to initialize codexa.config.json: ${err.message}`));
    console.log(chalk.dim('Fix: ensure this folder is writable and rerun codexa config init --team.'));
    process.exit(1);
  }
}

/**
 * Handle `codexa config set <key> <value>` command.
 */
export async function configSetCommand(keyPath, value) {
  const repoPath = process.cwd();

  try {
    const config = await loadConfig(repoPath);
    const configPath = resolve(repoPath, 'codexa.config.json');

    // Parse dot notation key
    const keys = keyPath.split('.');
    let current = config;

    for (let i = 0; i < keys.length - 1; i++) {
      if (!(keys[i] in current)) {
        current[keys[i]] = {};
      }
      current = current[keys[i]];
    }

    // Set value (attempt type conversion)
    const lastKey = keys[keys.length - 1];
    if (value === 'true') {
      current[lastKey] = true;
    } else if (value === 'false') {
      current[lastKey] = false;
    } else if (!isNaN(value)) {
      current[lastKey] = Number(value);
    } else {
      current[lastKey] = value;
    }

    // Validate before writing
    const validation = validateConfig(config);
    if (!validation.valid) {
      console.log(chalk.red('✖ Invalid value. codexa.config.json would become invalid:'));
      for (const error of validation.errors) {
        console.log(chalk.red(`  ${error}`));
      }
      console.log(chalk.dim(`Fix: choose a valid value for ${keyPath}, then run codexa config validate.`));
      process.exit(1);
    }

    // Write back
    writeFileSync(configPath, JSON.stringify(config, null, 2), 'utf8');
    console.log(chalk.green(`✓ Updated ${keyPath}`));
  } catch (err) {
    console.log(chalk.red(`✖ Failed to update ${keyPath}: ${err.message}`));
    console.log(chalk.dim('Fix: verify the key exists and codexa.config.json is writable.'));
    process.exit(1);
  }
}
