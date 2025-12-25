# Investigation: E2E Test Execution Issues

## Bug Summary

The E2E test suite cannot run successfully due to:
1. **Missing `migration_lock.toml`** - Prisma migrations are incomplete/missing initial migration
2. **Tests never actually executed** - All validation was via static analysis only
3. **Heavy API mocking** - Tests don't validate real integration behavior

## Root Cause Analysis

### Issue 1: Database Migration Error (P3015)

**Symptoms:**
- CI fails with: `Error: P3015 - Could not find the migration file at migration.sql`
- Seed script (`npm run db:seed:e2e`) fails before tests can run

**Root Cause:**
The `prisma/migrations/` directory is missing critical files:
1. **No `migration_lock.toml`** - This file is required by Prisma to track the database provider
2. **No initial migration** - All existing migrations (9 total) are incremental changes to an existing schema
3. The migrations present assume a baseline schema exists but there's no migration that creates it

**Evidence:**
```
prisma/migrations/
├── 20251221130338_add_notifications/
├── 20251221_add_style_edits/
├── 20251222_add_patient_contacts_and_letter_sends/
├── 20251222_add_subspecialty_style_learning/
├── 20251223_add_referral_document/
├── 20251224_add_document_storage_path/
├── 20251224_add_medical_specialty_tables/
├── 20251224_add_recording_storage_path/
└── 20251224_add_sent_emails/
```

Missing:
- `migration_lock.toml` (required)
- Initial migration with base schema creation

**Impact:**
When `npx prisma migrate deploy` runs in CI, it fails because:
1. Prisma looks for the lock file to determine provider
2. Even if it passes, there's no initial migration to create the base tables

### Issue 2: Tests Never Actually Executed

**Symptoms:**
- Implementation report claims ">95% pass rate"
- No actual test execution logs or results exist

**Root Cause:**
Tests were validated using:
- TypeScript compilation (`npm run typecheck`)
- ESLint (`npm run lint`)
- Static analysis only

The workflow was:
1. Write test files
2. Verify they compile
3. Assume they pass

**Evidence:**
- CI workflow runs `npx prisma migrate deploy` which fails before reaching `npx playwright test`
- No test-results artifacts were ever generated
- The `playwright-report/` directory references in CI are empty

### Issue 3: Heavy API Mocking

**Symptoms:**
- Every API endpoint is mocked in tests
- Tests can't catch real integration issues
- Mock data may not match actual API responses

**Root Cause:**
The test architecture uses `page.route()` to intercept all API calls:
- `mockLetterGeneration()` - mocks `/api/letters/generate`
- `mockTranscription()` - mocks `/api/recordings/*/transcribe`
- `mockReferralExtraction()` - mocks `/api/referrals/*/extract`
- Individual test files add more mocks for specific endpoints

**Evidence from `tests/e2e/workflows/manual-consultation.spec.ts`:**
```typescript
async function setupLetterDetailMock(page: Page, letterId: string): Promise<void> {
  await page.route(`**/api/letters/${letterId}`, async (route) => {
    // Returns hardcoded mock data
  });
}
```

This approach:
- Never validates that real APIs work
- Mock responses may drift from actual API contract
- Gives false confidence in test coverage

## Affected Components

| Component | File(s) | Impact |
|-----------|---------|--------|
| Prisma Migrations | `prisma/migrations/` | Critical - blocks all test execution |
| CI Workflow | `.github/workflows/e2e-tests.yml` | Critical - fails at migration step |
| Seed Script | `scripts/seed-e2e-test-data.ts` | Medium - works if migrations pass |
| Test Files | `tests/e2e/**/*.spec.ts` | Medium - need real execution validation |
| Test Utilities | `tests/e2e/utils/helpers.ts` | Low - mocking helpers work as designed |

## Proposed Solution

### Fix 1: Database Migration (CRITICAL)

**Option A: Use `prisma db push` for E2E (Recommended for CI)**
- Replace `prisma migrate deploy` with `prisma db push` in CI
- `db push` syncs schema directly without migration history
- Faster, no migration file requirements

**Changes needed:**
```yaml
# .github/workflows/e2e-tests.yml
- name: Run database migrations
  run: npx prisma db push --accept-data-loss
```

**Option B: Create initial migration (For production-like testing)**
- Generate a baseline migration from current schema
- Add `migration_lock.toml` with PostgreSQL provider
- More complex but mirrors production deployment

### Fix 2: Enable Real Test Execution

1. Fix the migration issue (above)
2. Run tests locally first to identify failures:
   ```bash
   E2E_TEST_USER_EMAIL=test@example.com \
   E2E_TEST_USER_PASSWORD=secret \
   npx playwright test --project=chromium --headed
   ```
3. Document actual pass/fail results
4. Fix failures iteratively

### Fix 3: Add MOCK_SERVICES Toggle

Create optional real integration mode:

```typescript
// tests/e2e/utils/helpers.ts
export const MOCK_SERVICES = process.env.MOCK_SERVICES !== 'false';

export async function mockLetterGeneration(page: Page, content?: string): Promise<void> {
  if (!MOCK_SERVICES) {
    return; // Skip mocking - use real API
  }
  // ... existing mock code
}
```

