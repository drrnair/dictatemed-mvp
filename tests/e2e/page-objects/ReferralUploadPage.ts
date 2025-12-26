// tests/e2e/page-objects/ReferralUploadPage.ts
// Page object for referral PDF upload and extraction workflow

import { Page, Locator, expect } from '@playwright/test';
import { BasePage } from './BasePage';
import { TEST_TIMEOUTS } from '../fixtures/test-data';

// Extraction states from the application
export type ExtractionState =
  | 'idle'
  | 'validating'
  | 'uploading'
  | 'extracting_text'
  | 'extracting_data'
  | 'ready'
  | 'error';

// Extracted data structure
export interface ExtractedReferralData {
  patient?: {
    name?: string;
    dateOfBirth?: string;
    mrn?: string;
  };
  referrer?: {
    name?: string;
    practice?: string;
    email?: string;
    phone?: string;
    fax?: string;
    address?: string;
  };
  clinicalContext?: string;
  reasonForReferral?: string;
}

export class ReferralUploadPage extends BasePage {
  // ============================================
  // Upload Components
  // ============================================
  readonly uploadDropzone: Locator;
  readonly fileInput: Locator;
  readonly uploadButton: Locator;
  readonly uploadProgress: Locator;
  readonly uploadProgressBar: Locator;
  readonly uploadStatusText: Locator;
  readonly removeFileButton: Locator;
  readonly retryButton: Locator;

  // ============================================
  // Extraction Status
  // ============================================
  readonly extractionStatusBadge: Locator;
  readonly extractionSpinner: Locator;
  readonly extractionSuccessIcon: Locator;
  readonly extractionErrorIcon: Locator;
  readonly extractionErrorMessage: Locator;

  // ============================================
  // Review Panel
  // ============================================
  readonly reviewPanel: Locator;
  readonly patientSection: Locator;
  readonly referrerSection: Locator;
  readonly clinicalContextSection: Locator;

  // Extracted patient fields
  readonly extractedPatientName: Locator;
  readonly extractedPatientDob: Locator;
  readonly extractedPatientMrn: Locator;
  readonly editPatientButton: Locator;

  // Extracted referrer fields
  readonly extractedReferrerName: Locator;
  readonly extractedReferrerPractice: Locator;
  readonly extractedReferrerEmail: Locator;
  readonly extractedReferrerPhone: Locator;
  readonly editReferrerButton: Locator;

  // Extracted clinical context
  readonly extractedClinicalContext: Locator;
  readonly extractedReasonForReferral: Locator;

  // Edit forms (inline or dialog)
  readonly patientNameEdit: Locator;
  readonly patientDobEdit: Locator;
  readonly patientMrnEdit: Locator;
  readonly referrerNameEdit: Locator;
  readonly referrerPracticeEdit: Locator;
  readonly referrerEmailEdit: Locator;
  readonly saveEditsButton: Locator;
  readonly cancelEditsButton: Locator;

  // ============================================
  // Actions
  // ============================================
  readonly confirmAndProceedButton: Locator;
  readonly applyToConsultationButton: Locator;
  readonly discardButton: Locator;

