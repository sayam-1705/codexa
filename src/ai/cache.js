/**
 * Suggestion cache system
 * Caches AI suggestions to avoid redundant model calls
 * Cache key = SHA-256 of error context
 */

import { createHash } from 'crypto';
import { existsSync, readFileSync, writeFileSync, readdirSync, unlinkSync, statSync } from 'fs';
import { resolve, join } from 'path';
import { mkdirSync } from 'fs';
import { homedir } from 'os';

const CACHE_DIR = resolve(homedir(), '.codexa', 'cache', 'suggestions');

/**
 * Generate cache key from error context
 */
function generateCacheKey(error, fileLines) {
  // Get context around the error
  const errorLine = error.line - 1;
  const contextStart = Math.max(0, errorLine - 5);
  const contextEnd = Math.min(fileLines.length, errorLine + 6);
  const contextLines = fileLines.slice(contextStart, contextEnd).join('\n');

  // Normalize whitespace
  const normalized = contextLines.replace(/\s+/g, ' ').trim();

  // Create key
  const keyStr = `${error.rule}:${error.language}:${error.line}:${normalized}`;
  return createHash('sha256').update(keyStr).digest('hex');
}

/**
 * Get cached suggestion
 */
export function getCachedSuggestion(error, fileLines) {
  try {
    const key = generateCacheKey(error, fileLines);
    const cacheFile = resolve(CACHE_DIR, `${key}.json`);

    if (!existsSync(cacheFile)) {
      return null;
    }

    const data = JSON.parse(readFileSync(cacheFile, 'utf8'));
    return data;
  } catch (err) {
    return null;
  }
}

/**
 * Save suggestion to cache
 */
export function saveSuggestion(error, fileLines, suggestion) {
  try {
    mkdirSync(CACHE_DIR, { recursive: true });

    const key = generateCacheKey(error, fileLines);
    const cacheFile = resolve(CACHE_DIR, `${key}.json`);

    let cacheEntry = {
      key,
      rule: error.rule,
      language: error.language,
      suggestion,
      cachedAt: new Date().toISOString(),
      hitCount: 1,
    };

    // If already exists, increment hit count
    if (existsSync(cacheFile)) {
      const existing = JSON.parse(readFileSync(cacheFile, 'utf8'));
      cacheEntry.hitCount = (existing.hitCount || 1) + 1;
      cacheEntry.cachedAt = existing.cachedAt; // Keep original cache time
    }

    writeFileSync(cacheFile, JSON.stringify(cacheEntry, null, 2), 'utf8');
  } catch (err) {
    // Silent fail
  }
}

/**
 * Clear all cache entries
 */
export function clearCache() {
  try {
    if (!existsSync(CACHE_DIR)) {
      return 0;
    }

    const files = readdirSync(CACHE_DIR).filter((f) => f.endsWith('.json'));
    let count = 0;

    for (const file of files) {
      try {
        unlinkSync(resolve(CACHE_DIR, file));
        count++;
      } catch (e) {
        // Continue on individual delete failures
      }
    }

    return count;
  } catch (err) {
    return 0;
  }
}

/**
 * Get cache statistics
 */
export function getCacheStats() {
  try {
    if (!existsSync(CACHE_DIR)) {
      return {
        totalEntries: 0,
        totalSizeBytes: 0,
        oldestEntry: null,
        mostHitRule: null,
        ruleStats: {},
      };
    }

    const files = readdirSync(CACHE_DIR).filter((f) => f.endsWith('.json'));
    let totalSize = 0;
    let oldestTime = Date.now();
    let oldestFile = null;
    const ruleStats = {};
    let maxHits = 0;
    let mostHitRule = null;

    for (const file of files) {
      const filePath = resolve(CACHE_DIR, file);
      const stat = statSync(filePath);
      totalSize += stat.size;

      if (stat.mtimeMs < oldestTime) {
        oldestTime = stat.mtimeMs;
        oldestFile = file;
      }

      try {
        const data = JSON.parse(readFileSync(filePath, 'utf8'));
        const rule = data.rule || 'unknown';
        if (!ruleStats[rule]) {
          ruleStats[rule] = { count: 0, totalHits: 0 };
        }
        ruleStats[rule].count++;
        ruleStats[rule].totalHits += data.hitCount || 1;

        if ((data.hitCount || 1) > maxHits) {
          maxHits = data.hitCount || 1;
          mostHitRule = rule;
        }
      } catch (e) {
        // Continue
      }
    }

    return {
      totalEntries: files.length,
      totalSizeBytes: totalSize,
      oldestEntry: oldestFile ? new Date(oldestTime).toISOString() : null,
      mostHitRule,
      ruleStats,
    };
  } catch (err) {
    return {
      totalEntries: 0,
      totalSizeBytes: 0,
      oldestEntry: null,
      mostHitRule: null,
    };
  }
}
