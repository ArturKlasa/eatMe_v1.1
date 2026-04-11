import { defineConfig, globalIgnores } from 'eslint/config';
import nextVitals from 'eslint-config-next/core-web-vitals';
import nextTs from 'eslint-config-next/typescript';
import jsdoc from 'eslint-plugin-jsdoc';

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    '.next/**',
    'out/**',
    'build/**',
    'next-env.d.ts',
    // Vendored files:
    'public/pdf.worker.min.mjs',
  ]),
  {
    rules: {
      '@typescript-eslint/no-explicit-any': 'error',
    },
  },
  // JSDoc linting — warnings only so Phase 3 coverage is enforced incrementally
  // without blocking development. Escalate to 'error' once baseline coverage
  // is fully achieved.
  {
    files: ['**/*.{ts,tsx}'],
    plugins: { jsdoc },
    rules: {
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
]);

export default eslintConfig;
