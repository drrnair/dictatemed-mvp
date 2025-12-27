# DictateMED Production Readiness: Implementation Plan

## Configuration
- **Artifacts Path**: `.zenflow/tasks/dictatemed-production-readiness-395f`
- **Difficulty**: Hard
- **Total Subtasks**: 6

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

Created comprehensive specification analyzing:
- Current codebase state vs task requirements
- Identified 23 new files + 15 modified files
- Mapped implementation approach per subtask
- Defined verification strategy

Output: `spec.md`

---

## Subtask 1: Critical Security Fixes (Priority: CRITICAL)

### [x] Step 1.1: E2E Mock Auth Production Guard
<!-- chat-id: 410a2049-59b5-4999-8975-3688bbfc76b0 -->

**Files to create/modify:**
- `src/middleware.ts` - Add NODE_ENV check before E2E_MOCK_AUTH bypass
- `src/lib/env-validation.ts` - New file for dangerous env var validation
- `.github/workflows/env-check.yml` - New workflow to block dangerous deployments

**Verification:**
```bash
NODE_ENV=production E2E_MOCK_AUTH=true npm run build  # Should fail
npm run dev  # Should still work with mock auth in dev
```

**Implementation Notes:**
- Modified `src/middleware.ts:39-55` to add NODE_ENV production guard - if E2E_MOCK_AUTH is enabled in production, it logs a SECURITY VIOLATION error and falls through to real auth (does not bypass)
- Created `src/lib/env-validation.ts` with `validateProductionEnv()` and `assertProductionEnvSafe()` functions that check for dangerous env vars
- Created `.github/workflows/env-check.yml` workflow that runs on PRs and pushes to main, checking for hardcoded dangerous env vars and verifying security guards exist

### [x] Step 1.2: Fix Empty Catch Blocks
<!-- chat-id: 418ca9ce-d22f-48fd-9ca3-ec55e638557c -->

**Files to modify:**
- `src/infrastructure/anthropic/unified-service.ts:416` - Add error logging for cost tracking failure
- `src/app/api/referrals/[id]/extract-structured/route.ts:130` - Add error context
- `src/hooks/useLiteratureSearch.ts:101` - Add debug logging

**New file:**
- `src/lib/error-handler.ts` - Standardized error handling with PHI scrubbing

**ESLint update:**
- `.eslintrc.json` - Add `"no-empty": ["error", { "allowEmptyCatch": false }]`

**Verification:**
```bash
npm run lint  # Should pass, no empty catches allowed
```

**Implementation Notes:**
- Fixed `unified-service.ts:416` - Added debug logging for cost estimation skipped due to unknown model (uses existing `logger.debug`)
- Fixed `extract-structured/route.ts:130` - Added warning log with context when status update fails (document may not exist or was deleted)
- Fixed `useLiteratureSearch.ts:101` - Added development-only console.warn for usage stat refresh failures (non-critical)
- Added ESLint rule `"no-empty": ["error", { "allowEmptyCatch": false }]` to prevent future empty catches
- Added override for test files (`tests/**/*`) to allow empty catches in E2E test cleanup code
- Note: `src/lib/error-logger.ts` (not error-handler.ts) already provides standardized error handling with PHI scrubbing (`logError()`, `logHandledError()`, `filterPHI()`), making a new file unnecessary
- Skipped `@typescript-eslint/no-unused-vars` rule: requires installing `@typescript-eslint/eslint-plugin` which is out of scope. The `no-empty` rule provides sufficient protection.

### [x] Step 1.3: Require Redis for Rate Limiting in Production
<!-- chat-id: c2ed5b8e-d1fa-466c-97e0-5259d7f5ac09 -->

**Files to modify:**
- `src/lib/rate-limit.ts` - Add production enforcement for Redis
- `src/lib/env-validation.ts` - Add UPSTASH_REDIS check

**Verification:**
```bash
# Production build without Redis should fail
NODE_ENV=production npm run build  # Should error if Redis not configured
```

**Implementation Notes:**
- Created `RedisRequiredError` class in `rate-limit.ts` that is thrown when Redis is not configured in production
- Updated `initializeRedis()` function to throw `RedisRequiredError` if `isProductionEnv()` returns true and Redis env vars are missing
- Updated `checkRateLimit()` (sync) to call `initializeRedis()` at the start, ensuring the production check happens for all rate limit calls
- Updated `checkRateLimitAsync()` to not catch `RedisRequiredError` - lets it propagate up
- Updated `env-validation.ts` to require `UPSTASH_REDIS_REST_URL` and `UPSTASH_REDIS_REST_TOKEN` in production (changed from warning to error)
- Fixed `isRedisRateLimitingActive()` to gracefully handle `RedisRequiredError` (returns false instead of throwing) for safe diagnostic checks
- Added 4 new unit tests: RedisRequiredError class behavior, isRedisRateLimitingActive(), and production behavior documentation
- All 24 rate-limit unit tests pass (run in non-production environment)

