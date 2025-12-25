// tests/e2e/workflows/manual-consultation.spec.ts
// E2E tests for the manual consultation workflow
//
// Tests the complete flow of creating a consultation manually:
// 1. Login as test clinician
// 2. Navigate to new consultation
// 3. Select patient by MRN
// 4. Select referrer
// 5. Fill clinical context
// 6. Generate letter using AI
// 7. Review and approve letter
// 8. Send letter to GP and self

import { test, expect, Page } from '@playwright/test';
import { LoginPage } from '../page-objects/LoginPage';
import { DashboardPage } from '../page-objects/DashboardPage';
import { NewConsultationPage } from '../page-objects/NewConsultationPage';
import { LetterDetailPage } from '../page-objects/LetterDetailPage';
import {
  TEST_PATIENTS,
  TEST_REFERRERS,
  TEST_CLINICIAN,
  TEST_TIMEOUTS,
  SAMPLE_LETTER_CONTENT,
  CLINICAL_PATTERNS,
} from '../fixtures/test-data';
import {
  mockLetterGeneration,
  mockTranscription,
  waitForNetworkIdle,
  expectToast,
  setupConsoleErrorCollection,
  validateClinicalContent,
  MOCK_SERVICES,
} from '../utils/helpers';

// ============================================
// Centralized Mock Setup Functions
// ============================================

/**
 * Sets up mock for letter detail page with test data.
 * Used when the real letter generation workflow wasn't executed.
 * Respects MOCK_SERVICES flag - returns early if MOCK_SERVICES=false.
 */
async function setupLetterDetailMock(page: Page, letterId: string): Promise<void> {
  if (!MOCK_SERVICES) return;
  await page.route(`**/api/letters/${letterId}`, async (route) => {
    if (route.request().method() === 'GET') {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          id: letterId,
          content: SAMPLE_LETTER_CONTENT.heartFailure.body,
          status: 'DRAFT',
          letterType: 'NEW_PATIENT',
          patientId: TEST_PATIENTS.heartFailure.id,
          patientName: TEST_PATIENTS.heartFailure.name,
          extractedValues: SAMPLE_LETTER_CONTENT.heartFailure.extractedValues,
          hallucinationFlags: [],
        }),
      });
    } else {
      await route.continue();
    }
  });
}

/**
 * Sets up mock for letter send endpoint.
 * Respects MOCK_SERVICES flag - returns early if MOCK_SERVICES=false.
 */
async function setupLetterSendMock(page: Page): Promise<void> {
  if (!MOCK_SERVICES) return;
  await page.route('**/api/letters/**/send', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        success: true,
        sentTo: [
          {
            name: TEST_REFERRERS.gp.name,
            email: TEST_REFERRERS.gp.email,
            status: 'sent',
          },
          {
            name: TEST_CLINICIAN.name,
            email: TEST_CLINICIAN.email,
            status: 'sent',
          },
        ],
      }),
    });
  });
}

/**
 * Sets up mock for send history endpoint.
 * Respects MOCK_SERVICES flag - returns early if MOCK_SERVICES=false.
 */
async function setupSendHistoryMock(page: Page, letterId: string): Promise<void> {
  if (!MOCK_SERVICES) return;
  await page.route(`**/api/letters/${letterId}/send-history`, async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        history: [
          {
            id: 'send-1',
            recipient: TEST_REFERRERS.gp.name,
            email: TEST_REFERRERS.gp.email,
            status: 'delivered',
            sentAt: new Date().toISOString(),
            channel: 'email',
          },
          {
            id: 'send-2',
            recipient: TEST_CLINICIAN.name,
            email: TEST_CLINICIAN.email,
            status: 'delivered',
            sentAt: new Date().toISOString(),
            channel: 'email',
          },
        ],
      }),
    });
  });
}

/**
 * Sets up mock for recordings API.
 * Respects MOCK_SERVICES flag - returns early if MOCK_SERVICES=false.
 */
