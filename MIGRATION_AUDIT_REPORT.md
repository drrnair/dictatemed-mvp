# Migration Audit Report: AWS S3/SES to Supabase/Resend

**Date**: 2025-12-24
**Project**: DictateMED MVP
**Purpose**: Document all AWS dependencies and PHI touch points for migration to Supabase Storage and Resend

---

## 1. AWS S3 Dependencies

### 1.1 Infrastructure Files

| File | Functions | Purpose |
|------|-----------|---------|
| `src/infrastructure/s3/client.ts` | `getS3Client()`, `getBucketName()` | S3 client singleton and bucket configuration |
| `src/infrastructure/s3/upload.service.ts` | `generateUploadUrl()`, `generateDownloadUrl()`, `deleteObject()`, `getObjectMetadata()`, `generateRecordingKey()`, `generateDocumentKey()` | Core S3 operations for file upload, download, deletion |
| `src/infrastructure/s3/presigned-urls.ts` | `getUploadUrl()`, `getDownloadUrl()`, `deleteObject()`, `generateAudioKey()`, `generateDocumentKey()`, `generateAssetKey()` | Alternative presigned URL generation with path conventions |

### 1.2 Domain Services Using S3

| File | S3 Functions Used | Data Type |
|------|-------------------|-----------|
| `src/domains/recording/recording.service.ts` | `getUploadUrl`, `getDownloadUrl`, `deleteObject` | Audio recordings |
| `src/domains/recording/transcription.service.ts` | `getDownloadUrl` | Audio URL for Deepgram |
| `src/domains/documents/document.service.ts` | `getUploadUrl`, `getDownloadUrl`, `deleteObject` | Clinical documents |

### 1.3 API Routes Using S3 (Indirectly via Services)

| Route | Purpose |
|-------|---------|
| `src/app/api/recordings/route.ts` | Create recording session |
| `src/app/api/recordings/[id]/upload-url/route.ts` | Get presigned upload URL for audio |
| `src/app/api/recordings/[id]/upload/route.ts` | Confirm audio upload |
| `src/app/api/documents/route.ts` | Create document session |
| `src/app/api/documents/[id]/upload-url/route.ts` | Get presigned upload URL for documents |

---

## 2. AWS SES Dependencies

**Status**: No AWS SES integration exists in the codebase.

The current application uses **in-app notifications only**:
- Notifications stored in `notifications` table
- Delivered via `src/domains/notifications/notification.service.ts`
- Retrieved via `/api/notifications` endpoint

Email sending is a **new capability** to be added via Resend.

---

## 3. Data Flows and PHI Touch Points

### 3.1 Audio Recordings Flow

```
User Device → [S3 Upload URL] → S3 Bucket → [S3 Download URL] → Deepgram API
                                    ↓
                            Transcript stored in DB
```

**PHI Classification**:
- **Type**: Consultation audio (ambient or dictation recordings)
- **Content**: Patient names, medical conditions, clinical discussions, treatment plans
- **Sensitivity**: HIGH - Direct PHI in audio form
- **Current Storage Key**: `recordings/{userId}/{recordingId}.webm`

### 3.2 Clinical Documents Flow

```
User Device → [S3 Upload URL] → S3 Bucket → [S3 Download URL] → AI Vision API
                                    ↓
                            Extracted data stored in DB
```

**PHI Classification**:
- **Type**: Medical reports (echo, angiogram, ECG, Holter, lab results, referral letters)
- **Content**: Patient identifiers, clinical measurements, diagnoses, recommendations
- **Sensitivity**: HIGH - Clinical documents with patient data
- **Current Storage Key**: `documents/{userId}/{documentId}.{ext}`

### 3.3 User Assets Flow

```
User Device → [S3 Upload URL] → S3 Bucket → [Referenced in letters]
```

**PHI Classification**:
- **Type**: Signatures, letterheads
- **Content**: Physician signatures, practice branding
- **Sensitivity**: LOW - No patient data
- **Current Storage Key**: `assets/{practiceId}/{type}/{userId}-{filename}`

### 3.4 Letter Generation Flow (Uses S3 indirectly)

```
Recording (from S3 URL) + Documents (from S3 URL) → AI Generation → Letter Draft
                                                              ↓
                                                     Physician Review
                                                              ↓
                                                        Approval
                                                              ↓
                                                  [Future: Email Send]
```

**PHI Classification**:
- Letter content contains patient names, clinical findings, diagnoses, treatment plans
- Source anchoring links to original documents (stored in S3)
- Email will contain PDF attachment with full letter content

---

## 4. AWS Environment Variables

### Currently Required

| Variable | Purpose | Migration Action |
|----------|---------|------------------|
| `AWS_REGION` | AWS region for S3 and Bedrock | **KEEP** - Still needed for Bedrock |
| `AWS_ACCESS_KEY_ID` | AWS credentials | **KEEP** - Still needed for Bedrock |
| `AWS_SECRET_ACCESS_KEY` | AWS credentials | **KEEP** - Still needed for Bedrock |
| `S3_BUCKET_NAME` | S3 bucket for file storage | **REMOVE** - Replaced by Supabase |
| `BEDROCK_OPUS_MODEL_ID` | Claude Opus model ID | **KEEP** - Still using Bedrock |
| `BEDROCK_SONNET_MODEL_ID` | Claude Sonnet model ID | **KEEP** - Still using Bedrock |

### New Variables Required

