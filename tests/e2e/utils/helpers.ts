// tests/e2e/utils/helpers.ts
// Common test helper functions for E2E tests

import { Page, expect, Locator } from '@playwright/test';

/**
 * Toggle for mocking external services.
 * - Set MOCK_SERVICES=false to run tests against real APIs (integration mode)
 * - Default: true (mocked mode for CI)
 *
 * Usage:
 *   MOCK_SERVICES=false npm run test:e2e  # Real API integration
 *   npm run test:e2e                       # Mocked (default)
 */
export const MOCK_SERVICES = process.env.MOCK_SERVICES !== 'false';

/**
 * Wait for network to become idle (no pending requests)
 * Uses Playwright's built-in networkidle state
 */
export async function waitForNetworkIdle(
  page: Page,
  timeout = 5000
): Promise<void> {
  await page.waitForLoadState('networkidle', { timeout });
}

/**
 * Wait for API response to complete
 * Waits for a specific API endpoint to respond
 */
export async function waitForApiResponse(
  page: Page,
  urlPattern: string | RegExp,
  timeout = 10000
): Promise<void> {
  await page.waitForResponse(
    (response) => {
      const url = response.url();
      if (typeof urlPattern === 'string') {
        return url.includes(urlPattern);
      }
      return urlPattern.test(url);
    },
    { timeout }
  );
}

/**
 * Assert toast notification with specific message
 * Works with Sonner toast library patterns
 */
