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

**Difficulty**: Hard

Technical specification created at `spec.md` including:
- Architecture decision to create new `ReferralDocument` model
- Processing pipeline design (upload → text extraction → AI extraction → review → apply)
- Database model with status workflow
- API endpoint specifications
- LLM extraction prompt design
- UI component specifications
- Verification approach

---

### [x] Step 1: Database & Core Types
<!-- chat-id: 665fcf37-7583-4f39-9233-92d39887ddd7 -->

Create the data model and TypeScript types for the referral document feature.

**Files to create:**
- `src/domains/referrals/referral.types.ts` - TypeScript type definitions
- `src/domains/referrals/index.ts` - Domain exports

**Files to modify:**
- `prisma/schema.prisma` - Add `ReferralDocument` model and `ReferralDocumentStatus` enum

**Tasks:**
1. Add `ReferralDocument` model to Prisma schema
2. Add `ReferralDocumentStatus` enum
3. Add relations to User, Practice, Patient, Consultation models
4. Create TypeScript type definitions
5. Run `npx prisma migrate dev --name add_referral_document`
6. Run `npx prisma generate`

**Verification:**
- `npm run lint` passes
- Migration applies successfully
- Types compile without errors

---

### [x] Step 2: Upload API & Service
<!-- chat-id: ea43b518-02f2-4f2f-8126-4ccf4840cb51 -->

Implement the core service and upload endpoint for referral documents.

**Files created:**
- `src/domains/referrals/referral.service.ts` - Business logic with createReferralDocument, getReferralDocument, listReferralDocuments, updateReferralStatus, confirmReferralUpload, deleteReferralDocument
- `src/app/api/referrals/route.ts` - POST (create) and GET (list) endpoints
- `src/app/api/referrals/[id]/route.ts` - GET, PATCH (confirm upload), DELETE endpoints
- `tests/unit/domains/referrals/referral.service.test.ts` - 25 unit tests

**Files modified:**
- `src/domains/referrals/index.ts` - Added service exports
- `src/lib/rate-limit.ts` - Added referrals rate limit (10/min)

**Completed tasks:**
1. Implement `createReferralDocument()` - creates DB record, returns presigned URL
2. Implement `confirmReferralUpload()` - confirms S3 upload via PATCH endpoint
3. Implement `getReferralDocument()` - retrieves document with download URL
4. Implement `listReferralDocuments()` - paginated list with filters
5. Implement `updateReferralStatus()` - status transitions with options
6. Implement `deleteReferralDocument()` - deletes from S3 and DB
7. Create POST `/api/referrals` endpoint with Zod validation
8. Create GET `/api/referrals` endpoint with pagination and filters
9. Create GET `/api/referrals/:id` endpoint
10. Create PATCH `/api/referrals/:id` endpoint for upload confirmation
11. Create DELETE `/api/referrals/:id` endpoint
12. Add audit logging for create, confirm, and delete operations
13. Write 25 unit tests for service functions

**Verification:**
- `npm run lint` passes ✓
- `npx tsc --noEmit` passes ✓
- All 25 unit tests pass ✓

---

### [x] Step 3: Text Extraction
<!-- chat-id: 85d22726-6a93-45ec-a5a7-97d96d3499d3 -->

Implement PDF and text file content extraction.

**Files created:**
- `src/app/api/referrals/[id]/extract-text/route.ts` - Text extraction endpoint
- `src/domains/referrals/pdf-utils.ts` - PDF parsing utility wrapper

**Files modified:**
- `src/domains/referrals/referral.service.ts` - Added `extractTextFromDocument()` function
- `src/infrastructure/s3/presigned-urls.ts` - Added `getObjectContent()` to fetch S3 file content
- `tests/unit/domains/referrals/referral.service.test.ts` - Added 10 text extraction tests (now 35 total)

**Completed tasks:**
1. Added pdf-parse v1.1.1 dependency ✓
2. Implemented `extractTextFromDocument()` function ✓
3. Handle PDF files using pdf-parse (primary) ✓
4. Handle plain text files (read directly) ✓
5. Vision fallback not implemented (deferred - logged warning when text < 100 chars) ✓
6. Update document status to `TEXT_EXTRACTED` ✓
7. Create POST `/api/referrals/:id/extract-text` endpoint ✓
8. Add audit logging for text extraction ✓

**Verification:**
- `npm run lint` passes ✓
- `npx tsc --noEmit` passes ✓
- All 35 unit tests pass ✓

---

### [ ] Step 4: AI Structured Extraction

Implement LLM-powered structured data extraction from referral text.

**Files to create:**
- `src/domains/referrals/extractors/referral-letter.ts` - Prompt and parser
- `src/domains/referrals/referral-extraction.service.ts` - Extraction orchestration
- `src/app/api/referrals/[id]/extract-structured/route.ts` - Endpoint

