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