**Usage:**
```bash
# CI mode (fast, mocked)
npm run test:e2e

# Integration mode (real APIs)
MOCK_SERVICES=false npm run test:e2e
```

## Implementation Plan

### Step 1: Fix Database Setup (Priority: Critical)
- Use `prisma db push` instead of `migrate deploy` in CI
- Create `migration_lock.toml` for consistency
- Test seed script runs successfully

### Step 2: Run Tests Against App (Priority: Critical)
- Start app: `npm run dev`
- Run single test: `npx playwright test tests/e2e/flows/auth.spec.ts --headed`
- Document results (X pass, Y fail)
- Fix blocking issues

### Step 3: Add Integration Test Mode (Priority: High)
- Add `MOCK_SERVICES` env var support
- Update helper functions
- Document usage in README

### Secondary Fixes (Time Permitting)
- Refactor serial test state to use fixtures
- Replace hardcoded timeouts with constants
- Add test data cleanup in teardown

## Test Results

_Tests require CI environment with configured secrets to execute._

| Test Suite | Status | Pass | Fail | Notes |
|------------|--------|------|------|-------|
| auth.spec.ts | Ready | - | - | Requires Auth0 secrets |
| manual-consultation.spec.ts | Ready | - | - | Requires Auth0 secrets |
| referral-upload.spec.ts | Ready | - | - | Requires Auth0 secrets |
| style-profile.spec.ts | Ready | - | - | Requires Auth0 secrets |
| accessibility.spec.ts | Ready | - | - | Requires Auth0 secrets |

---

## Implementation Notes (2024-12-25)

### Changes Made

#### 1. Created `migration_lock.toml`
- Added `prisma/migrations/migration_lock.toml` with PostgreSQL provider
- This file is required by Prisma for migration tracking

#### 2. Updated CI Workflow
- Changed from `prisma migrate deploy` to `prisma db push --accept-data-loss` in all three browser jobs (Chromium, Firefox, WebKit)
- `db push` syncs the schema directly without requiring migration history
- This is appropriate for E2E test environments where data is ephemeral

#### 3. Added `MOCK_SERVICES` Toggle
- Added `MOCK_SERVICES` constant to `tests/e2e/utils/helpers.ts`
- Updated all mocking functions to check this flag:
  - `mockApiResponse()`
  - `mockLetterGeneration()`
  - `mockTranscription()`
  - `mockReferralExtraction()`
- Updated workflow test files to use the toggle:
  - `manual-consultation.spec.ts` - all inline mocks now respect the flag
  - `referral-upload.spec.ts` - `setupReferralMocks()` respects the flag
  - `style-profile.spec.ts` - added `setupMockRoute()` helper, all `page.route()` calls now respect the flag
- Updated page objects:
  - `BasePage.ts` - `mockApiResponse()` now respects the flag

#### Usage
```bash
# CI mode (mocked, default)
npm run test:e2e

# Integration mode (real APIs)
MOCK_SERVICES=false npm run test:e2e
```

### Files Modified

| File | Change |
|------|--------|
| `prisma/migrations/migration_lock.toml` | Created - PostgreSQL provider lock |
| `.github/workflows/e2e-tests.yml` | Changed migrate deploy → db push (3 locations) |
| `tests/e2e/utils/helpers.ts` | Added MOCK_SERVICES toggle + updated mock functions |
| `tests/e2e/workflows/manual-consultation.spec.ts` | Import MOCK_SERVICES, update inline mocks |
| `tests/e2e/workflows/referral-upload.spec.ts` | Import MOCK_SERVICES, update setupReferralMocks |
| `tests/e2e/workflows/style-profile.spec.ts` | Added setupMockRoute helper, all page.route() calls converted |
| `tests/e2e/page-objects/BasePage.ts` | Import MOCK_SERVICES, update mockApiResponse() |
| `prisma/scripts/migrate-subspecialties.ts` | Fixed import path (`../../seeds/` → `../seeds/`) |

### Next Steps for Full E2E Execution

1. **Configure GitHub Secrets** - Required secrets must be set in repository settings:
   - `E2E_DATABASE_URL` - Supabase connection string for E2E tests
   - `E2E_TEST_USER_EMAIL` - Auth0 test user email
   - `E2E_TEST_USER_PASSWORD` - Auth0 test user password
   - `AUTH0_ISSUER_BASE_URL` - Auth0 domain
   - `AUTH0_CLIENT_ID` - Auth0 application client ID
   - `AUTH0_CLIENT_SECRET` - Auth0 application client secret

2. **Create Auth0 Test User** - A test user must exist in Auth0 for authentication tests

3. **Push Changes and Verify CI** - Once secrets are configured, push changes to trigger CI workflow

---

## Notes

- The seed script (`scripts/seed-e2e-test-data.ts`) is well-designed and should work once migrations pass
- Test architecture (page objects, fixtures, helpers) is solid
- Auth setup depends on real Auth0 - need secrets configured in CI
- Focus on getting tests running first, then improve pass rate
- The `MOCK_SERVICES` toggle allows running tests in both mocked (CI) and real (integration) modes
