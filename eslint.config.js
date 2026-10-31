'use strict';
const js = require('@eslint/js');
const globals = require('globals');

const rules = {
  eqeqeq: ['error', 'always'],
  'no-var': 'error',
  'prefer-const': 'error',
  'no-unused-vars': ['error', { argsIgnorePattern: '^_', caughtErrors: 'none' }],
  'no-shadow': 'error',
  'no-throw-literal': 'error',
  'no-implicit-coercion': ['error', { allow: ['!!'] }],
  curly: ['error', 'multi-line'],
};

module.exports = [
  { ignores: ['node_modules/**'] },
  js.configs.recommended,
  { files: ['server.js', 'src/**/*.js', 'tests/**/*.js', 'eslint.config.js'], languageOptions: { sourceType: 'commonjs', globals: globals.node }, rules },
  { files: ['tests/**/*.js'], rules: { 'no-shadow': 'off' } },
  { files: ['public/js/**/*.js'], languageOptions: { sourceType: 'module', globals: globals.browser }, rules },
];
