import { cosmiconfig } from 'cosmiconfig';
import { existsSync, readFileSync, writeFileSync } from 'fs';
import { resolve } from 'path';
import { readFile } from 'fs/promises';
import { loadRegistry } from '../plugins/registry.js';

const DEFAULT_CONFIG = {
  version: 2,
  blameMode: 'strict',
  languages: ['auto'],
  severity: {
    block: ['CRITICAL'],
    warn: ['MODERATE'],
    log: ['MINOR'],
    overrides: {},
  },
  ignore: [
    'node_modules',
    '.git',
    'dist',
    'build',
    '__pycache__',
    '*.min.js',
    'migrations/',
  ],
  team: {
    name: 'Engineering',
    enforceOnCI: true,
    blockThreshold: 1,
    allowForceCommit: true,
    forceCommitRequiresReason: true,
  },
  ci: {
    outputFormat: 'json',
    postPRComment: true,
    failOn: 'CRITICAL',
    badge: true,
  },
  _codexaSchema: '1.1.1',
};

/**
 * Load and validate Codexa configuration from repo.
 * @param {string} repoPath - Repository path
 * @returns {Object} - Merged and validated config
 */
export async function loadConfig(repoPath) {
  const explorer = cosmiconfig('codexa', {
    searchPlaces: [
      'codexa.config.json',
      'codexa.config.js',
      'codexa.config.cjs',
      'codexa.config.mjs',
      'package.json',
    ],
  });
  const result = await explorer.search(repoPath);

  let config = structuredClone(DEFAULT_CONFIG);

  if (result && result.config) {
    // Deep merge found config over defaults
    config = deepMerge(DEFAULT_CONFIG, result.config);
  }

  // Load and merge .codexaignore patterns
  const ignorePatterns = await getIgnorePatterns(repoPath);
  if (ignorePatterns.length > 0) {
    config.ignore = [...new Set([...config.ignore, ...ignorePatterns])];
  }

  // Validate config
  const validation = validateConfig(config);
  if (!validation.valid) {
    throw new Error(`Invalid config:\n${validation.errors.join('\n')}`);
  }

  // Check version compatibility
  checkVersionCompat(config);

  return config;
}

/**
 * Validate config schema. Never throws.
 * @param {Object} config - Config to validate
 * @returns {Object} - { valid: Boolean, errors: String[] }
 */
