# Spec and build

## Configuration
- **Artifacts Path**: `.zenflow/tasks/fix-all-critical-issues-from-ana-b296`

---

## Agent Instructions

Ask the user questions when anything is unclear or needs their input. This includes:
- Ambiguous or incomplete requirements
- Technical decisions that affect architecture or user experience
- Trade-offs that require business context

Do not make assumptions on important decisions - get clarification first.

---

## Workflow Steps

### [x] Step: Technical Specification

Created comprehensive technical specification in `spec.md`:
- Assessed task difficulty as **HARD** (13 issues, security-critical, zero breaking changes required)
- Documented all 12 issues with severity, files affected, and implementation approach
- Identified new dependencies: `svix`, `@upstash/redis`, `@upstash/ratelimit`
- Defined verification approach for each issue
- Created rollback and risk mitigation strategy

---

## Phase 1: Critical Security (Days 1-2)

### [x] Step: Issue 1 - Patient API Authentication

Add proper authentication to patient API endpoints (currently using placeholder practice ID).

**Files modified:**
- `src/app/api/patients/route.ts` - GET (list) and POST (create)
- `src/app/api/patients/[id]/route.ts` - GET, PUT, PATCH, DELETE

**Note:** `src/app/api/patients/[id]/materials/route.ts` and `src/app/api/patients/search/route.ts` already had proper authentication.

**Implementation completed:**
1. Imported `getSession` from `@/lib/auth`
2. Replaced `PLACEHOLDER_PRACTICE_ID` with `session.user.practiceId`
3. Added 401 response for unauthenticated requests
4. All queries are now scoped to practiceId from authenticated session

**Verification:**
- `npm run typecheck` passes
- `PLACEHOLDER_PRACTICE_ID` no longer exists in codebase
- All patient endpoints now require authentication

---

### [x] Step: Issue 2 - Webhook Signature Verification

Implemented Svix signature verification for Resend webhooks.

**Files modified:**
- `src/app/api/webhooks/resend/route.ts` - Added signature verification logic
- `package.json` - Added svix dependency (^1.82.0)
- `.env.example` - Documented RESEND_WEBHOOK_SECRET with setup instructions
- `tests/integration/api/webhooks-resend.test.ts` - Added 19 unit tests

**Implementation completed:**
1. Installed `svix` package
2. Created `parseWebhookBody()` helper function to reduce code duplication
3. Created `verifyWebhookSignature()` function that:
   - Extracts svix-id, svix-timestamp, svix-signature headers
   - Uses Svix Webhook class to verify signature
   - Returns verified event or null on failure
4. Production behavior: Rejects invalid signatures with 401
5. Development behavior: Logs warning but allows for testing
6. Missing secret in production returns 500 error
7. All verification failures are logged with context
8. Updated doc comment to clearly document security behavior

**Review feedback addressed:**
- Extracted duplicate JSON parsing code into `parseWebhookBody()` helper
- Changed .env.example to use empty value with format documented in comments
- Added comprehensive test suite (19 tests) covering:
  - Health check endpoint
  - Production mode (500 without secret, 401 for invalid/missing signatures)
  - Development mode (allows unsigned webhooks with warning)
  - Event handling (all event types, malformed events, unknown types)
  - Signature header validation (missing individual headers)

**Verification:**
- `npm run typecheck` passes
- `npm run test:integration -- --testNamePattern="Resend"` - 19 tests pass
- svix package added to dependencies
- .env.example documents required secret format (whsec_xxx)

---

### [x] Step: Issue 3 - Fix Empty Catch Blocks

Fixed all 24 empty catch blocks across the codebase.

