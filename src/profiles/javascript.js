import { ESLint } from 'eslint';
import { createError, SEVERITIES } from '../core/schema.js';

// Severity mappings
const SEVERITY_MAP = {
  [SEVERITIES.CRITICAL]: ['no-undef', 'no-redeclare'],
  [SEVERITIES.MODERATE]: ['no-unused-vars', 'complexity', 'no-console'],
  [SEVERITIES.MINOR]: ['prefer-const', 'eqeqeq', 'semi'],
};

// Build reverse map: rule -> severity
const RULE_SEVERITY = {};
for (const [severity, rules] of Object.entries(SEVERITY_MAP)) {
  for (const rule of rules) {
    RULE_SEVERITY[rule] = severity;
  }
}

function mapSeverity(ruleId) {
  return RULE_SEVERITY[ruleId] || SEVERITIES.MINOR;
}

export async function lintJavaScript(files) {
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

  // ESLint v9 with override config
  const eslint = new ESLint({
    overrideConfigFile: true,
    baseConfig: {
      languageOptions: {
        sourceType: 'module',
        ecmaVersion: 2022,
      },
      rules: {
        'no-undef': 'error',
        'no-redeclare': 'error',
        'no-unused-vars': 'warn',
        complexity: ['warn', { max: 10 }],
        'no-console': 'warn',
        'prefer-const': 'warn',
        eqeqeq: 'warn',
        semi: 'warn',
      },
    },
  });

  const results = await eslint.lintFiles(jsFiles);
  const errors = [];

  for (const result of results) {
    for (const message of result.messages) {
      const severity = mapSeverity(message.ruleId || 'unknown');
      const error = createError({
        file: result.filePath,
        line: message.line,
        col: message.column,
        message: message.message,
        rule: message.ruleId || 'unknown',
        severity,
        language: result.filePath.endsWith('.ts') || result.filePath.endsWith('.tsx') ? 'typescript' : 'javascript',
        isInDiff: false,
      });
      errors.push(error);
    }
  }

  return errors;
}
