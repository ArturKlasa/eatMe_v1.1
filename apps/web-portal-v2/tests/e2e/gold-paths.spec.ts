/**
 * Step 26 — Playwright gold-path suites (4 suites, release-gating).
 *
 * Suite 1: signup → onboard → first restaurant draft persists across page close
 * Suite 2: menu scan upload → Realtime progress → confirm → dishes appear
 * Suite 3: publish → Realtime event reaches a second browser session
 * Suite 4: admin CSV import — 3-second search budget on 1000-row dataset
 *          (Suite 4 lives in apps/admin/tests/e2e/bulk-import-csv.spec.ts)
 *
 * Timing gates (design §2.5):
 *   • Onboarding + publish path ≤ 5 min    (Suites 1 + 3)
 *   • Menu-scan extract-to-review ≤ 90 s   (Suite 2; +30 s staging tolerance → 120 s)
 *
 * Requires:
 *   E2E_BASE_URL          — running web-portal-v2 instance
 *   E2E_SERVICE_ROLE_KEY  — for service-role DB assertions
 *   NEXT_PUBLIC_SUPABASE_URL
 *
 * Run:
 *   E2E_BASE_URL=http://localhost:3000 \
 *   E2E_SERVICE_ROLE_KEY=<key> \
 *   pnpm --filter web-portal-v2 exec playwright test tests/e2e/gold-paths.spec.ts
 */

import { test, expect, type Page, type BrowserContext } from '@playwright/test';
import { createClient } from '@supabase/supabase-js';
import { taggedEmail } from './fixtures/index.js';

// ─── helpers ─────────────────────────────────────────────────────────────────

const PASSWORD = 'TestPassword1!';
const SKIP_WITHOUT_ENV = !process.env.E2E_BASE_URL;

/** A minimal 1×1 transparent PNG. */
const TINY_PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
  'base64'
);

async function signUp(page: Page, email: string, password: string) {
  await page.goto('/signup');
  await page.getByLabel('Email').fill(email);
  await page.getByLabel('Password', { exact: true }).fill(password);
  await page.getByLabel(/confirm/i).fill(password);
  await page.getByRole('button', { name: /create account/i }).click();
  await expect(page).toHaveURL(/\/onboard/, { timeout: 12_000 });
}

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

async function mockStorage(page: Page) {
  // Only mock restaurant-photos and dish-photos — menu-scan-uploads must reach
  // real storage so the server-side worker can download the file.
  await page.route('**/storage/v1/object/restaurant-photos/**', route =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ Key: 'restaurant-photos/test/hero.jpg' }),
    })
  );
  await page.route('**/storage/v1/object/dish-photos/**', route =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ Key: 'dish-photos/test/hero.jpg' }),
    })
  );
}

/** Complete onboarding steps 1–5 and return the restaurant ID. */
async function completeOnboarding(page: Page, name: string): Promise<string> {
  // Step 1: Basics
  await page.getByLabel('Restaurant name').fill(name);
  await page.keyboard.press('Tab');
  await expect(page.getByText('Draft saved.')).toBeVisible({ timeout: 8_000 });
  await page.getByRole('button', { name: 'Next' }).click();

  // Step 2: Location
  await expect(page.getByText('Step 2: Location')).toBeVisible();
  await page.getByLabel('Address search').fill('123 Main St');
  await page.getByRole('button', { name: 'Search' }).click();
  await page.getByRole('listitem').first().getByRole('button').click();
  await expect(page.getByText('Location saved.')).toBeVisible({ timeout: 8_000 });
  await page.getByRole('button', { name: 'Next' }).click();

  // Step 3: Hours
  await expect(page.getByText('Step 3: Hours & Services')).toBeVisible();
  await page.getByLabel('Monday').check();
  await expect(page.getByText('Hours saved.')).toBeVisible({ timeout: 8_000 });
  await page.getByRole('button', { name: 'Next' }).click();

  // Step 4: Cuisines
  await expect(page.getByText('Step 4: Cuisines')).toBeVisible();
  await page.getByRole('button', { name: 'American', exact: true }).click();
  await expect(page.getByText('Cuisines saved.')).toBeVisible({ timeout: 8_000 });
  await page.getByRole('button', { name: 'Next' }).click();

  // Step 5: Photos
  await expect(page.getByText('Step 5: Hero Photo')).toBeVisible();
  const fileInput = page.locator('input[type="file"]');
  await fileInput.setInputFiles({ name: 'hero.png', mimeType: 'image/png', buffer: TINY_PNG });
  await expect(page.getByText('Photo uploaded.')).toBeVisible({ timeout: 15_000 });
  await page.getByRole('button', { name: 'Finish' }).click();

  await expect(page).toHaveURL(/\/restaurant\/[0-9a-f-]{36}$/, { timeout: 10_000 });
  const match = page.url().match(/\/restaurant\/([0-9a-f-]{36})$/);
  return match?.[1] ?? '';
}

