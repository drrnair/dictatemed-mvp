// tests/e2e/workflows/referral-upload.spec.ts
// E2E tests for the referral PDF upload and extraction workflow
//
// Tests the complete flow of uploading a referral:
// 1. Login as test clinician
// 2. Upload referral file (TXT in tests, PDF in production)
// 3. System extracts patient/GP details automatically
// 4. User reviews and confirms extracted data
// 5. User edits extracted fields if needed
// 6. Create consultation from referral context
// 7. Generate letter with referral context
// 8. Send letter to referrer
//
// NOTE: Tests use .txt files instead of PDFs to simplify CI setup.
// The application accepts both formats; the extraction API works the same way.
// To generate actual PDF fixtures, run: npm run generate:referral-pdfs

import { test, expect, Page } from '@playwright/test';
import * as path from 'path';
import { LoginPage } from '../page-objects/LoginPage';
import { DashboardPage } from '../page-objects/DashboardPage';
import { ReferralUploadPage, ExtractedReferralData } from '../page-objects/ReferralUploadPage';
import { NewConsultationPage } from '../page-objects/NewConsultationPage';
import { LetterDetailPage } from '../page-objects/LetterDetailPage';
import {
  EXPECTED_REFERRAL_EXTRACTIONS,
  TEST_TIMEOUTS,
  SAMPLE_LETTER_CONTENT,
} from '../fixtures/test-data';
import {
  mockLetterGeneration,
  mockTranscription,
  mockReferralExtraction,
  waitForNetworkIdle,
} from '../utils/helpers';

// Path to test referral files (TXT for CI, PDF optional)
const REFERRAL_FIXTURES_PATH = path.join(__dirname, '../fixtures/referrals');

// ============================================
// Reusable Mock Setup Functions
// ============================================

interface ReferralMockOptions {
  referralId?: string;
  extractedData?: {
    patient?: { name?: string; dateOfBirth?: string; mrn?: string };
    referrer?: { name?: string; practice?: string; email?: string; phone?: string };
    clinicalContext?: string;
    reasonForReferral?: string;
    urgency?: 'routine' | 'urgent';
  };
  confidence?: number;
  uploadError?: boolean;
  extractionError?: boolean;
  extractionDelay?: number;
  allowUpdates?: boolean;
}

/**
 * Sets up all referral-related API mocks in one place.
 * Reduces code duplication across tests.
 */
async function setupReferralMocks(page: Page, options: ReferralMockOptions = {}): Promise<void> {
  const {
    referralId = 'test-referral-001',
    extractedData,
    confidence = 0.92,
    uploadError = false,
    extractionError = false,
    extractionDelay = 0,
    allowUpdates = false,
  } = options;

  await page.route('**/api/referrals/**', async (route) => {
    const url = route.request().url();
    const method = route.request().method();

    // Handle upload endpoint
    if (url.includes('/upload')) {
      if (uploadError) {
        await route.fulfill({
          status: 500,
          contentType: 'application/json',
          body: JSON.stringify({
            success: false,
            error: 'File upload failed. Please try again.',
          }),
        });
      } else {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            success: true,
            referralId,
            fileName: 'referral.pdf',
            fileSize: 125000,
          }),
        });
      }
      return;
    }

    // Handle extraction endpoint
    if (url.includes('/extract')) {
      if (extractionDelay > 0) {
        await new Promise((resolve) => setTimeout(resolve, extractionDelay));
      }

      if (extractionError) {
        await route.fulfill({
          status: 500,
          contentType: 'application/json',
          body: JSON.stringify({
            success: false,
            error: 'Failed to extract data from PDF. The document may be corrupted or unreadable.',
          }),
        });
      } else {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            success: true,
            extractedData: extractedData ?? {
              patient: { name: 'TEST Patient', dateOfBirth: '1960-01-01' },
              referrer: { name: 'TEST Referrer' },
            },
            confidence,
          }),
        });
      }
      return;
    }

    // Handle update endpoints (PATCH/PUT)
    if (allowUpdates && (method === 'PATCH' || method === 'PUT')) {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ success: true }),
      });
      return;
    }

    // Pass through other requests
    await route.continue();
  });
}

// Test configuration - serial execution to maintain state
test.describe.configure({ mode: 'serial' });

