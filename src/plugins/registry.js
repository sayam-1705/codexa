/**
 * Adapter registry - single source of truth for installed adapters
 * Registry lives at ~/.codexa/adapters.json (personal, never committed)
 */

import { homedir } from 'os';
import { resolve, dirname } from 'path';
import { readFileSync, writeFileSync, existsSync, mkdirSync, renameSync, rmSync } from 'fs';
import { execFileSync } from 'child_process';
import { loadAdapter } from './loader.js';

const npmExecutable = process.platform === 'win32' ? 'npm.cmd' : 'npm';

function getRegistryPath() {
  const baseDir = process.env.CODEXA_HOME || resolve(homedir(), '.codexa');
  return resolve(baseDir, 'adapters.json');
}

// Hardcoded community registry - updated when new CLI versions ship
const COMMUNITY_REGISTRY = [
  { name: 'go', package: 'codexa-adapter-go', linter: 'golangci-lint', status: 'not-published' },
  { name: 'rust', package: 'codexa-adapter-rust', linter: 'clippy', status: 'not-published' },
  { name: 'ruby', package: 'codexa-adapter-ruby', linter: 'RuboCop', status: 'not-published' },
  { name: 'java', package: 'codexa-adapter-java', linter: 'Checkstyle', status: 'not-published' },
];

/**
 * Load registry from ~/.codexa/adapters.json
 * If missing, initialize with built-in adapters
 * @returns {Object} - Registry object
 */
export function loadRegistry() {
  const registryPath = getRegistryPath();
  if (existsSync(registryPath)) {
    try {
      const content = readFileSync(registryPath, 'utf8');
      const registry = JSON.parse(content);
      if (!registry || typeof registry !== 'object' || !Array.isArray(registry.adapters)) {
        throw new Error('registry must contain an adapters array');
      }
      return registry;
    } catch (err) {
      console.error(
        `Could not read adapter registry at ${registryPath}: ${err.message}\n` +
        'Resetting registry to defaults.'
      );
      // Reset corrupted registry to defaults and continue
      try {
        rmSync(registryPath);
      } catch {
        // Best-effort removal
      }
    }
  }

  // Initialize default registry with built-ins
  const defaultRegistry = {
    version: 1,
    adapters: [
      {
        name: 'javascript',
        package: 'builtin',
        version: '0.1.0',
        installedAt: new Date().toISOString(),
        enabled: true,
      },
      {
        name: 'python',
        package: 'builtin',
        version: '0.1.0',
        installedAt: new Date().toISOString(),
        enabled: true,
      },
    ],
  };

  // Ensure directory exists
  try {
    mkdirSync(dirname(registryPath), { recursive: true });
    writeFileSync(registryPath, JSON.stringify(defaultRegistry, null, 2), 'utf8');
  } catch (err) {
    // Gracefully continue with in-memory defaultRegistry in read-only environments
  }

  return defaultRegistry;
}

/**
 * Save registry to ~/.codexa/adapters.json
 * @param {Object} registry - Registry object to save
 */
function saveRegistry(registry) {
  const registryPath = getRegistryPath();
  mkdirSync(dirname(registryPath), { recursive: true });
  const tempPath = `${registryPath}.${process.pid}.${Date.now()}.tmp`;
  try {
    writeFileSync(tempPath, JSON.stringify(registry, null, 2), 'utf8');
    renameSync(tempPath, registryPath);
  } catch (error) {
    try {
      if (existsSync(tempPath)) rmSync(tempPath);
    } catch {
      // Preserve the original registry if temporary-file cleanup fails.
    }
    throw error;
  }
}

/**
 * Get all enabled adapters, loaded and validated
 * @param {string} repoPath - Repository path (for detect() calls)
 * @returns {Promise<Object[]>} - Array of loaded, wrapped adapters
 */
export async function getEnabledAdapters() {
  const registry = loadRegistry();
  const enabledEntries = registry.adapters.filter((a) => a.enabled !== false);

  const loadResults = await Promise.all(enabledEntries.map(async (entry) => {
    const packageName =
      entry.package === 'builtin' ? `builtin:${entry.name}` : entry.package;
    try {
      return { entry, adapter: await loadAdapter(packageName) };
    } catch (err) {
      return {
        entry,
        error: new Error(
          `Failed to load enabled adapter '${entry.name}': ${err.message}. ` +
          `Fix: reinstall it with codexa add-language ${entry.package}.`,
          { cause: err }
        ),
      };
    }
  }));

  const adapters = loadResults.filter((result) => result.adapter).map((result) => result.adapter);
  const failures = loadResults
    .filter((result) => result.error)
    .map((result) => ({ name: result.entry.name, package: result.entry.package, error: result.error.message }));

  for (const failure of failures) {
    console.error(`[adapter:${failure.name}] ${failure.error}`);
  }
  Object.defineProperty(adapters, 'failedAdapters', { value: failures, enumerable: false });
  return adapters.filter(Boolean);
}

