# Technical Specification: Per-Clinician Style Learning for Letters

## Executive Summary

This task implements per-clinician, per-subspecialty style learning for DictateMED letters. The system learns from differences between AI-generated drafts and final signed letters, builds subspecialty-scoped style profiles, and uses these profiles to condition future letter generation.

**Difficulty Assessment: HARD**
- Complex data model changes with new tables and relationships
- Multi-stage learning pipeline with background processing
- LLM prompt engineering for style-conditioned generation
- UI/UX changes across multiple views
- Privacy and compliance considerations
- Analytics pipeline for internal insights

---

## Technical Context

### Stack
- **Frontend**: React 18, Next.js 14 (App Router), TypeScript, Tailwind CSS, Radix UI
- **Backend**: Node.js/TypeScript via Next.js API routes
- **Database**: PostgreSQL with Prisma ORM (v5.10.0)
- **LLM**: AWS Bedrock (Claude Opus/Sonnet)
- **Auth**: Auth0
- **Testing**: Vitest (unit), Playwright (E2E)

### Existing Infrastructure
The codebase already has a basic style learning system:
- `StyleEdit` model for recording individual edits
- `User.styleProfile` JSON field for storing learned preferences
- `analyzeEditsForStyle()` for Claude-powered style detection
- `applyStyleHints()` for injecting style guidance into prompts
- Settings page for viewing/managing style profiles

**Key Limitation**: Current system is **clinician-global**, not subspecialty-specific. A cardiologist who does both interventional and electrophysiology work gets a single blended profile, which may not reflect their distinct writing styles for each subspecialty.

---

## Implementation Approach

### Core Design Decisions

1. **New `StyleProfile` Table**: Move from JSON field on User to a dedicated table keyed by `(clinician_id, subspecialty_id)`. This enables:
   - Per-subspecialty style isolation
   - Efficient querying without JSON parsing
   - Independent confidence/strength values per subspecialty
   - Cleaner audit trail

2. **Learning Pipeline Architecture**:
   - **Synchronous**: Record edits immediately on letter approval
   - **Asynchronous**: Batch analysis via background job (triggered after N edits or time threshold)
   - This approach keeps the approval flow fast while allowing thorough analysis

3. **Section-Level Diff Analysis**: Enhance existing diff computation to operate at section granularity (History, Exam, Impression, Plan, etc.) for more precise learning.

4. **Graceful Degradation**: If no subspecialty profile exists, fall back to:
   1. Clinician's global profile (if exists)
   2. Subspecialty defaults (if defined)
   3. No style conditioning (neutral behavior)

5. **Learning Strength Control**: Expose a `learningStrength` parameter (0.0-1.0) that allows clinicians to "tone down" style adaptation. At 0.0, profiles have no effect; at 1.0, full style conditioning applies.

---

## Data Model Changes

### New Tables

```prisma
// Per-clinician, per-subspecialty style profile
model StyleProfile {
  id              String       @id @default(uuid())
  userId          String
  user            User         @relation(fields: [userId], references: [id], onDelete: Cascade)
  subspecialty    Subspecialty

  // Section preferences
  sectionOrder          String[]    // e.g., ["History", "Examination", "Impression", "Plan"]
  sectionInclusion      Json        @default("{}") // { "Medications": 0.9, "FamilyHistory": 0.3 }
  sectionVerbosity      Json        @default("{}") // { "History": "detailed", "Plan": "brief" }

  // Phrasing preferences
  phrasingPreferences   Json        @default("{}") // Common phrases per section
  avoidedPhrases        Json        @default("{}") // Phrases consistently deleted
  vocabularyMap         Json        @default("{}") // { "utilize": "use" }
  terminologyLevel      String?     // "specialist" | "lay" | "mixed"

  // Global style indicators
  greetingStyle         String?     // "formal" | "casual" | "mixed"
  closingStyle          String?     // "formal" | "casual" | "mixed"
  signoffTemplate       String?     // Preferred sign-off text
  formalityLevel        String?     // "very-formal" | "formal" | "neutral" | "casual"
  paragraphStructure    String?     // "long" | "short" | "mixed"

  // Confidence & metadata
  confidence            Json        @default("{}") // Per-preference confidence scores
  learningStrength      Float       @default(1.0)  // 0.0 = disabled, 1.0 = full effect
  totalEditsAnalyzed    Int         @default(0)
  lastAnalyzedAt        DateTime?

  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  @@unique([userId, subspecialty])
  @@index([userId])
  @@map("style_profiles")
}

// Seed letters for bootstrapping style profiles
model StyleSeedLetter {
  id              String       @id @default(uuid())
  userId          String
  user            User         @relation(fields: [userId], references: [id], onDelete: Cascade)
  subspecialty    Subspecialty

  letterText      String       @db.Text
  analyzedAt      DateTime?

  createdAt DateTime @default(now())

  @@index([userId, subspecialty])
  @@map("style_seed_letters")
}

// Internal aggregated analytics (de-identified)
model StyleAnalyticsAggregate {
  id              String       @id @default(uuid())
  subspecialty    Subspecialty
  period          String       // e.g., "2024-W01" (weekly)

  // Aggregated patterns (no PHI, no clinician IDs)
  commonAdditions       Json    // Frequently added sections/phrases
  commonDeletions       Json    // Frequently deleted content
  sectionOrderPatterns  Json    // Common section arrangements
  phrasingPatterns      Json    // High-frequency phrase patterns
  sampleSize            Int     // Number of letters contributing

  createdAt DateTime @default(now())

  @@unique([subspecialty, period])
  @@map("style_analytics_aggregates")
}
```

