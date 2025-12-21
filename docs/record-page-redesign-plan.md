# Record Page Redesign - Implementation Plan

## Overview

Redesign the DictateMED Record page to support a **context-first workflow**:
1. Consultation context (top, required)
2. Clinical context uploads and prior materials (middle, optional)
3. Recording / audio controls (bottom)

---

## Workstream 1: Schema & API Extensions

**Complexity:** High
**Model:** Claude
**Dependencies:** None
**Estimated Files:** 5-7

### 1.1 Prisma Schema Changes

Add to `prisma/schema.prisma`:

```prisma
// Referrer/GP information (reusable across consultations)
model Referrer {
  id           String   @id @default(uuid())
  practiceId   String
  practice     Practice @relation(fields: [practiceId], references: [id])
  name         String
  practiceName String?  // Their practice name
  email        String?
  phone        String?
  fax          String?
  address      String?  @db.Text // Postal address
  createdAt    DateTime @default(now())
  updatedAt    DateTime @updatedAt

  consultations Consultation[]

  @@index([practiceId])
  @@map("referrers")
}

// CC Recipients for a specific consultation
model CCRecipient {
  id             String       @id @default(uuid())
  consultationId String
  consultation   Consultation @relation(fields: [consultationId], references: [id], onDelete: Cascade)
  name           String
  email          String?
  address        String?      @db.Text
  createdAt      DateTime     @default(now())

  @@index([consultationId])
  @@map("cc_recipients")
}

// Consultation context - links patient, referrer, recording, and selected materials
model Consultation {
  id          String    @id @default(uuid())
  userId      String
  user        User      @relation(fields: [userId], references: [id])
  patientId   String?
  patient     Patient?  @relation(fields: [patientId], references: [id])
  referrerId  String?
  referrer    Referrer? @relation(fields: [referrerId], references: [id])

  // Letter type pre-selection
  templateId  String?
  template    LetterTemplate? @relation(fields: [templateId], references: [id])
  letterType  LetterType?

  // Selected context materials (IDs of existing letters/documents to use)
  selectedLetterIds   String[] @default([])
  selectedDocumentIds String[] @default([])

  // Status
  status      ConsultationStatus @default(DRAFT)

  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt

  ccRecipients CCRecipient[]
  recordings   Recording[]
  documents    Document[]    // New documents uploaded for this consultation
  letters      Letter[]      // Generated letters

  @@index([userId, createdAt])
  @@index([patientId])
  @@map("consultations")
}

enum ConsultationStatus {
  DRAFT       // Context being gathered
  RECORDING   // Recording in progress
  PROCESSING  // Transcription/processing
  READY       // Ready for letter generation
  COMPLETED   // Letter generated
}
```

Update existing models:
```prisma
// Add to Practice model
model Practice {
  // ... existing fields
  referrers Referrer[]
}

// Add to User model
model User {
  // ... existing fields
  consultations Consultation[]
}

// Add to Recording model
model Recording {
  // ... existing fields
  consultationId String?
  consultation   Consultation? @relation(fields: [consultationId], references: [id])
}

// Add to Document model
model Document {
  // ... existing fields
  consultationId String?
  consultation   Consultation? @relation(fields: [consultationId], references: [id])
}

// Add to Letter model
model Letter {
  // ... existing fields
  consultationId String?
  consultation   Consultation? @relation(fields: [consultationId], references: [id])
}

// Add to LetterTemplate model
model LetterTemplate {
  // ... existing fields
  consultations Consultation[]
}

// Add to Patient model
model Patient {
  // ... existing fields
  consultations Consultation[]
}
```

### 1.2 API Endpoints

**New Endpoints:**

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/referrers` | GET | List practice referrers (with search) |
| `/api/referrers` | POST | Create new referrer |
| `/api/referrers/[id]` | PATCH | Update referrer |
| `/api/patients/search` | GET | Search patients by name/MRN |
| `/api/consultations` | POST | Create consultation context |
| `/api/consultations/[id]` | GET | Get consultation with all relations |
| `/api/consultations/[id]` | PATCH | Update consultation context |
| `/api/consultations/[id]/materials` | GET | Get available materials for patient |

**Files to Create:**
- `src/app/api/referrers/route.ts`
- `src/app/api/referrers/[id]/route.ts`
- `src/app/api/patients/search/route.ts`
- `src/app/api/consultations/route.ts`
- `src/app/api/consultations/[id]/route.ts`
- `src/app/api/consultations/[id]/materials/route.ts`

### 1.3 Types

Create `src/domains/consultation/consultation.types.ts`:
```typescript
export interface ConsultationContext {
  id: string;
  patient?: PatientSummary;
  referrer?: ReferrerInfo;
  ccRecipients: CCRecipient[];
  templateId?: string;
  letterType?: LetterType;
  selectedLetterIds: string[];
  selectedDocumentIds: string[];
  status: ConsultationStatus;
}

