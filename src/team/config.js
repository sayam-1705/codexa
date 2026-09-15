import { cosmiconfig } from 'cosmiconfig';
import { existsSync, writeFileSync } from 'fs';
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
  adapterFailurePolicy: 'fail',
  _codexaSchema: 2,
};

const CURRENT_CONFIG_SCHEMA = 2;

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

  if (!config || typeof config !== 'object' || Array.isArray(config)) {
    return { valid: false, errors: ['configuration must be an object'] };
  }

  // Check version
  if (typeof config.version !== 'number' || !Number.isInteger(config.version) || config.version < 1) {
    errors.push(`version must be a positive integer (got: ${config.version})`);
  }

  if (config._codexaSchema !== undefined &&
      (typeof config._codexaSchema !== 'number' || !Number.isInteger(config._codexaSchema) || config._codexaSchema < 1)) {
    errors.push(`_codexaSchema must be a positive integer (got: ${config._codexaSchema})`);
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
  if (config.severity === undefined || config.severity === null || typeof config.severity !== 'object' || Array.isArray(config.severity)) {
    errors.push('severity must be an object');
  } else {
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

  if (config.ignore !== undefined &&
      (!Array.isArray(config.ignore) || config.ignore.some((pattern) => typeof pattern !== 'string' || !pattern.trim()))) {
    errors.push('ignore must be an array of non-empty strings');
  }

  // Check team settings
  if (config.team !== undefined) {
    if (config.team === null || typeof config.team !== 'object' || Array.isArray(config.team)) {
      errors.push('team must be an object');
      return { valid: false, errors };
    }
    if (config.team.name !== undefined && (typeof config.team.name !== 'string' || !config.team.name.trim())) {
      errors.push('team.name must be a non-empty string');
    }
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
    if (config.team.leaderboard !== undefined) {
      const leaderboard = config.team.leaderboard;
      if (!leaderboard || typeof leaderboard !== 'object' || Array.isArray(leaderboard)) {
        errors.push('team.leaderboard must be an object');
      } else {
        if (leaderboard.enabled !== undefined && typeof leaderboard.enabled !== 'boolean') {
          errors.push('team.leaderboard.enabled must be a boolean');
        }
        if (leaderboard.optIn !== undefined && typeof leaderboard.optIn !== 'boolean') {
          errors.push('team.leaderboard.optIn must be a boolean');
        }
        if (leaderboard.metrics !== undefined &&
            (!Array.isArray(leaderboard.metrics) || leaderboard.metrics.some((metric) => typeof metric !== 'string'))) {
          errors.push('team.leaderboard.metrics must be an array of strings');
        }
      }
    }
  }

  // Check adapter failure policy
  const validPolicies = ['fail', 'warn', 'ignore'];
  if (config.adapterFailurePolicy !== undefined) {
    if (typeof config.adapterFailurePolicy !== 'string' || !validPolicies.includes(config.adapterFailurePolicy)) {
      errors.push(
        `adapterFailurePolicy must be one of: ${validPolicies.join(', ')} (got: ${config.adapterFailurePolicy})`
      );
    }
  }

  // Check CI settings
  if (config.ci !== undefined) {
    if (config.ci === null || typeof config.ci !== 'object' || Array.isArray(config.ci)) {
      errors.push('ci must be an object');
      return { valid: false, errors };
    }
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
  const configVersion = config._codexaSchema || 1;

  const configSchemaMajor = Number.parseInt(String(configVersion), 10);
  if (Number.isFinite(configSchemaMajor) && configSchemaMajor > CURRENT_CONFIG_SCHEMA) {
    console.warn(
      `\x1b[33mWARNING\x1b[0m: Config schema ${configVersion} is newer than supported schema ${CURRENT_CONFIG_SCHEMA}`
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
