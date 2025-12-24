# Spec and build

## Configuration
- **Artifacts Path**: {@artifacts_path} → `.zenflow/tasks/{task_id}`

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
<!-- chat-id: b9333f59-8fc0-49ec-9bdd-749db43c9435 -->

**Difficulty**: Medium

**Bug Identified**: User account deletion fails with "Failed to delete account. Please contact support."

**Root Cause**: The `sent_emails` table has a foreign key constraint (`ON DELETE RESTRICT`) on `userId`. The API route attempts to delete sent emails via raw SQL outside the transaction, but silently swallows all errors. When the raw SQL fails, the FK constraint blocks user deletion.

**Solution**: Add `sentEmail.deleteMany` inside the Prisma transaction before deleting letters and the user.

See full specification: `.zenflow/tasks/identify-and-fix-specific-bugs-0ff2/spec.md`

---

### [ ] Step: Implementation

Fix the user account deletion bug by updating the API route:

**File**: `src/app/api/user/account/route.ts`

**Changes**:
1. Add `await tx.sentEmail.deleteMany({ where: { userId } });` inside the transaction, positioned before `letter.deleteMany`
2. Improve error logging for the raw SQL fallback (optional, for debugging)

**Verification**:
1. Run linter: `npm run lint`
2. Run type check: `npm run type-check` (if available)
3. Manual test: Create user with sent emails, then delete account
4. Write report to `{@artifacts_path}/report.md`
