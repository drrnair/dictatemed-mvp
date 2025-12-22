# Record Page and Clinical Context Redesign - Technical Specification

**Version:** 1.0
**Date:** December 2025
**Difficulty:** Medium
**Status:** Draft

---

## 1. Executive Summary

This specification covers the redesign of the DictateMED Record page to implement a **context-first workflow**. The redesign moves consultation context (patient, referrer, CC recipients, letter type) to the top, adds a Clinical Context section for selecting previous materials and uploading new documents, and reorganizes the recording section to appear last with a unified mode selector.

### 1.1 Assessment

**Task Difficulty: Medium**

Rationale:
- Most infrastructure already exists (Consultation model, APIs, components)
- The redesign is primarily UI reorganization with some component enhancements
- No new external service integrations required
- Clear data model with established patterns
- Low architectural risk - follows existing conventions

### 1.2 Key Goals

1. Move consultation context (patient, referrer, CC, letter type) to top of page
2. Add Clinical Context section for previous letters/documents and new uploads
3. Reorganize recording section with horizontal mode selector (Ambient/Dictation/Upload)
4. Ensure all context links properly to consultation and downstream letter generation
5. Maintain responsive, touch-friendly layout

---

## 2. Technical Context

### 2.1 Technology Stack

| Layer | Technology | Notes |
|-------|------------|-------|
| Frontend Framework | Next.js 14 (App Router) | Server Components, TypeScript |
| UI Library | React 18 | Client components for interactive sections |
| Styling | Tailwind CSS 3.x | Responsive design classes |
| UI Components | shadcn/ui | Accessible, composable primitives |
| State Management | Zustand 4.x | For recording/offline state |
| Form Management | React Hook Form + Zod | Validation |
| Database ORM | Prisma 5.x | Type-safe queries |

### 2.2 Existing Architecture

The codebase follows a clean domain-driven architecture:

```
src/
├── app/(dashboard)/record/     # Record page (to be redesigned)
├── components/
│   ├── recording/              # Recording UI components (reusable)
│   ├── consultation/           # Consultation context components (reusable)
│   ├── documents/              # Document upload/selection (reusable)
│   └── ui/                     # Shadcn primitives
├── domains/
│   ├── consultation/           # Consultation business logic
│   ├── recording/              # Recording service, transcription
│   ├── documents/              # Document processing
│   └── letters/                # Letter generation, templates
├── hooks/
│   ├── useRecording.ts         # Recording state management
│   ├── useOfflineQueue.ts      # Offline sync
│   └── useOnlineStatus.ts      # Network detection
└── infrastructure/
    ├── s3/                     # File uploads
    ├── deepgram/               # Transcription
    └── bedrock/                # AI generation
```

### 2.3 Key Dependencies

All required dependencies are already installed:
- `@prisma/client` for database operations
- `react-hook-form` + `zod` for form handling
- `zustand` for global state
- Shadcn UI components already configured

---

## 3. Implementation Approach

### 3.1 Strategy: Enhance Existing Page

The current Record page (`src/app/(dashboard)/record/page.tsx`) already implements much of the desired structure. The implementation will:

1. **Refine layout** - Improve visual hierarchy and section organization
2. **Enhance Clinical Context** - Better material selection and upload UX
3. **Streamline Recording** - Cleaner horizontal mode selector
4. **Ensure data flow** - All context properly linked to consultation

### 3.2 Component Reuse

**Existing components to reuse as-is:**
- `ConsultationContextForm` - Patient/referrer/CC form
- `PatientSelector` - Patient search/selection
- `ReferrerSelector` - Referrer autocomplete
- `LetterTypeSelector` - Letter type selection
- `RecordingControls` - Play/pause/stop controls
- `WaveformVisualizer` - Audio visualization
- `AudioQualityIndicator` - Quality display
- `ConsentDialog` - Consent capture
- `DocumentUploader` - File upload with drag-drop

**Components to enhance:**
- `RecordingSection` - Add cleaner horizontal mode selector
- `PreviousMaterialsPanel` - Better material display/selection
- `RecordPage` - Reorganize layout, improve section flow

### 3.3 Data Model

The existing Prisma schema already supports this redesign:

