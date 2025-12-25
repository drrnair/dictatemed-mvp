# E2E Testing Suite Implementation Plan

## Configuration
- **Artifacts Path**: `.zenflow/tasks/e2e-testing-suite-for-dictatemed-8719`
- **Difficulty**: Medium-Hard
- **Spec**: See `spec.md` for full technical specification

---

## Agent Instructions

Ask the user questions when anything is unclear or needs their input. This includes:
- Ambiguous or incomplete requirements
- Technical decisions that affect architecture or user experience
- Trade-offs that require business context

Do not make assumptions on important decisions — get clarification first.

---

## Workflow Steps

### [x] Step: Technical Specification

**Completed**: Technical specification created in `spec.md` covering:
- Difficulty assessment: Medium-Hard
- Technical context (Next.js 14, TypeScript, Playwright 1.41)
- Implementation approach with 4 phases
- Source code structure changes
- Verification approach
- Security considerations

---

### [x] Step: Test Infrastructure Setup
<!-- chat-id: 29d9a5e7-b6f5-43bd-a5fa-2a9ccd9a0dfe -->

**Completed**: Test infrastructure created with:

1. **E2E Test Seed Script** (`scripts/seed-e2e-test-data.ts`)
   - Creates test practice (TEST-PRACTICE-E2E Sydney Heart Specialists)
   - Creates test clinician (test.cardiologist+e2e@dictatemed.dev, auth0|e2e-test-clinician)
   - Creates 2 test patients (TEST-HF-001, TEST-PCI-002) with encrypted PHI
   - Creates 2 test referrers (GP and Cardiologist)
   - Creates 2 patient contacts with preferred channels
   - Creates style profile for Heart Failure subspecialty
   - Creates 2 draft consultations
   - Uses transactions for atomicity
   - Fixed UUIDs with e2e prefix for reproducibility

2. **E2E Test Teardown Script** (`scripts/teardown-e2e-test-data.ts`)
   - Deletes all E2E test entities in correct FK order
   - Transaction-based for atomicity
   - Includes orphan detection utility
   - Returns detailed deletion counts

3. **Environment Template** (`.env.test.example`)
   - Test database URL template
   - E2E test credentials (E2E_TEST_USER_EMAIL, E2E_TEST_USER_PASSWORD)
   - Mock service flags (MOCK_BEDROCK_SERVICE, MOCK_SUPABASE_STORAGE, etc.)
   - Playwright configuration options
   - Test data prefix configuration

4. **Package.json Updates**
   - Added `db:seed:e2e` script
   - Added `db:teardown:e2e` script

**Verification**:
- TypeScript compiles without errors
- Scripts are properly typed and use existing encryption utilities

---

### [x] Step: Page Objects Implementation
<!-- chat-id: 3ecfd967-1e69-4800-8079-671d6e2c95a2 -->

**Completed**: All 6 page objects created with comprehensive methods:

1. **BasePage** (`tests/e2e/page-objects/BasePage.ts`)
   - Navigation utilities: `goto()`, `waitForNavigation()`, `getCurrentPath()`
   - Wait utilities: `waitForNetworkIdle()`, `waitForVisible()`, `waitForHidden()`, `waitForText()`
   - Toast assertions: `expectToast()`, `waitForToastDismiss()`
   - Form utilities: `fillByLabel()`, `clickButton()`, `selectByLabel()`, `setCheckbox()`
   - Dialog utilities: `getDialog()`, `waitForDialogOpen()`, `waitForDialogClose()`, `closeDialog()`
   - Data-testid helpers: `getByTestId()`, `clickByTestId()`
   - Assertions: `assertUrl()`, `assertTitle()`, `assertTextVisible()`, `assertNoConsoleErrors()`
   - API mocking: `mockApiResponse()`, `clearApiMocks()`
   - Debug: `screenshot()`, `pause()`

2. **LoginPage** (`tests/e2e/page-objects/LoginPage.ts`)
   - Auth0 Universal Login integration
   - `login(email, password)` - Full Auth0 flow
   - `loginWithEnvCredentials()` - Uses E2E_TEST_USER_EMAIL/PASSWORD
   - `logout()` - Clear session
   - `expectLoginSuccess()`, `expectLoginError()` - Assertions
   - `isLoggedIn()`, `getSessionCookies()` - Status checks

3. **DashboardPage** (`tests/e2e/page-objects/DashboardPage.ts`)
   - Navigation: `navigateToNewConsultation()`, `navigateToLetters()`, `navigateToSettings()`
   - Stats: `getStatValue()` for dashboard metrics
   - Recent letters: `getRecentLetters()`, `openRecentLetter()`
   - Assertions: `expectDashboardVisible()`, `expectCorrectGreeting()`, `expectNavigationVisible()`

