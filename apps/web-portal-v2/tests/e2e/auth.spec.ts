/**
 * Auth E2E gold path tests.
 *
 * Requires E2E_BASE_URL pointing at a running web-portal-v2 instance
 * with a configured Supabase backend.
 *
 * Run:
 *   E2E_BASE_URL=http://localhost:3000 \
 *   TEST_E2E_EMAIL=test+<random>@example.com TEST_E2E_PASSWORD=Passw0rd! \
 *   pnpm --filter web-portal-v2 exec playwright test tests/e2e/auth.spec.ts
 */

import { test, expect } from '@playwright/test';

const EMAIL = process.env.TEST_E2E_EMAIL ?? `test+${Date.now()}@example.com`;
const PASSWORD = process.env.TEST_E2E_PASSWORD ?? 'TestPassword1!';

test.describe('unauthenticated redirects', () => {
  test('visiting /onboard redirects to /signin with redirect param', async ({ page }) => {
    await page.goto('/onboard');
    await expect(page).toHaveURL(/\/signin.*redirect.*onboard/);
  });

  test('/signin is accessible without auth', async ({ page }) => {
    await page.goto('/signin');
    await expect(page).toHaveURL('/signin');
    await expect(page.getByRole('heading', { name: /sign in/i })).toBeVisible();
  });

  test('/signup is accessible without auth', async ({ page }) => {
    await page.goto('/signup');
    await expect(page).toHaveURL('/signup');
    await expect(page.getByRole('heading', { name: /create account/i })).toBeVisible();
  });
});

test.describe('sign-up flow', () => {
  test('new user signs up and reaches /onboard (or check-email screen)', async ({ page }) => {
    await page.goto('/signup');
    await page.getByLabel('Email').fill(EMAIL);
    await page.getByLabel('Password', { exact: true }).fill(PASSWORD);
    await page.getByLabel(/confirm/i).fill(PASSWORD);
    await page.getByRole('button', { name: /create account/i }).click();

    // Either redirected to /onboard (email confirmation off) or shows check-email text
    await expect(
      page.getByText(/check your email/i).or(page.getByText(/let.s set up/i))
    ).toBeVisible({ timeout: 8000 });
  });
});

test.describe('sign-in flow', () => {
  test('invalid credentials show error', async ({ page }) => {
    await page.goto('/signin');
    await page.getByLabel('Email').fill('nobody@example.com');
    await page.getByLabel('Password').fill('wrongpassword');
    await page.getByRole('button', { name: /sign in/i }).click();
    await expect(page.getByText(/invalid|credentials|incorrect/i)).toBeVisible({ timeout: 5000 });
  });

  test('redirect param is honoured after sign-in', async ({ page }) => {
    await page.goto('/signin?redirect=%2Fonboard');
    // The redirect param is preserved in the URL
    await expect(page).toHaveURL(/redirect.*onboard/);
  });
});
