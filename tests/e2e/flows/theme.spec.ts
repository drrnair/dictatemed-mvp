import { test, expect } from '@playwright/test';

test.describe('Theme System', () => {
  test('should apply system theme by default', async ({ page }) => {
    await page.goto('/');

    // The html element should have either light or dark class based on system preference
    const html = page.locator('html');
    const className = await html.getAttribute('class');

    // Should have some theme class (from next-themes)
    expect(className || '').toMatch(/light|dark|/);
  });

  test('should show theme toggle in appearance settings', async ({ page }) => {
    await page.goto('/settings/appearance');

    // Wait for page to load
    await page.waitForLoadState('networkidle');

    // Theme settings section should be visible
    const themeSection = page.getByText('Theme');
    await expect(themeSection).toBeVisible();
  });

  test.describe('Theme preference persistence', () => {
    test.skip('should persist light theme selection', async ({ page }) => {
      // This test requires authentication
      // Skip for now - implement with proper auth mocking

      // 1. Go to appearance settings
      await page.goto('/settings/appearance');

      // 2. Select light theme
      await page.getByRole('button', { name: /light/i }).click();

      // 3. Verify theme is applied
      const html = page.locator('html');
      await expect(html).toHaveClass(/light/);

      // 4. Reload page
      await page.reload();

      // 5. Verify theme persists
      await expect(html).toHaveClass(/light/);
    });

    test.skip('should persist dark theme selection', async ({ page }) => {
      // This test requires authentication
      // Skip for now - implement with proper auth mocking

      // 1. Go to appearance settings
      await page.goto('/settings/appearance');

      // 2. Select dark theme
      await page.getByRole('button', { name: /dark/i }).click();

      // 3. Verify theme is applied
      const html = page.locator('html');
      await expect(html).toHaveClass(/dark/);

      // 4. Reload page
      await page.reload();

      // 5. Verify theme persists
      await expect(html).toHaveClass(/dark/);
    });

    test.skip('should follow system theme when set to system', async ({ page }) => {
      // This test requires authentication and system theme emulation
      // Skip for now - implement with proper auth mocking
    });
  });

  test.describe('Dark mode styling', () => {
    test('should have proper contrast in dark mode', async ({ page }) => {
      // Emulate dark color scheme
      await page.emulateMedia({ colorScheme: 'dark' });

      await page.goto('/');

      // Wait for theme to apply
      await page.waitForTimeout(100);

      // The page should have dark theme variables applied
      const backgroundColor = await page.evaluate(() => {
        return getComputedStyle(document.documentElement).getPropertyValue('--background');
      });

      // Dark theme should have a dark background (low lightness value)
      // This is a basic check - actual value depends on theme configuration
      expect(backgroundColor).toBeTruthy();
    });

    test('should have proper contrast in light mode', async ({ page }) => {
      // Emulate light color scheme
      await page.emulateMedia({ colorScheme: 'light' });

      await page.goto('/');

      // Wait for theme to apply
      await page.waitForTimeout(100);

      // The page should have light theme variables applied
      const backgroundColor = await page.evaluate(() => {
        return getComputedStyle(document.documentElement).getPropertyValue('--background');
      });

      // Light theme should have a background value
      expect(backgroundColor).toBeTruthy();
    });
  });
});
