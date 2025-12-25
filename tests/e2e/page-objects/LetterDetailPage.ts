// tests/e2e/page-objects/LetterDetailPage.ts
// Page object for letter detail, editing, verification, and sending

import { Page, Locator, expect } from '@playwright/test';
import { BasePage } from './BasePage';

// Letter status types
export type LetterStatus = 'draft' | 'pending_review' | 'approved' | 'sent' | 'failed';

// Send dialog step
export type SendDialogStep = 'recipients' | 'message' | 'confirm' | 'sending' | 'result';

// Recipient for sending
export interface LetterRecipient {
  name: string;
  email: string;
  type?: 'GP' | 'SPECIALIST' | 'PATIENT' | 'OTHER';
}

export class LetterDetailPage extends BasePage {
  // ============================================
  // Letter Header / Metadata
  // ============================================
  readonly letterHeader: Locator;
  readonly letterTitle: Locator;
  readonly letterStatus: Locator;
  readonly patientName: Locator;
  readonly letterDate: Locator;
  readonly letterType: Locator;

  // ============================================
  // Letter Editor (uses existing data-testids)
  // ============================================
  readonly letterEditor: Locator;
  readonly editorContent: Locator;
  readonly undoButton: Locator;
  readonly redoButton: Locator;
  readonly saveButton: Locator;
  readonly autoSaveIndicator: Locator;
  readonly lastSavedTimestamp: Locator;
  readonly saveError: Locator;
  readonly readingStats: Locator;
  readonly readonlyIndicator: Locator;

  // ============================================
  // Verification Panel (uses existing data-testids)
  // ============================================
  readonly verificationPanel: Locator;
  readonly verifyAllButton: Locator;
  readonly dismissFlagDialog: Locator;
  readonly dismissReasonInput: Locator;
  readonly confirmDismissButton: Locator;

  // ============================================
  // Source Panel (uses existing data-testids)
  // ============================================
  readonly sourcePanel: Locator;
  readonly sourcePanelContent: Locator;
  readonly closeSourcePanel: Locator;
  readonly sourceExcerpt: Locator;
  readonly viewFullSourceButton: Locator;

  // ============================================
  // Differential View (uses existing data-testids)
  // ============================================
  readonly differentialView: Locator;
  readonly diffStats: Locator;
  readonly viewModeToggle: Locator;
  readonly sideBySideButton: Locator;
  readonly unifiedButton: Locator;
  readonly revertAllButton: Locator;
  readonly acceptAllButton: Locator;

  // ============================================
  // Action Buttons
  // ============================================
  readonly approveButton: Locator;
  readonly rejectButton: Locator;
  readonly sendLetterButton: Locator;
  readonly downloadPdfButton: Locator;
  readonly deleteButton: Locator;
  readonly editButton: Locator;
  readonly regenerateButton: Locator;

  // ============================================
  // Send Letter Dialog
  // ============================================
  readonly sendDialog: Locator;
  readonly recipientsList: Locator;
  readonly sendToMyselfCheckbox: Locator;
  readonly addRecipientButton: Locator;
  readonly oneOffNameInput: Locator;
  readonly oneOffEmailInput: Locator;
  readonly subjectInput: Locator;
  readonly coverNoteInput: Locator;
  readonly sendDialogNextButton: Locator;
  readonly sendDialogBackButton: Locator;
  readonly sendDialogSendButton: Locator;
  readonly sendingSpinner: Locator;
  readonly sendSuccessMessage: Locator;
  readonly sendErrorMessage: Locator;

  // ============================================
  // Send History
  // ============================================
  readonly sendHistoryButton: Locator;
  readonly sendHistoryPanel: Locator;
  readonly sendHistoryList: Locator;

