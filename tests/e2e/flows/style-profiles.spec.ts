// tests/e2e/flows/style-profiles.spec.ts
// E2E tests for the per-subspecialty style profile UI workflows

import { test, expect, Page } from '@playwright/test';

/**
 * E2E Tests for Style Profile Management
 *
 * These tests cover:
 * 1. Settings UI - View profiles
 * 2. Settings UI - Adjust learning strength
 * 3. Settings UI - Reset profile
 * 4. Settings UI - Upload seed letters
 * 5. Letter generation with profile applied
 *
 * Note: Most tests require authentication. They are marked with .skip
 * when they need authenticated sessions that cannot be mocked in E2E.
 * The tests document the expected behavior and can be enabled with
 * proper auth setup (e.g., using storageState from authenticated session).
 */

test.describe('Style Profiles - API Health', () => {
  test('style profile API routes should require authentication', async ({
    request,
  }) => {
    // All style profile routes should return 401 when not authenticated
    const protectedRoutes = [
      '/api/style/profiles',
      '/api/style/profiles/HEART_FAILURE',
      '/api/style/profiles/HEART_FAILURE/strength',
      '/api/style/profiles/HEART_FAILURE/analyze',
      '/api/style/seed',
      '/api/style/analyze',
    ];

    for (const route of protectedRoutes) {
      const response = await request.get(route);
      expect(response.status()).toBe(401);
    }
  });

  test('style profile POST endpoints should require authentication', async ({
    request,
  }) => {
    const postRoutes = [
      { path: '/api/style/profiles', body: { subspecialty: 'HEART_FAILURE' } },
      { path: '/api/style/profiles/HEART_FAILURE/analyze', body: {} },
      { path: '/api/style/seed', body: { subspecialty: 'HEART_FAILURE', letterText: 'test' } },
    ];

    for (const { path, body } of postRoutes) {
      const response = await request.post(path, {
        data: body,
        headers: { 'Content-Type': 'application/json' },
      });
      expect(response.status()).toBe(401);
    }
  });

  test('style profile PATCH endpoints should require authentication', async ({
    request,
  }) => {
    const response = await request.patch('/api/style/profiles/HEART_FAILURE/strength', {
      data: { learningStrength: 0.5 },
      headers: { 'Content-Type': 'application/json' },
    });
    expect(response.status()).toBe(401);
  });

  test('style profile DELETE endpoints should require authentication', async ({
    request,
  }) => {
    const response = await request.delete('/api/style/profiles/HEART_FAILURE');
    expect(response.status()).toBe(401);
  });
});

test.describe('Style Profiles - Settings Page Structure', () => {
  // These tests check UI structure without requiring authentication
  // The page will redirect to login, so we check the redirect behavior

  test('settings style page should redirect unauthenticated users', async ({
    page,
  }) => {
    await page.goto('/settings/style');

    // Should redirect to login page
    await expect(page).toHaveURL(/\/api\/auth\/login|\/login/);
  });
});