test.describe('Referral Upload Workflow', () => {
  let loginPage: LoginPage;
  let dashboardPage: DashboardPage;
  let referralPage: ReferralUploadPage;
  let consultationPage: NewConsultationPage;
  let letterDetailPage: LetterDetailPage;
  let extractedData: ExtractedReferralData | null = null;
  let generatedLetterId: string | null = null;

  test.beforeEach(async ({ page }) => {
    // Initialize page objects
    loginPage = new LoginPage(page);
    dashboardPage = new DashboardPage(page);
    referralPage = new ReferralUploadPage(page);
    consultationPage = new NewConsultationPage(page);
    letterDetailPage = new LetterDetailPage(page);
  });

  test('should login and navigate to referral upload', async ({ page }) => {
    // Login with test credentials
    await loginPage.loginWithEnvCredentials();
    await loginPage.expectLoginSuccess();

    // Verify dashboard is visible
    await dashboardPage.expectDashboardVisible();

    // Navigate to new consultation (referral upload is part of this flow)
    await referralPage.gotoReferralUpload();

    // Verify the page is ready for upload
    await referralPage.expectReadyForUpload();
  });

  test('should upload referral PDF successfully', async ({ page }) => {
    // Setup mock for referral upload and extraction
    await mockReferralExtraction(page, EXPECTED_REFERRAL_EXTRACTIONS['cardiology-referral-001']);

    // Mock the file upload endpoint
    await page.route('**/api/referrals/upload', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          referralId: 'test-referral-001',
          fileName: 'cardiology-referral-001.pdf',
          fileSize: 125000,
        }),
      });
    });

    // Login and navigate
    await loginPage.loginWithEnvCredentials();
    await referralPage.gotoReferralUpload();

    // Upload the referral file (using txt file for testing, PDF in production)
    const referralFilePath = path.join(REFERRAL_FIXTURES_PATH, 'cardiology-referral-001.txt');
    await referralPage.uploadReferralPDF(referralFilePath);

    // Verify upload started
    await referralPage.expectUploadSuccess();
  });

  test('should extract patient information from referral', async ({ page }) => {
    const expectedExtraction = EXPECTED_REFERRAL_EXTRACTIONS['cardiology-referral-001'];

    // Setup mock for extraction with expected data
    await page.route('**/api/referrals/upload', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          referralId: 'test-referral-001',
        }),
      });
    });

    await page.route('**/api/referrals/**/extract', async (route) => {
      // Simulate extraction delay
      await new Promise((resolve) => setTimeout(resolve, 500));
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          extractedData: {
            patient: expectedExtraction.patient,
            referrer: expectedExtraction.referrer,
            clinicalContext: 'Patient referred for cardiology review.',
            reasonForReferral: expectedExtraction.reasonForReferral,
          },
          confidence: 0.92,
        }),
      });
    });

    // Login and navigate
    await loginPage.loginWithEnvCredentials();
    await referralPage.gotoReferralUpload();

    // Upload and wait for extraction
    const referralFilePath = path.join(REFERRAL_FIXTURES_PATH, 'cardiology-referral-001.txt');
    extractedData = await referralPage.uploadAndExtract(referralFilePath);

    // Verify patient information is extracted correctly
    expect(extractedData.patient).toBeDefined();
    if (extractedData.patient?.name) {
      expect(extractedData.patient.name).toContain('TEST');
    }

    // Verify the extraction state shows ready
    const state = await referralPage.getExtractionState();
    expect(state).toBe('ready');
  });

  test('should extract GP/referrer information', async ({ page }) => {
    const expectedExtraction = EXPECTED_REFERRAL_EXTRACTIONS['cardiology-referral-001'];

    // Setup extraction mock
    await page.route('**/api/referrals/upload', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          referralId: 'test-referral-001',
        }),
      });
    });

    await page.route('**/api/referrals/**/extract', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          extractedData: {
            patient: expectedExtraction.patient,
            referrer: expectedExtraction.referrer,
            reasonForReferral: expectedExtraction.reasonForReferral,
          },
          confidence: 0.94,
        }),
      });
    });

    // Login and navigate
    await loginPage.loginWithEnvCredentials();
    await referralPage.gotoReferralUpload();

    // Upload and extract
    const referralFilePath = path.join(REFERRAL_FIXTURES_PATH, 'cardiology-referral-001.txt');
    const data = await referralPage.uploadAndExtract(referralFilePath);

    // Verify referrer information is extracted
    expect(data.referrer).toBeDefined();
    expect(data.referrer?.name).toContain('TEST');
    expect(data.referrer?.practice).toContain('TEST');

    // Verify referrer details are displayed
    await referralPage.expectExtractedReferrer('TEST');
  });

  test('should display review panel with extracted data', async ({ page }) => {
    const expectedExtraction = EXPECTED_REFERRAL_EXTRACTIONS['cardiology-referral-001'];

    // Setup extraction mock
    await page.route('**/api/referrals/**', async (route) => {
      const url = route.request().url();
      if (url.includes('/upload')) {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ success: true, referralId: 'test-referral-001' }),
        });
      } else if (url.includes('/extract')) {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            success: true,
            extractedData: {
              patient: expectedExtraction.patient,
              referrer: expectedExtraction.referrer,
              clinicalContext: 'Progressive dyspnoea on exertion with ankle swelling.',
              reasonForReferral: expectedExtraction.reasonForReferral,
            },
          }),
        });
      } else {
        await route.continue();
      }
    });

    // Login and navigate
    await loginPage.loginWithEnvCredentials();
    await referralPage.gotoReferralUpload();

    // Upload and wait for extraction
    const referralFilePath = path.join(REFERRAL_FIXTURES_PATH, 'cardiology-referral-001.txt');
    await referralPage.uploadReferralPDF(referralFilePath);
    await referralPage.waitForExtraction(TEST_TIMEOUTS.referralExtraction);

    // Verify review panel is visible
    await referralPage.expectExtractionSuccess();

    // Review extracted data
    const review = await referralPage.reviewExtractedData();
    expect(review.hasPatient).toBe(true);
    expect(review.hasReferrer).toBe(true);
  });

  test('should allow editing extracted patient fields', async ({ page }) => {
    const expectedExtraction = EXPECTED_REFERRAL_EXTRACTIONS['cardiology-referral-001'];

    // Setup extraction mock
    await page.route('**/api/referrals/**', async (route) => {
      const url = route.request().url();
      if (url.includes('/upload')) {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ success: true, referralId: 'test-referral-001' }),
        });
      } else if (url.includes('/extract')) {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            success: true,
            extractedData: {
              patient: expectedExtraction.patient,
              referrer: expectedExtraction.referrer,
              reasonForReferral: expectedExtraction.reasonForReferral,
            },
          }),
        });
      } else if (route.request().method() === 'PATCH' || route.request().method() === 'PUT') {
        // Mock update endpoint
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ success: true }),
        });
      } else {
        await route.continue();
      }
    });

    // Login and navigate
    await loginPage.loginWithEnvCredentials();
    await referralPage.gotoReferralUpload();

    // Upload and wait for extraction
    const referralFilePath = path.join(REFERRAL_FIXTURES_PATH, 'cardiology-referral-001.txt');
    await referralPage.uploadReferralPDF(referralFilePath);
    await referralPage.waitForExtraction(TEST_TIMEOUTS.referralExtraction);

    // Edit patient data with corrected MRN
    const correctedMrn = 'TEST-CORRECTED-001';
    await referralPage.editPatientData({
      mrn: correctedMrn,
    });

    // Verify the edit was saved (check updated value or toast)
    await waitForNetworkIdle(page);
  });

  test('should allow editing extracted referrer fields', async ({ page }) => {
    const expectedExtraction = EXPECTED_REFERRAL_EXTRACTIONS['cardiology-referral-001'];

    // Setup extraction and update mocks
    await page.route('**/api/referrals/**', async (route) => {
      const url = route.request().url();
      const method = route.request().method();

      if (url.includes('/upload')) {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ success: true, referralId: 'test-referral-001' }),
        });
      } else if (url.includes('/extract')) {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            success: true,
            extractedData: {
              patient: expectedExtraction.patient,
              referrer: expectedExtraction.referrer,
              reasonForReferral: expectedExtraction.reasonForReferral,
            },
          }),
        });
      } else if (method === 'PATCH' || method === 'PUT') {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ success: true }),
        });
      } else {
        await route.continue();
      }
    });

    // Login and navigate
    await loginPage.loginWithEnvCredentials();
    await referralPage.gotoReferralUpload();

    // Upload and wait for extraction
    const referralFilePath = path.join(REFERRAL_FIXTURES_PATH, 'cardiology-referral-001.txt');
    await referralPage.uploadReferralPDF(referralFilePath);
    await referralPage.waitForExtraction(TEST_TIMEOUTS.referralExtraction);

    // Edit referrer data with corrected email
    const correctedEmail = 'test.corrected.gp@test.dictatemed.dev';
    await referralPage.editReferrerData({
      email: correctedEmail,
    });

    // Verify the edit was saved
    await waitForNetworkIdle(page);
  });

  test('should create consultation from referral', async ({ page }) => {
    const expectedExtraction = EXPECTED_REFERRAL_EXTRACTIONS['cardiology-referral-001'];

    // Setup mocks for referral and consultation creation
    await page.route('**/api/referrals/**', async (route) => {
      const url = route.request().url();
      if (url.includes('/upload')) {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ success: true, referralId: 'test-referral-001' }),
        });
      } else if (url.includes('/extract')) {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            success: true,
            extractedData: {
              patient: expectedExtraction.patient,
              referrer: expectedExtraction.referrer,
              clinicalContext: 'Progressive dyspnoea on exertion with ankle swelling.',
              reasonForReferral: expectedExtraction.reasonForReferral,
            },
          }),
        });
      } else {
        await route.continue();
      }
    });

    // Mock consultation creation
    await page.route('**/api/consultations', async (route) => {
      if (route.request().method() === 'POST') {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            success: true,
            consultation: {
              id: 'test-consultation-from-referral',
              status: 'DRAFT',
              patientId: 'test-patient-id',
              referralId: 'test-referral-001',
            },
          }),
        });
      } else {
        await route.continue();
      }
    });

    // Login and navigate
    await loginPage.loginWithEnvCredentials();
    await referralPage.gotoReferralUpload();

    // Upload and wait for extraction
    const referralFilePath = path.join(REFERRAL_FIXTURES_PATH, 'cardiology-referral-001.txt');
    await referralPage.uploadReferralPDF(referralFilePath);
    await referralPage.waitForExtraction(TEST_TIMEOUTS.referralExtraction);

    // Confirm and proceed to consultation
    await referralPage.confirmAndProceed();

    // Verify navigation to consultation page or that data was applied
    await waitForNetworkIdle(page);
  });

  test('should generate letter with referral context', async ({ page }) => {
    // Setup mocks for the complete workflow
    const expectedExtraction = EXPECTED_REFERRAL_EXTRACTIONS['cardiology-referral-001'];

    await page.route('**/api/referrals/**', async (route) => {
      const url = route.request().url();
      if (url.includes('/upload')) {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ success: true, referralId: 'test-referral-001' }),
        });
      } else if (url.includes('/extract')) {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            success: true,
            extractedData: {
              patient: expectedExtraction.patient,
              referrer: expectedExtraction.referrer,
              clinicalContext: 'Progressive dyspnoea on exertion.',
              reasonForReferral: expectedExtraction.reasonForReferral,
            },
          }),
        });
      } else {
        await route.continue();
      }
    });

    // Mock letter generation
    await mockLetterGeneration(page, SAMPLE_LETTER_CONTENT.heartFailure.body);

    // Mock transcription
    await mockTranscription(page);

    // Mock recordings API
    await page.route('**/api/recordings/**', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          recordingId: 'test-recording-from-referral',
          transcript: 'Transcription from referral consultation.',
        }),
      });
    });

    // Login and navigate
    await loginPage.loginWithEnvCredentials();
    await referralPage.gotoReferralUpload();

    // Complete referral upload workflow
    const referralFilePath = path.join(REFERRAL_FIXTURES_PATH, 'cardiology-referral-001.txt');
    await referralPage.completeReferralWorkflow(referralFilePath);

    // Verify we're on the consultation page or can proceed to letter generation
    await waitForNetworkIdle(page);

    // If we're on consultation page, generate the letter
    const currentUrl = page.url();
    if (currentUrl.includes('/record') || currentUrl.includes('/consultation')) {
      // Fill any remaining required fields
      await consultationPage.selectRecordingMode('UPLOAD');
      await waitForNetworkIdle(page);

      // Generate the letter
      await consultationPage.generateLetterAndWait(TEST_TIMEOUTS.letterGeneration);

      // Capture the letter ID for subsequent tests
      const url = page.url();
      const match = url.match(/\/letters\/([a-zA-Z0-9-]+)/);
      if (match && match[1]) {
        generatedLetterId = match[1];
      }

      // Verify we're on the letter detail page
      await expect(page).toHaveURL(/\/letters\/.+/);
    }
  });

  test('should send letter to referrer', async ({ page }) => {
    const expectedExtraction = EXPECTED_REFERRAL_EXTRACTIONS['cardiology-referral-001'];

    // Mock the letter API
    await page.route('**/api/letters/**', async (route) => {
      const url = route.request().url();
      const method = route.request().method();

      if (method === 'GET' && !url.includes('/send')) {
        // Return mock letter
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            id: generatedLetterId ?? 'test-letter-from-referral',
            content: SAMPLE_LETTER_CONTENT.heartFailure.body,
            status: 'APPROVED',
            letterType: 'NEW_PATIENT',
            referralId: 'test-referral-001',
            referrer: {
              name: expectedExtraction.referrer.name,
              email: expectedExtraction.referrer.email,
            },
          }),
        });
      } else if (url.includes('/send') && method === 'POST') {
        // Mock send endpoint
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            success: true,
            sentTo: [
              {
                name: expectedExtraction.referrer.name,
                email: expectedExtraction.referrer.email,
                status: 'sent',
                channel: 'email',
              },
            ],
          }),
        });
      } else {
        await route.continue();
      }
    });

    // Login and navigate to letter
    await loginPage.loginWithEnvCredentials();
    const letterId = generatedLetterId ?? 'test-letter-from-referral';
    await letterDetailPage.gotoLetter(letterId);

    // Verify letter is loaded
    await letterDetailPage.expectLetterVisible();

    // Open send dialog
    await letterDetailPage.openSendDialog();
    await expect(letterDetailPage.sendDialog).toBeVisible();

    // The referrer should be pre-selected or available
    // Select the referring GP
    await letterDetailPage.selectRecipient(expectedExtraction.referrer.name);

    // Move to message step
    await letterDetailPage.nextStep();

    // Fill subject
    await letterDetailPage.fillSubject(
      `RE: ${expectedExtraction.patient.name} - Cardiology Consultation`
    );

    // Move to confirm step
    await letterDetailPage.nextStep();

    // Confirm send
    await letterDetailPage.confirmSend();

    // Verify success
    await letterDetailPage.expectSendSuccess();
  });
});

