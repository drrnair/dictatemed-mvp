# Technical Specification: Referral Upload & Auto-Populate Consultation Context

## Overview

**Difficulty Level**: Hard

This feature requires:
- New database model with status workflow
- Multi-step API pipeline (upload → text extraction → AI extraction → review)
- Complex LLM prompt engineering for structured data extraction
- New UI components with state management for the review/edit flow
- Integration with existing consultation context form and contact models
- Error handling across multiple async operations

## Technical Context

| Component | Technology |
|-----------|------------|
| Framework | Next.js 14 (App Router) |
| Language | TypeScript |
| Database | PostgreSQL + Prisma 6.19 |
| File Storage | AWS S3 (presigned URLs) |
| LLM | AWS Bedrock (Claude Sonnet 4) |
| PDF Processing | pdf-parse (existing) / pdfjs-dist |
| UI Library | Radix UI + Tailwind CSS |
| Validation | Zod |
| Testing | Vitest + @testing-library/react |

## Implementation Approach

### Architecture Decision: Extend Document Model vs New ReferralDocument Model

**Decision**: Create a new `ReferralDocument` model.

**Rationale**:
1. The existing `Document` model is optimized for clinical reports (echo, angiogram, labs) with extraction focused on clinical values
2. Referral extraction has a fundamentally different schema (patient demographics, GP contacts, referral reason)
3. The workflow differs: referrals need a review/apply step before affecting consultation context
4. Separation allows independent evolution and cleaner code organization
5. A referral document may eventually link to a regular Document after upload for storage, but the extraction data and workflow are distinct

### Processing Pipeline

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                           REFERRAL UPLOAD PIPELINE                          │
└─────────────────────────────────────────────────────────────────────────────┘

    ┌──────────┐      ┌──────────────┐      ┌───────────────┐      ┌─────────┐
    │  UPLOAD  │─────▶│ TEXT EXTRACT │─────▶│ AI EXTRACTION │─────▶│ REVIEW  │
    └──────────┘      └──────────────┘      └───────────────┘      └─────────┘
         │                   │                      │                    │
         ▼                   ▼                      ▼                    ▼
    status:           status:                status:               status:
    uploaded          text_extracted         extracted             applied
         │                   │                      │                    │
         ▼                   ▼                      ▼                    ▼
    Store file        Extract text           LLM extraction        Apply to
    to S3             from PDF/TXT           with confidence       consultation
```

## Source Code Structure Changes

### New Files to Create

```
src/
├── domains/
│   └── referrals/
│       ├── index.ts                       # Domain exports
│       ├── referral.types.ts              # Type definitions
│       ├── referral.service.ts            # Business logic
│       ├── referral-extraction.service.ts # LLM extraction logic
│       └── extractors/
│           └── referral-letter.ts         # Prompt & parser
│
├── app/
│   └── api/
│       └── referrals/
│           ├── route.ts                   # POST /api/referrals (upload)
│           └── [id]/
│               ├── route.ts               # GET, PATCH /api/referrals/:id
│               ├── extract-text/
│               │   └── route.ts           # POST /api/referrals/:id/extract-text
│               ├── extract-structured/
│               │   └── route.ts           # POST /api/referrals/:id/extract-structured
│               └── apply/
│                   └── route.ts           # POST /api/referrals/:id/apply
│
├── components/
│   └── referral/
│       ├── index.ts                       # Component exports
│       ├── ReferralUploader.tsx           # Upload UI component
│       ├── ReferralReviewPanel.tsx        # Review/edit extracted data
│       ├── ReferralFieldGroup.tsx         # Editable field section
│       └── ConfidenceIndicator.tsx        # Confidence score display
│
└── hooks/
    └── useReferralExtraction.ts           # Extraction workflow hook
```

### Files to Modify

```
prisma/schema.prisma                       # Add ReferralDocument model
src/components/consultation/index.ts       # Export new components
src/components/consultation/ConsultationContextForm.tsx  # Add referral upload section
src/app/(dashboard)/record/page.tsx        # Integrate referral upload workflow
```

## Data Model Changes

### New Prisma Model: ReferralDocument

```prisma
// Add to prisma/schema.prisma

