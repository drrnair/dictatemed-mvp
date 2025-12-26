# Technical Specification: Fast Multi-Document Upload with Background Processing

## Difficulty Assessment: **Medium-Hard**

This feature involves:
- Frontend state management for multi-file uploads with progress tracking
- New API endpoints for batch operations and fast extraction
- Database schema changes for tracking extraction phases (✅ **COMPLETED**)
- Background job processing (simulated via API routes initially)
- Optimized LLM prompts for fast patient identifier extraction

---

## Technical Context

| Aspect | Details |
|--------|---------|
| **Framework** | Next.js 14 (App Router) |
| **Language** | TypeScript |
| **Database** | PostgreSQL with Prisma ORM |
| **Storage** | Supabase Storage (bucket: `clinical-documents`) |
| **AI/LLM** | AWS Bedrock (Claude Sonnet 4 for extraction) |
| **Auth** | Auth0 |
| **Testing** | Vitest (unit), Playwright (E2E) |

### Current Architecture
- **ReferralUploader**: Single-file upload with synchronous processing (6 stages: validate → create → upload → confirm → text extraction → AI extraction)
- **Processing**: Fully blocking - user waits 30-60+ seconds for full extraction
- **Status Machine**: `UPLOADED → TEXT_EXTRACTED → EXTRACTED → APPLIED → FAILED`

---

## Implementation Approach

### Core Strategy
1. **Two-Phase Extraction**: Split extraction into "fast" (patient identifiers only, <5 sec) and "full" (complete context, background)
2. **Parallel Uploads**: Upload multiple files concurrently (max 3 at a time)
3. **Non-Blocking UI**: Enable "Continue" after fast extraction completes
4. **Background Processing**: Use API route-based polling (no external job queue initially)

### Key Design Decisions

| Decision | Rationale |
|----------|-----------|
| **No external job queue** | Keep initial implementation simple; use polling instead of webhooks |
| **Fast extraction prompt** | Separate optimized prompt for patient identifiers only (name, DOB, MRN) |
| **Status polling** | Client polls for background processing status every 2 seconds (`STATUS_POLLING_INTERVAL_MS`) |
| **Max 10 files** | Balance between user needs and server load (`MAX_BATCH_FILES`) |
| **Max 3 concurrent uploads** | Prevent overwhelming Supabase Storage (`MAX_CONCURRENT_UPLOADS`) |

---

## Source Code Structure Changes

### New Files to Create

```
src/
├── components/referral/
│   ├── MultiDocumentUploader.tsx      # New multi-file upload component
│   ├── DocumentUploadQueue.tsx        # Queue display with progress bars
│   ├── FastExtractionResult.tsx       # Patient identifier display with confidence
│   └── BackgroundProcessingIndicator.tsx  # Processing status indicator
├── app/api/referrals/
│   ├── batch/route.ts                 # POST - batch document creation
│   └── [id]/
│       ├── extract-fast/route.ts      # POST - fast patient extraction (<5 sec)
│       └── status/route.ts            # GET - polling endpoint for processing status
├── domains/referrals/
│   ├── extractors/
│   │   └── fast-patient-extraction.ts # Optimized prompt for quick extraction
│   └── referral-fast-extraction.service.ts  # Fast extraction service
└── hooks/
    └── use-document-upload-queue.ts   # State management for upload queue
```

### Already Modified Files (✅ COMPLETED)

The following files have already been updated with two-phase extraction support:

```
src/
├── domains/referrals/
│   └── referral.types.ts              # ✅ Added FastExtractedData, batch types, queue types
└── prisma/
    └── schema.prisma                  # ✅ Added FastExtractionStatus, FullExtractionStatus enums & fields
```

### Files to Modify During Implementation

```
src/
├── components/referral/
│   └── ReferralUploader.tsx           # Extend to use MultiDocumentUploader
├── domains/referrals/
│   ├── referral.service.ts            # Update mapReferralDocument for new fields
│   └── index.ts                       # Export new types/services
└── app/api/referrals/[id]/
    └── extract-structured/route.ts    # Update to set fullExtractionStatus
```

---

## Data Model Changes (✅ COMPLETED)

### Prisma Schema - Already Implemented

```prisma
// New enums added to schema.prisma
enum FastExtractionStatus {
  PENDING     // Not yet started
  PROCESSING  // Currently extracting patient identifiers
  COMPLETE    // Fast extraction successful
  FAILED      // Fast extraction failed
}

enum FullExtractionStatus {
  PENDING     // Not yet started (waiting for fast extraction)
  PROCESSING  // Currently extracting full context
  COMPLETE    // Full extraction successful
  FAILED      // Full extraction failed
}

model ReferralDocument {
  // ... existing fields ...

  // Fast extraction - patient identifiers only (<5 seconds)
  fastExtractionStatus      FastExtractionStatus? @default(PENDING)
  fastExtractionData        Json?                 // { patientName, dob, mrn, confidence }
  fastExtractionStartedAt   DateTime?
  fastExtractionCompletedAt DateTime?
  fastExtractionError       String?

  // Full extraction - complete context (background, <60 seconds)
  fullExtractionStatus      FullExtractionStatus? @default(PENDING)
  fullExtractionStartedAt   DateTime?
  fullExtractionCompletedAt DateTime?
  fullExtractionError       String?

  @@index([fastExtractionStatus])
  @@index([fullExtractionStatus])
}
```