| Variable | Purpose |
|----------|---------|
| `SUPABASE_URL` | Supabase project URL |
| `SUPABASE_ANON_KEY` | Supabase anonymous key (for client-side, if needed) |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase service role key (for server-side) |
| `RESEND_API_KEY` | Resend API key |
| `RESEND_FROM_EMAIL` | Verified sender email (e.g., noreply@dictatemed.com) |

---

## 5. npm Packages

### Packages to Remove

| Package | Version | Purpose |
|---------|---------|---------|
| `@aws-sdk/client-s3` | ^3.500.0 | S3 file operations |
| `@aws-sdk/s3-request-presigner` | ^3.500.0 | Presigned URL generation |

### Packages to Keep

| Package | Version | Purpose |
|---------|---------|---------|
| `@aws-sdk/client-bedrock-runtime` | ^3.500.0 | Claude AI via Bedrock |

### Packages to Add

| Package | Version | Purpose |
|---------|---------|---------|
| `@supabase/supabase-js` | ^2.x | Supabase client (storage + optional auth) |
| `resend` | ^3.x | Email sending |

---

## 6. Database Schema PHI Inventory

### Tables Containing PHI

| Table | PHI Fields | Access Pattern |
|-------|------------|----------------|
| `patients` | `encryptedData` (AES-256-GCM encrypted JSON with name, DOB, medicare, etc.) | By practiceId |
| `recordings` | `s3AudioKey`, `transcriptText`, `transcriptRaw` | By userId |
| `documents` | `s3Key`, `extractedData`, `extractedText` | By userId |
| `letters` | `contentDraft`, `contentFinal`, source anchors | By userId |
| `consultations` | Links patient, referrer, recordings, documents | By userId |
| `referrers` | `name`, `email`, `phone`, `address` | By practiceId |
| `cc_recipients` | `name`, `email`, `address` | By consultationId |

### Tables with PHI References

| Table | PHI Reference | Purpose |
|-------|---------------|---------|
| `provenance` | `data` (JSON with letter generation history) | Audit trail |
| `audit_logs` | `metadata` (may contain resource identifiers) | Activity logging |
| `style_edits` | `beforeText`, `afterText` | Style learning (contains letter excerpts) |

---

## 7. Security Considerations for Migration

### 7.1 Storage Security Requirements

- [ ] All Supabase storage buckets must be **private** (no public access)
- [ ] All file access via **signed URLs** with short expiration (15 min upload, 1 hour download)
- [ ] **RLS policies** on `storage.objects` to enforce user-level isolation
- [ ] **Audit logging** for all file access operations
- [ ] Supabase provides **encryption at rest** (verify configuration)

### 7.2 Email Security Requirements

- [ ] **No PHI in email subject lines** (use generic subjects)
- [ ] Letter content delivered as **PDF attachment only**
- [ ] Email body contains minimal information with **medico-legal disclaimer**
- [ ] All email sends **logged to database** (`sent_emails` table)
- [ ] Failed sends logged to **audit_logs** for investigation
- [ ] Use **verified domain** for sender address

### 7.3 Data Retention Requirements

- [ ] **Audio recordings**: Delete from storage after successful transcription
- [ ] **Clinical documents**: Configurable retention period, automated cleanup job
- [ ] **Soft delete metadata**: Keep `deleted_at` timestamp in database for audit trail
- [ ] **Hard delete files**: Actually remove from Supabase storage

### 7.4 Access Control Requirements

- [ ] **RLS on all PHI tables** in PostgreSQL
- [ ] Users can only access their own data (`user_id = auth.uid()`)
- [ ] Practice admins get **aggregate views only** (no raw PHI)
- [ ] Service role keys **server-side only** (never exposed to client)

---

## 8. Migration Risk Assessment

| Risk | Likelihood | Impact | Mitigation |
|------|------------|--------|------------|
| Deepgram cannot access Supabase signed URLs | Low | High | Test early with Deepgram webhook |
| RLS policy gaps allow cross-user access | Medium | Critical | SQL test script to verify policies |
| Audio not deleted after transcription | Medium | Medium | Automated cleanup job + monitoring |
| Email delivery failures | Medium | Medium | Resend has good deliverability, monitor dashboard |
| Performance regression | Low | Medium | Measure before/after, Supabase edge functions if needed |

---

## 9. Files to Delete After Migration

```
src/infrastructure/s3/client.ts
src/infrastructure/s3/upload.service.ts
src/infrastructure/s3/presigned-urls.ts
src/infrastructure/s3/ (entire directory)
```

---

## 10. Verification Checklist

### Pre-Migration
- [ ] Document all current S3 key patterns
- [ ] Verify Supabase project is configured
- [ ] Verify Resend domain is verified
- [ ] Create test accounts for integration testing

### During Migration
- [ ] Storage service works for upload/download/delete
- [ ] Deepgram can access audio via Supabase signed URLs
- [ ] AI Vision can access documents via Supabase signed URLs
- [ ] RLS policies block cross-user access
- [ ] Audit logs capture all PHI access
- [ ] Email sends work with PDF attachment
- [ ] Email failures are logged properly

### Post-Migration
- [ ] All S3 SDK imports removed
- [ ] Application builds without AWS S3 dependencies
- [ ] End-to-end workflow functions correctly
- [ ] No public URLs for PHI data
- [ ] Audit trail is complete and queryable

---

*Report generated as part of DictateMED AWS to Supabase/Resend migration task*