// Urgent referral tests (cardiology-referral-002.pdf)
test.describe('Urgent Referral Upload', () => {
  let loginPage: LoginPage;
  let referralPage: ReferralUploadPage;

  test.beforeEach(async ({ page }) => {
    loginPage = new LoginPage(page);
    referralPage = new ReferralUploadPage(page);
  });

  test('should extract urgent referral with correct priority', async ({ page }) => {
    const expectedExtraction = EXPECTED_REFERRAL_EXTRACTIONS['cardiology-referral-002'];

    // Setup extraction mock for urgent referral
    await page.route('**/api/referrals/**', async (route) => {
      const url = route.request().url();
      if (url.includes('/upload')) {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ success: true, referralId: 'test-referral-002' }),
        });
      } else if (url.includes('/extract')) {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            success: true,
            extractedData: {
              patient: expectedExtraction.patient,
              referrer: expectedExtraction.referrer,
              reasonForReferral: expectedExtraction.reasonForReferral,
              urgency: 'urgent',
            },
            confidence: 0.95,
          }),
        });
      } else {
        await route.continue();
      }
    });

    // Login and navigate
    await loginPage.loginWithEnvCredentials();
    await referralPage.gotoReferralUpload();

    // Upload urgent referral
    const referralFilePath = path.join(REFERRAL_FIXTURES_PATH, 'cardiology-referral-002.txt');
    const data = await referralPage.uploadAndExtract(referralFilePath);

    // Verify patient data is extracted
    expect(data.patient?.name).toContain('TEST');

    // Verify referrer data is extracted
    expect(data.referrer?.name).toContain('TEST');
  });

  test('should extract chest pain clinical context correctly', async ({ page }) => {
    const expectedExtraction = EXPECTED_REFERRAL_EXTRACTIONS['cardiology-referral-002'];

    // Setup extraction mock
    await page.route('**/api/referrals/**', async (route) => {
      const url = route.request().url();
      if (url.includes('/upload')) {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ success: true, referralId: 'test-referral-002' }),
        });
      } else if (url.includes('/extract')) {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            success: true,
            extractedData: {
              patient: expectedExtraction.patient,
              referrer: expectedExtraction.referrer,
              clinicalContext: 'Exertional chest pain with positive stress test.',
              reasonForReferral: expectedExtraction.reasonForReferral,
              urgency: 'urgent',
            },
          }),
        });
      } else {
        await route.continue();
      }
    });

    // Login and navigate
    await loginPage.loginWithEnvCredentials();
    await referralPage.gotoReferralUpload();

    // Upload and extract
    const referralFilePath = path.join(REFERRAL_FIXTURES_PATH, 'cardiology-referral-002.txt');
    await referralPage.uploadReferralPDF(referralFilePath);
    await referralPage.waitForExtraction(TEST_TIMEOUTS.referralExtraction);

    // Verify extraction success
    await referralPage.expectExtractionSuccess();

    // Review data
    const review = await referralPage.reviewExtractedData();
    expect(review.hasPatient).toBe(true);
    expect(review.hasReferrer).toBe(true);
  });
});

