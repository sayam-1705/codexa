import { simpleGit } from 'simple-git';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'fs';
import { dirname, relative, resolve } from 'path';
import { tmpdir } from 'os';
import { runGit, repositoryRoot } from './command.js';

export async function getStagedFiles(repoPath) {
  const root = repositoryRoot(repoPath);
  return runGit(['diff', '--cached', '--name-only', '--diff-filter=ACMR', '-z', '--'], root)
    .split('\0')
    .filter(Boolean)
    .map(file => resolve(root, file));
}

export async function materializeIndexFiles(repoPath, files) {
  const root = repositoryRoot(repoPath);
  const directory = mkdtempSync(resolve(tmpdir(), 'codexa-index-'));
  const mapping = new Map();
  try {
    for (const file of files) {
      const relativePath = relative(root, resolve(file));
      const target = resolve(directory, relativePath);
      mkdirSync(dirname(target), { recursive: true });
      const content = runGit(['show', `:${relativePath}`], root, { encoding: 'buffer' });
      writeFileSync(target, content);
      mapping.set(target, resolve(file));
    }
  } catch (error) {
    rmSync(directory, { recursive: true, force: true });
    throw new Error(`Could not materialize staged content: ${error.message}`);
  }
  return {
    files: [...mapping.keys()],
    mapFinding: finding => ({ ...finding, file: mapping.get(finding.file) || finding.file }),
    cleanup: () => rmSync(directory, { recursive: true, force: true }),
  };
}

export async function getChangedLines(repoPath, filePath) {
  const git = simpleGit(repoPath);

  // Get the unified diff with 0 lines of context to see only changed lines
  const output = await git.diff(['--cached', '--unified=0', filePath]);

  if (!output.trim()) {
    return [];
  }

  const lines = [];
  const hunks = output.split('\n');

  for (const hunk of hunks) {
    // Parse hunk header: @@ -start,count +start,count @@
    const match = hunk.match(/@@ -\d+(?:,\d+)? \+(\d+)(?:,(\d+))? @@/);
    if (match) {
      const start = parseInt(match[1], 10);
      const count = match[2] ? parseInt(match[2], 10) : 1;
      const end = count > 0 ? start + count - 1 : start;

      lines.push({ start, end });
    }
  }

  return lines;
}
