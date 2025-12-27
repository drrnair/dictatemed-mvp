# Technical Specification: DictateMED Production Readiness

## Overview

**Difficulty**: Hard
**Scope**: Major production hardening initiative covering security, monitoring, performance, and developer experience
**Estimated Effort**: 35 hours across 6 logical subtasks

---

## Technical Context

### Stack
- **Framework**: Next.js 14.2.0 (App Router, TypeScript strict mode)
- **Database**: PostgreSQL with Prisma 6.19.1 ORM
- **Auth**: Auth0 via `@auth0/nextjs-auth0` v3.5.0
- **AI**: Anthropic Claude API (`@anthropic-ai/sdk` v0.39.0)
- **Storage**: Supabase Storage
- **Email**: Resend with Svix webhook verification
- **Transcription**: Deepgram SDK v3.13.0
- **Rate Limiting**: Upstash Redis (optional, in-memory fallback)
- **Testing**: Vitest (unit), Playwright (E2E)

### Current Security State
- **Strengths**: PHI encryption (AES-256-GCM), security headers in next.config.js, webhook signature verification, practice-based isolation, rate limiting infrastructure, structured logging, error boundaries exist
- **Gaps**: E2E_MOCK_AUTH bypass lacks production guard, CSP headers missing, no Sentry integration, empty catch block at unified-service.ts:416, audit logging not centralized, no Data Access Layer pattern

---

## Analysis of Task Requirements vs. Codebase

### Subtask 1: Critical Security Fixes

| Issue | Task Description | Actual Codebase State | Delta |
|-------|-----------------|----------------------|-------|
| 1.1 E2E Mock Auth | Add production guard at middleware.ts:39 | Lines 36-44: No NODE_ENV check, bypasses auth when E2E_MOCK_AUTH=true | **Needs implementation** |
| 1.2 Empty Catches | Fix 3 empty catches at unified-service.ts:416, extract-structured/route.ts:130, useLiteratureSearch.ts:101 | unified-service.ts:416 has `catch { }` (line 416); extract-structured/route.ts:130 has `catch { // Ignore }` (line 130); useLiteratureSearch.ts:101 has `catch { // Silently fail }` (line 101) | **1 real empty catch found (line 416), 2 others have comments but minimal handling** |
| 1.3 Redis Rate Limit | Require Redis in production | rate-limit.ts: Graceful fallback, logs debug message, no production enforcement | **Needs enforcement** |
| 1.4 CSP Headers | Add Content-Security-Policy | next.config.js: Has security headers BUT missing CSP | **Needs implementation** |

### Subtask 2: Authentication & Authorization

| Issue | Actual State | Delta |
|-------|-------------|-------|
| Data Access Layer | No centralized DAL exists - auth checks scattered in API routes | **Create new `src/lib/dal/` structure** |
| Error Boundaries | Global error.tsx exists + 3 route-specific ones (letters, letters/[id], record) | **Partial - add more route boundaries** |
| Audit Logging | AuditLog model exists in schema, some usage in services | **Needs centralization and consistent use** |

### Subtask 3: Error Handling & Monitoring