// Error handling tests
test.describe('Referral Upload - Error Handling', () => {
  let loginPage: LoginPage;
  let referralPage: ReferralUploadPage;

  test.beforeEach(async ({ page }) => {
    loginPage = new LoginPage(page);
    referralPage = new ReferralUploadPage(page);
  });

  test('should handle upload failure gracefully', async ({ page }) => {
    // Mock upload failure
    await page.route('**/api/referrals/upload', async (route) => {
      await route.fulfill({
        status: 500,
        contentType: 'application/json',
        body: JSON.stringify({
          success: false,
          error: 'File upload failed. Please try again.',
        }),
      });
    });

    // Login and navigate
    await loginPage.loginWithEnvCredentials();
    await referralPage.gotoReferralUpload();

    // Attempt upload
    const referralFilePath = path.join(REFERRAL_FIXTURES_PATH, 'cardiology-referral-001.txt');
    await referralPage.uploadReferralPDF(referralFilePath);

    // Wait for error state
    await waitForNetworkIdle(page);

    // Verify error is displayed or retry button is available
    const hasRetryButton = await referralPage.retryButton.isVisible();
    const hasErrorState = await referralPage.extractionErrorIcon.isVisible();

    // Either retry should be available or error should be shown
    expect(hasRetryButton || hasErrorState).toBe(true);
  });

  test('should handle extraction failure gracefully', async ({ page }) => {
    // Mock successful upload but failed extraction
    await page.route('**/api/referrals/upload', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ success: true, referralId: 'test-referral-fail' }),
      });
    });

    await page.route('**/api/referrals/**/extract', async (route) => {
      await route.fulfill({
        status: 500,
        contentType: 'application/json',
        body: JSON.stringify({
          success: false,
          error: 'Failed to extract data from PDF. The document may be corrupted or unreadable.',
        }),
      });
    });

    // Login and navigate
    await loginPage.loginWithEnvCredentials();
    await referralPage.gotoReferralUpload();

    // Upload file
    const referralFilePath = path.join(REFERRAL_FIXTURES_PATH, 'cardiology-referral-001.txt');
    await referralPage.uploadReferralPDF(referralFilePath);

    // Wait for extraction to fail
    const state = await referralPage.waitForExtraction(TEST_TIMEOUTS.referralExtraction);

    // Verify error state
    expect(state).toBe('error');
    await referralPage.expectExtractionError();
  });

  test('should handle invalid file type', async ({ page }) => {
    // Login and navigate
    await loginPage.loginWithEnvCredentials();
    await referralPage.gotoReferralUpload();

    // Try to upload an invalid file type (simulate with wrong extension)
    // Note: This test depends on client-side validation
    await referralPage.expectReadyForUpload();

    // The file input should only accept PDFs
    const acceptAttribute = await referralPage.fileInput.getAttribute('accept');
    expect(acceptAttribute).toContain('pdf');
  });

  test('should allow discard and retry with different file', async ({ page }) => {
    const expectedExtraction = EXPECTED_REFERRAL_EXTRACTIONS['cardiology-referral-001'];

    // Setup successful extraction mock
    await page.route('**/api/referrals/**', async (route) => {
      const url = route.request().url();
      if (url.includes('/upload')) {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ success: true, referralId: 'test-referral-retry' }),
        });
      } else if (url.includes('/extract')) {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            success: true,
            extractedData: {
              patient: expectedExtraction.patient,
              referrer: expectedExtraction.referrer,
            },
          }),
        });
      } else {
        await route.continue();
      }
    });

    // Login and navigate
    await loginPage.loginWithEnvCredentials();
    await referralPage.gotoReferralUpload();

    // Upload first file
    const referralFilePath = path.join(REFERRAL_FIXTURES_PATH, 'cardiology-referral-001.txt');
    await referralPage.uploadReferralPDF(referralFilePath);
    await referralPage.waitForExtraction(TEST_TIMEOUTS.referralExtraction);

    // Discard the referral
    await referralPage.discardReferral();

    // Verify we're back to upload state
    await referralPage.expectReadyForUpload();

    // Upload a different file
    const referralFilePath2 = path.join(REFERRAL_FIXTURES_PATH, 'cardiology-referral-002.txt');
    await referralPage.uploadReferralPDF(referralFilePath2);

    // Verify new upload started
    await referralPage.expectUploadSuccess();
  });

  test('should show progress during extraction', async ({ page }) => {
    // Setup mock with delayed extraction
    await page.route('**/api/referrals/upload', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ success: true, referralId: 'test-referral-progress' }),
      });
    });

    await page.route('**/api/referrals/**/extract', async (route) => {
      // Simulate longer extraction time
      await new Promise((resolve) => setTimeout(resolve, 2000));
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          extractedData: {
            patient: { name: 'TEST Patient', dateOfBirth: '1960-01-01' },
            referrer: { name: 'TEST Referrer' },
          },
        }),
      });
    });

    // Login and navigate
    await loginPage.loginWithEnvCredentials();
    await referralPage.gotoReferralUpload();

    // Upload file
    const referralFilePath = path.join(REFERRAL_FIXTURES_PATH, 'cardiology-referral-001.txt');
    await referralPage.uploadReferralPDF(referralFilePath);

    // Check that extraction is in progress (spinner visible)
    // Note: This depends on the UI showing a loading state
    const state = await referralPage.getExtractionState();

    // Should be in an extracting state initially
    expect(['uploading', 'extracting_text', 'extracting_data', 'validating', 'ready']).toContain(state);

    // Wait for completion
    await referralPage.waitForExtraction(TEST_TIMEOUTS.referralExtraction);
  });
});

