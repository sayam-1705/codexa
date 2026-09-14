import { existsSync, readFileSync } from 'fs';
import { extname, relative, resolve } from 'path';
import { runGit, repositoryRoot } from '../git/command.js';
import { getEnabledAdapters } from '../plugins/registry.js';

const BUILTIN_EXCLUDES = new Set(['.git']);

function matchesIgnore(pattern, file) {
  const normalized = file.replace(/\\/g, '/');
  const value = pattern.replace(/^\//, '').replace(/\\/g, '/');
  if (!value || value.startsWith('#')) return false;

  const matchPattern = value.endsWith('/') ? `${value}**` : value;
  const escaped = matchPattern.replace(/[|\\{}()[\]^$+?.]/g, '\\$&');
  const regexSource = escaped
    .replace(/\\\*\\\*/g, '.*')
    .replace(/\\\*/g, '[^/]*');
  const expression = new RegExp(`^${regexSource}$`);

  const basename = normalized.split('/').pop();
  const dirPrefix = normalized.includes('/') ? normalized.split('/').slice(0, -1).join('/') : '';

  if (value.endsWith('/')) {
    return normalized.startsWith(value) || normalized.includes(`/${value}`);
  }

  return (
    expression.test(normalized) ||
    expression.test(basename) ||
    (dirPrefix && new RegExp(`^${regexSource.replace(/\^\$|\$\^/g, '')}$`).test(dirPrefix))
  );
}

function readCodexaIgnore(root) {
  const path = resolve(root, '.codexaignore');
  if (!existsSync(path)) return [];
  return readFileSync(path, 'utf8').split(/\r?\n/).map(line => line.trim()).filter(Boolean);
}

function isIgnored(patterns, file) {
  let ignored = false;
  for (const rawPattern of patterns) {
    const negated = rawPattern.startsWith('!');
    const pattern = negated ? rawPattern.slice(1) : rawPattern;
    if (matchesIgnore(pattern, file)) ignored = !negated;
  }
  return ignored;
}

export async function discoverSupportedFiles(repoPath = process.cwd(), config = {}) {
  const root = repositoryRoot(repoPath);
  const adapters = await getEnabledAdapters(root);
  const extensions = new Set(adapters.flatMap(adapter => adapter.extensions));
  const ignored = [...(config.ignore || []), ...readCodexaIgnore(root)];
  return runGit(['ls-files', '-co', '--exclude-standard', '-z'], root)
    .split('\0')
    .filter(Boolean)
    .map(file => file.replace(/\\/g, '/'))
    .filter(file => !BUILTIN_EXCLUDES.has(file.split('/')[0]))
    .filter(file => extensions.has(extname(file)))
    .filter(file => !isIgnored(ignored, file))
    .sort()
    .map(file => resolve(root, file));
}

export function relativeRepositoryPath(filePath, repoPath) {
  return relative(repositoryRoot(repoPath), resolve(filePath)).replace(/\\/g, '/');
}