### Schema Modifications

```prisma
// Update StyleEdit to include subspecialty context
model StyleEdit {
  // ... existing fields ...
  subspecialty    Subspecialty?  // NEW: subspecialty context for the edit
}

// Update User to add relation
model User {
  // ... existing fields ...
  styleProfiles      StyleProfile[]      // NEW
  styleSeedLetters   StyleSeedLetter[]   // NEW
}

// Update Letter to track subspecialty
model Letter {
  // ... existing fields ...
  subspecialty    Subspecialty?  // NEW: inferred or explicit subspecialty
}
```

---

## API Changes

### New Endpoints

```typescript
// 1. Style Profile Management
POST   /api/style/profiles                    // Create/update profile for subspecialty
GET    /api/style/profiles                    // List all profiles for current user
GET    /api/style/profiles/:subspecialty      // Get specific profile
DELETE /api/style/profiles/:subspecialty      // Reset profile to defaults

// 2. Seed Letter Management
POST   /api/style/seed                        // Upload seed letters for bootstrapping
GET    /api/style/seed                        // List seed letters
DELETE /api/style/seed/:id                    // Remove seed letter

// 3. Learning Controls
PATCH  /api/style/profiles/:subspecialty/strength  // Adjust learning strength
POST   /api/style/profiles/:subspecialty/analyze   // Trigger manual analysis

// 4. Internal Analytics (admin only)
GET    /api/admin/style-analytics             // Aggregated analytics report
```

### Modified Endpoints

```typescript
// Update existing endpoints to be subspecialty-aware
POST /api/letters                             // Include subspecialty in generation
POST /api/style/analyze                       // Accept subspecialty parameter
POST /api/style/upload                        // Accept subspecialty for historical letters
```

---

## Source Code Changes

### New Files

```
src/domains/style/
├── subspecialty-profile.service.ts   # Per-subspecialty profile CRUD
├── subspecialty-profile.types.ts     # New type definitions
├── learning-pipeline.ts              # Background learning job logic
├── diff-analyzer.ts                  # Section-level diff computation
├── prompt-conditioner.ts             # Style-to-prompt transformation
└── analytics-aggregator.ts           # De-identified analytics

src/app/api/style/
├── profiles/
│   ├── route.ts                      # List/create profiles
│   └── [subspecialty]/
│       ├── route.ts                  # Get/delete specific profile
│       ├── strength/route.ts         # Adjust learning strength
│       └── analyze/route.ts          # Manual analysis trigger
├── seed/
│   ├── route.ts                      # List/upload seed letters
│   └── [id]/route.ts                 # Delete seed letter
└── admin/
    └── style-analytics/route.ts      # Admin analytics endpoint

src/app/(dashboard)/settings/
└── style/
    ├── page.tsx                      # UPDATE: Add "My letter style" section
    └── components/
        ├── SubspecialtyStyleCard.tsx # Per-subspecialty profile display
        ├── SeedLetterUpload.tsx      # Seed letter management
        └── LearningStrengthSlider.tsx # Strength control

tests/unit/domains/style/
├── subspecialty-profile.service.test.ts
├── learning-pipeline.test.ts
├── diff-analyzer.test.ts
└── prompt-conditioner.test.ts
```