  constructor(page: Page) {
    super(page);

    // Header / Metadata
    this.letterHeader = page.locator('[data-testid="letter-header"]');
    this.letterTitle = page.locator('[data-testid="letter-title"]');
    this.letterStatus = page.locator('[data-testid="letter-status"]');
    this.patientName = page.locator('[data-testid="letter-patient-name"]');
    this.letterDate = page.locator('[data-testid="letter-date"]');
    this.letterType = page.locator('[data-testid="letter-type"]');

    // Letter Editor (existing data-testids from LetterEditor.tsx)
    this.letterEditor = page.getByTestId('letter-editor');
    this.editorContent = page.getByTestId('editor-content');
    this.undoButton = page.getByTestId('undo-button');
    this.redoButton = page.getByTestId('redo-button');
    this.saveButton = page.getByTestId('save-button');
    this.autoSaveIndicator = page.getByTestId('auto-save-indicator');
    this.lastSavedTimestamp = page.getByTestId('last-saved');
    this.saveError = page.getByTestId('save-error');
    this.readingStats = page.getByTestId('reading-stats');
    this.readonlyIndicator = page.getByTestId('readonly-indicator');

    // Verification Panel (existing data-testids from VerificationPanel.tsx)
    this.verificationPanel = page.getByTestId('verification-panel');
    this.verifyAllButton = page.getByTestId('verify-all-button');
    this.dismissFlagDialog = page.getByTestId('dismiss-flag-dialog');
    this.dismissReasonInput = page.getByTestId('dismiss-reason-input');
    this.confirmDismissButton = page.getByTestId('confirm-dismiss-button');

    // Source Panel (existing data-testids from SourcePanel.tsx)
    this.sourcePanel = page.getByTestId('source-panel');
    this.sourcePanelContent = page.getByTestId('source-panel-content');
    this.closeSourcePanel = page.getByTestId('close-source-panel');
    this.sourceExcerpt = page.getByTestId('source-excerpt');
    this.viewFullSourceButton = page.getByTestId('view-full-source-button');

    // Differential View (existing data-testids from DifferentialView.tsx)
    this.differentialView = page.getByTestId('differential-view');
    this.diffStats = page.getByTestId('diff-stats');
    this.viewModeToggle = page.getByTestId('view-mode-toggle');
    this.sideBySideButton = page.getByTestId('view-mode-side-by-side');
    this.unifiedButton = page.getByTestId('view-mode-unified');
    this.revertAllButton = page.getByTestId('revert-all-button');
    this.acceptAllButton = page.getByTestId('accept-all-button');

    // Action buttons
    this.approveButton = page.getByRole('button', { name: /approve/i });
    this.rejectButton = page.getByRole('button', { name: /reject/i });
    this.sendLetterButton = page.getByRole('button', { name: /send letter/i });
    this.downloadPdfButton = page.getByRole('button', { name: /download|pdf/i });
    this.deleteButton = page.getByRole('button', { name: /delete/i });
    this.editButton = page.getByRole('button', { name: /edit/i });
    this.regenerateButton = page.getByRole('button', { name: /regenerate/i });

    // Send Letter Dialog
    this.sendDialog = page.getByRole('dialog').filter({ hasText: /send|recipients/i });
    this.recipientsList = page.locator('[data-testid="recipients-list"]');
    this.sendToMyselfCheckbox = page.getByLabel(/send.*copy.*myself|cc.*myself/i);
    this.addRecipientButton = page.getByRole('button', { name: /add recipient/i });
    this.oneOffNameInput = page.getByLabel(/^name$/i);
    this.oneOffEmailInput = page.getByLabel(/email/i);
    this.subjectInput = page.getByLabel(/subject/i);
    this.coverNoteInput = page.getByLabel(/cover note|message|body/i);
    this.sendDialogNextButton = page.getByRole('button', { name: /next|continue/i });
    this.sendDialogBackButton = page.getByRole('button', { name: /back/i });
    this.sendDialogSendButton = page.getByRole('button', { name: /^send$/i });
    this.sendingSpinner = page.locator('[data-testid="sending-spinner"]');
    this.sendSuccessMessage = page.getByText(/sent successfully|letter sent/i);
    this.sendErrorMessage = page.getByText(/failed to send|error sending/i);

    // Send History
    this.sendHistoryButton = page.getByRole('button', { name: /history|sends/i });
    this.sendHistoryPanel = page.locator('[data-testid="send-history-panel"]');
    this.sendHistoryList = page.locator('[data-testid="send-history-list"]');
  }

  // ============================================
  // Navigation
  // ============================================

  /**
   * Navigate to a specific letter by ID
   */
  async gotoLetter(letterId: string): Promise<void> {
    await this.goto(`/letters/${letterId}`);
    await this.waitForLetterLoad();
  }

  /**
   * Wait for letter page to fully load
   */
  async waitForLetterLoad(): Promise<void> {
    await this.page.waitForURL(/\/letters\/.+/);
    await this.waitForNetworkIdle();
    // Wait for editor or letter content to be visible
    await expect(this.letterEditor.or(this.editorContent)).toBeVisible({ timeout: 10000 });
  }

  // ============================================
  // Letter Content
  // ============================================

  /**
   * Get the letter content text
   */
  async getLetterContent(): Promise<string> {
    return (await this.editorContent.textContent()) ?? '';
  }

  /**
   * Edit the letter content
   */
  async editLetter(content: string): Promise<void> {
    await this.editorContent.click();
    await this.editorContent.fill(content);
  }

  /**
   * Append text to the letter
   */
  async appendToLetter(text: string): Promise<void> {
    await this.editorContent.click();
    await this.page.keyboard.press('End');
    await this.page.keyboard.type(text);
  }

  /**
   * Save letter manually
   */
  async saveLetter(): Promise<void> {
    await this.saveButton.click();
    await this.waitForNetworkIdle();
    // Wait for save confirmation
    await expect(this.lastSavedTimestamp).toBeVisible();
  }