/**
 * Install a community adapter from npm
 * @param {string} packageName - npm package name (e.g., 'codexa-adapter-go')
 * @returns {Object} - Adapter metadata
 * @throws {Error} - If installation or validation fails
 */
export async function installAdapter(packageName) {
  const communityEntry = COMMUNITY_REGISTRY.find((entry) => entry.package === packageName);
  if (communityEntry?.status === 'not-published') {
    throw new Error(
      `${packageName} is listed as a planned community adapter but is not published on npm yet. ` +
      'Use the adapter template in templates/adapter-template or install a published adapter package.'
    );
  }

  const baseDir = process.env.CODEXA_HOME || resolve(homedir(), '.codexa');
  const packagesDir = resolve(baseDir, 'packages');
  mkdirSync(packagesDir, { recursive: true });

  const pkgJsonPath = resolve(packagesDir, 'package.json');
  if (!existsSync(pkgJsonPath)) {
    writeFileSync(pkgJsonPath, JSON.stringify({ name: 'codexa-packages', private: true }, null, 2), 'utf8');
  }

  // Install
  try {
    console.log(`Installing ${packageName} from npm...`);
    execFileSync(npmExecutable, ['install', '--save', packageName], {
      cwd: packagesDir,
      stdio: 'inherit',
    });
  } catch (err) {
    throw new Error(
      `Failed to install ${packageName}.\n` +
      'Fix: verify the package name, run npm whoami to confirm npm access, then retry codexa add-language.'
    );
  }

  // Load and validate
  let adapter;
  try {
    adapter = await loadAdapter(packageName, baseDir);
  } catch (err) {
    // Uninstall on validation failure
    try {
      execFileSync(npmExecutable, ['uninstall', packageName], { cwd: packagesDir, stdio: 'ignore' });
    } catch (e) {
      // Ignore uninstall errors
    }
    throw new Error(
      `Adapter validation failed for ${packageName}: ${err.message}.\n` +
      'Fix: check that the package exports a valid Codexa adapter interface.'
    );
  }

  // Inspect package.json or node_modules to find resolved version
  let resolvedVersion = adapter.version;
  try {
    const installedPkgJson = resolve(packagesDir, 'node_modules', packageName, 'package.json');
    if (existsSync(installedPkgJson)) {
      const data = JSON.parse(readFileSync(installedPkgJson, 'utf8'));
      if (data.version) {
        resolvedVersion = data.version;
      }
    }
  } catch {
    // Fall back to adapter.version
  }

  // Add to registry
  const registry = loadRegistry();
  const existing = registry.adapters.findIndex((a) => a.name === adapter.language);

  const entry = {
    name: adapter.language,
    package: packageName,
    version: resolvedVersion || adapter.version,
    resolvedVersion: resolvedVersion || adapter.version,
    installedAt: new Date().toISOString(),
    enabled: true,
  };

  if (existing >= 0) {
    registry.adapters[existing] = entry;
  } else {
    registry.adapters.push(entry);
  }

  saveRegistry(registry);

  return {
    name: adapter.name,
    language: adapter.language,
    extensions: adapter.extensions,
    linter: adapter.linter,
    version: entry.version,
    license: adapter.license,
  };
}

/**
 * Remove an adapter from registry and uninstall package from disk
 * @param {string} name - Adapter language name
 * @returns {Object} - { removed: boolean }
 * @throws {Error} - If removing a built-in adapter
 */
export function removeAdapter(name) {
  const registry = loadRegistry();
  const entry = registry.adapters.find((a) => a.name === name);

  if (!entry) {
    throw new Error(
      `Adapter not found: ${name}.\n` +
      'Fix: run codexa list-languages to see installed adapters, then retry remove-language.'
    );
  }

  if (entry.package === 'builtin') {
    throw new Error('Cannot remove built-in adapters.');
  }

  const baseDir = process.env.CODEXA_HOME || resolve(homedir(), '.codexa');
  const packagesDir = resolve(baseDir, 'packages');

  // Attempt to uninstall the npm package
  if (existsSync(packagesDir) && entry.package) {
    try {
      execFileSync(npmExecutable, ['uninstall', entry.package], {
        cwd: packagesDir,
        stdio: 'ignore',
      });
    } catch {
      // Best-effort package uninstall
    }
  }

  registry.adapters = registry.adapters.filter((a) => a.name !== name);
  saveRegistry(registry);

  return { removed: true };
}

/**
 * List all adapters (installed and known community)
 * @returns {Object} - { installed: [], community: [] }
 */
export function listAdapters() {
  const registry = loadRegistry();

  const installed = registry.adapters.map((a) => ({
    ...a,
    isBuiltin: a.package === 'builtin',
  }));

  const installedLanguages = new Set(installed.map((a) => a.name));
  const community = COMMUNITY_REGISTRY.filter(
    (c) => !installedLanguages.has(c.name)
  );

  return { installed, community };
}