### Modified Files

```
prisma/schema.prisma                          # New models, enum updates
src/domains/style/style.service.ts            # Integrate subspecialty profiles
src/domains/style/style-analyzer.ts           # Section-aware analysis
src/domains/letters/letter.service.ts         # Subspecialty-aware generation
src/domains/letters/approval.service.ts       # Trigger learning on approval
src/domains/letters/prompts/generation.ts     # Enhanced style conditioning
src/app/api/letters/route.ts                  # Accept subspecialty param
src/app/api/style/analyze/route.ts            # Subspecialty-aware analysis
src/app/(dashboard)/settings/style/page.tsx   # Enhanced UI
```

---

## Detailed Design: Learning Pipeline

### 1. Edit Recording (On Letter Approval)

```typescript
// approval.service.ts - modified approveLetter()
async function approveLetter(input: ApprovalInput) {
  // ... existing approval logic ...

  // NEW: Record subspecialty-scoped edits
  const subspecialty = letter.subspecialty ?? inferSubspecialty(letter);

  if (subspecialty) {
    await recordSubspecialtyEdits({
      userId: input.userId,
      letterId: letter.id,
      subspecialty,
      draftContent: letter.contentDraft,
      finalContent: input.finalContent,
    });
  }

  // Check if analysis threshold reached
  const editCount = await getEditCountSinceLastAnalysis(input.userId, subspecialty);
  if (editCount >= ANALYSIS_THRESHOLD) {
    await queueStyleAnalysis(input.userId, subspecialty);
  }
}
```

### 2. Section-Level Diff Analysis

```typescript
// diff-analyzer.ts
interface SectionDiff {
  sectionType: string;
  changes: {
    type: 'addition' | 'deletion' | 'modification';
    original?: string;
    modified?: string;
    charDelta: number;
    wordDelta: number;
  }[];
}

function analyzeSectionDiffs(draft: string, final: string): SectionDiff[] {
  // 1. Parse both texts into sections
  const draftSections = parseSections(draft);
  const finalSections = parseSections(final);

  // 2. Align sections and compute diffs
  const aligned = alignSections(draftSections, finalSections);

  // 3. For each aligned pair, compute detailed diff
  return aligned.map(([draftSection, finalSection]) => ({
    sectionType: draftSection?.type ?? finalSection?.type ?? 'unknown',
    changes: computeChanges(draftSection?.content, finalSection?.content),
  }));
}
```

### 3. Profile Update Logic

```typescript
// learning-pipeline.ts
async function updateStyleProfile(
  userId: string,
  subspecialty: Subspecialty,
  analysis: StyleAnalysisResult
): Promise<StyleProfile> {
  const existing = await getStyleProfile(userId, subspecialty);

  if (!existing) {
    // Create new profile from analysis
    return createStyleProfile(userId, subspecialty, analysis);
  }

  // Merge with existing profile using weighted confidence
  const merged = mergeProfileAnalysis(existing, analysis);

  // Apply learning strength modifier
  const adjusted = applyLearningStrength(merged, existing.learningStrength);

  return updateProfile(userId, subspecialty, adjusted);
}
```

### 4. Generation-Time Conditioning

```typescript
// prompt-conditioner.ts
function buildStyleConditionedPrompt(
  basePrompt: string,
  profile: StyleProfile | null
): string {
  if (!profile || profile.learningStrength === 0) {
    return basePrompt;
  }

  const styleSection = buildStyleSection(profile);

  return `${basePrompt}

# PHYSICIAN STYLE PREFERENCES (Subspecialty: ${profile.subspecialty})

${styleSection}

