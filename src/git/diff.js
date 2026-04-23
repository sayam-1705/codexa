import { simpleGit } from 'simple-git';
import { resolve } from 'path';

export async function getStagedFiles(repoPath) {
  const git = simpleGit(repoPath);

  // Get staged files using git diff --cached --name-only
  const output = await git.diff(['--cached', '--name-only']);

  if (!output.trim()) {
    return [];
  }

  const files = output
    .split('\n')
    .filter(f => f.trim())
    .map(f => resolve(repoPath, f));

  // Filter out deleted files
  const git2 = simpleGit(repoPath);
  const deletedOutput = await git2.diff(['--cached', '--name-only', '--diff-filter=D']);

  const deletedSet = new Set(
    deletedOutput
      .split('\n')
      .filter(f => f.trim())
      .map(f => resolve(repoPath, f))
  );

  return files.filter(f => !deletedSet.has(f));
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