model ReferralDocument {
  id           String                @id @default(uuid())
  userId       String
  user         User                  @relation(fields: [userId], references: [id])
  practiceId   String
  practice     Practice              @relation(fields: [practiceId], references: [id])

  // Optional links (set after extraction/review)
  patientId    String?
  patient      Patient?              @relation(fields: [patientId], references: [id])
  consultationId String?
  consultation Consultation?         @relation(fields: [consultationId], references: [id])

  // File storage
  filename     String
  mimeType     String
  sizeBytes    Int
  s3Key        String

  // Processing status
  status       ReferralDocumentStatus @default(UPLOADED)

  // Extracted content
  contentText  String?               @db.Text    // Raw text from PDF/TXT
  extractedData Json?                            // Structured extraction result

  // Metadata
  processingError String?
  processedAt  DateTime?
  createdAt    DateTime              @default(now())
  updatedAt    DateTime              @updatedAt

  @@index([userId, createdAt])
  @@index([practiceId])
  @@index([status])
  @@map("referral_documents")
}

enum ReferralDocumentStatus {
  UPLOADED           // File stored, awaiting text extraction
  TEXT_EXTRACTED     // Text extracted from PDF
  EXTRACTED          // AI structured extraction complete
  APPLIED            // Data applied to consultation
  FAILED             // Processing failed
}

// Add relations to existing models
model User {
  // ... existing fields
  referralDocuments ReferralDocument[]
}

model Practice {
  // ... existing fields
  referralDocuments ReferralDocument[]
}

model Patient {
  // ... existing fields
  referralDocuments ReferralDocument[]
}

model Consultation {
  // ... existing fields
  referralDocument  ReferralDocument?
  referralDocumentId String? @unique
}
```

### TypeScript Types

```typescript
// src/domains/referrals/referral.types.ts

export type ReferralDocumentStatus =
  | 'UPLOADED'
  | 'TEXT_EXTRACTED'
  | 'EXTRACTED'
  | 'APPLIED'
  | 'FAILED';

export interface ReferralDocument {
  id: string;
  userId: string;
  practiceId: string;
  patientId?: string;
  consultationId?: string;
  filename: string;
  mimeType: string;
  sizeBytes: number;
  s3Key: string;
  status: ReferralDocumentStatus;
  contentText?: string;
  extractedData?: ReferralExtractedData;
  processingError?: string;
  processedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

export interface ReferralExtractedData {
  // Patient information
  patient: {
    fullName?: string;
    dateOfBirth?: string;      // ISO date string
    sex?: 'male' | 'female' | 'other';
    medicare?: string;
    mrn?: string;
    urn?: string;
    address?: string;
    phone?: string;
    email?: string;
    confidence: number;        // 0-1
  };

  // GP information
  gp: {
    fullName?: string;
    practiceName?: string;
    address?: string;
    phone?: string;
    fax?: string;
    email?: string;
    providerNumber?: string;
    confidence: number;
  };

  // Referrer (if different from GP)
  referrer?: {
    fullName?: string;
    specialty?: string;
    organisation?: string;
    address?: string;
    phone?: string;
    fax?: string;
    email?: string;
    confidence: number;
  };

  // Referral context
  referralContext: {
    reasonForReferral?: string;
    keyProblems?: string[];
    investigationsMentioned?: string[];
    medicationsMentioned?: string[];
    urgency?: 'routine' | 'urgent' | 'emergency';
    referralDate?: string;
    confidence: number;
  };

