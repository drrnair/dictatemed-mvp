// tests/e2e/page-objects/DashboardPage.ts
// Page object for main dashboard and navigation

import { Page, Locator, expect } from '@playwright/test';
import { BasePage } from './BasePage';

export class DashboardPage extends BasePage {
  // Navigation sidebar
  readonly sidebar: Locator;
  readonly navDashboard: Locator;
  readonly navRecord: Locator;
  readonly navLetters: Locator;
  readonly navSettings: Locator;
  readonly logo: Locator;

  // Hero/action cards
  readonly startRecordingCard: Locator;
  readonly draftLettersCard: Locator;
  readonly allLettersCard: Locator;

  // Stats cards
  readonly timeSavedStat: Locator;
  readonly lettersTodayStat: Locator;
  readonly pendingReviewStat: Locator;
  readonly thisMonthStat: Locator;

  // Recent activity
  readonly recentActivitySection: Locator;
  readonly recentLettersList: Locator;
  readonly emptyStateMessage: Locator;

  // Greeting
  readonly greetingText: Locator;

  constructor(page: Page) {
    super(page);

    // Sidebar navigation
    this.sidebar = page.locator('nav, aside').filter({ hasText: /dashboard/i });
    this.navDashboard = page.getByRole('link', { name: /dashboard/i });
    this.navRecord = page.getByRole('link', { name: /record/i });
    this.navLetters = page.getByRole('link', { name: /letters/i });
    this.navSettings = page.getByRole('link', { name: /settings/i });
    this.logo = page.getByText('DictateMED');

    // Hero action cards (links or buttons to key actions)
    this.startRecordingCard = page.getByRole('link', { name: /start recording/i });
    this.draftLettersCard = page.getByRole('link', { name: /draft letters/i });
    this.allLettersCard = page.getByRole('link', { name: /all letters/i });

    // Stats cards (typically text elements with numbers)
    this.timeSavedStat = page.getByText(/time saved/i).locator('..');
    this.lettersTodayStat = page.getByText(/letters today/i).locator('..');
    this.pendingReviewStat = page.getByText(/pending review/i).locator('..');
    this.thisMonthStat = page.getByText(/this month/i).locator('..');

    // Recent activity section
    this.recentActivitySection = page.getByText(/recent activity/i).locator('..');
    this.recentLettersList = page.locator('[data-testid="recent-letters"]');
    this.emptyStateMessage = page.getByText(/no recent letters|start your first/i);

    // Greeting (time-aware)
    this.greetingText = page.getByText(/good (morning|afternoon|evening)/i);
  }

  // ============================================
  // Navigation
  // ============================================

  /**
   * Navigate to dashboard
   */
  async gotoDashboard(): Promise<void> {
    await this.goto('/dashboard');
    await this.waitForDashboardLoad();
  }

  /**
   * Wait for dashboard to fully load
   */
  async waitForDashboardLoad(): Promise<void> {
    await this.page.waitForURL(/\/dashboard/);
    await this.waitForNetworkIdle();
    // Wait for main content to be visible
    await expect(this.greetingText.or(this.startRecordingCard)).toBeVisible({
      timeout: 10000,
    });
  }

  /**
   * Navigate to new consultation (record page)
   */
  async navigateToNewConsultation(): Promise<void> {
    await this.startRecordingCard.click();
    await this.page.waitForURL(/\/record/);
  }

  /**
   * Navigate to letters list
   */
  async navigateToLetters(): Promise<void> {
    await this.navLetters.click();
    await this.page.waitForURL(/\/letters/);
  }

  /**
   * Navigate to draft letters
   */
  async navigateToDraftLetters(): Promise<void> {
    await this.draftLettersCard.click();
    await this.page.waitForURL(/\/letters\?status=draft/);
  }

  /**
   * Navigate to settings
   */
  async navigateToSettings(): Promise<void> {
    await this.navSettings.click();
    await this.page.waitForURL(/\/settings/);
  }

  /**
   * Navigate to record page via sidebar
   */
  async navigateToRecord(): Promise<void> {
    await this.navRecord.click();
    await this.page.waitForURL(/\/record/);
  }

