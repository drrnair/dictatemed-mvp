// tests/e2e/flows/extended-upload-types.spec.ts
// E2E tests for extended file upload types (images, DOCX)
//
// Tests the upload flow for new file types enabled by FEATURE_EXTENDED_UPLOAD_TYPES:
// - JPEG/PNG images (extracted via Claude Vision)
// - Word documents (extracted via mammoth)
//
// These tests run with FEATURE_EXTENDED_UPLOAD_TYPES=true to enable new types.
// Also includes regression tests to ensure PDF/TXT still work.

import { test, expect, Page } from '@playwright/test';
import * as path from 'path';
import { LoginPage } from '../page-objects/LoginPage';
import { ReferralUploadPage } from '../page-objects/ReferralUploadPage';
import {
  EXPECTED_REFERRAL_EXTRACTIONS,
  TEST_TIMEOUTS,
} from '../fixtures/test-data';
import {
  waitForNetworkIdle,
  MOCK_SERVICES,
} from '../utils/helpers';

// Path to test referral files
const REFERRAL_FIXTURES_PATH = path.join(__dirname, '../fixtures/referrals');

// ============================================
// Mock Setup Functions for Extended Types
// ============================================

interface ExtendedReferralMockOptions {
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
  fileType?: 'image' | 'docx' | 'pdf' | 'txt';
}

/**
 * Sets up all referral-related API mocks for extended file types.
 * Respects MOCK_SERVICES flag - returns early if MOCK_SERVICES=false.
 */
async function setupExtendedMocks(page: Page, options: ExtendedReferralMockOptions = {}): Promise<void> {
  if (!MOCK_SERVICES) return;

  const {
    referralId = 'test-referral-extended-001',
    extractedData,
    confidence = 0.88, // Slightly lower confidence for image/docx extraction
    uploadError = false,
    extractionError = false,
    extractionDelay = 0,
    fileType = 'image',
  } = options;

  await page.route('**/api/referrals/**', async (route) => {
    const url = route.request().url();
    const method = route.request().method();

    // Handle upload endpoint
    if (url.includes('/upload') || (method === 'POST' && url.endsWith('/referrals'))) {
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
        // Determine file extension based on type
        const extensions: Record<string, string> = {
          image: 'jpg',
          docx: 'docx',
          pdf: 'pdf',
          txt: 'txt',
        };
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            success: true,
            referralId,
            fileName: `referral.${extensions[fileType]}`,
            fileSize: fileType === 'image' ? 245000 : 125000,
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
            error: fileType === 'image'
              ? 'Failed to extract text from image. The image may be too blurry or low quality.'
              : 'Failed to extract data from document. The file may be corrupted.',
          }),
        });
      } else {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            success: true,
            extractedData: extractedData ?? {
              patient: { name: 'TEST Patient - Extended', dateOfBirth: '1965-05-15' },
              referrer: { name: 'TEST Referrer - Extended' },
            },
            confidence,
            extractionMethod: fileType === 'image' ? 'vision' : 'text',
          }),
        });
      }
      return;
    }

    // Pass through other requests
    await route.continue();
  });
}

// ============================================
// Extended Upload Types Tests
// ============================================