export interface ReferrerInfo {
  id: string;
  name: string;
  practiceName?: string;
  email?: string;
  phone?: string;
  fax?: string;
  address?: string;
}

export interface CCRecipient {
  id?: string;
  name: string;
  email?: string;
  address?: string;
}

export interface PatientSummary {
  id: string;
  name: string;
  dateOfBirth: string;
  mrn?: string;
}
```

---

## Workstream 2: Consultation Context Component

**Complexity:** High
**Model:** Claude
**Dependencies:** Workstream 1
**Estimated Files:** 4-6

### 2.1 Main Component

Create `src/components/consultation/ConsultationContextForm.tsx`:

```typescript
interface ConsultationContextFormProps {
  consultationId?: string;
  onContextReady: (context: ConsultationContext) => void;
  onValidationChange: (isValid: boolean) => void;
}
```

**Sections:**
1. Patient Details (required)
   - Search/select existing patient
   - Or create new patient inline
   - Fields: name, DOB, MRN (minimum required)

2. Referrer/GP Details (required)
   - Autocomplete from saved referrers
   - Or create new inline
   - Fields: name, practice, email, postal address

3. CC Recipients (optional)
   - Dynamic list with add/remove
   - Fields per recipient: name, email OR address

4. Letter Type Selection (required)
   - Template selector dropdown
   - Grouped by category (Consultation, Procedure, Diagnostic, etc.)
   - Shows subspecialty relevance

**Validation Rules:**
- Patient name: required
- Patient DOB: required
- Referrer name: required
- Letter type: required
- All other fields: optional

### 2.2 Sub-components

- `src/components/consultation/PatientSection.tsx`
- `src/components/consultation/ReferrerSection.tsx`
- `src/components/consultation/CCRecipientsSection.tsx`
- `src/components/consultation/LetterTypeSelector.tsx`

### 2.3 State Management

Use React Hook Form with Zod validation:
```typescript
const consultationSchema = z.object({
  patient: z.object({
    id: z.string().optional(),
    name: z.string().min(1, 'Patient name required'),
    dateOfBirth: z.string().min(1, 'Date of birth required'),
    mrn: z.string().optional(),
  }),
  referrer: z.object({
    id: z.string().optional(),
    name: z.string().min(1, 'Referrer name required'),
    practiceName: z.string().optional(),
    email: z.string().email().optional().or(z.literal('')),
    address: z.string().optional(),
  }),
  ccRecipients: z.array(z.object({
    name: z.string().min(1),
    email: z.string().email().optional().or(z.literal('')),
    address: z.string().optional(),
  })).optional(),
  templateId: z.string().min(1, 'Letter type required'),
});
```

---

## Workstream 3: Patient Selection Component

**Complexity:** Medium
**Model:** Gemini
**Dependencies:** Workstream 1 API
**Estimated Files:** 2-3

### 3.1 Component

Create `src/components/consultation/PatientSelector.tsx`:

**Features:**
- Debounced search input (300ms)
- Search by name or MRN
- Display recent patients (last 10)
- Results show: name, DOB, MRN
- "Create new patient" option at bottom
- Loading and empty states

**API Integration:**
```typescript
// GET /api/patients/search?q=john&limit=10
const searchPatients = async (query: string) => {
  const res = await fetch(`/api/patients/search?q=${encodeURIComponent(query)}&limit=10`);
  return res.json();
};
```

### 3.2 Inline Patient Creation

When "Create new" selected:
- Expand inline form
- Fields: name, DOB, MRN (optional)
- Save creates patient and selects it
- Use existing patient encryption for PHI

---

## Workstream 4: Referrer & CC Components

**Complexity:** Medium
**Model:** Gemini
**Dependencies:** Workstream 1 API
**Estimated Files:** 2-3

### 4.1 Referrer Selector

Create `src/components/consultation/ReferrerSelector.tsx`:

**Features:**
- Autocomplete with saved referrers
- Search by name or practice
- Shows: name, practice name, email
- "Add new referrer" option
- Inline creation form
- Saves to practice for reuse

### 4.2 CC Recipients List

Create `src/components/consultation/CCRecipientList.tsx`:

**Features:**
- Dynamic list (starts empty)
- "Add recipient" button
- Each row: name input, email input, address input, remove button
- Collapsible address field (show on demand)
- Maximum 10 recipients

---

## Workstream 5: Clinical Context - Previous Materials

**Complexity:** High
**Model:** Claude
**Dependencies:** None (can use existing APIs)
**Estimated Files:** 3-4

### 5.1 Main Component

Create `src/components/consultation/PreviousMaterialsPanel.tsx`:

**Features:**
- Triggered when patient is selected
- Fetches letters and documents for patient
- Two tabs/sections: "Previous Letters" and "Previous Documents"
- Each item shows:
  - Type icon (letter/doc type)
  - Title/name
  - Date
  - Brief descriptor
- Checkbox selection for "use as context"
- "Select all" / "Clear" helpers
- Expandable preview on click

### 5.2 Data Fetching

```typescript
// When patient selected:
const fetchPatientMaterials = async (patientId: string) => {
  const [letters, documents] = await Promise.all([
    fetch(`/api/patients/${patientId}/letters`).then(r => r.json()),
    fetch(`/api/patients/${patientId}/documents`).then(r => r.json()),
  ]);
  return { letters, documents };
};
```

### 5.3 Material Item Component

Create `src/components/consultation/MaterialItem.tsx`:
- Checkbox for selection
- Type badge (color-coded)
- Title and date
- Expandable content preview
- Document type icons

### 5.4 API Additions

Add to existing routes or create:
- `GET /api/patients/[id]/letters` - List patient's letters
- `GET /api/patients/[id]/documents` - List patient's documents

---

## Workstream 6: Clinical Context - New Uploads

**Complexity:** Medium
**Model:** Gemini
**Dependencies:** None
**Estimated Files:** 2-3

### 6.1 Upload Section

Create `src/components/consultation/NewUploadsSection.tsx`:

**Features:**
- Drag-and-drop zone
- File picker button
- Camera capture button (mobile/tablet)
- Accepted types: PDF, PNG, JPEG, HEIC
- Max size: 20MB per file
- Max files: 10 per consultation
- Progress indicators per file
- Remove uploaded file option

**Reuse:**
- Extend `DocumentUploader.tsx` patterns
- Use existing S3 presigned URL flow
- Use existing document processing pipeline

### 6.2 Explainer UI

Add prominent but non-blocking guidance:
```
┌─────────────────────────────────────────────────────┐
│ 📄 Upload supporting documents (Recommended)        │
│                                                     │
│ Add referral letters, reports, or photos of        │
│ documents to improve letter quality. DictateMED    │
│ will use these as context while maintaining        │
│ clinical safety checks.                            │
│                                                     │
│ [Drop files here or click to upload]               │
└─────────────────────────────────────────────────────┘
```

### 6.3 Camera Integration

For mobile/tablet:
```typescript
// Use native file input with capture attribute
<input
  type="file"
  accept="image/*"
  capture="environment" // Use back camera
