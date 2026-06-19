import { ESLint } from 'eslint';
import { createError, SEVERITIES } from '../core/schema.js';
import { buildEslintOptions } from './eslintConfig.js';

const eslintCache = new Map();

function getEslintInstance(respectProjectConfig) {
  const cacheKey = respectProjectConfig ? 'project' : 'default';
  if (!eslintCache.has(cacheKey)) {
    const options = buildEslintOptions({ respectProjectConfig });
    eslintCache.set(cacheKey, new ESLint(options));
  }
  return eslintCache.get(cacheKey);
}

export async function lintJavaScript(files, config = {}) {
  if (!files.length) {
    return [];
  }

  const jsFiles = files.filter(f => {
    const ext = f.slice(f.lastIndexOf('.'));
    return ['.js', '.jsx', '.mjs', '.cjs', '.ts', '.tsx', '.d.ts'].includes(ext);
  });

  if (!jsFiles.length) {
    return [];
  }

  const respectProjectConfig = config.respectProjectConfig === true;
  const eslint = getEslintInstance(respectProjectConfig);

  const results = await eslint.lintFiles(jsFiles);
  const errors = [];

  for (const result of results) {
    for (const message of result.messages) {
      const isParseError = message.fatal === true || message.ruleId === null;
      const rule = isParseError ? 'parse-error' : (message.ruleId || 'unknown');

      const error = createError({
        file: result.filePath,
        line: message.line || 1,
        col: message.column || 1,
        message: message.message,
        rule,
        severity: SEVERITIES.MINOR,
        language: result.filePath.endsWith('.ts') || result.filePath.endsWith('.tsx') ? 'typescript' : 'javascript',
        isInDiff: false,
        isParseError,
      });
      errors.push(error);
    }
  }

  return errors;
}