Note: These preferences were learned from this physician's previous letters in ${profile.subspecialty}.
Apply them while maintaining clinical accuracy and safety.`;
}

function buildStyleSection(profile: StyleProfile): string {
  const parts: string[] = [];

  // Section order
  if (profile.sectionOrder?.length > 0) {
    parts.push(`## Section Order\nArrange the letter sections in this order: ${profile.sectionOrder.join(' → ')}`);
  }

  // Section verbosity
  const verbosity = profile.sectionVerbosity as Record<string, string>;
  if (Object.keys(verbosity).length > 0) {
    const verbosityLines = Object.entries(verbosity)
      .map(([section, level]) => `- ${section}: ${level}`)
      .join('\n');
    parts.push(`## Detail Level by Section\n${verbosityLines}`);
  }

  // Phrasing preferences
  const phrases = profile.phrasingPreferences as Record<string, string[]>;
  if (Object.keys(phrases).length > 0) {
    const phraseLines = Object.entries(phrases)
      .flatMap(([section, prefs]) => prefs.slice(0, 3).map(p => `- In ${section}: prefer "${p}"`))
      .join('\n');
    parts.push(`## Preferred Phrases\n${phraseLines}`);
  }

  // Avoided phrases
  const avoided = profile.avoidedPhrases as Record<string, string[]>;
  if (Object.keys(avoided).length > 0) {
    const avoidLines = Object.entries(avoided)
      .flatMap(([section, prefs]) => prefs.slice(0, 3).map(p => `- In ${section}: avoid "${p}"`))
      .join('\n');
    parts.push(`## Phrases to Avoid\n${avoidLines}`);
  }

  // Sign-off
  if (profile.signoffTemplate) {
    parts.push(`## Sign-off\nUse this closing: "${profile.signoffTemplate}"`);
  }

  return parts.join('\n\n');
}
```

---

## UI Changes

### Settings → Style Page Enhancements

The existing style settings page will be extended with:

1. **Subspecialty Selector**: Show which subspecialties the clinician has registered, with profile status for each.

2. **Per-Subspecialty Cards**: For each active subspecialty:
   - Profile overview (edits analyzed, last updated, confidence)
   - Key learned preferences
   - Learning strength slider
   - "Reset to defaults" action

3. **Seed Letter Upload**: Subspecialty-scoped file upload for bootstrapping.

4. **Global vs. Subspecialty Toggle**: Option to use a single global profile or per-subspecialty profiles.

```tsx
// page.tsx structure
export default function StyleSettingsPage() {
  return (
    <div>
      <PageHeader title="My Letter Style" />

      {/* Mode selector */}
      <StyleModeSelector mode={mode} onModeChange={setMode} />

      {mode === 'subspecialty' ? (
        <>
          {/* Per-subspecialty profiles */}
          {subspecialties.map(sub => (
            <SubspecialtyStyleCard
              key={sub}
              subspecialty={sub}
              profile={profiles[sub]}
              onReset={handleReset}
              onStrengthChange={handleStrengthChange}
            />
          ))}

          {/* Add subspecialty */}
          <AddSubspecialtyButton onClick={handleAddSubspecialty} />
        </>
      ) : (
        /* Global profile (existing UI) */
        <GlobalStyleProfile profile={globalProfile} />
      )}

      {/* Seed letters section */}
      <SeedLetterSection subspecialty={selectedSubspecialty} />
    </div>
  );
}
```

---

## Analytics Pipeline

### Aggregation Job (Runs Weekly)

```typescript
// analytics-aggregator.ts
async function aggregateStyleAnalytics(period: string): Promise<void> {
  for (const subspecialty of Object.values(Subspecialty)) {
    // Fetch all style edits for this subspecialty in the period
    const edits = await prisma.styleEdit.findMany({
      where: {
        subspecialty,
        createdAt: { gte: periodStart, lt: periodEnd },
      },
      select: {
        // Only select non-identifying fields
        editType: true,
        sectionType: true,
        beforeText: true,
        afterText: true,
        characterChanges: true,
        wordChanges: true,
      },
    });

    if (edits.length < MIN_SAMPLE_SIZE) continue;

    // Compute aggregated patterns (no PHI)
    const patterns = computePatterns(edits);

    // Store aggregate
    await prisma.styleAnalyticsAggregate.upsert({
      where: { subspecialty_period: { subspecialty, period } },
      create: { subspecialty, period, ...patterns, sampleSize: edits.length },
      update: { ...patterns, sampleSize: edits.length },
    });
  }
}

