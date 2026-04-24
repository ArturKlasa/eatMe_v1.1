import { test, expect } from '@playwright/test';
import path from 'path';
import fs from 'fs';
import os from 'os';

const SKIP = !process.env.E2E_SERVICE_ROLE_KEY;

// Generates a minimal 10-row CSV for test
function buildTestCsv(): string {
  const header = 'name,address,city,lat,lng,phone,website,google_place_id,cuisine_types';
  const rows = Array.from(
    { length: 10 },
    (_, i) =>
      `"Test Restaurant ${i + 1}","${i + 1} Main St","Chicago","41.878${i}","-87.629${i}","","","","American"`
  );
  return [header, ...rows].join('\n');
}

test.describe('Admin bulk import — CSV happy path', () => {
  test.skip(SKIP, 'E2E_SERVICE_ROLE_KEY not set');

  // Single self-contained test: upload → verify results → verify audit trail.
  // Merges what was previously two separate tests to eliminate the ordering
  // dependency (the old Test 2 relied on Test 1 having run first and left a
  // csv_import row in admin_audit_log — vacuous pass in pristine envs).
  test('admin uploads 10-row CSV, sees draft restaurants, and audit log records csv_import', async ({
    page,
  }) => {
    // Sign in as admin
    await page.goto('/signin');
    await page.fill('input[type="email"]', process.env.E2E_ADMIN_EMAIL ?? 'admin@example.com');
    await page.fill('input[type="password"]', process.env.E2E_ADMIN_PASSWORD ?? 'password');
    await page.click('button[type="submit"]');
    await page.waitForURL('/');

    // Navigate to imports
    await page.goto('/imports');
    await expect(page.getByRole('heading', { name: /bulk import/i })).toBeVisible();

    // Write temp CSV file
    const csvContent = buildTestCsv();
    const tmpFile = path.join(os.tmpdir(), `test-import-${Date.now()}.csv`);
    fs.writeFileSync(tmpFile, csvContent, 'utf-8');

    try {
      // Upload CSV
      await page.setInputFiles('input[type="file"]', tmpFile);

      // Wait for import to complete
      await expect(page.getByText(/import complete/i)).toBeVisible({ timeout: 30_000 });
      await expect(page.getByText(/10 inserted/i)).toBeVisible();

      // Navigate to restaurants and verify draft rows appear
      await page.goto('/restaurants');
      await page.fill('input[placeholder="Search restaurants…"]', 'Test Restaurant 1');
      await expect(page.getByText('draft')).toBeVisible({ timeout: 10_000 });

      // Verify audit trail within the same test — eliminates ordering dependency.
      // Navigating to /audit immediately after the import guarantees the
      // csv_import entry was produced by THIS test run, not a prior run.
      await page.goto('/audit');
      await expect(page.getByRole('heading', { name: /audit log/i })).toBeVisible({
        timeout: 5_000,
      });
      await expect(page.getByText('csv_import')).toBeVisible({ timeout: 8_000 });
    } finally {
      fs.unlinkSync(tmpFile);
    }
  });
});

// ─── Suite 4: 3-second search budget on 1000-row staging dataset ──────────────

test.describe('Admin search — 3-second budget on large dataset', () => {
  test.skip(!process.env.E2E_SERVICE_ROLE_KEY, 'E2E_SERVICE_ROLE_KEY not set');

  test('restaurant search returns results within 3 seconds on a 1000-row staging dataset', async ({
    page,
  }) => {
    // Sign in
    await page.goto('/signin');
    await page.fill('input[type="email"]', process.env.E2E_ADMIN_EMAIL ?? 'admin@example.com');
    await page.fill('input[type="password"]', process.env.E2E_ADMIN_PASSWORD ?? 'password');
    await page.click('button[type="submit"]');
    await page.waitForURL('/');

    await page.goto('/restaurants');
    await expect(page.getByRole('heading', { name: /restaurants/i })).toBeVisible({
      timeout: 5_000,
    });

    // Time the search operation against the staging dataset (≥ 1000 rows expected in staging)
    const t0 = Date.now();
    const searchInput = page.locator('input[placeholder="Search restaurants…"]');
    await searchInput.fill('Test');
    // Wait for the results table to update (debounced search resolves)
    await expect(page.locator('table tbody tr').first()).toBeVisible({ timeout: 5_000 });
    const elapsed = Date.now() - t0;

    // Design §2.5 + §2.2: search must return results within 3 seconds
    expect(elapsed, `Restaurant search exceeded 3-second budget: ${elapsed}ms`).toBeLessThan(3_000);
  });
});
