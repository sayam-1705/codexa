import chalk from 'chalk';

/**
 * Simple terminal UI without JSX/React
 * Shows errors in a readable format
 */
export function renderSimpleUI(result) {
  const { blocking, warnings, minor, preexisting, streakDisplay, result: resultStatus } = result;

  // Header
  const totalIssues = blocking.length + warnings.length + minor.length;
  console.log(chalk.cyan(`\ncodexa  ●  ${totalIssues} issues  ●  🔴 ${blocking.length}  🟡 ${warnings.length}  ⚪ ${minor.length}`));

  if (streakDisplay) {
    console.log(chalk.yellow(`  ●  ${streakDisplay}`));
  }

  console.log('');

  // Show blocking errors
  if (blocking.length > 0) {
    console.log(chalk.red.bold('🔴 BLOCKING ERRORS:'));
    blocking.forEach((error, idx) => {
      console.log(chalk.red(`  [${idx + 1}] ${error.file}:${error.line}:${error.col}`));
      console.log(chalk.red(`      ${error.message}`));
      console.log(chalk.dim(`      Rule: ${error.rule}`));
    });
    console.log('');
  }

  // Show warnings
  if (warnings.length > 0) {
    console.log(chalk.yellow.bold('🟡 WARNINGS:'));
    warnings.forEach((error, idx) => {
      console.log(chalk.yellow(`  [${idx + 1}] ${error.file}:${error.line}:${error.col}`));
      console.log(chalk.yellow(`      ${error.message}`));
      console.log(chalk.dim(`      Rule: ${error.rule}`));
    });
    console.log('');
  }

  // Show minor
  if (minor.length > 0) {
    console.log(chalk.dim.bold('⚪ MINOR:'));
    minor.forEach((error, idx) => {
      console.log(chalk.dim(`  [${idx + 1}] ${error.file}:${error.line}:${error.col}`));
      console.log(chalk.dim(`      ${error.message}`));
      console.log(chalk.dim(`      Rule: ${error.rule}`));
    });
    console.log('');
  }

  // Status
  if (blocking.length > 0) {
    console.log(chalk.red.bold(`❌ Commit blocked - fix ${blocking.length} error(s) to proceed`));
  } else if (warnings.length > 0) {
    console.log(chalk.yellow.bold(`⚠️  Review ${warnings.length} warning(s) before committing`));
  } else {
    console.log(chalk.green.bold(`✅ All checks passed - ready to commit`));
  }

  console.log('');
}