export async function expectToast(
  page: Page,
  message: string | RegExp,
  options?: {
    type?: 'success' | 'error' | 'warning' | 'info';
    timeout?: number;
  }
): Promise<void> {
  const { type, timeout = 10000 } = options ?? {};

  // Sonner toast uses [data-sonner-toast] or role="status" with aria-live
  const toastContainer = page.locator(
    '[data-sonner-toast], [role="status"][aria-live]'
  );
  const toast = toastContainer.filter({ hasText: message });

  await expect(toast).toBeVisible({ timeout });

  if (type) {
    // Toast types are indicated by data attributes or class names
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
export async function waitForToastDismiss(
  page: Page,
  timeout = 10000
): Promise<void> {
  const toastContainer = page.locator(
    '[data-sonner-toast], [role="status"][aria-live]'
  );
  await toastContainer.waitFor({ state: 'hidden', timeout });
}

/**
 * Assert no console errors occurred on the page
 *
 * @deprecated Prefer using `setupConsoleErrorCollection()` at test setup and checking
 * errors at teardown for more reliable error detection. This function uses a short
 * fixed wait which may miss errors that appear after the 100ms window.
 *
 * @example
 * ```typescript
 * // Preferred approach:
 * test.beforeEach(({ page }) => {
 *   const getErrors = setupConsoleErrorCollection(page);
 *   // ... run test ...
 *   expect(getErrors()).toHaveLength(0);
 * });
 * ```
 */
export async function assertNoConsoleErrors(page: Page): Promise<void> {
  const errors: string[] = [];

  page.on('console', (msg) => {
    if (msg.type() === 'error') {
      // Filter out known acceptable errors
      const text = msg.text();
      if (
        !text.includes('ResizeObserver loop') && // Browser quirk
        !text.includes('net::ERR_FAILED') // Network errors during navigation
      ) {
        errors.push(text);
      }
    }
  });

  // Note: This fixed wait may miss errors that appear later.
  // Consider using setupConsoleErrorCollection() for more reliable detection.
  await page.waitForTimeout(100);

  if (errors.length > 0) {
    throw new Error(`Console errors found:\n${errors.join('\n')}`);
  }
}

/**
 * Setup console error collection for a page
 * Returns a function to check collected errors
 */
export function setupConsoleErrorCollection(page: Page): () => string[] {
  const errors: string[] = [];

  page.on('console', (msg) => {
    if (msg.type() === 'error') {
      const text = msg.text();
      if (
        !text.includes('ResizeObserver loop') &&
        !text.includes('net::ERR_FAILED')
      ) {
        errors.push(text);
      }
    }
  });

  return () => [...errors];
}

/**
 * Mock an API response
 * Intercepts requests matching the pattern and returns mock response
 *
 * Note: Respects MOCK_SERVICES flag - returns early if MOCK_SERVICES=false
 */
export async function mockApiResponse(
  page: Page,
  urlPattern: string | RegExp,
  response: {
    status?: number;
    body?: unknown;
    contentType?: string;
    delay?: number;
  }
): Promise<void> {
  if (!MOCK_SERVICES) {
    return; // Skip mocking - use real API
  }

  await page.route(urlPattern, async (route) => {
    if (response.delay) {
      await new Promise((resolve) => setTimeout(resolve, response.delay));
    }

    await route.fulfill({
      status: response.status ?? 200,
      contentType: response.contentType ?? 'application/json',
      body: JSON.stringify(response.body),
    });
  });
}

/**
 * Mock AI letter generation response
 * Provides consistent mock response for letter generation tests
 *
 * Note: Respects MOCK_SERVICES flag - returns early if MOCK_SERVICES=false
 */
export async function mockLetterGeneration(
  page: Page,
  letterContent?: string
): Promise<void> {
  if (!MOCK_SERVICES) {
    return; // Skip mocking - use real API
  }

  const defaultContent = `Dear Dr. TEST GP Smith,

Thank you for referring TEST Patient - Heart Failure for cardiology review.

**History of Presenting Complaint:**
The patient presents with a 6-month history of progressive exertional dyspnoea.

**Examination:**
Blood pressure 130/80 mmHg, heart rate 72 bpm regular.
Cardiovascular: Normal heart sounds, no murmurs.
Respiratory: Clear lung fields bilaterally.

**Investigations:**
ECG: Sinus rhythm, no acute changes.
Echocardiography: LVEF 35%, moderate LV systolic dysfunction.

**Impression:**
Heart failure with reduced ejection fraction (HFrEF), NYHA Class II.

**Plan:**
1. Commenced on Entresto 24/26mg BD
2. Continue Bisoprolol 5mg daily
3. Lifestyle modifications discussed
4. Follow-up in 6 weeks with repeat echocardiogram

Kind regards,

Dr. TEST E2E Cardiologist
Cardiologist`;

  await mockApiResponse(page, /\/api\/letters\/generate/, {
    status: 200,
    body: {
      success: true,
      letter: {
        id: 'test-letter-id',
        content: letterContent ?? defaultContent,
        status: 'DRAFT',
        letterType: 'NEW_PATIENT',
        extractedValues: [
          { key: 'lvef', value: '35%', source: 'Echocardiography', verified: false },
          { key: 'bp', value: '130/80 mmHg', source: 'Examination', verified: false },
        ],
        hallucinationFlags: [],
      },
    },
    delay: 500, // Simulate generation delay
  });
}

/**
 * Mock transcription service response
 *
 * Note: Respects MOCK_SERVICES flag - returns early if MOCK_SERVICES=false
 */
export async function mockTranscription(
  page: Page,
  transcriptText?: string
): Promise<void> {
  if (!MOCK_SERVICES) {
    return; // Skip mocking - use real API
  }

  const defaultTranscript =
    'This is a test transcription for the E2E test patient with heart failure. ' +
    'Blood pressure is 130 over 80. Ejection fraction is 35 percent.';

  await mockApiResponse(page, /\/api\/recordings\/.*\/transcribe/, {
    status: 200,
    body: {
      success: true,
      transcript: transcriptText ?? defaultTranscript,
      confidence: 0.95,
      duration: 120,
    },
  });
}

/**
 * Mock referral PDF extraction response
 *
 * Note: Respects MOCK_SERVICES flag - returns early if MOCK_SERVICES=false
 */
export async function mockReferralExtraction(
  page: Page,
  extractedData?: Record<string, unknown>
): Promise<void> {
  if (!MOCK_SERVICES) {
    return; // Skip mocking - use real API
  }

  const defaultData = {
    patient: {
      name: 'TEST Patient - Referral',
      dateOfBirth: '1960-03-20',
      mrn: 'TEST-REF-003',
      medicareNumber: 'TEST-3456789012',
    },
    referrer: {
      name: 'Dr. TEST Referring GP',
      practice: 'TEST Referral Practice',
      email: 'test.referring.gp@test.dictatemed.dev',
      phone: '+61 2 9000 0010',
      fax: '+61 2 9000 0011',
      address: 'TEST Address - 300 Elizabeth Street, Sydney NSW 2000',
    },
    clinicalContext:
      'Patient referred for cardiology review due to chest pain and shortness of breath on exertion.',
    reasonForReferral: 'Chest pain, SOB on exertion',
    urgency: 'routine',
  };

  await mockApiResponse(page, /\/api\/referrals\/.*\/extract/, {
    status: 200,
    body: {
      success: true,
      extractedData: extractedData ?? defaultData,
      confidence: 0.92,
    },
    delay: 1000, // Simulate extraction delay
  });
}

/**
 * Clear all API mocks/routes
 */
export async function clearApiMocks(page: Page): Promise<void> {
  await page.unroute('**/*');
}

/**
 * Take a debug screenshot with descriptive name
 */
export async function debugScreenshot(
  page: Page,
  name: string
): Promise<void> {
  await page.screenshot({
    path: `./test-results/screenshots/${name}.png`,
    fullPage: true,
  });
}

/**
 * Retry an action with exponential backoff
 * Useful for flaky operations that may need multiple attempts
 */
export async function retryWithBackoff<T>(
  action: () => Promise<T>,
  options?: {
    maxRetries?: number;
    initialDelay?: number;
    maxDelay?: number;
  }
): Promise<T> {
  const { maxRetries = 3, initialDelay = 100, maxDelay = 2000 } = options ?? {};
  let lastError: Error | undefined;
  let delay = initialDelay;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      return await action();
    } catch (error) {
      lastError = error as Error;
      if (attempt < maxRetries) {
        await new Promise((resolve) => setTimeout(resolve, delay));
        delay = Math.min(delay * 2, maxDelay);
      }
    }
  }

  throw lastError;
}

