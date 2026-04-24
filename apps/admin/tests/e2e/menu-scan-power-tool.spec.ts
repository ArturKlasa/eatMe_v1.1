import { test, expect } from '@playwright/test';

const SKIP = !process.env.E2E_SERVICE_ROLE_KEY;

test.describe('Admin menu-scan power tool', () => {
  test.skip(SKIP, 'E2E_SERVICE_ROLE_KEY not set');

  // Suite covers: admin uploads 3-page PDF -> 3 jobs appear -> one completes -> replay with mini -> 4th job appears
  test('admin uploads PDF and replays with gpt-4o-mini', async ({ page }) => {
    // scaffold only — real implementation deferred to Step 26
    test.skip(true, 'Full E2E scaffolded for Step 26');
    expect(page).toBeDefined();
  });
});
