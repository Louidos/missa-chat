import { expect, test } from '@playwright/test';

test('App startet und zeigt den Titel', async ({ page }) => {
  await page.goto('/');
  await expect(page).toHaveTitle('Missa');
});
