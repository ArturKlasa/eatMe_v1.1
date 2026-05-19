import { defineConfig } from 'vitest/config';
import path from 'path';

export default defineConfig({
  test: {
    environment: 'node',
    // Integration tests (src/__tests__/integration/**) need local Supabase
    // running and are run separately via `vitest.integration.config.ts`.
    exclude: ['tests/e2e/**', 'src/__tests__/integration/**', 'node_modules/**'],
  },
  resolve: {
    alias: { '@': path.resolve(__dirname, './src') },
  },
});
