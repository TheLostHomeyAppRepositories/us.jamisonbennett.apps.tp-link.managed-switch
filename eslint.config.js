'use strict';

const eslint = require('@eslint/js');
const { createTypeScriptImportResolver } = require('eslint-import-resolver-typescript');
const homeyApp = require('eslint-plugin-homey-app');
const { importX } = require('eslint-plugin-import-x');
const pluginN = require('eslint-plugin-n');
const globals = require('globals');
const tseslint = require('typescript-eslint');

module.exports = tseslint.config(
  {
    ignores: [
      '.homeybuild/**',
      'node_modules/**',
      'app.json',
      'coverage/**',
    ],
  },
  eslint.configs.recommended,
  ...tseslint.configs.recommended,
  pluginN.configs['flat/recommended'],
  importX.flatConfigs.recommended,
  importX.flatConfigs.typescript,
  homeyApp.configs.recommended,
  {
    files: ['**/*.{ts,tsx,cts,mts}'],
    languageOptions: {
      ecmaVersion: 2023,
      sourceType: 'commonjs',
      globals: {
        ...globals.node,
      },
      parserOptions: {
        project: './tsconfig.eslint.json',
        tsconfigRootDir: __dirname,
      },
    },
    settings: {
      'import-x/core-modules': ['homey'],
      'import-x/resolver-next': [
        createTypeScriptImportResolver({
          alwaysTryTypes: true,
          project: './tsconfig.eslint.json',
        }),
      ],
      n: {
        allowModules: ['homey'],
        tryExtensions: ['.ts', '.tsx', '.js', '.jsx', '.json', '.node'],
      },
    },
    rules: {
      // Homey / Athom-style preferences carried forward from eslint-config-athom
      'no-await-in-loop': 'off',
      'no-bitwise': 'off',
      'no-continue': 'off',
      'no-param-reassign': 'off',
      'no-plusplus': 'off',
      'no-underscore-dangle': 'off',
      'no-useless-assignment': 'off',
      'preserve-caught-error': 'off',
      'class-methods-use-this': 'off',
      'dot-notation': 'off',
      'max-len': ['warn', 200],
      'no-empty': ['error', { allowEmptyCatch: true }],
      'no-unused-vars': 'off',
      '@typescript-eslint/no-unused-vars': [
        'error',
        { vars: 'all', args: 'none', ignoreRestSiblings: true },
      ],
      '@typescript-eslint/no-require-imports': 'off',
      '@typescript-eslint/no-floating-promises': ['error', { ignoreVoid: false }],
      '@typescript-eslint/no-misused-promises': 'error',
      'n/no-missing-import': ['error', { allowModules: ['homey'] }],
      'n/no-missing-require': ['error', { allowModules: ['homey'] }],
      'n/no-unpublished-import': ['error', { allowModules: ['homey'] }],
      'n/no-unpublished-require': ['error', { allowModules: ['homey'] }],
      'n/no-unsupported-features/es-syntax': [
        'error',
        { ignores: ['modules'] },
      ],
      'import-x/no-unresolved': 'error',
      'import-x/no-named-as-default-member': 'off',
      'import-x/extensions': [
        'error',
        'ignorePackages',
        {
          ts: 'never',
          tsx: 'never',
          js: 'never',
          jsx: 'never',
          mts: 'never',
          cts: 'never',
        },
      ],
      'import-x/no-extraneous-dependencies': [
        'error',
        {
          packageDir: __dirname,
          devDependencies: [
            '**/*.{test,spec}.{js,jsx,ts,tsx}',
            '**/__tests__/**',
            '**/__mocks__/**',
            '**/tests/**',
            '**/jest.config.{js,ts}',
            '**/jest.setup.{js,ts}',
            'eslint.config.js',
          ],
          optionalDependencies: false,
        },
      ],
    },
  },
  {
    files: ['eslint.config.js', '**/*.{js,cjs,mjs}'],
    ...tseslint.configs.disableTypeChecked,
    languageOptions: {
      ecmaVersion: 2023,
      sourceType: 'commonjs',
      globals: {
        ...globals.node,
      },
    },
    rules: {
      '@typescript-eslint/no-require-imports': 'off',
      'n/no-unpublished-require': 'off',
      'n/no-unpublished-import': 'off',
      'import-x/no-extraneous-dependencies': 'off',
    },
  },
);
