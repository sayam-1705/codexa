import { runLinter } from './runner.js';
import { loadConfig } from '../team/config.js';

export async function findErrorAtLocation(filePath, lineNumber) {
  const repoPath = process.cwd();
  const config = await loadConfig(repoPath);
  
  const classified = await runLinter([filePath], repoPath, config);

  const allErrors = [
    ...classified.blocking,
    ...classified.warnings,
    ...classified.minor,
    ...classified.preexisting
  ];

  return allErrors.find(e => e.line === lineNumber) || null;
}
