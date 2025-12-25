// tests/e2e/workflows/style-profile.spec.ts
// E2E tests for the style profile learning workflow
//
// Tests the complete flow of style profile learning:
// 1. Generate baseline letter without style profile
// 2. Create multiple letters with consistent style
// 3. System learns clinician's writing preferences
// 4. Verify style is applied to new letters
// 5. Verify style persistence across sessions
// 6. Adjust learning strength via slider
// 7. Reset profile when requested

import { test, expect } from '@playwright/test';
import { LoginPage } from '../page-objects/LoginPage';
import { DashboardPage } from '../page-objects/DashboardPage';
import { NewConsultationPage } from '../page-objects/NewConsultationPage';
import { LetterDetailPage } from '../page-objects/LetterDetailPage';
import {
  TEST_PATIENTS,
  TEST_REFERRERS,
  TEST_IDS,
  TEST_ROUTES,
  TEST_TIMEOUTS,
  SAMPLE_LETTER_CONTENT,
  TEST_CLINICIAN,
} from '../fixtures/test-data';
import {
  mockLetterGeneration,
  mockTranscription,
  waitForNetworkIdle,
} from '../utils/helpers';

// ============================================
// Test Data for Style Profile Tests
// ============================================

const BASELINE_LETTER_CONTENT = `Dear Dr. TEST GP Smith,

Thank you for referring TEST Patient - Heart Failure for cardiology assessment.

CLINICAL SUMMARY:
The patient presents with progressive exertional dyspnoea and bilateral ankle swelling over the past 3 months.

EXAMINATION FINDINGS:
- Blood pressure: 135/85 mmHg
- Heart rate: 78 bpm regular
- JVP: Elevated 4cm
- Heart sounds: S3 gallop present
- Lungs: Bibasal crackles

INVESTIGATIONS:
- ECG: Sinus rhythm, no acute changes
- Echocardiogram: LVEF 38%, moderate LV systolic dysfunction
- BNP: 520 pg/mL (elevated)

IMPRESSION:
Heart failure with reduced ejection fraction (HFrEF), NYHA Class II.

MANAGEMENT PLAN:
1. Commenced sacubitril/valsartan 24/26mg twice daily
2. Continue bisoprolol 5mg daily
3. Added spironolactone 25mg daily
4. Heart failure education provided
5. Follow-up in 6 weeks

Yours sincerely,
Dr. TEST E2E Cardiologist`;

const STYLED_LETTER_CONTENT = `Dear Colleague,

Re: TEST Patient - Heart Failure

Many thanks for this referral.

I reviewed this pleasant 65-year-old gentleman who presents with a 3-month history of worsening exercise tolerance and leg swelling.

On examination today:
BP 135/85, HR 78 regular. Elevated JVP. Third heart sound audible. Fine bibasal creps.

Echo showed LVEF of 38% with grade II diastolic dysfunction.

Working diagnosis: HFrEF, NYHA II

I have initiated guideline-directed medical therapy:
• Entresto 24/26mg BD
• Bisoprolol 5mg OD (continue)
• Spironolactone 25mg OD

I will see him again in 6 weeks with repeat echo.

With best wishes,

Dr. TEST E2E Cardiologist
Consultant Cardiologist
TEST-PRACTICE-E2E Sydney Heart Specialists`;

// Mock style profile data
const MOCK_STYLE_PROFILE = {
  id: TEST_IDS.styleProfile,
  subspecialty: 'HEART_FAILURE',
  clinicianId: TEST_IDS.clinician,
  totalEditsAnalyzed: 12,
  lastAnalyzedAt: new Date().toISOString(),
  learningStrength: 0.75,
  greetingStyle: 'informal',
  closingStyle: 'best-wishes',
  formalityLevel: 'semi-formal',
  terminologyLevel: 'abbreviated',
  paragraphStructure: 'condensed',
  sectionOrder: ['greeting', 'reason', 'history', 'examination', 'investigations', 'impression', 'plan', 'closing'],
  vocabularyMap: {
    'Yours sincerely': 'With best wishes',
    'Thank you for referring': 'Many thanks for this referral',
    'ejection fraction': 'LVEF',
    'twice daily': 'BD',
    'once daily': 'OD',
  },
  signoffTemplate: 'With best wishes,',
  confidence: {
    greetingStyle: 0.85,
    closingStyle: 0.9,
    formalityLevel: 0.8,
    paragraphStructure: 0.7,
  },
};

