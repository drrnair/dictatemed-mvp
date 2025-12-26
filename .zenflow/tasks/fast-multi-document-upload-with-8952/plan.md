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
- [x] Added comprehensive integration tests (19 new tests for batch, extract-fast, status)
  - Auth, rate limiting, validation, success, and error cases
- [x] Added rate limit headers to all extract-fast responses
- [x] Added rate limiting to status endpoint
- [x] Standardized `retryAfter` property name across all endpoints

**Files created**:
- `src/app/api/referrals/batch/route.ts`
- `src/app/api/referrals/[id]/extract-fast/route.ts`
- `src/app/api/referrals/[id]/status/route.ts`

**Files modified**:
- `tests/integration/api/referrals.test.ts` (added 19 new tests, now 49 total)
- `src/app/api/referrals/[id]/extract-text/route.ts` (standardized retryAfter)
- `src/app/api/referrals/[id]/extract-structured/route.ts` (standardized retryAfter)

**Verification**: `npm run typecheck` passed, 49 integration tests passing

---

### [x] Step 4: Upload Queue Hook
<!-- chat-id: 53c3aa26-ac2c-407e-a66c-61c2105a9104 -->

**Objective**: State management for multi-file upload queue

**Completed**:
- [x] Created `src/hooks/use-document-upload-queue.ts`:
  - Track multiple files with individual progress (queued, uploading, uploaded, extracting, complete, failed)
  - Handle parallel uploads (max 3 concurrent via batch processing)
  - Manage upload → confirm → text extraction → fast extraction flow
  - AbortController per file for cancellation
  - Retry logic with exponential backoff for transient failures (network, 5xx, 429)
  - Derived state: hasErrors, allFastExtractionsComplete, canProceed, aggregatedFastExtraction
- [x] Added abort/cancel support for individual files via `cancelFile(clientId)`
- [x] Added retry logic for failed uploads via `retryFile(clientId)`
- [x] Comprehensive unit tests (31 tests):
  - Initial state tests
  - addFiles validation (MIME types, size limits, batch limits)
  - removeFile, cancelFile, clearQueue, reset operations
  - startUpload flow including batch API, S3 upload, confirm, text extraction, fast extraction
  - Error handling for each stage (batch failure, upload failure, extraction failure)
  - Retry functionality tests
  - Derived state tests (hasErrors, canProceed, allFastExtractionsComplete)

**Files created**:
- `src/hooks/use-document-upload-queue.ts`
- `tests/unit/hooks/use-document-upload-queue.test.ts`

**Note**: `src/components/referral/DocumentUploadQueue.tsx` was also created during this step as a supporting UI component for the hook. It logically belongs to Step 5 but was implemented early. Step 5 should add unit tests for this component.

**Verification**: `npm run typecheck` passed, 31 unit tests passing

---

### [x] Step 5: UI Components

**Objective**: Build multi-document upload interface

**Completed**:
- [x] Created `DocumentUploadQueue` component:
  - List of files with individual progress bars
  - Status indicators (uploading, extracting, complete, failed)
  - Cancel/retry/remove buttons per file
  - Summary header with processing/complete/failed counts
  - Visual styling based on file status (green for complete, red for failed)
- [x] Created `FastExtractionResult` component:
  - Display patient name, DOB, MRN with field labels
  - Confidence indicators per field (high/medium/low with tooltips)
  - Click-to-edit functionality for all fields
  - Date formatting (YYYY-MM-DD to DD/MM/YYYY)
  - Low confidence warning banner
  - No data warning when extraction fails
  - Processing time display
- [x] Created `BackgroundProcessingIndicator` component:
  - Two variants: inline (minimal) and banner (prominent)
  - Status-based styling (blue/processing, green/complete, amber/failed)
  - Progress dots for multi-document processing
  - `BackgroundProcessingBadge` for toolbar display
  - `BackgroundProcessingInfo` for explaining background processing
- [x] Created `MultiDocumentUploader` component:
  - Multi-select file input (`multiple` attribute)
  - Drag-and-drop for multiple files with visual feedback
  - Composes queue, results, and indicator components
  - "Upload N files" button for queued files
  - "Continue to Recording" button (enabled after fast extraction)
  - "Clear All" button with processing state handling
  - Integrates with `useDocumentUploadQueue` hook
- [x] Updated `src/components/referral/index.ts` to export new components
- [x] Comprehensive unit tests (120 tests total):
  - DocumentUploadQueue: 27 tests
  - FastExtractionResult: 25 tests
  - BackgroundProcessingIndicator: 36 tests
  - MultiDocumentUploader: 32 tests

