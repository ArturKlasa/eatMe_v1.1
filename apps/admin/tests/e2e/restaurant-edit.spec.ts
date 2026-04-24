/**
 * Admin restaurant edit E2E — suspension + audit trail.
 *
 * Requires a running admin instance + Supabase backend with at least one
 * published restaurant and an admin test account.
 *
 * Run:
 *   E2E_BASE_URL=http://localhost:3001 \
 *   TEST_ADMIN_EMAIL=admin@example.com TEST_ADMIN_PASSWORD=Passw0rd! \
 *   pnpm --filter admin exec playwright test tests/e2e/restaurant-edit.spec.ts
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

test.describe('Admin restaurant detail', () => {
  test.beforeEach(async ({ page }) => {
    await signInAsAdmin(page);
  });

  test('navigates from list to detail page', async ({ page }) => {
    // Click the first restaurant row
    const firstLink = page.locator('table tbody tr a').first();
    await firstLink.click();
    await page.waitForURL(/\/restaurants\/.+/, { timeout: 5_000 });

    await expect(page.getByRole('heading').first()).toBeVisible();
    await expect(page.getByText('Basic info')).toBeVisible();
    await expect(page.getByText('Suspension')).toBeVisible();
    await expect(page.getByText('Raw DB row')).toBeVisible();
  });

  test('raw DB inspector expands on click', async ({ page }) => {
    const firstLink = page.locator('table tbody tr a').first();
    await firstLink.click();
    await page.waitForURL(/\/restaurants\/.+/, { timeout: 5_000 });

    const inspectorToggle = page.getByRole('button', { name: /raw db row/i });
    await inspectorToggle.click();
    // Pre block with JSON becomes visible
    await expect(page.locator('pre')).toBeVisible();
  });

  test('suspend flow requires reason', async ({ page }) => {
    const firstLink = page.locator('table tbody tr a').first();
    await firstLink.click();
    await page.waitForURL(/\/restaurants\/.+/, { timeout: 5_000 });

    // Only test if restaurant is currently active
    const suspendBtn = page.getByRole('button', { name: /suspend restaurant/i });
    if (await suspendBtn.isVisible()) {
      await suspendBtn.click();
      // Confirm form appears
      await expect(page.getByLabel(/suspension reason/i)).toBeVisible();
      // Submit without reason → validation error
      await page.getByRole('button', { name: /confirm suspend/i }).click();
      await expect(page.getByText(/reason is required/i)).toBeVisible();
    }
  });

  test('suspend with reason flips is_active to Suspended', async ({ page }) => {
    const firstLink = page.locator('table tbody tr a').first();
    await firstLink.click();
    await page.waitForURL(/\/restaurants\/.+/, { timeout: 5_000 });

    const suspendBtn = page.getByRole('button', { name: /suspend restaurant/i });
    if (!(await suspendBtn.isVisible())) {
      test.skip();
      return;
    }

    await suspendBtn.click();
    await page.getByLabel(/suspension reason/i).fill('spam listings');
    await page.getByRole('button', { name: /confirm suspend/i }).click();

    // After save, badge should show Suspended
    await expect(page.locator('text=Suspended').first()).toBeVisible({ timeout: 5_000 });

    // Unsuspend to clean up
    await page.getByRole('button', { name: /unsuspend restaurant/i }).click();
    await expect(page.locator('text=Active').first()).toBeVisible({ timeout: 5_000 });
  });
});

test.describe('Admin restaurant edit — access control', () => {
  test('unauthenticated user is redirected from detail page', async ({ page }) => {
    await page.goto('/restaurants/00000000-0000-0000-0000-000000000001');
    await expect(page).toHaveURL(/signin/, { timeout: 5_000 });
  });
});