  // Overall extraction metadata
  overallConfidence: number;
  extractedAt: string;         // ISO timestamp
  modelUsed: string;
}

export interface CreateReferralInput {
  filename: string;
  mimeType: string;
  sizeBytes: number;
}

export interface CreateReferralResult {
  id: string;
  uploadUrl: string;
  expiresAt: Date;
}

export interface ApplyReferralInput {
  // Reviewed/edited data to apply
  patient: {
    fullName: string;
    dateOfBirth: string;
    sex?: 'male' | 'female' | 'other';
    medicare?: string;
    mrn?: string;
    address?: string;
    phone?: string;
    email?: string;
  };
  gp?: {
    fullName: string;
    practiceName?: string;
    address?: string;
    phone?: string;
    fax?: string;
    email?: string;
  };
  referrer?: {
    fullName: string;
    specialty?: string;
    organisation?: string;
    address?: string;
    phone?: string;
    fax?: string;
    email?: string;
  };
  referralContext?: {
    reasonForReferral?: string;
    keyProblems?: string[];
  };
}

export interface ApplyReferralResult {
  patientId: string;
  referrerId?: string;
  consultationUpdated: boolean;
}
```

## API Changes

### 1. POST /api/referrals - Create referral and get upload URL

**Request**:
```typescript
{
  filename: string;           // "referral-letter.pdf"
  mimeType: "application/pdf" | "text/plain" | "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
  sizeBytes: number;          // Max 10MB
}
```

**Response** (201):
```typescript
{
  id: string;
  uploadUrl: string;          // Presigned S3 URL
  expiresAt: string;          // ISO timestamp
}
```

### 2. POST /api/referrals/:id/extract-text - Extract text from document

**Request**: Empty body (uses stored document)

**Response** (200):
```typescript
{
  id: string;
  status: "TEXT_EXTRACTED";
  textLength: number;
  preview: string;            // First 500 chars
}
```

### 3. POST /api/referrals/:id/extract-structured - AI extraction

**Request**: Empty body (uses extracted text)

**Response** (200):
```typescript
{
  id: string;
  status: "EXTRACTED";
  extractedData: ReferralExtractedData;
}
```

### 4. POST /api/referrals/:id/apply - Apply to consultation

**Request**:
```typescript
{
  consultationId?: string;    // Optional: link to existing consultation
  patient: { ... };           // Reviewed patient data
  gp?: { ... };               // Reviewed GP data
  referrer?: { ... };         // Reviewed referrer data
  referralContext?: { ... };  // Reviewed context
}
```

**Response** (200):
```typescript
{
  patientId: string;
  referrerId?: string;
  consultationId?: string;
  status: "APPLIED";
}
```

### 5. GET /api/referrals/:id - Get referral document

**Response** (200):
```typescript
{
  id: string;
  filename: string;
  status: ReferralDocumentStatus;
  extractedData?: ReferralExtractedData;
  downloadUrl?: string;       // Presigned URL for viewing
  processingError?: string;
  createdAt: string;
  updatedAt: string;
}
```

## LLM Extraction Prompt Design

```typescript
// src/domains/referrals/extractors/referral-letter.ts

export const REFERRAL_EXTRACTION_PROMPT = `You are a medical document parser specializing in referral letters.
Analyze this referral letter and extract structured information.

Extract the following data if present. Use null for any values not clearly stated.
Be conservative - only extract information that is explicitly stated.

Required JSON structure:
{
  "patient": {
    "fullName": <string or null>,
    "dateOfBirth": <ISO date string YYYY-MM-DD or null>,
    "sex": <"male"|"female"|"other" or null>,
    "medicare": <string or null>,
    "mrn": <string or null>,
    "urn": <string or null>,
    "address": <string or null>,
    "phone": <string or null>,
    "email": <string or null>,
    "confidence": <number 0-1 based on how clearly information was stated>
  },
  "gp": {
    "fullName": <string or null>,
    "practiceName": <string or null>,
    "address": <string or null>,
    "phone": <string or null>,
    "fax": <string or null>,
    "email": <string or null>,
    "providerNumber": <string or null>,
    "confidence": <number 0-1>
  },
  "referrer": <null if same as GP, otherwise object with same structure as gp plus:
    "specialty": <string or null>,
    "organisation": <string or null>
  >,
  "referralContext": {
    "reasonForReferral": <1-3 sentence summary or null>,
    "keyProblems": [<list of medical problems/conditions mentioned>],
    "investigationsMentioned": [<list of tests/procedures mentioned>],
    "medicationsMentioned": [<list of medications mentioned>],
    "urgency": <"routine"|"urgent"|"emergency" or null>,
    "referralDate": <ISO date string or null>,
    "confidence": <number 0-1>
  },
  "overallConfidence": <number 0-1 based on document clarity and completeness>
}

Rules:
1. Extract patient name exactly as written (include titles like Mr, Mrs if present)
2. Parse dates to ISO format YYYY-MM-DD when possible
3. Extract all phone numbers, emails, and addresses found
4. If GP and referring doctor are the same person, set referrer to null
5. Keep reason for referral concise but complete (1-3 sentences)
6. List key problems as separate items, not sentences
7. Confidence scores should reflect how clearly each piece of information was stated:
   - 0.9-1.0: Explicitly labeled and clearly stated
   - 0.7-0.9: Clearly stated but not explicitly labeled
   - 0.5-0.7: Implied or partially stated
   - Below 0.5: Inferred with uncertainty

Return ONLY the JSON object, no additional text.`;
```

## UI Component Design

### ReferralUploader Component

Location within ConsultationContextForm, before the patient selector:

```
┌─────────────────────────────────────────────────────────────────┐
│  Consultation Context                                           │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  ┌───────────────────────────────────────────────────────────┐  │
│  │  📄 Upload referral or previous letter (optional)         │  │
│  │                                                           │  │
│  │  ┌─────────────────────────────────────────────────────┐  │  │
│  │  │     ⬆️                                               │  │  │
│  │  │  Drop file here or click to browse                  │  │  │
│  │  │  PDF, TXT, or DOCX up to 10MB                       │  │  │
│  │  └─────────────────────────────────────────────────────┘  │  │
│  │                                                           │  │
│  │  ℹ️ DictateMED will read this letter, extract patient    │  │
│  │    and GP details, and let you confirm before filling   │  │
│  │    in this form.                                         │  │
│  └───────────────────────────────────────────────────────────┘  │
│                                                                 │
│  Patient *                                                      │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │  Search or add patient...                                │   │
│  └─────────────────────────────────────────────────────────┘   │
│  ...                                                            │
└─────────────────────────────────────────────────────────────────┘
```

### ReferralReviewPanel Component (Modal)

```
┌─────────────────────────────────────────────────────────────────┐
│  Review Extracted Details                              ✕ Close  │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  📋 Patient Details                              ⚠️ 85% conf    │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │  Full Name     │ John Michael Smith              │ ✏️   │   │
│  │  Date of Birth │ 1965-03-15                      │ ✏️   │   │
│  │  Medicare      │ 2345 67890 1                    │ ⚠️   │   │
│  │  Address       │ 123 Main St, Sydney NSW 2000    │ ✏️   │   │
│  └─────────────────────────────────────────────────────────┘   │
│  [✓ Accept Section] [Clear Section]                             │
│                                                                 │
│  👨‍⚕️ GP Details                                   ✓ 95% conf   │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │  Name          │ Dr. Sarah Chen                  │ ✏️   │   │
│  │  Practice      │ Harbour Medical Centre          │ ✏️   │   │
│  │  Phone         │ (02) 9876 5432                  │ ✏️   │   │
│  │  Address       │ 45 Harbour St, Sydney           │ ✏️   │   │
│  └─────────────────────────────────────────────────────────┘   │
│  [✓ Accept Section] [Clear Section]                             │
│                                                                 │
│  📝 Referral Context                               ✓ 90% conf   │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │  Reason for Referral:                                   │   │
│  │  Assessment of chest pain and shortness of breath on    │   │
│  │  exertion. Recent stress test showed ST changes.        │   │
│  │                                                         │   │
│  │  Key Problems:                                          │   │
│  │  • Chest pain                                           │   │
│  │  • Dyspnea on exertion                                  │   │
│  │  • Hypertension                                         │   │
│  └─────────────────────────────────────────────────────────┘   │
│  [✓ Accept Section] [Clear Section]                             │
│                                                                 │
├─────────────────────────────────────────────────────────────────┤
│                          [Cancel]  [Apply to Consultation]      │
└─────────────────────────────────────────────────────────────────┘
```

## Verification Approach

### Unit Tests

1. **referral.service.test.ts**
   - `createReferralDocument` - creates DB record, returns presigned URL
   - `updateReferralStatus` - status transitions
   - `applyReferralToConsultation` - creates/updates patient, referrer, consultation

2. **referral-extraction.service.test.ts**
   - `extractTextFromPdf` - handles valid PDF, returns text
   - `extractTextFromPdf` - handles corrupt PDF, returns error
   - `extractStructuredData` - parses LLM response correctly
   - `extractStructuredData` - handles malformed LLM response

3. **referral-letter.test.ts** (extractor)
   - `parseReferralExtraction` - parses complete extraction
   - `parseReferralExtraction` - handles partial data
   - `parseReferralExtraction` - calculates confidence correctly

4. **ReferralUploader.test.tsx**
   - Renders upload zone
   - Validates file type
   - Validates file size
   - Shows upload progress
   - Shows error states

5. **ReferralReviewPanel.test.tsx**
   - Renders extracted data
   - Allows field editing
   - Shows confidence indicators
   - Handles accept/clear actions
   - Calls apply callback with edited data

### Integration Tests

1. **Full upload flow**
   - Upload PDF → extract text → extract structured → apply

2. **Error recovery**
   - Upload failure → retry
   - Extraction failure → manual entry fallback

### Manual Verification

1. Test with sample referral letters:
   - Standard GP referral (well-formatted)
   - Specialist referral (different format)
   - Handwritten/scanned (should fail gracefully)

2. Verify consultation form population:
   - Patient fields populated correctly
   - GP contact created/selected
   - No duplicate contacts created

## Error Handling Strategy

### Upload Errors
- File too large (>10MB): Show size error, suggest compression
- Invalid type: Show type error with allowed types
- S3 failure: Retry 3x, then show generic error

### Text Extraction Errors
- PDF parsing failure: Mark as failed, offer manual entry
- Empty text: Mark as failed, show "unreadable document" message

### AI Extraction Errors
- LLM timeout: Retry 3x with exponential backoff
- Invalid JSON: Log error, mark as failed
- Low confidence (<0.3): Show warning, suggest verification

### Application Errors
- Duplicate patient: Offer to link to existing
- Invalid data: Show field-level validation errors

## Clarifications & Design Decisions

### 1. Referral Context Storage

**Issue**: The original task mentions populating a "Reason for referral" / "Clinical context" field in the consultation, but the `Consultation` model doesn't have such a field.

**Decision**: Store the referral context in two ways:
1. **ReferralDocument.extractedData.referralContext** - Preserved for audit/reference
2. **UI Display Only** - The reason for referral will be displayed in the consultation context form as read-only context (not stored separately on Consultation model)

**Rationale**:
- The referral context is primarily used during letter generation as source material
- The `ReferralDocument` is linked to the consultation via `consultation.referralDocument`
- Letter generation can access `consultation.referralDocument.extractedData.referralContext`
- No schema change needed for `Consultation` model

### 2. Referrer vs PatientContact Integration

**Issue**: The system has two contact models: `Referrer` (practice-wide, for consultation.referrerId) and `PatientContact` (patient-specific, for letter sending).

**Decision**: When applying referral data:
1. **GP → Referrer model**: Create/update entry in `Referrer` table (practice-wide), set as `consultation.referrerId`
2. **GP → PatientContact model**: Also create a `PatientContact` with `type: 'GP'` for the patient (for future letter sending)
3. **Referrer (if different)**: Create `PatientContact` with `type: 'REFERRER'` for the patient

**Mapping Logic**:
```typescript
// When applying referral:
if (input.gp) {
  // 1. Create/find Referrer for consultation context
  const referrer = await findOrCreateReferrer(practiceId, input.gp);
  consultation.referrerId = referrer.id;

  // 2. Create PatientContact for letter sending
  await createPatientContact(patientId, {
    type: 'GP',
    fullName: input.gp.fullName,
    organisation: input.gp.practiceName,
    ...input.gp
  });
}

if (input.referrer) {
  // Create separate PatientContact for the referring specialist
  await createPatientContact(patientId, {
    type: 'REFERRER',
    fullName: input.referrer.fullName,
    organisation: input.referrer.organisation,
    role: input.referrer.specialty,
    ...input.referrer
  });
}
```

### 3. PDF Text Extraction Approach

**Issue**: The existing extraction.service.ts uses Claude Vision for document processing, not text-based extraction.

**Decision**: Use a hybrid approach:
1. **Primary**: Use `pdf-parse` library for text extraction from PDFs
   - Faster and cheaper than vision
   - Works well for typed/digital PDFs (most referral letters)
   - Install: `npm install pdf-parse`
2. **Fallback**: If text extraction yields very little text (<100 chars), fall back to Claude Vision
   - Handles scanned PDFs
   - Handles image-based PDFs

**Rationale**: Most modern referral letters are digital PDFs with embedded text. Vision extraction is expensive and slow for this use case.

### 4. Patient Matching Logic

**Issue**: Need to handle potential duplicate patients when applying referral data.

**Decision**: Implement a simple matching strategy:

**Match Criteria** (in order of priority):
1. **Exact MRN match** - If MRN provided and matches existing patient → link to existing
2. **Exact Medicare match** - If Medicare number provided and matches → link to existing
3. **Name + DOB match** - If name (case-insensitive) AND DOB match → link to existing
4. **No match** - Create new patient

**Conflict Resolution**:
- If match found: Show confirmation UI "A patient with this name/DOB already exists. Link to existing?"
- Options: "Link to existing" | "Create new anyway" | "Cancel"

**Implementation**:
```typescript
async function findMatchingPatient(
  practiceId: string,
  patient: ApplyReferralInput['patient']
): Promise<Patient | null> {
  // 1. Try MRN match
  if (patient.mrn) {
    const match = await findPatientByMRN(practiceId, patient.mrn);
    if (match) return match;
  }

  // 2. Try Medicare match
  if (patient.medicare) {
    const match = await findPatientByMedicare(practiceId, patient.medicare);
    if (match) return match;
  }

  // 3. Try name + DOB match
  const match = await findPatientByNameAndDOB(
    practiceId,
    patient.fullName,
    patient.dateOfBirth
  );
  if (match) return match;

  return null;
}
```

### 5. Confirm Upload Step

**Issue**: The existing Document pattern has a confirm upload step to verify S3 upload completed.

**Decision**: Add confirm upload endpoint, matching existing pattern:

**New Endpoint**: `POST /api/referrals/:id/confirm-upload`

**Request**:
```typescript
{
  sizeBytes: number;  // Actual uploaded size for verification
}
```

**Response** (200):
```typescript
{
  id: string;
  status: "UPLOADED";  // Confirms ready for extraction
}
```

**Updated Pipeline**:
```
Upload URL → Client uploads to S3 → Confirm Upload → Extract Text → ...
```

### 6. Audit Logging

**Issue**: Existing document operations create audit logs; referral operations should too.

**Decision**: Add audit logging for all referral operations:

| Action | When |
|--------|------|
| `referral.upload` | After confirm upload |
| `referral.extract_text` | After text extraction |
| `referral.extract_structured` | After AI extraction |
| `referral.apply` | After applying to consultation |
| `referral.delete` | When referral document is deleted |

**Log Format** (matches existing AuditLog model):
```typescript
await prisma.auditLog.create({
  data: {
    userId,
    action: 'referral.apply',
    resourceType: 'referral_document',
    resourceId: referralId,
    metadata: {
      patientId,
      referrerId,
      consultationId,
      fieldsApplied: ['patient', 'gp', 'referralContext']
    }
  }
});
```

### 7. DOCX Support

**Issue**: DOCX is listed in MIME types but implementation not specified.

**Decision**: Defer DOCX support to post-MVP.

**Implementation**:
- Remove DOCX from `ALLOWED_REFERRAL_MIME_TYPES` constant
- Add TODO comment for future implementation
- UI will only accept PDF and TXT initially

**Rationale**: DOCX parsing adds complexity (mammoth.js or similar), and most referral letters are PDFs. Can add later if needed.

### 8. LLM Error Handling

**Issue**: Need explicit handling for malformed LLM responses.

**Decision**: Implement robust parsing with fallbacks:

```typescript
function parseReferralExtraction(jsonString: string): ReferralExtractedData {
  // 1. Clean markdown code blocks
  let cleaned = jsonString.trim();
  cleaned = cleaned.replace(/^```json\n?/, '').replace(/\n?```$/, '');

  // 2. Try JSON parse
  let data: unknown;
  try {
    data = JSON.parse(cleaned);
  } catch (e) {
    // Try to extract JSON from response
    const jsonMatch = cleaned.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      throw new ExtractionError('No valid JSON found in LLM response');
    }
    data = JSON.parse(jsonMatch[0]);
  }

