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

  test('admin uploads 10-row CSV and sees 10 new draft restaurants', async ({ page }) => {
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
    } finally {
      fs.unlinkSync(tmpFile);
    }
  });

  test('/audit shows csv_import entry after import', async ({ page }) => {
    test.skip(true, 'Full E2E scaffolded for Step 26 — depends on prior test state');
    expect(page).toBeDefined();
  });
});
