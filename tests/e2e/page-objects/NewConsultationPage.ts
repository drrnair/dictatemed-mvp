// tests/e2e/page-objects/NewConsultationPage.ts
// Page object for the new consultation/record workflow

import { Page, Locator, expect } from '@playwright/test';
import { BasePage } from './BasePage';

// Letter type options
export type LetterType = 'NEW_PATIENT' | 'FOLLOW_UP' | 'ANGIOGRAM_PROCEDURE' | 'ECHO_REPORT';

// Recording mode options
export type RecordingMode = 'DICTATION' | 'AMBIENT' | 'UPLOAD';

// Recording state
export type RecordingState = 'idle' | 'recording' | 'paused' | 'stopped';

export class NewConsultationPage extends BasePage {
  // ============================================
  // Page Sections
  // ============================================
  readonly consultationContextSection: Locator;
  readonly previousMaterialsSection: Locator;
  readonly uploadsSection: Locator;
  readonly recordingSection: Locator;

  // ============================================
  // Patient Selection
  // ============================================
  readonly patientSearchInput: Locator;
  readonly patientSearchResults: Locator;
  readonly selectedPatientDisplay: Locator;
  readonly addNewPatientButton: Locator;
  readonly recentPatientsList: Locator;
  readonly clearPatientButton: Locator;

  // New Patient Dialog
  readonly patientNameInput: Locator;
  readonly patientDobInput: Locator;
  readonly patientMrnInput: Locator;
  readonly savePatientButton: Locator;
  readonly cancelPatientButton: Locator;

  // ============================================
  // Referrer Selection
  // ============================================
  readonly referrerSearchInput: Locator;
  readonly referrerSearchResults: Locator;
  readonly selectedReferrerDisplay: Locator;
  readonly addNewReferrerButton: Locator;
  readonly recentReferrersList: Locator;
  readonly clearReferrerButton: Locator;
  readonly editReferrerButton: Locator;

  // New/Edit Referrer Dialog
  readonly referrerNameInput: Locator;
  readonly referrerPracticeInput: Locator;
  readonly referrerEmailInput: Locator;
  readonly referrerPhoneInput: Locator;
  readonly referrerFaxInput: Locator;
  readonly referrerAddressInput: Locator;
  readonly saveReferrerButton: Locator;

  // ============================================
  // Letter Type Selection
  // ============================================
  readonly letterTypeSelector: Locator;
  readonly newPatientTypeCard: Locator;
  readonly followUpTypeCard: Locator;
  readonly angiogramTypeCard: Locator;
  readonly echoReportTypeCard: Locator;

  // ============================================
  // CC Recipients
  // ============================================
  readonly ccRecipientsInput: Locator;
  readonly ccRecipientsList: Locator;
  readonly addCcRecipientButton: Locator;

  // ============================================
  // Recording Controls
  // ============================================
  readonly recordingModeSelector: Locator;
  readonly dictationModeButton: Locator;
  readonly ambientModeButton: Locator;
  readonly uploadModeButton: Locator;

  readonly startRecordingButton: Locator;
  readonly pauseRecordingButton: Locator;
  readonly resumeRecordingButton: Locator;
  readonly stopRecordingButton: Locator;
  readonly recordingTimer: Locator;
  readonly audioWaveform: Locator;
  readonly audioQualityIndicator: Locator;

  // File Upload (UPLOAD mode)
  readonly fileUploadDropzone: Locator;
  readonly fileUploadInput: Locator;
  readonly uploadProgressBar: Locator;

  // ============================================
  // Template Selection
  // ============================================
  readonly templateSelector: Locator;
  readonly templateDropdown: Locator;

  // ============================================
  // Submit / Generate
  // ============================================
  readonly generateLetterButton: Locator;
  readonly generatingSpinner: Locator;