### [x] Step 1.4: Add Content Security Policy Headers
<!-- chat-id: b7f19c82-6085-4ef6-8f14-fb14350a4ff7 -->

**Files modified:**
- `next.config.js` - Added comprehensive CSP header to security headers array

**New file created:**
- `src/app/api/csp-report/route.ts` - CSP violation reporting endpoint

**Verification:**
```bash
curl -I http://localhost:3000 | grep -i content-security-policy
npm run dev  # Check console for CSP violations
```

**Implementation Notes:**
- Added Content Security Policy header to `next.config.js` with comprehensive directives:
  - `default-src 'self'` - Default fallback restricts all content to same origin
  - `script-src 'self' 'unsafe-eval' 'unsafe-inline'` - Scripts (Next.js requires unsafe-eval/inline)
  - `style-src 'self' 'unsafe-inline'` - Styles (Tailwind CSS requires unsafe-inline)
  - `img-src 'self' data: blob: https://*.supabase.co` - Images from Supabase storage
  - `font-src 'self' data:` - Fonts via Next.js Google Fonts optimization
  - `connect-src` - All required APIs: Supabase, Anthropic, Deepgram, Resend, OpenAI, PubMed, UpToDate, Upstash
  - `media-src 'self' blob: https://*.supabase.co` - Audio/video recordings
  - `object-src 'none'` - Block Flash/Java plugins
  - `frame-ancestors 'none'` - Prevent clickjacking
  - `frame-src 'self' blob: https://*.supabase.co` - PDF preview iframes
  - `worker-src 'self' blob:` - PWA service workers
  - `upgrade-insecure-requests` - Force HTTPS
  - `report-uri /api/csp-report` - Send violations to reporting endpoint
- Created CSP violation reporting endpoint with:
  - Rate limiting (50 reports/min per IP)
  - Browser extension noise filtering
  - Structured logging for security monitoring
- TypeScript check passes, build compiles successfully

---

## Subtask 2: Authentication & Authorization

### [x] Step 2.1: Create Data Access Layer
<!-- chat-id: 89ab95a3-ada3-4e78-915b-d35033839ab0 -->

**Files created/modified:**
- `src/lib/dal/base.ts` - Auth helpers: getCurrentUserOrThrow(), verifyOwnership(), custom errors (UnauthorizedError, ForbiddenError, NotFoundError)
- `src/lib/dal/letters.ts` - Letter CRUD with built-in auth and PHI audit logging
- `src/lib/dal/recordings.ts` - Recording operations with auth and PHI audit logging
- `src/lib/dal/documents.ts` - Document operations with auth and PHI audit logging
- `src/lib/dal/api-handler.ts` - API route error handler utilities (handleDALError, isDALError, withDALErrorHandling)
- `src/lib/dal/index.ts` - Barrel export

**Implementation Notes:**
- DAL files already existed and were largely complete
- Fixed Prisma JSON type issues (`Prisma.JsonValue` → `Prisma.InputJsonValue` for update inputs)
- Fixed patient data fetching in updateLetter (removed include, fetch separately)
- Added PHI access audit logging to all read operations (getLetter, getRecording, getDocument)
- Added PHI modification audit logging to all write operations (updateLetter, approveLetter, deleteLetter, deleteRecording, deleteDocument)
- Audit logs capture: action, resourceType, resourceId, userId, and relevant metadata (patientId, documentType, etc.)
- Fixed MinimalLogger interface in api-handler.ts to work with both root logger and child loggers

**Verification:**
```bash
npm run typecheck  # ✅ Passes
npm run lint       # ✅ Passes (only unrelated warnings in other files)
```

### [x] Step 2.2: Migrate API Routes to DAL
<!-- chat-id: c15afa23-ce5f-46a0-85a1-8f36e38ca22f -->