export function validateConfig(config) {
  const errors = [];

  // Check version
  if (typeof config.version !== 'number') {
    errors.push(`version must be a number (got: ${typeof config.version})`);
  }

  // Check blameMode
  const validBlameModes = ['strict', 'warn', 'off'];
  if (!validBlameModes.includes(config.blameMode)) {
    errors.push(
      `blameMode must be one of: ${validBlameModes.join(', ')} (got: ${config.blameMode})`
    );
  }

  // Check languages
  const validLanguages = ['auto', 'javascript', 'python', 'typescript'];
  if (!Array.isArray(config.languages)) {
    errors.push(`languages must be an array (got: ${typeof config.languages})`);
  } else {
    for (const lang of config.languages) {
      if (typeof lang !== 'string' || !lang.trim()) {
        errors.push(`languages must contain non-empty strings`);
      } else if (!validLanguages.includes(lang.toLowerCase())) {
        // Also check if installed in registry
        try {
          const reg = loadRegistry();
          const isInstalled = reg.adapters.some((a) => a.name === lang.toLowerCase());
          if (!isInstalled) {
            errors.push(`Unknown or unsupported language in languages array: ${lang}`);
          }
        } catch {
          errors.push(`Unknown or unsupported language in languages array: ${lang}`);
        }
      }
    }
  }

  // Check severity arrays
  if (config.severity) {
    const validSeverities = ['CRITICAL', 'MODERATE', 'MINOR'];

    for (const key of ['block', 'warn', 'log']) {
      if (!Array.isArray(config.severity[key])) {
        errors.push(`severity.${key} must be an array`);
      } else {
        for (const sev of config.severity[key]) {
          if (!validSeverities.includes(sev)) {
            errors.push(`severity.${key} contains invalid value: ${sev}`);
          }
        }
      }
    }

    // Check overrides
    if (config.severity.overrides) {
      if (typeof config.severity.overrides !== 'object' || Array.isArray(config.severity.overrides)) {
        errors.push('severity.overrides must be an object');
      } else {
        for (const [rule, sev] of Object.entries(config.severity.overrides)) {
          if (!validSeverities.includes(sev)) {
            errors.push(
              `severity.overrides.${rule} must be CRITICAL | MODERATE | MINOR (got: ${sev})`
            );
          }
        }
      }
    }
  }

  // Check team settings
  if (config.team) {
    if (
      typeof config.team.blockThreshold !== 'number' ||
      !Number.isInteger(config.team.blockThreshold) ||
      config.team.blockThreshold <= 0
    ) {
      errors.push(
        `team.blockThreshold must be a positive integer (got: ${config.team.blockThreshold})`
      );
    }
    if (config.team.enforceOnCI !== undefined && typeof config.team.enforceOnCI !== 'boolean') {
      errors.push(`team.enforceOnCI must be a boolean (got: ${typeof config.team.enforceOnCI})`);
    }
    if (config.team.allowForceCommit !== undefined && typeof config.team.allowForceCommit !== 'boolean') {
      errors.push(`team.allowForceCommit must be a boolean`);
    }
    if (config.team.forceCommitRequiresReason !== undefined && typeof config.team.forceCommitRequiresReason !== 'boolean') {
      errors.push(`team.forceCommitRequiresReason must be a boolean`);
    }
  }

  // Check CI settings
  if (config.ci) {
    const validFailOn = ['CRITICAL', 'MODERATE', 'any'];
    if (!validFailOn.includes(config.ci.failOn)) {
      errors.push(
        `ci.failOn must be one of: ${validFailOn.join(', ')} (got: ${config.ci.failOn})`
      );
    }
    const validFormats = ['json', 'sarif', 'text'];
    if (config.ci.outputFormat && !validFormats.includes(config.ci.outputFormat)) {
      errors.push(`ci.outputFormat must be one of: ${validFormats.join(', ')}`);
    }
    if (config.ci.postPRComment !== undefined && typeof config.ci.postPRComment !== 'boolean') {
      errors.push(`ci.postPRComment must be a boolean`);
    }
    if (config.ci.badge !== undefined && typeof config.ci.badge !== 'boolean') {
      errors.push(`ci.badge must be a boolean`);
    }
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

/**
 * Check version compatibility between config schema and CLI.
 * Warns if config is newer than CLI.
 * @param {Object} config - Config to check
 */
export function checkVersionCompat(config) {
  const cliVersion = JSON.parse(readFileSync(new URL('../../package.json', import.meta.url), 'utf8')).version;
  const configVersion = config._codexaSchema || '1.0.0';

  if (semverGreaterThan(configVersion, cliVersion)) {
    console.warn(
      `\x1b[33mWARNING\x1b[0m: Config schema ${configVersion} is newer than CLI ${cliVersion}`
    );
  }
}

/**
 * Get ignore patterns from .codexaignore file.
 * @param {string} repoPath - Repository path
 * @returns {Promise<string[]>} - Array of glob patterns
 */
export async function getIgnorePatterns(repoPath) {
  const ignoreFilePath = resolve(repoPath, '.codexaignore');

  if (!existsSync(ignoreFilePath)) {
    return [];
  }

  try {
    const content = await readFile(ignoreFilePath, 'utf8');
    return content
      .split('\n')
      .map((line) => line.trim())
      .filter((line) => line.length > 0 && !line.startsWith('#'));
  } catch (err) {
    console.warn(`Failed to read .codexaignore: ${err.message}`);
    return [];
  }
}

/**
 * Create default config file in repo.
 * @param {string} repoPath - Repository path
 * @param {Object} options - { team: Boolean, force: Boolean }
 * @returns {Boolean} - True if file was written
 */
export function createDefaultConfig(repoPath, options = {}) {
  const configPath = resolve(repoPath, 'codexa.config.json');

  if (existsSync(configPath) && !options.force) {
    return false;
  }

  let config = { ...DEFAULT_CONFIG };

  if (!options.team) {
    // Solo config: minimal setup
    config.team = {
      name: 'Solo Developer',
      enforceOnCI: false,
      blockThreshold: 1,
      requireModel: null,
      allowForceCommit: true,
      forceCommitRequiresReason: false,
    };
    config.ci = {
      outputFormat: 'json',
      postPRComment: false,
      failOn: 'CRITICAL',
      badge: false,
    };
  }

  writeFileSync(configPath, JSON.stringify(config, null, 2), 'utf8');
  return true;
}

/**
 * Get the current effective config (merged with defaults).
 * @param {string} repoPath - Repository path
 * @returns {Promise<Object>} - Effective config
 */
export async function getEffectiveConfig(repoPath) {
  return await loadConfig(repoPath);
}

// Helper functions

function deepMerge(target, source) {
  const result = { ...target };

  for (const key in source) {
    if (source[key] !== null && typeof source[key] === 'object' && !Array.isArray(source[key])) {
      result[key] = deepMerge(result[key] || {}, source[key]);
    } else if (source[key] !== undefined) {
      result[key] = source[key];
    }
  }

  return result;
}

function semverGreaterThan(v1, v2) {
  const parts1 = v1.split('.').map(Number);
  const parts2 = v2.split('.').map(Number);

  for (let i = 0; i < 3; i++) {
    const p1 = parts1[i] || 0;
    const p2 = parts2[i] || 0;

    if (p1 > p2) return true;
    if (p1 < p2) return false;
  }

  return false;
}
