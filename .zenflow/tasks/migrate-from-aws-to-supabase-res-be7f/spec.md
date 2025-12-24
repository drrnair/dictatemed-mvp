# Technical Specification: Migrate from AWS to Supabase + Resend

**Task Difficulty**: Hard

This is a complex migration involving multiple AWS services, PHI (Protected Health Information) handling, security hardening, database schema changes, and new email functionality. The task touches nearly every layer of the application and requires careful attention to HIPAA-aligned patterns.

---

## 1. Technical Context

### Current Technology Stack
- **Framework**: Next.js 14 (App Router)
- **Language**: TypeScript 5.3
- **Database**: PostgreSQL via Prisma ORM
- **Authentication**: Auth0 (`@auth0/nextjs-auth0`)
- **File Storage**: AWS S3 (`@aws-sdk/client-s3`, `@aws-sdk/s3-request-presigner`)
- **AI Models**: AWS Bedrock (`@aws-sdk/client-bedrock-runtime`) - Claude Opus/Sonnet
- **Transcription**: Deepgram (`@deepgram/sdk`)
- **Email**: None (in-app notifications only)
- **PHI Encryption**: AES-256-GCM for patient data at rest

### Target Technology Stack
- **File Storage**: Supabase Storage (replaces S3)
- **Email**: Resend (new capability)
- **AI Models**: Keep AWS Bedrock (out of scope for this migration)
- **Everything else**: Unchanged

### Key Dependencies to Modify

**Remove (S3-related)**:
```
"@aws-sdk/client-s3": "^3.500.0"
"@aws-sdk/s3-request-presigner": "^3.500.0"
```

**Add**:
```
"@supabase/supabase-js": "^2.x"
"resend": "^3.x"
```

**Keep (Bedrock - not part of this migration)**:
```
"@aws-sdk/client-bedrock-runtime": "^3.500.0"
```

---

## 2. AWS Audit Summary

### 2.1 S3 Usage (To Be Migrated)

| File | Purpose | PHI Type |
|------|---------|----------|
| `src/infrastructure/s3/client.ts` | S3Client singleton, bucket name retrieval | Config only |
| `src/infrastructure/s3/upload.service.ts` | Presigned URLs for upload/download, delete, metadata | Audio, Documents |
| `src/infrastructure/s3/presigned-urls.ts` | Alternative presigned URL generation with path schemes | Audio, Documents, Assets |

**S3 Key Patterns Currently Used**:
- Audio: `recordings/{userId}/{recordingId}.webm`
- Documents: `documents/{userId}/{documentId}.{ext}`
- Signatures: `signatures/{userId}/{timestamp}.{ext}` (via `/api/user/signature`)
- Letterheads: `assets/{practiceId}/letterhead/{timestamp}.{ext}` (via `/api/practice/letterhead`)

**PHI Data Flows**:
1. **Audio Recordings**: Consultation audio (ambient/dictation) → S3 → Deepgram (via presigned URL) → Transcript stored in DB
2. **Clinical Documents**: PDF/images → S3 → AI Vision extraction → Extracted data in DB
3. **User Assets**: Signatures, letterheads (minimal PHI risk)

### 2.2 Bedrock Usage (Keeping)

| File | Purpose |
|------|---------|
| `src/infrastructure/bedrock/text-generation.ts` | Claude text generation for letters |
| `src/infrastructure/bedrock/vision.ts` | Claude Vision for document extraction |

**Note**: AWS Bedrock for AI is **NOT being migrated**. The task only removes S3/SES dependencies.

### 2.3 SES Usage

**Status**: No SES integration exists. The current system uses in-app notifications only via the `notifications` table.

### 2.4 Environment Variables

**Current AWS Variables**:
```
AWS_REGION="ap-southeast-2"
AWS_ACCESS_KEY_ID="..."
AWS_SECRET_ACCESS_KEY="..."
S3_BUCKET_NAME="dictatemed-uploads"
BEDROCK_OPUS_MODEL_ID="..."
BEDROCK_SONNET_MODEL_ID="..."
```

