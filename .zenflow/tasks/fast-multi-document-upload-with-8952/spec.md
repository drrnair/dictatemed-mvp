# Technical Specification: Fast Multi-Document Upload with Background Processing

## Difficulty Assessment: **Medium-Hard**

This feature involves:
- Frontend state management for multi-file uploads with progress tracking
- New API endpoints for batch operations and fast extraction
- Database schema changes for tracking extraction phases
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
| **Status polling** | Client polls for background processing status every 5 seconds |
| **Max 10 files** | Balance between user needs and server load |
| **Max 3 concurrent uploads** | Prevent overwhelming Supabase Storage |

---

## Source Code Structure Changes

### New Files

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

### Modified Files

```
src/
├── components/referral/
│   └── ReferralUploader.tsx           # Extend to use MultiDocumentUploader
├── domains/referrals/
│   ├── referral.types.ts              # Add new types for fast extraction
│   └── index.ts                       # Export new types/services
└── prisma/
    └── schema.prisma                  # Add fields for two-phase extraction
```

---

## Data Model Changes

### ReferralDocument Schema Updates

```prisma
model ReferralDocument {
  // ... existing fields ...

  // Two-phase extraction tracking
  fastExtractionStatus     String?    // 'pending' | 'processing' | 'complete' | 'failed'
  fastExtractionData       Json?      // { patientName, dob, mrn, confidence }
  fastExtractionStartedAt  DateTime?
  fastExtractionCompletedAt DateTime?

  fullExtractionStatus     String?    // 'pending' | 'processing' | 'complete' | 'failed'
  fullExtractionStartedAt  DateTime?
  fullExtractionCompletedAt DateTime?
}
```

### New Types

```typescript
// Fast extraction result (patient identifiers only)
interface FastExtractedData {
  patientName?: string;
  dateOfBirth?: string;      // ISO format YYYY-MM-DD
  mrn?: string;              // MRN/URN/hospital number
  confidence: {
    patientName: number;     // 0-1
    dateOfBirth: number;     // 0-1
    mrn: number;             // 0-1
    overall: number;         // 0-1
  };
  extractedAt: string;       // ISO timestamp
}

// Document processing status for polling
interface DocumentProcessingStatus {
  id: string;
  filename: string;
  uploadStatus: 'uploading' | 'uploaded' | 'failed';
  uploadProgress: number;    // 0-100
  fastExtractionStatus: 'pending' | 'processing' | 'complete' | 'failed';
  fastExtractionData?: FastExtractedData;
  fullExtractionStatus: 'pending' | 'processing' | 'complete' | 'failed';
  error?: string;
}

// Batch upload response
interface BatchUploadResult {
  documents: Array<{
    id: string;
    uploadUrl: string;
    expiresAt: Date;
  }>;
}
```

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

**Response:**
```json
{
  "documents": [
    { "id": "uuid-1", "uploadUrl": "https://...", "expiresAt": "2024-..." },
    { "id": "uuid-2", "uploadUrl": "https://...", "expiresAt": "2024-..." }
  ]
}
```

#### `POST /api/referrals/[id]/extract-fast`
Fast extraction of patient identifiers only (<5 seconds target).

**Response:**
```json
{
  "id": "uuid-1",
  "status": "complete",
  "data": {
    "patientName": "John Smith",
    "dateOfBirth": "1965-03-15",
    "mrn": "MRN12345678",
    "confidence": {
      "patientName": 0.95,
      "dateOfBirth": 0.9,
      "mrn": 0.7,
      "overall": 0.85
    }
  }
}
```

#### `GET /api/referrals/[id]/status`
Poll for document processing status.

**Response:**
```json
{
  "id": "uuid-1",
  "filename": "referral.pdf",
  "uploadStatus": "uploaded",
  "fastExtractionStatus": "complete",
  "fastExtractionData": { ... },
  "fullExtractionStatus": "processing"
}
```

### Modified Endpoints

#### `POST /api/referrals/[id]/extract-structured`
Modified to update `fullExtractionStatus` and related timestamps.

---

## Component Architecture

### MultiDocumentUploader
```
┌─────────────────────────────────────────────────────────┐
│ MultiDocumentUploader                                   │
│ ┌─────────────────────────────────────────────────────┐ │
│ │ DropZone (multi-select enabled)                     │ │
│ │ - Accept: PDF, PNG, JPEG, HEIC, HEIF, TXT          │ │
│ │ - Max: 10 files, 20MB each                          │ │
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
Files added to queue (pending)
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
- Extract name exactly as written
- Convert dates to YYYY-MM-DD
- Include any patient ID number (MRN, URN, hospital number)
- Return null for missing values
- Be fast - skip all other information

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
- `batch/route.test.ts`: Batch document creation

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

---

## Implementation Plan

### Phase 1: Multi-File Upload (Foundation)
1. Create `MultiDocumentUploader` component with multi-select
2. Implement `DocumentUploadQueue` with progress tracking
3. Add `POST /api/referrals/batch` endpoint
4. Handle parallel uploads with concurrency limit (3)
5. Add unit tests for new components

### Phase 2: Fast Extraction
1. Add database fields for two-phase extraction
2. Create fast extraction prompt
3. Implement `POST /api/referrals/[id]/extract-fast` endpoint
4. Create `FastExtractionResult` component with confidence display
5. Add `GET /api/referrals/[id]/status` polling endpoint

### Phase 3: Background Processing
1. Implement status polling in frontend
2. Create `BackgroundProcessingIndicator` component
3. Trigger full extraction after fast extraction
4. Update consultation context when complete

### Phase 4: Integration
1. Integrate with existing consultation workflow
2. Handle "Continue to Recording" flow
3. Letter generation waits for full extraction
4. End-to-end testing

---

## Risks & Mitigations

| Risk | Mitigation |
|------|------------|
| Fast extraction exceeds 5s | Optimize prompt, use streaming, cache common patterns |
| Concurrent uploads overwhelm storage | Strict concurrency limit (3), queue management |
| Background processing fails silently | Status polling with error display, retry option |
| Partial file failures confuse users | Clear per-file status, allow individual retries |
| Race conditions in status updates | Optimistic locking, timestamp-based ordering |

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
- Automatic patient matching (beyond current logic)
- Real-time collaboration
- External job queue (Inngest, BullMQ, etc.) - future enhancement
