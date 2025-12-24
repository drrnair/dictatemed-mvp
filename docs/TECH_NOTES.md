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

### Adding a New Subspecialty (Legacy Enum)

1. Add to `Subspecialty` enum in `prisma/schema.prisma`
2. Run `npx prisma generate`
3. Update `getAllSubspecialties()` in `useStyleProfiles.ts`
4. Add label in `formatSubspecialtyLabel()` if custom format needed

---

## Medical Specialty Taxonomy

### Overview

DictateMED uses a hierarchical specialty → subspecialty model for clinician onboarding and personalization. This replaces the flat `Subspecialty` enum for new functionality while maintaining backwards compatibility.

### Data Model

```
MedicalSpecialty (global, curated)
    ├── id, name, slug, description, synonyms[], active
    └── MedicalSubspecialty[] (child subspecialties)

MedicalSubspecialty (linked to specialty)
    └── id, specialtyId, name, slug, description, active

ClinicianSpecialty (user → specialty junction)
    └── userId, specialtyId

ClinicianSubspecialty (user → subspecialty junction)
    └── userId, subspecialtyId

CustomSpecialty (user-submitted, pending admin review)
    └── userId, name, region, notes, status

CustomSubspecialty (user-submitted, pending admin review)
    └── userId, specialtyId, name, description, status
```

### Seed Data Sources

The specialty taxonomy is seeded from recognized medical specialty boards:

| Source | Region | Description |
|--------|--------|-------------|
| **ABMS** | USA | American Board of Medical Specialties - 24 member boards |
| **AHPRA** | Australia | Australian Health Practitioner Regulation Agency |
| **RACGP** | Australia | Royal Australian College of General Practitioners |
| **RACP** | Australia | Royal Australasian College of Physicians |

**Seed File**: `prisma/seeds/medical-specialties.ts`

### Current Specialty Count

| Category | Count |
|----------|-------|
| Medical Specialties | 42 |
| Subspecialties (total) | 51 |

### Priority Areas (Deep Coverage)

These specialties have comprehensive subspecialty coverage:

| Specialty | Subspecialties |
|-----------|----------------|
| General Practice | 8 (Women's Health, Mental Health, Chronic Disease, etc.) |
| Cardiology | 8 (Interventional, Electrophysiology, Heart Failure, etc.) |
| Cardiothoracic Surgery | 5 (Adult Cardiac, Thoracic, Congenital, etc.) |
| Neurology | 8 (Stroke, Epilepsy, Movement Disorders, etc.) |
| Orthopaedic Surgery | 7 (Joint Replacement, Spine, Sports, etc.) |
| Psychiatry | 5 (Child & Adolescent, Addiction, Forensic, etc.) |
| Obstetrics & Gynaecology | 4 (MFM, Reproductive, Oncology, Urogynaecology) |

### Legacy Subspecialty Mapping

The old `Subspecialty` enum values map to the new model as follows:

| Legacy Enum | New Specialty | New Subspecialty |
|-------------|---------------|------------------|
| `GENERAL_CARDIOLOGY` | Cardiology | General Cardiology |
| `INTERVENTIONAL` | Cardiology | Interventional Cardiology |
| `STRUCTURAL` | Cardiology | Structural Heart |
| `ELECTROPHYSIOLOGY` | Cardiology | Electrophysiology |
| `IMAGING` | Cardiology | Cardiac Imaging |
| `HEART_FAILURE` | Cardiology | Heart Failure & Transplant |
| `CARDIAC_SURGERY` | Cardiothoracic Surgery | Adult Cardiac Surgery |

This mapping is defined in `prisma/seeds/medical-specialties.ts` as `LEGACY_SUBSPECIALTY_MAPPING`.

### Adding New Specialties

For curated global specialties:

1. Add to `SPECIALTIES` array in `prisma/seeds/medical-specialties.ts`
2. Assign a unique sequence number for the UUID
3. Include synonyms for search matching
4. Run `npx prisma db seed`

For subspecialties:

1. Add to `SUBSPECIALTIES` array in `prisma/seeds/medical-specialties.ts`
2. Reference the parent specialty ID
3. Run `npx prisma db seed`

### Data Migration for Existing Users

Existing users with legacy `subspecialties` array data can be migrated to the new model:

```bash
# Preview what would be migrated (no changes made)
npm run db:migrate:subspecialties:dry-run

# Run the actual migration
npm run db:migrate:subspecialties
```

**Migration Script**: `prisma/migrations/scripts/migrate-subspecialties.ts`

**What the migration does:**

1. Finds all users with non-empty `subspecialties[]` array
2. Maps each legacy enum value to new specialty + subspecialty IDs
3. Creates `ClinicianSpecialty` records (e.g., links user to Cardiology)
4. Creates `ClinicianSubspecialty` records (e.g., links user to Interventional Cardiology)
5. Sets `onboardingCompletedAt` for users who haven't completed new onboarding

**Idempotency**: The migration is safe to run multiple times. It:
- Skips users who already have the new records
- Uses transactions per user (all-or-nothing per user)
- Reports detailed progress and any errors

**Example output:**

```
============================================================
Legacy Subspecialty Migration (DRY RUN)
============================================================

Found 3 user(s) with legacy subspecialties.

Processing user: dr.smith@example.com
  Legacy subspecialties: INTERVENTIONAL, HEART_FAILURE
  ✅ Would create:
     - 1 specialty link(s)
     - 2 subspecialty link(s)
     - Marked onboarding as completed

...

============================================================
Migration Summary
============================================================
Total users with legacy subspecialties: 3
Users migrated: 3
Users skipped (already migrated or errors): 0
Specialty links to create: 3
Subspecialty links to create: 6
```

### Custom Specialty Workflow

Users can add custom specialties/subspecialties during onboarding:

1. User types a specialty not in the curated list
2. System shows "Add '{name}' as my specialty (custom)" option
3. Creates `CustomSpecialty` with `status = PENDING`
4. Immediately usable for that clinician
5. Queued for admin review (future feature)

### UUID Scheme

Seed data uses deterministic UUIDs for reproducibility:

```
Specialties:    00000000-0001-0001-{NNNN}-000000000000
Subspecialties: 00000000-0001-0002-{SSNN}-000000000000
                                   ^^-- specialty sequence
                                     ^^-- subspecialty sequence within specialty
```

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

*Last updated: 2025-12-22*
*Version: 1.0.0*