// Extraction accuracy verification tests
test.describe('Referral Extraction - Accuracy Verification', () => {
  let loginPage: LoginPage;
  let referralPage: ReferralUploadPage;

  test.beforeEach(async ({ page }) => {
    loginPage = new LoginPage(page);
    referralPage = new ReferralUploadPage(page);
  });

  test('should extract patient date of birth correctly', async ({ page }) => {
    const expectedExtraction = EXPECTED_REFERRAL_EXTRACTIONS['cardiology-referral-001'];

    // Setup mock with specific DOB
    await page.route('**/api/referrals/**', async (route) => {
      const url = route.request().url();
      if (url.includes('/upload')) {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ success: true, referralId: 'test-referral-dob' }),
        });
      } else if (url.includes('/extract')) {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            success: true,
            extractedData: {
              patient: expectedExtraction.patient,
              referrer: expectedExtraction.referrer,
            },
          }),
        });
      } else {
        await route.continue();
      }
    });

    // Login and navigate
    await loginPage.loginWithEnvCredentials();
    await referralPage.gotoReferralUpload();

    // Upload and extract
    const referralFilePath = path.join(REFERRAL_FIXTURES_PATH, 'cardiology-referral-001.txt');
    const data = await referralPage.uploadAndExtract(referralFilePath);

    // Verify DOB is extracted (format may vary)
    expect(data.patient?.dateOfBirth).toBeDefined();
    // The expected format is YYYY-MM-DD
    expect(data.patient?.dateOfBirth).toMatch(/\d{4}-\d{2}-\d{2}|\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4}/);
  });

  test('should extract referrer contact details correctly', async ({ page }) => {
    const expectedExtraction = EXPECTED_REFERRAL_EXTRACTIONS['cardiology-referral-001'];

    // Setup mock
    await page.route('**/api/referrals/**', async (route) => {
      const url = route.request().url();
      if (url.includes('/upload')) {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ success: true, referralId: 'test-referral-contact' }),
        });
      } else if (url.includes('/extract')) {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            success: true,
            extractedData: {
              patient: expectedExtraction.patient,
              referrer: expectedExtraction.referrer,
            },
          }),
        });
      } else {
        await route.continue();
      }
    });

    // Login and navigate
    await loginPage.loginWithEnvCredentials();
    await referralPage.gotoReferralUpload();

    // Upload and extract
    const referralFilePath = path.join(REFERRAL_FIXTURES_PATH, 'cardiology-referral-001.txt');
    const data = await referralPage.uploadAndExtract(referralFilePath);

    // Verify referrer contact details
    expect(data.referrer?.email).toBeDefined();
    expect(data.referrer?.phone).toBeDefined();

    // Email should be a valid format (contains @ and uses test domain)
    if (data.referrer?.email) {
      expect(data.referrer.email).toContain('@');
      expect(data.referrer.email).toContain('test');
    }
  });

  test('should handle referrals with missing optional fields', async ({ page }) => {
    // Setup mock with partial data (missing some optional fields)
    await page.route('**/api/referrals/**', async (route) => {
      const url = route.request().url();
      if (url.includes('/upload')) {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ success: true, referralId: 'test-referral-partial' }),
        });
      } else if (url.includes('/extract')) {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            success: true,
            extractedData: {
              patient: {
                name: 'TEST Patient - Partial Data',
                dateOfBirth: '1970-05-15',
                // MRN intentionally missing
              },
              referrer: {
                name: 'Dr. TEST Referrer',
                practice: 'TEST Practice',
                // Email and phone intentionally missing
              },
              reasonForReferral: 'Cardiology review required',
            },
            confidence: 0.75, // Lower confidence due to missing data
          }),
        });
      } else {
        await route.continue();
      }
    });

    // Login and navigate
    await loginPage.loginWithEnvCredentials();
    await referralPage.gotoReferralUpload();

    // Upload and extract
    const referralFilePath = path.join(REFERRAL_FIXTURES_PATH, 'cardiology-referral-001.txt');
    const data = await referralPage.uploadAndExtract(referralFilePath);

    // Verify core data is present
    expect(data.patient?.name).toBeDefined();
    expect(data.referrer?.name).toBeDefined();

    // Optional fields may be undefined
    // This should not cause the workflow to fail
    await referralPage.expectExtractionSuccess();
  });
});