  // ============================================
  // Dashboard Stats
  // ============================================

  /**
   * Get the value of a stat card
   */
  async getStatValue(
    stat: 'timeSaved' | 'lettersToday' | 'pendingReview' | 'thisMonth'
  ): Promise<string> {
    const statLocators = {
      timeSaved: this.timeSavedStat,
      lettersToday: this.lettersTodayStat,
      pendingReview: this.pendingReviewStat,
      thisMonth: this.thisMonthStat,
    };

    const statElement = statLocators[stat];
    // Stats typically show numbers - look for a numeric value
    const valueElement = statElement.locator('text=/\\d+/');
    return (await valueElement.textContent()) ?? '0';
  }

  // ============================================
  // Recent Letters
  // ============================================

  /**
   * Get list of recent letters
   */
  async getRecentLetters(): Promise<{ patient: string; date: string; status: string }[]> {
    const letters: { patient: string; date: string; status: string }[] = [];

    // Check if there are any recent letters
    const hasLetters = await this.recentLettersList.isVisible();
    if (!hasLetters) {
      return letters;
    }

    const letterItems = this.recentLettersList.locator('[data-testid^="letter-item-"]');
    const count = await letterItems.count();

    for (let i = 0; i < count; i++) {
      const item = letterItems.nth(i);
      letters.push({
        patient: (await item.locator('[data-testid="letter-patient"]').textContent()) ?? '',
        date: (await item.locator('[data-testid="letter-date"]').textContent()) ?? '',
        status: (await item.locator('[data-testid="letter-status"]').textContent()) ?? '',
      });
    }

    return letters;
  }

  /**
   * Click on a recent letter by patient name
   */
  async openRecentLetter(patientName: string): Promise<void> {
    await this.recentLettersList.getByText(patientName).click();
    await this.page.waitForURL(/\/letters\/.+/);
  }

  // ============================================
  // Patient Search
  // ============================================

  /**
   * Search for a patient from dashboard (if search is available)
   */
  async searchPatient(query: string): Promise<void> {
    const searchInput = this.page.getByPlaceholder(/search patient/i);
    if (await searchInput.isVisible()) {
      await searchInput.fill(query);
      await this.page.keyboard.press('Enter');
    } else {
      // Navigate to record page which has patient search
      await this.navigateToNewConsultation();
    }
  }

  // ============================================
  // Assertions
  // ============================================

  /**
   * Assert dashboard is loaded and visible
   */
  async expectDashboardVisible(): Promise<void> {
    await expect(this.greetingText.or(this.startRecordingCard)).toBeVisible();
    await this.assertUrl(/\/dashboard/);
  }

  /**
   * Assert correct greeting based on time of day
   */
  async expectCorrectGreeting(): Promise<void> {
    const hour = new Date().getHours();
    let expectedGreeting: RegExp;

    if (hour < 12) {
      expectedGreeting = /good morning/i;
    } else if (hour < 18) {
      expectedGreeting = /good afternoon/i;
    } else {
      expectedGreeting = /good evening/i;
    }

    await expect(this.page.getByText(expectedGreeting)).toBeVisible();
  }

  /**
   * Assert empty state is shown (no recent letters)
   */
  async expectEmptyState(): Promise<void> {
    await expect(this.emptyStateMessage).toBeVisible();
  }

  /**
   * Assert recent letters are visible
   */
  async expectRecentLettersVisible(minCount = 1): Promise<void> {
    const letters = await this.getRecentLetters();
    expect(letters.length).toBeGreaterThanOrEqual(minCount);
  }

  /**
   * Assert navigation sidebar is visible
   */
  async expectNavigationVisible(): Promise<void> {
    await expect(this.navDashboard).toBeVisible();
    await expect(this.navRecord).toBeVisible();
    await expect(this.navLetters).toBeVisible();
    await expect(this.navSettings).toBeVisible();
  }

  /**
   * Assert all quick action cards are visible
   */
  async expectQuickActionsVisible(): Promise<void> {
    await expect(this.startRecordingCard).toBeVisible();
    await expect(this.draftLettersCard.or(this.allLettersCard)).toBeVisible();
  }
}