  /**
   * Undo last change
   */
  async undo(): Promise<void> {
    await this.undoButton.click();
  }

  /**
   * Redo last undone change
   */
  async redo(): Promise<void> {
    await this.redoButton.click();
  }

  /**
   * Get word count from reading stats
   */
  async getWordCount(): Promise<number> {
    const statsText = (await this.readingStats.textContent()) ?? '';
    const match = statsText.match(/(\d+)\s*words?/i);
    return match && match[1] ? parseInt(match[1], 10) : 0;
  }

  // ============================================
  // Verification
  // ============================================

  /**
   * Get a value card by ID
   */
  getValueCard(id: string): Locator {
    return this.page.getByTestId(`value-card-${id}`);
  }

  /**
   * Verify a specific value
   */
  async verifyValue(id: string): Promise<void> {
    const checkbox = this.page.getByTestId(`verify-checkbox-${id}`);
    await checkbox.check();
  }

  /**
   * Verify all values
   */
  async verifyAll(): Promise<void> {
    await this.verifyAllButton.click();
  }

  /**
   * View source for a value
   */
  async viewSource(id: string): Promise<void> {
    await this.page.getByTestId(`view-source-${id}`).click();
    await expect(this.sourcePanel).toBeVisible();
  }

  /**
   * Close source panel
   */
  async closeSource(): Promise<void> {
    await this.closeSourcePanel.click();
    await expect(this.sourcePanel).not.toBeVisible();
  }

  /**
   * Get a flag card by ID
   */
  getFlagCard(id: string): Locator {
    return this.page.getByTestId(`flag-card-${id}`);
  }

  /**
   * Dismiss a hallucination flag
   */
  async dismissFlag(id: string, reason: string): Promise<void> {
    await this.page.getByTestId(`dismiss-flag-${id}`).click();
    await expect(this.dismissFlagDialog).toBeVisible();
    await this.dismissReasonInput.fill(reason);
    await this.confirmDismissButton.click();
    await expect(this.dismissFlagDialog).not.toBeVisible();
  }

  // ============================================
  // Differential View
  // ============================================

  /**
   * Switch to side-by-side diff view
   */
  async switchToSideBySideView(): Promise<void> {
    await this.sideBySideButton.click();
  }

  /**
   * Switch to unified diff view
   */
  async switchToUnifiedView(): Promise<void> {
    await this.unifiedButton.click();
  }

  /**
   * Accept all changes
   */
  async acceptAllChanges(): Promise<void> {
    await this.acceptAllButton.click();
  }

  /**
   * Revert all changes
   */
  async revertAllChanges(): Promise<void> {
    await this.revertAllButton.click();
  }

  // ============================================
  // Letter Actions
  // ============================================

  /**
   * Approve the letter
   */
  async approveLetter(): Promise<void> {
    await this.approveButton.click();
    await this.waitForNetworkIdle();
    await this.expectToast(/approved/i);
  }

  /**
   * Reject the letter
   */
  async rejectLetter(): Promise<void> {
    await this.rejectButton.click();
    await this.waitForNetworkIdle();
  }

  /**
   * Open the send letter dialog
   */
  async openSendDialog(): Promise<void> {
    await this.sendLetterButton.click();
    await expect(this.sendDialog).toBeVisible();
  }

  /**
   * Download letter as PDF
   */
  async downloadPdf(): Promise<void> {
    // Start waiting for download before clicking
    const downloadPromise = this.page.waitForEvent('download');
    await this.downloadPdfButton.click();
    await downloadPromise;
  }

  /**
   * Delete the letter
   */
  async deleteLetter(): Promise<void> {
    await this.deleteButton.click();
    // Confirm deletion dialog
    const confirmButton = this.page.getByRole('button', { name: /confirm|delete|yes/i });
    await confirmButton.click();
    await this.page.waitForURL(/\/letters(?!\/)/, { timeout: 10000 });
  }

  /**
   * Regenerate the letter
   */
  async regenerateLetter(): Promise<void> {
    await this.regenerateButton.click();
    await this.waitForNetworkIdle();
  }

  // ============================================
  // Send Letter Dialog
  // ============================================

  /**
   * Select a recipient by name in send dialog
   */
  async selectRecipient(recipientName: string): Promise<void> {
    const recipientCard = this.recipientsList.filter({ hasText: recipientName });
    await recipientCard.click();
  }

  /**
   * Add a one-off recipient
   */
  async addOneOffRecipient(name: string, email: string): Promise<void> {
    await this.addRecipientButton.click();
    await this.oneOffNameInput.fill(name);
    await this.oneOffEmailInput.fill(email);
    // Submit the one-off form
    await this.page.getByRole('button', { name: /add/i }).click();
  }