4. **NewConsultationPage** (`tests/e2e/page-objects/NewConsultationPage.ts`)
   - Patient selection: `searchPatient()`, `selectPatientByMrn()`, `createPatient()`
   - Referrer selection: `selectReferrer()`, `createReferrer()`
   - Letter type: `selectLetterType()` with typed enum (NEW_PATIENT, FOLLOW_UP, etc.)
   - Recording: `selectRecordingMode()`, `startRecording()`, `pauseRecording()`, `stopRecording()`
   - File upload: `uploadAudioFile()` for UPLOAD mode
   - Generation: `generateLetter()`, `waitForLetterGeneration()`, `generateLetterAndWait()`
   - Combined: `fillClinicalContext()` for full workflow

5. **ReferralUploadPage** (`tests/e2e/page-objects/ReferralUploadPage.ts`)
   - Upload: `uploadReferralPDF()`, `uploadViaDragDrop()`, `removeUploadedFile()`
   - Extraction: `waitForExtraction()`, `getExtractionState()`, `getExtractionProgress()`
   - Review: `getExtractedData()`, `reviewExtractedData()` with typed interface
   - Edit: `editPatientData()`, `editReferrerData()`
   - Actions: `confirmAndProceed()`, `applyToConsultation()`, `discardReferral()`
   - Complete workflow: `uploadAndExtract()`, `completeReferralWorkflow()`

6. **LetterDetailPage** (`tests/e2e/page-objects/LetterDetailPage.ts`)
   - Uses existing data-testids from LetterEditor, VerificationPanel, SourcePanel, DifferentialView
   - Content: `getLetterContent()`, `editLetter()`, `appendToLetter()`, `saveLetter()`
   - Verification: `verifyValue()`, `verifyAll()`, `viewSource()`, `dismissFlag()`
   - Diff view: `switchToSideBySideView()`, `acceptAllChanges()`, `revertAllChanges()`
   - Actions: `approveLetter()`, `openSendDialog()`, `downloadPdf()`, `deleteLetter()`
   - Send dialog: `selectRecipient()`, `addOneOffRecipient()`, `sendToRecipients()`
   - History: `openSendHistory()`, `getSendHistory()`

7. **Index Export** (`tests/e2e/page-objects/index.ts`)
   - Exports all page objects and types

**Verification**:
- TypeScript compiles without errors (`npx tsc --noEmit` passes)
- Consistent patterns across all page objects
- Proper typing for letter types, recording modes, extraction states
- Integration with existing data-testid attributes in codebase

---

### [x] Step: Test Utilities and Fixtures
<!-- chat-id: 4f3aba24-cca3-4b33-a9df-6e73667de47e -->

**Completed**: All test utilities and fixtures created:

1. **Test Helpers** (`tests/e2e/utils/helpers.ts`)
   - `waitForNetworkIdle(page, timeout)` - Network idle wait
   - `waitForApiResponse(page, urlPattern, timeout)` - Wait for API response
   - `expectToast(page, message, options)` - Toast assertion with type support
   - `waitForToastDismiss(page, timeout)` - Wait for toast to disappear
   - `assertNoConsoleErrors(page)` - Console error check
   - `setupConsoleErrorCollection(page)` - Collect errors for later assertion
   - `mockApiResponse(page, urlPattern, response)` - API mocking with delay support
   - `mockLetterGeneration(page, letterContent)` - Mock AI letter generation
   - `mockTranscription(page, transcriptText)` - Mock transcription service
   - `mockReferralExtraction(page, extractedData)` - Mock referral extraction
   - `clearApiMocks(page)` - Clear all API mocks
   - `debugScreenshot(page, name)` - Take debug screenshot
   - `retryWithBackoff(action, options)` - Retry with exponential backoff
   - `waitForStable(locator, timeout)` - Wait for element to stabilize
   - `generateTestId(prefix)` - Generate unique test IDs
   - `formatDateForInput(date)` - Format date for input fields
   - `formatAustralianPhone(phone)` - Format AU phone numbers
   - `validateClinicalContent(content, expectedValues)` - Validate letter content
   - `waitForUrl(page, urlPattern, timeout)` - Wait for URL pattern
   - `getCurrentSession(page)` - Get current session info
   - `clearBrowserStorage(page)` - Clear browser storage

