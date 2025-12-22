# Technical Specification: Record Page & Clinical Context Redesign

## Task Difficulty Assessment: **Easy** (Already Implemented)

Upon comprehensive analysis of the codebase, the requested Record page redesign with clinical context workflow has **already been implemented** in the current codebase. The existing implementation fully addresses all requirements from the task description.

---

## Technical Context

### Stack
- **Framework:** Next.js 14.2 (App Router)
- **UI Library:** React 18.2 + Radix UI + Tailwind CSS
- **State Management:** Zustand + React useState
- **Database:** PostgreSQL with Prisma ORM
- **File Storage:** AWS S3 (presigned URLs)
- **Transcription:** Deepgram SDK

### Key Dependencies
- `@prisma/client` - Database ORM
- `@radix-ui/*` - UI primitives
- `lucide-react` - Icons
- `zustand` - State management

---

## Current Implementation Analysis

### 1. Overall Flow and Layout ✅ IMPLEMENTED

The Record page (`src/app/(dashboard)/record/page.tsx`) already implements the requested flow:

```
1. Consultation Context (top, required) ✅
2. Clinical Context: Previous Materials (middle, optional) ✅
3. Clinical Context: New Uploads (middle, optional) ✅
4. Recording / Audio Controls (bottom) ✅
```

**Evidence:** Lines 220-299 in `src/app/(dashboard)/record/page.tsx` show four collapsible sections with the exact workflow requested.

---

### 2. Consultation Context (Top Section) ✅ IMPLEMENTED

| Requirement | Status | Implementation |
|-------------|--------|----------------|
| Patient details (name, DOB, MRN) | ✅ | `PatientSelector.tsx` - search, recent, inline creation |
| Referrer/GP details | ✅ | `ReferrerSelector.tsx` - name, practice, email, address |
| CC recipients (add another) | ✅ | `CCRecipientsInput.tsx` - dynamic add/remove |
| Letter template selection | ✅ | `LetterTypeSelector.tsx` + `TemplateSelector.tsx` |
| Form validation | ✅ | `validateConsultationForm()` validates patient, referrer, letterType |
| Disabled controls until valid | ✅ | `disabled={!isContextComplete}` on RecordingSection |

**Files:**
- `src/components/consultation/ConsultationContextForm.tsx` (173 lines)
- `src/components/consultation/PatientSelector.tsx` (427 lines)
- `src/components/consultation/ReferrerSelector.tsx`
- `src/components/consultation/CCRecipientsInput.tsx`
- `src/components/consultation/LetterTypeSelector.tsx`
- `src/components/consultation/TemplateSelector.tsx`

---

### 3. Clinical Context (Middle Section) ✅ IMPLEMENTED

#### a) Previous Letters and Documents ✅

| Requirement | Status | Implementation |
|-------------|--------|----------------|
| Auto-fetch on patient select | ✅ | `PreviousMaterialsPanel.tsx` fetches via API |
| List/grid with type, date, descriptor | ✅ | `MaterialItemRow` component displays all |
| Checkbox/toggle for context selection | ✅ | `selectedLetterIds`, `selectedDocumentIds` state |
| "Used as context" for letter generation | ✅ | IDs passed to consultation creation |

**Files:**
- `src/components/consultation/PreviousMaterialsPanel.tsx` (305 lines)
- API: `src/app/api/patients/[id]/materials/route.ts`
- API: `src/app/api/consultations/[id]/materials/route.ts`

#### b) New Document and Image Uploads ✅

| Requirement | Status | Implementation |
|-------------|--------|----------------|
| PDF/image upload | ✅ | PDF, PNG, JPEG, HEIC supported |
| Mobile camera support | ✅ | `capture="environment"` attribute |
| Drag-drop interface | ✅ | `onDrop`, `onDragOver` handlers |
| Associated with consultation | ✅ | `consultationId` passed to API |
| Info explainer text | ✅ | Lines 198-207 in `NewUploadsSection.tsx` |
| "Recommended" prominence | ✅ | Info banner with icon |

**Files:**
- `src/components/consultation/NewUploadsSection.tsx` (339 lines)
- API: `src/app/api/documents/route.ts`

---

### 4. Recording and Audio Section (Bottom) ✅ IMPLEMENTED