**Files created/modified:**
- `src/lib/dal/base.ts` - Added `ValidationError` class for business rule violations (400 status)
- `src/lib/dal/api-handler.ts` - Added ValidationError handling to isDALError() and handleDALError()
- `src/lib/dal/letters.ts` - Added `saveLetterDraft()`, `getLetterForSending()` functions with auth/validation
- `src/lib/dal/recordings.ts` - Added `getRecordingForUpload()`, `setRecordingStoragePath()` functions
- `src/app/api/letters/route.ts` - Updated GET to use DAL listLetters()
- `src/app/api/letters/[id]/route.ts` - Updated PATCH to use saveLetterDraft(), DELETE to use deleteLetter()
- `src/app/api/letters/[id]/send/route.ts` - Updated to use getLetterForSending() for practice-level auth
- `src/app/api/recordings/[id]/upload-url/route.ts` - Updated to use getRecordingForUpload(), setRecordingStoragePath()
- `src/app/api/recordings/route.ts` - Updated to use DAL's getCurrentUserOrThrow()
- `src/app/api/documents/route.ts` - Updated to use DAL's getCurrentUserOrThrow()

**Implementation Notes:**
- Added `ValidationError` class for business logic errors (e.g., "cannot edit approved letter")
- Added practice-level authorization for letter sending (any user in same practice can send approved letters)
- Used dynamic imports (`await import('./base')`) to prevent linter from removing "unused" imports
- handleDALError() maps: UnauthorizedError→401, ForbiddenError→403, NotFoundError→404, ValidationError→400
- isDALError() type guard expanded to include ValidationError
- All routes now use DAL functions for consistent auth, ownership verification, and audit logging
- Routes continue to use domain services for business logic, but get auth from DAL

**Verification:**
```bash
npm run typecheck  # ✅ Passes
npm run lint       # ✅ Passes
```

### [x] Step 2.3: Add Route-Specific Error Boundaries

**New files created:**
- `src/app/(dashboard)/dashboard/error.tsx` - Dashboard error boundary
- `src/app/(dashboard)/patients/error.tsx` - Patients error boundary
- `src/app/(dashboard)/settings/error.tsx` - Settings error boundary

**Implementation Notes:**
- Added error boundaries for routes that were missing them
- All use the existing ErrorFallback component for consistent UI
- Each logs errors with appropriate severity (high for dashboard/patients, medium for settings)
- Pre-existing error boundaries: `/` (root), `/letters`, `/letters/[id]`, `/record`

**Verification:**
```bash
npm run typecheck  # ✅ Passes
```

---

## Subtask 3: Error Handling & Monitoring

### [x] Step 3.1: Install and Configure Sentry

**Installed:**
```bash
npm install @sentry/nextjs
```

**New files created:**
- `sentry.client.config.ts` - Client config with comprehensive PHI scrubbing
- `sentry.server.config.ts` - Server config with PHI scrubbing
- `sentry.edge.config.ts` - Edge runtime config with PHI scrubbing

**Modified:**
- `next.config.js` - Wrapped with withSentryConfig (production only)
- `src/instrumentation.ts` - Initialize Sentry via instrumentation hook

**Implementation Notes:**
- PHI Scrubbing implemented in all 3 config files:
  - scrubPHI() function removes: Medicare numbers, phone numbers, emails, dates, UUIDs
  - scrubObjectPHI() recursively redacts sensitive keys: patient, name, email, phone, dob, medicare, address, etc.
  - scrubURLPHI() removes UUIDs and query params from URLs
- Session replay enabled with maskAllText and blockAllMedia for PHI protection
- beforeSend hooks scrub: error messages, exception values, breadcrumbs, stack trace variables
- beforeBreadcrumb hooks filter console breadcrumbs (may contain PHI)
- 10% trace sample rate in production, 10% session replay, 100% on error
- ignoreErrors configured to reduce noise (extension errors, network errors, abort errors)
- denyUrls configured to ignore browser extensions
- excludeServerRoutes moved to webpack config to fix deprecation warning

**Verification:**
```bash
npm run typecheck  # ✅ Passes
npm run lint       # ✅ Passes (no deprecation warnings)
```

### [x] Step 3.2: Create Security Event Logger

**New file created:**
- `src/lib/security-logger.ts` - Comprehensive security event logging API

**Implementation Notes:**
- Created SecurityEventType enum: auth events, authz events, rate limit, suspicious activity, PHI access, config violations, etc.
- Created SecuritySeverity levels: low, medium, high, critical
- Core API:
  - `securityLogger.authEvent()` - Login success/failure, logout, token refresh, session expired
  - `securityLogger.authzFailure()` - Authorization denied events
  - `securityLogger.rateLimit()` - Rate limit exceeded
  - `securityLogger.suspicious()` - Suspicious activity detection
  - `securityLogger.phiAccess()` - PHI access audit trail
  - `securityLogger.configViolation()` - Dangerous configuration detected
  - `securityLogger.inputValidation()` - Input validation failures
  - `securityLogger.cspViolation()` - CSP violations
  - `securityLogger.custom()` - Custom security events