/**
 * Wait for element to be stable (not moving/resizing)
 * Useful for animations or layout shifts
 *
 * Note: This function uses a short fixed wait (100ms) between bounding box checks
 * to detect stability. This is intentional - we need to sample the element's position
 * at two points in time to determine if it has stopped moving. This is different from
 * arbitrary waits that delay for no specific reason.
 */
export async function waitForStable(
  locator: Locator,
  timeout = 5000
): Promise<void> {
  const startTime = Date.now();
  const STABILITY_CHECK_INTERVAL = 100; // Intentional: need time between samples to detect motion

  while (Date.now() - startTime < timeout) {
    const box1 = await locator.boundingBox();
    await locator.page().waitForTimeout(STABILITY_CHECK_INTERVAL);
    const box2 = await locator.boundingBox();

    if (
      box1 &&
      box2 &&
      box1.x === box2.x &&
      box1.y === box2.y &&
      box1.width === box2.width &&
      box1.height === box2.height
    ) {
      return;
    }
  }

  throw new Error(`Element did not stabilize within ${timeout}ms`);
}

/**
 * Generate a unique test identifier
 * Useful for creating unique test data
 */
export function generateTestId(prefix = 'TEST'): string {
  const timestamp = Date.now().toString(36);
  const random = Math.random().toString(36).substring(2, 8);
  return `${prefix}-${timestamp}-${random}`.toUpperCase();
}

/**
 * Format date as YYYY-MM-DD for input fields
 */
export function formatDateForInput(date: Date): string {
  const parts = date.toISOString().split('T');
  return parts[0] ?? '';
}

/**
 * Parse Australian phone number formats
 */
export function formatAustralianPhone(phone: string): string {
  // Remove all non-digits
  const digits = phone.replace(/\D/g, '');

  // Handle different formats
  if (digits.startsWith('61')) {
    return `+${digits}`;
  }
  if (digits.startsWith('0')) {
    return `+61${digits.substring(1)}`;
  }
  return `+61${digits}`;
}

/**
 * Validate that text contains expected clinical values
 * Useful for verifying letter content
 */
export function validateClinicalContent(
  content: string,
  expectedValues: Array<{ key: string; pattern: RegExp }>
): { valid: boolean; missing: string[] } {
  const missing: string[] = [];

  for (const { key, pattern } of expectedValues) {
    if (!pattern.test(content)) {
      missing.push(key);
    }
  }

  return {
    valid: missing.length === 0,
    missing,
  };
}

/**
 * Wait for a specific URL pattern
 */
export async function waitForUrl(
  page: Page,
  urlPattern: string | RegExp,
  timeout = 10000
): Promise<void> {
  await page.waitForURL(urlPattern, { timeout });
}

/**
 * Get current user session info (if available)
 *
 * Note: This function attempts to retrieve session data from browser storage.
 * Auth0 typically stores session data in cookies rather than sessionStorage.
 * This function checks multiple possible storage locations:
 * 1. sessionStorage 'auth_session' key (custom app storage)
 * 2. localStorage 'auth0.user' key (Auth0 SPA SDK pattern)
 *
 * If your app uses a different storage mechanism, modify this function accordingly.
 */
export async function getCurrentSession(
  page: Page
): Promise<{ userId?: string; email?: string } | null> {
  try {
    const sessionData = await page.evaluate(() => {
      // Check sessionStorage first (custom app storage)
      const sessionAuth = sessionStorage.getItem('auth_session');
      if (sessionAuth) {
        try {
          return JSON.parse(sessionAuth);
        } catch {
          // Invalid JSON, continue checking
        }
      }

      // Check localStorage for Auth0 SPA SDK pattern
      const auth0User = localStorage.getItem('auth0.user');
      if (auth0User) {
        try {
          return JSON.parse(auth0User);
        } catch {
          // Invalid JSON, continue checking
        }
      }

      // Check for any key containing 'auth' or 'user' in localStorage
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key && (key.includes('auth') || key.includes('user'))) {
          const value = localStorage.getItem(key);
          if (value) {
            try {
              const parsed = JSON.parse(value);
              if (parsed.email || parsed.userId || parsed.sub) {
                return {
                  userId: parsed.userId || parsed.sub,
                  email: parsed.email,
                };
              }
            } catch {
              // Not JSON, skip
            }
          }
        }
      }

      return null;
    });
    return sessionData;
  } catch {
    return null;
  }
}

/**
 * Clear browser storage (localStorage, sessionStorage, cookies)
 */
export async function clearBrowserStorage(page: Page): Promise<void> {
  await page.evaluate(() => {
    localStorage.clear();
    sessionStorage.clear();
  });
  await page.context().clearCookies();
}