  constructor(page: Page) {
    super(page);

    // Upload components
    this.uploadDropzone = page.locator(
      '[data-testid="referral-dropzone"], [data-testid="file-dropzone"]'
    );
    // Support both base types (pdf, txt) and extended types (images, docx)
    this.fileInput = page.locator('input[type="file"]').first();
    this.uploadButton = page.getByRole('button', { name: /upload|select file/i });
    this.uploadProgress = page.locator('[data-testid="upload-progress"]');
    this.uploadProgressBar = page.locator('[role="progressbar"]');
    this.uploadStatusText = page.locator('[data-testid="upload-status"]');
    this.removeFileButton = page.getByRole('button', { name: /remove|clear|cancel upload/i });
    this.retryButton = page.getByRole('button', { name: /retry/i });

    // Extraction status
    this.extractionStatusBadge = page.locator('[data-testid="extraction-status"]');
    this.extractionSpinner = page.locator('[data-testid="extraction-spinner"]');
    this.extractionSuccessIcon = page.locator(
      '[data-testid="extraction-success"], svg[class*="check"]'
    );
    this.extractionErrorIcon = page.locator(
      '[data-testid="extraction-error"], svg[class*="error"]'
    );
    this.extractionErrorMessage = page.locator('[data-testid="extraction-error-message"]');

    // Review panel
    this.reviewPanel = page.locator('[data-testid="referral-review-panel"]');
    this.patientSection = page.locator('[data-testid="extracted-patient"]');
    this.referrerSection = page.locator('[data-testid="extracted-referrer"]');
    this.clinicalContextSection = page.locator('[data-testid="extracted-context"]');

    // Extracted patient fields (read-only display)
    this.extractedPatientName = page.locator('[data-testid="extracted-patient-name"]');
    this.extractedPatientDob = page.locator('[data-testid="extracted-patient-dob"]');
    this.extractedPatientMrn = page.locator('[data-testid="extracted-patient-mrn"]');
    this.editPatientButton = this.patientSection.getByRole('button', { name: /edit/i });

    // Extracted referrer fields
    this.extractedReferrerName = page.locator('[data-testid="extracted-referrer-name"]');
    this.extractedReferrerPractice = page.locator('[data-testid="extracted-referrer-practice"]');
    this.extractedReferrerEmail = page.locator('[data-testid="extracted-referrer-email"]');
    this.extractedReferrerPhone = page.locator('[data-testid="extracted-referrer-phone"]');
    this.editReferrerButton = this.referrerSection.getByRole('button', { name: /edit/i });

    // Clinical context
    this.extractedClinicalContext = page.locator('[data-testid="extracted-clinical-context"]');
    this.extractedReasonForReferral = page.locator('[data-testid="extracted-reason"]');

    // Edit form inputs
    this.patientNameEdit = page.getByLabel(/patient name|full name/i);
    this.patientDobEdit = page.getByLabel(/date of birth|dob/i);
    this.patientMrnEdit = page.getByLabel(/mrn|medical record/i);
    this.referrerNameEdit = page.getByLabel(/referrer name|^name$/i);
    this.referrerPracticeEdit = page.getByLabel(/practice/i);
    this.referrerEmailEdit = page.getByLabel(/email/i);
    this.saveEditsButton = page.getByRole('button', { name: /save|apply/i });
    this.cancelEditsButton = page.getByRole('button', { name: /cancel/i });

    // Action buttons
    this.confirmAndProceedButton = page.getByRole('button', {
      name: /confirm|proceed|continue/i,
    });
    this.applyToConsultationButton = page.getByRole('button', {
      name: /apply to consultation|use this data/i,
    });
    this.discardButton = page.getByRole('button', { name: /discard|cancel/i });
  }

  // ============================================
  // Navigation
  // ============================================

  /**
   * Navigate to record page (referral upload is part of new consultation)
   */
  async gotoReferralUpload(): Promise<void> {
    await this.goto('/record');
    await this.page.waitForURL(/\/record/);
    await this.waitForNetworkIdle();
  }

  // ============================================
  // File Upload
  // ============================================

  /**
   * Upload a referral PDF file
   */
  async uploadReferralPDF(filePath: string): Promise<void> {
    // Set the file input (hidden input)
    await this.fileInput.setInputFiles(filePath);
  }

  /**
   * Upload via drag and drop simulation
   */
  async uploadViaDragDrop(filePath: string): Promise<void> {
    // Playwright's setInputFiles works for drag-drop zones too
    await this.uploadDropzone.click();
    await this.fileInput.setInputFiles(filePath);
  }

  /**
   * Remove uploaded file
   */
  async removeUploadedFile(): Promise<void> {
    await this.removeFileButton.click();
    await expect(this.uploadDropzone).toBeVisible();
  }

  /**
   * Retry failed upload
   */
  async retryUpload(): Promise<void> {
    await this.retryButton.click();
  }

  // ============================================
  // Extraction Status
  // ============================================

