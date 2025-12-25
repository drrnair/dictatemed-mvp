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

### [ ] Step: Test Infrastructure Setup

Create the foundational test infrastructure:

1. **E2E Test Seed Script** (`scripts/seed-e2e-test-data.ts`)
   - Create test clinician with Auth0 ID pattern
   - Create 2 test patients (MRN: `TEST-HF-001`, `TEST-PCI-002`)
   - Create test GP and referrer contacts
   - Use bulk inserts for performance (<3 seconds)
   - Encrypt patient PHI with `TEST-` prefix identifiers

2. **E2E Test Teardown Script** (`scripts/teardown-e2e-test-data.ts`)
   - Delete all entities with `TEST-` prefix
   - Transaction-based for atomicity

3. **Environment Template** (`.env.test.example`)
   - Test database URL template
   - E2E test credentials placeholders
   - Mock service flags

4. **Package.json Updates**
   - Add `db:seed:e2e` script
   - Add `db:teardown:e2e` script

**Verification**:
- `npm run db:seed:e2e` completes in <3 seconds
- `npm run db:teardown:e2e` removes all test data

---

### [ ] Step: Page Objects Implementation

Create reusable page object classes:

1. **Base Page Object** (`tests/e2e/page-objects/BasePage.ts`)
   - Common wait helpers
   - Navigation utilities
   - Toast notification assertions

2. **LoginPage** (`tests/e2e/page-objects/LoginPage.ts`)
   - `login(email, password)` - Auth0 login flow
   - `expectLoginSuccess()` - Dashboard redirect assertion
   - `expectLoginError(message)` - Error state assertion

3. **DashboardPage** (`tests/e2e/page-objects/DashboardPage.ts`)
   - `navigateToNewConsultation()` - Start new consultation
   - `navigateToReferralUpload()` - Go to referral upload
   - `getRecentLetters()` - Fetch letter list
   - `searchPatient(query)` - Patient search

4. **NewConsultationPage** (`tests/e2e/page-objects/NewConsultationPage.ts`)
   - `selectPatient(mrn)` - Patient selection
   - `fillClinicalContext(context)` - Form filling
   - `generateLetter()` - Trigger letter generation
   - `waitForLetterGeneration()` - Poll for completion

5. **ReferralUploadPage** (`tests/e2e/page-objects/ReferralUploadPage.ts`)
   - `uploadReferralPDF(filePath)` - File upload
   - `waitForExtraction()` - Async extraction wait
   - `reviewExtractedData()` - Get extracted fields
   - `confirmAndProceed()` - Apply to consultation

6. **LetterDetailPage** (`tests/e2e/page-objects/LetterDetailPage.ts`)
   - `getLetterContent()` - Read letter text
   - `editLetter(content)` - Modify letter
   - `approveLetter()` - Approve letter
   - `openSendDialog()` - Open send modal
   - `sendToRecipients(recipients)` - Send letter

7. **Index Export** (`tests/e2e/page-objects/index.ts`)
   - Export all page objects

**Verification**:
- TypeScript compiles without errors
- Page objects follow consistent patterns

---

### [ ] Step: Test Utilities and Fixtures

Create helpers and test data:

1. **Test Helpers** (`tests/e2e/utils/helpers.ts`)
   - `waitForNetworkIdle(page, timeout)` - Network idle wait
   - `expectToast(page, message)` - Toast assertion
   - `assertNoConsoleErrors(page)` - Console error check
   - `mockApiResponse(page, url, response)` - API mocking

2. **Test Data Factory** (`tests/e2e/utils/factory.ts`)
   - `createTestPatient(overrides)` - Generate patient data
   - `createTestContact(overrides)` - Generate contact data
   - `createTestClinicalContext(subspecialty)` - Generate clinical context

3. **Sample Referral PDFs** (`tests/e2e/fixtures/referrals/`)
   - `cardiology-referral-001.pdf` - Heart failure referral
   - `cardiology-referral-002.pdf` - PCI referral
   - Create realistic cardiology referral documents

4. **Test Data Constants** (`tests/e2e/fixtures/test-data.ts`)
   - Test user credentials (from env)
   - Test patient MRNs
   - Expected extraction results

**Verification**:
- Factory functions generate valid data
- PDF fixtures are readable

---

### [ ] Step: Workflow 1 - Manual Consultation Tests

Implement the manual consultation E2E workflow:

**File**: `tests/e2e/workflows/manual-consultation.spec.ts`

Test Cases:
1. `should login and navigate to new consultation`
2. `should search and select test patient`
3. `should fill clinical context with presenting complaint`
4. `should generate letter with AI`
5. `should review and approve letter`
6. `should send letter to GP and self`
7. `should show letter in sent history`

**Implementation Notes**:
- Use page objects for all interactions
- Add data-testid attributes to components as needed
- Mock AI service for consistent responses
- Include accessibility checks

**Verification**:
- `npx playwright test workflows/manual-consultation.spec.ts` passes
- Tests complete in <60 seconds

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
