import tseslint from '@typescript-eslint/eslint-plugin';
import tsparser from '@typescript-eslint/parser';

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
    },
    rules: {
      // Prevent regressions — no `any` types allowed
      '@typescript-eslint/no-explicit-any': 'error',
    },
  },
];

export default config;
