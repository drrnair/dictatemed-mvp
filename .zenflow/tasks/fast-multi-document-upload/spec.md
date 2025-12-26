# Fast Multi-Document Upload with Background Processing

## Overview

Enable specialists to quickly upload multiple documents (PDFs, images, photos) and start recording consultations without waiting for full document processing. The system should extract key patient identifiers immediately while performing detailed context extraction in the background.

## Problem Statement

Currently, the referral uploader:
- Only allows single file upload at a time
- Requires waiting for full text extraction before proceeding
- Blocks the specialist workflow while processing documents
- Slows down consultation start times

Specialists need to:
- Upload multiple documents quickly (referral letters, previous reports, photographed documents)
- Start recording consultations immediately
- Have patient identifiers extracted fast for form pre-fill
- Let detailed extraction happen in background

## User Stories

### US-1: Multiple Document Selection
**As a** specialist
**I want to** select multiple documents at once in the file picker
**So that** I can upload all relevant documents in one action

**Acceptance Criteria:**
- File picker allows multi-select (Ctrl/Cmd+click or Shift+click)
- Drag-and-drop supports multiple files
- Shows all selected files in queue before upload
- Maximum 10 files per upload session
- Supported formats: PDF, PNG, JPEG, HEIC/HEIF, TXT

### US-2: Fast Patient Identifier Extraction
**As a** specialist
**I want** patient identifiers extracted within 5 seconds of upload
**So that** I can verify the correct patient before starting

**Acceptance Criteria:**
- Extract and display within 5 seconds:
  - Patient name
  - Date of birth
  - MRN/URN (unique patient number)
- Pre-fill patient search field with extracted name
- Show confidence indicators for extracted data
- Allow manual correction if extraction is wrong

### US-3: Background Context Processing
**As a** specialist
**I want** detailed document processing to happen in the background
**So that** I can start recording without waiting

**Acceptance Criteria:**
- Specialist can proceed to recording after fast extraction completes
- Background processing extracts:
  - Referral reason
  - Medical history
  - Medications
  - GP/referrer details
- Status indicator shows "Processing documents..." during background work
- Extracted context automatically added to consultation when ready
- If extraction fails, consultation continues without blocking

### US-4: Non-Blocking Workflow
**As a** specialist
**I want to** start my consultation recording immediately
**So that** I don't keep patients waiting

**Acceptance Criteria:**
- "Start Recording" button enabled after fast extraction (not full processing)
- Visual indicator shows documents still processing in background
- Recording can start even if some documents are still uploading
- Consultation letter generation waits for background processing to complete

## Technical Requirements

### Frontend Changes

#### ReferralUploader Component
- Add `multiple` attribute to file input
- Display file queue with individual progress bars
- Show fast extraction results immediately
- Add "Processing in background" status indicator
- Enable "Continue" button after fast extraction

#### New Components
- `DocumentQueue` - Shows list of uploading/processing documents
- `FastExtractionResult` - Displays patient identifiers with confidence
- `BackgroundProcessingIndicator` - Shows ongoing processing status

### Backend Changes

#### New API Endpoints

**POST /api/referrals/batch**
- Accept multiple files in single request
- Return document IDs for tracking
- Trigger fast extraction immediately

**POST /api/referrals/[id]/extract-fast**
- Extract only patient identifiers (name, DOB, MRN)
- Use optimized prompts for speed
- Target response time: < 5 seconds
- Return confidence scores

**POST /api/referrals/[id]/extract-full** (Background Job)
- Queue for background processing
- Extract all context (referral reason, history, medications, GP)
- Update consultation context when complete
- Send notification/webhook when done

#### Background Job System
- Use Vercel Edge Functions or separate worker
- Job queue for document processing
- Status tracking per document
- Retry logic for failures
- Webhook/polling for completion status

### Database Changes