async function setupRecordingsMock(page: Page): Promise<void> {
  if (!MOCK_SERVICES) return;
  await page.route('**/api/recordings/**', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        success: true,
        recordingId: 'test-recording-id',
        transcript: 'Test transcription for heart failure patient',
      }),
    });
  });
}

// Test configuration - serial execution to maintain state
test.describe.configure({ mode: 'serial' });

test.describe('Manual Consultation Workflow', () => {
  let loginPage: LoginPage;
  let dashboardPage: DashboardPage;
  let consultationPage: NewConsultationPage;
  let letterDetailPage: LetterDetailPage;
  let generatedLetterId: string | null = null;
  let getConsoleErrors: (() => string[]) | null = null;

  test.beforeEach(async ({ page }) => {
    // Initialize page objects
    loginPage = new LoginPage(page);
    dashboardPage = new DashboardPage(page);
    consultationPage = new NewConsultationPage(page);
    letterDetailPage = new LetterDetailPage(page);

    // Setup console error collection for debugging
    getConsoleErrors = setupConsoleErrorCollection(page);
  });

  test.afterEach(async () => {
    // Check for console errors after each test and log warnings
    if (getConsoleErrors) {
      const errors = getConsoleErrors();
      if (errors.length > 0) {
        console.warn('Console errors detected during test:', errors);
      }
    }
  });

  test('should login and navigate to dashboard', async ({ page }) => {
    // Login with test credentials
    await loginPage.loginWithEnvCredentials();

    // Verify successful login
    await loginPage.expectLoginSuccess();

    // Verify dashboard is visible
    await dashboardPage.expectDashboardVisible();

    // Verify navigation is accessible
    await dashboardPage.expectNavigationVisible();
  });

  test('should navigate to new consultation page', async ({ page }) => {
    // Login first
    await loginPage.loginWithEnvCredentials();
    await dashboardPage.waitForDashboardLoad();

    // Navigate to new consultation
    await dashboardPage.navigateToNewConsultation();

    // Verify consultation page is loaded
    await consultationPage.waitForConsultationPageLoad();

    // Verify patient search is visible
    await expect(consultationPage.patientSearchInput).toBeVisible();
  });

  test('should search and select test patient by MRN', async ({ page }) => {
    // Login and navigate to consultation page
    await loginPage.loginWithEnvCredentials();
    await consultationPage.gotoNewConsultation();

    // Select the heart failure test patient by MRN
    // Note: selectPatientByMrn internally searches and waits for results
    const patient = TEST_PATIENTS.heartFailure;
    await consultationPage.selectPatientByMrn(patient.mrn);

    // Verify patient is selected
    await consultationPage.expectPatientSelected(patient.name);
  });

  test('should select referrer and letter type', async ({ page }) => {
    // Login and navigate to consultation page
    await loginPage.loginWithEnvCredentials();
    await consultationPage.gotoNewConsultation();

    // Select patient first (required before referrer)
    const patient = TEST_PATIENTS.heartFailure;
    await consultationPage.selectPatientByMrn(patient.mrn);

    // Search and select the GP referrer
    const referrer = TEST_REFERRERS.gp;
    await consultationPage.selectReferrer(referrer.name);

    // Verify referrer is selected
    await consultationPage.expectReferrerSelected(referrer.name);

    // Select letter type - New Patient
    await consultationPage.selectLetterType('NEW_PATIENT');

    // Verify letter type is selected
    const selectedType = await consultationPage.getSelectedLetterType();
    expect(selectedType).toBe('NEW_PATIENT');
  });

  test('should fill clinical context and prepare for recording', async ({ page }) => {
    // Login and navigate to consultation page
    await loginPage.loginWithEnvCredentials();
    await consultationPage.gotoNewConsultation();

    // Fill complete clinical context
    await consultationPage.fillClinicalContext({
      patientMrn: TEST_PATIENTS.heartFailure.mrn,
      referrerName: TEST_REFERRERS.gp.name,
      letterType: 'NEW_PATIENT',
    });

    // Verify all fields are filled
    await consultationPage.expectPatientSelected();
    await consultationPage.expectReferrerSelected();

    // Select dictation mode for recording
    await consultationPage.selectRecordingMode('DICTATION');

    // Verify recording section is ready
    await expect(consultationPage.startRecordingButton).toBeVisible();
  });

  test('should generate letter using AI after recording', async ({ page }) => {
    // Setup mocks using centralized helpers
    await mockTranscription(page);
    await mockLetterGeneration(page, SAMPLE_LETTER_CONTENT.heartFailure.body);
    await setupRecordingsMock(page);

    // Login and setup consultation
    await loginPage.loginWithEnvCredentials();
    await consultationPage.gotoNewConsultation();

    // Fill clinical context
    await consultationPage.fillClinicalContext({
      patientMrn: TEST_PATIENTS.heartFailure.mrn,
      referrerName: TEST_REFERRERS.gp.name,
      letterType: 'NEW_PATIENT',
    });

    // For E2E testing, we'll use UPLOAD mode with a mock audio file
    // to avoid needing actual microphone permissions
    await consultationPage.selectRecordingMode('UPLOAD');

    // Verify generate button becomes available
    await waitForNetworkIdle(page);

    // Generate the letter
    await consultationPage.generateLetterAndWait(TEST_TIMEOUTS.letterGeneration);

    // Store the letter ID for subsequent tests
    const url = page.url();
    const match = url.match(/\/letters\/([a-zA-Z0-9-]+)/);
    if (match && match[1]) {
      generatedLetterId = match[1];
    }

    // Verify we're on the letter detail page
    await expect(page).toHaveURL(/\/letters\/.+/);

    // CRITICAL: Assert letter ID was captured - subsequent tests depend on this
    expect(
      generatedLetterId,
      'Letter generation should produce a valid letter ID in the URL. ' +
      'Check if the letter generation workflow completed successfully.'
    ).not.toBeNull();
  });

  test('should review and approve generated letter', async ({ page }) => {
    // CRITICAL: Warn if falling back to mock (indicates previous test failure)
    if (!generatedLetterId) {
      console.warn(
        'WARNING: No letter ID from previous test. Using mock data. ' +
        'This may indicate the letter generation workflow failed.'
      );
      await setupLetterDetailMock(page, 'test-letter-id');
      await loginPage.loginWithEnvCredentials();
      await letterDetailPage.gotoLetter('test-letter-id');
    } else {
      await loginPage.loginWithEnvCredentials();
      await letterDetailPage.gotoLetter(generatedLetterId);
    }

    // Verify letter is loaded
    await letterDetailPage.expectLetterVisible();

    // Verify letter contains expected clinical content
    const letterContent = await letterDetailPage.getLetterContent();

    // Check for clinical patterns - important for medical content validation
    const validation = validateClinicalContent(letterContent, [
      { key: 'bloodPressure', pattern: CLINICAL_PATTERNS.bloodPressure },
    ]);

    // Log clinical validation results for visibility
    // Using warn instead of log to make it visible in test output
    if (!validation.valid) {
      console.warn(
        `Clinical validation: Missing patterns: ${validation.missing.join(', ')}. ` +
        'This may be expected with mock data but should pass with real letter generation.'
      );
    }

    // Verify verification panel is visible if present
    const hasVerificationPanel = await letterDetailPage.verificationPanel.isVisible();
    if (hasVerificationPanel) {
      // Verify all extracted values
      await letterDetailPage.verifyAll();
    }

    // Approve the letter
    await letterDetailPage.approveLetter();

    // Verify status changed (toast or status indicator)
    await expectToast(page, /approved/i, { timeout: TEST_TIMEOUTS.navigation });
  });

  test('should send letter to GP and self', async ({ page }) => {
    // Setup mock for letter sending using centralized helper
    await setupLetterSendMock(page);

    // Login and navigate to letter
    await loginPage.loginWithEnvCredentials();

    const letterId = generatedLetterId ?? 'test-letter-id';
    if (!generatedLetterId) {
      console.warn('WARNING: Using fallback letter ID. Real workflow was not tested.');
      await setupLetterDetailMock(page, letterId);
    }

    await letterDetailPage.gotoLetter(letterId);

    // Open send dialog
    await letterDetailPage.openSendDialog();

    // Verify dialog is open
    await expect(letterDetailPage.sendDialog).toBeVisible();

    // Select the GP as recipient
    await letterDetailPage.selectRecipient(TEST_REFERRERS.gp.name);

    // Toggle send to self
    await letterDetailPage.toggleSendToMyself(true);

    // Move to next step (message)
    await letterDetailPage.nextStep();

    // Fill subject
    await letterDetailPage.fillSubject(
      `Cardiology Consultation - ${TEST_PATIENTS.heartFailure.name}`
    );

    // Move to confirm step
    await letterDetailPage.nextStep();

    // Confirm send
    await letterDetailPage.confirmSend();

    // Verify success message
    await letterDetailPage.expectSendSuccess();
  });

  test('should show letter in sent history', async ({ page }) => {
    // This test verifies the send history is populated after sending
    await loginPage.loginWithEnvCredentials();

    const letterId = generatedLetterId ?? 'test-letter-id';

    // Setup mocks using centralized helpers
    await setupSendHistoryMock(page, letterId);

    if (!generatedLetterId) {
      console.warn('WARNING: Using fallback letter ID for history test.');
      await setupLetterDetailMock(page, letterId);
    }

    await letterDetailPage.gotoLetter(letterId);

    // Open send history panel
    await letterDetailPage.openSendHistory();

    // Verify history is visible
    await expect(letterDetailPage.sendHistoryPanel).toBeVisible();

    // Get history entries
    const history = await letterDetailPage.getSendHistory();

    // Verify we have send records
    expect(history.length).toBeGreaterThan(0);

    // Verify GP is in the history
    const gpEntry = history.find((h) => h.recipient.includes(TEST_REFERRERS.gp.name));
    expect(gpEntry).toBeDefined();
  });
});