**Post-Migration Variables**:
```
# Keep for Bedrock
AWS_REGION="ap-southeast-2"
AWS_ACCESS_KEY_ID="..."
AWS_SECRET_ACCESS_KEY="..."
BEDROCK_OPUS_MODEL_ID="..."
BEDROCK_SONNET_MODEL_ID="..."

# New for Supabase
SUPABASE_URL="https://xxx.supabase.co"
SUPABASE_ANON_KEY="..."
SUPABASE_SERVICE_ROLE_KEY="..."

# New for Resend
RESEND_API_KEY="..."
RESEND_FROM_EMAIL="noreply@dictatemed.com"
```

---

## 3. Implementation Approach

### 3.1 Supabase Storage Architecture

**Buckets** (all private, no public access):

| Bucket | Purpose | Path Convention | Access |
|--------|---------|-----------------|--------|
| `audio_recordings` | Consultation audio | `{user_id}/{consultation_id}/{timestamp}_{mode}.webm` | User's own only |
| `clinical_documents` | PDFs, images | `{user_id}/{patient_id}/{document_type}/{filename}_{timestamp}.{ext}` | User's own only |
| `user_assets` | Signatures, letterheads | `{practice_id}/{user_id}/{type}/{filename}` | Practice members |

**Security Controls**:
- All buckets private (no public URLs)
- RLS policies on storage.objects table
- Short-lived signed URLs (15 min upload, 1 hour download)
- Supabase's built-in encryption at rest

### 3.2 Database Schema Changes

**New Table: `audio_recordings`** (separate from current `recordings` table for audit trail):
```sql
CREATE TABLE audio_recordings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id),
  consultation_id UUID REFERENCES consultations(id),
  recording_id UUID REFERENCES recordings(id),
  storage_path TEXT NOT NULL,
  file_size_bytes BIGINT,
  status TEXT NOT NULL DEFAULT 'uploaded',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  deleted_at TIMESTAMPTZ,
  deletion_reason TEXT
);
```

**Modify `recordings` table**:
- Replace `s3AudioKey` → `storage_path`
- Add `audio_deleted_at` (for retention tracking)

**Modify `documents` table**:
- Replace `s3Key` → `storage_path`
- Add `retention_until` TIMESTAMPTZ
- Add `deleted_at` TIMESTAMPTZ
- Add `deletion_reason` TEXT