```prisma
model ReferralDocument {
  // Existing fields...

  // New fields for background processing
  fastExtractionStatus   String?   // 'pending' | 'processing' | 'complete' | 'failed'
  fastExtractionData     Json?     // { name, dob, mrn, confidence }
  fullExtractionStatus   String?   // 'pending' | 'processing' | 'complete' | 'failed'
  fullExtractionData     Json?     // Full context data
  processingStartedAt    DateTime?
  processingCompletedAt  DateTime?
}
```

### Performance Targets

| Metric | Target |
|--------|--------|
| Fast extraction response | < 5 seconds |
| Full extraction (background) | < 60 seconds |
| Max concurrent uploads | 10 files |
| Max file size | 20 MB per file |
| Supported formats | PDF, PNG, JPEG, HEIC, HEIF, TXT |

## UI/UX Design

### Upload Flow

```
1. [Select Files] → File picker (multi-select enabled)
         ↓
2. [Queue Display] → Shows all files with upload progress
         ↓
3. [Fast Extraction] → Patient identifiers appear (< 5 sec)
         ↓
4. [Verify Patient] → Specialist confirms/corrects patient
         ↓
5. [Continue] → Proceed to recording (background processing continues)
         ↓
6. [Recording] → "Documents processing..." indicator visible
         ↓
7. [Generate Letter] → Waits for background processing if needed
```

### Mockup States

**State 1: File Selection**
```
┌─────────────────────────────────────────┐
│  Upload referral documents              │
│  ┌─────────────────────────────────┐   │
│  │     📄 Drop files here or       │   │
│  │        click to browse          │   │
│  │                                  │   │
│  │   PDF, PNG, JPEG, HEIC up to    │   │
│  │   20MB (max 10 files)           │   │
│  └─────────────────────────────────┘   │
└─────────────────────────────────────────┘
```

**State 2: Uploading Queue**
```
┌─────────────────────────────────────────┐
│  Uploading 3 documents...               │
│                                         │
│  ✓ Referral_Letter.pdf     Complete    │
│  ◐ ECG_Report.png          45%         │
│  ○ Lab_Results.pdf         Waiting     │
│                                         │
│  [Cancel All]                           │
└─────────────────────────────────────────┘
```

**State 3: Fast Extraction Complete**
```
┌─────────────────────────────────────────┐
│  ✓ Patient identified                   │
│                                         │
│  Name: John Smith           ●●●○ High  │
│  DOB:  15/03/1965          ●●●● High  │
│  MRN:  MRN12345678         ●●○○ Med   │
│                                         │
│  ℹ️ Full context processing in background │
│                                         │
│  [Edit Details]  [Continue to Recording]│
└─────────────────────────────────────────┘
```

## Implementation Phases

### Phase 1: Multi-File Upload
- Add `multiple` to file input
- Create document queue UI
- Handle parallel uploads
- Update progress tracking

### Phase 2: Fast Extraction
- Create `/extract-fast` endpoint
- Optimize AI prompts for speed
- Add confidence scoring
- Display results in UI

### Phase 3: Background Processing
- Set up job queue system
- Create background worker
- Implement status polling/webhooks
- Handle failures gracefully

### Phase 4: Integration & Polish
- End-to-end testing
- Error handling improvements
- Performance optimization
- Documentation

## Dependencies

- Existing `ReferralUploader` component
- Supabase Storage (already configured)
- AI extraction service (Claude/GPT)
- Optional: Vercel KV or similar for job queue

## Risks & Mitigations

| Risk | Mitigation |
|------|------------|
| Fast extraction not fast enough | Pre-warm AI, optimize prompts, cache common patterns |
| Background jobs fail silently | Robust logging, status tracking, user notifications |
| Too many concurrent uploads | Rate limiting, queue management |
| Large files slow upload | Client-side compression, chunked upload |

## Success Metrics

- Time from upload to recording start: < 30 seconds (currently ~2 minutes)
- Fast extraction accuracy: > 90% for name/DOB
- Background processing success rate: > 95%
- User satisfaction: Reduced friction in upload flow

## Out of Scope

- OCR for handwritten documents (use printed/typed only)
- Document translation
- Automatic patient matching to existing records
- Real-time collaboration on documents