| Requirement | Status | Implementation |
|-------------|--------|----------------|
| 3-mode horizontal selector | ✅ | `RecordingModeSelector.tsx` - AMBIENT, DICTATION, UPLOAD |
| Mutually exclusive modes | ✅ | Single `mode` state, only one active |
| Ambient/Dictation controls | ✅ | Timer, waveform, quality, record/stop buttons |
| Upload: file picker + validation | ✅ | File type/size validation, progress bar |
| Preserve existing behavior | ✅ | All existing recording logic intact |

**Files:**
- `src/components/recording/RecordingSection.tsx` (378 lines)
- `src/components/recording/RecordingModeSelector.tsx` (84 lines)
- `src/components/recording/RecordingControls.tsx`
- `src/components/recording/WaveformVisualizer.tsx`
- `src/components/recording/AudioQualityIndicator.tsx`

---

### 5. Integration with Letter Generation ✅ IMPLEMENTED

| Requirement | Status | Implementation |
|-------------|--------|----------------|
| Context passed to API | ✅ | `POST /api/consultations` includes all context |
| Selected materials stored | ✅ | `selectedLetterIds`, `selectedDocumentIds` in DB |
| Available for downstream pipeline | ✅ | Consultation model links to all data |

**Database Schema:** `prisma/schema.prisma`
- `Consultation` model includes `selectedLetterIds[]`, `selectedDocumentIds[]`
- Relations to `Patient`, `Referrer`, `CCRecipient[]`, `Recording[]`, `Document[]`, `Letter[]`

---

### 6. Implementation Quality ✅ MEETS REQUIREMENTS

| Requirement | Status | Evidence |
|-------------|--------|----------|
| Reuses existing components | ✅ | All components extend established patterns |
| Responsive/touch-friendly | ✅ | Tailwind responsive classes, touch targets |
| Consistent validation/errors | ✅ | AlertCircle + destructive text pattern |
| TypeScript types | ✅ | `consultation.types.ts` with full typing |
| Follows codebase patterns | ✅ | Same component structure, API patterns |

---

## Data Model

The data model already supports all requirements:

```prisma
model Consultation {
  id                  String   @id
  userId              String
  patientId           String?
  referrerId          String?
  templateId          String?
  letterType          LetterType?
  selectedLetterIds   String[] @default([])  // Prior letters as context
  selectedDocumentIds String[] @default([])  // Prior docs as context
  status              ConsultationStatus

  ccRecipients CCRecipient[]
  recordings   Recording[]
  documents    Document[]    // Uploaded during consultation
  letters      Letter[]      // Generated letters
}
```

---

## API Structure

All required APIs exist:

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/api/consultations` | POST | Create consultation with context |
| `/api/consultations/[id]` | PATCH | Update consultation |
| `/api/patients/search` | GET | Search patients |
| `/api/patients` | POST | Create patient |
| `/api/patients/[id]/materials` | GET | Get patient's previous materials |
| `/api/referrers` | POST | Create referrer |
| `/api/documents` | POST | Create document + get upload URL |
| `/api/recordings` | POST | Create recording session |

---

## Verification

### Existing Tests
Run existing test suite to verify no regressions:
```bash
npm run test
npm run lint
npm run type-check
```

### Manual Verification Checklist
1. Navigate to `/record` page
2. Verify 4-section collapsible layout
3. Test patient search + inline creation
4. Test referrer selection
5. Add CC recipient
6. Select letter type
7. Expand "Previous Materials" - verify fetch on patient select
8. Expand "Upload Documents" - test drag-drop and camera
9. Test recording mode selector (3 modes)
10. Verify disabled state until context complete
11. Complete recording and verify consultation creation

---

## Conclusion

**No implementation work is required.** The task description matches the already-implemented functionality in the codebase.

The Record page redesign with "context first → then record" workflow is fully operational with:
- Consultation context form (patient, referrer, CC, template)
- Previous materials selection panel
- New document/image upload with mobile camera support
- 3-mode recording section (Ambient/Dictation/Upload)
- Full integration with consultation and letter generation pipeline

### Recommended Actions
1. **Verify** existing implementation meets expectations via manual testing
2. **Run** existing test suite to confirm no regressions
3. **Document** any minor UX refinements if needed after user testing