  constructor(page: Page) {
    super(page);

    // Page sections (collapsible)
    this.consultationContextSection = page.locator('[data-testid="consultation-context"]');
    this.previousMaterialsSection = page.locator('[data-testid="previous-materials"]');
    this.uploadsSection = page.locator('[data-testid="new-uploads"]');
    this.recordingSection = page.locator('[data-testid="recording-section"]');

    // Patient selection
    this.patientSearchInput = page.getByPlaceholder(/search.*patient|name.*dob.*mrn/i);
    this.patientSearchResults = page.locator('[data-testid="patient-search-results"]');
    this.selectedPatientDisplay = page.locator('[data-testid="selected-patient"]');
    this.addNewPatientButton = page.getByRole('button', { name: /add new patient/i });
    this.recentPatientsList = page.locator('[data-testid="recent-patients"]');
    this.clearPatientButton = page.getByRole('button', { name: /clear|remove/i }).first();

    // New patient dialog inputs
    this.patientNameInput = page.getByLabel(/full name|patient name/i);
    this.patientDobInput = page.getByLabel(/date of birth|dob/i);
    this.patientMrnInput = page.getByLabel(/mrn|medical record/i);
    this.savePatientButton = page.getByRole('button', { name: /save|create|add/i });
    this.cancelPatientButton = page.getByRole('button', { name: /cancel/i });

    // Referrer selection
    this.referrerSearchInput = page.getByPlaceholder(/search.*referrer|name.*practice/i);
    this.referrerSearchResults = page.locator('[data-testid="referrer-search-results"]');
    this.selectedReferrerDisplay = page.locator('[data-testid="selected-referrer"]');
    this.addNewReferrerButton = page.getByRole('button', { name: /add new referrer/i });
    this.recentReferrersList = page.locator('[data-testid="recent-referrers"]');
    this.clearReferrerButton = page
      .locator('[data-testid="selected-referrer"]')
      .getByRole('button', { name: /clear|remove/i });
    this.editReferrerButton = page.getByRole('button', { name: /edit/i });

    // Referrer dialog inputs
    this.referrerNameInput = page.getByLabel(/^name$/i);
    this.referrerPracticeInput = page.getByLabel(/practice name/i);
    this.referrerEmailInput = page.getByLabel(/email/i);
    this.referrerPhoneInput = page.getByLabel(/phone/i);
    this.referrerFaxInput = page.getByLabel(/fax/i);
    this.referrerAddressInput = page.getByLabel(/address/i);
    this.saveReferrerButton = page.getByRole('button', { name: /save|add/i });

    // Letter type selection (card-based selector)
    this.letterTypeSelector = page.locator('[data-testid="letter-type-selector"]');
    this.newPatientTypeCard = page.getByRole('button', { name: /new patient/i });
    this.followUpTypeCard = page.getByRole('button', { name: /follow.?up/i });
    this.angiogramTypeCard = page.getByRole('button', { name: /angiogram|procedure/i });
    this.echoReportTypeCard = page.getByRole('button', { name: /echo|report/i });

    // CC recipients
    this.ccRecipientsInput = page.locator('[data-testid="cc-recipients-input"]');
    this.ccRecipientsList = page.locator('[data-testid="cc-recipients-list"]');
    this.addCcRecipientButton = page.getByRole('button', { name: /add cc/i });

    // Recording mode selection
    this.recordingModeSelector = page.locator('[data-testid="recording-mode-selector"]');
    this.dictationModeButton = page.getByRole('button', { name: /dictation/i });
    this.ambientModeButton = page.getByRole('button', { name: /ambient/i });
    this.uploadModeButton = page.getByRole('button', { name: /upload/i });

    // Recording controls
    this.startRecordingButton = page.locator(
      '[data-testid="start-recording"], button:has(svg[class*="mic"])'
    );
    this.pauseRecordingButton = page.getByRole('button', { name: /pause/i });
    this.resumeRecordingButton = page.getByRole('button', { name: /resume|play/i });
    this.stopRecordingButton = page.locator(
      '[data-testid="stop-recording"], button:has(svg[class*="square"])'
    );
    this.recordingTimer = page.locator('[data-testid="recording-timer"]');
    this.audioWaveform = page.locator('[data-testid="audio-waveform"]');
    this.audioQualityIndicator = page.locator('[data-testid="audio-quality"]');

    // File upload
    this.fileUploadDropzone = page.locator('[data-testid="file-dropzone"]');
    this.fileUploadInput = page.locator('input[type="file"]');
    this.uploadProgressBar = page.locator('[data-testid="upload-progress"]');

    // Template
    this.templateSelector = page.locator('[data-testid="template-selector"]');
    this.templateDropdown = page.getByRole('combobox', { name: /template/i });

    // Generate
    this.generateLetterButton = page.getByRole('button', { name: /generate letter/i });
    this.generatingSpinner = page.locator('[data-testid="generating-spinner"]');
  }

