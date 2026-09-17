import { existsSync, readFileSync } from 'fs';
import { extname, relative, resolve } from 'path';
import { runGit, repositoryRoot } from '../git/command.js';
import { getEnabledAdapters } from '../plugins/registry.js';

const BUILTIN_EXCLUDES = new Set(['.git']);

function matchesIgnore(pattern, file) {
  const normalized = file.replace(/\\/g, '/');
  const anchored = pattern.startsWith('/');
  const value = pattern.replace(/^\//, '').replace(/\\/g, '/').replace(/\/$/, '');
  if (!value || value.startsWith('#')) return false;

  const regexSource = value
    .split('**')
    .map((part) => part.replace(/[|\\{}()[\]^$+?.]/g, '\\$&').replace(/\*/g, '[^/]*'))
    .join('.*');
  const expression = new RegExp(`^${regexSource}$`);
  const segments = normalized.split('/');

  if (anchored || value.includes('/')) {
    return expression.test(normalized) || expression.test(`${normalized}/`);
  }

  return segments.some((segment) => expression.test(segment));
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
  const adapters = selectAdapters(await getEnabledAdapters(root), config.languages);
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

function selectAdapters(adapters, languages = ['auto']) {
  const normalizedLanguages = Array.isArray(languages) ? languages.map((language) => language.toLowerCase()) : languages;
  if (!Array.isArray(normalizedLanguages) || normalizedLanguages.length === 0 || normalizedLanguages.includes('auto')) {
    return adapters;
  }
  const selected = new Set(normalizedLanguages);
  return adapters.filter((adapter) =>
    selected.has(adapter.language.toLowerCase()) ||
    (selected.has('typescript') && adapter.language.toLowerCase() === 'javascript')
  );
}

export function relativeRepositoryPath(filePath, repoPath) {
  let root = repositoryRoot(repoPath);
  let resolvedFile = resolve(filePath);
  
  if (process.platform === 'win32') {
    // Normalize drive letters to uppercase to avoid relative() bailing out
    if (root.match(/^[a-zA-Z]:/)) {
      root = root.charAt(0).toUpperCase() + root.slice(1);
    }
    if (resolvedFile.match(/^[a-zA-Z]:/)) {
      resolvedFile = resolvedFile.charAt(0).toUpperCase() + resolvedFile.slice(1);
    }
  }
  
  return relative(root, resolvedFile).replace(/\\/g, '/');
}