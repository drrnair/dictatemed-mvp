# Technical Notes: Per-Clinician Style Learning System

This document provides technical documentation for the per-clinician, per-subspecialty style learning feature in DictateMED.

---

## Table of Contents

1. [Overview](#overview)
2. [Database Schema](#database-schema)
3. [API Reference](#api-reference)
4. [Core Services](#core-services)
5. [Learning Pipeline](#learning-pipeline)
6. [Privacy & PHI Handling](#privacy--phi-handling)
7. [Configuration & Tuning](#configuration--tuning)
8. [Troubleshooting](#troubleshooting)

---

## Overview

The style learning system enables DictateMED to learn each clinician's writing preferences on a per-subspecialty basis. When a clinician edits an AI-generated letter draft, the system captures those edits and updates a style profile. Future letter drafts for that clinician+subspecialty are then conditioned on the learned preferences.

### Key Components

| Component | Location | Purpose |
|-----------|----------|---------|
| StyleProfile model | `prisma/schema.prisma` | Per-subspecialty style preferences |
| StyleSeedLetter model | `prisma/schema.prisma` | Bootstrap letters for cold-start |
| StyleAnalyticsAggregate model | `prisma/schema.prisma` | De-identified internal analytics |
| subspecialty-profile.service | `src/domains/style/` | Profile CRUD operations |
| learning-pipeline | `src/domains/style/` | Edit recording & analysis |
| diff-analyzer | `src/domains/style/` | Section-level diff computation |
| prompt-conditioner | `src/domains/style/` | Style-to-prompt transformation |
| analytics-aggregator | `src/domains/style/` | De-identified analytics |

### Subspecialties Supported

```typescript
enum Subspecialty {
  GENERAL_CARDIOLOGY
  INTERVENTIONAL
  STRUCTURAL
  ELECTROPHYSIOLOGY
  IMAGING
  HEART_FAILURE
  CARDIAC_SURGERY
}
```

---

## Database Schema

### StyleProfile Table

Stores per-clinician, per-subspecialty writing preferences.

```sql
CREATE TABLE style_profiles (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id         UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  subspecialty    VARCHAR NOT NULL,

  -- Section preferences
  section_order        TEXT[],     -- ["History", "Examination", "Impression", "Plan"]
  section_inclusion    JSONB DEFAULT '{}',  -- { "Medications": 0.9, "FamilyHistory": 0.3 }
  section_verbosity    JSONB DEFAULT '{}',  -- { "History": "detailed", "Plan": "brief" }

  -- Phrasing preferences
  phrasing_preferences JSONB DEFAULT '{}',  -- Common phrases per section
  avoided_phrases      JSONB DEFAULT '{}',  -- Phrases consistently deleted
  vocabulary_map       JSONB DEFAULT '{}',  -- { "utilize": "use" }
  terminology_level    VARCHAR,             -- "specialist" | "lay" | "mixed"

  -- Global style indicators
  greeting_style       VARCHAR,  -- "formal" | "casual" | "mixed"
  closing_style        VARCHAR,  -- "formal" | "casual" | "mixed"
  signoff_template     VARCHAR,  -- Preferred sign-off text
  formality_level      VARCHAR,  -- "very-formal" | "formal" | "neutral" | "casual"
  paragraph_structure  VARCHAR,  -- "long" | "short" | "mixed"

  -- Confidence & metadata
  confidence           JSONB DEFAULT '{}',  -- Per-preference confidence scores
  learning_strength    FLOAT DEFAULT 1.0,   -- 0.0 = disabled, 1.0 = full effect
  total_edits_analyzed INT DEFAULT 0,
  last_analyzed_at     TIMESTAMP,

  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),

  UNIQUE(user_id, subspecialty)
);

CREATE INDEX idx_style_profiles_user ON style_profiles(user_id);
```

**Key Fields:**

| Field | Type | Description |
|-------|------|-------------|
| `sectionOrder` | String[] | Ordered list of section types |
| `sectionInclusion` | JSON | Probability (0-1) for including optional sections |
| `sectionVerbosity` | JSON | Detail level per section: "brief" \| "normal" \| "detailed" |
| `phrasingPreferences` | JSON | Map of section → preferred phrases[] |
| `avoidedPhrases` | JSON | Map of section → phrases to avoid[] |
| `vocabularyMap` | JSON | Word substitutions: { "utilize": "use" } |
| `learningStrength` | Float | 0.0-1.0 controls how strongly profile affects generation |
| `confidence` | JSON | Per-preference confidence scores (0-1) |

### StyleSeedLetter Table

Allows clinicians to upload sample letters to bootstrap style profiles.

```sql
CREATE TABLE style_seed_letters (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id         UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  subspecialty    VARCHAR NOT NULL,
  letter_text     TEXT NOT NULL,
  analyzed_at     TIMESTAMP,
  created_at      TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_style_seed_letters_user_sub ON style_seed_letters(user_id, subspecialty);
```

### StyleAnalyticsAggregate Table

Stores de-identified, aggregated style patterns for internal product insights.

```sql
CREATE TABLE style_analytics_aggregates (
  id                    UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  subspecialty          VARCHAR NOT NULL,
  period                VARCHAR NOT NULL,  -- "2025-W01" format

  common_additions      JSONB,  -- Frequently added content
  common_deletions      JSONB,  -- Frequently deleted content
  section_order_patterns JSONB, -- Common section arrangements
  phrasing_patterns     JSONB,  -- High-frequency phrases
  sample_size           INT,    -- Number of letters in aggregate

  created_at TIMESTAMP DEFAULT NOW(),

  UNIQUE(subspecialty, period)
);
```

### Modified Tables

#### StyleEdit (Extended)

```sql
ALTER TABLE style_edits ADD COLUMN subspecialty VARCHAR;
CREATE INDEX idx_style_edits_user_subspecialty ON style_edits(user_id, subspecialty);
```

#### Letter (Extended)

```sql
ALTER TABLE letters ADD COLUMN subspecialty VARCHAR;
```

---

## API Reference

### Profile Management

#### List Profiles
```
GET /api/style/profiles
```
Returns all subspecialty profiles for the authenticated user.

**Response:**
```json
{
  "profiles": [
    {
      "id": "uuid",
      "subspecialty": "HEART_FAILURE",
      "learningStrength": 0.8,
      "totalEditsAnalyzed": 25,
      "lastAnalyzedAt": "2025-01-15T10:30:00Z",
      "confidence": { "greeting": 0.85, "verbosity": 0.72 }
    }
  ]
}
```

#### Create/Update Profile
```
POST /api/style/profiles
Content-Type: application/json

{
  "subspecialty": "HEART_FAILURE",
  "sectionOrder": ["History", "Examination", "Plan"],
  "sectionVerbosity": { "History": "detailed" },
  "greetingStyle": "formal"
}
```

#### Get Specific Profile
```
GET /api/style/profiles/:subspecialty
```

#### Delete Profile (Reset to Defaults)
```
DELETE /api/style/profiles/:subspecialty
```

#### Adjust Learning Strength
```
PATCH /api/style/profiles/:subspecialty/strength
Content-Type: application/json

{
  "learningStrength": 0.5
}
```
**Valid range:** 0.0 (disabled) to 1.0 (full effect)

#### Trigger Manual Analysis
```
POST /api/style/profiles/:subspecialty/analyze
Content-Type: application/json

{
  "forceReanalyze": false
}
```

#### Get Analysis Status
```
GET /api/style/profiles/:subspecialty/analyze
```

**Response:**
```json
{
  "subspecialty": "HEART_FAILURE",
  "editCount": 15,
  "editsRequired": 5,
  "canAnalyze": true,
  "lastAnalyzedAt": "2025-01-15T10:30:00Z"
}
```

### Seed Letter Management

#### Upload Seed Letter
```
POST /api/style/seed
Content-Type: application/json

{
  "subspecialty": "HEART_FAILURE",
  "letterText": "Dear Dr. Smith,\n\nThank you for referring...",
  "triggerAnalysis": true
}
```

**Validation:**
- `letterText`: 100-50,000 characters

#### List Seed Letters
```
GET /api/style/seed?subspecialty=HEART_FAILURE
```

#### Delete Seed Letter
```
DELETE /api/style/seed/:id
```

### Updated Endpoints

#### Letter Generation (Subspecialty-Aware)
```
POST /api/letters
Content-Type: application/json

{
  "consultationId": "uuid",
  "letterType": "NEW_PATIENT",
  "templateId": "uuid",
  "subspecialty": "HEART_FAILURE"  // Optional: explicit subspecialty
}
```

If `subspecialty` is not provided, it's inferred from:
1. Template subspecialties (first one)
2. Consultation context
3. Falls back to global profile

#### Style Analysis (Subspecialty-Aware)
```
POST /api/style/analyze
Content-Type: application/json

{
  "subspecialty": "HEART_FAILURE",  // Optional
  "forceReanalyze": false
}
```

```
GET /api/style/analyze?subspecialty=HEART_FAILURE
```

### Admin Endpoints

#### Style Analytics (Admin Only)
```
GET /api/admin/style-analytics?subspecialty=HEART_FAILURE&limit=10
GET /api/admin/style-analytics?summary=true
```

**Requires:** ADMIN role

```
POST /api/admin/style-analytics
Content-Type: application/json

{
  "subspecialty": "HEART_FAILURE"  // or "runAll": true
}
```

---

## Core Services

### subspecialty-profile.service.ts

CRUD operations for per-subspecialty style profiles.

```typescript
import {
  createSubspecialtyProfile,
  getSubspecialtyProfile,
  listSubspecialtyProfiles,
  updateSubspecialtyProfile,
  deleteSubspecialtyProfile,
  adjustLearningStrength,
  getEffectiveProfile,
} from '@/domains/style';

// Create new profile
const profile = await createSubspecialtyProfile({
  userId: 'user-uuid',
  subspecialty: 'HEART_FAILURE',
  sectionOrder: ['History', 'Examination', 'Plan'],
  learningStrength: 1.0,
});

// Get effective profile with fallback chain
const effective = await getEffectiveProfile(userId, 'HEART_FAILURE');
// Falls back: subspecialty → global → null
```

**Caching:**
- Profiles are cached in memory for 5 minutes
- Use `clearProfileCache()` to invalidate
- Use `getCacheStats()` to monitor cache performance

### diff-analyzer.ts

Section-level diff computation for precise style learning.

```typescript
import {
  parseLetterSections,
  alignSections,
  analyzeDiff,
  extractAddedPhrases,
  extractRemovedPhrases,
} from '@/domains/style';

// Parse a letter into sections
const sections = parseLetterSections(letterText);
// Returns: [{ type: 'greeting', content: 'Dear Dr...' }, ...]

// Compute full diff analysis
const analysis = analyzeDiff({
  draftContent: originalDraft,
  finalContent: editedLetter,
});

// Extract learning signals
const added = extractAddedPhrases(analysis.sectionDiffs);
const removed = extractRemovedPhrases(analysis.sectionDiffs);
```

**Detected Section Types:**
- `greeting`, `history`, `past_medical_history`, `medications`
- `examination`, `investigations`, `impression`, `plan`
- `recommendations`, `follow_up`, `closing`, `signoff`
- `other` (fallback)

### learning-pipeline.ts

Background learning pipeline that updates profiles from edits.

```typescript
import {
  recordSubspecialtyEdits,
  shouldTriggerAnalysis,
  queueStyleAnalysis,
  runStyleAnalysis,
  mergeProfileAnalysis,
  applyLearningStrength,
} from '@/domains/style';

// Record edits on letter approval
await recordSubspecialtyEdits({
  userId,
  letterId,
  subspecialty: 'HEART_FAILURE',
  draftContent,
  finalContent,
});

// Check if analysis should run
if (await shouldTriggerAnalysis(userId, subspecialty)) {
  await queueStyleAnalysis(userId, subspecialty);
}
```

**Thresholds:**
- `MIN_EDITS_FOR_ANALYSIS`: 5 edits to trigger initial analysis
- `ANALYSIS_INTERVAL`: 10 additional edits between re-analyses
- `MAX_EDITS_PER_ANALYSIS`: 50 edits analyzed at a time
- `MIN_CONFIDENCE_THRESHOLD`: 0.5 minimum confidence to apply preferences

### prompt-conditioner.ts

Transforms style profiles into generation-time prompts.

```typescript
import {
  buildStyleConditionedPrompt,
  buildStyleHintsFromProfile,
  computeOverallConfidence,
} from '@/domains/style';

// Build conditioned prompt for generation
const { enhancedPrompt, hints, profileSource } = await buildStyleConditionedPrompt({
  userId,
  subspecialty: 'HEART_FAILURE',
  basePrompt: originalPrompt,
});

// profileSource: 'subspecialty' | 'global' | 'none'
```

**Fallback Chain:**
1. Subspecialty profile (if exists for userId + subspecialty)
2. Global profile (User.styleProfile)
3. No conditioning (returns basePrompt unchanged)

**Style Guidance Format:**
```markdown
# PHYSICIAN STYLE PREFERENCES (Subspecialty: Heart Failure)

## Section Order
Arrange sections: History → Examination → Investigations → Impression → Plan

## Detail Level by Section
- History: detailed
- Plan: brief

## Preferred Phrases
- In Impression: prefer "The patient has established heart failure..."
- In Plan: prefer "I have recommended..."

## Sign-off
Use this closing: "Kind regards,\n\nDr. Smith"
```

---

## Learning Pipeline

### Architecture

```
Letter Approval
      │
      ▼
┌─────────────────┐
│ Record Edits    │ ← Synchronous, called in approval flow
│ (StyleEdit)     │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│ Check Threshold │ ← MIN_EDITS_FOR_ANALYSIS (5)
└────────┬────────┘
         │ (if threshold met)
         ▼
┌─────────────────┐
│ Queue Analysis  │ ← Fire-and-forget, non-blocking
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│ Run Analysis    │ ← Uses Claude Sonnet for pattern detection
│ (Claude Call)   │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│ Merge Profile   │ ← Weighted merge with existing profile
│ (StyleProfile)  │
└─────────────────┘
```

### Edit Recording Flow

1. **approveLetter()** in `approval.service.ts` triggers learning
2. Subspecialty is inferred from letter or template
3. `recordSubspecialtyEdits()` computes section-level diffs
4. Edits stored in `StyleEdit` with subspecialty context
5. Non-blocking check for analysis trigger

### Profile Merge Logic

When new analysis results arrive:

```typescript
function mergeProfileAnalysis(existing, newAnalysis) {
  // Weight based on edit counts
  const existingWeight = existing.totalEditsAnalyzed / (existing.totalEditsAnalyzed + newAnalysis.editCount);
  const newWeight = 1 - existingWeight;

  // Merge section order (prefer order seen in more recent edits)
  // Merge vocabulary (union of substitutions)
  // Merge confidence scores (weighted average)

  return merged;
}
```

### Seed Letter Bootstrapping

For cold-start scenarios:

```typescript
await analyzeSeedLetters(userId, subspecialty);
```

This analyzes uploaded sample letters to create an initial profile without requiring edit history.

---

## Privacy & PHI Handling

### What Data is Stored

| Data | Storage Location | PHI Status |
|------|-----------------|------------|
| Draft content | Letter.contentDraft | Contains PHI |
| Final content | Letter.contentFinal | Contains PHI |
| Edit text | StyleEdit.beforeText/afterText | Contains PHI |
| Style profile | StyleProfile | **No PHI** |
| Analytics aggregates | StyleAnalyticsAggregate | **No PHI** |

### PHI Stripping for Analytics

All analytics processing strips PHI before aggregation:

```typescript
import { stripPHI, containsPHI, sanitizePhrase } from '@/domains/style';

// Strips patient names, dates, Medicare numbers, phone numbers, emails, addresses
const clean = stripPHI(text);

// Check if text contains PHI
if (containsPHI(phrase)) {
  // Skip this phrase in aggregation
}

// Sanitize phrase for analytics (strips PHI, validates)
const safe = sanitizePhrase(phrase);  // Returns null if unsafe
```

**PHI Patterns Detected:**
- Patient names (with titles: Mr., Mrs., Dr., etc.)
- Dates (DD/MM/YYYY, DD-MM-YYYY, Month DD, YYYY)
- Medicare numbers (10-11 digits)
- Phone numbers (AU mobile 04xx, landline (0x), international +61)
- Email addresses
- Physical addresses (street patterns)
- URN/MRN identifiers

### Aggregation Anonymity Thresholds

```typescript
// analytics-aggregator.ts constants
MIN_CLINICIANS_FOR_AGGREGATION = 5;   // Prevent re-identification
MIN_LETTERS_FOR_AGGREGATION = 10;     // Minimum sample size
MIN_PATTERN_FREQUENCY = 2;             // Filter noise
MAX_PATTERNS_PER_CATEGORY = 50;        // Limit output size
```

### Access Control

- Style profiles are owned by the clinician
- Only the profile owner can view/modify their profiles
- Admin analytics endpoint requires ADMIN role
- All profile modifications are audit-logged

### Audit Logging

All style operations create audit logs:

```typescript
// Logged actions:
'style.profile.create'
'style.profile.update'
'style.profile.delete'
'style.profile.adjustStrength'
'style.analysis.trigger'
'style.seedLetter.upload'
'style.seedLetter.delete'
```

---

## Configuration & Tuning

### Environment Variables

Uses existing variables plus optional tuning:
- `DATABASE_URL` - PostgreSQL connection
- AWS Bedrock credentials for Claude calls
- `STYLE_PROFILE_CACHE_TTL_MS` - Profile cache TTL in milliseconds (default: 300000 / 5 minutes)

### Tunable Constants

Located in `src/domains/style/learning-pipeline.ts`:

```typescript
// Minimum edits before first analysis
export const MIN_EDITS_FOR_ANALYSIS = 5;

// Additional edits between re-analyses
export const ANALYSIS_INTERVAL = 10;

// Maximum edits to analyze at once
export const MAX_EDITS_PER_ANALYSIS = 50;

// Minimum confidence to apply a preference
export const MIN_CONFIDENCE_THRESHOLD = 0.5;
```

Located in `src/domains/style/prompt-conditioner.ts`:

```typescript
// Maximum phrases to include per section
export const MAX_PHRASES_PER_SECTION = 5;

// Maximum avoided phrases per section
export const MAX_AVOIDED_PHRASES_PER_SECTION = 5;

// Maximum vocabulary substitutions
export const MAX_VOCABULARY_SUBSTITUTIONS = 10;
```

### Learning Strength

Clinicians can adjust their learning strength (0.0-1.0):

| Value | Effect |
|-------|--------|
| 0.0 | Profile completely disabled |
| 0.25 | Light adaptation |
| 0.5 | Moderate adaptation |
| 0.75 | Strong adaptation |
| 1.0 | Full adaptation (default) |

### Cache Settings

Profile cache in `subspecialty-profile.service.ts`:

```typescript
// Default: 5 minutes
// Configurable via STYLE_PROFILE_CACHE_TTL_MS environment variable
const CACHE_TTL_MS = parseInt(process.env.STYLE_PROFILE_CACHE_TTL_MS || '', 10) || DEFAULT_CACHE_TTL_MS;
```

To adjust cache TTL:
```bash
# Set to 1 minute for development
export STYLE_PROFILE_CACHE_TTL_MS=60000

# Set to 10 minutes for production
export STYLE_PROFILE_CACHE_TTL_MS=600000

# Disable cache (TTL = 0)
export STYLE_PROFILE_CACHE_TTL_MS=0
```

---

## Troubleshooting

### Profile Not Applied to Generation

1. **Check profile exists:**
   ```sql
   SELECT * FROM style_profiles
   WHERE user_id = 'uuid' AND subspecialty = 'HEART_FAILURE';
   ```

2. **Check learning strength:**
   - If `learning_strength = 0`, profile is disabled

3. **Check confidence scores:**
   - Preferences with confidence < 0.5 are not applied

4. **Check fallback chain:**
   - Log shows `profileSource: 'none'` means no profile found

### Analysis Not Triggering

1. **Check edit count:**
   ```sql
   SELECT COUNT(*) FROM style_edits
   WHERE user_id = 'uuid'
     AND subspecialty = 'HEART_FAILURE'
     AND created_at > (SELECT COALESCE(last_analyzed_at, '1970-01-01')
                       FROM style_profiles
                       WHERE user_id = 'uuid' AND subspecialty = 'HEART_FAILURE');
   ```
   Need at least 5 edits for initial, 10 for re-analysis.

2. **Check subspecialty inference:**
   - Letters without subspecialty won't contribute to profiles
   - Check template has subspecialties configured

### Style Hints Too Aggressive/Weak

1. **Adjust learning strength:**
   ```
   PATCH /api/style/profiles/HEART_FAILURE/strength
   { "learningStrength": 0.5 }
   ```

2. **Reset profile:**
   ```
   DELETE /api/style/profiles/HEART_FAILURE
   ```

3. **Check individual confidence scores:**
   ```sql
   SELECT confidence FROM style_profiles
   WHERE user_id = 'uuid' AND subspecialty = 'HEART_FAILURE';
   ```

### Cache Issues

```typescript
import { clearProfileCache, getCacheStats } from '@/domains/style';

// Clear all cached profiles
clearProfileCache();

// Monitor cache performance
const stats = getCacheStats();
console.log(stats);  // { size: 15, hits: 120, misses: 8 }
```

---

## Extension Points

### Adding a New Subspecialty

1. Add to `Subspecialty` enum in `prisma/schema.prisma`
2. Run `npx prisma generate`
3. Update `getAllSubspecialties()` in `useStyleProfiles.ts`
4. Add label in `formatSubspecialtyLabel()` if custom format needed

### Adding a New Section Type

1. Add pattern in `diff-analyzer.ts` `SECTION_PATTERNS`
2. Add to `LetterSectionType` in `subspecialty-profile.types.ts`
3. Update `formatSectionName()` in `prompt-conditioner.ts`

### Custom Analysis Model

The learning pipeline uses Claude Sonnet by default. To change:

```typescript
// learning-pipeline.ts
const response = await generateTextWithRetry({
  modelId: MODELS.SONNET,  // Change to MODELS.OPUS for more nuanced analysis
  // ...
});
```

---

---

# Technical Notes: Referral Upload & Auto-Populate Feature

This document provides technical documentation for the referral letter upload and auto-population feature in DictateMED.

---

## Table of Contents

1. [Overview](#overview-1)
2. [Processing Pipeline](#processing-pipeline)
3. [Database Schema](#database-schema-1)
4. [API Reference](#api-reference-1)
5. [PHI Handling](#phi-handling)
6. [Error Handling](#error-handling-1)
7. [QA Testing Guide](#qa-testing-guide)

---

## Overview

The referral upload feature allows specialists to upload a referral letter (PDF or text) and automatically extract patient and referrer details to pre-fill the consultation form. This reduces manual data entry and improves accuracy.

### Key Components

| Component | Location | Purpose |
|-----------|----------|---------|
| ReferralDocument model | `prisma/schema.prisma` | Stores referral document metadata and extracted data |
| referral.service | `src/domains/referrals/` | Core business logic for document processing |
| referral-extraction.service | `src/domains/referrals/` | AI-powered structured data extraction |
| ReferralUploader | `src/components/referral/` | Upload UI component |
| ReferralReviewPanel | `src/components/referral/` | Review and edit extracted data |

### Status Workflow

```
UPLOADED → TEXT_EXTRACTED → EXTRACTED → APPLIED
    ↓           ↓              ↓
  FAILED      FAILED        FAILED
```

| Status | Description |
|--------|-------------|
| `UPLOADED` | File uploaded to S3, awaiting text extraction |
| `TEXT_EXTRACTED` | Text extracted from PDF/file, awaiting AI analysis |
| `EXTRACTED` | AI has extracted structured data, ready for review |
| `APPLIED` | Data has been applied to consultation context |
| `FAILED` | Processing failed at some stage |

---

## Processing Pipeline

### Architecture

```
┌─────────────────────┐
│   1. File Upload    │ ← User drags/selects PDF or text file
│   (ReferralUploader)│
└─────────┬───────────┘
          │
          ▼
┌─────────────────────┐
│ 2. S3 Upload        │ ← Presigned URL upload to object storage
│ POST /api/referrals │   Creates ReferralDocument record
└─────────┬───────────┘
          │
          ▼
┌─────────────────────┐
│ 3. Text Extraction  │ ← pdf-parse for PDFs, direct read for .txt
│ POST .../extract-text│  Updates contentText field
└─────────┬───────────┘
          │
          ▼
┌─────────────────────┐
│ 4. AI Extraction    │ ← Claude Sonnet extracts structured data
│ POST .../extract-   │   Patient, GP, referrer, context
│      structured     │
└─────────┬───────────┘
          │
          ▼
┌─────────────────────┐
│ 5. User Review      │ ← ReferralReviewPanel modal
│ (ReferralReviewPanel│   Edit/confirm extracted fields
└─────────┬───────────┘
          │
          ▼
┌─────────────────────┐
│ 6. Apply to Form    │ ← Creates/matches patient, creates referrer
│ POST .../apply      │   Links document to consultation
└─────────────────────┘
```

### Step 1-2: File Upload

1. User selects file via drag-drop or file picker
2. Client validates: file type (PDF, TXT), size (≤10MB)
3. `POST /api/referrals` creates `ReferralDocument` record
4. Returns presigned S3 upload URL
5. Client uploads directly to S3
6. `PATCH /api/referrals/:id` confirms upload

### Step 3: Text Extraction

1. `POST /api/referrals/:id/extract-text`
2. Fetches file from S3
3. For PDF: uses `pdf-parse` library to extract text
4. For TXT: reads directly as UTF-8
5. Stores extracted text in `contentText` field
6. Updates status to `TEXT_EXTRACTED`
7. Flags `isShortText` if < 100 characters (may need vision fallback in future)

### Step 4: AI Structured Extraction

1. `POST /api/referrals/:id/extract-structured`
2. Sends text to Claude Sonnet with extraction prompt
3. Prompt requests JSON with:
   - Patient: fullName, dateOfBirth, sex, medicare, MRN, address, phone, email
   - GP: fullName, practiceName, address, phone, fax, email, providerNumber
   - Referrer: fullName, specialty, organisation, contact details
   - Context: reasonForReferral, keyProblems[], investigationsMentioned[], medicationsMentioned[], urgency
   - Confidence scores (0-1) per section
4. Parser handles various date formats (ISO, DD/MM/YYYY)
5. Updates status to `EXTRACTED`

### Step 5: User Review

1. `ReferralReviewPanel` displays extracted data
2. All fields are editable
3. Confidence indicators show extraction reliability:
   - ≥80%: Green (high confidence)
   - 60-79%: Amber (medium confidence)
   - <60%: Red (low confidence, needs review)
4. User can clear sections or restore original values

### Step 6: Apply to Consultation

1. `POST /api/referrals/:id/apply` with (possibly edited) data
2. Patient matching:
   - First tries Medicare number match
   - Then name + DOB match
   - Creates new patient if no match
3. Creates/updates practice-level referrer
4. Creates patient-level GP contact
5. Updates document status to `APPLIED`
6. Returns IDs for form population

---

## Database Schema

### ReferralDocument Table

```prisma
model ReferralDocument {
  id              String    @id @default(uuid())
  userId          String
  practiceId      String
  patientId       String?   // Linked after apply
  consultationId  String?   // Linked after apply

  filename        String
  mimeType        String
  sizeBytes       Int
  s3Key           String

  status          ReferralDocumentStatus @default(UPLOADED)
  contentText     String?   @db.Text  // Extracted text
  extractedData   Json?     // Structured extraction result
  processingError String?   // Error message if failed
  processedAt     DateTime?

  createdAt       DateTime  @default(now())
  updatedAt       DateTime  @updatedAt

  user            User      @relation(...)
  practice        Practice  @relation(...)
  patient         Patient?  @relation(...)
  consultation    Consultation? @relation(...)
}

enum ReferralDocumentStatus {
  UPLOADED
  TEXT_EXTRACTED
  EXTRACTED
  APPLIED
  FAILED
}
```

### Extracted Data JSON Structure

```typescript
interface ReferralExtractedData {
  patient: {
    fullName?: string;
    dateOfBirth?: string;  // ISO format: YYYY-MM-DD
    sex?: 'male' | 'female' | 'other';
    medicare?: string;
    mrn?: string;
    address?: string;
    phone?: string;
    email?: string;
    confidence: number;    // 0-1
  };
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
  referrer?: {
    fullName?: string;
    specialty?: string;
    organisation?: string;
    address?: string;
    phone?: string;
    email?: string;
    confidence: number;
  };
  referralContext: {
    reasonForReferral?: string;
    keyProblems?: string[];
    investigationsMentioned?: string[];
    medicationsMentioned?: string[];
    urgency?: 'routine' | 'urgent' | 'emergency';
    referralDate?: string;
    confidence: number;
  };
  overallConfidence: number;
  extractedAt: string;      // ISO timestamp
  modelUsed: string;        // Model ID used for extraction
}
```

---

## API Reference

### Create Referral Document

```
POST /api/referrals
Content-Type: application/json

{
  "filename": "referral-letter.pdf",
  "mimeType": "application/pdf",
  "sizeBytes": 102400
}

Response:
{
  "id": "uuid",
  "uploadUrl": "https://s3.../presigned-upload-url",
  "expiresAt": "2024-01-01T01:00:00Z"
}
```

### Confirm Upload

```
PATCH /api/referrals/:id
Content-Type: application/json

{
  "sizeBytes": 102400  // Actual uploaded size
}
```

### Extract Text

```
POST /api/referrals/:id/extract-text

Response:
{
  "id": "uuid",
  "status": "TEXT_EXTRACTED",
  "textLength": 1500,
  "preview": "First 500 characters...",
  "isShortText": false
}
```

### Extract Structured Data

```
POST /api/referrals/:id/extract-structured

Response:
{
  "id": "uuid",
  "status": "EXTRACTED",
  "extractedData": { ... }
}
```

### Apply to Consultation

```
POST /api/referrals/:id/apply
Content-Type: application/json

{
  "consultationId": "uuid",  // Optional
  "patient": {
    "fullName": "John Smith",
    "dateOfBirth": "1980-01-15",
    "medicare": "1234567890"
  },
  "gp": {
    "fullName": "Dr. Jane Wilson",
    "practiceName": "City Medical"
  },
  "referrer": { ... },      // Optional
  "referralContext": { ... } // Optional
}

Response:
{
  "patientId": "uuid",
  "referrerId": "uuid",
  "consultationId": "uuid",
  "status": "APPLIED"
}
```

### List Documents

```
GET /api/referrals?status=EXTRACTED&page=1&limit=20

Response:
{
  "documents": [...],
  "total": 50,
  "page": 1,
  "limit": 20,
  "hasMore": true
}
```

---

## PHI Handling

### Data Flow & Storage

| Data | Storage | PHI Status | Encryption |
|------|---------|------------|------------|
| Uploaded file | S3 | Contains PHI | At-rest encryption |
| Extracted text | `contentText` | Contains PHI | Database encryption |
| Extracted data | `extractedData` JSON | Contains PHI | Database encryption |
| Patient records | `Patient` table | Contains PHI | Field-level encryption |

### Access Control

- All referral document operations require authentication
- Documents are scoped to practice level (`practiceId`)
- Any authenticated user within a practice can access referral documents
- Operations are audit logged with userId

### Data Retention

- Referral documents are retained as part of the clinical record
- Documents with status `APPLIED` cannot be deleted
- Deletion removes both S3 object and database record

### Audit Logging

All referral operations create audit logs:

```
referral.create         - Document created
referral.upload_confirm - S3 upload confirmed
referral.extract_text   - Text extraction succeeded
referral.extract_text_failed - Text extraction failed
referral.extract_structured - AI extraction succeeded
referral.apply          - Applied to consultation
referral.delete         - Document deleted
```

---

## Error Handling

### Common Errors

| Error | Status | User Message |
|-------|--------|--------------|
| Invalid file type | 400 | "PDF or plain text files only" |
| File too large | 400 | "Maximum file size is 10MB" |
| PDF parse failed | 500 | "Could not read this PDF. Try a different file." |
| AI extraction failed | 500 | "Could not extract details. You can enter them manually." |
| Already processed | 400 | "This document has already been processed" |

### Graceful Degradation

The UI always allows manual entry fallback:
- Upload errors show "You can still complete the form manually"
- Extraction errors don't block the consultation workflow
- Low confidence warnings encourage review but don't prevent apply

---

## QA Testing Guide

### Sample Test Referral Letter

Use this sample text for testing (save as `test-referral.txt`):

```
Dr. Sarah Chen
Harbour Medical Centre
45 Harbour St, Sydney NSW 2000
Phone: (02) 9876 5432
Email: drschen@harbourmed.com.au

15 January 2024

Dear Specialist,

Re: John Michael Smith
DOB: 15/03/1965
Medicare: 2345 67890 1
Address: 123 Patient St, Sydney NSW 2000
Phone: 0412 345 678

I am referring this 58-year-old male patient for assessment of chest pain
and shortness of breath on exertion over the past 3 months.

History:
Mr. Smith presents with increasing episodes of substernal chest discomfort
on moderate exertion, relieved by rest. Associated dyspnoea noted.

Key Problems:
- Exertional chest pain
- Dyspnoea on exertion
- Hypertension (controlled)
- Hyperlipidaemia

Investigations:
- ECG: Normal sinus rhythm
- Stress test: ST depression in leads V4-V6 at peak exercise
- Lipid panel: LDL 3.2 mmol/L

Current Medications:
- Aspirin 100mg daily
- Metoprolol XL 50mg daily
- Atorvastatin 20mg nocte

Thank you for seeing this patient at your earliest convenience.

Kind regards,

Dr. Sarah Chen
MBBS, FRACGP
Provider Number: 1234567A
```

### Test Scenarios

1. **Happy path PDF upload**
   - Upload a valid PDF referral letter
   - Verify text extraction succeeds
   - Verify AI extraction returns patient and GP details
   - Review and apply to consultation
   - Verify patient and referrer created

2. **Text file upload**
   - Upload the sample text file above
   - Verify same extraction flow works

3. **Invalid file type**
   - Try uploading .docx, .jpg, etc.
   - Verify user-friendly error message

4. **Large file rejection**
   - Try uploading file >10MB
   - Verify size error message

5. **Low confidence handling**
   - Upload a poorly formatted letter
   - Verify confidence indicators show amber/red
   - Verify low confidence warning banner appears

6. **Edit extracted data**
   - Upload and extract a letter
   - Edit patient name in review panel
   - Apply and verify edited name is used

7. **Clear section**
   - Upload and extract a letter
   - Clear the GP section
   - Apply and verify no GP is created

8. **Existing patient match**
   - Create a patient with Medicare 2345 67890 1
   - Upload referral for same Medicare number
   - Verify existing patient is matched, not duplicated

### Verification Checklist

- [ ] Upload zone accepts drag-and-drop
- [ ] Upload zone accepts file picker
- [ ] Progress indicator shows during upload
- [ ] "Reading document..." shown during text extraction
- [ ] "Extracting details..." shown during AI extraction
- [ ] Review panel displays all extracted fields
- [ ] Confidence indicators show correct colors
- [ ] Fields are editable
- [ ] Clear/Restore buttons work
- [ ] Apply creates patient record
- [ ] Apply creates referrer record
- [ ] Consultation form is populated after apply
- [ ] Error states show manual entry fallback
- [ ] Retry button works on failure

---

*Last updated: 2025-12-23*
*Version: 1.0.0*