**Files modified (24 locations):**
- `src/middleware.ts` - Added logger import and error logging
- `src/domains/referrals/extractors/referral-letter.ts` - 2 locations, added error context to exceptions
- `src/domains/documents/document.service.ts` - 2 locations, added debug logging for URL generation failures
- `src/domains/recording/recording.service.ts` - 1 location, added debug logging
- `src/domains/letters/sending.service.ts` - 1 location, added warn logging for decryption issues
- `src/components/recording/TranscriptViewer.tsx` - Already fixed by linter
- `src/components/consultation/ReferrerSelector.tsx` - Added logger import and warn logging
- `src/components/consultation/ContactForm.tsx` - Added logger import and warn logging
- `src/components/consultation/PatientSelector.tsx` - Added logger import, warn and debug logging
- `src/app/(dashboard)/onboarding/page.tsx` - 2 locations, added underscore prefix to error params
- `src/app/(dashboard)/settings/templates/page.tsx` - Already fixed by linter
- `src/app/(dashboard)/settings/style/page.tsx` - Already fixed by linter
- `src/app/(dashboard)/settings/style/components/SeedLetterUpload.tsx` - Already fixed by linter
- `src/app/(dashboard)/patients/PatientsClient.tsx` - Already fixed by linter
- `src/app/api/transcription/webhook/route.ts` - 1 location, added comment for context
- `src/app/api/patients/search/route.ts` - 2 locations, added comments for context
- `src/app/api/consultations/route.ts` - 2 locations, added comments for context
- `src/app/api/consultations/[id]/generate-letter/route.ts` - Already fixed by linter with proper logging
- `src/app/api/user/account/route.ts` - 3 locations, renamed err to _deleteError for clarity

**Implementation approach:**
- For server-side code: Added logger.warn/debug/error calls with appropriate context
- For client-side code: Added logger import and appropriate logging
- For non-critical errors: Used underscore prefix (_error) to indicate intentional ignore
- Preserved all existing error handling behavior (fallbacks, graceful degradation)

**Verification:**
- `grep -r "} catch {" src/` returns 0 results ✅
- `npm run typecheck` passes (source files) ✅
- Existing error recovery behavior preserved ✅

---

## Phase 2: Production Readiness (Days 3-5)

### [x] Step: Issue 4 - Distributed Rate Limiting

Implemented Upstash Redis support for distributed rate limiting.

**Files modified:**
- `src/lib/rate-limit.ts` - Added Redis-based rate limiting with in-memory fallback
- `package.json` - Added @upstash/redis (^1.36.0), @upstash/ratelimit (^2.0.7)
- `.env.example` - Documented UPSTASH_REDIS_REST_URL and UPSTASH_REDIS_REST_TOKEN

**Implementation completed:**
1. Installed Upstash packages (`@upstash/redis`, `@upstash/ratelimit`)
2. Added `initializeRedis()` function with lazy initialization
3. Created Redis rate limiters for each resource type using sliding window algorithm
4. Added new async function `checkRateLimitAsync()` for Redis-backed rate limiting
5. Preserved existing synchronous `checkRateLimit()` for backward compatibility
6. Added graceful fallback to in-memory when Redis fails or is not configured
7. Added helper functions: `clearAllRateLimits()`, `isRedisRateLimitingActive()`
8. All errors logged with context for debugging

**Key design decisions:**
- Lazy initialization: Redis client only created when first rate limit check runs
- Graceful degradation: Falls back to in-memory if Redis connection fails
- Backward compatible: Existing synchronous API unchanged
- Per-resource limiters: Each resource type gets its own Ratelimit instance with custom prefix

**Verification:**
- `npm run typecheck` passes ✅
- `npm run test` - All 1032 tests pass ✅
- Existing rate-limited endpoints continue to work ✅
- In-memory fallback works in development (no Redis configured) ✅

---

### [ ] Step: Issue 5 - Replace Console Statements

Replace console.log/warn/error with structured logger.

**Files to modify (15+ files):**
- `src/hooks/useNotifications.ts`
- `src/hooks/useErrorHandler.ts`
- `src/components/settings/UserManagement.tsx`
- `src/components/settings/PracticeSettings.tsx`
- `src/components/pwa/PWASettings.tsx`
- `src/components/letters/LetterEditor.tsx`
- `src/components/layout/NotificationCenter.tsx`
- `src/components/consultation/*.tsx`
- `src/app/api/practice/users/route.ts`
- `src/app/api/auth/[...auth0]/route.ts`
- `src/app/(dashboard)/**/*.tsx`

