# Technical Specification: Fix All Critical Issues from Analysis Report

## Task Difficulty Assessment: **HARD**

This is a complex task involving:
- Security-critical authentication fixes across multiple API endpoints
- Integration with external services (Svix for webhook verification, Upstash for distributed rate limiting)
- Codebase-wide refactoring (empty catch blocks, console statements, TypeScript any types)
- New feature development (dashboard real data, error tracking integration)
- Test coverage improvements (from <10% to >30%)
- Zero tolerance for breaking changes across 14 working modules

---

## Technical Context

### Language & Framework
- **Language**: TypeScript 5.3
- **Framework**: Next.js 14.2 (App Router)
- **Database**: PostgreSQL + Prisma 6.19
- **Authentication**: Auth0 (`@auth0/nextjs-auth0` v3.5)
- **Email**: Resend for transactional emails
- **Storage**: Supabase Storage (migrated from S3)
- **AI**: AWS Bedrock for letter generation

### Dependencies to Add
- `svix` - For Resend webhook signature verification
- `@upstash/redis` + `@upstash/ratelimit` - For distributed rate limiting
- `@sentry/nextjs` - For error tracking (optional, can be deferred)

### Existing Patterns
- Auth helper: `src/lib/auth.ts` - `getSession()` returns `{ user: AuthUser }` with `practiceId`
- Logger: `src/lib/logger.ts` - Structured logging with `logger.info/warn/error()`
- Rate limiting: `src/lib/rate-limit.ts` - In-memory implementation exists
- API routes: Next.js route handlers in `src/app/api/`

---

## Issues Summary

| # | Issue | Severity | Files Affected | Complexity |
|---|-------|----------|----------------|------------|
| 1 | Patient API auth missing | CRITICAL | 2 files + search | Medium |
| 2 | Webhook signature verification | CRITICAL | 1 file | Low |
| 3 | Empty catch blocks | MEDIUM-HIGH | 20+ locations | Low-Medium |
| 4 | Rate limiting in-memory | MEDIUM | 1 file | Medium |
| 5 | Console statements | MEDIUM | 29 files | Low |
| 6 | TypeScript any types | MEDIUM | 5 files | Low |
| 7 | Dashboard hardcoded data | MEDIUM | 1 file + new API | Medium |
| 8 | Error tracking not integrated | MEDIUM | 1 file + setup | Medium |
| 9 | Low test coverage | MEDIUM | New test files | High |
| 10 | Deprecated schema fields | LOW | Schema + search | Low |
| 11 | Magic numbers | LOW | Multiple files | Low |
| 12 | CI/CD pipeline | LOW | Already exists | None |

---

## Implementation Approach

### Phase 1: Critical Security (Issues 1, 2, 3)

#### Issue 1: Patient API Authentication

**Files to Modify:**
- `src/app/api/patients/route.ts`
- `src/app/api/patients/[id]/route.ts`
- `src/app/api/patients/[id]/materials/route.ts`

**Implementation:**
1. Replace `PLACEHOLDER_PRACTICE_ID` with actual auth
2. Use existing `getSession()` from `src/lib/auth.ts`
3. Pattern already exists in `src/app/api/patients/search/route.ts` (lines 17-22)

**Code Pattern:**
```typescript
import { getSession } from '@/lib/auth';

export async function GET(request: NextRequest) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const practiceId = session.user.practiceId;
  // ... rest of handler
}
```

**Verification:**
- Unit test: Cross-practice access denied
- E2E test: Patient CRUD operations work for authenticated user

#### Issue 2: Webhook Signature Verification

**Files to Modify:**
- `src/app/api/webhooks/resend/route.ts`

**Implementation:**
1. Install `svix` package
2. Implement signature verification using Svix headers
3. Reject unsigned/invalid webhooks in production
4. Allow bypass in development for testing

**Environment Variables:**
```
RESEND_WEBHOOK_SECRET=whsec_...
```

**Verification:**
- Test with valid signature passes
- Test with invalid signature rejects (401)
- Existing webhook handling still works

#### Issue 3: Empty Catch Blocks

