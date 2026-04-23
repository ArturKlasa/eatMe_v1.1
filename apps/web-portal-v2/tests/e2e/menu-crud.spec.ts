import { test, expect } from '@playwright/test';

/**
 * Menu CRUD gold path:
 *   create menu → create category → create standard dish → edit to configurable
 *
 * Requires a running dev server and a seeded Supabase instance.
 * The auth helper from onboarding-happy-path (signUpUser) is reused.
 */

const BASE_URL = process.env.PLAYWRIGHT_BASE_URL ?? 'http://localhost:3001';

async function signUpAndOnboard(page: import('@playwright/test').Page) {
  const email = `menu-test-${Date.now()}@example.com`;
  const password = 'Test1234!';

  await page.goto(`${BASE_URL}/signup`);
  await page.getByLabel(/email/i).fill(email);
  await page.getByLabel(/password/i).fill(password);
  await page.getByRole('button', { name: /sign up/i }).click();

  // Wait until we land on onboard or restaurant page
  await page.waitForURL(/\/(onboard|restaurant)/);
  return { email, password };
}

test.describe('Menu CRUD', () => {
  test.skip(
    !process.env.E2E_ENABLED,
    'Set E2E_ENABLED=true to run against a live dev server + Supabase'
  );

  test('create menu → category → standard dish → edit to configurable', async ({ page }) => {
    await signUpAndOnboard(page);

    // Complete minimal onboarding to get a restaurant ID
    // Navigate to onboard if not already there
    if (page.url().includes('/onboard')) {
      await page.getByTestId('step-basics-name').fill('Test Restaurant');
      await page.getByRole('button', { name: /next/i }).click();
      // Skip remaining steps by going directly to restaurant
    }

    // Navigate to the restaurant page to get the restaurant ID from the URL
    await page.waitForURL(/\/restaurant\/[^/]+/);
    const restaurantId = page.url().match(/\/restaurant\/([^/]+)/)?.[1] ?? '';
    expect(restaurantId).toBeTruthy();

    // Navigate to menu management
    await page.goto(`${BASE_URL}/restaurant/${restaurantId}/menu`);
    await expect(page.getByTestId('menu-manager')).toBeVisible();

    // ── Create menu "Lunch" ────────────────────────────────────────────────────
    await page.getByTestId('add-menu-btn').click();
    await page.getByTestId('menu-name-input').fill('Lunch');
    await page.getByTestId('menu-save-btn').click();

    // Menu appears in the list
    await expect(page.getByText('Lunch')).toBeVisible();

    // ── Create category "Mains" ────────────────────────────────────────────────
    // Click "+ Category" on the Lunch menu
    const lunchMenuEl = page.getByText('Lunch').first();
    await lunchMenuEl.locator('..').locator('[data-testid*="add-category-btn"]').click();
    await page.getByTestId('category-name-input').fill('Mains');
    await page.getByTestId('category-save-btn').click();

    await expect(page.getByText('Mains')).toBeVisible();

    // ── Create dish "Chicken Sandwich" (standard, poultry) ─────────────────────
    await page.locator('[data-testid*="add-dish-btn"]').first().click();
    await expect(page.getByTestId('dish-form')).toBeVisible();

    await page.getByTestId('dish-name').fill('Chicken Sandwich');
    await page.getByTestId('dish-price').fill('12.50');
    await page.getByTestId('dish-primary-protein').selectOption('chicken');
    // dish_kind is 'standard' by default

    await page.getByTestId('dish-submit').click();

    // Dish row appears
    await expect(page.getByText('Chicken Sandwich')).toBeVisible();

    // ── Edit dish to configurable with is_template=true and a slot ─────────────
    await page.locator('[data-testid*="edit-dish-btn"]').first().click();
    await expect(page.locator('[data-testid*="edit-dish-form"]')).toBeVisible();

    // Switch kind to configurable
    await page
      .getByTestId('dish-kind')
      .getByRole('button', { name: /configurable/i })
      .click();

    // is_template checkbox should now be visible
    await expect(page.getByTestId('dish-is-template')).toBeVisible();
    await page.getByTestId('dish-is-template').check();

    // Add a slot
    await page.getByRole('button', { name: /\+ add slot/i }).click();
    await page.getByPlaceholder(/slot name/i).fill('Size');
    await page.getByRole('button', { name: /\+ add option/i }).click();
    await page.getByPlaceholder(/option name/i).fill('Regular');

    // Save the update
    await page.getByTestId('dish-submit').click();

    // Dish row shows configurable kind and template badge
    const dishRow = page.locator('[data-testid*="dish-row"]').first();
    await expect(dishRow.getByText('configurable')).toBeVisible();
    await expect(dishRow.getByText('template')).toBeVisible();
  });
});
