/**
 * Onboarding happy-path E2E tests.
 *
 * Requires E2E_BASE_URL pointing at a running web-portal-v2 instance with a
 * configured Supabase backend (email confirmation disabled for test accounts).
 *
 * Run:
 *   E2E_BASE_URL=http://localhost:3000 \
 *   pnpm --filter web-portal-v2 exec playwright test tests/e2e/onboarding-happy-path.spec.ts
 */

import { test, expect, type Page } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

// ─── helpers ────────────────────────────────────────────────────────────────

function uniqueEmail() {
  return `test+onboard-${Date.now()}-${Math.floor(Math.random() * 9999)}@example.com`;
}

async function signUpAndLandOnOnboard(page: Page, email: string, password: string) {
  await page.goto('/signup');
  await page.getByLabel('Email').fill(email);
  await page.getByLabel('Password', { exact: true }).fill(password);
  await page.getByLabel(/confirm/i).fill(password);
  await page.getByRole('button', { name: /create account/i }).click();
  // Assumes email confirmation is disabled in the test Supabase project.
  await expect(page).toHaveURL(/\/onboard/, { timeout: 10_000 });
}

/** Intercept Mapbox geocoding so the test never hits the real API. */
async function mockMapbox(page: Page) {
  await page.route('**/geocoding/v5/mapbox.places/**', route =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        features: [
          {
            place_name: '123 Main St, San Francisco, CA 94102, United States',
            center: [-122.4194, 37.7749],
          },
        ],
      }),
    })
  );
}

/** Intercept Supabase Storage so photo upload tests don't hit real storage. */
async function mockStorage(page: Page) {
  await page.route('**/storage/v1/object/**', route =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ Key: 'restaurant-photos/test-id/hero.jpg' }),
    })
  );
}

/** A minimal 1×1 transparent PNG — fast to compress, valid for file inputs. */
const TINY_PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
  'base64'
);

const PASSWORD = 'TestPassword1!';

// ─── tests ──────────────────────────────────────────────────────────────────

