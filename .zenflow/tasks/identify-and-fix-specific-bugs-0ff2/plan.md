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

**Bugs Identified**:
1. User account deletion fails with "Failed to delete account. Please contact support."
2. Subspecialty dropdown in onboarding has limited visibility (max-height too small)

**Root Causes**:
1. **Account Deletion**: The `sent_emails` table has FK constraint (`ON DELETE RESTRICT`) on `userId`. The API route needed `sentEmail.deleteMany` in the transaction.
2. **Dropdown UI**: `SubspecialtyPanel.tsx` uses `max-h-48` (192px) which is too small for comfortable viewing.

See full specification: `.zenflow/tasks/identify-and-fix-specific-bugs-0ff2/spec.md`

---

### [x] Step: Implementation
<!-- chat-id: 96ade139-1480-4c12-997e-daf85a386389 -->

**Bug 1 - Account Deletion (applied in previous session)**:
- File: `src/app/api/user/account/route.ts`
- Added `await tx.sentEmail.deleteMany({ where: { userId } });` inside transaction
- Improved error logging with detailed error info

**Bug 2 - Dropdown UI (applied this session)**:
- File: `src/components/specialty/SubspecialtyPanel.tsx`
- Changed `max-h-48` to `max-h-60` (line 378)

**Note**: If account deletion still fails, check:
1. Run `npx prisma generate` to regenerate Prisma client
2. Check server logs for actual error message
3. Verify database migrations are applied

---

### [x] Step: Bug 3 - PDF Upload Error
<!-- chat-id: current -->

**Error**: "Unable to prepare document upload. Please try again."
**File**: "Reports from 02122025.pdf" (53.1 KB)

**Root Cause**: The Supabase storage migration (`supabase/migrations/001_create_storage_buckets.sql`) was never run on the production database. The `storage.buckets` table was empty.

**Fix Applied**:

1. **Ran the official storage migration** on Supabase:
   - `audio-recordings` (500 MB, audio formats) - for consultation recordings
   - `clinical-documents` (50 MB, PDF/images/text) - for referral documents
   - `user-assets` (5 MB, images) - for signatures and letterheads

2. **Created storage RLS policies** (16 policies total):
   - Service role full access (for API operations)
   - Per-bucket authenticated user policies (select/insert/update/delete)

3. **Updated migration file** (`001_create_storage_buckets.sql`):
   - Added `text/plain` to `clinical-documents` allowed MIME types

4. **Improved error handling** in `src/app/api/referrals/route.ts`:
   - Added specific error messages for bucket/auth issues
   - Better error logging for debugging

**Note for deployments**: The Supabase storage migration must be run manually:
```bash
psql $SUPABASE_DB_URL -f supabase/migrations/001_create_storage_buckets.sql
```

**Verification**: PDF upload should now work. Try uploading again.

---

### [x] Step: Bug 4 - Multiple Document Upload & Field Mismatch
<!-- chat-id: current -->

**Issue**: After deployment, uploads still failing. Also need support for multiple documents/images.

**Root Causes Found**:

1. **Vercel Environment Variables**: `SUPABASE_SERVICE_ROLE_KEY` may not be set in Vercel production
2. **Field name mismatch** in `NewUploadsSection.tsx`:
   - Sent: `filename`, `sizeBytes`
   - API expected: `name`, `size`
3. **Response shape mismatch**:
   - API returns: `{ id, uploadUrl, expiresAt }`
   - Component expected: `{ document, uploadUrl }`
4. **Missing HEIC/HEIF support** for iPhone photos

**Fixes Applied**:

1. **Fixed `NewUploadsSection.tsx`** (multiple document upload component):
   - Changed `filename` → `name`, `sizeBytes` → `size`
   - Changed `{ document, uploadUrl }` → `{ id: documentId, uploadUrl }`

2. **Added HEIC/HEIF support**:
   - `src/app/api/documents/route.ts`: Added to mimeType enum
   - `src/infrastructure/supabase/types.ts`: Added to `ALLOWED_DOCUMENT_TYPES`
   - Updated Supabase bucket allowed MIME types
   - Updated migration file

3. **Fixed UI text** in `NewUploadsSection.tsx`:
   - Updated drop zone text: "PDF, PNG, JPEG, HEIC up to 20MB"

4. **Added HEIC/HEIF support to referrals uploader** (for photographing paper documents):
   - `src/domains/referrals/referral.types.ts`: Added PNG, JPEG, HEIC, HEIF to `ALLOWED_REFERRAL_MIME_TYPES`
   - `src/components/referral/ReferralUploader.tsx`: Updated UI text and error messages
   - Supabase bucket already has required MIME types

**User Action Completed**:

Environment variables added to Vercel Production:
- `NEXT_PUBLIC_SUPABASE_URL` = `https://rhrasddllgyqbmhirkwq.supabase.co`
- `SUPABASE_SERVICE_ROLE_KEY` = (service_role key from Supabase)

**Status**: ✅ Upload now working - PDF successfully uploaded.

---

## Task Complete

All bugs identified in this task have been fixed:
1. ✅ Account deletion - Fixed FK constraint issue
2. ✅ Subspecialty dropdown - Increased max-height
3. ✅ PDF upload error - Created storage buckets, improved error handling
4. ✅ Field mismatches & HEIC support - Fixed API/component contract, added iPhone photo support

---

## Future Enhancement: Fast Multi-Document Upload with Background Processing

**Requested by user** - To be implemented as a separate task.

### Requirements:

1. **Multiple document selection** - Allow specialist to select multiple documents at once in file picker (batch selection)

2. **Fast key info extraction** - Quickly extract critical patient identifiers:
   - Patient name
   - Date of birth
   - Unique patient number (MRN)

3. **Background processing** - Detailed context extraction (referral reason, medical history, etc.) should happen in background while specialist continues with recording

4. **Non-blocking workflow** - Specialist should NOT wait for full document processing before starting consultation recording

### Technical Considerations:
- Current `ReferralUploader` only allows single file upload
- `NewUploadsSection` already supports multiple files but is for consultation documents
- May need OCR/vision AI for image-based document extraction
- Consider WebSocket or polling for background job status updates

### Suggested Implementation Approach:
1. Add `multiple` attribute to ReferralUploader file input
2. Create fast extraction endpoint for key patient identifiers only
3. Queue detailed extraction as background job
4. Update UI to show "Processing in background..." status
5. Allow recording to start while extraction continues