2. **Test Data Factory** (`tests/e2e/utils/factory.ts`)
   - `createTestPatient(overrides)` - Generate patient data
   - `createHeartFailurePatient(overrides)` - HF patient preset
   - `createPCIPatient(overrides)` - PCI patient preset
   - `createTestPatients(count)` - Batch patient creation
   - `createTestContact(overrides)` - Generate contact data
   - `createGPContact(overrides)` - GP contact preset
   - `createSpecialistContact(overrides)` - Specialist preset
   - `createTestReferrer(overrides)` - Generate referrer data
   - `createTestClinicalContext(subspecialty)` - Generate clinical context for 7 subspecialties
   - `createTestLetterContent(overrides)` - Generate letter content
   - `assembleLetterContent(content)` - Assemble full letter
   - `createTestReferralDocument(overrides)` - Generate referral doc data
   - `createConsultationTestData(subspecialty)` - Complete consultation dataset

3. **Sample Referral Documents** (`tests/e2e/fixtures/referrals/`)
   - `cardiology-referral-001.txt` - Heart failure referral (routine)
   - `cardiology-referral-002.txt` - Chest pain referral (urgent)
   - `README.md` - Instructions for PDF generation
   - `scripts/generate-referral-pdfs.ts` - PDF generation script

4. **Test Data Constants** (`tests/e2e/fixtures/test-data.ts`)
   - `getTestCredentials()` - Get test user credentials from env
   - `hasMockAuthToken()`, `getMockAuthToken()` - Mock auth token helpers
   - `TEST_IDS` - Fixed UUIDs for all test entities
   - `TEST_PRACTICE` - Practice constants
   - `TEST_CLINICIAN` - Clinician constants
   - `TEST_PATIENTS` - Patient constants (HF, PCI)
   - `TEST_REFERRERS` - Referrer constants (GP, Cardiologist)
   - `TEST_CONTACTS` - Patient contact constants
   - `EXPECTED_REFERRAL_EXTRACTIONS` - Expected extraction results for PDFs
   - `SAMPLE_LETTER_CONTENT` - Sample letter content by subspecialty
   - `TEST_ROUTES` - Application route constants
   - `TEST_TIMEOUTS` - Timeout constants
   - `TEST_SELECTORS` - Common data-testid selectors
   - `CLINICAL_PATTERNS` - Regex patterns for clinical validation
   - `TEST_DATA` - Combined export of all constants

5. **Index Export** (`tests/e2e/utils/index.ts`)
   - Central export for all utilities and factories

6. **Package.json Updates**
   - Added `generate:referral-pdfs` script

**Verification**:
- TypeScript compiles without errors (`npx tsc --noEmit` passes)
- Factory functions generate valid data with TEST- prefix
- Clinical context factories cover all 7 subspecialties
- All test data uses TEST- prefix for PHI compliance

---

### [x] Step: Workflow 1 - Manual Consultation Tests
<!-- chat-id: 4b259c2c-ccf0-42de-a3b5-b2d2e24019f9 -->

**Completed**: Manual consultation E2E workflow implemented with 10+ test cases:

**File**: `tests/e2e/workflows/manual-consultation.spec.ts`

**Main Workflow Tests (Serial)**:
1. `should login and navigate to dashboard` - Login via Auth0 and verify dashboard visible
2. `should navigate to new consultation page` - Navigate from dashboard to /record
3. `should search and select test patient by MRN` - Search TEST-HF-001 patient
4. `should select referrer and letter type` - Select GP referrer and NEW_PATIENT type
5. `should fill clinical context and prepare for recording` - Complete context form, select DICTATION mode
6. `should generate letter using AI after recording` - Mock transcription/generation, verify redirect to letter page
7. `should review and approve generated letter` - Load letter, verify content, approve letter
8. `should send letter to GP and self` - Open send dialog, select recipients, confirm send
9. `should show letter in sent history` - Verify send history populated

**Error Handling Tests**:
10. `should show validation when required fields are missing` - Generate button disabled without patient
11. `should handle letter generation failure gracefully` - Mock 500 error, verify UI handles it
12. `should persist draft state on page refresh` - Test draft persistence behavior

**Accessibility Tests**:
13. `should have accessible form elements` - Check aria-labels and keyboard navigation

**Implementation Details**:
- Uses page objects: LoginPage, DashboardPage, NewConsultationPage, LetterDetailPage
- Mocks AI services via Playwright route interception
- Uses test data constants from fixtures/test-data.ts
- Includes clinical content validation with CLINICAL_PATTERNS
- Serial test execution to maintain state between tests
- All test patients use TEST- prefix (TEST-HF-001)

**TypeScript Fixes**:
- Fixed nullable type issues in BasePage.ts (line 114)
- Fixed nullable type issues in helpers.ts (line 68, 376)
- Fixed nullable type issues in LetterDetailPage.ts (line 267)
- Fixed nullable match[1] issue in manual-consultation.spec.ts (line 196)