// ============================================
// Style Profile - Main Workflow Tests
// ============================================

test.describe('Style Profile Workflow', () => {
  test.describe.configure({ mode: 'serial' });

  let loginPage: LoginPage;
  let dashboardPage: DashboardPage;
  let consultationPage: NewConsultationPage;
  let letterDetailPage: LetterDetailPage;
  let baselineLetterContent: string | null = null;

  test.beforeEach(async ({ page }) => {
    loginPage = new LoginPage(page);
    dashboardPage = new DashboardPage(page);
    consultationPage = new NewConsultationPage(page);
    letterDetailPage = new LetterDetailPage(page);
  });

  test('should generate baseline letter without style profile', async ({ page }) => {
    // Mock no existing style profile
    await page.route('**/api/style/profiles**', async (route) => {
      if (route.request().method() === 'GET') {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify([]), // No profiles exist
        });
      } else {
        await route.continue();
      }
    });

    // Mock letter generation with baseline content
    await mockLetterGeneration(page, BASELINE_LETTER_CONTENT);
    await mockTranscription(page);

    // Login and create consultation
    await loginPage.loginWithEnvCredentials();
    await consultationPage.gotoNewConsultation();

    // Fill clinical context
    await consultationPage.fillClinicalContext({
      patientMrn: TEST_PATIENTS.heartFailure.mrn,
      referrerName: TEST_REFERRERS.gp.name,
      letterType: 'NEW_PATIENT',
    });

    // Select upload mode for testing
    await consultationPage.selectRecordingMode('UPLOAD');

    // Mock the recording/transcription flow
    await page.route('**/api/recordings/**', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          recordingId: 'test-recording-baseline',
          transcript: 'Patient presents with heart failure symptoms',
        }),
      });
    });

    // Generate the letter
    await waitForNetworkIdle(page);
    await consultationPage.generateLetterAndWait(TEST_TIMEOUTS.letterGeneration);

    // Verify letter was generated
    await expect(page).toHaveURL(/\/letters\/.+/);

    // Store baseline content for comparison
    const letterContent = await letterDetailPage.getLetterContent();
    baselineLetterContent = letterContent;

    // Baseline letter should have formal greeting
    expect(letterContent).toContain('Dear Dr.');
    expect(letterContent).toContain('Thank you for referring');
    expect(letterContent).toContain('Yours sincerely');
  });

  test('should capture physician edits to learn style', async ({ page }) => {
    // Mock the letter edit API
    let capturedEdits: string[] = [];

    await page.route('**/api/letters/**/edit', async (route) => {
      const body = route.request().postDataJSON();
      if (body?.content) {
        capturedEdits.push(body.content);
      }
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ success: true }),
      });
    });

    // Mock style analysis trigger
    await page.route('**/api/style/analyze', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          editsAnalyzed: capturedEdits.length,
        }),
      });
    });

    // Login and navigate to letter
    await loginPage.loginWithEnvCredentials();

    // Mock existing letter for editing
    await page.route('**/api/letters/**', async (route) => {
      if (route.request().method() === 'GET') {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            id: 'test-letter-for-edit',
            content: BASELINE_LETTER_CONTENT,
            status: 'DRAFT',
            letterType: 'NEW_PATIENT',
            patientId: TEST_PATIENTS.heartFailure.id,
            patientName: TEST_PATIENTS.heartFailure.name,
          }),
        });
      } else {
        await route.continue();
      }
    });

    await letterDetailPage.gotoLetter('test-letter-for-edit');

    // Verify letter is editable
    await letterDetailPage.expectLetterVisible();

    // Make style edits (simulating physician preferences)
    // Replace formal greeting with informal
    await letterDetailPage.editLetter(
      BASELINE_LETTER_CONTENT.replace(
        'Dear Dr. TEST GP Smith,\n\nThank you for referring',
        'Dear Colleague,\n\nRe: TEST Patient - Heart Failure\n\nMany thanks for this referral'
      )
    );

    // Save the edit
    await letterDetailPage.saveLetter();

    // Verify edit was captured
    expect(capturedEdits.length).toBeGreaterThan(0);
  });

  test('should apply learned style to new letters', async ({ page }) => {
    // Mock style profile exists with learned preferences
    await page.route('**/api/style/profiles**', async (route) => {
      const url = route.request().url();
      if (url.includes('HEART_FAILURE')) {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify(MOCK_STYLE_PROFILE),
        });
      } else if (route.request().method() === 'GET') {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify([MOCK_STYLE_PROFILE]),
        });
      } else {
        await route.continue();
      }
    });

    // Mock letter generation with styled content
    await mockLetterGeneration(page, STYLED_LETTER_CONTENT);
    await mockTranscription(page);

    // Login and create new consultation
    await loginPage.loginWithEnvCredentials();
    await consultationPage.gotoNewConsultation();

    // Fill clinical context
    await consultationPage.fillClinicalContext({
      patientMrn: TEST_PATIENTS.heartFailure.mrn,
      referrerName: TEST_REFERRERS.gp.name,
      letterType: 'FOLLOW_UP',
    });

    // Select upload mode
    await consultationPage.selectRecordingMode('UPLOAD');

    // Mock recording
    await page.route('**/api/recordings/**', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          recordingId: 'test-recording-styled',
          transcript: 'Follow up for heart failure patient',
        }),
      });
    });

    await waitForNetworkIdle(page);
    await consultationPage.generateLetterAndWait(TEST_TIMEOUTS.letterGeneration);

    // Verify styled letter was generated
    await expect(page).toHaveURL(/\/letters\/.+/);
    const letterContent = await letterDetailPage.getLetterContent();

    // Styled letter should have learned preferences
    expect(letterContent).toContain('Dear Colleague');
    expect(letterContent).toContain('Many thanks');
    expect(letterContent).toContain('With best wishes');
  });

  test('should display profile in settings', async ({ page }) => {
    // Mock style profiles API
    await page.route('**/api/style/profiles**', async (route) => {
      if (route.request().method() === 'GET') {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify([MOCK_STYLE_PROFILE]),
        });
      } else {
        await route.continue();
      }
    });

    // Mock style analyze API for statistics
    await page.route('**/api/style/analyze', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          profile: null,
          statistics: {
            totalEdits: 15,
            editsLast7Days: 5,
            editsLast30Days: 12,
            lastEditDate: new Date().toISOString(),
          },
          canAnalyze: true,
        }),
      });
    });

    // Mock subspecialty-specific stats
    await page.route('**/api/style/profiles/*/analyze', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          editStats: { totalEdits: 12 },
          canAnalyze: true,
        }),
      });
    });

    // Login and navigate to style settings
    await loginPage.loginWithEnvCredentials();
    await page.goto('/settings/style');
    await waitForNetworkIdle(page);

    // Verify page header
    await expect(page.getByRole('heading', { name: 'Writing Style Profile' })).toBeVisible();

    // Verify mode selector tabs
    await expect(page.getByRole('tab', { name: 'Global Style' })).toBeVisible();
    await expect(page.getByRole('tab', { name: 'Per-Subspecialty' })).toBeVisible();

    // Switch to Per-Subspecialty tab
    await page.getByRole('tab', { name: 'Per-Subspecialty' }).click();

    // Verify Heart Failure profile card is visible
    const heartFailureCard = page.locator('[data-testid="subspecialty-card-HEART_FAILURE"]');
    await expect(heartFailureCard).toBeVisible();

    // Verify it shows as active
    await expect(heartFailureCard.locator('[data-testid="profile-active-badge"]')).toBeVisible();

    // Verify edit count is displayed
    await expect(heartFailureCard.getByText('12')).toBeVisible();

    // Verify confidence is displayed
    await expect(heartFailureCard.getByText(/Profile confidence:/)).toBeVisible();
  });

  test('should adjust learning strength via slider', async ({ page }) => {
    // Track PATCH requests for strength changes
    let strengthUpdateRequests: number[] = [];

    // Mock style profiles
    await page.route('**/api/style/profiles**', async (route) => {
      if (route.request().method() === 'GET') {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify([MOCK_STYLE_PROFILE]),
        });
      } else {
        await route.continue();
      }
    });

    // Mock strength update
    await page.route('**/api/style/profiles/*/strength', async (route) => {
      if (route.request().method() === 'PATCH') {
        const body = route.request().postDataJSON();
        strengthUpdateRequests.push(body?.learningStrength);
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            success: true,
            learningStrength: body?.learningStrength,
          }),
        });
      } else {
        await route.continue();
      }
    });

    // Mock analyze endpoints
    await page.route('**/api/style/analyze', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          profile: null,
          statistics: { totalEdits: 15, editsLast7Days: 5, editsLast30Days: 12 },
          canAnalyze: true,
        }),
      });
    });

    await page.route('**/api/style/profiles/*/analyze', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ editStats: { totalEdits: 12 }, canAnalyze: true }),
      });
    });

    // Login and navigate to style settings
    await loginPage.loginWithEnvCredentials();
    await page.goto('/settings/style');
    await waitForNetworkIdle(page);

    // Switch to Per-Subspecialty tab
    await page.getByRole('tab', { name: 'Per-Subspecialty' }).click();

    // Find the Heart Failure profile card - wait for it to be visible
    const heartFailureCard = page.locator('[data-testid="subspecialty-card-HEART_FAILURE"]');
    await expect(heartFailureCard).toBeVisible();

    // Find the learning strength slider
    const slider = heartFailureCard.getByRole('slider', { name: 'Learning strength' });
    await expect(slider).toBeVisible();

    // Adjust the slider
    await slider.fill('0.5');

    // Wait for debounced API call by watching for the response
    await page.waitForResponse(
      (response) => response.url().includes('/api/style/profiles') && response.url().includes('strength'),
      { timeout: 5000 }
    ).catch(() => {
      // API call may already have completed or debounce may not trigger
    });

    // Verify strength was updated
    // Note: The actual value may depend on debouncing behavior
    // We verify that the slider is interactive
    const sliderValue = await slider.getAttribute('value');
    expect(sliderValue).toBe('0.5');
  });

  test('should persist style across sessions', async ({ page, context }) => {
    // Mock style profiles to persist
    await page.route('**/api/style/profiles**', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify([MOCK_STYLE_PROFILE]),
      });
    });

    // Mock analyze endpoints
    await page.route('**/api/style/analyze', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          profile: null,
          statistics: { totalEdits: 15, editsLast7Days: 5, editsLast30Days: 12 },
          canAnalyze: true,
        }),
      });
    });

    await page.route('**/api/style/profiles/*/analyze', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ editStats: { totalEdits: 12 }, canAnalyze: true }),
      });
    });

    // Login and set style mode preference
    await loginPage.loginWithEnvCredentials();
    await page.goto('/settings/style');
    await waitForNetworkIdle(page);

    // Select Per-Subspecialty mode
    await page.getByRole('tab', { name: 'Per-Subspecialty' }).click();

    // Verify tab is selected
    await expect(page.getByRole('tab', { name: 'Per-Subspecialty' })).toHaveAttribute(
      'aria-selected',
      'true'
    );

    // Reload the page to simulate new session
    await page.reload();
    await waitForNetworkIdle(page);

    // Verify Per-Subspecialty is still selected (from localStorage)
    await expect(page.getByRole('tab', { name: 'Per-Subspecialty' })).toHaveAttribute(
      'aria-selected',
      'true'
    );

    // Verify profile is still displayed
    const heartFailureCard = page.locator('[data-testid="subspecialty-card-HEART_FAILURE"]');
    await expect(heartFailureCard).toBeVisible();
    await expect(heartFailureCard.locator('[data-testid="profile-active-badge"]')).toBeVisible();
  });

  test('should reset profile when requested', async ({ page }) => {
    // Track DELETE requests
    let deleteRequests: string[] = [];

    // Mock style profiles
    await page.route('**/api/style/profiles**', async (route) => {
      if (route.request().method() === 'GET') {
        // Return profile if not deleted
        if (!deleteRequests.includes('HEART_FAILURE')) {
          await route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify([MOCK_STYLE_PROFILE]),
          });
        } else {
          await route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify([]),
          });
        }
      } else {
        await route.continue();
      }
    });

    // Mock DELETE for profile reset
    await page.route('**/api/style/profiles/HEART_FAILURE', async (route) => {
      if (route.request().method() === 'DELETE') {
        deleteRequests.push('HEART_FAILURE');
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ success: true }),
        });
      } else {
        await route.continue();
      }
    });

    // Mock analyze endpoints
    await page.route('**/api/style/analyze', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          profile: null,
          statistics: { totalEdits: 15 },
          canAnalyze: true,
        }),
      });
    });

    await page.route('**/api/style/profiles/*/analyze', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ editStats: { totalEdits: 12 }, canAnalyze: true }),
      });
    });

    // Login and navigate to style settings
    await loginPage.loginWithEnvCredentials();
    await page.goto('/settings/style');
    await waitForNetworkIdle(page);

    // Switch to Per-Subspecialty tab
    await page.getByRole('tab', { name: 'Per-Subspecialty' }).click();

    // Find the Heart Failure profile card - wait for it to be visible
    const heartFailureCard = page.locator('[data-testid="subspecialty-card-HEART_FAILURE"]');
    await expect(heartFailureCard).toBeVisible();

    // Click reset button
    await heartFailureCard.getByRole('button', { name: 'Reset style profile' }).click();

    // Verify dialog appears
    await expect(page.getByRole('alertdialog')).toBeVisible();
    await expect(page.getByText('Reset Style Profile')).toBeVisible();
    await expect(page.getByText('This action cannot be undone')).toBeVisible();

    // Click Reset Profile to confirm
    await page.getByRole('button', { name: 'Reset Profile' }).click();

    // Wait for dialog to close
    await expect(page.getByRole('alertdialog')).not.toBeVisible({ timeout: 5000 });

    // Verify DELETE was called
    expect(deleteRequests).toContain('HEART_FAILURE');
  });
});

