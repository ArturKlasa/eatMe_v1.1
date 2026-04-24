import { defineConfig, devices } from '@playwright/test';

const baseURL = process.env.E2E_BASE_URL ?? 'http://localhost:3001';

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
  workers: process.env.CI ? 4 : undefined,
  shard,
  reporter: process.env.CI ? [['html', { open: 'never' }], ['github']] : [['html']],
  use: {
    baseURL,
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
});
