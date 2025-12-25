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
  await page.waitForURL(/auth0\.com|\/login/, { timeout: 30000 });

  // Auth0 Universal Login uses various input selectors depending on version
  // Try multiple selectors for compatibility
  const emailSelectors = [
    'input[name="email"]',
    'input[name="username"]',
    'input[id="username"]',
    'input[type="email"]',
    'input[data-testid="username-input"]',
    'input[autocomplete="username"]',
  ];

  const passwordSelectors = [
    'input[name="password"]',
    'input[id="password"]',
    'input[type="password"]',
    'input[data-testid="password-input"]',
  ];

  // Find and fill email/username field
  let emailFilled = false;
  for (const selector of emailSelectors) {
    try {
      const emailInput = page.locator(selector).first();
      if (await emailInput.isVisible({ timeout: 2000 })) {
        await emailInput.fill(email);
        emailFilled = true;
        break;
      }
    } catch {
      // Try next selector
    }
  }

  if (!emailFilled) {
    throw new Error('Could not find email/username input field on Auth0 login page');
  }

  // Find and fill password field
  let passwordFilled = false;
  for (const selector of passwordSelectors) {
    try {
      const passwordInput = page.locator(selector).first();
      if (await passwordInput.isVisible({ timeout: 2000 })) {
        await passwordInput.fill(password);
        passwordFilled = true;
        break;
      }
    } catch {
      // Try next selector
    }
  }

  if (!passwordFilled) {
    throw new Error('Could not find password input field on Auth0 login page');
  }

  // Submit login - try multiple selectors for the submit button
  const submitSelectors = [
    'button[type="submit"]',
    'button[name="action"]',
    'button[data-testid="submit-button"]',
    'button:has-text("Continue")',
    'button:has-text("Log In")',
    'button:has-text("Sign In")',
  ];

  let submitted = false;
  for (const selector of submitSelectors) {
    try {
      const submitButton = page.locator(selector).first();
      if (await submitButton.isVisible({ timeout: 2000 })) {
        await submitButton.click();
        submitted = true;
        break;
      }
    } catch {
      // Try next selector
    }
  }

  if (!submitted) {
    throw new Error('Could not find submit button on Auth0 login page');
  }

  // Wait for redirect back to app (base URL agnostic - matches any /dashboard path)
  await page.waitForURL(/\/dashboard/, { timeout: 30000 });

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