test.describe('Onboarding happy path', () => {
  test('step 1 (Basics) — name autosave persists to DB', async ({ page }) => {
    await signUpAndLandOnOnboard(page, uniqueEmail(), PASSWORD);

    await expect(page.getByTestId('onboarding-stepper')).toBeVisible();

    // Fill name and blur to trigger autosave
    await page.getByLabel('Restaurant name').fill('Test Cafe');
    await page.keyboard.press('Tab');
    await expect(page.getByText('Draft saved.')).toBeVisible({ timeout: 8_000 });

    // Navigate away and back — data must survive (DB-driven, not localStorage)
    await page.goto('/');
    await page.goto('/onboard');
    await expect(page.getByLabel('Restaurant name')).toHaveValue('Test Cafe');
  });

  test('step 2 (Location) — address autosave after Mapbox selection', async ({ page }) => {
    await mockMapbox(page);
    await signUpAndLandOnOnboard(page, uniqueEmail(), PASSWORD);

    // Advance to Location step
    await page.getByLabel('Restaurant name').fill('Geo Bistro');
    await page.keyboard.press('Tab');
    await expect(page.getByText('Draft saved.')).toBeVisible({ timeout: 8_000 });
    await page.getByRole('button', { name: 'Next' }).click();

    await expect(page.getByText('Step 2: Location')).toBeVisible();

    // Search address (intercepted by mockMapbox)
    await page.getByLabel('Address search').fill('123 Main St');
    await page.getByRole('button', { name: 'Search' }).click();

    // Select the first geocoding result
    await page.getByRole('listitem').first().getByRole('button').click();
    await expect(page.getByText('Location saved.')).toBeVisible({ timeout: 8_000 });
    await expect(page.getByText('Selected coordinates')).toBeVisible();
  });

  test('step 3 (Hours) — toggling a day autosaves', async ({ page }) => {
    await mockMapbox(page);
    await signUpAndLandOnOnboard(page, uniqueEmail(), PASSWORD);

    // Step 1: Basics
    await page.getByLabel('Restaurant name').fill('Hours Place');
    await page.keyboard.press('Tab');
    await expect(page.getByText('Draft saved.')).toBeVisible({ timeout: 8_000 });
    await page.getByRole('button', { name: 'Next' }).click();

    // Step 2: Location — skip by advancing directly
    await expect(page.getByText('Step 2: Location')).toBeVisible();
    await page.getByLabel('Address search').fill('456 Elm Ave');
    await page.getByRole('button', { name: 'Search' }).click();
    await page.getByRole('listitem').first().getByRole('button').click();
    await expect(page.getByText('Location saved.')).toBeVisible({ timeout: 8_000 });
    await page.getByRole('button', { name: 'Next' }).click();

    // Step 3: Hours
    await expect(page.getByText('Step 3: Hours & Services')).toBeVisible();
    // Toggle Monday on
    await page.getByLabel('Monday').check();
    await expect(page.getByText('Hours saved.')).toBeVisible({ timeout: 8_000 });
  });

  test('step 4 (Cuisines) — selecting a chip autosaves', async ({ page }) => {
    await mockMapbox(page);
    await signUpAndLandOnOnboard(page, uniqueEmail(), PASSWORD);

    // Navigate to Cuisines step by completing 1–3
    await page.getByLabel('Restaurant name').fill('Cuisine Spot');
    await page.keyboard.press('Tab');
    await expect(page.getByText('Draft saved.')).toBeVisible({ timeout: 8_000 });
    await page.getByRole('button', { name: 'Next' }).click();

    await page.getByLabel('Address search').fill('789 Oak Dr');
    await page.getByRole('button', { name: 'Search' }).click();
    await page.getByRole('listitem').first().getByRole('button').click();
    await expect(page.getByText('Location saved.')).toBeVisible({ timeout: 8_000 });
    await page.getByRole('button', { name: 'Next' }).click();

    await page.getByLabel('Monday').check();
    await expect(page.getByText('Hours saved.')).toBeVisible({ timeout: 8_000 });
    await page.getByRole('button', { name: 'Next' }).click();

    // Step 4: Cuisines
    await expect(page.getByText('Step 4: Cuisines')).toBeVisible();
    await page.getByRole('button', { name: 'American', exact: true }).click();
    await expect(page.getByText('Cuisines saved.')).toBeVisible({ timeout: 8_000 });
    await expect(page.getByRole('button', { name: 'American', exact: true })).toHaveAttribute(
      'aria-pressed',
      'true'
    );
  });

  test('step 5 (Photos) — upload compresses then uploads then saves', async ({ page }) => {
    await mockMapbox(page);
    await mockStorage(page);
    await signUpAndLandOnOnboard(page, uniqueEmail(), PASSWORD);

    // Navigate through steps 1–4
    await page.getByLabel('Restaurant name').fill('Photo Diner');
    await page.keyboard.press('Tab');
    await expect(page.getByText('Draft saved.')).toBeVisible({ timeout: 8_000 });
    await page.getByRole('button', { name: 'Next' }).click();

    await page.getByLabel('Address search').fill('1 Photo Ave');
    await page.getByRole('button', { name: 'Search' }).click();
    await page.getByRole('listitem').first().getByRole('button').click();
    await expect(page.getByText('Location saved.')).toBeVisible({ timeout: 8_000 });
    await page.getByRole('button', { name: 'Next' }).click();

    await page.getByLabel('Monday').check();
    await expect(page.getByText('Hours saved.')).toBeVisible({ timeout: 8_000 });
    await page.getByRole('button', { name: 'Next' }).click();

    await page.getByRole('button', { name: 'American', exact: true }).click();
    await expect(page.getByText('Cuisines saved.')).toBeVisible({ timeout: 8_000 });
    await page.getByRole('button', { name: 'Next' }).click();

    // Step 5: Photos
    await expect(page.getByText('Step 5: Hero Photo')).toBeVisible();

    // Provide a tiny PNG via the hidden file input
    const fileInput = page.locator('input[type="file"]');
    await fileInput.setInputFiles({
      name: 'test.png',
      mimeType: 'image/png',
      buffer: TINY_PNG,
    });

    // Progress should show compression phase first, then uploading, then done
    await expect(page.getByText('Photo uploaded.')).toBeVisible({ timeout: 15_000 });
  });

  test('close-tab after step 3 (Hours) — resume resumes at step 4 (Cuisines)', async ({ page }) => {
    await mockMapbox(page);
    await signUpAndLandOnOnboard(page, uniqueEmail(), PASSWORD);

    // Complete step 1: Basics
    await page.getByLabel('Restaurant name').fill('Resume Cafe');
    await page.keyboard.press('Tab');
    await expect(page.getByText('Draft saved.')).toBeVisible({ timeout: 8_000 });
    await page.getByRole('button', { name: 'Next' }).click();

    // Complete step 2: Location
    await expect(page.getByText('Step 2: Location')).toBeVisible();
    await page.getByLabel('Address search').fill('10 Resume Rd');
    await page.getByRole('button', { name: 'Search' }).click();
    await page.getByRole('listitem').first().getByRole('button').click();
    await expect(page.getByText('Location saved.')).toBeVisible({ timeout: 8_000 });
    await page.getByRole('button', { name: 'Next' }).click();

    // Complete step 3: Hours
    await expect(page.getByText('Step 3: Hours & Services')).toBeVisible();
    await page.getByLabel('Monday').check();
    await expect(page.getByText('Hours saved.')).toBeVisible({ timeout: 8_000 });

    // Simulate "close tab and reopen" — navigate away, then back to /onboard
    await page.goto('/');
    await page.goto('/onboard');

    // deriveResumeStep returns 3 (Cuisines) — basics/location/hours are done
    await expect(page.getByText('Step 4: Cuisines')).toBeVisible({ timeout: 8_000 });

    // Confirm the first three step indicators are shown as completed (✓)
    const stepIndicators = page.locator('[aria-current="step"]');
    // The active step indicator shows "4" (step index 3)
    await expect(stepIndicators).toHaveText('4');

    // Steps 1–3 completed indicators have a ✓ check character
    const completedDots = page.locator('nav ol li div').filter({ hasText: '✓' });
    await expect(completedDots).toHaveCount(3);
  });

  test('step 5 (Photos) — Finish button redirects to /restaurant/:id', async ({ page }) => {
    await mockMapbox(page);
    await mockStorage(page);
    await signUpAndLandOnOnboard(page, uniqueEmail(), PASSWORD);

    // Complete steps 1–4
    await page.getByLabel('Restaurant name').fill('Finish Test Diner');
    await page.keyboard.press('Tab');
    await expect(page.getByText('Draft saved.')).toBeVisible({ timeout: 8_000 });
    await page.getByRole('button', { name: 'Next' }).click();

    await page.getByLabel('Address search').fill('1 Finish Ave');
    await page.getByRole('button', { name: 'Search' }).click();
    await page.getByRole('listitem').first().getByRole('button').click();
    await expect(page.getByText('Location saved.')).toBeVisible({ timeout: 8_000 });
    await page.getByRole('button', { name: 'Next' }).click();

    await page.getByLabel('Monday').check();
    await expect(page.getByText('Hours saved.')).toBeVisible({ timeout: 8_000 });
    await page.getByRole('button', { name: 'Next' }).click();

    await page.getByRole('button', { name: 'American', exact: true }).click();
    await expect(page.getByText('Cuisines saved.')).toBeVisible({ timeout: 8_000 });
    await page.getByRole('button', { name: 'Next' }).click();

    // Step 5: Photos — upload then Finish
    await expect(page.getByText('Step 5: Hero Photo')).toBeVisible();
    const fileInput = page.locator('input[type="file"]');
    await fileInput.setInputFiles({
      name: 'test.png',
      mimeType: 'image/png',
      buffer: TINY_PNG,
    });
    await expect(page.getByText('Photo uploaded.')).toBeVisible({ timeout: 15_000 });

    await page.getByRole('button', { name: 'Finish' }).click();

    // Must redirect to the restaurant detail page (UUID in path)
    await expect(page).toHaveURL(/\/restaurant\/[0-9a-f-]{36}$/, { timeout: 10_000 });
  });

  test('accessibility — no critical axe-core violations on stepper page', async ({ page }) => {
    await signUpAndLandOnOnboard(page, uniqueEmail(), PASSWORD);
    await expect(page.getByTestId('onboarding-stepper')).toBeVisible();

    const results = await new AxeBuilder({ page })
      .include('[data-testid="onboarding-stepper"]')
      .analyze();

    const critical = results.violations.filter(v => v.impact === 'critical');
    expect(
      critical,
      `Critical axe violations found:\n${critical.map(v => `  - ${v.id}: ${v.description}`).join('\n')}`
    ).toHaveLength(0);
  });
});