/>
```

---

## Workstream 7: Recording Section Refactor

**Complexity:** Medium
**Model:** Gemini
**Dependencies:** None
**Estimated Files:** 2-3

### 7.1 Mode Selector

Create `src/components/recording/RecordingModeSelector.tsx`:

**UI:**
```
┌─────────────────────────────────────────────────────┐
│  [👥 Ambient]  [🎤 Dictation]  [📁 Upload Audio]   │
└─────────────────────────────────────────────────────┘
```

- Horizontal toggle group (radio-style)
- Only one mode active at a time
- Visual indication of selected mode
- Mode descriptions below when selected

### 7.2 Conditional Controls

Based on selected mode, show:

**Ambient/Dictation Mode:**
- Existing `WaveformVisualizer`
- Existing `RecordingTimer`
- Existing `RecordingControls`
- Existing `AudioQualityIndicator`
- Mode-specific tips

**Upload Mode:**
- File picker with validation
- Accepted: MP3, WAV, M4A, OGG, WebM
- Max size: 100MB
- Duration display after selection
- Upload progress

### 7.3 Preserve Existing Logic

**DO NOT MODIFY:**
- `useRecording` hook
- `useOfflineQueue` hook
- `recordingSyncManager`
- Deepgram integration
- S3 upload flow

Only reorganize UI layout and add mode selector wrapper.

---

## Workstream 8: Page Integration & Flow

**Complexity:** High
**Model:** Claude
**Dependencies:** Workstreams 2, 5, 6, 7
**Estimated Files:** 3-4

### 8.1 New Record Page Layout

Refactor `src/app/(dashboard)/record/page.tsx`:

```tsx
export default function RecordPage() {
  const [consultationId, setConsultationId] = useState<string | null>(null);
  const [contextValid, setContextValid] = useState(false);
  const [context, setContext] = useState<ConsultationContext | null>(null);

  return (
    <div className="space-y-6">
      {/* Header */}
      <PageHeader
        title="New Consultation"
        subtitle="Capture consultation context and record"
        status={<NetworkStatus />}
      />

      {/* Section 1: Consultation Context (Required) */}
      <Card>
        <CardHeader>
          <CardTitle>Consultation Details</CardTitle>
          <CardDescription>
            Enter patient and referrer information
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ConsultationContextForm
            consultationId={consultationId}
            onContextReady={setContext}
            onValidationChange={setContextValid}
          />
        </CardContent>
      </Card>

      {/* Section 2: Clinical Context (Optional) */}
      <Card>
        <CardHeader>
          <CardTitle>Clinical Context</CardTitle>
          <CardDescription>
            Add supporting materials to improve letter quality
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Previous materials - shown when patient selected */}
          {context?.patient && (
            <PreviousMaterialsPanel
              patientId={context.patient.id}
              selectedLetterIds={context.selectedLetterIds}
              selectedDocumentIds={context.selectedDocumentIds}
              onSelectionChange={handleMaterialsChange}
            />
          )}

          {/* New uploads */}
          <NewUploadsSection
            consultationId={consultationId}
            onUploadComplete={handleUploadComplete}
          />
        </CardContent>
      </Card>

      {/* Section 3: Recording (Enabled when context valid) */}
      <Card className={!contextValid ? 'opacity-50' : ''}>
        <CardHeader>
          <CardTitle>Recording</CardTitle>
          <CardDescription>
            {contextValid
              ? 'Choose your recording method'
              : 'Complete consultation details above to enable recording'
            }
          </CardDescription>
        </CardHeader>
        <CardContent>
          <RecordingSection
            disabled={!contextValid}
            consultationId={consultationId}
            onRecordingComplete={handleRecordingComplete}
          />
        </CardContent>
      </Card>
    </div>
  );
}
```

### 8.2 Recording Section Component

Create `src/components/recording/RecordingSection.tsx`:

Combines:
- `RecordingModeSelector`
- Mode-specific controls
- Disabled state handling
- Links recording to consultation

### 8.3 Letter Generation Integration

Update letter generation to accept consultation context:

```typescript
// In letter.service.ts generateLetter function
interface GenerateLetterInput {
  // Existing fields...
  consultationId?: string; // NEW: Link to consultation
}

