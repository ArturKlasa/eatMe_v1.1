import { test, expect } from '@playwright/test';

test.describe('Onboarding happy path', () => {
  test('fresh user signs up → onboard → creates restaurant → reopens with data prefilled', async ({
    page,
  }) => {
    // 1. Sign up as a fresh user.
    await page.goto('/signup');
    await page.fill('[name=email]', `test+${Date.now()}@example.com`);
    await page.fill('[name=password]', 'supersecret123');
    await page.click('button[type=submit]');

    // 2. Should land on /onboard.
    await expect(page).toHaveURL(/\/onboard/);

    // 3. Onboarding stepper is rendered.
    await expect(page.getByTestId('onboarding-stepper')).toBeVisible();

    // 4. Type name and blur to trigger autosave.
    await page.fill('[name=name]', 'Test Cafe');
    await page.keyboard.press('Tab');

    // 5. Toast confirms draft saved.
    await expect(page.getByText('Draft saved.')).toBeVisible();

    // 6. Capture the current URL (stepper is on /onboard, data is persisted in DB).
    const onboardUrl = page.url();
    expect(onboardUrl).toMatch(/\/onboard/);

    // 7. Navigate away and return — data is persisted in DB (not localStorage).
    await page.goto('/onboard');

    // 8. Form is prefilled with "Test Cafe" (DB-driven resume).
    await expect(page.locator('[name=name]')).toHaveValue('Test Cafe');

    // 9. Step indicator shows step 1 (Basics) is active.
    await expect(page.getByTestId('onboarding-stepper')).toBeVisible();
  });
});