**Files created**:
- `src/components/referral/DocumentUploadQueue.tsx`
- `src/components/referral/FastExtractionResult.tsx`
- `src/components/referral/BackgroundProcessingIndicator.tsx`
- `src/components/referral/MultiDocumentUploader.tsx`
- `tests/unit/components/DocumentUploadQueue.test.tsx`
- `tests/unit/components/FastExtractionResult.test.tsx`
- `tests/unit/components/BackgroundProcessingIndicator.test.tsx`
- `tests/unit/components/MultiDocumentUploader.test.tsx`

**Files modified**:
- `src/components/referral/index.ts` (added exports for new components)

**Verification**: `npm run typecheck` passed, 120 unit tests passing

---

### [x] Step 6: Integration & Background Processing
<!-- chat-id: 08732c8f-cf9f-4cab-9105-63573805d3cd -->

**Objective**: Connect components to workflow, handle full extraction

**Completed**:
- [x] Updated `ReferralUploader.tsx` to support multi-document mode:
  - Added `multiDocument` prop to switch between single and multi-file modes
  - Added `onFastExtractionComplete` and `onContinue` callbacks for multi-doc mode
  - Renders `MultiDocumentUploader` when `multiDocument={true}`
- [x] Trigger full extraction after fast extraction completes:
  - Added `triggerFullExtraction()` function to `useDocumentUploadQueue` hook
  - Fire-and-forget call to `/api/referrals/[id]/extract-structured` after fast extraction
  - Updates `fullExtractionComplete` flag on success
  - Silent failure handling (full extraction is optional)
- [x] Updated `POST /api/referrals/[id]/extract-structured` endpoint:
  - Marks `fullExtractionStatus` as PROCESSING at start
  - Marks `fullExtractionStatus` as COMPLETE on success
  - Marks `fullExtractionStatus` as FAILED with error message on failure
  - Stores `fullExtractionStartedAt` and `fullExtractionCompletedAt` timestamps
- [x] Integrated with `ConsultationContextForm`:
  - Added `multiDocumentUpload`, `showBackgroundProcessing`, `processingDocumentCount` props
  - Shows `BackgroundProcessingIndicator` in header when processing
  - Shows multi-document upload summary with patient info from fast extraction
  - Pre-fills form with fast extraction data and document IDs
  - Added `referralDocumentIds` and `fastExtractionData` to `ConsultationFormData`
- [x] Updated tests for hook changes (31 tests passing)

**Files modified**:
- `src/components/referral/ReferralUploader.tsx`
- `src/hooks/use-document-upload-queue.ts`
- `src/app/api/referrals/[id]/extract-structured/route.ts`
- `src/components/consultation/ConsultationContextForm.tsx`
- `tests/unit/hooks/use-document-upload-queue.test.ts`

**Verification**: `npm run typecheck` passed, 31 hook unit tests passing

---

### [x] Step 7: Testing & Polish
<!-- chat-id: 963497f3-d22f-4032-8861-2dfa55370d13 -->

**Objective**: Comprehensive testing and error handling

**Completed**:
- [x] Added integration tests for multi-file upload flow (10 new edge case tests):
  - Empty files array handling
  - Duplicate filenames in batch
  - Mixed valid/invalid MIME types
  - Empty document text handling
  - Concurrent extraction requests
  - AI extraction timeout handling
  - Malformed AI response handling
  - Full extraction error reporting
  - Complete extraction data response
  - Document uploading state handling
- [x] Created E2E test suite for upload → recording workflow:
  - `tests/e2e/workflows/multi-document-upload.spec.ts`
  - Multi-document upload interface display
  - Multiple file selection support
  - Upload queue display
  - Fast extraction results with confidence
  - Continue button enablement
  - Background processing indicator
  - Partial upload failure handling
  - Maximum file limit verification
- [x] Added performance verification tests:
  - Fast extraction <5 seconds target verification
  - Realistic extraction delay simulation
- [x] Added error handling tests:
  - Extraction failure handling
  - Retry after failure support
- [x] Added accessibility tests:
  - Keyboard accessible drop zone
  - Screen reader status announcements
- [x] Fixed React hooks rules violation in ReferralUploader:
  - Refactored to use separate SingleFileUploader component
  - Main ReferralUploader now delegates to appropriate uploader
- [x] All tests passing:
  - 1761 unit tests passing
  - 414 integration tests passing
  - Lint errors resolved

**Files created**:
- `tests/e2e/workflows/multi-document-upload.spec.ts`

**Files modified**:
- `tests/integration/api/referrals.test.ts` (added 10 edge case tests)
- `src/components/referral/ReferralUploader.tsx` (fixed hooks rules violation)

**Verification**: `npm run verify` passed (lint, typecheck, 1761 unit tests, 414 integration tests)

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
