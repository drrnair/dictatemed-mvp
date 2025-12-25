# Implementation Report: Fix User Account Deletion Bug

## Summary

Fixed the user account deletion failure that displayed "Failed to delete account. Please contact support." error.

## Root Causes Found

### Issue 1: Missing `sentEmail.deleteMany` in Transaction (Initial Fix)
The `sent_emails` table has `ON DELETE RESTRICT` FK constraints. The original code attempted to delete sent emails via raw SQL **outside** the transaction, silently swallowing all errors.

**Fixed by**: Adding `tx.sentEmail.deleteMany({ where: { userId } })` inside the transaction.

### Issue 2: Schema Migration Not Applied (Real Blocker)
After deploying the initial fix, Vercel logs revealed the **actual error**:

```
prisma:error
Invalid 'prisma.user.findUnique()' invocation:
The column 'recordings.storagePath' does not exist in the current database.
```

The Prisma schema includes `storagePath` and `audioDeletedAt` columns on `recordings`, and `storagePath` on `documents`, but **these migrations have not been applied to the production database**.

**Fixed by**: Adding a fallback query that uses legacy column names (`s3AudioKey`, `s3Key`) if the new columns don't exist.

## Changes Made

### File Modified
`src/app/api/user/account/route.ts`

### Change 1: SentEmail Deletion in Transaction
```typescript
// Delete sent emails (must be before letters due to FK constraint)
await tx.sentEmail.deleteMany({ where: { userId } });
```

### Change 2: Schema Migration Fallback
```typescript
// Query with fallback for unmigrated databases
let user;
try {
  user = await prisma.user.findUnique({
    where: { id: userId },
    include: {
      recordings: { select: { id: true, storagePath: true, audioDeletedAt: true } },
      documents: { select: { id: true, storagePath: true, deletedAt: true } },
      letters: { select: { id: true } },
    },
  });
} catch (schemaError) {
  // Fallback: query without new columns if migration not applied yet
  log.warn('Falling back to legacy schema query', { error: (schemaError as Error).message });
  user = await prisma.user.findUnique({
    where: { id: userId },
    include: {
      recordings: { select: { id: true, s3AudioKey: true } },
      documents: { select: { id: true, s3Key: true, deletedAt: true } },
      letters: { select: { id: true } },
    },
  });
}
```

### Change 3: Dual Column Name Support
Storage deletion code now handles both new and legacy column names:
```typescript
const rec = recording as { id: string; storagePath?: string | null; s3AudioKey?: string | null; audioDeletedAt?: Date | null };
const audioPath = rec.storagePath || rec.s3AudioKey;
```

### Change 4: Enhanced Error Logging
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

## Recommended Follow-up Action

**Run pending database migrations on production:**
```bash
npx prisma migrate deploy
```

Migrations that need to be applied:
- `20251224_add_recording_storage_path` - Adds `storagePath`, `fileSizeBytes`, `audioDeletedAt` to recordings
- `20251224_add_document_storage_path` - Adds `storagePath` to documents

Once migrations are applied, the fallback code will simply not be triggered (the primary query will succeed).

## Files Changed

| File | Lines Changed | Description |
|------|--------------|-------------|
| `src/app/api/user/account/route.ts` | +40, -15 | Added sentEmail deletion, schema fallback, dual column support, error logging |

## Testing Checklist

- [ ] Test account deletion with new schema (after migration)
- [ ] Test account deletion with legacy schema (before migration)
- [ ] Test deletion with sent emails present
- [ ] Test deletion with recordings and documents present
- [ ] Verify all storage files are cleaned up