**Tasks:**
1. Design extraction prompt (see spec.md)
2. Implement prompt template with JSON schema
3. Implement response parser with validation
4. Implement confidence score calculation
5. Create extraction service calling Bedrock
6. Create POST `/api/referrals/:id/extract-structured` endpoint
7. Update document status to `EXTRACTED`

**Verification:**
- Test with synthetic referral text
- Verify JSON output structure
- Verify confidence scores
- `npm run lint` passes
- Write unit tests for parser

---

### [ ] Step 5: Upload UI Component

Create the referral upload component for the consultation form.

**Files to create:**
- `src/components/referral/ReferralUploader.tsx` - Upload UI
- `src/components/referral/index.ts` - Component exports
- `src/hooks/useReferralExtraction.ts` - Extraction workflow hook

**Tasks:**
1. Create drag-and-drop upload zone (reuse patterns from DocumentUploader)
2. Add file type validation (PDF, TXT, DOCX)
3. Add file size validation (max 10MB)
4. Implement upload progress tracking
5. Implement extraction trigger after upload
6. Create hook to manage extraction state machine
7. Add loading and error states

**Verification:**
- Component renders correctly
- File validation works
- Upload triggers extraction flow
- Write component tests

---

### [ ] Step 6: Review UI Component

Create the review/edit panel for extracted data.

**Files to create:**
- `src/components/referral/ReferralReviewPanel.tsx` - Review modal
- `src/components/referral/ReferralFieldGroup.tsx` - Editable section
- `src/components/referral/ConfidenceIndicator.tsx` - Confidence display

**Tasks:**
1. Create modal/panel structure with sections
2. Implement patient details section (editable fields)
3. Implement GP details section
4. Implement referrer details section (if different from GP)
5. Implement referral context section
6. Add confidence indicators per section
7. Implement accept/clear actions per section
8. Implement global Apply/Cancel buttons

**Verification:**
- Panel renders extracted data correctly
- Fields are editable
- Confidence indicators show correctly
- Write component tests

---

### [ ] Step 7: Apply Logic & Integration

Implement the apply endpoint and wire up the full flow.

**Files to create:**
- `src/app/api/referrals/[id]/apply/route.ts` - Apply endpoint

**Files to modify:**
- `src/domains/referrals/referral.service.ts` - Add apply logic
- `src/components/consultation/ConsultationContextForm.tsx` - Integrate upload
- `src/app/(dashboard)/record/page.tsx` - Wire up extraction flow

**Tasks:**
1. Implement `applyReferralToConsultation()` function
2. Handle patient creation (new) or matching (existing)
3. Handle GP/referrer contact creation
4. Create POST `/api/referrals/:id/apply` endpoint
5. Integrate ReferralUploader into ConsultationContextForm
6. Wire up review panel to appear after extraction
7. Populate form fields after apply

**Verification:**
- Full flow works: upload → extract → review → apply
- Patient created correctly
- GP contact created correctly
- Consultation form populated
- Manual entry still works

---

### [ ] Step 8: Error Handling & Polish

Add comprehensive error handling and polish the UX.

**Files to modify:**
- All referral components and services

**Tasks:**
1. Add retry logic for upload failures
2. Add retry logic for extraction failures
3. Add graceful fallback to manual entry
4. Add helpful error messages
5. Add loading spinners/skeletons
6. Add success notifications
7. Test edge cases (large files, corrupt PDFs, low confidence)

**Verification:**
- Error states display correctly
- Recovery paths work
- UX is smooth

---

### [ ] Step 9: Tests & Documentation

Write comprehensive tests and update documentation.

**Files to create:**
- `src/domains/referrals/__tests__/referral.service.test.ts`
- `src/domains/referrals/__tests__/referral-extraction.service.test.ts`
- `src/components/referral/__tests__/ReferralUploader.test.tsx`
- `src/components/referral/__tests__/ReferralReviewPanel.test.tsx`

**Files to modify:**
- `docs/TECH_NOTES.md` or similar - Add pipeline documentation
- `docs/DESIGN_NOTES.md` or similar - Add PHI handling notes

**Tasks:**
1. Write unit tests for referral.service.ts
2. Write unit tests for extraction parser
3. Write component tests for ReferralUploader
4. Write component tests for ReferralReviewPanel
5. Write integration test for full flow
6. Document pipeline in TECH_NOTES
7. Document PHI handling decisions
8. Add QA instructions with sample test referral

**Verification:**
- `npm run test` passes
- Coverage for new code is adequate
- Documentation is clear

---

### [ ] Step 10: Final Report

Write completion report to `report.md`:
- What was implemented
- How the solution was tested
- Biggest issues or challenges encountered
