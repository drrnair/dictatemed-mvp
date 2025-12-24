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

**Difficulty Assessment**: Hard

This migration involves:
- Multiple AWS services (S3 for storage)
- PHI (Protected Health Information) handling with HIPAA-aligned patterns
- Database schema changes (new tables, modified fields)
- New email capability (Resend)
- Security hardening (RLS policies, audit logging)
- Integration testing across services (Deepgram, AI Vision)

**Deliverables Created**:
- `spec.md` - Full technical specification with implementation approach
- `MIGRATION_AUDIT_REPORT.md` - AWS usage audit and PHI touch points (repo root)

---

### [x] Step 1: Set Up Supabase Infrastructure

Create the Supabase storage infrastructure with PHI-aware design.

**Tasks**:
1. Add `@supabase/supabase-js` to dependencies
2. Create `src/infrastructure/supabase/client.ts` - Supabase client singleton
3. Create Supabase storage buckets (in Supabase dashboard or via SQL):
   - `audio-recordings` (private) - for consultation audio
   - `clinical-documents` (private) - for medical PDFs/images
   - `user-assets` (private) - for signatures and letterheads
4. Create initial storage RLS policies for all three buckets

**Completed**:
- ✅ Added `@supabase/supabase-js` to dependencies
- ✅ Created `src/infrastructure/supabase/client.ts` - Supabase client singleton with service role and public clients
- ✅ Created `src/infrastructure/supabase/types.ts` - Type definitions for storage operations
- ✅ Created `src/infrastructure/supabase/index.ts` - Barrel export
- ✅ Created `supabase/migrations/001_create_storage_buckets.sql` - Storage bucket creation + RLS policies
- ✅ Created `supabase/README.md` - Setup instructions
- ✅ Created `scripts/verify-supabase.ts` - Connection verification script
- ✅ Updated `.env.example` with Supabase environment variables
- ✅ `npm run typecheck` passes
- ✅ `npm run lint` passes
- ✅ `npm run build` succeeds

**Verification**:
- `npm install` succeeds ✅
- Supabase client can connect (run `npx tsx scripts/verify-supabase.ts` after setting up `.env.local`)
- Buckets exist and are private (run SQL migration in Supabase dashboard)

---

### [x] Step 2: Implement Supabase Storage Service

Create the storage service layer to replace S3 operations.

**Tasks**:
1. Create `src/infrastructure/supabase/storage.service.ts` with:
   - `generateUploadUrl(bucket, path, contentType)` - signed URL for uploads
   - `generateDownloadUrl(bucket, path)` - signed URL for downloads
   - `deleteObject(bucket, path)` - delete file
   - `getObjectMetadata(bucket, path)` - file metadata
2. Add path generation helpers:
   - `generateAudioPath(userId, consultationId, mode)`
   - `generateDocumentPath(userId, patientId, docType, filename)`
   - `generateSignaturePath(userId, filename)`
   - `generateLetterheadPath(practiceId, filename)`
3. Add content type validation (audio: webm/mp4/wav, documents: pdf/png/jpeg, images: png/jpeg/gif/webp)
4. Add audit logging integration for all PHI access

**Completed**:
- ✅ Created `src/infrastructure/supabase/storage.service.ts` with:
  - Path generation helpers for audio, documents, signatures, and letterheads
  - Content type validation for audio (webm/mp4/wav/mpeg/ogg), documents (pdf/png/jpeg/tiff), images (png/jpeg/gif/webp)
  - File size validation
  - Signed URL generation for uploads and downloads
  - File operations: upload, delete, deleteFiles, getFileMetadata, fileExists
  - Audit logging integration via `createStorageAuditLog` and `getDownloadUrlWithAudit`
  - Convenience methods for each resource type (audio, documents, signatures, letterheads)
- ✅ Updated `src/infrastructure/supabase/index.ts` with all new exports
- ✅ Created `tests/unit/infrastructure/supabase/storage.service.test.ts` with 48 unit tests
- ✅ `npm run typecheck` passes
- ✅ `npm run lint` passes
- ✅ `npm run build` succeeds
- ✅ All unit tests pass

**Verification**:
- Unit tests for path generation ✅
- Integration test: upload → download → delete cycle (will be tested in Step 3)

---

