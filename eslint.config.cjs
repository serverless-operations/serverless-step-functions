'use strict';

const airbnb = require('eslint-config-airbnb-extended');
const globals = require('globals');

module.exports = [
  {
    ignores: ['coverage/**', 'node_modules/**', 'tmp/**', 'tmpdirs-serverless/**'],
  },
  airbnb.plugins.stylistic,
  airbnb.plugins.importX,
  airbnb.plugins.node,
  ...airbnb.configs.base.recommended,
  ...airbnb.configs.node.recommended,
  {
    languageOptions: {
      globals: {
        ...globals.node,
        ...globals.mocha,
      },
    },
    rules: {
      'func-names': 'off',
      'prefer-destructuring': 'off',
      'no-plusplus': 'off',
      'no-template-curly-in-string': 'off',
      'no-restricted-syntax': 'off',
      strict: 'off',
      'prefer-rest-params': 'off',
      'import-x/no-extraneous-dependencies': 'off',
      'n/no-sync': 'off',
      '@stylistic/max-len': ['error', {
        code: 100,
        ignoreUrls: true,
        ignoreStrings: true,
        ignoreTemplateLiterals: true,
        ignoreRegExpLiterals: true,
      }],
    },
  },
];