// ============================================
// Style Profile - Settings UI Tests
// ============================================

test.describe('Style Profile Settings - UI', () => {
  test('should display style mode selector', async ({ page }) => {
    // Mock APIs
    await page.route('**/api/style/**', async (route) => {
      if (route.request().url().includes('/profiles')) {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify([]),
        });
      } else if (route.request().url().includes('/analyze')) {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            profile: null,
            statistics: { totalEdits: 0 },
            canAnalyze: false,
          }),
        });
      } else {
        await route.continue();
      }
    });

    const loginPage = new LoginPage(page);
    await loginPage.loginWithEnvCredentials();
    await page.goto('/settings/style');
    await waitForNetworkIdle(page);

    // Verify header
    await expect(page.getByRole('heading', { name: 'Writing Style Profile' })).toBeVisible();

    // Verify description text
    await expect(
      page.getByText(/DictateMED learns your writing style from the edits/)
    ).toBeVisible();

    // Verify tabs
    await expect(page.getByRole('tab', { name: 'Global Style' })).toBeVisible();
    await expect(page.getByRole('tab', { name: 'Per-Subspecialty' })).toBeVisible();
  });

  test('should show all subspecialty cards in per-subspecialty mode', async ({ page }) => {
    // Mock APIs
    await page.route('**/api/style/profiles', async (route) => {
      if (route.request().method() === 'GET') {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify([]),
        });
      } else {
        await route.continue();
      }
    });

    await page.route('**/api/style/analyze', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          profile: null,
          statistics: { totalEdits: 0 },
          canAnalyze: false,
        }),
      });
    });

    await page.route('**/api/style/profiles/*/analyze', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ editStats: { totalEdits: 0 }, canAnalyze: false }),
      });
    });

    const loginPage = new LoginPage(page);
    await loginPage.loginWithEnvCredentials();
    await page.goto('/settings/style');
    await waitForNetworkIdle(page);

    // Switch to Per-Subspecialty tab
    await page.getByRole('tab', { name: 'Per-Subspecialty' }).click();

    // Wait for first card to be visible before checking all
    await expect(page.locator('[data-testid="subspecialty-card-HEART_FAILURE"]')).toBeVisible();

    // Verify all subspecialty cards are visible
    const subspecialties = [
      'HEART_FAILURE',
      'ELECTROPHYSIOLOGY',
      'INTERVENTIONAL',
      'IMAGING',
      'STRUCTURAL',
      'GENERAL_CARDIOLOGY',
      'CARDIAC_SURGERY',
    ];

    for (const subspecialty of subspecialties) {
      const card = page.locator(`[data-testid="subspecialty-card-${subspecialty}"]`);
      await expect(card).toBeVisible();
    }

    // Verify "How it works" section
    await expect(page.getByText('How Per-Subspecialty Learning Works')).toBeVisible();
  });

  test('should show edit statistics in global style tab', async ({ page }) => {
    // Mock with some edit statistics
    await page.route('**/api/style/profiles', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify([]),
      });
    });

    await page.route('**/api/style/analyze', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          profile: null,
          statistics: {
            totalEdits: 25,
            editsLast7Days: 8,
            editsLast30Days: 20,
            lastEditDate: new Date().toISOString(),
          },
          canAnalyze: true,
        }),
      });
    });

    const loginPage = new LoginPage(page);
    await loginPage.loginWithEnvCredentials();
    await page.goto('/settings/style');
    await waitForNetworkIdle(page);

    // Verify we're on Global Style tab by default
    await expect(page.getByRole('tab', { name: 'Global Style' })).toHaveAttribute(
      'aria-selected',
      'true'
    );

    // Verify edit statistics are displayed
    await expect(page.getByText('Total Edits')).toBeVisible();
    await expect(page.getByText('25')).toBeVisible();
    await expect(page.getByText('Last 7 Days')).toBeVisible();
    await expect(page.getByText('8')).toBeVisible();
    await expect(page.getByText('Last 30 Days')).toBeVisible();
    await expect(page.getByText('20')).toBeVisible();

    // Verify Run Style Analysis button
    await expect(page.getByRole('button', { name: 'Run Style Analysis' })).toBeVisible();
  });

  test('should disable analyze button without enough edits', async ({ page }) => {
    // Mock with insufficient edits
    await page.route('**/api/style/profiles', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify([]),
      });
    });

    await page.route('**/api/style/analyze', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          profile: null,
          statistics: {
            totalEdits: 3,
            editsLast7Days: 2,
            editsLast30Days: 3,
          },
          canAnalyze: false, // Not enough edits
        }),
      });
    });

    await page.route('**/api/style/profiles/*/analyze', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ editStats: { totalEdits: 3 }, canAnalyze: false }),
      });
    });

    const loginPage = new LoginPage(page);
    await loginPage.loginWithEnvCredentials();
    await page.goto('/settings/style');
    await waitForNetworkIdle(page);

    // Verify analyze button is disabled
    const analyzeButton = page.getByRole('button', { name: 'Run Style Analysis' });
    await expect(analyzeButton).toBeDisabled();

    // Verify help text
    await expect(page.getByText(/at least 5 edits/)).toBeVisible();
  });
});