### TypeScript Types - Already Implemented

The following types are already defined in `src/domains/referrals/referral.types.ts`:

```typescript
// Fast extraction result - using FieldConfidence for per-field tracking
export interface FastExtractedData {
  patientName: FieldConfidence;   // { value, confidence, level }
  dateOfBirth: FieldConfidence;
  mrn: FieldConfidence;
  overallConfidence: number;      // 0-1
  extractedAt: string;            // ISO timestamp
  modelUsed: string;
  processingTimeMs: number;
}

// Field-level confidence with semantic level
export interface FieldConfidence {
  value: string | null;
  confidence: number;             // 0-1
  level: ConfidenceLevel;         // 'high' | 'medium' | 'low'
}

// Batch upload types
export interface BatchUploadInput { files: BatchUploadFileInput[]; }
export interface BatchUploadResult { files: BatchUploadFileResult[]; batchId: string; }

// Queue management types (client-side)
export interface QueuedFile { ... }
export interface UploadQueueState { ... }

// Constants
export const MAX_BATCH_FILES = 10;
export const MAX_BATCH_FILE_SIZE = 20 * 1024 * 1024;  // 20 MB for batch uploads
export const MAX_CONCURRENT_UPLOADS = 3;
export const FAST_EXTRACTION_TARGET_MS = 5000;
export const STATUS_POLLING_INTERVAL_MS = 2000;
```

### File Size Configuration

| Context | Constant | Value | Notes |
|---------|----------|-------|-------|
| Single file upload | `MAX_REFERRAL_FILE_SIZE` | 10 MB | Existing behavior preserved |
| Batch upload | `MAX_BATCH_FILE_SIZE` | 20 MB | New constant for multi-file uploads |

**Note**: The existing single-file upload limit (10 MB) is intentionally preserved for backward compatibility. The batch upload uses a separate, higher limit (20 MB) as specified in the requirements.

---

## API Changes

### New Endpoints

#### `POST /api/referrals/batch`
Create multiple referral documents in one request.

**Request:**
```json
{
  "files": [
    { "filename": "referral.pdf", "mimeType": "application/pdf", "sizeBytes": 102400 },
    { "filename": "results.png", "mimeType": "image/png", "sizeBytes": 51200 }
  ]
}
```

**Response (Success):**
```json
{
  "files": [
    { "id": "uuid-1", "filename": "referral.pdf", "uploadUrl": "https://...", "expiresAt": "2024-..." },
    { "id": "uuid-2", "filename": "results.png", "uploadUrl": "https://...", "expiresAt": "2024-..." }
  ],
  "batchId": "batch-uuid"
}
```

**Response (Partial Failure):**
```json
{
  "files": [
    { "id": "uuid-1", "filename": "referral.pdf", "uploadUrl": "https://...", "expiresAt": "2024-..." }
  ],
  "errors": [
    { "filename": "results.png", "error": "File size exceeds 20MB limit" }
  ],
  "batchId": "batch-uuid"
}
```

**Error Response:**
```json
{
  "error": "Invalid request",
  "details": "files array is required and must contain 1-10 items"
}
```

#### `POST /api/referrals/[id]/extract-fast`
Fast extraction of patient identifiers only (<5 seconds target).

**Response:**
```json
{
  "documentId": "uuid-1",
  "status": "COMPLETE",
  "data": {
    "patientName": { "value": "John Smith", "confidence": 0.95, "level": "high" },
    "dateOfBirth": { "value": "1965-03-15", "confidence": 0.9, "level": "high" },
    "mrn": { "value": "MRN12345678", "confidence": 0.7, "level": "medium" },
    "overallConfidence": 0.85,
    "extractedAt": "2024-01-15T10:30:00Z",
    "modelUsed": "claude-sonnet-4",
    "processingTimeMs": 2340
  }
}
```

#### `GET /api/referrals/[id]/status`
Poll for document processing status.

**Response:**
```json
{
  "documentId": "uuid-1",
  "filename": "referral.pdf",
  "status": "TEXT_EXTRACTED",
  "fastExtractionStatus": "COMPLETE",
  "fastExtractionData": { ... },
  "fullExtractionStatus": "PROCESSING",
  "error": null
}
```

### Modified Endpoints

#### `POST /api/referrals/[id]/extract-structured`
Updated to track full extraction status via new database fields.

**Changes:**
- Set `fullExtractionStatus = 'PROCESSING'` at start
- Set `fullExtractionStartedAt = now()` at start
- Set `fullExtractionStatus = 'COMPLETE'` on success
- Set `fullExtractionCompletedAt = now()` on success
- Set `fullExtractionStatus = 'FAILED'` and `fullExtractionError` on failure

---

## Component Architecture

