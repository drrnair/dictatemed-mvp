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

### [ ] Step 2: Implement Supabase Storage Service
<!-- chat-id: 8a32e8f3-5aa9-4149-9ff4-31f7075587c7 -->

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

**Verification**:
- Unit tests for path generation
- Integration test: upload → download → delete cycle

---

### [ ] Step 3: Migrate Audio Recording Storage

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

**Verification**:
- Integration test: upload audio → transcribe → verify audio deleted
- Test cross-user access fails (RLS policy)

---

### [ ] Step 4: Migrate Clinical Document Storage

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

**Verification**:
- Integration test: upload document → process → verify extraction works
- Test source-anchored documentation still works
- Test retention deletion

---

### [ ] Step 5: Migrate User Assets (Signatures & Letterheads)

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

**Verification**:
- Integration test: upload signature → retrieve → delete
- Integration test: upload letterhead (admin only) → retrieve → delete
- Test non-admin cannot upload/delete letterhead

---

### [ ] Step 6: Implement Resend Email Service

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
