// tests/e2e/page-objects/BasePage.ts
// Base page object with common utilities for all page objects

import { Page, Locator, expect } from '@playwright/test';

export class BasePage {
  readonly page: Page;

  constructor(page: Page) {
    this.page = page;
  }

  // ============================================
  // Navigation Utilities
  // ============================================

  /**
   * Navigate to a path relative to base URL
   */
  async goto(path: string): Promise<void> {
    await this.page.goto(path);
  }

  /**
   * Wait for navigation to complete
   */
  async waitForNavigation(urlPattern?: string | RegExp): Promise<void> {
    if (urlPattern) {
      await this.page.waitForURL(urlPattern);
    } else {
      await this.page.waitForLoadState('networkidle');
    }
  }

  /**
   * Get current URL path
   */
  getCurrentPath(): string {
    return new URL(this.page.url()).pathname;
  }

  // ============================================
  // Wait Utilities
  // ============================================

  /**
   * Wait for network to be idle (no pending requests)
   */
  async waitForNetworkIdle(timeout = 5000): Promise<void> {
    await this.page.waitForLoadState('networkidle', { timeout });
  }

  /**
   * Wait for an element to be visible
   */
  async waitForVisible(
    selector: string | Locator,
    timeout = 10000
  ): Promise<Locator> {
    const locator =
      typeof selector === 'string' ? this.page.locator(selector) : selector;
    await locator.waitFor({ state: 'visible', timeout });
    return locator;
  }

  /**
   * Wait for an element to be hidden
   */
  async waitForHidden(selector: string | Locator, timeout = 10000): Promise<void> {
    const locator =
      typeof selector === 'string' ? this.page.locator(selector) : selector;
    await locator.waitFor({ state: 'hidden', timeout });
  }

  /**
   * Wait for element with text to appear
   */
  async waitForText(text: string, timeout = 10000): Promise<Locator> {
    const locator = this.page.getByText(text);
    await locator.waitFor({ state: 'visible', timeout });
    return locator;
  }

  // ============================================
  // Toast Notification Utilities
  // ============================================

  /**
   * Get toast notification container (using Sonner toast library patterns)
   */
  private getToastContainer(): Locator {
    // Sonner toast uses [data-sonner-toast] or role="status" with aria-live
    return this.page.locator('[data-sonner-toast], [role="status"][aria-live]');
  }

  /**
   * Expect a toast notification with specific message
   */
  async expectToast(
    message: string | RegExp,
    type?: 'success' | 'error' | 'warning' | 'info'
  ): Promise<void> {
    const toast = this.getToastContainer().filter({ hasText: message });
    await expect(toast).toBeVisible({ timeout: 10000 });

    if (type) {
      // Toast types are often indicated by data attributes or class names
      const typeSelectors: Record<'success' | 'error' | 'warning' | 'info', string> = {
        success: '[data-type="success"], .toast-success',
        error: '[data-type="error"], .toast-error',
        warning: '[data-type="warning"], .toast-warning',
        info: '[data-type="info"], .toast-info',
      };
      const selector = typeSelectors[type];
      await expect(toast.locator(selector).or(toast)).toBeVisible();
    }
  }

  /**
   * Wait for toast to disappear
   */
  async waitForToastDismiss(timeout = 10000): Promise<void> {
    await this.getToastContainer().waitFor({ state: 'hidden', timeout });
  }

  // ============================================
  // Form Utilities
  // ============================================

  /**
   * Fill input by label
   */
  async fillByLabel(label: string | RegExp, value: string): Promise<void> {
    await this.page.getByLabel(label).fill(value);
  }

  /**
   * Click button by text
   */
  async clickButton(text: string | RegExp): Promise<void> {
    await this.page.getByRole('button', { name: text }).click();
  }

  /**
   * Click link by text
   */
  async clickLink(text: string | RegExp): Promise<void> {
    await this.page.getByRole('link', { name: text }).click();
  }

  /**
   * Select option from dropdown by label
   */
  async selectByLabel(label: string | RegExp, value: string): Promise<void> {
    await this.page.getByLabel(label).selectOption(value);
  }

  /**
   * Check or uncheck a checkbox by label
   */
  async setCheckbox(label: string | RegExp, checked: boolean): Promise<void> {
    const checkbox = this.page.getByLabel(label);
    if (checked) {
      await checkbox.check();
    } else {
      await checkbox.uncheck();
    }
  }

  // ============================================
  // Dialog Utilities
  // ============================================