// When consultationId provided:
// 1. Fetch consultation with relations
// 2. Auto-populate patient PHI from consultation.patient
// 3. Include selectedLetterIds content as context sources
// 4. Include selectedDocumentIds content as context sources
// 5. Include consultation.documents (new uploads) as sources
// 6. Use consultation.templateId for template
```

### 8.4 Post-Recording Flow

After recording completes:
1. Update consultation status to PROCESSING
2. Trigger transcription
3. When transcription complete, update to READY
4. Show "Generate Letter" CTA
5. Navigate to letter generation/review

---

## Implementation Order

### Phase A (Parallel Start)
| Workstream | Owner | Can Start |
|------------|-------|-----------|
| 1 - Schema & API | Claude | Immediately |
| 5 - Previous Materials | Claude | Immediately |
| 6 - New Uploads | Gemini | Immediately |
| 7 - Recording Refactor | Gemini | Immediately |

### Phase B (After APIs Ready)
| Workstream | Owner | Dependency |
|------------|-------|------------|
| 3 - Patient Selector | Gemini | WS1 APIs |
| 4 - Referrer/CC | Gemini | WS1 APIs |

### Phase C (After Components Ready)
| Workstream | Owner | Dependency |
|------------|-------|------------|
| 2 - Consultation Form | Claude | WS1, WS3, WS4 |

### Phase D (Final Assembly)
| Workstream | Owner | Dependency |
|------------|-------|------------|
| 8 - Page Integration | Claude | WS2, WS5, WS6, WS7 |

---

## Testing Requirements

### Unit Tests
- Schema validation tests
- API endpoint tests
- Component render tests
- Form validation tests

### Integration Tests
- Full consultation flow
- Recording with context
- Material selection persistence
- Letter generation with context

### E2E Tests
- Complete workflow: context → upload → record → generate
- Validation blocking
- Offline handling

---

## Migration Notes

### Database Migration
```bash
npx prisma migrate dev --name add_consultation_context
```

### Backward Compatibility
- Existing recordings without consultationId continue to work
- Letter generation works with or without consultationId
- Gradual adoption - old flow still functional

---

## File Summary

| Workstream | New Files | Modified Files |
|------------|-----------|----------------|
| 1 | 6 API routes, 1 types file | schema.prisma |
| 2 | 5 components | - |
| 3 | 2 components | - |
| 4 | 2 components | - |
| 5 | 3 components | 2 API routes |
| 6 | 2 components | - |
| 7 | 2 components | - |
| 8 | 2 components | record/page.tsx, letter.service.ts |

**Total: ~25 new files, ~5 modified files**