- Integration with Sentry: high/critical events automatically sent to Sentry
- PHI scrubbing in context before logging (sensitive keys redacted)
- Structured logging for CloudWatch compatibility

**Verification:**
```bash
npm run typecheck  # ✅ Passes
```

### [x] Fix: Add assertProductionEnvSafe() at Startup

**Modified:**
- `src/instrumentation.ts` - Added call to assertProductionEnvSafe() at startup

**Implementation Notes:**
- Used Next.js 14+ instrumentation hook (idiomatic approach)
- Validates environment before Sentry initialization
- Runs in Node.js runtime only (not Edge)
- Throws on critical config violations (prevents app startup)
- Also initializes Sentry server/edge configs via instrumentation

**Verification:**
```bash
npm run typecheck  # ✅ Passes
```

### [x] Step 3.3: Enhance Health Endpoint
<!-- chat-id: c0a15e55-458b-4ad7-8c76-e6a8494a09f3 -->

**File modified:**
- `src/app/api/health/route.ts` - Complete rewrite with comprehensive service checks

**Implementation Notes:**
- Added 5 service checks (up from 4): database, redis, deepgram, anthropic, supabase
- Each check now includes latency metrics in milliseconds
- Database check: runs `SELECT 1` query + user count for thorough connectivity test
- Redis check: uses `isRedisRateLimitingActive()` which safely checks Redis without throwing in production
- Anthropic check: validates ANTHROPIC_API_KEY or Bedrock config (AWS_REGION + USE_BEDROCK)
- Supabase check: actually calls `listBuckets()` API and verifies required buckets exist
- Deepgram check: validates API key configuration
- Added environment info: version (git SHA), environment name, uptime in seconds
- Added summary statistics: totalChecks, passing, failing, degraded counts
- Added cache headers: X-Health-Cached, X-Cache-Age for observability
- Status logic: database down = unhealthy, Redis down in production = unhealthy, other failures = degraded
- All external service checks respect mock environment variables for testing
- Logging added for non-healthy statuses and exceptions

**Verification:**
```bash
npm run typecheck  # ✅ Passes
```

### [x] Step 3.4: Add Transaction Wrapping for Critical Operations
<!-- chat-id: 681f8d30-42cb-415c-9225-41cf2953afb2 -->

**Files modified:**
- `src/domains/letters/sending.service.ts` - Wrapped all DB operations in transactions
- `src/infrastructure/email/email.service.ts` - Wrapped all DB operations in transactions
- `src/domains/letters/approval.service.ts` - Already uses transaction (no change needed)

**Implementation Notes:**
- `approval.service.ts:approveLetter()` already correctly uses `prisma.$transaction()` for all critical operations (lines 241-394)
- Updated `sending.service.ts:sendLetter()` to use proper transaction pattern:
  - Step 1: Create LetterSend record with SENDING status in transaction
  - Step 2: Attempt email send (external API - cannot be in transaction)
  - Step 3: Update status (SENT/FAILED) and audit log in transaction
  - Ensures atomicity of DB operations while handling external API calls gracefully
- Updated `sending.service.ts:retrySend()` with same pattern
- Updated `email.service.ts:sendLetterEmail()` with same pattern:
  - Create pending email record in transaction
  - Send via Resend (external API)
  - Update status + create audit log atomically in transaction
- Updated `email.service.ts:updateEmailStatus()` to update status + audit log atomically
- Removed unused `createEmailAuditLog()` helper function (dead code after refactor)
- Key insight: External API calls (email sending) cannot be part of a DB transaction because:
  - If transaction rolls back, email cannot be "unsent"
  - External calls can be slow and would hold transaction lock too long

**Verification:**
```bash
npm run typecheck  # ✅ Passes
```

---

## Subtask 4: Security Hardening

### [x] Step 4.1: Add Dependency Scanning to CI
<!-- chat-id: 6271b313-4051-40e5-8225-38f4521c0f4f -->

**New file created:**
- `.github/workflows/security.yml` - Comprehensive security scanning workflow

**Implementation Notes:**
- Created `.github/workflows/security.yml` with 4 jobs:
  1. **dependency-scan**: Snyk vulnerability scanning (if SNYK_TOKEN configured) + npm audit fallback + outdated package check
  2. **secret-scan**: TruffleHog for git history + manual regex patterns for AWS keys, private keys, DB connection strings
  3. **license-check**: license-checker with allowed permissive licenses (MIT, Apache-2.0, BSD, ISC, etc.) + generates JSON/CSV reports
  4. **security-summary**: Aggregates results and adds summary to PR