**New Table: `sent_emails`**:
```sql
CREATE TABLE sent_emails (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id),
  letter_id UUID REFERENCES letters(id),
  recipient_email TEXT NOT NULL,
  recipient_name TEXT,
  subject TEXT NOT NULL,
  provider_message_id TEXT,
  status TEXT NOT NULL DEFAULT 'pending',
  sent_at TIMESTAMPTZ,
  last_event_at TIMESTAMPTZ,
  error_message TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

**Expand `audit_logs` table**:
- Already sufficient for HIPAA needs
- Ensure all PHI access actions are logged

### 3.3 Row Level Security (RLS) Policies

**Enable RLS on all PHI tables**:
- `patients` - already has practiceId scope, need user-level RLS
- `recordings` - userId scoped
- `documents` - userId scoped
- `letters` - userId scoped
- `consultations` - userId scoped
- `audio_recordings` (new) - userId scoped
- `sent_emails` (new) - userId scoped
- `clinical_documents` (storage bucket) - userId scoped
- `audio_recordings` (storage bucket) - userId scoped

**Policy Pattern**:
```sql
CREATE POLICY "users_own_data" ON recordings
  FOR ALL
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());
```

### 3.4 Resend Email Architecture

**Email Service Module**:
- `src/infrastructure/email/resend.client.ts` - Resend client singleton
- `src/infrastructure/email/email.service.ts` - Email sending with templates
- `src/infrastructure/email/templates/letter.ts` - Consultation letter template

**Email Template Content**:
- HTML + plain text versions
- Medico-legal disclaimer
- DictateMED attribution (administrative tool, clinical review required)
- PDF attachment (the actual letter)
- Conservative PHI handling (no clinical details in subject)

**Audit Trail**:
- All sends logged to `sent_emails` table
- Failed attempts also logged to `audit_logs`
- Optional: Resend webhook for delivery status updates

---

## 4. Source Code Changes

### 4.1 Files to Create

| Path | Purpose |
|------|---------|
| `src/infrastructure/supabase/client.ts` | Supabase client singleton |
| `src/infrastructure/supabase/storage.service.ts` | Storage operations (upload, download, delete, signed URLs) |
| `src/infrastructure/email/resend.client.ts` | Resend client singleton |
| `src/infrastructure/email/email.service.ts` | Email sending service |
| `src/infrastructure/email/templates/letter.ts` | Letter email template |
| `src/app/api/email/webhook/route.ts` | Resend webhook handler (optional) |
| `prisma/migrations/xxx_add_supabase_storage_fields.sql` | Schema migration |
| `prisma/migrations/xxx_add_sent_emails.sql` | Email tracking table |
| `MIGRATION_AUDIT_REPORT.md` | Audit report (task deliverable) |

### 4.2 Files to Modify

| Path | Changes |
|------|---------|
| `src/infrastructure/s3/client.ts` | **DELETE** |
| `src/infrastructure/s3/upload.service.ts` | **DELETE** |
| `src/infrastructure/s3/presigned-urls.ts` | **DELETE** |
| `src/domains/recording/recording.service.ts` | Replace S3 imports with Supabase storage |
| `src/domains/documents/document.service.ts` | Replace S3 imports with Supabase storage |
| `src/domains/recording/transcription.service.ts` | Update to use Supabase signed URLs for Deepgram |
| `src/domains/documents/extraction.service.ts` | Update to use Supabase signed URLs for AI Vision |
| `src/domains/letters/approval.service.ts` | Add email sending on approval |
| `src/app/api/recordings/[id]/upload-url/route.ts` | Use Supabase storage |
| `src/app/api/recordings/[id]/transcribe/route.ts` | Use Supabase signed URLs for Deepgram |
| `src/app/api/documents/[id]/upload-url/route.ts` | Use Supabase storage |
| `src/app/api/user/signature/route.ts` | Replace S3 with Supabase for signature upload/delete |
| `src/app/api/practice/letterhead/route.ts` | Replace S3 with Supabase for letterhead upload/delete |
| `src/app/api/user/account/route.ts` | Replace S3 deleteObject with Supabase storage delete |
| `prisma/schema.prisma` | Add new fields, new tables |
| `package.json` | Remove S3 SDK, add Supabase/Resend |
| `.env.example` | Update environment variables |

### 4.3 Files to Create for Tests

| Path | Purpose |
|------|---------|
| `tests/integration/supabase-storage.test.ts` | Storage upload/download/delete tests |
| `tests/integration/email.test.ts` | Email sending tests |
| `tests/integration/rls-policies.test.ts` | Cross-user access denial tests |
| `tests/integration/audio-retention.test.ts` | Audio deletion after transcription |

---

## 5. Data Model Changes

### 5.1 Prisma Schema Updates

```prisma
// Modify Recording model
model Recording {
  // ... existing fields ...
  storagePath       String?  // Replaces s3AudioKey
  audioDeletedAt    DateTime?
  // Remove: s3AudioKey
}

// Modify Document model
model Document {
  // ... existing fields ...
  storagePath      String   // Replaces s3Key
  retentionUntil   DateTime?
  deletedAt        DateTime?
  deletionReason   String?
  // Remove: s3Key
}

// New model
model SentEmail {
  id               String    @id @default(uuid())
  userId           String
  user             User      @relation(fields: [userId], references: [id])
  letterId         String?
  letter           Letter?   @relation(fields: [letterId], references: [id])
  recipientEmail   String
  recipientName    String?
  subject          String
  providerMessageId String?
  status           EmailStatus @default(PENDING)
  sentAt           DateTime?
  lastEventAt      DateTime?
  errorMessage     String?
  createdAt        DateTime  @default(now())

  @@index([userId, createdAt])
  @@map("sent_emails")
}

enum EmailStatus {
  PENDING
  SENT
  DELIVERED
  BOUNCED
  FAILED
}
```

### 5.2 Supabase Storage Policies (SQL)

```sql
-- Audio recordings bucket policy
CREATE POLICY "users_own_audio" ON storage.objects
  FOR ALL
  USING (
    bucket_id = 'audio_recordings' AND
    (storage.foldername(name))[1] = auth.uid()::text
  );