  // ============================================
  // Navigation
  // ============================================

  /**
   * Navigate to new consultation page
   */
  async gotoNewConsultation(): Promise<void> {
    await this.goto('/record');
    await this.waitForConsultationPageLoad();
  }

  /**
   * Wait for consultation page to load
   */
  async waitForConsultationPageLoad(): Promise<void> {
    await this.page.waitForURL(/\/record/);
    await this.waitForNetworkIdle();
    // Wait for patient search or recording section to be visible
    await expect(
      this.patientSearchInput.or(this.recordingSection)
    ).toBeVisible({ timeout: 10000 });
  }

  // ============================================
  // Patient Selection
  // ============================================

  /**
   * Search for a patient by name, DOB, or MRN
   * Waits for search results to appear or for network to be idle
   */
  async searchPatient(query: string): Promise<void> {
    await this.patientSearchInput.fill(query);
    // Wait for search results to appear or network to settle
    await Promise.race([
      this.patientSearchResults.waitFor({ state: 'visible', timeout: 5000 }),
      this.waitForNetworkIdle(),
    ]).catch(() => {
      // Results might not appear if no matches - that's okay
    });
  }

  /**
   * Select a patient from search results
   */
  async selectPatient(patientIdentifier: string): Promise<void> {
    await this.searchPatient(patientIdentifier);
    await this.patientSearchResults.getByText(patientIdentifier).click();
    await expect(this.selectedPatientDisplay).toBeVisible();
  }

  /**
   * Select patient by MRN (exact match)
   */
  async selectPatientByMrn(mrn: string): Promise<void> {
    await this.searchPatient(mrn);
    // Wait for search results to be visible with matching MRN
    const patientResult = this.patientSearchResults.filter({ hasText: mrn }).first();
    await patientResult.waitFor({ state: 'visible', timeout: 10000 });
    await patientResult.click();
    await expect(this.selectedPatientDisplay).toBeVisible();
  }

  /**
   * Create a new patient
   */
  async createPatient(data: {
    name: string;
    dateOfBirth: string;
    mrn: string;
  }): Promise<void> {
    await this.addNewPatientButton.click();
    await this.waitForDialogOpen();

    await this.patientNameInput.fill(data.name);
    await this.patientDobInput.fill(data.dateOfBirth);
    await this.patientMrnInput.fill(data.mrn);

    await this.savePatientButton.click();
    await this.waitForDialogClose();
    await expect(this.selectedPatientDisplay).toBeVisible();
  }

  /**
   * Clear selected patient
   */
  async clearPatient(): Promise<void> {
    await this.clearPatientButton.click();
    await expect(this.selectedPatientDisplay).not.toBeVisible();
  }

  /**
   * Get selected patient name
   */
  async getSelectedPatientName(): Promise<string | null> {
    if (await this.selectedPatientDisplay.isVisible()) {
      return await this.selectedPatientDisplay.textContent();
    }
    return null;
  }

  // ============================================
  // Referrer Selection
  // ============================================

