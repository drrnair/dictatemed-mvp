# Fix bug

## Configuration
- **Artifacts Path**: {@artifacts_path} → `.zenflow/tasks/{task_id}`

---

## Workflow Steps

### [x] Step: Investigation and Planning
<!-- chat-id: 88ac9ee3-5d52-4738-a43a-79496c0598b3 -->

Analyze the bug report and design a solution.

1. Review the bug description, error messages, and logs
2. Clarify reproduction steps with the user if unclear
3. Check existing tests for clues about expected behavior
4. Locate relevant code sections and identify root cause
5. Propose a fix based on the investigation
6. Consider edge cases and potential side effects

Save findings to `{@artifacts_path}/investigation.md` with:
- Bug summary
- Root cause analysis
- Affected components
- Proposed solution

### [x] Step: Implementation
<!-- chat-id: bed06be7-2158-43e9-8f7f-411da106b7ed -->
Read `{@artifacts_path}/investigation.md`
Implement the bug fix.

1. Add/adjust regression test(s) that fail before the fix and pass after
2. Implement the fix
3. Run relevant tests
4. Update `{@artifacts_path}/investigation.md` with implementation notes and test results

If blocked or uncertain, ask the user for direction.

**Completed:** 2024-12-25
- Created `prisma/migrations/migration_lock.toml` (PostgreSQL provider)
- Updated `.github/workflows/e2e-tests.yml` to use `prisma db push` instead of `migrate deploy`
- Added `MOCK_SERVICES` toggle to `tests/e2e/utils/helpers.ts`
- Updated all mock functions to respect `MOCK_SERVICES` flag
- Updated workflow test files (`manual-consultation.spec.ts`, `referral-upload.spec.ts`)
- Updated `investigation.md` with implementation notes

### [x] Step: Fix Auth0 Login Selectors
<!-- chat-id: current -->

**Completed:** 2024-12-26
- Fixed Auth0 login selectors in `tests/e2e/fixtures/auth.ts`:
  - Changed from individual selector loops to combined CSS selector string
  - Added more comprehensive selectors for Auth0 Universal Login
  - Increased timeouts from 2s to 15s for email, 10s for password/submit
  - Added debug screenshots on failure
  - Added `waitForLoadState('domcontentloaded')` before looking for inputs
- Updated `tests/e2e/page-objects/LoginPage.ts` with matching comprehensive selectors

**Changes made:**
- `tests/e2e/fixtures/auth.ts` - Improved Auth0 login flow with better selectors
- `tests/e2e/page-objects/LoginPage.ts` - Updated email/password/submit selectors

### [x] Step: Fix Auth0 Wait States and PHI Scan
<!-- chat-id: current -->

**Completed:** 2024-12-26
- Improved Auth0 login reliability:
  - Changed from `waitForLoadState('domcontentloaded')` to `waitForLoadState('networkidle')`
  - Added detailed debug logging on failure (page title, body text preview)
  - This helps diagnose what Auth0 is actually showing when login fails
- Fixed PHI scan false positives:
  - Excluded `test-results`, `playwright-report`, `.auth` directories from scan
  - Fixed grep exit code handling with `|| true` to prevent false positives
  - Made patient name detection a warning only (as documented)

**Changes made:**
- `tests/e2e/fixtures/auth.ts` - Better wait states and debug logging
- `.github/workflows/e2e-tests.yml` - Fixed PHI scan grep patterns

### [x] Step: Secondary Fixes - Timeouts and Workflow State
<!-- chat-id: current -->

**Completed:** 2025-12-26
- Expanded `TEST_TIMEOUTS` constants with semantic names:
  - Added auth0-specific timeouts: `auth0Login`, `auth0Submit`, `auth0Redirect`
  - Added element visibility timeouts: `elementVisible`, `elementHidden`, `modalAppear`, `modalDismiss`
  - Added search timeouts: `searchResults`, `searchDebounce`
  - Added documentation with usage examples