-- Clinical documents bucket policy
CREATE POLICY "users_own_documents" ON storage.objects
  FOR ALL
  USING (
    bucket_id = 'clinical_documents' AND
    (storage.foldername(name))[1] = auth.uid()::text
  );
```

---

## 6. API Changes

### 6.1 New Endpoints

| Method | Path | Purpose |
|--------|------|---------|
| POST | `/api/email/send` | Send approved letter via email |
| POST | `/api/email/webhook` | Resend delivery status webhook |

### 6.2 Modified Endpoints

| Path | Changes |
|------|---------|
| `/api/recordings/[id]/upload-url` | Return Supabase signed URL |
| `/api/documents/[id]/upload-url` | Return Supabase signed URL |
| `/api/letters/[id]/approve` | Optionally trigger email send |

---

## 7. Verification Approach

### 7.1 Unit Tests
- Storage service: mock Supabase client, verify correct bucket/path usage
- Email service: mock Resend client, verify template rendering
- PHI handling: verify no PHI leaks in email subjects

### 7.2 Integration Tests
- Upload audio → confirm in Supabase → transcribe → delete audio
- Upload document → process → verify retention behavior
- Send email → verify `sent_emails` record
- Cross-user access: User A cannot access User B's files

### 7.3 Security Tests
- RLS policy verification with SQL test scripts
- No public bucket access
- Signed URLs expire correctly
- Audit log entries for all PHI access

### 7.4 Manual Smoke Test
1. Login as specialist
2. Record consultation → verify upload to Supabase
3. Confirm transcription → verify audio deleted
4. Upload clinical PDF → verify storage
5. Generate letter → verify AI still works
6. Approve letter → send via Resend
7. Check audit logs for complete trail

---

## 8. Implementation Plan (Detailed Steps)

### Step 1: Create Migration Audit Report
- Scan codebase for all AWS usage
- Document PHI touch points
- Create `MIGRATION_AUDIT_REPORT.md`

### Step 2: Set Up Supabase Infrastructure
- Create Supabase project (or configure existing)
- Create storage buckets with policies
- Add Prisma schema changes
- Run migrations

### Step 3: Implement Supabase Storage Service
- Create client singleton
- Implement upload/download/delete helpers
- Add signed URL generation
- Add audit logging

### Step 4: Migrate Audio Recording Storage
- Update `recording.service.ts` to use Supabase
- Update API routes
- Implement post-transcription deletion
- Add tests

### Step 5: Migrate Document Storage
- Update `document.service.ts` to use Supabase
- Update document extraction to use Supabase URLs
- Add retention policy implementation
- Add tests

### Step 6: Implement Resend Email Service
- Create Resend client
- Create email service with templates
- Add `sent_emails` table
- Integrate with letter approval flow
- Add tests

### Step 7: Strengthen RLS Policies
- Enable RLS on all PHI tables
- Create user-scoped policies
- Create SQL test script for verification

### Step 8: Remove AWS S3 Dependencies
- Delete S3 infrastructure files
- Remove S3 SDK packages
- Update environment documentation
- Verify build succeeds

### Step 9: End-to-End Smoke Test
- Full workflow verification
- Audit log review
- Performance check

### Step 10: Documentation and Cleanup
- Update README
- Update `.env.example`
- Final code review
- Create implementation report

---

## 9. Risk Mitigation

| Risk | Mitigation |
|------|------------|
| Data loss during migration | No data migration needed - new uploads go to Supabase, existing S3 data can be accessed until cutover |
| Deepgram integration breaks | Test signed URL access from Deepgram early |
| RLS policy gaps | SQL test script to verify all access patterns |
| Email deliverability | Use verified domain, monitor Resend dashboard |
| Performance regression | Measure upload/download times before and after |

---

## 10. Out of Scope

- AWS Bedrock migration (staying on AWS)
- Auth0 to Supabase Auth migration (not requested)
- Existing data migration from S3 (can be done later)
- BAA paperwork (explicitly deferred)
- Formal HIPAA certification (deferred)
