# Technical Specification: Bug Fixes for DictateMED

## Overview

This specification addresses two bugs identified from user screenshots:

1. **Dropdown UI Visibility Issue** - Subspecialty dropdown in onboarding has limited height
2. **Account Deletion Failure** - User cannot delete account, receives error

---

## Bug 1: Dropdown UI Visibility Issue

### Summary
**Symptom**: The subspecialty dropdown in the onboarding flow has a limited max-height (`max-h-48` = 192px), which can make it harder to see all available options.

**Screenshot Reference**: `.zenflow-images/01b10d9f-8872-4796-8c20-bd01d235419d.png`
- Shows "Welcome to DictateMED" onboarding page
- User typing "interventional" in Cardiology subspecialty field
- Dropdown showing "Interventional Cardiology" option

**Difficulty**: Easy

### Root Cause
The dropdown list in `SubspecialtyPanel.tsx` uses `max-h-48` (192px) which is relatively small for displaying subspecialty options comfortably.

**File**: `src/components/specialty/SubspecialtyPanel.tsx:378`
```tsx
<ul className="max-h-48 overflow-auto py-1">
```

### Fix Applied
Changed `max-h-48` to `max-h-60` (240px) to provide more visible space for dropdown options:

```tsx
<ul className="max-h-60 overflow-auto py-1">
```

### Files Modified
- `src/components/specialty/SubspecialtyPanel.tsx` (line 378)

---

## Bug 2: Account Deletion Failure

### Summary
**Symptom**: User sees "Failed to delete account. Please contact support." error when attempting to delete their account from Profile Settings.

**Screenshot References**:
- `.zenflow-images/1196f417-959c-44c2-bcb4-81fafcfad9e5.png` - Profile Settings page (before deletion attempt)
- `.zenflow-images/7a04de0e-59c8-4252-b092-2b84741f5e9c.png` - Error message displayed
- User: Rajesh Nair (drrnair@gmail.com)

**Difficulty**: Medium

### Root Cause Analysis

#### Primary Issue: Foreign Key Constraints with `ON DELETE RESTRICT`

Three tables have FK constraints that block user deletion:

1. **`sent_emails` table** (`prisma/migrations/20251224_add_sent_emails/migration.sql`)
   - `sent_emails_userId_fkey` - ON DELETE RESTRICT
   - `sent_emails_letterId_fkey` - ON DELETE RESTRICT

2. **`letter_sends` table** (`prisma/migrations/20251222_add_patient_contacts_and_letter_sends/migration.sql`)
   - `letter_sends_senderId_fkey` - ON DELETE RESTRICT

3. **`referral_documents` table** (`prisma/migrations/20251223_add_referral_document/migration.sql`)
   - `referral_documents_userId_fkey` - ON DELETE RESTRICT

#### Fix Applied (Previous Session)
The API route was updated to include `sentEmail.deleteMany` inside the transaction:

**File**: `src/app/api/user/account/route.ts`
```typescript
// Delete sent emails (must be before letters due to FK constraint)
await tx.sentEmail.deleteMany({ where: { userId } });
```

### Current Deletion Order in Transaction
```
1. auditLog.deleteMany
2. notification.deleteMany
3. styleEdit.deleteMany
4. styleProfile.deleteMany
5. styleSeedLetter.deleteMany
6. userTemplatePreference.deleteMany
7. sentEmail.deleteMany       <-- Added
8. letterSend.deleteMany
9. letter.deleteMany
10. document.deleteMany
11. recording.deleteMany
12. referralDocument.deleteMany
13. consultation.deleteMany
14. clinicianSubspecialty.deleteMany
15. clinicianSpecialty.deleteMany
16. customSubspecialty.deleteMany
17. customSpecialty.deleteMany
18. user.delete
```

### If Issue Persists

If account deletion still fails after the code changes, investigate:

1. **Prisma Client Regeneration**
   ```bash
   npx prisma generate
   ```

2. **Database Migration Status**
   - Verify all migrations are applied to the database
   - Check if `sent_emails` table exists and has correct constraints

3. **Server Logs**
   - The error handler now logs detailed error information:
     ```typescript
     log.error('Failed to delete account', {
       errorName: err.name,
       errorMessage: err.message,
       errorStack: err.stack,
     }, err);
     ```
   - Check application logs for the actual error message

4. **Potential Additional Issues**
   - Other tables with user references not having CASCADE
   - Runtime type errors in Prisma client
   - Database connection issues during transaction

### Long-term Recommendations

1. **Add `onDelete: Cascade`** to Prisma schema for safety:
   ```prisma
   model SentEmail {
     user User @relation(fields: [userId], references: [id], onDelete: Cascade)
     letter Letter @relation(fields: [letterId], references: [id], onDelete: Cascade)
   }
   ```

2. **Create migration** to update FK constraints from RESTRICT to CASCADE

3. **Add integration tests** for account deletion flow

---

## Verification

### Dropdown UI Fix
1. Navigate to onboarding page (`/onboarding`)
2. Select a specialty (e.g., "Cardiology")
3. Type in the subspecialty field
4. Verify dropdown has adequate height (240px vs previous 192px)

### Account Deletion Fix
1. Create a test user account
2. Generate some data (recordings, documents, letters)
3. Optionally send an email (creates `sent_emails` record)
4. Navigate to Settings > Profile
5. Click "Delete Account" in Danger Zone
6. Confirm deletion
7. Verify redirect to logout page without error

---

## Files Modified

| File | Change |
|------|--------|
| `src/components/specialty/SubspecialtyPanel.tsx` | Increased dropdown max-height from 48 to 60 |
| `src/app/api/user/account/route.ts` | Added sentEmail.deleteMany in transaction (previous session) |

---

## Risk Assessment

**Low Risk**: Both fixes are minimal changes:
- Dropdown fix is a CSS class change
- Deletion fix adds one delete operation within existing transaction