- Updated `auth.ts` to use `TEST_TIMEOUTS` instead of hardcoded values
- Created `workflow-state.ts` fixture to replace mutable `generatedLetterId`:
  - File-based state persistence for cross-test communication
  - Helper functions: `extractLetterIdFromUrl`, `extractConsultationIdFromUrl`, `extractReferralIdFromUrl`
  - `workflowTest` fixture that provides `workflowState` object
  - Ready for workflow specs to migrate to (manual migration needed)

**Changes made:**
- `tests/e2e/fixtures/test-data.ts` - Expanded TEST_TIMEOUTS
- `tests/e2e/fixtures/auth.ts` - Use TEST_TIMEOUTS constants
- `tests/e2e/fixtures/workflow-state.ts` - New fixture for serial test state

### [x] Step: Apply Workflow Fixture and Timeout Constants
<!-- chat-id: current -->

**Completed:** 2025-12-26
- Migrated workflow specs to use `workflowTest` fixture:
  - `manual-consultation.spec.ts` - Uses workflowState for letterId
  - `referral-upload.spec.ts` - Uses workflowState for letterId
  - Both files now use `clearWorkflowState()` in beforeAll
- Updated all page objects to use `TEST_TIMEOUTS`:
  - `BasePage.ts` - networkIdle, elementVisible, elementHidden, toast
  - `LoginPage.ts` - auth0Redirect, auth0Login, navigation
  - `DashboardPage.ts` - elementVisible
  - `NewConsultationPage.ts` - searchResults, modalAppear, letterGeneration, navigation
  - `LetterDetailPage.ts` - elementVisible, navigation, pageLoad
  - `ReferralUploadPage.ts` - modalAppear, referralExtraction
- Added `.workflow-state.json` to `.gitignore`

**Changes made:**
- `.gitignore` - Added workflow state file
- `tests/e2e/workflows/manual-consultation.spec.ts` - Use workflowTest fixture
- `tests/e2e/workflows/referral-upload.spec.ts` - Use workflowTest fixture
- `tests/e2e/page-objects/*.ts` - All 6 page objects now use TEST_TIMEOUTS

### [ ] Step: Test Execution and Documentation
<!-- chat-id: current -->

**Status:** Blocked by infrastructure requirements

The E2E tests require the following infrastructure to run:
1. **PostgreSQL Database**: Configured via `DATABASE_URL` environment variable
2. **Seeded Test Data**: Run via `npm run db:seed:e2e` (requires database + `PHI_ENCRYPTION_KEY`)
3. **Auth0 Credentials**: All Auth0 environment variables configured in GitHub Secrets
4. **Built Next.js App**: The `npm run build` step compiles the application
5. **Playwright Web Server**: Runs the app locally during test execution

**Local Test Execution Attempt:**
- `npm run db:seed:e2e`: ❌ Failed - requires `DATABASE_URL` and `PHI_ENCRYPTION_KEY`
- `npx playwright test`: ❌ Cannot run - requires database and built application

**Test Infrastructure Summary:**
- Total tests discovered: ~127 (for Chromium project)
- Test files in `flows/`: API health, auth, accessibility, letter-sending, style-profiles
- Test files in `workflows/`: manual-consultation, referral-upload

**CI Pipeline Status (Run #33):**
- ✅ Install Playwright browsers
- ✅ Generate Prisma client
- ✅ Sync database schema
- ✅ Seed E2E test data (passed in CI with proper secrets)
- ❌ Build application (TypeScript error - FIXED in commit c8151bd)
- Tests did not run due to build failure

**Remaining Issue:**
The tests should now run in CI after the TypeScript fix. The next CI run will verify:
1. Build succeeds
2. Auth0 login completes (requires properly configured Auth0 tenant)
3. Tests execute and report pass/fail results

**Repository Owner Actions Required:**
1. Verify Auth0 application settings:
   - Allowed Callback URLs: `http://localhost:3000/api/auth/callback`
   - Allowed Web Origins: `http://localhost:3000`
2. Re-run the CI workflow after the TypeScript fix is merged
3. Review the test results in GitHub Actions artifacts
