import { defineConfig, devices } from '@playwright/test';

const baseURL = process.env.E2E_BASE_URL ?? 'http://localhost:3000';

// CI sharding: pass --shard=1/4 (or 2/4, 3/4, 4/4) at the CLI level.
// CI_SHARD / CI_TOTAL_SHARDS env vars are forwarded by the workflow.
const shard =
  process.env.CI_SHARD && process.env.CI_TOTAL_SHARDS
    ? {
        current: parseInt(process.env.CI_SHARD, 10),
        total: parseInt(process.env.CI_TOTAL_SHARDS, 10),
      }
    : undefined;

export default defineConfig({
  testDir: './tests/e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  // 4 parallel workers in CI for sharded runs; unlimited locally
  workers: process.env.CI ? 4 : undefined,
  shard,
  // HTML report always; GitHub Actions annotations in CI
  reporter: process.env.CI ? [['html', { open: 'never' }], ['github']] : [['html']],
  globalTeardown: './tests/e2e/global-teardown.ts',
  use: {
    baseURL,
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
});
