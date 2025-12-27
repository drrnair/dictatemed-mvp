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
- All 20 rate-limit unit tests pass (run in non-production environment)
- TypeScript type check passes

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

### [ ] Step 2.2: Migrate API Routes to DAL

**Files to modify:**
- `src/app/api/letters/route.ts` - Use DAL for letter operations
- `src/app/api/letters/[id]/route.ts` - Use DAL with ownership verification
- `src/app/api/recordings/route.ts` - Use DAL
- `src/app/api/documents/route.ts` - Use DAL

**Verification:**
```bash
npm run test:e2e  # E2E tests still pass
# Manual test: access another user's resource should fail
```

### [ ] Step 2.3: Add Route-Specific Error Boundaries

**New files:**
- `src/app/(dashboard)/clinical-assistant/error.tsx`
- `src/app/(dashboard)/referrals/error.tsx`
- `src/app/(dashboard)/settings/error.tsx`

**Verification:**
- Throw test error in each route, verify error boundary catches it

---

## Subtask 3: Error Handling & Monitoring

### [ ] Step 3.1: Install and Configure Sentry

**Install:**
```bash
npx @sentry/wizard@latest -i nextjs
```

**New files:**
- `sentry.client.config.ts` - Client config with PHI scrubbing
- `sentry.server.config.ts` - Server config
- `sentry.edge.config.ts` - Edge runtime config

**Modify:**
- `next.config.js` - Wrap with withSentryConfig

**Verification:**
- Trigger test error, verify appears in Sentry dashboard
- Verify PHI fields are redacted

### [ ] Step 3.2: Create Security Event Logger

**New file:**
- `src/lib/security-logger.ts` - Functions: logAuthFailure(), logRateLimitHit(), logUnauthorizedAccess()

**Integration points:**
- `src/middleware.ts` - Log auth failures
- `src/lib/rate-limit.ts` - Log rate limit hits
- `src/lib/dal/base.ts` - Log ownership violations

**Verification:**
- Trigger auth failure, verify logged
- Trigger rate limit, verify logged

### [ ] Step 3.3: Enhance Health Endpoint

**File to modify:**
- `src/app/api/health/route.ts` - Add Redis check, Anthropic check, response time metrics

**Verification:**
```bash
curl http://localhost:3000/api/health | jq
# Should show all service checks
```

### [ ] Step 3.4: Add Transaction Wrapping for Critical Operations

**Files to modify:**
- `src/domains/letters/approval.service.ts` - Wrap in transaction
- Email sending operations - Wrap in transaction

**Verification:**
- Simulate failure mid-operation, verify rollback

---

## Subtask 4: Security Hardening

### [ ] Step 4.1: Add Dependency Scanning to CI

**New file:**
- `.github/workflows/security.yml` - Snyk scan, TruffleHog, license check

**Verification:**
```bash
# Push to PR, verify security scan runs
```

### [ ] Step 4.2: Add Webhook IP Allowlisting

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

### High Priority
- [ ] DAL pattern implemented
- [ ] Error boundaries on all routes
- [ ] Sentry configured with PHI scrubbing
- [ ] Security logging active

### Medium Priority
- [ ] Dependency scanning in CI
- [ ] Webhook IP allowlisting
- [ ] React Query caching
- [ ] Pre-commit hooks

### Nice to Have
- [ ] Optimistic updates
- [ ] ISR for marketing pages
- [ ] Performance helpers
