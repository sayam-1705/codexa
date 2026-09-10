import { execFileSync } from 'child_process';

export function runGit(args, repoPath = process.cwd(), options = {}) {
  try {
    return execFileSync('git', args, {
      cwd: repoPath,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
      ...options,
    });
  } catch (error) {
    const detail = String(error.stderr || error.message || '').trim();
    throw new Error(`Git command failed (${args.join(' ')}): ${detail}`);
  }
}

export function gitPath(repoPath, name) {
  return runGit(['rev-parse', '--git-path', name], repoPath).trim();
}

export function repositoryRoot(repoPath = process.cwd()) {
  return runGit(['rev-parse', '--show-toplevel'], repoPath).trim();
}