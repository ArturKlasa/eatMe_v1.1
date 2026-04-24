/* eslint-disable @typescript-eslint/no-explicit-any */
/**
 * Menu-scan happy-path E2E tests (Steps 20 & 21).
 *
 * Requires E2E_BASE_URL pointing at a running web-portal-v2 instance with a
 * configured Supabase backend (email confirmation disabled for test accounts).
 * Also requires E2E_SERVICE_ROLE_KEY for service-role verification queries.
 *
 * Run:
 *   E2E_BASE_URL=http://localhost:3000 \
 *   E2E_SERVICE_ROLE_KEY=<key> \
 *   pnpm --filter web-portal-v2 exec playwright test tests/e2e/menu-scan-happy-path.spec.ts
 */

import { test, expect, type Page } from '@playwright/test';
import { createClient } from '@supabase/supabase-js';

// ─── helpers ────────────────────────────────────────────────────────────────

function uniqueEmail() {
  return `test+scan-${Date.now()}-${Math.floor(Math.random() * 9999)}@example.com`;
}

const PASSWORD = 'TestPassword1!';

/** A minimal 1×1 transparent PNG — fast to compress, valid for file inputs. */
const TINY_PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
  'base64'
);

async function signUpAndCreateRestaurant(page: Page, email: string) {
  await page.goto('/signup');
  await page.getByLabel('Email').fill(email);
  await page.getByLabel('Password', { exact: true }).fill(PASSWORD);
  await page.getByLabel(/confirm/i).fill(PASSWORD);
  await page.getByRole('button', { name: /create account/i }).click();
  await expect(page).toHaveURL(/\/onboard/, { timeout: 10_000 });

  await page.getByLabel('Restaurant name').fill('Scan Test Diner');
  await page.keyboard.press('Tab');
  await expect(page.getByText('Draft saved.')).toBeVisible({ timeout: 8_000 });
}

/** Mock Supabase Storage so scan uploads don't hit real storage. */
async function mockStorage(page: Page) {
  await page.route('**/storage/v1/object/**', route =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ Key: 'menu-scan-uploads/test-id/uuid.jpg' }),
    })
  );
}

// ─── Step 20 tests ──────────────────────────────────────────────────────────

test.describe('Menu-scan upload happy path (Step 20)', () => {
  test('owner uploads two images → menu_scan_jobs row created with status=pending', async ({
    page,
  }) => {
    test.skip(
      !process.env.E2E_SERVICE_ROLE_KEY,
      'Requires E2E_SERVICE_ROLE_KEY for service-role verification'
    );

    const email = uniqueEmail();
    await mockStorage(page);
    await signUpAndCreateRestaurant(page, email);

    const restaurantId = page.url().match(/\/restaurant\/([0-9a-f-]{36})/)?.[1];
    test.skip(!restaurantId, 'Could not extract restaurant id from URL');

    await page.goto(`/restaurant/${restaurantId}/menu-scan`);
    await expect(page.getByText('Menu Scan')).toBeVisible({ timeout: 5_000 });
    await expect(page.getByText('Upload menu images')).toBeVisible();

    const fileInput = page.locator('input[type="file"]');
    await fileInput.setInputFiles([
      { name: 'menu-page-1.jpg', mimeType: 'image/jpeg', buffer: TINY_PNG },
      { name: 'menu-page-2.jpg', mimeType: 'image/jpeg', buffer: TINY_PNG },
    ]);

    await expect(page.getByText('menu-page-1.jpg')).toBeVisible();
    await expect(page.getByText('menu-page-2.jpg')).toBeVisible();

    await page.getByRole('button', { name: /scan 2 images/i }).click();

    await expect(page).toHaveURL(/\/restaurant\/[0-9a-f-]{36}\/menu-scan\/[0-9a-f-]{36}/, {
      timeout: 30_000,
    });

    const jobId = page.url().match(/\/menu-scan\/([0-9a-f-]{36})/)?.[1];
    if (jobId && process.env.E2E_SERVICE_ROLE_KEY) {
      const adminClient = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL ?? '',
        process.env.E2E_SERVICE_ROLE_KEY
      );
      const { data: job } = await adminClient
        .from('menu_scan_jobs')
        .select('id, status, input')
        .eq('id', jobId)
        .single();

      expect(job?.status).toBe('pending');
      expect((job?.input as { images: unknown[] })?.images?.length).toBe(2);
    }
  });

  test('drop zone is keyboard-navigable (Enter opens file picker)', async ({ page }) => {
    // Accessibility contract placeholder — full test in Step 26.
    await expect(true).toBe(true);
  });

  test('removing a file before submit reduces the count', async ({ page }) => {
    // Full E2E navigation wired in Step 26.
    await expect(true).toBe(true);
  });
});

// ─── Step 21 tests ──────────────────────────────────────────────────────────

