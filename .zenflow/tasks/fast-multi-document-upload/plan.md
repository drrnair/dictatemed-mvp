# Fast Multi-Document Upload - Implementation Plan

## Configuration
- **Task ID**: fast-multi-document-upload
- **Artifacts Path**: `.zenflow/tasks/fast-multi-document-upload`
- **Specification**: `spec.md`

---

## Workflow Steps

### [ ] Step 1: Multi-File Upload Support

**Objective**: Enable selecting and uploading multiple documents at once

**Tasks**:
- [ ] Add `multiple` attribute to ReferralUploader file input
- [ ] Create `DocumentUploadQueue` component to show all files
- [ ] Implement parallel upload handling (max 3 concurrent)
- [ ] Add individual progress bars per file
- [ ] Handle partial failures (some files fail, others succeed)
- [ ] Update UI to show queue status

**Files to modify**:
- `src/components/referral/ReferralUploader.tsx`
- Create `src/components/referral/DocumentUploadQueue.tsx`

**Estimated effort**: 3-5 days

---

### [ ] Step 2: Fast Patient Extraction API

**Objective**: Extract patient identifiers (name, DOB, MRN) within 5 seconds

**Tasks**:
- [ ] Create `POST /api/referrals/[id]/extract-fast` endpoint
- [ ] Design optimized AI prompt for fast extraction
- [ ] Implement confidence scoring for extracted fields
- [ ] Add database fields for fast extraction status/data
- [ ] Handle images (HEIC/PNG/JPEG) with vision model
- [ ] Unit tests for extraction accuracy

**Files to modify**:
- Create `src/app/api/referrals/[id]/extract-fast/route.ts`
- `src/domains/referrals/referral.service.ts`
- `prisma/schema.prisma` (add new fields)

**Estimated effort**: 3-5 days

---

### [ ] Step 3: Fast Extraction UI

**Objective**: Display extracted patient identifiers immediately after upload

**Tasks**:
- [ ] Create `FastExtractionResult` component
- [ ] Show confidence indicators (high/medium/low)
- [ ] Pre-fill patient search with extracted name
- [ ] Allow manual correction of extracted data
- [ ] Enable "Continue" button after fast extraction

**Files to modify**:
- Create `src/components/referral/FastExtractionResult.tsx`
- `src/components/referral/ReferralUploader.tsx`
- `src/components/consultation/ConsultationContextForm.tsx`

**Estimated effort**: 2-3 days

---

### [ ] Step 4: Background Processing System

**Objective**: Process full document context in background without blocking user

**Tasks**:
- [ ] Set up job queue (Vercel KV, Inngest, or similar)
- [ ] Create `POST /api/referrals/[id]/extract-full` background job
- [ ] Implement status polling endpoint
- [ ] Add database fields for full extraction status
- [ ] Create background worker for processing
- [ ] Handle job failures with retry logic

**Files to modify**:
- Create `src/app/api/referrals/[id]/extract-full/route.ts`
- Create `src/lib/jobs/document-extraction.ts`
- `prisma/schema.prisma`

**Estimated effort**: 5-7 days

---

### [ ] Step 5: Background Processing UI

**Objective**: Show processing status while specialist continues workflow

**Tasks**:
- [ ] Create `BackgroundProcessingIndicator` component
- [ ] Show "Documents processing..." during recording
- [ ] Update consultation context when processing completes
- [ ] Handle processing failures gracefully
- [ ] Notification when background processing completes

**Files to modify**:
- Create `src/components/referral/BackgroundProcessingIndicator.tsx`
- `src/components/consultation/ConsultationRecorder.tsx`
- `src/components/consultation/ConsultationContextForm.tsx`

**Estimated effort**: 2-3 days

---

### [ ] Step 6: Integration & Testing

**Objective**: End-to-end testing and polish

**Tasks**:
- [ ] Integration tests for full upload flow
- [ ] Performance testing (upload speed, extraction time)
- [ ] Error handling edge cases
- [ ] Mobile/responsive testing
- [ ] Documentation updates

**Estimated effort**: 2-3 days

---

## Total Estimated Effort

| Phase | Effort |
|-------|--------|
| Step 1: Multi-File Upload | 3-5 days |
| Step 2: Fast Extraction API | 3-5 days |
| Step 3: Fast Extraction UI | 2-3 days |
| Step 4: Background Processing | 5-7 days |
| Step 5: Background UI | 2-3 days |
| Step 6: Integration | 2-3 days |
| **Total** | **17-26 days** |

---

## Dependencies

- Supabase Storage (✅ configured)
- AI API (Claude/GPT) for extraction
- Job queue system (TBD - Vercel KV, Inngest, or BullMQ)

---

## Notes

- Consider starting with Phase 1 & 2 for quick wins
- Background processing (Phase 4) is the most complex
- Can ship incrementally - each phase adds value