### MultiDocumentUploader
```
┌─────────────────────────────────────────────────────────┐
│ MultiDocumentUploader                                   │
│ ┌─────────────────────────────────────────────────────┐ │
│ │ DropZone (multi-select enabled)                     │ │
│ │ - Accept: PDF, PNG, JPEG, HEIC, HEIF, TXT, DOCX, RTF│ │
│ │ - Max: 10 files, 20MB each (batch mode)             │ │
│ └─────────────────────────────────────────────────────┘ │
│                                                         │
│ ┌─────────────────────────────────────────────────────┐ │
│ │ DocumentUploadQueue                                 │ │
│ │ ┌─────────────────────────────────────────────────┐ │ │
│ │ │ Document 1: referral.pdf     ✓ 100%            │ │ │
│ │ │ Document 2: ecg.png          ◐ 45%             │ │ │
│ │ │ Document 3: labs.pdf         ○ Waiting         │ │ │
│ │ └─────────────────────────────────────────────────┘ │ │
│ └─────────────────────────────────────────────────────┘ │
│                                                         │
│ ┌─────────────────────────────────────────────────────┐ │
│ │ FastExtractionResult (after fast extraction)       │ │
│ │ Name: John Smith          ●●●○ High               │ │
│ │ DOB:  15/03/1965          ●●●● High               │ │
│ │ MRN:  MRN12345678         ●●○○ Medium             │ │
│ └─────────────────────────────────────────────────────┘ │
│                                                         │
│ [Cancel]              [Continue to Recording] (enabled) │
└─────────────────────────────────────────────────────────┘
```

### State Flow
```
User selects files
    ↓
Files added to queue (status: 'queued')
    ↓
Parallel upload (max 3 concurrent)
    ↓
Each file: upload → text extraction → fast extraction
    ↓
Fast extraction complete for first file with patient data
    ↓
UI shows patient identifiers, enables "Continue"
    ↓
Background: full extraction continues for all files
    ↓
User can start recording (documents show "Processing...")
    ↓
Full extraction completes, context added to consultation
```

---

## Fast Extraction Prompt

Optimized for speed - only extracts patient identifiers:

```
Extract ONLY patient identifiers from this document.
Return JSON with these fields ONLY:

{
  "patientName": <full name as written or null>,
  "dateOfBirth": <YYYY-MM-DD format or null>,
  "mrn": <MRN/URN/hospital number or null>,
  "confidence": {
    "patientName": <0-1>,
    "dateOfBirth": <0-1>,
    "mrn": <0-1>
  }
}

Rules:
- Extract name exactly as written (include titles if present)
- Convert dates to YYYY-MM-DD format
- Include any patient ID number (MRN, URN, hospital number, unit number)
- Return null for missing values
- Be fast - skip all other information (GP, referrer, clinical context)

DOCUMENT TEXT:
{text}
```

**Performance Target**: <3 seconds LLM response + <2 seconds processing = <5 seconds total

---

## Verification Approach

### Unit Tests
- `MultiDocumentUploader.test.tsx`: File selection, validation, queue display
- `DocumentUploadQueue.test.tsx`: Progress tracking, status display
- `FastExtractionResult.test.tsx`: Confidence indicators, data display
- `referral-fast-extraction.service.test.ts`: Prompt parsing, error handling
- `batch/route.test.ts`: Batch document creation, partial failure handling

### Integration Tests
- Full upload flow with multiple files
- Fast extraction → full extraction pipeline
- Error handling for partial failures
- Concurrent upload limits

### E2E Tests
- Complete workflow: upload → extract → recording
- Multi-file drag-and-drop
- Background processing visibility

### Manual Verification
- Upload 5+ files simultaneously
- Verify fast extraction <5 seconds
- Verify recording starts while processing continues
- Test with various file types (PDF, image, HEIC)

### Run Commands
```bash
npm run typecheck              # Type checking
npm run test                   # Unit tests
npm run test:integration       # Integration tests
npm run test:e2e              # E2E tests
npm run verify                # All checks (lint + typecheck + test)
```

---

## Risks & Mitigations

| Risk | Mitigation |
|------|------------|
| Fast extraction exceeds 5s | Optimize prompt, use streaming, cache common patterns |
| Concurrent uploads overwhelm storage | Strict concurrency limit (3), queue management |
| Background processing fails silently | Status polling with error display, retry option |
| Partial file failures confuse users | Clear per-file status, allow individual retries |
| Race conditions in status updates | Optimistic locking, timestamp-based ordering |
| Batch endpoint partial failures | Return both successes and errors in response |

---

## Success Metrics

| Metric | Current | Target |
|--------|---------|--------|
| Time to recording start | ~2 minutes | <30 seconds |
| Fast extraction time | N/A | <5 seconds |
| Fast extraction accuracy (name/DOB) | N/A | >90% |
| Background processing success | N/A | >95% |
| Max files per upload | 1 | 10 |

---

## Out of Scope
- OCR for handwritten documents
- Document translation
- Automatic patient matching (beyond current logic in `findMatchingPatient`)
- Real-time collaboration
- External job queue (Inngest, BullMQ, etc.) - future enhancement
