import { SEVERITIES } from './schema.js';
import { appendFileSync, mkdirSync } from 'fs';
import { homedir } from 'os';
import { join } from 'path';

// JavaScript / TypeScript severity map
const JS_RULES = {
  [SEVERITIES.CRITICAL]: [
    'no-undef',
    'no-redeclare',
    'no-dupe-keys',
    'no-duplicate-case',
    'no-func-assign',
    'no-import-assign',
    'no-obj-calls',
    'no-unreachable',
    'no-unsafe-finally',
    'use-before-define',
    '@typescript-eslint/no-explicit-any',
    '@typescript-eslint/ban-ts-comment',
    'import/no-unresolved',
  ],
  [SEVERITIES.MODERATE]: [
    'no-unused-vars',
    '@typescript-eslint/no-unused-vars',
    'no-console',
    'complexity',
    'max-depth',
    'max-lines',
    'no-shadow',
    'no-param-reassign',
    'prefer-promise-reject-errors',
    '@typescript-eslint/no-floating-promises',
    '@typescript-eslint/await-thenable',
  ],
  [SEVERITIES.MINOR]: [
    'prefer-const',
    'eqeqeq',
    'semi',
    'quotes',
    'indent',
    'comma-dangle',
    'arrow-body-style',
    'object-shorthand',
    'no-var',
    '@typescript-eslint/consistent-type-imports',
  ],
};

// Python / ruff severity map (by code prefix)
const PYTHON_RULES = {
  [SEVERITIES.CRITICAL]: [
    'E9', // SyntaxError, IndentationError
    'F821', // Undefined name
    'F811', // Redefinition of unused
    'F4', // Import errors
  ],
  [SEVERITIES.MODERATE]: [
    'F841', // Local variable assigned but never used
    'C901', // Function too complex
    'B', // flake8-bugbear
    'W6', // Deprecated
  ],
  [SEVERITIES.MINOR]: [
    'E1', // Indentation
    'E2', // Whitespace
    'E3', // Blank lines
    'E4', // Import style
    'E5', // Line length
    'E7', // Statement style
    'W1', // Misc warnings
    'W2',
    'W3',
    'W4',
    'W5',
    'I', // isort
    'UP', // pyupgrade
  ],
};

// Build lookup maps for quick searching
const jsRuleMap = {};
for (const [severity, rules] of Object.entries(JS_RULES)) {
  for (const rule of rules) {
    jsRuleMap[rule] = severity;
  }
}

const pythonRuleMap = {};
for (const [severity, prefixes] of Object.entries(PYTHON_RULES)) {
  for (const prefix of prefixes) {
    pythonRuleMap[prefix] = severity;
  }
}

function logUnknownRule(rule, language) {
  try {
    const logDir = join(homedir(), '.codexa');
    mkdirSync(logDir, { recursive: true });
    const logPath = join(logDir, 'unknown-rules.log');
    appendFileSync(logPath, `${new Date().toISOString()} | ${language} | ${rule}\n`);
  } catch (err) {
    // Silently fail if we can't write to log
  }
}

export function getSeverity(rule, language) {
  if (!rule || !language) {
    return SEVERITIES.MODERATE; // Safe default
  }

  if (language === 'javascript' || language === 'typescript') {
    // Check exact match first
    if (jsRuleMap[rule]) {
      return jsRuleMap[rule];
    }

    // Check for prefix match (e.g., 'prettier/...')
    for (const [prefix, severity] of Object.entries(PYTHON_RULES[SEVERITIES.MINOR] || {})) {
      if (rule.startsWith('prettier')) {
        return SEVERITIES.MINOR; // All prettier rules are minor
      }
    }

    logUnknownRule(rule, language);
    return SEVERITIES.MODERATE; // Fallback
  }

  if (language === 'python') {
    // Check exact match first
    if (pythonRuleMap[rule]) {
      return pythonRuleMap[rule];
    }

    // Check prefix match
    for (const [severity, prefixes] of Object.entries(PYTHON_RULES)) {
      for (const prefix of prefixes) {
        if (rule.startsWith(prefix)) {
          return severity;
        }
      }
    }

    logUnknownRule(rule, language);
    return SEVERITIES.MODERATE; // Fallback
  }

  return SEVERITIES.MODERATE; // Fallback for unknown language
}