```prisma
model Consultation {
  id                  String   @id @default(uuid())
  userId              String
  patientId           String?
  referrerId          String?
  templateId          String?
  letterType          LetterType?
  selectedLetterIds   String[] @default([])    # Previous letters as context
  selectedDocumentIds String[] @default([])    # Previous docs as context
  status              ConsultationStatus @default(DRAFT)
  ccRecipients        CCRecipient[]
  recordings          Recording[]
  documents           Document[]               # New uploads
  letters             Letter[]
}
```

**Key relationships:**
- `selectedLetterIds` / `selectedDocumentIds` - Existing patient materials selected as context
- `documents` relation - New documents uploaded for this consultation
- `recordings` relation - Recording(s) captured for this consultation

---

## 4. Source Code Changes

### 4.1 Files to Modify

| File | Change Type | Description |
|------|-------------|-------------|
| `src/app/(dashboard)/record/page.tsx` | Enhance | Reorganize layout, improve section flow |
| `src/components/recording/RecordingSection.tsx` | Enhance | Cleaner horizontal mode selector |
| `src/components/recording/RecordingModeSelector.tsx` | Enhance | Horizontal toggle group styling |
| `src/components/consultation/PreviousMaterialsPanel.tsx` | Enhance | Better material display |

### 4.2 New Files (if needed)

| File | Purpose |
|------|---------|
| `src/components/consultation/ClinicalContextSection.tsx` | Combined section for materials + uploads |

### 4.3 Detailed Changes

#### 4.3.1 Record Page Layout (`src/app/(dashboard)/record/page.tsx`)

Current structure needs refinement for clearer visual hierarchy:

```tsx
// Desired layout structure
<div className="space-y-6 max-w-4xl mx-auto">
  {/* Header */}
  <PageHeader
    title="New Consultation"
    status={<OfflineQueueStatus />}
  />

  {/* Section 1: Consultation Context (Required) */}
  <Card>
    <CardHeader>
      <CardTitle>Consultation Details</CardTitle>
      <CardDescription>
        Patient and referrer information
      </CardDescription>
    </CardHeader>
    <CardContent>
      <ConsultationContextForm
        consultationId={consultationId}
        onContextReady={handleContextReady}
        onValidationChange={setContextValid}
      />
    </CardContent>
  </Card>

  {/* Section 2: Clinical Context (Optional but recommended) */}
  <Card>
    <CardHeader>
      <CardTitle>Clinical Context</CardTitle>
      <CardDescription>
        Previous records and supporting documents
      </CardDescription>
    </CardHeader>
    <CardContent>
      <ClinicalContextSection
        patientId={context?.patient?.id}
        consultationId={consultationId}
        selectedLetterIds={context?.selectedLetterIds || []}
        selectedDocumentIds={context?.selectedDocumentIds || []}
        onMaterialsChange={handleMaterialsChange}
        onUploadComplete={handleUploadComplete}
      />
    </CardContent>
  </Card>

  {/* Section 3: Recording (Enabled when context valid) */}
  <Card className={!contextValid ? 'opacity-50 pointer-events-none' : ''}>
    <CardHeader>
      <CardTitle>Recording</CardTitle>
      <CardDescription>
        {contextValid
          ? 'Select recording mode and capture the consultation'
          : 'Complete consultation details to enable recording'
        }
      </CardDescription>
    </CardHeader>
    <CardContent>
      <RecordingSection
        disabled={!contextValid}
        consultationId={consultationId}
        consentType={consentType}
        onRecordingComplete={handleRecordingComplete}
      />
    </CardContent>
  </Card>
</div>
```

#### 4.3.2 Recording Mode Selector Enhancement

Update `RecordingModeSelector.tsx` for horizontal toggle group:

```tsx
// Horizontal toggle design
<div className="flex rounded-lg border bg-muted p-1">
  <button
    className={cn(
      "flex-1 flex items-center justify-center gap-2 rounded-md px-4 py-2 text-sm font-medium transition-colors",
      mode === 'AMBIENT'
        ? "bg-background text-foreground shadow-sm"
        : "text-muted-foreground hover:text-foreground"
    )}
    onClick={() => onModeChange('AMBIENT')}
  >
    <Users className="h-4 w-4" />
    Ambient
  </button>
  <button
    className={cn(
      "flex-1 flex items-center justify-center gap-2 rounded-md px-4 py-2 text-sm font-medium transition-colors",
      mode === 'DICTATION'
        ? "bg-background text-foreground shadow-sm"
        : "text-muted-foreground hover:text-foreground"
    )}
    onClick={() => onModeChange('DICTATION')}
  >
    <Mic className="h-4 w-4" />
    Dictation
  </button>
  <button
    className={cn(
      "flex-1 flex items-center justify-center gap-2 rounded-md px-4 py-2 text-sm font-medium transition-colors",
      mode === 'UPLOAD'
        ? "bg-background text-foreground shadow-sm"
        : "text-muted-foreground hover:text-foreground"
    )}
    onClick={() => onModeChange('UPLOAD')}
  >
    <Upload className="h-4 w-4" />
    Upload Audio
  </button>
</div>
```

