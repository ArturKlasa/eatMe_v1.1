/**
 * Admin restaurant browse E2E gold path.
 *
 * Requires E2E_BASE_URL pointing at a running admin instance (default: http://localhost:3001)
 * with a configured Supabase backend and an admin test account.
 *
 * Run:
 *   E2E_BASE_URL=http://localhost:3001 \
 *   TEST_ADMIN_EMAIL=admin@example.com TEST_ADMIN_PASSWORD=Passw0rd! \
 *   pnpm --filter admin exec playwright test tests/e2e/browse.spec.ts
 */

import { test, expect } from '@playwright/test';

const ADMIN_EMAIL = process.env.TEST_ADMIN_EMAIL ?? 'admin@test.example.com';
const ADMIN_PASSWORD = process.env.TEST_ADMIN_PASSWORD ?? 'TestPassword1!';

async function signInAsAdmin(page: import('@playwright/test').Page) {
  await page.goto('/signin');
  await page.getByLabel('Email').fill(ADMIN_EMAIL);
  await page.getByLabel('Password').fill(ADMIN_PASSWORD);
  await page.getByRole('button', { name: /sign in/i }).click();
  await page.waitForURL('/restaurants', { timeout: 10_000 });
}

test.describe('Admin restaurant browse', () => {
  test.beforeEach(async ({ page }) => {
    await signInAsAdmin(page);
  });

  test('lands on /restaurants with DataTable', async ({ page }) => {
    await expect(page.getByRole('heading', { name: 'Restaurants' })).toBeVisible();
    await expect(page.locator('table')).toBeVisible();
    await expect(page.locator('th', { hasText: 'Name' })).toBeVisible();
    await expect(page.locator('th', { hasText: 'Status' })).toBeVisible();
    await expect(page.locator('th', { hasText: 'Owner' })).toBeVisible();
  });

  test('sidebar navigation contains expected links', async ({ page }) => {
    await expect(page.getByRole('navigation', { name: 'Admin navigation' })).toBeVisible();
    await expect(page.getByRole('link', { name: 'Restaurants' })).toBeVisible();
    await expect(page.getByRole('link', { name: 'Menu Scan' })).toBeVisible();
    await expect(page.getByRole('link', { name: 'Audit Log' })).toBeVisible();
  });

  test('search input syncs to URL query param', async ({ page }) => {
    await page.getByLabel('Search restaurants…').fill('Cafe');
    // Debounce fires after 400 ms
    await page.waitForURL(/q=Cafe/, { timeout: 2_000 });
    await expect(page).toHaveURL(/q=Cafe/);
  });

  test('status filter syncs to URL', async ({ page }) => {
    await page.getByLabel('Filter by status').selectOption('published');
    await page.waitForURL(/status=published/, { timeout: 2_000 });
    await expect(page).toHaveURL(/status=published/);
  });

  test('suspension filter syncs to URL', async ({ page }) => {
    await page.getByLabel('Filter by suspension').selectOption('false');
    await page.waitForURL(/is_active=false/, { timeout: 2_000 });
    await expect(page).toHaveURL(/is_active=false/);
  });
});

test.describe('Admin access control', () => {
  test('unauthenticated visitor is redirected away from /restaurants', async ({ page }) => {
    await page.goto('/restaurants');
    await expect(page).toHaveURL(/signin/, { timeout: 5_000 });
  });
});