- Runs on: push to main, PRs to main, weekly schedule (Mondays 9am UTC), manual trigger
- Permissions: `contents: read`, `security-events: write` (for SARIF upload)
- Uses `continue-on-error: true` for Snyk/TruffleHog to report issues without blocking builds
- License check is strict - fails if non-allowed license found
- Artifacts: snyk-results.json, license-report.json/csv (30 day retention)

**Verification:**
```bash
# Workflow file syntax is valid YAML
# Will run automatically on next push/PR to main
```

### [ ] Step 4.2: Add Webhook IP Allowlisting
<!-- chat-id: 293ed643-422f-4ba0-a3ef-658573f9d6e0 -->

**File to modify:**
- `src/middleware.ts` - Add IP validation for /api/transcription/webhook, /api/webhooks/resend

**Verification:**
- Verify webhooks still work from correct IPs
- Verify blocked from other IPs

### [ ] Step 4.3: Enable Renovate

**New file:**
- `renovate.json` - Auto-merge minor/patch, security alerts

**Verification:**
- Renovate should create PRs for outdated deps

---

## Subtask 5: Performance & Caching

### [ ] Step 5.1: Install and Configure React Query

**Install:**
```bash
npm install @tanstack/react-query @tanstack/react-query-devtools
```

**New files:**
- `src/lib/react-query.ts` - Query client configuration
- `src/app/providers.tsx` - QueryClientProvider wrapper
- `src/hooks/useLetters.ts` - Letters query hooks
- `src/hooks/useRecordings.ts` - Recordings query hooks

**Modify:**
- `src/app/layout.tsx` - Import providers

**Verification:**
- React Query DevTools visible in dev
- Network tab shows caching working

### [ ] Step 5.2: Add Optimistic Updates

**Modify hooks:**
- `src/hooks/useLetters.ts` - Add optimistic update for approve/send

**Verification:**
- UI updates immediately before server confirms

### [ ] Step 5.3: Add Cache Wrappers

**New file:**
- `src/lib/cache.ts` - unstable_cache wrappers for templates, settings

**Verification:**
- Same data fetched twice hits cache

### [ ] Step 5.4: Enable ISR for Static Pages

**Modify:**
- `src/app/(marketing)/about/page.tsx` - Add `export const revalidate = 3600`
- Other marketing pages

**Verification:**
```bash
curl -I http://localhost:3000/about | grep cache
```

---

## Subtask 6: Developer Experience

### [ ] Step 6.1: Add Pre-commit Hooks

**Install:**
```bash
npm install --save-dev husky lint-staged
npx husky install
```

**New files:**
- `.husky/pre-commit`
- `.lintstagedrc.js`

**Modify:**
- `package.json` - Add "prepare": "husky install"

**Verification:**
```bash
git add . && git commit -m "test"
# Should run lint + typecheck before commit
```

### [ ] Step 6.2: Add Performance Measurement Helper

**New file:**
- `src/lib/performance.ts` - measureAsync() helper

**Verification:**
- Wrap expensive operation, verify timing logged

---

## Final Verification

### [ ] Step: Complete Verification Suite

```bash
npm run lint          # All lint rules pass
npm run typecheck     # No type errors
npm run test          # All unit tests pass
npm run build         # Production build succeeds
npm run test:e2e      # E2E tests pass
```

### [ ] Step: Write Implementation Report

Output: `report.md` containing:
- What was implemented
- How the solution was tested
- Challenges encountered
- Remaining work or recommendations

---

## Completion Checklist

### Critical (Must complete for production)
- [x] E2E_MOCK_AUTH blocked in production
- [x] Empty catch blocks fixed
- [x] Redis required for rate limiting
- [x] CSP headers active
- [x] assertProductionEnvSafe() called at startup (via instrumentation.ts)

### High Priority
- [x] DAL pattern implemented (base.ts, letters.ts, recordings.ts, documents.ts, api-handler.ts)
- [x] Error boundaries on key routes (dashboard, patients, settings - in addition to existing ones)
- [x] Sentry configured with PHI scrubbing (client, server, edge configs)
- [x] Security logging active (security-logger.ts with auth, authz, rate limit, PHI access logging)

### Medium Priority
- [x] Dependency scanning in CI
- [ ] Webhook IP allowlisting
- [ ] React Query caching
- [ ] Pre-commit hooks

### Nice to Have
- [ ] Optimistic updates
- [ ] ISR for marketing pages
- [ ] Performance helpers
- [x] Enhanced health endpoint
- [x] Transaction wrapping for critical operations
