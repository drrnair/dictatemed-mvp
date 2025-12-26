# Fast Multi-Document Upload - Implementation Plan

## Configuration
- **Artifacts Path**: `.zenflow/tasks/fast-multi-document-upload-with-8952`
- **Specification**: `spec.md`
- **Difficulty**: Medium-Hard

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

**Completed**: Created `spec.md` with:
- Difficulty assessment (Medium-Hard)
- Technical context (Next.js 14, Prisma, Supabase, AWS Bedrock)
- Implementation approach (two-phase extraction, parallel uploads, polling)
- Data model changes (new fields for fast/full extraction tracking)
- API changes (batch, extract-fast, status endpoints)
- Component architecture (MultiDocumentUploader, queue, results, indicator)
- Verification approach (unit, integration, E2E tests)

---

### [ ] Step 1: Database Schema & Types
<!-- chat-id: 18578dde-7bec-47ec-ac11-8b5866afa7a6 -->

**Objective**: Add database fields and types for two-phase extraction tracking

**Tasks**:
- [ ] Add new fields to `ReferralDocument` in `prisma/schema.prisma`:
  - `fastExtractionStatus`, `fastExtractionData`, `fastExtractionStartedAt`, `fastExtractionCompletedAt`
  - `fullExtractionStatus`, `fullExtractionStartedAt`, `fullExtractionCompletedAt`
- [ ] Run `npx prisma db push` to apply schema changes
- [ ] Add new types to `src/domains/referrals/referral.types.ts`:
  - `FastExtractedData`, `DocumentProcessingStatus`, `BatchUploadResult`
- [ ] Export new types from domain index

**Files to modify**:
- `prisma/schema.prisma`
- `src/domains/referrals/referral.types.ts`
- `src/domains/referrals/index.ts`

**Verification**: `npm run typecheck && npm run test`

---

### [ ] Step 2: Fast Extraction Service & Prompt

**Objective**: Create optimized extraction for patient identifiers (<5 seconds)

**Tasks**:
- [ ] Create `src/domains/referrals/extractors/fast-patient-extraction.ts`:
  - Optimized prompt for name, DOB, MRN only
  - Parser for fast extraction response
  - Confidence scoring
- [ ] Create `src/domains/referrals/referral-fast-extraction.service.ts`:
  - `extractFastPatientData()` function
  - Update database with fast extraction status/data
- [ ] Add unit tests for fast extraction parsing

**Files to create**:
- `src/domains/referrals/extractors/fast-patient-extraction.ts`
- `src/domains/referrals/referral-fast-extraction.service.ts`

**Verification**: `npm run test -- fast-patient-extraction`

---

### [ ] Step 3: API Endpoints

**Objective**: Create batch, fast extraction, and status polling endpoints

**Tasks**:
- [ ] Create `POST /api/referrals/batch` endpoint:
  - Accept array of file metadata
  - Create multiple document records
  - Return array of upload URLs
- [ ] Create `POST /api/referrals/[id]/extract-fast` endpoint:
  - Trigger fast extraction service
  - Return patient identifiers with confidence
  - Target <5 second response
- [ ] Create `GET /api/referrals/[id]/status` endpoint:
  - Return current processing status
  - Include fast/full extraction status

**Files to create**:
- `src/app/api/referrals/batch/route.ts`
- `src/app/api/referrals/[id]/extract-fast/route.ts`
- `src/app/api/referrals/[id]/status/route.ts`

**Verification**: `npm run test -- api/referrals`

---

### [ ] Step 4: Upload Queue Hook

**Objective**: State management for multi-file upload queue

**Tasks**:
- [ ] Create `src/hooks/use-document-upload-queue.ts`:
  - Track multiple files with individual progress
  - Handle parallel uploads (max 3 concurrent)
  - Manage upload → text extraction → fast extraction flow
  - Status polling for background processing
- [ ] Add abort/cancel support for individual files
- [ ] Add retry logic for failed uploads

**Files to create**:
- `src/hooks/use-document-upload-queue.ts`

**Verification**: `npm run test -- use-document-upload-queue`

---

### [ ] Step 5: UI Components

**Objective**: Build multi-document upload interface

**Tasks**:
- [ ] Create `DocumentUploadQueue` component:
  - List of files with individual progress bars
  - Status indicators (uploading, extracting, complete, failed)
  - Cancel/retry buttons per file
- [ ] Create `FastExtractionResult` component:
  - Display patient name, DOB, MRN
  - Confidence indicators (high/medium/low)
  - Edit button for corrections
- [ ] Create `BackgroundProcessingIndicator` component:
  - "Processing documents..." status
  - Progress for full extraction
- [ ] Create `MultiDocumentUploader` component:
  - Multi-select file input (`multiple` attribute)
  - Drag-and-drop for multiple files
  - Compose queue, results, and indicator components
  - "Continue to Recording" button (enabled after fast extraction)

**Files to create**:
- `src/components/referral/DocumentUploadQueue.tsx`
- `src/components/referral/FastExtractionResult.tsx`
- `src/components/referral/BackgroundProcessingIndicator.tsx`
- `src/components/referral/MultiDocumentUploader.tsx`

**Verification**: `npm run test -- components/referral`

---

### [ ] Step 6: Integration & Background Processing

**Objective**: Connect components to workflow, handle full extraction

**Tasks**:
- [ ] Update existing `ReferralUploader.tsx` to use `MultiDocumentUploader`
- [ ] Trigger full extraction after fast extraction completes
- [ ] Update `POST /api/referrals/[id]/extract-structured` to track full extraction status
- [ ] Integrate with consultation context form:
  - Pre-fill patient search with extracted name
  - Show background processing indicator during recording
- [ ] Letter generation waits for full extraction

**Files to modify**:
- `src/components/referral/ReferralUploader.tsx`
- `src/app/api/referrals/[id]/extract-structured/route.ts`
- `src/components/consultation/ConsultationContextForm.tsx`

**Verification**: Manual testing of full workflow

---

### [ ] Step 7: Testing & Polish

**Objective**: Comprehensive testing and error handling

**Tasks**:
- [ ] Integration tests for multi-file upload flow
- [ ] E2E test for upload → recording workflow
- [ ] Error handling edge cases:
  - Partial upload failures
  - Fast extraction timeout
  - Background processing failures
- [ ] Performance verification (<5s fast extraction)
- [ ] Mobile/responsive testing

**Verification**: `npm run verify && npm run test:e2e`

---

## Dependencies

- Supabase Storage (configured)
- AWS Bedrock / Claude Sonnet 4 (configured)
- Existing referral domain services

---

## Notes

- Phase 1-3 provide the most immediate value (fast extraction)
- Background processing (Phase 6) completes the non-blocking workflow
- Consider incremental rollout with feature flag
- No external job queue needed initially - polling is sufficient
