import { test, expect } from '@playwright/test';

// Scaffold — filled during Step 16 when the onboarding stepper is implemented.
test.describe('Onboarding happy path', () => {
  test.skip('fresh user signs up → onboard → creates restaurant → reopens with data prefilled', async ({
    page,
  }) => {
    // 1. Sign up as a fresh user.
    await page.goto('/signup');
    await page.fill('[name=email]', `test+${Date.now()}@example.com`);
    await page.fill('[name=password]', 'supersecret123');
    await page.click('button[type=submit]');

    // 2. Should land on /onboard.
    await expect(page).toHaveURL(/\/onboard/);

    // 3. Click "Create your restaurant" (rendered by the Step 16 stepper).
    await page.click('text=Create your restaurant');

    // 4. Type name and blur to trigger autosave.
    await page.fill('[name=name]', 'Test Cafe');
    await page.keyboard.press('Tab');

    // 5. Toast confirms draft saved.
    await expect(page.getByText('Draft saved.')).toBeVisible();

    // 6. Capture the current URL (contains the restaurant id).
    const restaurantUrl = page.url();

    // 7. Navigate away and return — data is persisted in DB (not localStorage).
    await page.goto('/onboard');
    await expect(page).toHaveURL(new RegExp(restaurantUrl));

    // 8. Form is prefilled with "Test Cafe".
    await expect(page.locator('[name=name]')).toHaveValue('Test Cafe');

    // 9. Status chip shows "Draft".
    await expect(page.getByText('Draft')).toBeVisible();
  });
});