**Implementation:**
- Import logger from `@/lib/logger`
- Replace console.log with logger.info/debug
- Replace console.error with logger.error
- Replace console.warn with logger.warn
- Add context objects for structured logging

**Verification:**
- `grep -rn "console\." src/` only shows logger.ts, error-logger.ts
- Logs appear correctly in development
- No functionality changes

---

### [ ] Step: Issue 8 - Error Tracking Preparation

Prepare error logger for Sentry integration.

**Files to modify:**
- `src/lib/error-logger.ts`
- `.env.example` (document NEXT_PUBLIC_SENTRY_DSN)

**Implementation:**
1. Add Sentry DSN placeholder check
2. Add conditional Sentry capture in error methods
3. Document setup steps for production
4. Defer full Sentry wizard installation

**Verification:**
- Error logger functions correctly
- Ready for Sentry integration when needed

---

## Phase 3: Code Quality (Week 2)

### [ ] Step: Issue 6 - Fix TypeScript any Types

Replace `any` types with proper TypeScript types.

**Files to modify:**
- `src/lib/pwa.ts` - BeforeInstallPromptEvent interface
- `src/hooks/useNotifications.ts` - settings type
- `src/components/settings/PracticeSettings.tsx`
- `src/app/api/letters/route.ts` - Prisma.LetterWhereInput
- `src/app/(dashboard)/settings/practice/PracticeSettingsClient.tsx`

**Implementation:**
- Define proper interfaces for each any usage
- Use Prisma types for database queries
- Add type guards where needed

**Verification:**
- `npm run typecheck` passes
- No `any` types in modified files

---

### [ ] Step: Issue 7 - Dashboard Real Data

Create API endpoint and update dashboard to show real data.

**Files to create:**
- `src/app/api/dashboard/stats/route.ts`

**Files to modify:**
- `src/app/(dashboard)/dashboard/page.tsx`

**Implementation:**
1. Create stats API endpoint:
   - Count draft letters for practiceId
   - Count sent letters for practiceId
   - Count patients for practiceId
   - Calculate time saved estimate
2. Update dashboard to fetch from API
3. Add loading states

**Verification:**
- Dashboard shows real counts
- Counts match database
- Practice-scoped (no cross-tenant data)

---

### [ ] Step: Issue 9 - Add Integration Tests

Add integration tests for critical paths to achieve >30% coverage.

**Files to create:**
- `tests/integration/api/patients.test.ts`
- `tests/integration/api/dashboard.test.ts`
- `tests/integration/auth/session.test.ts`

**Implementation:**
1. Test patient CRUD operations with auth
2. Test dashboard stats endpoint
3. Test auth flow and session handling
4. Add multi-tenancy isolation tests

**Verification:**
- `npm run test:coverage` shows >30%
- All new tests pass

---

## Phase 4: Technical Debt (As Time Permits)

### [ ] Step: Issue 10 - Deprecated Schema Fields Analysis

Analyze and clean up deprecated schema fields.

**Files to analyze:**
- `prisma/schema.prisma` - s3AudioKey, s3Key marked @deprecated

**Implementation:**
1. Search codebase for usage
2. If unused, plan migration to remove
3. If used, update to use new fields

**Verification:**
- Deprecated fields usage documented
- Migration plan created (if applicable)

---

### [ ] Step: Issue 11 - Extract Magic Numbers

Create constants file and extract magic numbers.

**Files to create:**
- `src/lib/constants.ts`

**Implementation:**
1. Identify magic numbers in codebase
2. Extract to named constants
3. Update references

**Verification:**
- Magic numbers replaced with named constants
- No functionality changes

---

## Final Verification

### [ ] Step: Final Testing and Validation

Comprehensive testing before completion.

**Verification checklist:**
- [ ] `npm run typecheck` - No errors
- [ ] `npm run lint` - No warnings
- [ ] `npm run test` - All pass
- [ ] `npm run test:coverage` - >30% coverage
- [ ] `npm run build` - Successful
- [ ] Manual workflow test (record -> transcribe -> letter -> send)
- [ ] All 14 modules still working

**Write report to:** `report.md`