### [x] Step 3: Migrate Audio Recording Storage
<!-- chat-id: 1df53fb1-4bfb-41ce-bc92-02a7497c91c6 -->

Replace S3 usage in recording service with Supabase.

**Tasks**:
1. Update `prisma/schema.prisma`:
   - Add `storagePath` field to Recording (will replace s3AudioKey)
   - Add `audioDeletedAt` field for retention tracking
2. Run Prisma migration
3. Update `src/domains/recording/recording.service.ts`:
   - Replace S3 imports with Supabase storage service
   - Update `createRecording()` to use new path convention
   - Update `confirmUpload()` to store `storagePath`
   - Update `getRecording()` to generate Supabase signed URLs
   - Update `deleteRecording()` to use Supabase delete
4. Update `src/domains/recording/transcription.service.ts`:
   - Use Supabase signed URL for Deepgram submission
5. Implement audio deletion after successful transcription

**Completed**:
- ✅ Updated `prisma/schema.prisma` with `storagePath`, `fileSizeBytes`, and `audioDeletedAt` fields
- ✅ Created SQL migration `prisma/migrations/20251224_add_recording_storage_path/migration.sql`
- ✅ Updated `src/domains/recording/recording.service.ts`:
  - Replaced S3 imports with Supabase storage service
  - Updated `createRecording()` to generate Supabase storage path and upload URL
  - Updated `confirmUpload()` to use Supabase download URL, persist `fileSizeBytes`, and audit logging
  - Updated `getRecording()` to check `audioDeletedAt` and use Supabase URLs
  - Updated `updateRecording()` to use Supabase URLs
  - Updated `listRecordings()` to use Supabase URLs
  - Updated `deleteRecording()` to delete from Supabase Storage with audit logging
  - Added `deleteAudioAfterTranscription()` for retention policy compliance
  - Added `getAudioDownloadUrl()` for transcription service to use
- ✅ Updated `src/domains/recording/transcription.service.ts`:
  - Use new `getAudioDownloadUrl()` for Deepgram submission
  - Call `deleteAudioAfterTranscription()` after successful transcription
  - Added explicit error message for `retryTranscription()` when audio is deleted
- ✅ Created `tests/unit/domains/recording/recording.service.test.ts` with 19 unit tests:
  - Core functionality tests (create, confirm, get, delete)
  - Audio deletion after transcription tests
  - Cross-user access prevention tests
  - Large file handling tests (30-minute ambient recordings, 500MB)
  - fileSizeBytes persistence tests
- ✅ Fixed type error in `src/app/api/practice/letterhead/route.ts`
- ✅ `npm run lint` passes
- ✅ `npm run build` succeeds
- ✅ All 165 tests pass

**Verification**:
- Unit tests verify upload → transcribe → audio deletion path ✅
- Unit tests verify cross-user access fails ✅
- Unit tests verify large file handling (30 minutes, 500MB) ✅
- Unit tests verify fileSizeBytes is persisted ✅

---

### [x] Step 4: Migrate Clinical Document Storage
<!-- chat-id: 73d6a9af-0997-4d75-be27-9dcaf65cf8aa -->

Replace S3 usage in document service with Supabase.

**Tasks**:
1. Update `prisma/schema.prisma`:
   - Add `storagePath` field to Document (will replace s3Key)
   - Add `retentionUntil` field
   - Add `deletedAt` field
   - Add `deletionReason` field
2. Run Prisma migration
3. Update `src/domains/documents/document.service.ts`:
   - Replace S3 imports with Supabase storage service
   - Update path convention: `{userId}/{patientId}/{docType}/{filename}_{timestamp}.{ext}`
   - Update all CRUD operations for Supabase
4. Update document extraction service to use Supabase signed URLs for AI Vision
5. Create retention cleanup job (or inline cleanup for MVP)

**Completed**:
- ✅ Updated `prisma/schema.prisma` with new fields:
  - `storagePath` - Supabase Storage path (replacing s3Key)
  - `retentionUntil` - Retention policy expiration date (7 years by default)
  - `deletedAt` - When file was soft-deleted from storage
  - `deletionReason` - Why the file was deleted (retention_expired, user_requested, etc.)
  - Added index on `retentionUntil` for cleanup job performance