| Issue | Actual State | Delta |
|-------|-------------|-------|
| Sentry | Not installed (dependencies don't include @sentry/nextjs) | **Install and configure** |
| Structured Logging | logger.ts exists with structured format | **Good - may need PHI scrubbing** |
| Security Logging | No dedicated security event logger | **Create new module** |
| Health Endpoint | Exists at /api/health with caching | **Good - may enhance** |

### Subtask 4: Security Hardening

| Issue | Actual State | Delta |
|-------|-------------|-------|
| Dependency Scanning | CI workflow exists but no security scanning | **Add Snyk/security jobs** |
| Webhook IP Allowlist | Not implemented | **Add to middleware** |
| Renovate | Not configured | **Add renovate.json** |

### Subtask 5: Performance & Caching

| Issue | Actual State | Delta |
|-------|-------------|-------|
| React Query | Not installed | **Install @tanstack/react-query** |
| unstable_cache | Not used | **Add cache wrappers** |
| ISR | Not configured for static pages | **Add revalidate to marketing pages** |

### Subtask 6: Developer Experience

| Issue | Actual State | Delta |
|-------|-------------|-------|
| Husky/lint-staged | Not installed | **Install and configure** |
| Seed Script | prisma/seed.ts exists | **Already implemented** |
| Performance Helpers | Not present | **Add measurement utilities** |

---

## Implementation Approach

### Phase 1: Critical Security (Subtask 1) - MUST COMPLETE FIRST

#### 1.1 E2E Mock Auth Production Guard
**File**: `src/middleware.ts`
**Change**: Add NODE_ENV check before allowing mock auth bypass

```typescript
// Add at line 38, before the existing check
if (process.env.E2E_MOCK_AUTH === 'true') {
  if (process.env.NODE_ENV === 'production') {
    logger.error('SECURITY: E2E_MOCK_AUTH enabled in production - ignoring');
    // Fall through to normal auth
  } else {
    const response = NextResponse.next();
    response.headers.set('X-E2E-Mock-Auth', 'true');
    return response;
  }
}
```

**New File**: `src/lib/env-validation.ts`
- Validate dangerous env vars at startup
- Throw error if E2E_MOCK_AUTH/DISABLE_AUTH/DEBUG_MODE are true in production

**New File**: `.github/workflows/env-check.yml`
- Block deployment if dangerous vars detected

#### 1.2 Empty Catch Blocks
**Files to modify**:
1. `src/infrastructure/anthropic/unified-service.ts:416` - Add proper error handling with logging
2. `src/app/api/referrals/[id]/extract-structured/route.ts:130` - Log the ignored error
3. `src/hooks/useLiteratureSearch.ts:101` - Log non-critical failure

**New File**: `src/lib/error-handler.ts`
- Standardized error handling helper
- PHI scrubbing before logging

**ESLint Update**: `.eslintrc.json`
- Add rule: `"no-empty": ["error", { "allowEmptyCatch": false }]`

#### 1.3 Redis Rate Limiting Required
**File**: `src/lib/rate-limit.ts`
**Change**: Add production enforcement

```typescript
// In checkRateLimitAsync, after initializeRedis()
if (process.env.NODE_ENV === 'production' && !redisInitialized) {
  throw new Error('CONFIGURATION ERROR: Redis required for rate limiting in production');
}
```

**File**: `src/lib/env-validation.ts`
- Add check for UPSTASH_REDIS_REST_URL/TOKEN in production

#### 1.4 CSP Headers
**File**: `next.config.js`
**Change**: Add Content-Security-Policy header to existing headers array

```javascript
{
  key: 'Content-Security-Policy',
  value: [
    "default-src 'self'",
    "script-src 'self' 'unsafe-eval' 'unsafe-inline' https://cdn.vercel-insights.com https://va.vercel-scripts.com",
    "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
    "img-src 'self' data: blob: https://*.supabase.co",
    "font-src 'self' https://fonts.gstatic.com",
    "connect-src 'self' https://*.supabase.co https://api.anthropic.com https://api.deepgram.com https://*.upstash.io wss://*.deepgram.com",
    "media-src 'self' blob: https://*.supabase.co",
    "object-src 'none'",
    "frame-ancestors 'none'",
    "upgrade-insecure-requests",
  ].join('; '),
}
```

### Phase 2: Auth & Data Access (Subtask 2)

#### Data Access Layer
**New Files**:
- `src/lib/dal/base.ts` - getCurrentUser(), verifyOwnership(), custom errors
- `src/lib/dal/letters.ts` - All letter CRUD with auth
- `src/lib/dal/recordings.ts` - Recording operations
- `src/lib/dal/documents.ts` - Document operations
- `src/lib/dal/index.ts` - Barrel export

**API Route Migration** (examples):
- `src/app/api/letters/route.ts` - Import from DAL, wrap with try/catch
- `src/app/api/letters/[id]/route.ts` - Use getLetter/updateLetter from DAL

#### Error Boundaries
**New/Update Files**:
- `src/app/(dashboard)/clinical-assistant/error.tsx`
- `src/app/(dashboard)/referrals/error.tsx`
- `src/app/(dashboard)/settings/error.tsx`

### Phase 3: Monitoring (Subtask 3)

#### Sentry Integration
**Install**: `@sentry/nextjs`
**New Files**:
- `sentry.client.config.ts` - Client-side config with PHI scrubbing
- `sentry.server.config.ts` - Server-side config
- `sentry.edge.config.ts` - Edge runtime config
- `next.config.js` - Wrap with withSentryConfig

#### Security Event Logger
**New File**: `src/lib/security-logger.ts`
- logAuthFailure()
- logRateLimitHit()
- logSuspiciousActivity()
- logUnauthorizedAccess()

#### Enhanced Health Check
**File**: `src/app/api/health/route.ts`
- Add Redis check
- Add Anthropic API check
- Add response time metrics

### Phase 4: Security Hardening (Subtask 4)

#### CI Security Scanning
**New File**: `.github/workflows/security.yml`
- Snyk vulnerability scan
- TruffleHog secret scan
- License checker
- npm audit

#### Webhook IP Allowlisting
**File**: `src/middleware.ts`
- Add IP validation for webhook paths
- Configure Deepgram/Resend IP ranges

#### Renovate
**New File**: `renovate.json`
- Auto-merge minor/patch
- Security alerts enabled

### Phase 5: Performance (Subtask 5)

#### React Query
**Install**: `@tanstack/react-query`, `@tanstack/react-query-devtools`
**New Files**:
- `src/lib/react-query.ts` - Query client config
- `src/app/providers.tsx` - QueryClientProvider wrapper
- `src/hooks/useLetters.ts` - Query hooks
- `src/hooks/useRecordings.ts` - Query hooks

#### Caching
**New File**: `src/lib/cache.ts`
- Wrappers using unstable_cache for:
  - User settings
  - Templates
  - Specialty data

#### ISR
**Update Files**:
- `src/app/(marketing)/about/page.tsx` - Add `export const revalidate = 3600`
- Other marketing pages

### Phase 6: Developer Experience (Subtask 6)

#### Pre-commit Hooks
**Install**: `husky`, `lint-staged`
**New Files**:
- `.husky/pre-commit`
- `.lintstagedrc.js`

**Update**: `package.json`
- Add "prepare": "husky install"

#### Performance Helper
**New File**: `src/lib/performance.ts`
- measureAsync() wrapper

---

## Source Code Structure Changes

### New Files (23 total)
```
src/lib/
├── dal/
│   ├── base.ts
│   ├── letters.ts
│   ├── recordings.ts
│   ├── documents.ts
│   └── index.ts
├── env-validation.ts
├── error-handler.ts
├── security-logger.ts
├── cache.ts
├── react-query.ts
└── performance.ts

src/app/
├── providers.tsx
└── (dashboard)/
    ├── clinical-assistant/error.tsx
    ├── referrals/error.tsx
    └── settings/error.tsx

src/hooks/
├── useLetters.ts
└── useRecordings.ts

sentry.client.config.ts
sentry.server.config.ts
sentry.edge.config.ts
.github/workflows/security.yml
.github/workflows/env-check.yml
renovate.json
.husky/pre-commit
.lintstagedrc.js
```

### Modified Files (15 total)
```
src/middleware.ts
src/lib/rate-limit.ts
src/infrastructure/anthropic/unified-service.ts
src/app/api/referrals/[id]/extract-structured/route.ts
src/hooks/useLiteratureSearch.ts
src/app/api/health/route.ts
src/app/layout.tsx (import providers)
next.config.js
.eslintrc.json
package.json
tsconfig.json (if needed)
src/app/api/letters/route.ts
src/app/api/letters/[id]/route.ts
src/app/(marketing)/about/page.tsx
Other marketing pages (ISR)
```

---

## Data Model Changes

**No schema changes required** - AuditLog model already exists in Prisma schema.

---

## API Changes

**No breaking API changes** - All changes are internal implementation.

New internal endpoint for CSP violation reporting:
- `POST /api/csp-report` - Receives CSP violation reports

---

## Verification Approach

### Per-Subtask Verification

#### Subtask 1: Critical Security
```bash
# Test E2E mock auth guard
NODE_ENV=production E2E_MOCK_AUTH=true npm run build
# Should fail with security error

# Verify CSP headers
curl -I https://localhost:3000 | grep -i content-security-policy

# Test rate limiting
npm run dev
# Hit endpoint rapidly to trigger rate limit
```

#### Subtask 2: Auth & DAL
```bash
npm run typecheck
npm run test -- --grep "dal"
# Verify ownership errors thrown for wrong user
```

#### Subtask 3: Monitoring
```bash
# Verify Sentry captures test error
# Check health endpoint returns all service checks
curl http://localhost:3000/api/health | jq
```

#### Subtask 4: Security
```bash
# Run security scan
npm run lint
# Check for vulnerabilities
npm audit
```

#### Subtask 5: Performance
```bash
# Check React Query DevTools in browser
# Verify cache headers on static pages
curl -I https://localhost:3000/about | grep cache
```

#### Subtask 6: DX
```bash
# Test pre-commit hook
git add . && git commit -m "test"
# Should run lint + typecheck
```

### Full Verification
```bash
npm run verify:full  # lint + typecheck + test + e2e
npm run build       # Production build must succeed
```

---

## Risk Assessment

| Risk | Mitigation |
|------|-----------|
| CSP breaks existing features | Start with report-only mode, fix violations incrementally |
| Redis requirement breaks dev environment | Keep in-memory fallback for non-production |
| DAL migration breaks API routes | Migrate one route at a time, test each |
| Sentry SDK increases bundle size | Use dynamic imports for client-side |
| React Query adds complexity | Start with 2-3 hooks, expand incrementally |

---

## Implementation Order

Due to dependencies and critical nature:

1. **Subtask 1.1**: E2E Mock Auth Guard (blocks: production deployment)
2. **Subtask 1.2**: Empty Catch Blocks (quick win)
3. **Subtask 1.4**: CSP Headers (can be report-only initially)
4. **Subtask 1.3**: Redis Rate Limiting (production requirement)
5. **Subtask 3.1**: Sentry (needed for visibility)
6. **Subtask 2.1**: DAL (foundation for auth hardening)
7. Remaining subtasks in order

---

## Success Criteria

- [ ] All CI checks pass (lint, typecheck, test, build)
- [ ] E2E_MOCK_AUTH rejected in production
- [ ] CSP headers present on all pages
- [ ] Redis required for production rate limiting
- [ ] No empty catch blocks in codebase
- [ ] Sentry capturing errors with PHI redacted
- [ ] Health endpoint checks all services
- [ ] DAL pattern used for all data access
- [ ] Pre-commit hooks running lint + typecheck