  /**
   * Get dialog/modal element
   */
  getDialog(): Locator {
    return this.page.getByRole('dialog');
  }

  /**
   * Wait for dialog to open
   */
  async waitForDialogOpen(): Promise<Locator> {
    const dialog = this.getDialog();
    await dialog.waitFor({ state: 'visible' });
    return dialog;
  }

  /**
   * Wait for dialog to close
   */
  async waitForDialogClose(): Promise<void> {
    await this.getDialog().waitFor({ state: 'hidden' });
  }

  /**
   * Close dialog by clicking close button or escape
   */
  async closeDialog(): Promise<void> {
    const closeButton = this.getDialog().getByRole('button', { name: /close/i });
    if (await closeButton.isVisible()) {
      await closeButton.click();
    } else {
      await this.page.keyboard.press('Escape');
    }
    await this.waitForDialogClose();
  }

  // ============================================
  // Data Test ID Utilities
  // ============================================

  /**
   * Get element by data-testid attribute
   */
  getByTestId(testId: string): Locator {
    return this.page.getByTestId(testId);
  }

  /**
   * Click element by data-testid
   */
  async clickByTestId(testId: string): Promise<void> {
    await this.getByTestId(testId).click();
  }

  // ============================================
  // Assertion Utilities
  // ============================================

  /**
   * Assert current URL matches pattern
   */
  async assertUrl(pattern: string | RegExp): Promise<void> {
    await expect(this.page).toHaveURL(pattern);
  }

  /**
   * Assert page title
   */
  async assertTitle(title: string | RegExp): Promise<void> {
    await expect(this.page).toHaveTitle(title);
  }

  /**
   * Assert text is visible on page
   */
  async assertTextVisible(text: string | RegExp): Promise<void> {
    await expect(this.page.getByText(text)).toBeVisible();
  }

  /**
   * Assert text is not visible on page
   */
  async assertTextNotVisible(text: string | RegExp): Promise<void> {
    await expect(this.page.getByText(text)).not.toBeVisible();
  }

  /**
   * Console error collector - must be set up early in test
   * Call setupConsoleErrorCollection() at test start, then assertNoConsoleErrors() at end
   */
  private consoleErrors: string[] = [];
  private consoleListenerAttached = false;

  /**
   * Set up console error collection - call this at the beginning of a test
   * to capture any console errors that occur during the test
   */
  setupConsoleErrorCollection(): void {
    if (this.consoleListenerAttached) return;

    this.consoleErrors = [];
    this.page.on('console', (msg) => {
      if (msg.type() === 'error') {
        this.consoleErrors.push(msg.text());
      }
    });
    this.consoleListenerAttached = true;
  }

  /**
   * Assert no console errors occurred during the test
   * Must call setupConsoleErrorCollection() first
   */
  assertNoConsoleErrors(): void {
    if (!this.consoleListenerAttached) {
      throw new Error(
        'Console error collection not set up. Call setupConsoleErrorCollection() at test start.'
      );
    }

    if (this.consoleErrors.length > 0) {
      const errorList = this.consoleErrors.join('\n');
      this.consoleErrors = []; // Reset for next check
      throw new Error(`Console errors found:\n${errorList}`);
    }
  }

  /**
   * Get collected console errors without asserting
   */
  getConsoleErrors(): string[] {
    return [...this.consoleErrors];
  }

  /**
   * Clear collected console errors
   */
  clearConsoleErrors(): void {
    this.consoleErrors = [];
  }

  // ============================================
  // API Mocking Utilities
  // ============================================

  /**
   * Mock an API response
   */
  async mockApiResponse(
    urlPattern: string | RegExp,
    response: {
      status?: number;
      body?: unknown;
      contentType?: string;
    }
  ): Promise<void> {
    await this.page.route(urlPattern, (route) => {
      route.fulfill({
        status: response.status ?? 200,
        contentType: response.contentType ?? 'application/json',
        body: JSON.stringify(response.body),
      });
    });
  }

  /**
   * Clear all API mocks
   */
  async clearApiMocks(): Promise<void> {
    await this.page.unroute('**/*');
  }

  // ============================================
  // Screenshot & Debug Utilities
  // ============================================

  /**
   * Take a screenshot with a descriptive name
   */
  async screenshot(name: string): Promise<void> {
    await this.page.screenshot({
      path: `./test-results/screenshots/${name}.png`,
      fullPage: true,
    });
  }

  /**
   * Pause test execution for debugging
   */
  async pause(): Promise<void> {
    await this.page.pause();
  }
}