- ✅ Created SQL migration `prisma/migrations/20251224_add_document_storage_path/migration.sql`
- ✅ Updated `src/domains/documents/document.types.ts` with new fields
- ✅ Updated `src/domains/documents/document.service.ts`:
  - Replaced S3 imports with Supabase storage service
  - Added `toStorageDocumentType()` mapper for storage paths
  - Updated `createDocument()` to generate Supabase path with retention policy
  - Updated `confirmUpload()` to use Supabase download URL and audit logging
  - Updated `getDocument()` to check `deletedAt` and use Supabase URLs
  - Updated `listDocuments()` to use Supabase URLs
  - Updated `getPatientDocuments()` to use Supabase URLs
  - Updated `deleteDocument()` to delete from Supabase with audit logging
  - Added `getDocumentDownloadUrlForAI()` for AI Vision processing with audit
  - Added `softDeleteDocumentFile()` for retention policy compliance
  - Added `cleanupExpiredDocuments()` for batch retention cleanup
- ✅ Updated `src/domains/documents/extraction.service.ts`:
  - Updated `processDocument()` to auto-generate Supabase URL if not provided
  - Updated `reprocessDocument()` to use optional URL parameter
- ✅ Created `tests/unit/domains/documents/document.service.test.ts` with 21 unit tests
- ✅ `npm run typecheck` passes
- ✅ `npm run lint` passes
- ✅ `npm run build` succeeds
- ✅ All 162 tests pass

**Verification**:
- Unit tests verify upload → URL generation → soft delete path ✅
- Unit tests verify cross-user access fails ✅
- Unit tests verify retention cleanup works ✅
- Unit tests verify AI processing URL generation with audit ✅

---

### [x] Step 5: Migrate User Assets (Signatures & Letterheads)
<!-- chat-id: 8468cb52-bd39-421a-a06e-d2a16a351db6 -->

Replace S3 usage for user assets with Supabase.

**Tasks**:
1. Update `src/app/api/user/signature/route.ts`:
   - Replace S3 imports with Supabase storage service
   - Update path convention: `signatures/{userId}/{timestamp}.{ext}` → `user_assets` bucket
   - Update upload, download, and delete operations
2. Update `src/app/api/practice/letterhead/route.ts`:
   - Replace S3 imports with Supabase storage service
   - Update path convention: `letterheads/{practiceId}/{timestamp}.{ext}` → `user_assets` bucket
   - Update upload and delete operations
3. Update `src/app/api/user/account/route.ts`:
   - Replace S3 `deleteObject` with Supabase storage delete
4. Add RLS policy for `user_assets` bucket:
   - Signatures: user can only access their own
   - Letterheads: practice members can access their practice's letterhead

**Completed**:
- ✅ Updated `src/app/api/user/signature/route.ts`:
  - Replaced S3 imports with Supabase storage service
  - Uses `generateSignaturePath()` for path convention
  - Uses `uploadFile()` for direct server-side upload
  - Uses `getSignatureDownloadUrl()` for signed URLs
  - Uses `deleteSignature()` for deletion with audit logging
  - Validates image types with `isValidImageType()`
  - Creates audit log entry for uploads
- ✅ Updated `src/app/api/practice/letterhead/route.ts`:
  - Replaced S3 imports with Supabase storage service
  - Uses `getLetterheadUploadUrl()` for signed upload URLs with audit logging
  - Uses `deleteLetterhead()` for deletion with audit logging
  - Validates image types with `isValidImageType()`
  - Admin-only access enforced via `requireAdmin()`