// ─── Suite 1: signup → onboard → draft persists across page close ─────────────

test.describe('Suite 1 — signup → onboard → draft persists', () => {
  test.skip(SKIP_WITHOUT_ENV, 'Set E2E_BASE_URL to run against a live instance');

  test('full onboard completes within 5-minute budget and draft survives page close', async ({
    page,
  }) => {
    await mockMapbox(page);
    await mockStorage(page);

    const t0 = Date.now();
    const email = taggedEmail('s1-onboard');
    await signUp(page, email, PASSWORD);

    await expect(page.getByTestId('onboarding-stepper')).toBeVisible();

    // Step 1: Basics — autosave
    await page.getByLabel('Restaurant name').fill('Suite1 Cafe');
    await page.keyboard.press('Tab');
    await expect(page.getByText('Draft saved.')).toBeVisible({ timeout: 8_000 });
    await page.getByRole('button', { name: 'Next' }).click();

    // Step 2: Location
    await page.getByLabel('Address search').fill('123 Main St');
    await page.getByRole('button', { name: 'Search' }).click();
    await page.getByRole('listitem').first().getByRole('button').click();
    await expect(page.getByText('Location saved.')).toBeVisible({ timeout: 8_000 });
    await page.getByRole('button', { name: 'Next' }).click();

    // Step 3: Hours
    await page.getByLabel('Monday').check();
    await expect(page.getByText('Hours saved.')).toBeVisible({ timeout: 8_000 });

    // Simulate page close (navigate away, then return)
    await page.goto('/');
    await page.goto('/onboard');

    // deriveResumeStep resumes at Cuisines (step 4) since steps 1–3 are saved
    await expect(page.getByText('Step 4: Cuisines')).toBeVisible({ timeout: 8_000 });

    const elapsed = Date.now() - t0;
    // Design §2.5: onboarding flow must complete within 5 minutes
    expect(elapsed, `Onboarding exceeded 5-minute budget: ${elapsed}ms`).toBeLessThan(5 * 60_000);
  });
});

// ─── Suite 2: menu scan upload → Realtime progress → confirm → dishes ─────────