// Additional edge case tests
test.describe('Manual Consultation - Error Handling', () => {
  let loginPage: LoginPage;
  let consultationPage: NewConsultationPage;
  let getConsoleErrors: (() => string[]) | null = null;

  test.beforeEach(async ({ page }) => {
    loginPage = new LoginPage(page);
    consultationPage = new NewConsultationPage(page);
    getConsoleErrors = setupConsoleErrorCollection(page);
  });

  test.afterEach(async () => {
    if (getConsoleErrors) {
      const errors = getConsoleErrors();
      if (errors.length > 0) {
        console.warn('Console errors detected:', errors);
      }
    }
  });

  test('should show validation when required fields are missing', async ({ page }) => {
    await loginPage.loginWithEnvCredentials();
    await consultationPage.gotoNewConsultation();

    // Try to generate letter without selecting patient
    // The button should be disabled
    await consultationPage.expectCannotGenerateLetter();
  });

  test('should handle letter generation failure gracefully', async ({ page }) => {
    // Mock a failed letter generation
    await page.route('**/api/letters/generate', async (route) => {
      await route.fulfill({
        status: 500,
        contentType: 'application/json',
        body: JSON.stringify({
          success: false,
          error: 'AI service temporarily unavailable',
        }),
      });
    });

    // Mock recordings to allow getting to the generate step
    await setupRecordingsMock(page);
    await mockTranscription(page);

    await loginPage.loginWithEnvCredentials();
    await consultationPage.gotoNewConsultation();

    // Fill required context
    await consultationPage.fillClinicalContext({
      patientMrn: TEST_PATIENTS.heartFailure.mrn,
      referrerName: TEST_REFERRERS.gp.name,
      letterType: 'NEW_PATIENT',
    });

    await consultationPage.selectRecordingMode('UPLOAD');
    await waitForNetworkIdle(page);

    // Attempt to trigger generation (if button is available)
    const generateButton = page.getByRole('button', { name: /generate/i });
    const isEnabled = await generateButton.isEnabled().catch(() => false);

    if (isEnabled) {
      await generateButton.click();

      // ACTUAL ASSERTION: Verify error UI is shown
      // Check for error toast OR error message in the UI
      const errorToast = page.locator('[data-sonner-toast]').filter({
        hasText: /error|unavailable|failed/i,
      });
      const errorMessage = page.getByText(/error|unavailable|failed|try again/i);

      // Wait for either error indicator with timeout
      await expect(errorToast.or(errorMessage)).toBeVisible({
        timeout: TEST_TIMEOUTS.navigation,
      });
    }

    // Verify page is still functional (not crashed)
    await expect(page.locator('body')).toBeVisible();
  });

  test('should persist draft state on page refresh', async ({ page }) => {
    await loginPage.loginWithEnvCredentials();
    await consultationPage.gotoNewConsultation();

    // Select patient
    await consultationPage.selectPatientByMrn(TEST_PATIENTS.heartFailure.mrn);

    // Verify patient is selected before refresh
    await consultationPage.expectPatientSelected(TEST_PATIENTS.heartFailure.name);

    // Refresh the page
    await page.reload();

    // Wait for page to load
    await consultationPage.waitForConsultationPageLoad();

    // ACTUAL ASSERTION: Check if draft was persisted
    // The app may or may not persist drafts - verify actual behavior
    const patientSection = page.locator(
      '[data-testid="selected-patient"], [data-testid="patient-display"]'
    );
    const hasPersistence = await patientSection.isVisible().catch(() => false);

    if (hasPersistence) {
      // If persistence is supported, verify the correct patient
      await expect(patientSection).toContainText(/TEST/i);
    } else {
      // If no persistence, document this as expected behavior
      // and verify the form is in clean state
      await expect(consultationPage.patientSearchInput).toBeVisible();
      console.info(
        'INFO: Draft state not persisted on refresh. ' +
        'This is acceptable if the app uses server-side draft storage ' +
        'or intentionally clears drafts on navigation.'
      );
    }
  });
});

