export default [
  {
    ignores: ['node_modules/**', 'dist/**', 'build/**', 'coverage/**', 'tests/fixtures/**'],
  },
  {
    files: ['**/*.js'],
    languageOptions: {
      ecmaVersion: 'latest',
      sourceType: 'module',
      parserOptions: {
        ecmaFeatures: {
          jsx: true,
        },
      },
    },
    rules: {
      'no-unused-vars': 'warn',
      'no-console': 'off', // CLI can use console
    },
  },
  {
    files: ['src/tui/**/*.js'],
    rules: {
      'no-unused-vars': ['warn', { varsIgnorePattern: '^(React|[A-Z].*)$' }],
    },
  },
];