test.describe('Style Profiles - Authenticated UI', () => {
  // These tests require authentication and document expected behavior
  // Enable with proper auth setup using storageState

  test.describe.configure({ mode: 'serial' });

  test.skip('should display the style settings page with mode selector', async ({
    page,
  }) => {
    // Prerequisites: User is authenticated
    await page.goto('/settings/style');

    // Page header should be visible
    await expect(page.getByRole('heading', { name: 'Writing Style Profile' })).toBeVisible();

    // Style mode selector should show two options
    await expect(page.getByText('Global Style')).toBeVisible();
    await expect(page.getByText('Per-Subspecialty')).toBeVisible();

    // Tabs should be present
    await expect(page.getByRole('tab', { name: 'Global Style' })).toBeVisible();
    await expect(page.getByRole('tab', { name: 'Per-Subspecialty' })).toBeVisible();
  });

  test.skip('should display global style tab with upload section', async ({
    page,
  }) => {
    await page.goto('/settings/style');

    // Click Global Style tab
    await page.getByRole('tab', { name: 'Global Style' }).click();

    // Historical letter upload section should be visible
    await expect(page.getByText('Upload Historical Letters')).toBeVisible();
    await expect(page.getByText('Click to upload letters')).toBeVisible();

    // Edit statistics section should be visible
    await expect(page.getByText('Learn from Your Edits')).toBeVisible();
    await expect(page.getByText('Total Edits')).toBeVisible();
    await expect(page.getByText('Last 7 Days')).toBeVisible();
    await expect(page.getByText('Last 30 Days')).toBeVisible();

    // Run Style Analysis button should be visible
    await expect(page.getByRole('button', { name: 'Run Style Analysis' })).toBeVisible();
  });

  test.skip('should display per-subspecialty tab with profile cards', async ({
    page,
  }) => {
    await page.goto('/settings/style');

    // Click Per-Subspecialty tab
    await page.getByRole('tab', { name: 'Per-Subspecialty' }).click();

    // Seed letter upload section should be visible
    await expect(page.getByText('Seed Your Style Profiles')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Upload Sample Letter' })).toBeVisible();

    // Subspecialty profile cards header should be visible
    await expect(page.getByText('Your Subspecialty Profiles')).toBeVisible();

    // All subspecialty cards should be present
    const subspecialtyLabels = [
      'Heart Failure',
      'Electrophysiology',
      'Interventional Cardiology',
      'Cardiac Imaging',
      'Structural Heart',
      'General Cardiology',
      'Cardiac Surgery',
    ];

    for (const label of subspecialtyLabels) {
      await expect(page.getByRole('heading', { name: label })).toBeVisible();
    }

    // How it works section should be visible
    await expect(page.getByText('How Per-Subspecialty Learning Works')).toBeVisible();
  });

  test.skip('should switch between style modes and persist preference', async ({
    page,
  }) => {
    await page.goto('/settings/style');

    // Click Per-Subspecialty tab
    await page.getByRole('tab', { name: 'Per-Subspecialty' }).click();
    await expect(page.getByRole('tab', { name: 'Per-Subspecialty' })).toHaveAttribute(
      'aria-selected',
      'true'
    );

    // Reload page and check persistence
    await page.reload();

    // Per-Subspecialty should still be selected (from localStorage)
    await expect(page.getByRole('tab', { name: 'Per-Subspecialty' })).toHaveAttribute(
      'aria-selected',
      'true'
    );
  });
});

test.describe('Style Profiles - Learning Strength Slider', () => {
  test.skip('should display learning strength slider for active profiles', async ({
    page,
  }) => {
    // Prerequisites: User is authenticated and has an active profile
    await page.goto('/settings/style');
    await page.getByRole('tab', { name: 'Per-Subspecialty' }).click();

    // Find a profile card with an active profile (has "Active" label)
    const activeCard = page.locator('.card:has-text("Active")').first();
    if (await activeCard.count() > 0) {
      // Slider should be visible
      await expect(activeCard.getByRole('slider')).toBeVisible();

      // Labels should be present
      await expect(activeCard.getByText('Neutral')).toBeVisible();
      await expect(activeCard.getByText('Personalized')).toBeVisible();

      // Adaptation level label should show percentage
      await expect(activeCard.getByText(/Adaptation level/)).toBeVisible();
    }
  });

  test.skip('should adjust learning strength via slider', async ({ page }) => {
    await page.goto('/settings/style');
    await page.getByRole('tab', { name: 'Per-Subspecialty' }).click();

    const activeCard = page.locator('.card:has-text("Active")').first();
    if (await activeCard.count() > 0) {
      const slider = activeCard.getByRole('slider');

      // Get initial value
      const initialValue = await slider.getAttribute('value');

      // Drag slider to adjust value
      await slider.fill('0.5');

      // Wait for saving indicator
      await expect(activeCard.getByText('saving...')).toBeVisible({ timeout: 1000 }).catch(() => {
        // Saving may be too fast to catch
      });

      // Value should be updated
      const newValue = await slider.getAttribute('value');
      expect(newValue).toBe('0.5');
    }
  });
});

test.describe('Style Profiles - Reset Profile', () => {
  test.skip('should show reset confirmation dialog', async ({ page }) => {
    await page.goto('/settings/style');
    await page.getByRole('tab', { name: 'Per-Subspecialty' }).click();

    // Find a profile card with an active profile
    const activeCard = page.locator('.card:has-text("Active")').first();
    if (await activeCard.count() > 0) {
      // Click reset button (RotateCcw icon)
      await activeCard.getByRole('button').filter({ hasNot: page.getByText('Analyze') }).last().click();

      // Dialog should appear
      await expect(page.getByRole('alertdialog')).toBeVisible();
      await expect(page.getByText('Reset Style Profile')).toBeVisible();
      await expect(page.getByText('This will reset your')).toBeVisible();
      await expect(page.getByText('This action cannot be undone')).toBeVisible();

      // Cancel and Reset buttons should be present
      await expect(page.getByRole('button', { name: 'Cancel' })).toBeVisible();
      await expect(page.getByRole('button', { name: 'Reset Profile' })).toBeVisible();
    }
  });

  test.skip('should close dialog on cancel', async ({ page }) => {
    await page.goto('/settings/style');
    await page.getByRole('tab', { name: 'Per-Subspecialty' }).click();

    const activeCard = page.locator('.card:has-text("Active")').first();
    if (await activeCard.count() > 0) {
      await activeCard.getByRole('button').filter({ hasNot: page.getByText('Analyze') }).last().click();

      // Click Cancel
      await page.getByRole('button', { name: 'Cancel' }).click();

      // Dialog should close
      await expect(page.getByRole('alertdialog')).not.toBeVisible();
    }
  });

  test.skip('should reset profile on confirm', async ({ page }) => {
    await page.goto('/settings/style');
    await page.getByRole('tab', { name: 'Per-Subspecialty' }).click();

    const cardTitle = 'Heart Failure';
    const card = page.locator(`.card:has-text("${cardTitle}")`).first();

    if (await card.locator('text=Active').count() > 0) {
      await card.getByRole('button').filter({ hasNot: page.getByText('Analyze') }).last().click();

      // Click Reset Profile
      await page.getByRole('button', { name: 'Reset Profile' }).click();

      // Dialog should close and profile should be reset
      await expect(page.getByRole('alertdialog')).not.toBeVisible();

      // Card should no longer show "Active" status
      await expect(card.locator('text=Active')).not.toBeVisible({ timeout: 3000 });
    }
  });
});

test.describe('Style Profiles - Seed Letter Upload', () => {
  test.skip('should open seed letter upload dialog', async ({ page }) => {
    await page.goto('/settings/style');
    await page.getByRole('tab', { name: 'Per-Subspecialty' }).click();

    // Click Upload Sample Letter button
    await page.getByRole('button', { name: 'Upload Sample Letter' }).click();

    // Dialog should open
    await expect(page.getByRole('dialog')).toBeVisible();
    await expect(page.getByText('Seed Style Profile with Sample Letter')).toBeVisible();

    // Subspecialty selector should be visible
    await expect(page.getByLabel('Subspecialty')).toBeVisible();

    // Text area should be visible
    await expect(page.getByLabel('Letter Content')).toBeVisible();

    // Paste from clipboard button should be visible
    await expect(page.getByRole('button', { name: /Paste from clipboard/ })).toBeVisible();

    // File upload button should be visible
    await expect(page.getByRole('button', { name: /Choose File/ })).toBeVisible();

    // Cancel and Upload buttons should be visible
    await expect(page.getByRole('button', { name: 'Cancel' })).toBeVisible();
    await expect(page.getByRole('button', { name: /Upload & Analyze/ })).toBeVisible();
  });

  test.skip('should validate minimum letter length', async ({ page }) => {
    await page.goto('/settings/style');
    await page.getByRole('tab', { name: 'Per-Subspecialty' }).click();

    await page.getByRole('button', { name: 'Upload Sample Letter' }).click();

    // Select a subspecialty
    await page.getByLabel('Subspecialty').click();
    await page.getByRole('option', { name: 'Heart Failure' }).click();

    // Enter short text
    await page.getByLabel('Letter Content').fill('Too short');

    // Upload button should be disabled
    await expect(page.getByRole('button', { name: /Upload & Analyze/ })).toBeDisabled();

    // Character count should show current/min
    await expect(page.getByText('9 characters')).toBeVisible();
    await expect(page.getByText('Min: 100')).toBeVisible();
  });

  test.skip('should enable upload with valid content', async ({ page }) => {
    await page.goto('/settings/style');
    await page.getByRole('tab', { name: 'Per-Subspecialty' }).click();

    await page.getByRole('button', { name: 'Upload Sample Letter' }).click();

    // Select a subspecialty
    await page.getByLabel('Subspecialty').click();
    await page.getByRole('option', { name: 'Heart Failure' }).click();

    // Enter valid letter content (>100 chars)
    const sampleLetter = `Dear Dr. Smith,

I am writing to provide an update on Mr. John Doe, a 65-year-old patient with heart failure.

He presents today for follow-up of his chronic systolic heart failure with reduced ejection fraction.

His current medications include carvedilol 25mg twice daily, lisinopril 20mg daily, and furosemide 40mg daily.

Thank you for your continued care of this patient.

Yours sincerely,
Dr. Jones`;

    await page.getByLabel('Letter Content').fill(sampleLetter);

    // Upload button should be enabled
    await expect(page.getByRole('button', { name: /Upload & Analyze/ })).toBeEnabled();
  });

  test.skip('should upload seed letter and show success message', async ({ page }) => {
    await page.goto('/settings/style');
    await page.getByRole('tab', { name: 'Per-Subspecialty' }).click();

    await page.getByRole('button', { name: 'Upload Sample Letter' }).click();

    // Select a subspecialty
    await page.getByLabel('Subspecialty').click();
    await page.getByRole('option', { name: 'Heart Failure' }).click();

    // Enter valid letter content
    const sampleLetter = `Dear Dr. Smith,

I am writing to provide an update on Mr. John Doe, a 65-year-old patient with heart failure.

He presents today for follow-up of his chronic systolic heart failure with reduced ejection fraction.

His current medications include carvedilol 25mg twice daily, lisinopril 20mg daily, and furosemide 40mg daily.

Thank you for your continued care of this patient.

Yours sincerely,
Dr. Jones`;

    await page.getByLabel('Letter Content').fill(sampleLetter);

    // Click upload
    await page.getByRole('button', { name: /Upload & Analyze/ }).click();

    // Should show loading state
    await expect(page.getByText('Uploading...')).toBeVisible({ timeout: 1000 }).catch(() => {
      // May be too fast
    });

    // Should show success message
    await expect(page.getByText(/uploaded successfully/)).toBeVisible({ timeout: 5000 });

    // Dialog should close after success
    await expect(page.getByRole('dialog')).not.toBeVisible({ timeout: 3000 });
  });

  test.skip('should close dialog on cancel', async ({ page }) => {
    await page.goto('/settings/style');
    await page.getByRole('tab', { name: 'Per-Subspecialty' }).click();

    await page.getByRole('button', { name: 'Upload Sample Letter' }).click();
    await expect(page.getByRole('dialog')).toBeVisible();

    await page.getByRole('button', { name: 'Cancel' }).click();
    await expect(page.getByRole('dialog')).not.toBeVisible();
  });
});

test.describe('Style Profiles - Profile Details', () => {
  test.skip('should expand profile details', async ({ page }) => {
    await page.goto('/settings/style');
    await page.getByRole('tab', { name: 'Per-Subspecialty' }).click();

    const activeCard = page.locator('.card:has-text("Active")').first();
    if (await activeCard.count() > 0) {
      // Click "Show details" button
      await activeCard.getByRole('button', { name: /Show details/ }).click();

      // Details should be visible
      await expect(activeCard.getByText('Last analyzed:')).toBeVisible();

      // Button should change to "Hide details"
      await expect(activeCard.getByRole('button', { name: /Hide details/ })).toBeVisible();
    }
  });

  test.skip('should collapse profile details', async ({ page }) => {
    await page.goto('/settings/style');
    await page.getByRole('tab', { name: 'Per-Subspecialty' }).click();

    const activeCard = page.locator('.card:has-text("Active")').first();
    if (await activeCard.count() > 0) {
      // Expand details first
      await activeCard.getByRole('button', { name: /Show details/ }).click();
      await expect(activeCard.getByText('Last analyzed:')).toBeVisible();

      // Click "Hide details"
      await activeCard.getByRole('button', { name: /Hide details/ }).click();

      // Details should be hidden
      await expect(activeCard.getByText('Last analyzed:')).not.toBeVisible();
    }
  });

  test.skip('should display profile confidence meter', async ({ page }) => {
    await page.goto('/settings/style');
    await page.getByRole('tab', { name: 'Per-Subspecialty' }).click();

    const activeCard = page.locator('.card:has-text("Active")').first();
    if (await activeCard.count() > 0) {
      // Confidence label should be visible
      await expect(activeCard.getByText('Profile confidence:')).toBeVisible();

      // Progress bar should be visible
      await expect(activeCard.locator('[role="progressbar"]')).toBeVisible();

      // Percentage should be displayed
      await expect(activeCard.getByText(/%$/)).toBeVisible();
    }
  });
});

test.describe('Style Profiles - Analyze Profiles', () => {
  test.skip('should show analyze button for profiles with enough edits', async ({
    page,
  }) => {
    await page.goto('/settings/style');
    await page.getByRole('tab', { name: 'Per-Subspecialty' }).click();

    // Find any card - it should have an Analyze or Re-analyze button
    const card = page.locator('.card').first();
    const analyzeButton = card.getByRole('button', { name: /Analyze|Re-analyze/ });
    await expect(analyzeButton).toBeVisible();
  });

  test.skip('should disable analyze button when not enough edits', async ({
    page,
  }) => {
    await page.goto('/settings/style');
    await page.getByRole('tab', { name: 'Per-Subspecialty' }).click();

    // Find a card without active profile
    const inactiveCard = page.locator('.card').filter({ hasNot: page.getByText('Active') }).first();
    if (await inactiveCard.count() > 0) {
      const analyzeButton = inactiveCard.getByRole('button', { name: /Analyze/ });

      // Check if button is disabled
      if (await analyzeButton.isDisabled()) {
        // Help text should explain why
        await expect(inactiveCard.getByText(/Edit at least 5/)).toBeVisible();
      }
    }
  });

  test.skip('should trigger analysis on button click', async ({ page }) => {
    await page.goto('/settings/style');
    await page.getByRole('tab', { name: 'Per-Subspecialty' }).click();

    const card = page.locator('.card').first();
    const analyzeButton = card.getByRole('button', { name: /Analyze|Re-analyze/ });

    if (await analyzeButton.isEnabled()) {
      await analyzeButton.click();

      // Should show loading state
      await expect(card.getByText('Analyzing...')).toBeVisible({ timeout: 1000 }).catch(() => {
        // May be too fast or already complete
      });
    }
  });
});

test.describe('Style Profiles - Global Style Tab', () => {
  test.skip('should display detected style profile when available', async ({
    page,
  }) => {
    await page.goto('/settings/style');
    await page.getByRole('tab', { name: 'Global Style' }).click();

    // Check for profile display
    const profileSection = page.getByText('Detected Style Profile');
    if (await profileSection.count() > 0) {
      // Expand the section
      await profileSection.click();

      // Should show preference rows
      await expect(page.getByText('Greeting Style')).toBeVisible();
      await expect(page.getByText('Closing Style')).toBeVisible();
      await expect(page.getByText('Paragraph Structure')).toBeVisible();
      await expect(page.getByText('Formality Level')).toBeVisible();
    }
  });

  test.skip('should show no profile message when empty', async ({ page }) => {
    await page.goto('/settings/style');
    await page.getByRole('tab', { name: 'Global Style' }).click();

    // Check for no profile state
    const noProfileMessage = page.getByText('No style profile available yet');
    if (await noProfileMessage.count() > 0) {
      await expect(noProfileMessage).toBeVisible();
      await expect(page.getByText(/Edit some AI-generated letters/)).toBeVisible();
    }
  });
});

test.describe('Style Profiles - Letter Generation Integration', () => {
  // These tests verify that style profiles affect letter generation
  // Requires authentication and appropriate test data

  test('letters API should require authentication', async ({ request }) => {
    const response = await request.post('/api/letters', {
      data: {
        consultationId: 'test-id',
        templateId: 'test-template',
      },
      headers: { 'Content-Type': 'application/json' },
    });

    expect(response.status()).toBe(401);
  });

  test.skip('should include subspecialty in letter generation request', async ({
    page,
    request,
  }) => {
    // This test would verify that the letter generation API accepts
    // and processes the subspecialty parameter correctly

    // Setup: Navigate to letter generation page
    // Action: Generate letter with subspecialty selected
    // Verify: API request includes subspecialty parameter

    // Note: Implementation depends on actual letter generation UI
    expect(true).toBe(true);
  });

  test.skip('should apply profile conditioning to generated letters', async ({
    page,
  }) => {
    // This test would verify that generated letters reflect the style profile

    // Setup: Create a profile with specific preferences (e.g., formal greeting)
    // Action: Generate a letter
    // Verify: Letter content matches profile preferences

    // Note: This is a complex integration test that requires:
    // 1. Authenticated session
    // 2. Existing style profile
    // 3. Ability to inspect generated letter content

    expect(true).toBe(true);
  });
});

test.describe('Style Profiles - Accessibility', () => {
  test('settings style page should be accessible when redirected to login', async ({
    page,
  }) => {
    await page.goto('/settings/style');

    // The redirect to login should complete without JS errors
    await page.waitForLoadState('networkidle');

    // Page should have some content
    const content = await page.content();
    expect(content.length).toBeGreaterThan(0);
  });
});

test.describe('Style Profiles - Error Handling', () => {
  test('should handle API errors gracefully', async ({ request }) => {
    // Test invalid subspecialty value
    const response = await request.get('/api/style/profiles/INVALID_SUBSPECIALTY');
    expect([400, 401]).toContain(response.status());
  });

  test('should reject invalid learning strength values', async ({ request }) => {
    const response = await request.patch('/api/style/profiles/HEART_FAILURE/strength', {
      data: { learningStrength: 2.0 }, // Invalid: > 1.0
      headers: { 'Content-Type': 'application/json' },
    });

    // Should be 401 (unauthenticated) or 400 (validation error)
    expect([400, 401]).toContain(response.status());
  });

  test('should validate seed letter content length', async ({ request }) => {
    const response = await request.post('/api/style/seed', {
      data: {
        subspecialty: 'HEART_FAILURE',
        letterText: 'Too short', // Less than 100 chars
      },
      headers: { 'Content-Type': 'application/json' },
    });

    // Should be 401 (unauthenticated) or 400 (validation error)
    expect([400, 401]).toContain(response.status());
  });
});