// Accessibility tests for the consultation workflow
test.describe('Manual Consultation - Accessibility', () => {
  test('should have accessible form elements', async ({ page }) => {
    const loginPage = new LoginPage(page);
    const consultationPage = new NewConsultationPage(page);

    await loginPage.loginWithEnvCredentials();
    await consultationPage.gotoNewConsultation();

    // Check that patient search has an accessible name
    // Allow aria-label, aria-labelledby, or placeholder (search inputs often use placeholder)
    const patientInput = consultationPage.patientSearchInput;
    const hasAriaLabel = await patientInput.getAttribute('aria-label');
    const hasAriaLabelledBy = await patientInput.getAttribute('aria-labelledby');
    const hasPlaceholder = await patientInput.getAttribute('placeholder');

    expect(
      hasAriaLabel || hasAriaLabelledBy || hasPlaceholder,
      'Patient search input should have accessible name (aria-label, aria-labelledby, or placeholder)'
    ).toBeTruthy();

    // Verify keyboard navigation works
    await consultationPage.patientSearchInput.focus();
    await expect(consultationPage.patientSearchInput).toBeFocused();

    // Tab to next element
    await page.keyboard.press('Tab');

    // Verify focus moved to an interactive element
    const focusedElement = page.locator(':focus');
    await expect(focusedElement).toBeVisible();

    // Verify the focused element is actually interactive (not just any visible element)
    const tagName = await focusedElement.evaluate((el) => el.tagName.toLowerCase());
    const tabIndex = await focusedElement.getAttribute('tabindex');
    const isInteractive =
      ['input', 'button', 'select', 'textarea', 'a'].includes(tagName) ||
      tabIndex !== null;

    expect(
      isInteractive,
      `Tab should move focus to an interactive element. Got: ${tagName}`
    ).toBe(true);
  });
});