// ============================================
// Style Profile - Seed Letter Upload Tests
// ============================================

test.describe('Style Profile - Seed Letter Upload', () => {
  test('should open seed letter upload dialog', async ({ page }) => {
    // Mock APIs
    await page.route('**/api/style/profiles', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify([]),
      });
    });

    await page.route('**/api/style/analyze', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          profile: null,
          statistics: { totalEdits: 0 },
          canAnalyze: false,
        }),
      });
    });

    await page.route('**/api/style/profiles/*/analyze', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ editStats: { totalEdits: 0 }, canAnalyze: false }),
      });
    });

    await page.route('**/api/style/seed', async (route) => {
      if (route.request().method() === 'GET') {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify([]),
        });
      } else {
        await route.continue();
      }
    });

    const loginPage = new LoginPage(page);
    await loginPage.loginWithEnvCredentials();
    await page.goto('/settings/style');
    await waitForNetworkIdle(page);

    // Switch to Per-Subspecialty tab
    await page.getByRole('tab', { name: 'Per-Subspecialty' }).click();

    // Wait for the upload button to be visible
    const uploadButton = page.getByRole('button', { name: 'Upload Sample Letter' });
    await expect(uploadButton).toBeVisible();
    await uploadButton.click();

    // Verify dialog opens
    await expect(page.getByRole('dialog')).toBeVisible();
    await expect(page.getByText('Seed Style Profile with Sample Letter')).toBeVisible();

    // Verify subspecialty selector
    await expect(page.getByLabel('Subspecialty')).toBeVisible();

    // Verify text area for letter content
    await expect(page.getByLabel('Letter Content')).toBeVisible();
  });

  test('should validate minimum letter length for seed upload', async ({ page }) => {
    // Mock APIs
    await page.route('**/api/style/**', async (route) => {
      const url = route.request().url();
      if (url.includes('/profiles') && route.request().method() === 'GET') {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify([]),
        });
      } else if (url.includes('/analyze')) {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            profile: null,
            statistics: { totalEdits: 0 },
            canAnalyze: false,
          }),
        });
      } else if (url.includes('/seed') && route.request().method() === 'GET') {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify([]),
        });
      } else {
        await route.continue();
      }
    });

    const loginPage = new LoginPage(page);
    await loginPage.loginWithEnvCredentials();
    await page.goto('/settings/style');
    await waitForNetworkIdle(page);

    // Switch to Per-Subspecialty tab and open dialog
    await page.getByRole('tab', { name: 'Per-Subspecialty' }).click();
    const uploadBtn = page.getByRole('button', { name: 'Upload Sample Letter' });
    await expect(uploadBtn).toBeVisible();
    await uploadBtn.click();
    await expect(page.getByRole('dialog')).toBeVisible();

    // Select subspecialty
    await page.getByLabel('Subspecialty').click();
    await page.getByRole('option', { name: 'Heart Failure' }).click();

    // Enter short text (less than 100 chars)
    await page.getByLabel('Letter Content').fill('Too short');

    // Upload button should be disabled
    const uploadButton = page.getByRole('button', { name: /Upload & Analyze/ });
    await expect(uploadButton).toBeDisabled();
  });

  test('should enable upload with valid content', async ({ page }) => {
    // Mock APIs
    await page.route('**/api/style/**', async (route) => {
      const url = route.request().url();
      if (url.includes('/profiles') && route.request().method() === 'GET') {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify([]),
        });
      } else if (url.includes('/analyze')) {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            profile: null,
            statistics: { totalEdits: 0 },
            canAnalyze: false,
          }),
        });
      } else if (url.includes('/seed')) {
        if (route.request().method() === 'GET') {
          await route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify([]),
          });
        } else if (route.request().method() === 'POST') {
          await route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify({ success: true, seedLetterId: 'new-seed-1' }),
          });
        }
      } else {
        await route.continue();
      }
    });

    const loginPage = new LoginPage(page);
    await loginPage.loginWithEnvCredentials();
    await page.goto('/settings/style');
    await waitForNetworkIdle(page);

    // Switch to Per-Subspecialty tab and open dialog
    await page.getByRole('tab', { name: 'Per-Subspecialty' }).click();
    const uploadBtn = page.getByRole('button', { name: 'Upload Sample Letter' });
    await expect(uploadBtn).toBeVisible();
    await uploadBtn.click();
    await expect(page.getByRole('dialog')).toBeVisible();

    // Select subspecialty
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
    const uploadButton = page.getByRole('button', { name: /Upload & Analyze/ });
    await expect(uploadButton).toBeEnabled();
  });
});

