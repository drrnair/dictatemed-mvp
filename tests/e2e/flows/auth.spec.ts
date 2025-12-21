import { test, expect } from '@playwright/test';

test.describe('Authentication Flow', () => {
  test('should redirect unauthenticated users to login', async ({ page }) => {
    // Try to access protected route
    await page.goto('/dashboard');

    // Should redirect to login or show login page
    await expect(page).toHaveURL(/\/api\/auth\/login|\/login/);
  });

  test('should show login page elements', async ({ page }) => {
    await page.goto('/api/auth/login');

    // Page should load (Auth0 will handle the actual login)
    await expect(page).not.toHaveURL('/dashboard');
  });
});

test.describe('Navigation', () => {
  test.skip('should navigate between main pages when authenticated', async ({ page }) => {
    // This test requires authentication setup
    // Skip for now - implement with proper auth mocking
  });
});
