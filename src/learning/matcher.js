/**
 * Pattern matcher
 * Finds previously-fixed patterns that match current errors
 * Uses fuzzy scoring to find related fixes
 */

import { getPatternsForRule } from './patterns.js';

/**
 * Find a matching pattern for the current error
 * Returns { pattern, score, message } or null if no match >= 80
 */
export function findMatchingPattern(error, fileLines, repoPath) {
  try {
    // Get candidate patterns
    const patterns = getPatternsForRule(repoPath, error.rule, error.language);

    if (!patterns.length) {
      return null;
    }

    // Score each pattern
    const scored = patterns.map((pattern) => ({
      pattern,
      score: scorePattern(pattern, error, fileLines),
    }));

    // Sort by score descending
    scored.sort((a, b) => b.score - a.score);

    const best = scored[0];

    // Return match if score >= 80
    if (best.score >= 80) {
      const message = buildMessage(best.pattern);
      return {
        pattern: best.pattern,
        score: best.score,
        message,
      };
    }

    return null;
  } catch (err) {
    return null;
  }
}

/**
 * Score a pattern against current error
 * Exact rule match: +50
 * Same language: +20
 * Before text in file: +30
 * Same file: +10
 */
function scorePattern(pattern, error, fileLines) {
  let score = 0;

  // Exact rule match
  if (pattern.rule === error.rule) {
    score += 50;
  }

  // Same language
  if (pattern.language === error.language) {
    score += 20;
  }

  // Before text appears in current file context
  if (pattern.before && fileLines.join('\n').includes(pattern.before)) {
    score += 30;
  }

  // Same file
  if (pattern.file === error.file) {
    score += 10;
  }

  return score;
}

/**
 * Build human-readable message for pattern match
 */
function buildMessage(pattern) {
  const date = new Date(pattern.timestamp);
  const dateStr = date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
  });

  return `You fixed this same pattern in ${pattern.file} on ${dateStr} — apply again?`;
}

/**
 * Apply a pattern fix to current file
 * Returns updated content
 */
export function applyPatternFix(fileContent, pattern) {
  // Simple string replacement
  // In production, this could be more sophisticated (AST-based, etc.)
  if (pattern.before && pattern.after) {
    return fileContent.replace(pattern.before, pattern.after);
  }
  return fileContent;
}