  /**
   * Wait for extraction to complete (success or error)
   * Uses explicit wait conditions instead of polling with arbitrary delays
   */
  async waitForExtraction(timeout = 30000): Promise<ExtractionState> {
    // Wait for either success or error state to be visible
    const successCondition = this.reviewPanel.or(this.extractionSuccessIcon);
    const errorCondition = this.extractionErrorIcon.or(this.extractionErrorMessage);
    const completionCondition = successCondition.or(errorCondition);

    try {
      await completionCondition.waitFor({ state: 'visible', timeout });
    } catch {
      throw new Error('Extraction timed out waiting for completion');
    }

    // Determine final state
    if (await errorCondition.isVisible()) {
      return 'error';
    }

    return 'ready';
  }

  /**
   * Get current extraction state
   */
  async getExtractionState(): Promise<ExtractionState> {
    // Check for various state indicators
    if (await this.extractionErrorIcon.isVisible()) {
      return 'error';
    }

    if (await this.extractionSuccessIcon.isVisible()) {
      return 'ready';
    }

    if (await this.extractionSpinner.isVisible()) {
      // Determine which extraction phase
      const statusText = await this.uploadStatusText.textContent();
      if (statusText?.toLowerCase().includes('validating')) return 'validating';
      if (statusText?.toLowerCase().includes('uploading')) return 'uploading';
      if (statusText?.toLowerCase().includes('extracting text')) return 'extracting_text';
      if (statusText?.toLowerCase().includes('extracting data')) return 'extracting_data';
      return 'uploading'; // Default processing state
    }

    if (await this.reviewPanel.isVisible()) {
      return 'ready';
    }

    return 'idle';
  }

  /**
   * Get extraction progress percentage
   */
  async getExtractionProgress(): Promise<number> {
    const progressBar = this.uploadProgressBar;
    if (!(await progressBar.isVisible())) return 0;

    const ariaValue = await progressBar.getAttribute('aria-valuenow');
    return ariaValue ? parseInt(ariaValue, 10) : 0;
  }

  // ============================================
  // Review Extracted Data
  // ============================================

  /**
   * Get all extracted data
   */
  async getExtractedData(): Promise<ExtractedReferralData> {
    const data: ExtractedReferralData = {};

    // Wait for review panel to be visible
    await expect(this.reviewPanel).toBeVisible({ timeout: TEST_TIMEOUTS.modalAppear });

    // Extract patient info
    if (await this.patientSection.isVisible()) {
      data.patient = {
        name: (await this.extractedPatientName.textContent()) ?? undefined,
        dateOfBirth: (await this.extractedPatientDob.textContent()) ?? undefined,
        mrn: (await this.extractedPatientMrn.textContent()) ?? undefined,
      };
    }

    // Extract referrer info
    if (await this.referrerSection.isVisible()) {
      data.referrer = {
        name: (await this.extractedReferrerName.textContent()) ?? undefined,
        practice: (await this.extractedReferrerPractice.textContent()) ?? undefined,
        email: (await this.extractedReferrerEmail.textContent()) ?? undefined,
        phone: (await this.extractedReferrerPhone.textContent()) ?? undefined,
      };
    }

    // Extract clinical context
    if (await this.clinicalContextSection.isVisible()) {
      data.clinicalContext =
        (await this.extractedClinicalContext.textContent()) ?? undefined;
      data.reasonForReferral =
        (await this.extractedReasonForReferral.textContent()) ?? undefined;
    }

    return data;
  }

  /**
   * Review extracted data and return summary
   */
  async reviewExtractedData(): Promise<{
    hasPatient: boolean;
    hasReferrer: boolean;
    hasContext: boolean;
    data: ExtractedReferralData;
  }> {
    const data = await this.getExtractedData();

    return {
      hasPatient: !!data.patient?.name,
      hasReferrer: !!data.referrer?.name,
      hasContext: !!data.clinicalContext || !!data.reasonForReferral,
      data,
    };
  }

  // ============================================
  // Edit Extracted Data
  // ============================================