**Files to Modify (39 locations in src/):**
- `src/middleware.ts:63`
- `src/domains/referrals/extractors/referral-letter.ts:120,128,380`
- `src/domains/documents/document.service.ts:345,472`
- `src/domains/recording/recording.service.ts:300`
- `src/components/recording/TranscriptViewer.tsx:63`
- `src/domains/letters/sending.service.ts:287`
- `src/components/consultation/ReferrerSelector.tsx:50`
- `src/components/consultation/ContactForm.tsx:114`
- `src/components/consultation/PatientSelector.tsx:143`
- `src/app/(dashboard)/onboarding/page.tsx:28`
- `src/app/(dashboard)/patients/PatientsClient.tsx:247`
- `src/app/(dashboard)/settings/style/page.tsx:127`
- `src/app/(dashboard)/settings/templates/page.tsx:153`
- `src/app/(dashboard)/settings/style/components/SeedLetterUpload.tsx:122,153`
- `src/app/api/transcription/webhook/route.ts:121`
- `src/app/api/webhooks/resend/route.ts:56`
- `src/app/api/user/account/route.ts:208`
- `src/app/api/consultations/[id]/route.ts:229`
- `src/app/api/consultations/[id]/generate-letter/route.ts:62`
- `src/app/api/consultations/route.ts:67,193`
- `src/app/api/patients/search/route.ts:47,84`

**Implementation:**
For each empty catch, add proper error logging:
```typescript
// Before
} catch {
  // silent
}

// After
} catch (error) {
  logger.warn('Operation failed', { operation: 'contextName' }, error instanceof Error ? error : undefined);
}
```

**Note:** Test files (tests/) can retain empty catches as they often intentionally test error scenarios.

---

### Phase 2: Production Readiness (Issues 4, 5, 8)

#### Issue 4: Distributed Rate Limiting

**Files to Modify:**
- `src/lib/rate-limit.ts`

**Dependencies to Add:**
- `@upstash/redis`
- `@upstash/ratelimit`

**Implementation:**
1. Add optional Upstash Redis integration
2. Fall back to in-memory for development (no Redis URL)
3. Keep existing API unchanged

**Environment Variables:**
```
UPSTASH_REDIS_REST_URL=https://...
UPSTASH_REDIS_REST_TOKEN=...
```

#### Issue 5: Replace Console Statements

**Files to Modify (29 files with console statements):**
- Most are in `src/lib/` (legitimate logger usage)
- Target files for replacement:
  - `src/hooks/useNotifications.ts`
  - `src/hooks/useErrorHandler.ts`
  - `src/components/settings/UserManagement.tsx`
  - `src/components/settings/PracticeSettings.tsx`
  - `src/components/pwa/PWASettings.tsx`
  - `src/components/letters/LetterEditor.tsx`
  - `src/components/layout/NotificationCenter.tsx`
  - `src/components/consultation/PatientSelector.tsx`
  - `src/components/consultation/ConsultationContextForm.tsx`
  - `src/app/api/practice/users/route.ts`
  - `src/app/api/auth/[...auth0]/route.ts`
  - `src/app/(dashboard)/settings/style/page.tsx`
  - `src/app/(dashboard)/settings/practice/PracticeSettingsClient.tsx`
  - `src/app/(dashboard)/record/error.tsx`
  - `src/app/(dashboard)/letters/[id]/page.tsx`
  - `src/app/(dashboard)/letters/[id]/LetterReviewClient.tsx`

**Note:** Some console statements in `src/lib/logger.ts`, `src/lib/error-logger.ts` are intentional.

#### Issue 8: Error Tracking Integration

**Files to Create/Modify:**
- `sentry.client.config.ts` (new)
- `sentry.server.config.ts` (new)
- `sentry.edge.config.ts` (new)
- `next.config.js` (update for Sentry)
- `src/lib/error-logger.ts` (integrate Sentry)

**Implementation:**
Defer full Sentry integration. Instead:
1. Update `src/lib/error-logger.ts` to support future Sentry integration
2. Add placeholder for `NEXT_PUBLIC_SENTRY_DSN`
3. Document setup steps for production

---

### Phase 3: Code Quality (Issues 6, 7)

#### Issue 6: TypeScript any Types

**Files to Modify:**
- `src/lib/pwa.ts` - `deferredPrompt: any`
- `src/hooks/useNotifications.ts` - `settings: any`
- `src/components/settings/PracticeSettings.tsx`
- `src/app/api/letters/route.ts` - `where: any`
- `src/app/(dashboard)/settings/practice/PracticeSettingsClient.tsx`

**Implementation:**
Replace `any` with proper types:
```typescript
// For deferredPrompt
interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

// For Prisma where clauses
import { Prisma } from '@prisma/client';
const where: Prisma.LetterWhereInput = { ... };
```

#### Issue 7: Dashboard Real Data

**Files to Create:**
- `src/app/api/dashboard/stats/route.ts` (new)

**Files to Modify:**
- `src/app/(dashboard)/dashboard/page.tsx`