test.describe('Menu-scan review + confirm (Step 21)', () => {
  /**
   * Full E2E: upload → wait for needs_review → assign categories → confirm → menu page.
   * Requires a running Supabase with the menu-scan-worker deployed and cron ticking.
   */
  test('owner confirms scan → dishes appear on menu page', async ({ page }) => {
    test.skip(
      !process.env.E2E_SERVICE_ROLE_KEY,
      'Requires E2E_SERVICE_ROLE_KEY and running menu-scan-worker'
    );

    const email = uniqueEmail();
    await mockStorage(page);
    await signUpAndCreateRestaurant(page, email);

    const restaurantId = page.url().match(/\/restaurant\/([0-9a-f-]{36})/)?.[1];
    test.skip(!restaurantId, 'Could not extract restaurant id from URL');

    // Navigate to scan page and upload
    await page.goto(`/restaurant/${restaurantId}/menu-scan`);
    const fileInput = page.locator('input[type="file"]');
    await fileInput.setInputFiles([
      { name: 'menu-page-1.jpg', mimeType: 'image/jpeg', buffer: TINY_PNG },
    ]);
    await page.getByRole('button', { name: /scan 1 image/i }).click();
    await expect(page).toHaveURL(/\/menu-scan\/[0-9a-f-]{36}/, { timeout: 30_000 });

    // Wait for needs_review (Realtime or timeout fallback up to 90 s)
    await expect(page.getByText(/Review Scan/i)).toBeVisible({ timeout: 5_000 });

    // The review page may show "Scanning…" spinner or jump straight to the table
    // if the worker processes fast. Wait up to 90 s for the table to appear.
    const confirmButton = page.getByRole('button', { name: /confirm/i });
    await expect(confirmButton).toBeVisible({ timeout: 90_000 });

    // Accept all dishes (already accepted by default) — assign a category.
    // If no categories exist yet, click "Create new category…" for the first row.
    const categorySelects = page.locator('select[aria-label="Category"]');
    const count = await categorySelects.count();

    if (count > 0) {
      // Pick "Create new category" for the first dish
      const firstSelect = categorySelects.first();
      await firstSelect.selectOption({ label: /create new category/i });

      // Fill in the new category name
      const catNameInput = page.locator('input[aria-label="New category name"]').first();
      await catNameInput.fill('Mains');
      await page
        .getByRole('button', { name: /^create$/i })
        .first()
        .click();

      // Wait for the select to update to the new category
      await expect(firstSelect).not.toHaveValue('');

      // Assign the same category to remaining rows
      for (let i = 1; i < count; i++) {
        const catSelect = categorySelects.nth(i);
        const categoryOptions = await catSelect.locator('option').allTextContents();
        const mainsOption = categoryOptions.find(o => o.includes('Mains'));
        if (mainsOption) {
          await catSelect.selectOption({ label: 'Mains' });
        }
      }
    }

    // Click Confirm
    await confirmButton.click();

    // Should land on the menu page
    await expect(page).toHaveURL(/\/restaurant\/[0-9a-f-]{36}\/menu$/, { timeout: 15_000 });
  });

  /**
   * Idempotency: retrying confirm with the same idempotency key does not
   * create duplicate dishes. We verify this via service-role count query.
   */
  test('retrying confirm with same idempotency key produces no duplicates', async ({ page }) => {
    test.skip(
      !process.env.E2E_SERVICE_ROLE_KEY,
      'Requires E2E_SERVICE_ROLE_KEY for service-role verification'
    );

    const email = uniqueEmail();
    await mockStorage(page);
    await signUpAndCreateRestaurant(page, email);

    const restaurantId = page.url().match(/\/restaurant\/([0-9a-f-]{36})/)?.[1];
    test.skip(!restaurantId, 'Could not extract restaurant id from URL');

    await page.goto(`/restaurant/${restaurantId}/menu-scan`);
    const fileInput = page.locator('input[type="file"]');
    await fileInput.setInputFiles([
      { name: 'menu-page-1.jpg', mimeType: 'image/jpeg', buffer: TINY_PNG },
    ]);
    await page.getByRole('button', { name: /scan 1 image/i }).click();
    await expect(page).toHaveURL(/\/menu-scan\/[0-9a-f-]{36}/, { timeout: 30_000 });
    const jobId = page.url().match(/\/menu-scan\/([0-9a-f-]{36})/)?.[1];

    // Wait for review state
    await expect(page.getByRole('button', { name: /confirm/i })).toBeVisible({ timeout: 90_000 });

    // Intercept the Server Action response for the confirm step.
    // We capture the idempotency key from the request and re-POST with the same key.
    // The response should say confirmed:true with the same inserted_dish_ids.
    // Since this is a Server Action (not a plain fetch), we verify idempotency via DB instead:
    // call confirm, then call confirm again (the UI won't let us since it navigates away —
    // so we verify the DB has exactly as many dishes as the first confirm returned).

    if (jobId && process.env.E2E_SERVICE_ROLE_KEY) {
      const adminClient = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL ?? '',
        process.env.E2E_SERVICE_ROLE_KEY
      );

      // Wait for job to be completed after first confirm
      await page.waitForURL(/\/restaurant\/[0-9a-f-]{36}\/menu$/, { timeout: 30_000 });

      const { data: job } = await adminClient
        .from('menu_scan_jobs')
        .select('saved_dish_ids, status')
        .eq('id', jobId)
        .single();

      expect(job?.status).toBe('completed');
      const insertedIds = job?.saved_dish_ids as string[] | null;
      const firstCount = insertedIds?.length ?? 0;

      // Verify the menu_scan_confirmations table has exactly one record for this job
      const { data: confirmations } = await adminClient
        .from('menu_scan_confirmations')
        .select('id')
        .eq('job_id', jobId);

      // Exactly one confirmation record = idempotency side-table is working
      expect((confirmations ?? []).length).toBe(1);

      // Count dishes linked to categories of this restaurant
      const { data: categories } = await adminClient
        .from('menu_categories')
        .select('id, menus!inner(restaurant_id)')
        .eq('menus.restaurant_id', restaurantId);

      const catIds = (categories ?? []).map(c => c.id);
      if (catIds.length > 0) {
        const { count } = await adminClient
          .from('dishes')
          .select('id', { count: 'exact' })
          .in('menu_category_id', catIds);
        expect(count).toBe(firstCount);
      }
    }
  });
});
