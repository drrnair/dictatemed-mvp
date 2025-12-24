# Technical Specification: Fix User Account Deletion Bug

## Bug Summary
**Symptom**: User sees "Failed to delete account. Please contact support." error when attempting to delete their account from Profile Settings.

**Difficulty**: Medium - requires understanding of database foreign key constraints and transaction handling.

## Technical Context
- **Framework**: Next.js 14+ with App Router
- **Database**: PostgreSQL via Prisma ORM
- **Storage**: Supabase Storage for files
- **Auth**: Auth0

## Root Cause Analysis

### Primary Issue: Foreign Key Constraint on `sent_emails` Table

**Location**: `prisma/migrations/20251224_add_sent_emails/migration.sql:32`

```sql
ALTER TABLE "sent_emails" ADD CONSTRAINT "sent_emails_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "users"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;
```

The `sent_emails` table has a foreign key constraint with `ON DELETE RESTRICT`, which prevents deleting a user if they have any sent email records.

**API Code Issue**: `src/app/api/user/account/route.ts:113-117`

```typescript
// Delete sent emails before transaction (table may not exist in all environments)
try {
  await prisma.$executeRaw`DELETE FROM sent_emails WHERE "userId" = ${userId}::text`;
} catch {
  // Table doesn't exist yet - skip silently  <-- PROBLEM: catches ALL errors
}
```

The raw SQL deletion:
1. Is executed **outside** the main transaction
2. **Silently swallows all errors**, not just "table doesn't exist" errors
3. If this fails for any reason (permissions, connection, etc.), the FK constraint blocks user deletion

### Secondary Issue: Missing Prisma-based SentEmail Deletion

The `SentEmail` model exists in the schema (`prisma/schema.prisma:824-856`) but the API relies solely on raw SQL for deletion. If the raw SQL approach fails, there's no Prisma ORM fallback within the transaction.

### Tertiary Issue: Schema Missing `onDelete: Cascade`

**File**: `prisma/schema.prisma:827`
```prisma
user User @relation(fields: [userId], references: [id])  // NO onDelete: Cascade
```

The Prisma schema doesn't specify `onDelete: Cascade` for the `SentEmail.user` relation, which would make the database handle cascading deletes automatically.

## Implementation Approach

### Option A: Fix API Route (Recommended - Minimal Change)
Move `sentEmail` deletion inside the transaction using Prisma ORM:

**File to modify**: `src/app/api/user/account/route.ts`

Changes:
1. Add `await tx.sentEmail.deleteMany({ where: { userId } });` inside the transaction, before deleting letters
2. Remove or improve the raw SQL fallback (keep for backwards compatibility but add proper error handling)

### Option B: Add Schema Migration (More Robust - Long-term)
Add `onDelete: Cascade` to the SentEmail model:

```prisma
user User @relation(fields: [userId], references: [id], onDelete: Cascade)
```

Then run migration to update the FK constraint.

### Recommended: Combined Approach
1. **Immediate fix**: Update API route to delete `sentEmails` via Prisma inside transaction
2. **Future improvement**: Update schema with `onDelete: Cascade` for safety

## Source Code Changes

### Files to Modify

1. **`src/app/api/user/account/route.ts`**
   - Add `sentEmail.deleteMany` inside the transaction (before `letter.deleteMany`)
   - Improve error handling for the raw SQL fallback

### Deletion Order (Updated)

The transaction should delete in this order to respect FK dependencies:
1. `auditLog.deleteMany`
2. `notification.deleteMany`
3. `styleEdit.deleteMany`
4. `styleProfile.deleteMany`
5. `styleSeedLetter.deleteMany`
6. `userTemplatePreference.deleteMany`
7. **`sentEmail.deleteMany`** (NEW - must be before letters and user)
8. `letterSend.deleteMany`
9. `letter.deleteMany`
10. `document.deleteMany`
11. `recording.deleteMany`
12. `referralDocument.deleteMany`
13. `consultation.deleteMany`
14. `clinicianSubspecialty.deleteMany`
15. `clinicianSpecialty.deleteMany`
16. `customSubspecialty.deleteMany`
17. `customSpecialty.deleteMany`
18. `user.delete`

## Data Model Changes

No immediate schema changes required for the fix. Optional future enhancement:

```prisma
// prisma/schema.prisma - SentEmail model
model SentEmail {
  // ...
  user User @relation(fields: [userId], references: [id], onDelete: Cascade)
  letter Letter @relation(fields: [letterId], references: [id], onDelete: Cascade)
  // ...
}
```

## Verification Approach

### Manual Testing
1. Create a test user account
2. Create recordings, documents, letters
3. Send at least one letter via email (to create `sent_emails` record)
4. Attempt to delete the account
5. Verify successful deletion with no errors

### Verification Steps
1. Check database for remaining records after deletion:
   ```sql
   SELECT * FROM sent_emails WHERE "userId" = '<deleted-user-id>';
   SELECT * FROM users WHERE id = '<deleted-user-id>';
   ```
2. Verify all storage files are deleted from Supabase buckets

### Edge Cases to Test
- User with no sent emails (should still work)
- User with multiple sent emails
- User with sent emails for letters that failed to generate
- Concurrent deletion attempts

## Risk Assessment

**Low Risk**: The fix is additive (adding a delete operation) within an existing transaction. It doesn't change the overall deletion logic, just ensures `sent_emails` are properly cleaned up.

**Rollback**: If issues arise, the change can be reverted by removing the single `sentEmail.deleteMany` line.

## Dependencies

- No new dependencies required
- No API contract changes
- No frontend changes needed (error is already displayed)