**Implementation:**
1. Create API endpoint for dashboard stats
2. Query counts: draft letters, sent letters, patients
3. Scope all queries to user's practiceId
4. Update dashboard to fetch real data

---

### Phase 4: Technical Debt (Issues 9, 10, 11)

#### Issue 9: Test Coverage

**Current State:** ~33 test files exist
**Target:** >30% coverage

**Implementation:**
1. Add integration tests for critical paths
2. Focus on API routes and services
3. Add tests for auth flow, patient CRUD, letter workflow

**Test Files to Add:**
- `tests/integration/api/patients.test.ts`
- `tests/integration/api/dashboard.test.ts`
- `tests/integration/auth/session.test.ts`

#### Issue 10: Deprecated Schema Fields

**Analysis Required:**
- `s3AudioKey` in Recording model
- `s3Key` in Document model

**Action:** Search for usage, if unused, create migration to remove.

#### Issue 11: Magic Numbers

**Files to Create:**
- `src/lib/constants.ts` (if not exists)

**Implementation:**
Extract magic numbers to named constants.

---

## Source Code Structure Changes

### New Files
| Path | Purpose |
|------|---------|
| `src/app/api/dashboard/stats/route.ts` | Dashboard statistics endpoint |
| `src/lib/constants.ts` | Centralized constants |
| `tests/integration/api/patients.test.ts` | Patient API tests |
| `tests/integration/api/dashboard.test.ts` | Dashboard API tests |

### Modified Files
| Path | Changes |
|------|---------|
| `src/app/api/patients/route.ts` | Add auth, remove placeholder |
| `src/app/api/patients/[id]/route.ts` | Add auth, remove placeholder |
| `src/app/api/webhooks/resend/route.ts` | Add Svix verification |
| `src/lib/rate-limit.ts` | Add Upstash support |
| `src/app/(dashboard)/dashboard/page.tsx` | Fetch real data |
| 20+ files | Fix empty catch blocks |
| 15+ files | Replace console with logger |
| 5 files | Replace any types |

---

## Data Model Changes

None required. Existing schema supports all fixes.

---

## API Changes

### New Endpoint
```
GET /api/dashboard/stats
Response: {
  drafts: number;
  sent: number;
  patients: number;
  lettersToday: number;
  pendingReview: number;
  thisMonth: number;
}
```

### Modified Endpoints
All `/api/patients/*` endpoints:
- Now require valid Auth0 session
- Return 401 if unauthenticated
- Scope queries to user's practiceId

---

## Environment Variables

### Required (New)
```
RESEND_WEBHOOK_SECRET=whsec_...
```

### Optional (New)
```
UPSTASH_REDIS_REST_URL=https://...
UPSTASH_REDIS_REST_TOKEN=...
NEXT_PUBLIC_SENTRY_DSN=https://...
```

---

## Verification Approach

### Per-Issue Verification
1. **Issue 1**: Run `npm run typecheck`, test patient API with/without auth
2. **Issue 2**: Test webhook with valid/invalid signatures
3. **Issue 3**: `grep -r "} catch {" src/` returns 0 results
4. **Issue 4**: Verify rate limiting works (with and without Redis)
5. **Issue 5**: `grep -rn "console\." src/` only shows logger.ts
6. **Issue 6**: `npm run typecheck` passes, no any types
7. **Issue 7**: Dashboard shows real counts
8. **Issue 8**: Error logger has Sentry placeholder
9. **Issue 9**: `npm run test:coverage` shows >30%
10. **Issue 10**: Verify deprecated fields not used
11. **Issue 11**: Magic numbers extracted

### Overall Verification
```bash
npm run typecheck  # No errors
npm run lint       # No warnings
npm run test       # All pass
npm run build      # Successful
```

### Manual Testing
After each phase, verify complete workflow:
1. Login with Auth0
2. Record audio
3. Generate letter
4. Approve letter
5. Send letter

---

## Risk Mitigation

### Zero Breaking Changes Strategy
1. Each fix in separate commit (rollback-friendly)
2. Feature flags for risky changes (Upstash Redis)
3. Test after every change
4. Preserve all 14 working modules

### Rollback Plan
- Git revert for any commit that breaks tests
- All changes are additive or corrections
- No destructive migrations

---

## Success Criteria

1. All 3 CRITICAL issues fixed (1, 2, 3)
2. All 3 PRODUCTION issues fixed (4, 5, 8)
3. All 3 CODE QUALITY issues fixed (6, 7, 9)
4. Test coverage >30%
5. Zero TypeScript errors
6. Zero ESLint warnings
7. All existing tests pass
8. Manual workflow test passes
