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
import { TEST_TIMEOUTS } from './test-data';

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
  await page.waitForURL(/auth0\.com/, { timeout: TEST_TIMEOUTS.auth0Redirect });

  // Wait for page to be fully loaded - use 'load' then 'networkidle' for more reliability
  await page.waitForLoadState('load', { timeout: TEST_TIMEOUTS.pageLoad });
  await page.waitForLoadState('domcontentloaded', { timeout: TEST_TIMEOUTS.pageLoad });

  // Additional wait for Auth0 to finish rendering the login form
  // Auth0 Universal Login can take time to fully render after DOM is ready
  await page.waitForTimeout(2000);

  // Try to wait for networkidle, but don't fail if it times out (Auth0 may have long-polling)
  await page.waitForLoadState('networkidle', { timeout: TEST_TIMEOUTS.networkIdle }).catch(() => {
    console.log('Auth0: networkidle timeout - proceeding anyway');
  });

  // Auth0 Universal Login uses various input selectors depending on version
  // Build a combined selector for all possible email/username inputs
  // Including both New Universal Login and Classic Lock widget selectors
  const emailSelectorString = [
    // Universal Login (New Experience)
    'input[name="email"]',
    'input[name="username"]',
    'input[id="username"]',
    'input[type="email"]',
    'input[data-testid="username-input"]',
    'input[autocomplete="username"]',
    'input[autocomplete="email"]',
    'input[inputmode="email"]',
    '#1-email',
    // Auth0 Lock widget (Classic)
    '.auth0-lock-input[name="email"]',
    '.auth0-lock-input[name="username"]',
    'input.auth0-lock-input',
    // Identifier-first variations
    'input[aria-label*="email" i]',
    'input[aria-label*="username" i]',
    'input[placeholder*="email" i]',
    'input[placeholder*="username" i]',
  ].join(', ');

  const passwordSelectorString = [
    // Universal Login
    'input[name="password"]',
    'input[id="password"]',
    'input[type="password"]',
    'input[data-testid="password-input"]',
    // Auth0 Lock widget
    '.auth0-lock-input[name="password"]',
    'input.auth0-lock-input[type="password"]',
  ].join(', ');

  // Submit button selector - used for both email and password steps
  const submitSelectorString = [
    // Universal Login
    'button[type="submit"]',
    'button[name="action"]',
    'button[data-testid="submit-button"]',
    'button[data-action-button-primary="true"]',
    'button:has-text("Continue")',
    'button:has-text("Log In")',
    'button:has-text("Sign In")',
    'button:has-text("Login")',
    // Auth0 Lock widget
    '.auth0-lock-submit',
    'button.auth0-lock-submit',
  ].join(', ');

  // Wait for email/username input with combined selector (longer timeout)
  const emailInput = page.locator(emailSelectorString).first();
  try {
    await emailInput.waitFor({ state: 'visible', timeout: TEST_TIMEOUTS.auth0Login });
    await emailInput.fill(email);
  } catch (error) {
    // Take a screenshot and capture page info to debug what the page looks like
    await page.screenshot({ path: 'test-results/auth-debug-email-field.png', fullPage: true });
    const pageTitle = await page.title();
    const currentUrl = page.url();
    const bodyText = await page.locator('body').textContent().catch(() => 'Could not get body text');
    const bodyHtml = await page.locator('body').innerHTML().catch(() => 'Could not get body HTML');

    // Check how many input fields exist on the page
    const allInputs = await page.locator('input').count();
    const allButtons = await page.locator('button').count();
    const allForms = await page.locator('form').count();

    console.error(`\n${'='.repeat(60)}`);
    console.error('AUTH0 LOGIN FAILED - Debug Information:');
    console.error(`${'='.repeat(60)}`);
    console.error(`URL: ${currentUrl}`);
    console.error(`Title: ${pageTitle}`);
    console.error(`Page elements: ${allInputs} inputs, ${allButtons} buttons, ${allForms} forms`);
    console.error(`Body text preview: ${bodyText?.substring(0, 500)}`);
    console.error(`Body HTML preview: ${bodyHtml?.substring(0, 1000)}`);

    // Check for common Auth0 configuration issues
    if (allInputs === 0) {
      console.error(`\n${'!'.repeat(60)}`);
      console.error('CRITICAL: No input fields found on the page!');
      console.error(`${'!'.repeat(60)}`);
      console.error('The Auth0 login form is not rendering at all. Possible causes:');
      console.error('');
      console.error('1. Auth0 Universal Login JavaScript not loading:');
      console.error('   - Check browser console for JavaScript errors');
      console.error('   - Ensure JavaScript is enabled in Playwright');
      console.error('');
      console.error('2. Auth0 tenant configuration issue:');
      console.error('   - Go to Auth0 Dashboard → Branding → Universal Login');
      console.error('   - Try switching between "New" and "Classic" experience');
      console.error('   - Ensure the login page is not customized incorrectly');
      console.error('');
      console.error('3. Auth0 application settings:');
      console.error('   - Go to Auth0 Dashboard → Applications → Your App → Settings');
      console.error('   - Verify Allowed Callback URLs includes: http://localhost:3000/api/auth/callback');
      console.error('   - Verify Allowed Web Origins includes: http://localhost:3000');
      console.error('   - Verify Allowed Logout URLs includes: http://localhost:3000');
      console.error('');
      console.error('4. Try manually visiting the Auth0 login URL in a browser to see what loads');
      console.error(`${'!'.repeat(60)}\n`);
    } else if (currentUrl.includes('/authorize') && !bodyText?.includes('email') && !bodyText?.includes('password')) {
      console.error(`\n${'!'.repeat(60)}`);
      console.error('LIKELY CAUSE: Auth0 application misconfiguration');
      console.error(`${'!'.repeat(60)}`);
      console.error('The Auth0 login form is not rendering. This usually means:');
      console.error('1. Callback URL not configured in Auth0:');
      console.error('   - Go to Auth0 Dashboard → Applications → Your App → Settings');
      console.error('   - Add "http://localhost:3000/api/auth/callback" to Allowed Callback URLs');
      console.error('2. Application URLs not configured:');
      console.error('   - Add "http://localhost:3000" to Allowed Web Origins');
      console.error('3. Universal Login not enabled:');
      console.error('   - Go to Auth0 Dashboard → Branding → Universal Login');
      console.error('   - Ensure "New Universal Login Experience" is selected');
      console.error(`${'!'.repeat(60)}\n`);
    }

    throw new Error(`Could not find email/username input field on Auth0 login page. URL: ${currentUrl}, Title: ${pageTitle}`);
  }

  // Check if password field is visible immediately (combined form) or if we need to click Continue first (Identifier First flow)
  const passwordInput = page.locator(passwordSelectorString).first();
  const isPasswordVisible = await passwordInput.isVisible().catch(() => false);

  if (!isPasswordVisible) {
    // Identifier First flow - need to click Continue after email
    console.log('Auth0: Password not visible, trying Identifier First flow...');
    const continueButton = page.locator(submitSelectorString).first();
    try {
      await continueButton.waitFor({ state: 'visible', timeout: TEST_TIMEOUTS.auth0Submit });
      await continueButton.click();
      // Wait for password field to appear after clicking Continue
      await passwordInput.waitFor({ state: 'visible', timeout: TEST_TIMEOUTS.auth0Submit });
    } catch (error) {
      await page.screenshot({ path: 'test-results/auth-debug-identifier-first.png', fullPage: true });
      throw new Error(`Identifier First flow failed - could not proceed after email. URL: ${page.url()}`);
    }
  }

  // Now fill password
  try {
    await passwordInput.fill(password);
  } catch (error) {
    await page.screenshot({ path: 'test-results/auth-debug-password-field.png', fullPage: true });
    throw new Error(`Could not fill password field on Auth0 login page. URL: ${page.url()}`);
  }

  // Submit login
  const submitButton = page.locator(submitSelectorString).first();
  try {
    await submitButton.waitFor({ state: 'visible', timeout: TEST_TIMEOUTS.auth0Submit });
    await submitButton.click();
  } catch (error) {
    await page.screenshot({ path: 'test-results/auth-debug-submit-button.png', fullPage: true });
    throw new Error(`Could not find submit button on Auth0 login page. URL: ${page.url()}`);
  }

  // Wait for redirect back to app (base URL agnostic - matches any /dashboard path)
  await page.waitForURL(/\/dashboard/, { timeout: TEST_TIMEOUTS.auth0Redirect });

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