#### 4.3.3 Clinical Context Section (New)

Create combined section for previous materials and new uploads:

```tsx
// src/components/consultation/ClinicalContextSection.tsx
interface ClinicalContextSectionProps {
  patientId?: string;
  consultationId?: string;
  selectedLetterIds: string[];
  selectedDocumentIds: string[];
  onMaterialsChange: (letterIds: string[], documentIds: string[]) => void;
  onUploadComplete: (documentId: string) => void;
}

export function ClinicalContextSection({
  patientId,
  consultationId,
  selectedLetterIds,
  selectedDocumentIds,
  onMaterialsChange,
  onUploadComplete,
}: ClinicalContextSectionProps) {
  return (
    <div className="space-y-6">
      {/* Previous Materials - shown when patient selected */}
      {patientId && (
        <div>
          <h4 className="text-sm font-medium mb-3">Previous Records</h4>
          <PreviousMaterialsPanel
            patientId={patientId}
            selectedLetterIds={selectedLetterIds}
            selectedDocumentIds={selectedDocumentIds}
            onSelectionChange={onMaterialsChange}
          />
        </div>
      )}

      {/* Divider */}
      {patientId && <Separator />}

      {/* New Uploads */}
      <div>
        <h4 className="text-sm font-medium mb-3">Upload New Documents</h4>
        <NewUploadsSection
          consultationId={consultationId}
          onUploadComplete={onUploadComplete}
        />
      </div>
    </div>
  );
}
```

---

## 5. Data Flow

### 5.1 Context to Letter Generation Flow

```
┌─────────────────────────────────────────────────────────────────────┐
│ Record Page                                                          │
├─────────────────────────────────────────────────────────────────────┤
│                                                                      │
│  1. ConsultationContextForm                                          │
│     ├── PatientSelector → patientId                                  │
│     ├── ReferrerSelector → referrerId                                │
│     ├── CCRecipientList → ccRecipients[]                             │
│     └── LetterTypeSelector → templateId, letterType                  │
│                     │                                                │
│                     ▼                                                │
│  POST /api/consultations                                             │
│     → Creates Consultation { patientId, referrerId, templateId, ... }│
│     → Returns consultationId                                         │
│                     │                                                │
│                     ▼                                                │
│  2. ClinicalContextSection                                           │
│     ├── GET /api/patients/{id}/materials                             │
│     │   → Returns { letters[], documents[] }                         │
│     ├── User selects materials                                       │
│     │   → PUT /api/consultations/{id}                                │
│     │   → Updates selectedLetterIds[], selectedDocumentIds[]         │
│     └── User uploads new documents                                   │
│         → POST /api/documents { consultationId }                     │
│         → Documents linked to consultation                           │
│                     │                                                │
│                     ▼                                                │
│  3. RecordingSection                                                 │
│     ├── Mode selection (AMBIENT/DICTATION/UPLOAD)                    │
│     ├── POST /api/recordings { consultationId, mode, consentType }   │
│     ├── Audio capture/upload                                         │
│     └── POST /api/recordings/{id}/transcribe                         │
│                     │                                                │
│                     ▼                                                │
│  4. After transcription complete                                     │
│     POST /api/consultations/{id}/generate-letter                     │
│     → Uses all context:                                              │
│       • consultation.patient (PHI)                                   │
│       • consultation.referrer                                        │
│       • consultation.ccRecipients                                    │
│       • consultation.selectedLetterIds content                       │
│       • consultation.selectedDocumentIds content                     │
│       • consultation.documents (new uploads) content                 │
│       • recording.transcriptText                                     │
│       • consultation.templateId                                      │
│                                                                      │
└─────────────────────────────────────────────────────────────────────┘
```