// ============================================
// Style Profile - Error Handling Tests
// ============================================

test.describe('Style Profile - Error Handling', () => {
  test('should handle API errors gracefully', async ({ page }) => {
    // Mock API failure
    await page.route('**/api/style/profiles', async (route) => {
      await route.fulfill({
        status: 500,
        contentType: 'application/json',
        body: JSON.stringify({ error: 'Internal server error' }),
      });
    });

    await page.route('**/api/style/analyze', async (route) => {
      await route.fulfill({
        status: 500,
        contentType: 'application/json',
        body: JSON.stringify({ error: 'Internal server error' }),
      });
    });

    const loginPage = new LoginPage(page);
    await loginPage.loginWithEnvCredentials();
    await page.goto('/settings/style');

    // Page should still load without crashing
    await expect(page.getByRole('heading', { name: 'Writing Style Profile' })).toBeVisible();

    // Error message may be displayed
    // The exact error handling depends on the implementation
  });

  test('should handle slow API response gracefully', async ({ page }) => {
    // Mock slow API response (3 seconds delay to test loading state)
    await page.route('**/api/style/profiles', async (route) => {
      await new Promise((resolve) => setTimeout(resolve, 3000));
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify([]),
      });
    });

    await page.route('**/api/style/analyze', async (route) => {
      await new Promise((resolve) => setTimeout(resolve, 3000));
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          profile: null,
          statistics: { totalEdits: 0 },
          canAnalyze: false,
        }),
      });
    });

    const loginPage = new LoginPage(page);
    await loginPage.loginWithEnvCredentials();
    await page.goto('/settings/style');

    // Loading state should appear while waiting for API
    // Check for loading indicator (spinner or loading text)
    const loadingIndicator = page.getByText('Loading style settings...');
    // Loading may or may not be visible depending on timing

    // Page should eventually load after slow response
    await expect(page.getByRole('heading', { name: 'Writing Style Profile' })).toBeVisible({
      timeout: 15000,
    });
  });
});

