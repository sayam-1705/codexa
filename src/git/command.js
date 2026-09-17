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

function normalizeGitPath(p) {
  if (process.platform === 'win32' && p.match(/^\/[a-zA-Z]\//)) {
    return p.charAt(1).toUpperCase() + ':' + p.slice(2);
  }
  return p;
}

export function gitPath(repoPath, name) {
  return normalizeGitPath(runGit(['rev-parse', '--git-path', name], repoPath).trim());
}

export function repositoryRoot(repoPath = process.cwd()) {
  return normalizeGitPath(runGit(['rev-parse', '--show-toplevel'], repoPath).trim());
}