  // 3. Validate required structure
  if (!data || typeof data !== 'object') {
    throw new ExtractionError('LLM response is not an object');
  }

  const obj = data as Record<string, unknown>;

  // 4. Parse with defaults for missing sections
  return {
    patient: parsePatientInfo(obj.patient) ?? { confidence: 0 },
    gp: parseGPInfo(obj.gp) ?? { confidence: 0 },
    referrer: obj.referrer ? parseReferrerInfo(obj.referrer) : undefined,
    referralContext: parseReferralContext(obj.referralContext) ?? { confidence: 0 },
    overallConfidence: typeof obj.overallConfidence === 'number'
      ? obj.overallConfidence
      : 0.5,
    extractedAt: new Date().toISOString(),
    modelUsed: 'claude-sonnet-4'
  };
}
```

**Error Categories**:
- `PARSE_ERROR`: JSON parsing failed completely
- `SCHEMA_ERROR`: JSON parsed but missing required fields
- `LOW_CONFIDENCE`: Extracted but overall confidence < 0.3

## PHI Handling

1. **Storage**: Referral documents stored encrypted in S3 (same as existing documents)
2. **Extracted text**: Stored in database, same encryption at rest as patient data
3. **LLM calls**: Use AWS Bedrock (data doesn't leave AWS, BAA compliant)
4. **Audit**: Log all extraction and application events (see section 6 above)
5. **Retention**: Follow same retention policy as consultation documents

## Migration Plan

1. Add `ReferralDocument` model and relations
2. Run migration: `npx prisma migrate dev --name add_referral_document`
3. Deploy backend API endpoints
4. Deploy frontend components
5. Enable feature flag (if using)

---

## Implementation Plan

Given the complexity, this feature should be implemented in the following incremental steps:

### Step 1: Database & Core Types
- Add `ReferralDocument` Prisma model
- Create migration
- Define TypeScript types in `referral.types.ts`

### Step 2: Upload API & Service
- Implement `referral.service.ts` with create/get methods
- Implement `POST /api/referrals` endpoint
- Implement presigned URL generation for uploads

### Step 3: Text Extraction
- Implement PDF text extraction using pdf-parse
- Implement `POST /api/referrals/:id/extract-text` endpoint
- Handle plain text files

### Step 4: AI Structured Extraction
- Design and implement extraction prompt
- Implement `POST /api/referrals/:id/extract-structured` endpoint
- Implement response parsing with confidence calculation

### Step 5: Upload UI Component
- Create `ReferralUploader.tsx` component
- Integrate into `ConsultationContextForm.tsx`
- Add upload states and progress

### Step 6: Review UI Component
- Create `ReferralReviewPanel.tsx` modal
- Create `ReferralFieldGroup.tsx` editable sections
- Create `ConfidenceIndicator.tsx` component

### Step 7: Apply Logic & Integration
- Implement `POST /api/referrals/:id/apply` endpoint
- Implement patient creation/matching logic
- Implement referrer creation logic
- Wire up consultation form population

### Step 8: Error Handling & Polish
- Add comprehensive error handling
- Add loading states
- Add fallback to manual entry

### Step 9: Tests & Documentation
- Write unit tests for services
- Write component tests
- Update TECH_NOTES/DESIGN_NOTES

---

*Specification created: 2025-12-23*