- ✅ Updated `src/app/api/user/account/route.ts`:
  - Replaced S3 `deleteObject` with Supabase `deleteFile()`
  - Deletes from all three buckets: `USER_ASSETS`, `AUDIO_RECORDINGS`, `CLINICAL_DOCUMENTS`
  - Respects `audioDeletedAt` and `deletedAt` flags (doesn't delete already-deleted files)
  - Creates audit log entries for each deletion with `reason: 'account_deletion'`
- ✅ RLS policies already created in `supabase/migrations/001_create_storage_buckets.sql`
- ✅ `npm run typecheck` passes
- ✅ `npm run lint` passes
- ✅ `npm run build` succeeds
- ✅ All 165 tests pass

**Verification**:
- Typecheck passes ✅
- Lint passes ✅
- Build succeeds ✅
- All tests pass ✅

---

### [ ] Step 6: Implement Resend Email Service
<!-- chat-id: bf28a1e9-5fd6-4982-8477-5ce9de9d5ca8 -->

Add email capability for sending approved letters.

**Tasks**:
1. Add `resend` to dependencies
2. Create `src/infrastructure/email/resend.client.ts` - Resend client singleton
3. Create `src/infrastructure/email/email.service.ts`:
   - `sendLetterEmail(letterData, recipient, pdfBuffer)` - send letter with attachment
4. Create `src/infrastructure/email/templates/letter.ts`:
   - HTML + plain text template
   - Medico-legal disclaimer
   - DictateMED attribution
5. Update `prisma/schema.prisma` - add `SentEmail` model
6. Run Prisma migration
7. Create `/api/email/send` endpoint
8. Integrate with letter approval flow (optional auto-send)

**Verification**:
- Unit test: template rendering
- Integration test: send email to test address
- Verify `sent_emails` record created
- Verify audit log entry

---

### [ ] Step 7: Strengthen RLS Policies

Enable and test Row Level Security across all PHI tables.

**Tasks**:
1. Create migration for RLS policies on PostgreSQL tables:
   - `patients` - practice-scoped
   - `recordings` - user-scoped
   - `documents` - user-scoped
   - `letters` - user-scoped
   - `consultations` - user-scoped
   - `sent_emails` - user-scoped
2. Create Supabase storage RLS policies:
   - `audio_recordings` bucket - user-scoped
   - `clinical_documents` bucket - user-scoped
   - `user_assets` bucket - user-scoped for signatures, practice-scoped for letterheads
3. Create SQL test script to verify:
   - User A cannot access User B's data
   - Practice admin sees aggregates only (if applicable)

**Verification**:
- Run SQL test script
- Integration test: cross-user access attempts fail

---

### [ ] Step 8: Remove AWS S3 Dependencies

Clean up after migration is complete and tested.

**Tasks**:
1. Delete S3 infrastructure files:
   - `src/infrastructure/s3/client.ts`
   - `src/infrastructure/s3/upload.service.ts`
   - `src/infrastructure/s3/presigned-urls.ts`
   - `src/infrastructure/s3/` directory
2. Remove npm packages:
   - `@aws-sdk/client-s3`
   - `@aws-sdk/s3-request-presigner`
3. Update `.env.example`:
   - Remove `S3_BUCKET_NAME`
   - Add Supabase variables
   - Add Resend variables
4. Update any remaining S3 references in code

**Verification**:
- `npm run build` succeeds
- `npm run lint` passes
- `npm run typecheck` passes
- No S3 imports remain (grep check)

---

### [ ] Step 9: End-to-End Smoke Test

Verify complete workflow with real data.

**Tasks**:
1. Login as specialist user
2. Upload a signature image, verify it appears in profile
3. (As admin) Upload letterhead, verify it appears in practice settings
4. Create new consultation with patient
5. Record audio (dictation or ambient)
6. Verify audio uploads to Supabase
7. Start transcription, verify audio URL works for Deepgram
8. After transcription completes, verify audio deleted from storage
9. Upload clinical PDF
10. Verify document processing works (AI extraction)
11. Generate letter (should include signature/letterhead)
12. Verify source-anchored documentation works
13. Approve letter
14. Send letter via email to test address
15. Verify email received with PDF attachment
16. Check audit logs for complete trail

**Verification**:
- All steps complete without errors
- No public URLs for PHI
- Audit trail complete
- Performance acceptable

---

### [ ] Step 10: Documentation and Cleanup

Final documentation and code quality.

**Tasks**:
1. Update README with new setup instructions
2. Verify all environment variables documented
3. Write implementation report to `report.md`:
   - What was implemented
   - How the solution was tested
   - Challenges encountered
4. Final code review pass
5. Remove any TODO comments or temporary code

**Verification**:
- README accurate and complete
- Report.md written
- Code is clean

---

## Summary

**Total Steps**: 10 (after Technical Specification)
**Estimated Files to Create**: ~10-12
**Estimated Files to Modify**: ~18-22 (including API routes for signatures/letterheads)
**Estimated Files to Delete**: 3

This plan follows the task requirements to work incrementally:
`audit → audio migration → document migration → user assets migration → email → cleanup → RLS tightening → smoke test`
