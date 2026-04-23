import { defineConfig } from 'eslint/config';
import eatmeConfig from '@eatme/eslint-config-eatme';
import nextVitals from 'eslint-config-next/core-web-vitals';
import nextTs from 'eslint-config-next/typescript';

export default defineConfig([
  ...eatmeConfig,
  ...nextVitals,
  ...nextTs,
  {
    rules: {
      '@typescript-eslint/no-explicit-any': 'error',
    },
  },
]);