test.describe('Suite 2 — menu scan E2E', () => {
  test.skip(!process.env.E2E_SERVICE_ROLE_KEY, 'E2E_SERVICE_ROLE_KEY required for menu-scan E2E');

  test('upload → needs_review → confirm → dishes appear within 120 s (90 s + 30 s tolerance)', async ({
    page,
  }) => {
    await mockMapbox(page);
    await mockStorage(page);

    const email = taggedEmail('s2-scan');
    await signUp(page, email, PASSWORD);

    // Complete full onboarding to obtain a valid restaurant ID from the URL.
    // The /onboard URL never exposes the restaurant ID — only the post-finish
    // /restaurant/<id> URL does. completeOnboarding() waits for that redirect.
    const restaurantId = await completeOnboarding(page, 'Suite2 Scan Diner');
    expect(restaurantId, 'restaurant ID must be non-empty after onboarding').toBeTruthy();

    // Navigate to the menu-scan upload page
    await page.goto(`/restaurant/${restaurantId}/menu-scan`);
    await expect(page.getByText('Menu Scan')).toBeVisible({ timeout: 8_000 });

    const t0 = Date.now();
    const fileInput = page.locator('input[type="file"]');
    await fileInput.setInputFiles({
      name: 'menu-page-1.jpg',
      mimeType: 'image/jpeg',
      buffer: TINY_PNG,
    });
    await page.getByRole('button', { name: /scan 1 image/i }).click();

    // Review URL contains the job ID — capture it before navigating away on confirm.
    await expect(page).toHaveURL(/\/menu-scan\/[0-9a-f-]{36}/, { timeout: 30_000 });
    const reviewUrlMatch = page.url().match(/\/menu-scan\/([0-9a-f-]{36})/);
    expect(reviewUrlMatch, 'job ID must be present in the review page URL').toBeTruthy();
    const jobId = reviewUrlMatch![1];

    // Wait for needs_review (Realtime or polling, up to 120 s per design §2.5 + tolerance)
    const confirmButton = page.getByRole('button', { name: /confirm/i });
    await expect(confirmButton).toBeVisible({ timeout: 120_000 });

    const elapsed = Date.now() - t0;
    // Design §2.5: extract-to-review ≤ 90 s; allow 30 s staging latency tolerance
    expect(elapsed, `Menu scan exceeded 120 s budget: ${elapsed}ms`).toBeLessThan(120_000);

    // Assign a category and confirm
    const categorySelects = page.locator('select[aria-label="Category"]');
    const count = await categorySelects.count();
    if (count > 0) {
      await categorySelects.first().selectOption({ label: /create new category/i });
      const catInput = page.locator('input[aria-label="New category name"]').first();
      await catInput.fill('Mains');
      await page
        .getByRole('button', { name: /^create$/i })
        .first()
        .click();
    }

    await confirmButton.click();
    await expect(page).toHaveURL(/\/restaurant\/[0-9a-f-]{36}\/menu$/, { timeout: 15_000 });

    // Verify dishes and idempotency via DB (service-role)
    if (process.env.E2E_SERVICE_ROLE_KEY && process.env.NEXT_PUBLIC_SUPABASE_URL) {
      const adminClient = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL,
        process.env.E2E_SERVICE_ROLE_KEY
      );
      // Verify that the menu page shows at least one dish row
      await expect(page.getByRole('table')).toBeVisible({ timeout: 5_000 });
      const rows = page.locator('table tbody tr');
      const rowCount = await rows.count();
      expect(rowCount, 'Expected at least one dish after scan confirm').toBeGreaterThan(0);

      // Idempotency: scan_confirmations must have exactly one record for this job.
      // jobId was captured from the review URL before confirm navigated away.
      const { data: confirmations } = await adminClient
        .from('menu_scan_confirmations')
        .select('id')
        .eq('job_id', jobId);
      expect(
        (confirmations ?? []).length,
        'Idempotency violation: expected exactly one confirmation record'
      ).toBe(1);
    }
  });
});

// ─── Suite 3: publish → Realtime cross-session broadcast ─────────────────────

test.describe('Suite 3 — publish + Realtime broadcast', () => {
  test.skip(SKIP_WITHOUT_ENV, 'Set E2E_BASE_URL to run against a live instance');

  test('publish in context A flips chip in context B within 5-minute budget', async ({
    browser,
  }) => {
    const email = taggedEmail('s3-pub');

    // Context A: the publishing owner
    const ctxA: BrowserContext = await browser.newContext();
    const pageA: Page = await ctxA.newPage();
    await mockMapbox(pageA);
    await mockStorage(pageA);

    const t0 = Date.now();
    await signUp(pageA, email, PASSWORD);
    const restaurantId = await completeOnboarding(pageA, 'Suite3 Pub Cafe');
    expect(restaurantId).toBeTruthy();
    await pageA.goto(`/restaurant/${restaurantId}`);
    await expect(pageA.getByTestId('status-chip')).toHaveText('Draft', { timeout: 8_000 });

    // Context B: second tab, same user
    const ctxB: BrowserContext = await browser.newContext();
    const pageB: Page = await ctxB.newPage();
    await pageB.goto('/signin');
    await pageB.getByLabel('Email').fill(email);
    await pageB.getByLabel('Password', { exact: true }).fill(PASSWORD);
    await pageB.getByRole('button', { name: /sign in/i }).click();
    await pageB.goto(`/restaurant/${restaurantId}`);
    await expect(pageB.getByTestId('status-chip')).toHaveText('Draft', { timeout: 8_000 });

    // Context A publishes — after completeOnboarding the button must be enabled.
    // A disabled button here is a product bug (precondition check wrong), not an env gap.
    const publishBtn = pageA.getByTestId('publish-button');
    await expect(publishBtn).toBeEnabled({ timeout: 8_000 });
    await publishBtn.click();
    await expect(pageA.getByTestId('status-chip')).toHaveText('Live', { timeout: 8_000 });

    // Context B receives Realtime broadcast — chip flips without reload
    await expect(pageB.getByTestId('status-chip')).toHaveText('Live', { timeout: 12_000 });

    const elapsed = Date.now() - t0;
    // Design §2.5: draft-to-publish flow ≤ 5 minutes end-to-end
    expect(elapsed, `Publish flow exceeded 5-minute budget: ${elapsed}ms`).toBeLessThan(5 * 60_000);

    await ctxA.close();
    await ctxB.close();
  });
});
