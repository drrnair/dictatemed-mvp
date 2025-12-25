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

  // Wait for Auth0 login page - we need to wait for actual login form, not just the URL
  // The /authorize endpoint redirects to the actual login page
  await page.waitForURL(/auth0\.com/, { timeout: 30000 });

  // Wait for page to be fully loaded and all network requests to settle
  await page.waitForLoadState('networkidle', { timeout: 30000 });

  // Auth0 Universal Login uses various input selectors depending on version
  // Build a combined selector for all possible email/username inputs
  const emailSelectorString = [
    'input[name="email"]',
    'input[name="username"]',
    'input[id="username"]',
    'input[type="email"]',
    'input[data-testid="username-input"]',
    'input[autocomplete="username"]',
    'input[autocomplete="email"]',
    // Auth0 Universal Login (New Experience) selectors
    'input[inputmode="email"]',
    '#1-email',
  ].join(', ');

  const passwordSelectorString = [
    'input[name="password"]',
    'input[id="password"]',
    'input[type="password"]',
    'input[data-testid="password-input"]',
  ].join(', ');

  // Wait for email/username input with combined selector (longer timeout)
  const emailInput = page.locator(emailSelectorString).first();
  try {
    await emailInput.waitFor({ state: 'visible', timeout: 15000 });
    await emailInput.fill(email);
  } catch (error) {
    // Take a screenshot and capture page info to debug what the page looks like
    await page.screenshot({ path: 'test-results/auth-debug-email-field.png', fullPage: true });
    const pageTitle = await page.title();
    const bodyText = await page.locator('body').textContent().catch(() => 'Could not get body text');
    console.error(`Auth0 Debug - URL: ${page.url()}`);
    console.error(`Auth0 Debug - Title: ${pageTitle}`);
    console.error(`Auth0 Debug - Body text preview: ${bodyText?.substring(0, 500)}`);
    throw new Error(`Could not find email/username input field on Auth0 login page. URL: ${page.url()}, Title: ${pageTitle}`);
  }

  // Wait for password field (may appear after email on some Auth0 configurations)
  const passwordInput = page.locator(passwordSelectorString).first();
  try {
    await passwordInput.waitFor({ state: 'visible', timeout: 10000 });
    await passwordInput.fill(password);
  } catch (error) {
    await page.screenshot({ path: 'test-results/auth-debug-password-field.png', fullPage: true });
    throw new Error(`Could not find password input field on Auth0 login page. URL: ${page.url()}`);
  }

  // Submit login - combined selector for submit button
  const submitSelectorString = [
    'button[type="submit"]',
    'button[name="action"]',
    'button[data-testid="submit-button"]',
    'button[data-action-button-primary="true"]',
    'button:has-text("Continue")',
    'button:has-text("Log In")',
    'button:has-text("Sign In")',
    'button:has-text("Login")',
  ].join(', ');

  const submitButton = page.locator(submitSelectorString).first();
  try {
    await submitButton.waitFor({ state: 'visible', timeout: 10000 });
    await submitButton.click();
  } catch (error) {
    await page.screenshot({ path: 'test-results/auth-debug-submit-button.png', fullPage: true });
    throw new Error(`Could not find submit button on Auth0 login page. URL: ${page.url()}`);
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