### 5.2 API Contract Summary

**Existing endpoints used (no changes needed):**

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/api/consultations` | POST | Create consultation with context |
| `/api/consultations/[id]` | PUT | Update consultation (materials, status) |
| `/api/patients/[id]/materials` | GET | Fetch previous letters/documents |
| `/api/documents` | POST | Create document entry for upload |
| `/api/recordings` | POST | Create recording session |
| `/api/recordings/[id]/transcribe` | POST | Trigger transcription |
| `/api/consultations/[id]/generate-letter` | POST | Generate letter with full context |

---

## 6. Verification Approach

### 6.1 Manual Testing Checklist

**Consultation Context Section:**
- [ ] Patient search returns results
- [ ] Patient can be created inline
- [ ] Referrer autocomplete works
- [ ] Referrer can be created inline
- [ ] CC recipients can be added/removed
- [ ] Letter type selection works
- [ ] Form validation blocks progression without required fields

**Clinical Context Section:**
- [ ] Previous materials load when patient selected
- [ ] Materials can be selected/deselected
- [ ] Selected materials persist when navigating
- [ ] Document upload drag-drop works
- [ ] Document upload via file picker works
- [ ] Upload progress displays correctly
- [ ] Uploaded documents appear in list

**Recording Section:**
- [ ] Mode selector toggles correctly
- [ ] Recording disabled when context invalid
- [ ] Ambient mode captures audio
- [ ] Dictation mode captures audio
- [ ] Upload mode accepts audio files
- [ ] Quality indicator displays
- [ ] Waveform visualizes during recording
- [ ] Recording completes and uploads

**Integration:**
- [ ] All context linked to consultation
- [ ] Letter generation receives all context
- [ ] Generated letter includes source anchors to materials

### 6.2 Automated Tests

**Unit Tests:**
```bash
npm run test -- --grep "ConsultationContextForm"
npm run test -- --grep "ClinicalContextSection"
npm run test -- --grep "RecordingModeSelector"
```

**Integration Tests:**
```bash
npm run test:integration -- --grep "consultation"
npm run test:integration -- --grep "recording"
```

### 6.3 Responsive Testing

Test on:
- Desktop (1920x1080, 1440x900)
- Tablet (iPad: 768x1024, portrait and landscape)
- Mobile (375x667, 414x896)

Touch targets should be minimum 44x44px for touch-friendly operation.

---

## 7. Implementation Steps

Given the medium complexity and existing infrastructure, implementation is broken into 4 focused steps:

### Step 1: Layout Refinement
- Update `record/page.tsx` with clearer section hierarchy
- Improve visual spacing and typography
- Ensure proper disabled states for recording section

### Step 2: Clinical Context Section
- Create `ClinicalContextSection.tsx` combining materials and uploads
- Enhance `PreviousMaterialsPanel` display
- Test material selection persistence

### Step 3: Recording Mode Selector
- Update `RecordingModeSelector` with horizontal toggle design
- Ensure consistent styling across modes
- Verify mode switching behavior

### Step 4: Integration & Polish
- Verify data flow end-to-end
- Test letter generation with full context
- Responsive layout adjustments
- Accessibility review

---

## 8. Risks and Mitigations

| Risk | Likelihood | Impact | Mitigation |
|------|------------|--------|------------|
| Existing component conflicts | Low | Medium | Incremental changes, preserve interfaces |
| State management complexity | Low | Low | Use existing Zustand patterns |
| Offline sync issues | Low | Medium | Leverage existing useOfflineQueue |
| Performance with many materials | Medium | Low | Paginate materials list if needed |

---

## 9. Dependencies

**No new dependencies required.** All needed libraries are already installed:
- React Hook Form
- Zod validation
- Shadcn UI components
- Zustand stores
- Existing hooks (useRecording, useOfflineQueue)

---

## 10. Success Criteria

1. Context form validates before allowing recording
2. Previous materials selectable as context
3. New documents uploadable and linked to consultation
4. Recording section provides unified mode selection
5. All context flows to letter generation
6. Responsive on desktop, tablet, and mobile
7. Touch targets meet 44px minimum
8. No regression in existing recording functionality

---

*Technical Specification v1.0 | Record Page Redesign | December 2025*