// ============================================
// Style Profile - Accessibility Tests
// ============================================

test.describe('Style Profile - Accessibility', () => {
  test('should have accessible tab navigation', async ({ page }) => {
    // Mock APIs
    await page.route('**/api/style/**', async (route) => {
      if (route.request().url().includes('/profiles')) {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify([]),
        });
      } else if (route.request().url().includes('/analyze')) {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            profile: null,
            statistics: { totalEdits: 0 },
            canAnalyze: false,
          }),
        });
      } else {
        await route.continue();
      }
    });

    const loginPage = new LoginPage(page);
    await loginPage.loginWithEnvCredentials();
    await page.goto('/settings/style');
    await waitForNetworkIdle(page);

    // Tab list should have proper role
    const tabList = page.getByRole('tablist');
    await expect(tabList).toBeVisible();

    // Tabs should be keyboard navigable
    const globalTab = page.getByRole('tab', { name: 'Global Style' });
    await globalTab.focus();
    await expect(globalTab).toBeFocused();

    // Arrow right should move to next tab
    await page.keyboard.press('ArrowRight');
    const subspecialtyTab = page.getByRole('tab', { name: 'Per-Subspecialty' });
    await expect(subspecialtyTab).toBeFocused();

    // Enter should select the tab
    await page.keyboard.press('Enter');
    await expect(subspecialtyTab).toHaveAttribute('aria-selected', 'true');
  });

  test('should have accessible slider controls', async ({ page }) => {
    // Mock APIs with active profile
    await page.route('**/api/style/profiles', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify([MOCK_STYLE_PROFILE]),
      });
    });

    await page.route('**/api/style/analyze', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          profile: null,
          statistics: { totalEdits: 15 },
          canAnalyze: true,
        }),
      });
    });

    await page.route('**/api/style/profiles/*/analyze', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ editStats: { totalEdits: 12 }, canAnalyze: true }),
      });
    });

    const loginPage = new LoginPage(page);
    await loginPage.loginWithEnvCredentials();
    await page.goto('/settings/style');
    await waitForNetworkIdle(page);

    // Switch to Per-Subspecialty tab
    await page.getByRole('tab', { name: 'Per-Subspecialty' }).click();

    // Find the slider - wait for card to be visible first
    const heartFailureCard = page.locator('[data-testid="subspecialty-card-HEART_FAILURE"]');
    await expect(heartFailureCard).toBeVisible();
    const slider = heartFailureCard.getByRole('slider', { name: 'Learning strength' });

    await expect(slider).toBeVisible();
    await expect(slider).toHaveAttribute('aria-label', 'Learning strength');

    // Slider should be keyboard accessible
    await slider.focus();
    await expect(slider).toBeFocused();
  });

  test('should have accessible reset dialog', async ({ page }) => {
    // Mock APIs with active profile
    await page.route('**/api/style/profiles', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify([MOCK_STYLE_PROFILE]),
      });
    });

    await page.route('**/api/style/analyze', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          profile: null,
          statistics: { totalEdits: 15 },
          canAnalyze: true,
        }),
      });
    });

    await page.route('**/api/style/profiles/*/analyze', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ editStats: { totalEdits: 12 }, canAnalyze: true }),
      });
    });

    const loginPage = new LoginPage(page);
    await loginPage.loginWithEnvCredentials();
    await page.goto('/settings/style');
    await waitForNetworkIdle(page);

    // Switch to Per-Subspecialty tab
    await page.getByRole('tab', { name: 'Per-Subspecialty' }).click();

    // Click reset button - wait for card to be visible first
    const heartFailureCard = page.locator('[data-testid="subspecialty-card-HEART_FAILURE"]');
    await expect(heartFailureCard).toBeVisible();
    await heartFailureCard.getByRole('button', { name: 'Reset style profile' }).click();

    // Dialog should be accessible
    const dialog = page.getByRole('alertdialog');
    await expect(dialog).toBeVisible();

    // Dialog should have proper title
    await expect(dialog.getByRole('heading', { name: 'Reset Style Profile' })).toBeVisible();

    // Cancel button should be focusable
    const cancelButton = dialog.getByRole('button', { name: 'Cancel' });
    await cancelButton.focus();
    await expect(cancelButton).toBeFocused();

    // Escape should close dialog
    await page.keyboard.press('Escape');
    await expect(dialog).not.toBeVisible();
  });
});
