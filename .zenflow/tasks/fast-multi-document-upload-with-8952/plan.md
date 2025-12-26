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

### [x] Step 1: Database Schema & Types
<!-- chat-id: 18578dde-7bec-47ec-ac11-8b5866afa7a6 -->

**Objective**: Add database fields and types for two-phase extraction tracking

**Completed**:
- [x] Added new enums to `prisma/schema.prisma`:
  - `FastExtractionStatus` (PENDING, PROCESSING, COMPLETE, FAILED)
  - `FullExtractionStatus` (PENDING, PROCESSING, COMPLETE, FAILED)
- [x] Added new fields to `ReferralDocument` in `prisma/schema.prisma`:
  - `fastExtractionStatus`, `fastExtractionData`, `fastExtractionStartedAt`, `fastExtractionCompletedAt`, `fastExtractionError`
  - `fullExtractionStatus`, `fullExtractionStartedAt`, `fullExtractionCompletedAt`, `fullExtractionError`
  - Added indexes on `fastExtractionStatus` and `fullExtractionStatus`
- [x] Generated Prisma client with new schema
- [x] Added new types to `src/domains/referrals/referral.types.ts`:
  - `FastExtractionStatus`, `FullExtractionStatus` (re-exported from Prisma)
  - `ConfidenceLevel`, `FieldConfidence`, `FastExtractedData`
  - `DocumentProcessingStatus`
  - `BatchUploadFileInput`, `BatchUploadInput`, `BatchUploadFileResult`, `BatchUploadResult`
  - `FastExtractionInput`, `FastExtractionResult`
  - `DocumentStatusInput`, `DocumentStatusResult`
  - `QueuedFile`, `UploadQueueState`
  - Constants: `MAX_BATCH_FILES`, `MAX_BATCH_FILE_SIZE`, `MAX_CONCURRENT_UPLOADS`, etc.
  - Helpers: `getConfidenceLevel()`, `createFieldConfidence()`
- [x] Types auto-exported via existing barrel export in `src/domains/referrals/index.ts`
- [x] Updated test mocks with new fields

**Files modified**:
- `prisma/schema.prisma`
- `src/domains/referrals/referral.types.ts`
- `tests/integration/api/referrals.test.ts`
- `tests/unit/domains/referrals/referral.service.test.ts`
- `tests/unit/domains/referrals/referral-extraction.test.ts`

**Verification**: `npm run typecheck` passed

---

### [x] Step 2: Fast Extraction Service & Prompt
<!-- chat-id: ade68013-ca7a-4d12-89df-8ca0eb4b916b -->

**Objective**: Create optimized extraction for patient identifiers (<5 seconds)

**Completed**:
- [x] Created `src/domains/referrals/extractors/fast-patient-extraction.ts`:
  - `FAST_PATIENT_EXTRACTION_PROMPT` - Minimal prompt for name, DOB, MRN only
  - `FAST_EXTRACTION_SYSTEM_PROMPT` - Minimal system prompt
  - `parseFastExtraction()` - Parser with JSON cleaning, field extraction, date normalization
  - `FastExtractionError` - Custom error class with error codes
  - Confidence scoring with weighted calculation (name 40%, DOB 35%, MRN 25%)
  - Helper functions: `hasFastExtractionData()`, `hasMinimumFastExtractionData()`, `getFastExtractionSummary()`
- [x] Created `src/domains/referrals/referral-fast-extraction.service.ts`:
  - `extractFastPatientData()` - Main extraction function with status tracking
  - `getFastExtractionData()` - Retrieve extraction data
  - `getFastExtractionStatus()` - Get current status
  - `isFastExtractionComplete()` - Check completion
  - `retryFastExtraction()` - Retry failed extractions
  - Uses Sonnet model with aggressive retry config (2 retries, 500ms initial delay)
  - Creates audit log with timing metrics
- [x] Added comprehensive unit tests (44 tests):
  - Parser tests for JSON cleaning, date normalization, confidence calculation
  - Service tests for extraction flow, status updates, error handling
  - All tests passing

**Files created**:
- `src/domains/referrals/extractors/fast-patient-extraction.ts`
- `src/domains/referrals/referral-fast-extraction.service.ts`
- `tests/unit/domains/referrals/fast-patient-extraction.test.ts`

**Verification**: `npm run typecheck` passed, 44 unit tests passing

---

### [x] Step 3: API Endpoints

**Objective**: Create batch, fast extraction, and status polling endpoints

**Completed**:
- [x] Created `POST /api/referrals/batch` endpoint:
  - Accepts up to 10 files per batch (validated via Zod)
  - Creates multiple document records in parallel
  - Returns array of upload URLs with batchId
  - Returns 201 for full success, 207 for partial success, 400 for all failures
  - Includes rate limiting and proper error handling
- [x] Created `POST /api/referrals/[id]/extract-fast` endpoint:
  - Triggers fast extraction service
  - Returns patient identifiers (name, DOB, MRN) with confidence scores
  - Handles 404 for document not found, 400 for no text content
  - Returns 200 with status field for both success and extraction failures
- [x] Created `GET /api/referrals/[id]/status` endpoint:
  - Returns current processing status for polling
  - Includes document status, fast/full extraction status, and extracted data
  - Reports errors from any phase (document, fast extraction, full extraction)
  - 1-second cache header for efficient polling
- [x] Added comprehensive integration tests (18 new tests for batch, extract-fast, status)
  - Auth, rate limiting, validation, success, and error cases

**Files created**:
- `src/app/api/referrals/batch/route.ts`
- `src/app/api/referrals/[id]/extract-fast/route.ts`
- `src/app/api/referrals/[id]/status/route.ts`

**Files modified**:
- `tests/integration/api/referrals.test.ts` (added 18 new tests, now 48 total)

**Verification**: `npm run typecheck` passed, 48 integration tests passing

---

### [ ] Step 4: Upload Queue Hook
<!-- chat-id: 53c3aa26-ac2c-407e-a66c-61c2105a9104 -->

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