**Verification**:
- TypeScript compiles without errors for all test files
- Tests use proper page object patterns
- Mocks provide consistent responses for AI services

---

### [ ] Step: Workflow 2 - Referral Upload Tests

Implement the referral upload E2E workflow:

**File**: `tests/e2e/workflows/referral-upload.spec.ts`

Test Cases:
1. `should upload referral PDF successfully`
2. `should extract patient information from referral`
3. `should extract GP/referrer information`
4. `should allow editing extracted fields`
5. `should create consultation from referral`
6. `should generate letter with referral context`
7. `should send letter to referrer`

**Implementation Notes**:
- Use real PDF fixtures for upload
- Handle async extraction states
- Verify extraction accuracy
- Test error handling for invalid PDFs

**Verification**:
- `npx playwright test workflows/referral-upload.spec.ts` passes
- Extraction accuracy verified against expected values

---

### [ ] Step: Workflow 3 - Style Profile Tests

Implement the style profile E2E workflow:

**File**: `tests/e2e/workflows/style-profile.spec.ts`

Test Cases:
1. `should generate baseline letter without style profile`
2. `should capture physician edits`
3. `should apply learned style to new letters`
4. `should display profile in settings`
5. `should adjust learning strength via slider`
6. `should persist style across sessions`
7. `should reset profile when requested`

**Implementation Notes**:
- May need multiple letter generations
- Verify style characteristics in output
- Test with Heart Failure subspecialty
- Include session persistence checks

**Verification**:
- `npx playwright test workflows/style-profile.spec.ts` passes
- Style learning verified across letter generations

---

### [ ] Step: Playwright Configuration Enhancement

Update Playwright configuration for CI/CD:

1. **Update `playwright.config.ts`**
   - Add setup project for auth
   - Configure multi-browser testing (Chrome, Firefox, Safari)
   - Add GitHub reporter for CI
   - Configure video recording on failure
   - Set appropriate timeouts

2. **Add Firefox to Project Matrix**
   - Include Firefox browser testing
   - Handle Firefox-specific timing issues

3. **Global Setup** (`tests/e2e/global-setup.ts`)
   - Database health check
   - Environment validation

**Verification**:
- `npx playwright test --project=chromium` passes
- `npx playwright test --project=firefox` passes
- `npx playwright test --project=webkit` passes

---

### [ ] Step: CI/CD Pipeline Configuration

Create GitHub Actions workflow:

**File**: `.github/workflows/e2e-tests.yml`

Configuration:
1. **Trigger**: On PR to main, push to main
2. **Services**: PostgreSQL container
3. **Steps**:
   - Checkout, setup Node 20
   - Install dependencies
   - Install Playwright browsers
   - Setup test database
   - Run E2E tests
   - Upload reports/screenshots on failure

4. **Quality Gates**:
   - All tests pass (≥95% pass rate)
   - PHI scan (no real data)
   - Test execution <5 minutes

**Verification**:
- Workflow syntax validates
- Manual workflow trigger succeeds

---

### [ ] Step: Documentation and Final Review

Create documentation and enhancement report:

1. **README-E2E.md**
   - Setup instructions
   - Running tests locally
   - CI/CD integration guide
   - Troubleshooting guide
   - Test data documentation

2. **Enhancement Report** (`enhancement-report.md`)
   - 3-5 UX improvements discovered
   - Problem statement, solution, sizing

3. **Code Review**
   - Run linting on all new files
   - TypeScript strict mode check
   - Security review (no PHI exposure)
   - Anti-pattern review

4. **Final Verification**
   - All 3 workflows pass
   - >95% pass rate
   - <5 minute execution
   - Screenshots on failure work

**Deliverables Checklist**:
- [ ] `tests/e2e/` directory with workflow tests
- [ ] `tests/e2e/page-objects/` with page objects
- [ ] `tests/e2e/fixtures/` with test data
- [ ] `tests/e2e/utils/` with helpers
- [ ] `scripts/seed-e2e-test-data.ts`
- [ ] `scripts/teardown-e2e-test-data.ts`
- [ ] `playwright.config.ts` (updated)
- [ ] `.env.test.example`
- [ ] `.github/workflows/e2e-tests.yml`
- [ ] `README-E2E.md`
- [ ] Enhancement report

---

### [ ] Step: Implementation Report

Write final report to `.zenflow/tasks/e2e-testing-suite-for-dictatemed-8719/report.md`:

- What was implemented
- How the solution was tested
- Test coverage summary
- Biggest issues or challenges encountered
- UX enhancement recommendations
