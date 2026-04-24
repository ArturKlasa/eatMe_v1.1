import tsParser from '@typescript-eslint/parser';

export default [
  {
    files: ['src/**/*.{ts,tsx}'],
    languageOptions: { parser: tsParser },
    ignores: ['node_modules/**'],
  },
  {
    files: ['src/**/*.{js,jsx}'],
    ignores: ['node_modules/**'],
  },
];