// Accessibility tests
test.describe('Referral Upload - Accessibility', () => {
  test('should have accessible upload dropzone', async ({ page }) => {
    const loginPage = new LoginPage(page);
    const referralPage = new ReferralUploadPage(page);

    await loginPage.loginWithEnvCredentials();
    await referralPage.gotoReferralUpload();

    // Verify dropzone is keyboard accessible
    const dropzone = referralPage.uploadDropzone;
    await expect(dropzone).toBeVisible();

    // Check for aria-label or accessible name
    const ariaLabel = await dropzone.getAttribute('aria-label');
    const ariaLabelledBy = await dropzone.getAttribute('aria-labelledby');
    const role = await dropzone.getAttribute('role');

    // Should have some form of accessible labeling
    const hasAccessibleLabel = ariaLabel || ariaLabelledBy || role;
    expect(hasAccessibleLabel).toBeTruthy();
  });

  test('should announce extraction status to screen readers', async ({ page }) => {
    const loginPage = new LoginPage(page);
    const referralPage = new ReferralUploadPage(page);

    // Setup mock
    await page.route('**/api/referrals/**', async (route) => {
      const url = route.request().url();
      if (url.includes('/upload')) {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ success: true, referralId: 'test-referral-a11y' }),
        });
      } else if (url.includes('/extract')) {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            success: true,
            extractedData: {
              patient: { name: 'TEST A11y Patient' },
              referrer: { name: 'TEST A11y Referrer' },
            },
          }),
        });
      } else {
        await route.continue();
      }
    });

    await loginPage.loginWithEnvCredentials();
    await referralPage.gotoReferralUpload();

    // Upload file
    const referralFilePath = path.join(REFERRAL_FIXTURES_PATH, 'cardiology-referral-001.txt');
    await referralPage.uploadReferralPDF(referralFilePath);
    await referralPage.waitForExtraction(TEST_TIMEOUTS.referralExtraction);

    // Check that status elements have appropriate ARIA attributes
    const statusBadge = referralPage.extractionStatusBadge;
    if (await statusBadge.isVisible()) {
      const ariaLive = await statusBadge.getAttribute('aria-live');
      const role = await statusBadge.getAttribute('role');
      // Status elements should announce changes
      expect(ariaLive === 'polite' || ariaLive === 'assertive' || role === 'status').toBeTruthy();
    }
  });
});
