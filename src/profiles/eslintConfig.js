export function buildEslintOptions(options = {}) {
  const { rule = null, fix = false, respectProjectConfig = false } = options;

  const rules = rule ? { [rule]: 'error' } : {
    'no-undef': 'error',
    'no-redeclare': 'error',
    'no-unused-vars': 'warn',
    complexity: ['warn', { max: 10 }],
    'no-console': 'warn',
    'prefer-const': 'warn',
    eqeqeq: 'warn',
    semi: 'warn',
  };

  const baseConfig = {
    env: {
      es2022: true,
      node: true,
      browser: true,
    },
    parser: '@typescript-eslint/parser',
    parserOptions: {
      sourceType: 'module',
      ecmaVersion: 2022,
      ecmaFeatures: {
        jsx: true,
      },
    },
    plugins: ['@typescript-eslint'],
    rules,
    overrides: [
      {
        files: ['*.ts', '*.tsx', '*.d.ts'],
        rules: {
          'no-undef': 'off',
        },
      },
    ],
  };

  return {
    fix,
    useEslintrc: respectProjectConfig,
    baseConfig,
  };
}
