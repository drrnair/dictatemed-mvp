// tests/e2e/page-objects/LoginPage.ts
// Page object for Auth0 login flow

import { Page, Locator, expect } from '@playwright/test';
import { BasePage } from './BasePage';

export class LoginPage extends BasePage {
  // Auth0 form selectors (Auth0 Universal Login)
  readonly emailInput: Locator;
  readonly passwordInput: Locator;
  readonly submitButton: Locator;
  readonly googleButton: Locator;
  readonly signUpLink: Locator;
  readonly errorMessage: Locator;

  // App login page selectors
  readonly loginWithEmailButton: Locator;
  readonly loginWithGoogleButton: Locator;

  constructor(page: Page) {
    super(page);

    // Auth0 Universal Login form elements (comprehensive selectors for different Auth0 versions)
    this.emailInput = page.locator([
      'input[name="email"]',
      'input[name="username"]',
      'input[id="username"]',
      'input[type="email"]',
      'input[data-testid="username-input"]',
      'input[autocomplete="username"]',
      'input[autocomplete="email"]',
      'input[inputmode="email"]',
      '#1-email',
    ].join(', '));
    this.passwordInput = page.locator([
      'input[name="password"]',
      'input[id="password"]',
      'input[type="password"]',
      'input[data-testid="password-input"]',
    ].join(', '));
    this.submitButton = page.locator([
      'button[type="submit"]',
      'button[name="action"]',
      'button[data-testid="submit-button"]',
      'button[data-action-button-primary="true"]',
    ].join(', '));
    this.googleButton = page.locator(
      'button[data-provider="google"], [data-connection="google-oauth2"]'
    );
    this.signUpLink = page.getByRole('link', { name: /sign up/i });
    this.errorMessage = page.locator(
      '[class*="error"], [role="alert"], .ulp-input-error'
    );

    // App's login page buttons (before Auth0 redirect)
    this.loginWithEmailButton = page.getByRole('link', { name: /continue with email/i });
    this.loginWithGoogleButton = page.getByRole('link', { name: /continue with google/i });
  }

  // ============================================
  // Navigation
  // ============================================

  /**
   * Navigate to login page
   */
  async gotoLogin(): Promise<void> {
    await this.goto('/api/auth/login');
  }

  /**
   * Navigate directly to Auth0 login (bypasses app login page)
   */
  async gotoAuth0Login(returnTo = '/dashboard'): Promise<void> {
    await this.goto(`/api/auth/login?returnTo=${encodeURIComponent(returnTo)}`);
  }

  /**
   * Navigate to signup page
   */
  async gotoSignup(): Promise<void> {
    await this.goto('/signup');
  }

  // ============================================
  // Login Actions
  // ============================================

  /**
   * Perform full login flow with email and password
   */
  async login(email: string, password: string): Promise<void> {
    // Navigate to login
    await this.gotoLogin();

    // Wait for Auth0 login page to load
    await this.page.waitForURL(/auth0\.com|\/login/, { timeout: 15000 });

    // Fill credentials
    await this.emailInput.waitFor({ state: 'visible', timeout: 10000 });
    await this.emailInput.fill(email);
    await this.passwordInput.fill(password);

    // Submit login
    await this.submitButton.click();

    // Wait for redirect back to app
    await this.page.waitForURL(/\/dashboard/, { timeout: 30000 });
  }

  /**
   * Login using environment variables
   */
  async loginWithEnvCredentials(): Promise<void> {
    const email = process.env.E2E_TEST_USER_EMAIL;
    const password = process.env.E2E_TEST_USER_PASSWORD;

    if (!email || !password) {
      throw new Error(
        'E2E_TEST_USER_EMAIL and E2E_TEST_USER_PASSWORD environment variables must be set'
      );
    }

    await this.login(email, password);
  }

  /**
   * Click Google login button (on app login page)
   */
  async clickGoogleLogin(): Promise<void> {
    await this.loginWithGoogleButton.click();
  }

  /**
   * Click email login button (on app login page)
   */
  async clickEmailLogin(): Promise<void> {
    await this.loginWithEmailButton.click();
  }

  // ============================================
  // Assertions
  // ============================================

  /**
   * Assert login was successful (user is on dashboard)
   */
  async expectLoginSuccess(): Promise<void> {
    await this.assertUrl(/\/dashboard/);
    // Verify user is authenticated by checking for dashboard content
    await this.assertTextVisible(/dashboard|welcome|good/i);
  }

  /**
   * Assert login failed with error message
   */
  async expectLoginError(expectedMessage?: string | RegExp): Promise<void> {
    await expect(this.errorMessage).toBeVisible({ timeout: 10000 });
    if (expectedMessage) {
      await expect(this.errorMessage).toHaveText(expectedMessage);
    }
  }

  /**
   * Assert user is on Auth0 login page
   */
  async expectOnAuth0Login(): Promise<void> {
    await this.page.waitForURL(/auth0\.com/);
    await expect(this.emailInput).toBeVisible();
  }

  /**
   * Assert user is on app login page
   */
  async expectOnAppLogin(): Promise<void> {
    await this.assertUrl(/\/login/);
  }

  /**
   * Assert user is not logged in (redirected to login)
   */
  async expectNotAuthenticated(): Promise<void> {
    await this.page.waitForURL(/\/login|auth0\.com/, { timeout: 10000 });
  }

  // ============================================
  // Utility Methods
  // ============================================

  /**
   * Clear any existing session and logout
   */
  async logout(): Promise<void> {
    await this.goto('/api/auth/logout');
    await this.page.waitForURL(/\/|\/login/, { timeout: 10000 });
  }

  /**
   * Check if user is currently logged in
   */
  async isLoggedIn(): Promise<boolean> {
    try {
      await this.goto('/dashboard');
      await this.page.waitForURL(/\/dashboard/, { timeout: 5000 });
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Get session cookies for verification
   */
  async getSessionCookies(): Promise<{ name: string; value: string }[]> {
    const cookies = await this.page.context().cookies();
    return cookies.filter(
      (cookie) =>
        cookie.name.includes('auth') ||
        cookie.name.includes('session') ||
        cookie.name.includes('appSession')
    );
  }
}