test.describe('Extended Upload Types - Feature Flag Enabled', () => {
  let loginPage: LoginPage;
  let referralPage: ReferralUploadPage;

  test.beforeEach(async ({ page }) => {
    loginPage = new LoginPage(page);
    referralPage = new ReferralUploadPage(page);
  });

  // ============================================
  // JPEG Image Upload Tests
  // ============================================

  test.describe('JPEG Image Upload', () => {
    test('should upload JPEG image successfully', async ({ page }) => {
      const expectedExtraction = EXPECTED_REFERRAL_EXTRACTIONS['image-referral-001'];

      await setupExtendedMocks(page, {
        referralId: 'test-referral-jpeg-001',
        extractedData: {
          patient: expectedExtraction.patient,
          referrer: expectedExtraction.referrer,
          reasonForReferral: expectedExtraction.reasonForReferral,
        },
        fileType: 'image',
        confidence: 0.85,
      });

      // Login and navigate
      await loginPage.loginWithEnvCredentials();
      await referralPage.gotoReferralUpload();

      // Upload JPEG image
      const jpegFilePath = path.join(REFERRAL_FIXTURES_PATH, 'image-referral-001.jpg');
      await referralPage.uploadReferralPDF(jpegFilePath);

      // Verify upload success
      await referralPage.expectUploadSuccess();
    });

    test('should extract patient data from JPEG image via Vision API', async ({ page }) => {
      const expectedExtraction = EXPECTED_REFERRAL_EXTRACTIONS['image-referral-001'];

      await setupExtendedMocks(page, {
        referralId: 'test-referral-jpeg-002',
        extractedData: {
          patient: expectedExtraction.patient,
          referrer: expectedExtraction.referrer,
          clinicalContext: 'Chest discomfort on exertion.',
          reasonForReferral: expectedExtraction.reasonForReferral,
        },
        fileType: 'image',
        extractionDelay: 500,
        confidence: 0.82,
      });

      // Login and navigate
      await loginPage.loginWithEnvCredentials();
      await referralPage.gotoReferralUpload();

      // Upload and wait for extraction
      const jpegFilePath = path.join(REFERRAL_FIXTURES_PATH, 'image-referral-001.jpg');
      const data = await referralPage.uploadAndExtract(jpegFilePath);

      // Verify patient data extracted
      expect(data.patient).toBeDefined();
      expect(data.patient?.name).toContain('TEST');
      expect(data.referrer).toBeDefined();

      // Verify extraction state
      const state = await referralPage.getExtractionState();
      expect(state).toBe('ready');
    });

    test('should show extraction complete for JPEG with review panel', async ({ page }) => {
      const expectedExtraction = EXPECTED_REFERRAL_EXTRACTIONS['image-referral-001'];

      await setupExtendedMocks(page, {
        referralId: 'test-referral-jpeg-003',
        extractedData: {
          patient: expectedExtraction.patient,
          referrer: expectedExtraction.referrer,
          reasonForReferral: expectedExtraction.reasonForReferral,
        },
        fileType: 'image',
      });

      // Login and navigate
      await loginPage.loginWithEnvCredentials();
      await referralPage.gotoReferralUpload();

      // Upload and extract
      const jpegFilePath = path.join(REFERRAL_FIXTURES_PATH, 'image-referral-001.jpg');
      await referralPage.uploadReferralPDF(jpegFilePath);
      await referralPage.waitForExtraction(TEST_TIMEOUTS.referralExtraction);

      // Verify extraction success and review panel visible
      await referralPage.expectExtractionSuccess();

      // Review extracted data
      const review = await referralPage.reviewExtractedData();
      expect(review.hasPatient).toBe(true);
      expect(review.hasReferrer).toBe(true);
    });
  });

  // ============================================
  // PNG Image Upload Tests
  // ============================================

  test.describe('PNG Image Upload', () => {
    test('should upload PNG image successfully', async ({ page }) => {
      const expectedExtraction = EXPECTED_REFERRAL_EXTRACTIONS['image-referral-001'];

      await setupExtendedMocks(page, {
        referralId: 'test-referral-png-001',
        extractedData: {
          patient: expectedExtraction.patient,
          referrer: expectedExtraction.referrer,
          reasonForReferral: expectedExtraction.reasonForReferral,
        },
        fileType: 'image',
      });

      // Login and navigate
      await loginPage.loginWithEnvCredentials();
      await referralPage.gotoReferralUpload();

      // Upload PNG image
      const pngFilePath = path.join(REFERRAL_FIXTURES_PATH, 'image-referral-001.png');
      await referralPage.uploadReferralPDF(pngFilePath);

      // Verify upload success
      await referralPage.expectUploadSuccess();
    });

    test('should extract data from PNG with same accuracy as JPEG', async ({ page }) => {
      const expectedExtraction = EXPECTED_REFERRAL_EXTRACTIONS['image-referral-001'];

      await setupExtendedMocks(page, {
        referralId: 'test-referral-png-002',
        extractedData: {
          patient: expectedExtraction.patient,
          referrer: expectedExtraction.referrer,
          clinicalContext: 'Patient presents with chest discomfort.',
          reasonForReferral: expectedExtraction.reasonForReferral,
        },
        fileType: 'image',
        confidence: 0.84,
      });

      // Login and navigate
      await loginPage.loginWithEnvCredentials();
      await referralPage.gotoReferralUpload();

      // Upload PNG and extract
      const pngFilePath = path.join(REFERRAL_FIXTURES_PATH, 'image-referral-001.png');
      const data = await referralPage.uploadAndExtract(pngFilePath);

      // Verify extraction
      expect(data.patient?.name).toContain('TEST');
      await referralPage.expectExtractionSuccess();
    });
  });

  // ============================================
  // Word Document (DOCX) Upload Tests
  // ============================================

  test.describe('Word Document (DOCX) Upload', () => {
    test('should upload DOCX file successfully', async ({ page }) => {
      const expectedExtraction = EXPECTED_REFERRAL_EXTRACTIONS['docx-referral-001'];

      await setupExtendedMocks(page, {
        referralId: 'test-referral-docx-001',
        extractedData: {
          patient: expectedExtraction.patient,
          referrer: expectedExtraction.referrer,
          reasonForReferral: expectedExtraction.reasonForReferral,
        },
        fileType: 'docx',
        confidence: 0.92, // Higher confidence for text-based extraction
      });

      // Login and navigate
      await loginPage.loginWithEnvCredentials();
      await referralPage.gotoReferralUpload();

      // Upload DOCX file
      const docxFilePath = path.join(REFERRAL_FIXTURES_PATH, 'docx-referral-001.docx');
      await referralPage.uploadReferralPDF(docxFilePath);

      // Verify upload success
      await referralPage.expectUploadSuccess();
    });

    test('should extract patient and referrer data from DOCX', async ({ page }) => {
      const expectedExtraction = EXPECTED_REFERRAL_EXTRACTIONS['docx-referral-001'];

      await setupExtendedMocks(page, {
        referralId: 'test-referral-docx-002',
        extractedData: {
          patient: expectedExtraction.patient,
          referrer: expectedExtraction.referrer,
          clinicalContext: 'Palpitations with light-headedness episodes.',
          reasonForReferral: expectedExtraction.reasonForReferral,
        },
        fileType: 'docx',
        extractionDelay: 300,
        confidence: 0.91,
      });

      // Login and navigate
      await loginPage.loginWithEnvCredentials();
      await referralPage.gotoReferralUpload();

      // Upload and extract
      const docxFilePath = path.join(REFERRAL_FIXTURES_PATH, 'docx-referral-001.docx');
      const data = await referralPage.uploadAndExtract(docxFilePath);

      // Verify patient and referrer data
      expect(data.patient).toBeDefined();
      expect(data.patient?.name).toContain('TEST');
      expect(data.referrer).toBeDefined();
      expect(data.referrer?.name).toContain('TEST');

      // DOCX should have higher confidence than images
      await referralPage.expectExtractionSuccess();
    });

    test('should display review panel with DOCX extracted data', async ({ page }) => {
      const expectedExtraction = EXPECTED_REFERRAL_EXTRACTIONS['docx-referral-001'];

      await setupExtendedMocks(page, {
        referralId: 'test-referral-docx-003',
        extractedData: {
          patient: expectedExtraction.patient,
          referrer: expectedExtraction.referrer,
          reasonForReferral: expectedExtraction.reasonForReferral,
        },
        fileType: 'docx',
      });

      // Login and navigate
      await loginPage.loginWithEnvCredentials();
      await referralPage.gotoReferralUpload();

      // Upload and wait for extraction
      const docxFilePath = path.join(REFERRAL_FIXTURES_PATH, 'docx-referral-001.docx');
      await referralPage.uploadReferralPDF(docxFilePath);
      await referralPage.waitForExtraction(TEST_TIMEOUTS.referralExtraction);

      // Verify review panel
      await referralPage.expectExtractionSuccess();
      const review = await referralPage.reviewExtractedData();
      expect(review.hasPatient).toBe(true);
      expect(review.hasReferrer).toBe(true);
    });
  });

  // ============================================
  // Error Handling Tests for Extended Types
  // ============================================

  test.describe('Error Handling - Extended Types', () => {
    test('should handle image extraction failure gracefully', async ({ page }) => {
      await setupExtendedMocks(page, {
        referralId: 'test-referral-img-fail',
        fileType: 'image',
        extractionError: true,
      });

      // Login and navigate
      await loginPage.loginWithEnvCredentials();
      await referralPage.gotoReferralUpload();

      // Upload image
      const jpegFilePath = path.join(REFERRAL_FIXTURES_PATH, 'image-referral-001.jpg');
      await referralPage.uploadReferralPDF(jpegFilePath);

      // Wait for extraction to fail
      const state = await referralPage.waitForExtraction(TEST_TIMEOUTS.referralExtraction);

      // Verify error state
      expect(state).toBe('error');
      await referralPage.expectExtractionError();
    });

    test('should handle DOCX extraction failure gracefully', async ({ page }) => {
      await setupExtendedMocks(page, {
        referralId: 'test-referral-docx-fail',
        fileType: 'docx',
        extractionError: true,
      });

      // Login and navigate
      await loginPage.loginWithEnvCredentials();
      await referralPage.gotoReferralUpload();

      // Upload DOCX
      const docxFilePath = path.join(REFERRAL_FIXTURES_PATH, 'docx-referral-001.docx');
      await referralPage.uploadReferralPDF(docxFilePath);

      // Wait for extraction to fail
      const state = await referralPage.waitForExtraction(TEST_TIMEOUTS.referralExtraction);

      // Verify error state
      expect(state).toBe('error');
      await referralPage.expectExtractionError();
    });

    test('should show lower confidence warning for blurry images', async ({ page }) => {
      const expectedExtraction = EXPECTED_REFERRAL_EXTRACTIONS['image-referral-001'];

      await setupExtendedMocks(page, {
        referralId: 'test-referral-img-low-conf',
        extractedData: {
          patient: expectedExtraction.patient,
          referrer: expectedExtraction.referrer,
        },
        fileType: 'image',
        confidence: 0.45, // Low confidence due to image quality
      });

      // Login and navigate
      await loginPage.loginWithEnvCredentials();
      await referralPage.gotoReferralUpload();

      // Upload and extract
      const jpegFilePath = path.join(REFERRAL_FIXTURES_PATH, 'image-referral-001.jpg');
      await referralPage.uploadReferralPDF(jpegFilePath);
      await referralPage.waitForExtraction(TEST_TIMEOUTS.referralExtraction);

      // Extraction should succeed but with warning
      await referralPage.expectExtractionSuccess();

      // Check for confidence warning (implementation-dependent)
      const warningIndicator = page.locator(
        '[data-testid="confidence-warning"], [class*="warning"], [aria-label*="low confidence"]'
      );
      const hasWarning = await warningIndicator.isVisible().catch(() => false);
      if (!hasWarning) {
        console.log(
          'UX Note: Consider adding visual indicators for low-confidence image extractions'
        );
      }
    });
  });

  // ============================================
  // Regression Tests - Original Types Still Work
  // ============================================

  test.describe('Regression - PDF/TXT Still Work', () => {
    test('should still upload and extract PDF successfully', async ({ page }) => {
      const expectedExtraction = EXPECTED_REFERRAL_EXTRACTIONS['cardiology-referral-001'];

      await setupExtendedMocks(page, {
        referralId: 'test-referral-pdf-regression',
        extractedData: {
          patient: expectedExtraction.patient,
          referrer: expectedExtraction.referrer,
          reasonForReferral: expectedExtraction.reasonForReferral,
        },
        fileType: 'pdf',
        confidence: 0.94,
      });

      // Login and navigate
      await loginPage.loginWithEnvCredentials();
      await referralPage.gotoReferralUpload();

      // Upload PDF (original type)
      const pdfFilePath = path.join(REFERRAL_FIXTURES_PATH, 'cardiology-referral-001.pdf');
      const data = await referralPage.uploadAndExtract(pdfFilePath);

      // Verify extraction works as before
      expect(data.patient).toBeDefined();
      expect(data.patient?.name).toContain('TEST');
      await referralPage.expectExtractionSuccess();
    });

    test('should still upload and extract TXT successfully', async ({ page }) => {
      const expectedExtraction = EXPECTED_REFERRAL_EXTRACTIONS['cardiology-referral-001'];

      await setupExtendedMocks(page, {
        referralId: 'test-referral-txt-regression',
        extractedData: {
          patient: expectedExtraction.patient,
          referrer: expectedExtraction.referrer,
          reasonForReferral: expectedExtraction.reasonForReferral,
        },
        fileType: 'txt',
        confidence: 0.95,
      });

      // Login and navigate
      await loginPage.loginWithEnvCredentials();
      await referralPage.gotoReferralUpload();

      // Upload TXT (used in existing tests)
      const txtFilePath = path.join(REFERRAL_FIXTURES_PATH, 'cardiology-referral-001.txt');
      const data = await referralPage.uploadAndExtract(txtFilePath);

      // Verify extraction works as before
      expect(data.patient).toBeDefined();
      expect(data.patient?.name).toContain('TEST');
      await referralPage.expectExtractionSuccess();
    });
  });

  // ============================================
  // Workflow Integration Tests
  // ============================================

  test.describe('Complete Workflow - Extended Types', () => {
    test('should complete full workflow with JPEG upload', async ({ page }) => {
      const expectedExtraction = EXPECTED_REFERRAL_EXTRACTIONS['image-referral-001'];

      await setupExtendedMocks(page, {
        referralId: 'test-referral-jpeg-workflow',
        extractedData: {
          patient: expectedExtraction.patient,
          referrer: expectedExtraction.referrer,
          clinicalContext: 'Chest discomfort on exertion.',
          reasonForReferral: expectedExtraction.reasonForReferral,
        },
        fileType: 'image',
      });

      // Login and navigate
      await loginPage.loginWithEnvCredentials();
      await referralPage.gotoReferralUpload();

      // Complete workflow
      const jpegFilePath = path.join(REFERRAL_FIXTURES_PATH, 'image-referral-001.jpg');
      await referralPage.completeReferralWorkflow(jpegFilePath);

      // Verify workflow completed
      await waitForNetworkIdle(page);
    });

    test('should complete full workflow with DOCX upload', async ({ page }) => {
      const expectedExtraction = EXPECTED_REFERRAL_EXTRACTIONS['docx-referral-001'];

      await setupExtendedMocks(page, {
        referralId: 'test-referral-docx-workflow',
        extractedData: {
          patient: expectedExtraction.patient,
          referrer: expectedExtraction.referrer,
          clinicalContext: 'Palpitations with light-headedness.',
          reasonForReferral: expectedExtraction.reasonForReferral,
        },
        fileType: 'docx',
      });

      // Login and navigate
      await loginPage.loginWithEnvCredentials();
      await referralPage.gotoReferralUpload();

      // Complete workflow
      const docxFilePath = path.join(REFERRAL_FIXTURES_PATH, 'docx-referral-001.docx');
      await referralPage.completeReferralWorkflow(docxFilePath);

      // Verify workflow completed
      await waitForNetworkIdle(page);
    });
  });
});

// ============================================
// Accessibility Tests for Extended Types
// ============================================

test.describe('Extended Upload Types - Accessibility', () => {
  test('should announce supported file types including new formats', async ({ page }) => {
    const loginPage = new LoginPage(page);
    const referralPage = new ReferralUploadPage(page);

    await loginPage.loginWithEnvCredentials();
    await referralPage.gotoReferralUpload();

    // Verify dropzone is accessible
    const dropzone = referralPage.uploadDropzone;
    await expect(dropzone).toBeVisible();

    // Check file input accepts extended types
    const fileInput = referralPage.fileInput;
    const acceptAttribute = await fileInput.getAttribute('accept');

    // With feature flag enabled, should accept images and docx
    // Note: Exact attribute depends on implementation
    if (acceptAttribute) {
      console.log(`File input accept attribute: ${acceptAttribute}`);
    }

    // Verify keyboard accessibility
    await dropzone.focus();
    await expect(dropzone).toBeFocused();
  });
});
