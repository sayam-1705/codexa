/**
 * History logging system
 * Tracks every linting session in .codexa/history.json
 */

import { existsSync, readFileSync, writeFileSync, mkdirSync } from 'fs';
import { resolve } from 'path';

const CODEXA_DIR = '.codexa';
const HISTORY_FILE = 'history.json';
const MAX_ENTRIES = 500;

/**
 * Load history from .codexa/history.json
 */
export function loadHistory(repoPath) {
  try {
    const historyPath = resolve(repoPath, CODEXA_DIR, HISTORY_FILE);

    if (!existsSync(historyPath)) {
      return [];
    }

    const content = readFileSync(historyPath, 'utf8');
    return JSON.parse(content);
  } catch (err) {
    return [];
  }
}

/**
 * Log a commit check to history
 */
export function logCommitCheck(repoPath, summary) {
  try {
    mkdirSync(resolve(repoPath, CODEXA_DIR), { recursive: true });

    let history = loadHistory(repoPath);

    const entry = {
      timestamp: new Date().toISOString(),
      filesChecked: summary.filesChecked || 0,
      errorsFound: summary.errorsFound || 0,
      errorsBlocked: summary.errorsBlocked || 0,
      fixesAccepted: summary.fixesAccepted || 0,
      aiQueriesMade: summary.aiQueriesMade || 0,
      patternHits: summary.patternHits || 0,
      commitAllowed: summary.commitAllowed || false,
    };

    history.push(entry);

    // Keep only last MAX_ENTRIES
    if (history.length > MAX_ENTRIES) {
      history = history.slice(-MAX_ENTRIES);
    }

    const historyPath = resolve(repoPath, CODEXA_DIR, HISTORY_FILE);
    writeFileSync(historyPath, JSON.stringify(history, null, 2), 'utf8');

    return entry;
  } catch (err) {
    throw err;
  }
}

/**
 * Get history entries (newest first)
 */
export function getHistory(repoPath, limit = 20) {
  try {
    const history = loadHistory(repoPath);
    return history.reverse().slice(0, limit);
  } catch (err) {
    return [];
  }
}

/**
 * Get history statistics
 */
export function getHistoryStats(repoPath) {
  try {
    const history = loadHistory(repoPath);

    if (!history.length) {
      return {
        totalChecks: 0,
        totalErrors: 0,
        blockedCommits: 0,
        successRate: 0,
        averageErrorsPerCheck: 0,
      };
    }

    const totalErrors = history.reduce((sum, e) => sum + (e.errorsFound || 0), 0);
    const blockedCommits = history.filter((e) => !e.commitAllowed).length;
    const successRate = history.filter((e) => e.commitAllowed).length / history.length;

    return {
      totalChecks: history.length,
      totalErrors,
      blockedCommits,
      successRate: Math.round(successRate * 100),
      averageErrorsPerCheck: Math.round(totalErrors / history.length),
      recentActivity: history.slice(0, 5),
    };
  } catch (err) {
    return null;
  }
}