  /**
   * Search for a referrer
   * Waits for search results to appear or for network to be idle
   */
  async searchReferrer(query: string): Promise<void> {
    await this.referrerSearchInput.fill(query);
    // Wait for search results to appear or network to settle
    await Promise.race([
      this.referrerSearchResults.waitFor({ state: 'visible', timeout: 5000 }),
      this.waitForNetworkIdle(),
    ]).catch(() => {
      // Results might not appear if no matches - that's okay
    });
  }

  /**
   * Select a referrer from search results
   */
  async selectReferrer(referrerName: string): Promise<void> {
    await this.searchReferrer(referrerName);
    await this.referrerSearchResults.getByText(referrerName).click();
    await expect(this.selectedReferrerDisplay).toBeVisible();
  }

  /**
   * Create a new referrer
   */
  async createReferrer(data: {
    name: string;
    practice: string;
    email?: string;
    phone?: string;
    fax?: string;
    address?: string;
  }): Promise<void> {
    await this.addNewReferrerButton.click();
    await this.waitForDialogOpen();

    await this.referrerNameInput.fill(data.name);
    await this.referrerPracticeInput.fill(data.practice);

    if (data.email) await this.referrerEmailInput.fill(data.email);
    if (data.phone) await this.referrerPhoneInput.fill(data.phone);
    if (data.fax) await this.referrerFaxInput.fill(data.fax);
    if (data.address) await this.referrerAddressInput.fill(data.address);

    await this.saveReferrerButton.click();
    await this.waitForDialogClose();
    await expect(this.selectedReferrerDisplay).toBeVisible();
  }

  // ============================================
  // Letter Type Selection
  // ============================================

  /**
   * Select letter type
   */
  async selectLetterType(type: LetterType): Promise<void> {
    const typeCards: Record<LetterType, Locator> = {
      NEW_PATIENT: this.newPatientTypeCard,
      FOLLOW_UP: this.followUpTypeCard,
      ANGIOGRAM_PROCEDURE: this.angiogramTypeCard,
      ECHO_REPORT: this.echoReportTypeCard,
    };

    await typeCards[type].click();
  }

  /**
   * Get currently selected letter type
   */
  async getSelectedLetterType(): Promise<LetterType | null> {
    // Selected card typically has aria-pressed="true" or specific class
    const typeCards = [
      { type: 'NEW_PATIENT' as LetterType, locator: this.newPatientTypeCard },
      { type: 'FOLLOW_UP' as LetterType, locator: this.followUpTypeCard },
      { type: 'ANGIOGRAM_PROCEDURE' as LetterType, locator: this.angiogramTypeCard },
      { type: 'ECHO_REPORT' as LetterType, locator: this.echoReportTypeCard },
    ];

    for (const { type, locator } of typeCards) {
      const isSelected =
        (await locator.getAttribute('aria-pressed')) === 'true' ||
        (await locator.getAttribute('data-state')) === 'on';
      if (isSelected) return type;
    }

    return null;
  }

  // ============================================
  // Recording
  // ============================================

  /**
   * Select recording mode
   */
  async selectRecordingMode(mode: RecordingMode): Promise<void> {
    const modeButtons: Record<RecordingMode, Locator> = {
      DICTATION: this.dictationModeButton,
      AMBIENT: this.ambientModeButton,
      UPLOAD: this.uploadModeButton,
    };

    await modeButtons[mode].click();
  }

  /**
   * Start recording
   */
  async startRecording(): Promise<void> {
    await this.startRecordingButton.click();
    // Wait for recording to start
    await expect(this.stopRecordingButton.or(this.pauseRecordingButton)).toBeVisible({
      timeout: 5000,
    });
  }

  /**
   * Pause recording
   */
  async pauseRecording(): Promise<void> {
    await this.pauseRecordingButton.click();
    await expect(this.resumeRecordingButton).toBeVisible();
  }

