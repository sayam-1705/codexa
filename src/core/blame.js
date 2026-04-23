import { getChangedLines } from '../git/diff.js';
import { BLAME_CATEGORIES } from './schema.js';

export async function buildChangedLinesMap(repoPath, stagedFiles) {
  const map = new Map();

  // Check which files are new (no git history yet)
  // We'll fetch diffs for all staged files in parallel
  const diffPromises = stagedFiles.map(async file => {
    try {
      const changedLines = await getChangedLines(repoPath, file);
      return { file, changedLines, isNew: false };
    } catch (err) {
      // If diff fails, assume it's a new file (all lines are changed)
      if (err.message && err.message.includes('no such path')) {
        return { file, changedLines: [{ start: 1, end: Infinity }], isNew: true };
      }
      // For any other error, return empty ranges (unknown)
      return { file, changedLines: [], isNew: false };
    }
  });

  const results = await Promise.all(diffPromises);

  for (const { file, changedLines } of results) {
    map.set(file, changedLines);
  }

  return map;
}

export function classifyByDiff(errors, changedLinesMap) {
  // Return new error objects with isInDiff and blameCategory set
  return errors.map(error => {
    const changedLines = changedLinesMap.get(error.file);

    if (!changedLines || changedLines.length === 0) {
      // File not in diff map or no changed lines - assume preexisting or unknown
      const newError = {
        ...error,
        isInDiff: false,
        blameCategory: BLAME_CATEGORIES.UNKNOWN,
      };
      return Object.freeze(newError);
    }

    // Check if error line falls within any changed range
    const isInDiff = changedLines.some(range => {
      return error.line >= range.start && error.line <= range.end;
    });

    const blameCategory = isInDiff ? BLAME_CATEGORIES.YOURS : BLAME_CATEGORIES.PREEXISTING;

    const newError = {
      ...error,
      isInDiff,
      blameCategory,
    };

    return Object.freeze(newError);
  });
}
