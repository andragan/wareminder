import globals from 'globals';

/** @type {import('eslint').Linter.Config[]} */
export default [
  {
    files: ['src/**/*.js'],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: 'module',
      globals: {
        ...globals.browser,
        ...globals.es2021,
        chrome: 'readonly',
        importScripts: 'readonly',
        window: 'readonly',
        document: 'readonly',
        console: 'readonly',
        crypto: 'readonly',
        Intl: 'readonly',
        module: 'readonly',
        require: 'readonly',
        exports: 'readonly',
        MutationObserver: 'readonly',
        HTMLElement: 'readonly',
        setTimeout: 'readonly',
        clearTimeout: 'readonly',
        setInterval: 'readonly',
        clearInterval: 'readonly',
      },
    },
    rules: {
      'no-unused-vars': ['warn', { argsIgnorePattern: '^_', caughtErrorsIgnorePattern: '^_' }],
      'no-implicit-globals': 'off',
      'consistent-return': 'error',
      'no-var': 'error',
      'prefer-const': 'error',
      'eqeqeq': ['error', 'always'],
      'no-magic-numbers': 'off',
    },
  },
  {
    ignores: ['node_modules/', 'coverage/', 'tests/', '*.config.js', '*.setup.js'],
  },
];