  /**
   * Toggle send copy to myself
   */
  async toggleSendToMyself(checked: boolean): Promise<void> {
    if (checked) {
      await this.sendToMyselfCheckbox.check();
    } else {
      await this.sendToMyselfCheckbox.uncheck();
    }
  }

  /**
   * Fill subject line
   */
  async fillSubject(subject: string): Promise<void> {
    await this.subjectInput.fill(subject);
  }

  /**
   * Fill cover note
   */
  async fillCoverNote(note: string): Promise<void> {
    await this.coverNoteInput.fill(note);
  }

  /**
   * Proceed to next step in send dialog
   */
  async nextStep(): Promise<void> {
    await this.sendDialogNextButton.click();
  }

  /**
   * Go back in send dialog
   */
  async previousStep(): Promise<void> {
    await this.sendDialogBackButton.click();
  }

  /**
   * Send the letter
   */
  async confirmSend(): Promise<void> {
    await this.sendDialogSendButton.click();
    // Wait for sending to complete
    await expect(this.sendSuccessMessage.or(this.sendErrorMessage)).toBeVisible({
      timeout: 30000,
    });
  }

  /**
   * Complete send flow to multiple recipients
   */
  async sendToRecipients(recipients: LetterRecipient[]): Promise<void> {
    await this.openSendDialog();

    // Select recipients
    for (const recipient of recipients) {
      // Try to find existing recipient first
      const existingRecipient = this.recipientsList.filter({ hasText: recipient.name });
      if (await existingRecipient.isVisible()) {
        await existingRecipient.click();
      } else {
        // Add as one-off recipient
        await this.addOneOffRecipient(recipient.name, recipient.email);
      }
    }

    // Proceed to message step
    await this.nextStep();

    // Fill subject
    await this.fillSubject('Cardiology Consultation Letter');

    // Proceed to confirm step
    await this.nextStep();

    // Confirm and send
    await this.confirmSend();
  }

  // ============================================
  // Send History
  // ============================================

  /**
   * Open send history panel
   */
  async openSendHistory(): Promise<void> {
    await this.sendHistoryButton.click();
    await expect(this.sendHistoryPanel).toBeVisible();
  }

  /**
   * Get send history entries
   */
  async getSendHistory(): Promise<
    { recipient: string; status: string; date: string }[]
  > {
    const entries: { recipient: string; status: string; date: string }[] = [];

    const items = this.sendHistoryList.locator('[data-testid^="send-history-item-"]');
    const count = await items.count();

    for (let i = 0; i < count; i++) {
      const item = items.nth(i);
      entries.push({
        recipient: (await item.locator('[data-testid="send-recipient"]').textContent()) ?? '',
        status: (await item.locator('[data-testid="send-status"]').textContent()) ?? '',
        date: (await item.locator('[data-testid="send-date"]').textContent()) ?? '',
      });
    }

    return entries;
  }

  // ============================================
  // Assertions
  // ============================================

  /**
   * Assert letter is loaded
   */
  async expectLetterVisible(): Promise<void> {
    await expect(this.letterEditor.or(this.editorContent)).toBeVisible();
  }

  /**
   * Assert letter status
   */
  async expectStatus(status: LetterStatus): Promise<void> {
    await expect(this.letterStatus).toContainText(new RegExp(status, 'i'));
  }

  /**
   * Assert letter is editable
   */
  async expectEditable(): Promise<void> {
    await expect(this.readonlyIndicator).not.toBeVisible();
    await expect(this.editorContent).toHaveAttribute('contenteditable', 'true');
  }

  /**
   * Assert letter is read-only
   */
  async expectReadOnly(): Promise<void> {
    await expect(this.readonlyIndicator).toBeVisible();
  }

  /**
   * Assert send was successful
   */
  async expectSendSuccess(): Promise<void> {
    await expect(this.sendSuccessMessage).toBeVisible();
  }

  /**
   * Assert send failed
   */
  async expectSendFailure(): Promise<void> {
    await expect(this.sendErrorMessage).toBeVisible();
  }

  /**
   * Assert letter contains text
   */
  async expectLetterContains(text: string | RegExp): Promise<void> {
    await expect(this.editorContent).toContainText(text);
  }

  /**
   * Assert verification panel has items
   */
  async expectVerificationItems(minCount = 1): Promise<void> {
    await expect(this.verificationPanel).toBeVisible();
    const items = this.verificationPanel.locator('[data-testid^="value-card-"]');
    await expect(items).toHaveCount({ minimum: minCount } as unknown as number);
  }

  /**
   * Assert all values are verified
   */
  async expectAllVerified(): Promise<void> {
    const unchecked = this.verificationPanel.locator(
      'input[type="checkbox"]:not(:checked)'
    );
    await expect(unchecked).toHaveCount(0);
  }
}
