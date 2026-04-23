/**
 * Adapter registry - single source of truth for installed adapters
 * Registry lives at ~/.codexa/adapters.json (personal, never committed)
 */

import { homedir } from 'os';
import { resolve, dirname } from 'path';
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs';
import { execSync } from 'child_process';
import { loadAdapter } from './loader.js';

const REGISTRY_PATH = resolve(homedir(), '.codexa', 'adapters.json');

// Hardcoded community registry - updated when new CLI versions ship
const COMMUNITY_REGISTRY = [
  { name: 'go', package: 'codexa-adapter-go', linter: 'golangci-lint' },
  { name: 'rust', package: 'codexa-adapter-rust', linter: 'clippy' },
  { name: 'ruby', package: 'codexa-adapter-ruby', linter: 'RuboCop' },
  { name: 'java', package: 'codexa-adapter-java', linter: 'Checkstyle' },
];

/**
 * Load registry from ~/.codexa/adapters.json
 * If missing, initialize with built-in adapters
 * @returns {Object} - Registry object
 */
export function loadRegistry() {
  if (existsSync(REGISTRY_PATH)) {
    try {
      const content = readFileSync(REGISTRY_PATH, 'utf8');
      return JSON.parse(content);
    } catch (err) {
      console.error(
        `Could not read adapter registry at ${REGISTRY_PATH}: ${err.message}\n` +
        'Fix: delete the corrupted file and run codexa list-languages to regenerate defaults.'
      );
      // Fall through to initialize default
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
  mkdirSync(dirname(REGISTRY_PATH), { recursive: true });
  writeFileSync(REGISTRY_PATH, JSON.stringify(defaultRegistry, null, 2), 'utf8');

  return defaultRegistry;
}

/**
 * Save registry to ~/.codexa/adapters.json
 * @param {Object} registry - Registry object to save
 */
function saveRegistry(registry) {
  mkdirSync(dirname(REGISTRY_PATH), { recursive: true });
  writeFileSync(REGISTRY_PATH, JSON.stringify(registry, null, 2), 'utf8');
}

/**
 * Get all enabled adapters, loaded and validated
 * @param {string} repoPath - Repository path (for detect() calls)
 * @returns {Promise<Object[]>} - Array of loaded, wrapped adapters
 */
export async function getEnabledAdapters() {
  const registry = loadRegistry();
  const enabledEntries = registry.adapters.filter((a) => a.enabled !== false);

  // Load all adapters in parallel
  const loadPromises = enabledEntries.map(async (entry) => {
    const packageName =
      entry.package === 'builtin' ? `builtin:${entry.name}` : entry.package;
    try {
      return await loadAdapter(packageName);
    } catch (err) {
      console.error(
        `Failed to load adapter '${entry.name}': ${err.message}\n` +
        `Fix: reinstall it with codexa add-language ${entry.package}.`
      );
      return null;
    }
  });

  const adapters = await Promise.all(loadPromises);
  return adapters.filter(Boolean);
}

/**
 * Install a community adapter from npm
 * @param {string} packageName - npm package name (e.g., 'codexa-adapter-go')
 * @returns {Object} - Adapter metadata
 * @throws {Error} - If installation or validation fails
 */
export async function installAdapter(packageName) {
  // Install globally
  try {
    console.log(`Installing ${packageName} from npm...`);
    execSync(`npm install -g ${packageName}`, {
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
    adapter = await loadAdapter(packageName);
  } catch (err) {
    // Uninstall on validation failure
    try {
      execSync(`npm uninstall -g ${packageName}`, { stdio: 'ignore' });
    } catch (e) {
      // Ignore uninstall errors
    }
    throw new Error(
      `Adapter validation failed for ${packageName}: ${err.message}.\n` +
      'Fix: check that the package exports a valid Codexa adapter interface.'
    );
  }

  // Add to registry
  const registry = loadRegistry();
  const existing = registry.adapters.findIndex((a) => a.name === adapter.language);

  const entry = {
    name: adapter.language,
    package: packageName,
    version: adapter.version,
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
    version: adapter.version,
    license: adapter.license,
  };
}

/**
 * Remove an adapter from registry
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
