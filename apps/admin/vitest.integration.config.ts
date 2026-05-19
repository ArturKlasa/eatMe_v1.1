// Vitest integration test config (Phase 4.1 of dish-model rewrite).
//
// These tests hit a LOCAL Supabase instance to exercise real Postgres transaction
// boundaries — something the default unit-test config (mocked Supabase) can't do.
//
// Prerequisite:
//   - Docker Desktop running.
//   - `cd infra/supabase && supabase start` to bring up the local stack.
//     This applies every migration in infra/supabase/migrations/ to the local DB.
//
// Run:
//   pnpm -C apps/admin run test:integration
//
// Why a separate config: keeps default `pnpm test` fast (mocked, ~1s) and avoids
// requiring every contributor to have Docker running to run unit tests.
//
// CI: a separate GitHub Actions job runs `supabase start` then `pnpm test:integration`.
// The default unit-test job stays on the existing `vitest.config.ts`.

import { defineConfig } from 'vitest/config';
import path from 'path';

export default defineConfig({
  test: {
    environment: 'node',
    // Only files under src/__tests__/integration/ run here.
    include: ['src/__tests__/integration/**/*.test.ts'],
    // Per-test cleanup hooks live in setup.ts via globalSetup.
    globalSetup: ['./src/__tests__/integration/setup.ts'],
    // DB ops can be slow on first run — generous timeout avoids flake.
    testTimeout: 30_000,
    hookTimeout: 60_000,
    // Run sequentially: tests touch the same tables and depend on truncation
    // ordering between cases.
    fileParallelism: false,
  },
  resolve: {
    alias: { '@': path.resolve(__dirname, './src') },
  },
});
