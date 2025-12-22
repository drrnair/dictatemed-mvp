// tests/e2e/fixtures/auth.ts
// Authentication fixtures for E2E tests
//
// Usage:
// 1. Set environment variables:
//    - E2E_TEST_USER_EMAIL: test user email
//    - E2E_TEST_USER_PASSWORD: test user password
//
// 2. Generate auth state file:
//    npx playwright test --project=setup
//
// 3. Use authenticated tests:
//    import { authenticatedTest } from '../fixtures/auth';
//    authenticatedTest('test name', async ({ page }) => { ... });

import { test as base, expect, Page } from '@playwright/test';
import * as fs from 'fs';
import * as path from 'path';

// Path to store authenticated state
export const AUTH_STATE_PATH = path.join(__dirname, '../.auth/user.json');

/**
 * Check if auth state file exists and is valid
 */
export function hasValidAuthState(): boolean {
  if (!fs.existsSync(AUTH_STATE_PATH)) {
    return false;
  }

  try {
    const state = JSON.parse(fs.readFileSync(AUTH_STATE_PATH, 'utf-8'));
    // Check if state has cookies (basic validation)
    return state.cookies && state.cookies.length > 0;
  } catch {
    return false;
  }
}

/**
 * Setup: Login and save authentication state
 * Run this once before authenticated tests:
 *   npx playwright test tests/e2e/setup/auth.setup.ts --project=chromium
 */
export async function authenticateAndSaveState(page: Page): Promise<void> {
  const email = process.env.E2E_TEST_USER_EMAIL;
  const password = process.env.E2E_TEST_USER_PASSWORD;

  if (!email || !password) {
    throw new Error(
      'E2E_TEST_USER_EMAIL and E2E_TEST_USER_PASSWORD environment variables must be set'
    );
  }

  // Navigate to login
  await page.goto('/api/auth/login');

  // Wait for Auth0 login page
  await page.waitForURL(/auth0\.com|\/login/);

  // Fill credentials
  await page.fill('input[name="email"], input[name="username"]', email);
  await page.fill('input[name="password"]', password);

  // Submit login
  await page.click('button[type="submit"]');

  // Wait for redirect back to app
  await page.waitForURL(/localhost:3000\/dashboard/, { timeout: 30000 });

  // Verify authentication
  await expect(page.locator('body')).not.toContainText('Login');

  // Ensure directory exists
  const authDir = path.dirname(AUTH_STATE_PATH);
  if (!fs.existsSync(authDir)) {
    fs.mkdirSync(authDir, { recursive: true });
  }

  // Save storage state
  await page.context().storageState({ path: AUTH_STATE_PATH });
}

/**
 * Extended test fixture with authentication
 * Uses saved auth state for faster tests
 */
export const authenticatedTest = base.extend<{ authenticatedPage: Page }>({
  authenticatedPage: async ({ browser }, use) => {
    // Check if auth state exists
    if (!hasValidAuthState()) {
      console.warn(
        'No auth state found. Run auth setup first:\n' +
        '  npx playwright test tests/e2e/setup/auth.setup.ts --project=chromium'
      );
      // Create page without auth for tests that handle auth themselves
      const context = await browser.newContext();
      const page = await context.newPage();
      await use(page);
      await context.close();
      return;
    }

    // Create context with saved auth state
    const context = await browser.newContext({
      storageState: AUTH_STATE_PATH,
    });
    const page = await context.newPage();

    await use(page);

    await context.close();
  },
});

/**
 * Mock authentication for API tests
 * Use this to bypass Auth0 for faster API-level tests
 */
export function getMockAuthHeaders(): Record<string, string> {
  const mockToken = process.env.E2E_MOCK_AUTH_TOKEN;

  if (!mockToken) {
    return {};
  }

  return {
    'Authorization': `Bearer ${mockToken}`,
    'X-Test-Auth': 'true',
  };
}

/**
 * Skip test if no auth setup is available
 */
export function skipWithoutAuth(testFn: typeof base): void {
  const hasAuth = hasValidAuthState() ||
                  (process.env.E2E_TEST_USER_EMAIL && process.env.E2E_TEST_USER_PASSWORD);

  if (!hasAuth) {
    testFn.skip();
  }
}
