import tseslint from '@typescript-eslint/eslint-plugin';
import tsparser from '@typescript-eslint/parser';
import jsdoc from 'eslint-plugin-jsdoc';

const config = [
  {
    ignores: [
      'node_modules/**',
      '.expo/**',
      'android/**',
      'ios/**',
      'dist/**',
      'build/**',
      '*.config.js',
      'babel.config.js',
      'metro.config.js',
    ],
  },
  {
    files: ['src/**/*.{ts,tsx}'],
    languageOptions: {
      parser: tsparser,
      parserOptions: {
        ecmaVersion: 'latest',
        sourceType: 'module',
        ecmaFeatures: { jsx: true },
      },
    },
    plugins: {
      // @ts-ignore — @typescript-eslint plugin type doesn't perfectly match ESLint's Plugin typedef
      '@typescript-eslint': tseslint,
      jsdoc,
    },
    rules: {
      // Prevent regressions — no `any` types allowed
      '@typescript-eslint/no-explicit-any': 'error',
      // JSDoc linting — warnings only for incremental adoption
      'jsdoc/require-jsdoc': ['warn', {
        require: {
          FunctionDeclaration: true,
          ClassDeclaration: true,
        },
        publicOnly: true,
      }],
      'jsdoc/require-param': 'warn',
      'jsdoc/require-returns': 'warn',
      'jsdoc/check-param-names': 'warn',
    },
  },
];

export default config;