  /**
   * Resume recording
   */
  async resumeRecording(): Promise<void> {
    await this.resumeRecordingButton.click();
    await expect(this.pauseRecordingButton).toBeVisible();
  }

  /**
   * Stop recording
   */
  async stopRecording(): Promise<void> {
    await this.stopRecordingButton.click();
  }

  /**
   * Get current recording time (formatted as MM:SS)
   */
  async getRecordingTime(): Promise<string> {
    return (await this.recordingTimer.textContent()) ?? '00:00';
  }

  /**
   * Upload audio file (UPLOAD mode)
   */
  async uploadAudioFile(filePath: string): Promise<void> {
    await this.selectRecordingMode('UPLOAD');
    await this.fileUploadInput.setInputFiles(filePath);
    // Wait for upload to complete
    await this.waitForNetworkIdle();
  }

  // ============================================
  // Letter Generation
  // ============================================

  /**
   * Generate letter (triggers AI generation)
   */
  async generateLetter(): Promise<void> {
    await this.generateLetterButton.click();
  }

  /**
   * Wait for letter generation to complete
   */
  async waitForLetterGeneration(timeout = 60000): Promise<void> {
    // Wait for generating spinner to appear and then disappear
    await this.generatingSpinner.waitFor({ state: 'visible', timeout: 5000 }).catch(() => {
      // Spinner might not appear if generation is very fast
    });
    await this.generatingSpinner.waitFor({ state: 'hidden', timeout });

    // Should redirect to letter detail page
    await this.page.waitForURL(/\/letters\/.+/, { timeout: 10000 });
  }

  /**
   * Generate letter and wait for completion
   */
  async generateLetterAndWait(timeout = 60000): Promise<void> {
    await this.generateLetter();
    await this.waitForLetterGeneration(timeout);
  }

  // ============================================
  // Clinical Context Form (Combined workflow)
  // ============================================

  /**
   * Fill complete clinical context for new consultation
   */
  async fillClinicalContext(data: {
    patientMrn: string;
    referrerName?: string;
    letterType?: LetterType;
  }): Promise<void> {
    // Select patient
    await this.selectPatientByMrn(data.patientMrn);

    // Select referrer if provided
    if (data.referrerName) {
      await this.selectReferrer(data.referrerName);
    }

    // Select letter type
    if (data.letterType) {
      await this.selectLetterType(data.letterType);
    }
  }

  // ============================================
  // Assertions
  // ============================================

  /**
   * Assert patient is selected
   */
  async expectPatientSelected(patientName?: string): Promise<void> {
    await expect(this.selectedPatientDisplay).toBeVisible();
    if (patientName) {
      await expect(this.selectedPatientDisplay).toContainText(patientName);
    }
  }

  /**
   * Assert referrer is selected
   */
  async expectReferrerSelected(referrerName?: string): Promise<void> {
    await expect(this.selectedReferrerDisplay).toBeVisible();
    if (referrerName) {
      await expect(this.selectedReferrerDisplay).toContainText(referrerName);
    }
  }

  /**
   * Assert recording is in progress
   */
  async expectRecordingInProgress(): Promise<void> {
    await expect(this.stopRecordingButton.or(this.pauseRecordingButton)).toBeVisible();
  }

  /**
   * Assert form validation error
   */
  async expectValidationError(field: string): Promise<void> {
    const errorLocator = this.page.locator(`[data-testid="${field}-error"], .error`).filter({
      hasText: new RegExp(field, 'i'),
    });
    await expect(errorLocator).toBeVisible();
  }

  /**
   * Assert generate button is enabled
   */
  async expectCanGenerateLetter(): Promise<void> {
    await expect(this.generateLetterButton).toBeEnabled();
  }

  /**
   * Assert generate button is disabled (missing required fields)
   */
  async expectCannotGenerateLetter(): Promise<void> {
    await expect(this.generateLetterButton).toBeDisabled();
  }
}