function computePatterns(edits: StyleEdit[]): AggregatedPatterns {
  return {
    commonAdditions: extractCommonAdditions(edits),
    commonDeletions: extractCommonDeletions(edits),
    sectionOrderPatterns: extractSectionOrders(edits),
    phrasingPatterns: extractPhrasePatterns(edits),
  };
}
```

### PHI Stripping

All analytics processing:
1. Only uses edit content (before/after text), not patient data
2. Strips any detected PHI patterns (names, dates, IDs) before analysis
3. Aggregates across multiple clinicians (minimum 5)
4. Stores only statistical patterns, never raw text

---

## Testing Strategy

### Unit Tests

1. **diff-analyzer.test.ts**: Section parsing, alignment, diff computation
2. **learning-pipeline.test.ts**: Profile creation, merging, strength adjustment
3. **prompt-conditioner.test.ts**: Style-to-prompt transformation
4. **subspecialty-profile.service.test.ts**: CRUD operations, validation

### Integration Tests

1. **Learning flow**: Draft → Edit → Approve → Profile Update
2. **Generation flow**: Profile exists → Letter uses style → Output matches expectations
3. **Fallback chain**: Missing profile → Global → Defaults → No conditioning

### E2E Tests

1. **Settings UI**: Create profile, adjust strength, reset
2. **Seed letter upload**: Upload → Analyze → Profile created
3. **Letter generation**: Generate with profile → Edit → Approve → Next letter improved

---

## Migration Plan

### Phase 1: Database Migration
1. Create new tables (`StyleProfile`, `StyleSeedLetter`, `StyleAnalyticsAggregate`)
2. Add `subspecialty` field to `StyleEdit`, `Letter`
3. No data migration needed - new system starts fresh

### Phase 2: Feature Rollout
1. Deploy backend services with feature flag (`ENABLE_SUBSPECIALTY_STYLES=false`)
2. Enable for internal testing users
3. Gradual rollout to all users

### Phase 3: Cleanup
1. Deprecate global `User.styleProfile` field (keep for backward compatibility)
2. Remove feature flag after validation

---

## Verification Approach

### Automated
```bash
npm run lint                     # ESLint + Prettier
npm run typecheck                # TypeScript
npm run test                     # Unit tests
npm run test:integration         # Integration tests
npm run test:e2e                 # Playwright E2E
```

### Manual QA
1. Create 2-3 test clinicians with different subspecialties
2. Generate and edit multiple letters per clinician per subspecialty
3. Verify:
   - Drafts become closer to clinician's style over time
   - Different subspecialties maintain distinct styles
   - Reset/tone-down controls work correctly
   - No performance degradation for clinicians without profiles

---

## Security & Compliance

### Data Handling
- Draft and final letter content stored in existing `Letter` table (already PHI-protected)
- Style profiles contain no PHI (only structural preferences)
- Analytics are de-identified and aggregated

### Access Control
- Style profiles owned by clinician, not accessible to others
- Admin analytics endpoint requires admin role
- Audit logging for all profile modifications

### Documentation
- Update TECH_NOTES.md with schema and service documentation
- Document PHI handling in analytics pipeline
- Add compliance notes for data retention

---

## Risks & Mitigations

| Risk | Impact | Mitigation |
|------|--------|------------|
| Profile overfitting | Letters become too rigid | Learning strength control, confidence thresholds |
| Cold start problem | Poor initial experience | Seed letter feature, graceful fallback |
| Performance overhead | Slow letter generation | Profile caching, async analysis |
| Complexity creep | Hard to maintain | Clear domain boundaries, comprehensive tests |

---

## Open Questions

1. **Learning threshold**: How many edits before running analysis? (Proposed: 5 initial, then every 10)
2. **Profile expiry**: Should old profiles decay over time? (Proposed: No, but surface "last updated" in UI)
3. **Subspecialty inference**: If letter doesn't have explicit subspecialty, how to infer? (Proposed: From template or consultation context)

---

## Deliverables Summary

1. **Database migrations** for 3 new tables + 2 modified tables
2. **Backend services**: Subspecialty profile CRUD, learning pipeline, analytics aggregator
3. **API endpoints**: 8 new, 3 modified
4. **Frontend**: Enhanced settings page with subspecialty profiles
5. **Tests**: Unit, integration, E2E
6. **Documentation**: TECH_NOTES.md update
