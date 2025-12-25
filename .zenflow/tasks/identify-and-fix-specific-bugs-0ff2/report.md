# Implementation Report: Fix User Account Deletion Bug

## Summary

Fixed the user account deletion failure that displayed "Failed to delete account. Please contact support." error.

## Changes Made

### File Modified
`src/app/api/user/account/route.ts`

### Change Description

**Removed** (lines 111-117 in original):
```typescript
// Delete sent emails before transaction (table may not exist in all environments)
// This is done outside transaction to gracefully handle missing table
try {
  await prisma.$executeRaw`DELETE FROM sent_emails WHERE "userId" = ${userId}::text`;
} catch {
  // Table doesn't exist yet - skip silently
}
```

**Added** (line 129-130 in updated file):
```typescript
// Delete sent emails (must be before letters due to FK constraint)
await tx.sentEmail.deleteMany({ where: { userId } });
```

**Added** (improved error logging):
```typescript
} catch (error) {
  const err = error as Error;
  log.error('Failed to delete account', {
    errorName: err.name,
    errorMessage: err.message,
    errorStack: err.stack,
  }, err);
  // ...
}
```

### Why This Fix Works

1. **Transaction Safety**: The `sentEmail.deleteMany` is now inside the Prisma transaction, ensuring atomicity with all other deletions.

2. **Correct Deletion Order**: Positioned before `letterSend.deleteMany` and `letter.deleteMany` to satisfy the FK constraints:
   - `sent_emails.userId` → `users.id` (ON DELETE RESTRICT)
   - `sent_emails.letterId` → `letters.id` (ON DELETE RESTRICT)

3. **Prisma ORM**: Using Prisma's type-safe `deleteMany` instead of raw SQL eliminates the "table doesn't exist" error-swallowing that was masking real failures.

4. **No Silent Failures**: Errors in `sentEmail.deleteMany` will now properly propagate and be caught by the outer try/catch, providing accurate error messages.

## Root Cause

The `sent_emails` table has `ON DELETE RESTRICT` foreign key constraints. The original code attempted to delete sent emails via raw SQL **outside** the transaction, and silently swallowed **all** errors (not just "table doesn't exist"). When the raw SQL failed for any reason, the FK constraint blocked the subsequent user deletion inside the transaction.

## Post-Deployment Status (Updated)

**Issue persists after initial deployment.** Screenshots show error still appearing ~11-13 minutes after PR #17 was merged.

### Investigation Findings

All `ON DELETE RESTRICT` FK constraints that reference `users`:
1. `sent_emails.userId` → `users.id` - **Now handled at line 130**
2. `sent_emails.letterId` → `letters.id` - **Handled (sentEmails deleted before letters)**
3. `letter_sends.senderId` → `users.id` - **Already handled at line 133**
4. `referral_documents.userId` → `users.id` - **Already handled at line 145**

The code deletion order is correct. Possible explanations:
1. **Cache/propagation delay**: Vercel edge functions may need more time or cache invalidation
2. **Different error source**: Error may be coming from a different operation
3. **Prisma client mismatch**: If `prisma generate` wasn't run after schema changes

### Next Steps

**Check Vercel logs** to see the actual error:
1. Go to Vercel Dashboard → dictatemed-mvp-ed61 → Logs
2. Filter by `/api/user/account`
3. Look for the `Failed to delete account` log entry with the detailed error info

The enhanced error logging will now show:
- `errorName`: The type of error (e.g., PrismaClientKnownRequestError)
- `errorMessage`: The specific message (e.g., "Foreign key constraint failed")
- `errorStack`: Full stack trace

## Risk Assessment

**Low Risk**:
- The fix is additive within an existing transaction pattern
- Uses the same Prisma ORM pattern as other deletions in the transaction
- Single-line rollback if issues arise

## Files Changed

| File | Lines Changed | Description |
|------|--------------|-------------|
| `src/app/api/user/account/route.ts` | -7, +10 | Moved sentEmail deletion inside transaction, improved error logging |
