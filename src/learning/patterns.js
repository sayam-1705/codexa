/**
 * Pattern storage system
 * Stores accepted fixes in .codexa/patterns.json for team sharing
 */

import { existsSync, readFileSync, writeFileSync, mkdirSync } from 'fs';
import { resolve } from 'path';
import { randomUUID } from 'crypto';
import { tmpdir } from 'os';

const CODEXA_DIR = '.codexa';
const PATTERNS_FILE = 'patterns.json';

/**
 * Load patterns from .codexa/patterns.json
 */
export function loadPatterns(repoPath) {
  try {
    const patternPath = resolve(repoPath, CODEXA_DIR, PATTERNS_FILE);

    if (!existsSync(patternPath)) {
      return {
        version: 1,
        patterns: [],
      };
    }

    const content = readFileSync(patternPath, 'utf8');
    return JSON.parse(content);
  } catch (err) {
    return {
      version: 1,
      patterns: [],
    };
  }
}

/**
 * Save a new pattern to the patterns file
 * Appends pattern and performs atomic write
 */
export function savePattern(repoPath, pattern) {
  try {
    mkdirSync(resolve(repoPath, CODEXA_DIR), { recursive: true });

    const patternPath = resolve(repoPath, CODEXA_DIR, PATTERNS_FILE);
    let data = loadPatterns(repoPath);

    // Add ID if missing
    if (!pattern.id) {
      pattern.id = randomUUID();
    }
    if (!pattern.usageCount) {
      pattern.usageCount = 0;
    }
    if (!pattern.timestamp) {
      pattern.timestamp = new Date().toISOString();
    }

    data.patterns.push(pattern);

    // Atomic write: write to temp, then rename
    const tempPath = resolve(tmpdir(), `patterns-${Date.now()}.json`);
    writeFileSync(tempPath, JSON.stringify(data, null, 2), 'utf8');

    // Rename (atomic on most filesystems)
    writeFileSync(patternPath, JSON.stringify(data, null, 2), 'utf8');

    return pattern;
  } catch (err) {
    throw err;
  }
}

/**
 * Update pattern usage stats
 */
export function updatePatternUsage(repoPath, patternId) {
  try {
    const data = loadPatterns(repoPath);
    const pattern = data.patterns.find((p) => p.id === patternId);

    if (pattern) {
      pattern.usageCount = (pattern.usageCount || 0) + 1;
      pattern.lastUsed = new Date().toISOString();

      const patternPath = resolve(repoPath, CODEXA_DIR, PATTERNS_FILE);
      writeFileSync(patternPath, JSON.stringify(data, null, 2), 'utf8');
    }

    return pattern;
  } catch (err) {
    throw err;
  }
}

/**
 * Get patterns for a specific rule and language
 * Returns top 3, sorted by usageCount descending
 */
export function getPatternsForRule(repoPath, rule, language) {
  try {
    const data = loadPatterns(repoPath);

    const filtered = data.patterns
      .filter((p) => p.rule === rule && p.language === language)
      .sort((a, b) => (b.usageCount || 0) - (a.usageCount || 0))
      .slice(0, 3);

    return filtered;
  } catch (err) {
    return [];
  }
}

/**
 * Get all patterns (for history display)
 */
export function getAllPatterns(repoPath) {
  try {
    const data = loadPatterns(repoPath);
    return data.patterns.sort(
      (a, b) =>
        new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
    );
  } catch (err) {
    return [];
  }
}