  /**
   * Edit extracted patient information
   */
  async editPatientData(data: {
    name?: string;
    dateOfBirth?: string;
    mrn?: string;
  }): Promise<void> {
    await this.editPatientButton.click();

    if (data.name) {
      await this.patientNameEdit.clear();
      await this.patientNameEdit.fill(data.name);
    }
    if (data.dateOfBirth) {
      await this.patientDobEdit.clear();
      await this.patientDobEdit.fill(data.dateOfBirth);
    }
    if (data.mrn) {
      await this.patientMrnEdit.clear();
      await this.patientMrnEdit.fill(data.mrn);
    }

    await this.saveEditsButton.click();
    await this.waitForNetworkIdle();
  }

  /**
   * Edit extracted referrer information
   */
  async editReferrerData(data: {
    name?: string;
    practice?: string;
    email?: string;
  }): Promise<void> {
    await this.editReferrerButton.click();

    if (data.name) {
      await this.referrerNameEdit.clear();
      await this.referrerNameEdit.fill(data.name);
    }
    if (data.practice) {
      await this.referrerPracticeEdit.clear();
      await this.referrerPracticeEdit.fill(data.practice);
    }
    if (data.email) {
      await this.referrerEmailEdit.clear();
      await this.referrerEmailEdit.fill(data.email);
    }

    await this.saveEditsButton.click();
    await this.waitForNetworkIdle();
  }

  // ============================================
  // Actions
  // ============================================

  /**
   * Confirm extracted data and proceed to consultation
   */
  async confirmAndProceed(): Promise<void> {
    await this.confirmAndProceedButton.click();
    await this.waitForNetworkIdle();
  }

  /**
   * Apply extracted data to consultation form
   */
  async applyToConsultation(): Promise<void> {
    await this.applyToConsultationButton.click();
    await this.waitForNetworkIdle();
  }

  /**
   * Discard referral and start fresh
   */
  async discardReferral(): Promise<void> {
    await this.discardButton.click();
    await expect(this.uploadDropzone).toBeVisible();
  }

  // ============================================
  // Complete Workflow
  // ============================================

  /**
   * Upload referral PDF and wait for extraction
   */
  async uploadAndExtract(filePath: string): Promise<ExtractedReferralData> {
    await this.uploadReferralPDF(filePath);
    const state = await this.waitForExtraction();

    if (state === 'error') {
      const errorMsg = await this.extractionErrorMessage.textContent();
      throw new Error(`Extraction failed: ${errorMsg}`);
    }

    return await this.getExtractedData();
  }

  /**
   * Complete full referral upload workflow
   */
  async completeReferralWorkflow(filePath: string): Promise<void> {
    await this.uploadReferralPDF(filePath);
    await this.waitForExtraction();
    await this.confirmAndProceed();
  }

  // ============================================
  // Assertions
  // ============================================

  /**
   * Assert file was uploaded successfully
   */
  async expectUploadSuccess(): Promise<void> {
    await expect(this.removeFileButton.or(this.extractionSpinner)).toBeVisible();
  }

  /**
   * Assert extraction completed successfully
   */
  async expectExtractionSuccess(): Promise<void> {
    await expect(this.reviewPanel).toBeVisible({ timeout: TEST_TIMEOUTS.referralExtraction });
  }

  /**
   * Assert extraction failed with error
   */
  async expectExtractionError(): Promise<void> {
    await expect(this.extractionErrorIcon.or(this.extractionErrorMessage)).toBeVisible({
      timeout: TEST_TIMEOUTS.referralExtraction,
    });
  }

  /**
   * Assert specific patient data was extracted
   */
  async expectExtractedPatient(name: string): Promise<void> {
    await expect(this.extractedPatientName).toContainText(name);
  }

  /**
   * Assert specific referrer data was extracted
   */
  async expectExtractedReferrer(name: string): Promise<void> {
    await expect(this.extractedReferrerName).toContainText(name);
  }

  /**
   * Assert upload dropzone is visible (ready for upload)
   */
  async expectReadyForUpload(): Promise<void> {
    await expect(this.uploadDropzone).toBeVisible();
  }

  /**
   * Assert file type error
   */
  async expectInvalidFileTypeError(): Promise<void> {
    await expect(this.page.getByText(/invalid file|only pdf|unsupported/i)).toBeVisible();
  }
}
