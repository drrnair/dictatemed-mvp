# Per-Clinician Style Learning Implementation Plan

## Configuration
- **Artifacts Path**: `.zenflow/tasks/implement-per-clinician-style-le-5a07`
- **Technical Specification**: `spec.md`
- **Difficulty**: HARD

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

**Completed**: Full technical specification created in `spec.md` covering:
- Data model changes (3 new tables, 2 modified)
- API endpoints (8 new, 3 modified)
- Learning pipeline architecture
- UI/UX changes
- Testing strategy
- Migration plan

---

### [x] Step 1: Database Schema & Migration
<!-- chat-id: 7acd19cb-1247-4aaa-a587-545cd3c13d19 -->

Create the database schema changes for per-subspecialty style profiles.

**Tasks:**
1. Add `StyleProfile` model to Prisma schema
2. Add `StyleSeedLetter` model for bootstrapping
3. Add `StyleAnalyticsAggregate` model for internal analytics
4. Add `subspecialty` field to `StyleEdit` and `Letter` models
5. Add relations to `User` model
6. Generate and run Prisma migration
7. Verify migration success with `npm run db:push`

**Files:**
- `prisma/schema.prisma` (modify)

**Verification:**
```bash
npm run db:push
npm run typecheck
```

**Completed:** All schema changes implemented:
- Added `StyleProfile` model with section/phrasing/verbosity preferences
- Added `StyleSeedLetter` model for bootstrapping profiles from sample letters
- Added `StyleAnalyticsAggregate` model for de-identified internal analytics
- Added `subspecialty` field to both `StyleEdit` and `Letter` models
- Added `styleProfiles` and `styleSeedLetters` relations to `User` model
- Prisma client generated successfully
- TypeScript compilation passes

---

### [x] Step 2: Type Definitions & Domain Types
<!-- chat-id: 7e0673b2-7d42-4c56-90fb-6652cbfa6a7f -->

Define TypeScript types for the new subspecialty style system.

**Tasks:**
1. Create `SubspecialtyStyleProfile` interface
2. Create `StyleSeedLetter` interface
3. Create `SectionDiff` and related diff types
4. Create `StyleConditioningConfig` type
5. Export all types from style domain

**Files:**
- `src/domains/style/subspecialty-profile.types.ts` (new)
- `src/domains/style/index.ts` (modify - add exports)

**Verification:**
```bash
npm run typecheck
```

**Completed:** All type definitions implemented in `subspecialty-profile.types.ts`:
- Primitive types: `VerbosityLevel`, `FormalityLevel`, `StyleCategory`, `ParagraphStructure`, `TerminologyLevel`, `LetterSectionType`
- Map types: `SectionInclusionMap`, `SectionVerbosityMap`, `SectionPhrasingMap`, `VocabularyMap`
- Profile types: `SubspecialtyStyleProfile`, `SubspecialtyConfidenceScores`, `CreateSubspecialtyProfileInput`, `UpdateSubspecialtyProfileInput`
- Seed letter types: `StyleSeedLetter`, `CreateSeedLetterInput`
- Diff analysis types: `ParsedSection`, `SectionChange`, `SectionDiff`, `LetterDiffAnalysis`, `AnalyzeDiffInput`
- Learning pipeline types: `PhrasePattern`, `SectionOrderPattern`, `SubspecialtyStyleAnalysisResult`, `AnalyzeStyleInput`, `RecordSubspecialtyEditsInput`
- Generation conditioning types: `StyleConditioningConfig`, `SubspecialtyStyleHints`, `BuildConditionedPromptInput`
- Analytics types: `StyleAnalyticsAggregate`, `AggregatedPattern`, `AggregatedPhrasePattern`, `AggregateAnalyticsInput`
- API types: `ListProfilesResponse`, `ProfileOperationResponse`, `AdjustLearningStrengthInput`, `SeedLetterUploadResponse`
- All types exported from `index.ts`
- TypeScript and ESLint checks pass

---

### [x] Step 3: Section-Level Diff Analyzer
<!-- chat-id: 410cfaa6-fcdf-4e6c-a3a3-cdbb2f38c12d -->

Implement the section-level diff analysis for precise style learning.

**Tasks:**
1. Create section parser to identify letter sections
2. Implement section alignment algorithm
3. Build detailed diff computation for aligned sections
4. Add phrase extraction utilities
5. Write unit tests

**Files:**
- `src/domains/style/diff-analyzer.ts` (new)
- `tests/unit/domains/style/diff-analyzer.test.ts` (new)

**Verification:**
```bash
npm run test -- diff-analyzer
```

**Completed:** Full section-level diff analyzer implemented in `diff-analyzer.ts`:
- **Section Detection**: `detectSectionType()` with patterns for 15+ medical letter sections (greeting, history, medications, examination, investigations, impression, plan, signoff, etc.)
- **Section Parsing**: `parseLetterSections()` parses complete letters into structured sections with header detection
- **Section Alignment**: `alignSections()` aligns sections between draft and final letters by type for comparison
- **Diff Computation**: `findDetailedChanges()` and `computeSectionDiff()` compute sentence-level changes with char/word deltas
- **Complete Analysis**: `analyzeDiff()` main entry point returns full `LetterDiffAnalysis` with overall statistics
- **Phrase Extraction**: `extractAddedPhrases()`, `extractRemovedPhrases()`, `extractVocabularySubstitutions()` for learning pipeline
- **Text Similarity**: `textSimilarity()` using LCS for fuzzy matching
- 41 unit tests covering all functions, edge cases (empty letters, special characters, long content)
- All functions exported from `index.ts`
- TypeScript and ESLint checks pass

---

### [ ] Step 4: Subspecialty Profile Service

Implement CRUD operations for per-subspecialty style profiles.

**Tasks:**
1. Implement `createStyleProfile()`
2. Implement `getStyleProfile(userId, subspecialty)`
3. Implement `listStyleProfiles(userId)`
4. Implement `updateStyleProfile()`
5. Implement `deleteStyleProfile()` (reset to defaults)
6. Implement `adjustLearningStrength()`
7. Add caching for frequently accessed profiles
8. Write unit tests

**Files:**
- `src/domains/style/subspecialty-profile.service.ts` (new)
- `tests/unit/domains/style/subspecialty-profile.service.test.ts` (new)

**Verification:**
```bash
npm run test -- subspecialty-profile
```

---

### [ ] Step 5: Learning Pipeline Service

Implement the background learning pipeline that updates profiles from edits.

**Tasks:**
1. Create `recordSubspecialtyEdits()` for edit recording
2. Create `queueStyleAnalysis()` for async analysis triggering
3. Implement `runStyleAnalysis()` using Claude
4. Implement `mergeProfileAnalysis()` for weighted merging
5. Implement `applyLearningStrength()` modifier
6. Add threshold checks for analysis triggering
7. Write unit tests

**Files:**
- `src/domains/style/learning-pipeline.ts` (new)
- `tests/unit/domains/style/learning-pipeline.test.ts` (new)

**Verification:**
```bash
npm run test -- learning-pipeline
```

---

### [ ] Step 6: Prompt Conditioner

Implement style-to-prompt transformation for generation-time conditioning.

**Tasks:**
1. Create `buildStyleConditionedPrompt()`
2. Implement section order instructions
3. Implement verbosity level instructions
4. Implement phrase preference instructions
5. Implement sign-off template injection
6. Add graceful fallback chain (subspecialty → global → default)
7. Write unit tests

**Files:**
- `src/domains/style/prompt-conditioner.ts` (new)
- `tests/unit/domains/style/prompt-conditioner.test.ts` (new)

**Verification:**
```bash
npm run test -- prompt-conditioner
```

---

### [ ] Step 7: Integrate Learning with Letter Approval

Wire the learning pipeline into the letter approval workflow.

**Tasks:**
1. Modify `approveLetter()` to call `recordSubspecialtyEdits()`
2. Add subspecialty inference from letter/template context
3. Add threshold check for triggering analysis
4. Update audit logging to include subspecialty
5. Update existing style recording integration

**Files:**
- `src/domains/letters/approval.service.ts` (modify)
- `src/domains/style/style.service.ts` (modify)

**Verification:**
```bash
npm run test
npm run typecheck
```

---

### [ ] Step 8: Integrate Conditioning with Letter Generation

Wire the prompt conditioner into letter generation.

**Tasks:**
1. Modify `generateLetter()` to retrieve subspecialty profile
2. Replace existing `applyStyleHints()` with new conditioner
3. Add subspecialty to letter record
4. Update style confidence calculation
5. Test fallback behavior

**Files:**
- `src/domains/letters/letter.service.ts` (modify)

**Verification:**
```bash
npm run test
npm run typecheck
```

---

### [ ] Step 9: API Endpoints - Profile Management

Create REST API endpoints for style profile management.

**Tasks:**
1. `POST /api/style/profiles` - Create/update profile
2. `GET /api/style/profiles` - List profiles
3. `GET /api/style/profiles/:subspecialty` - Get specific profile
4. `DELETE /api/style/profiles/:subspecialty` - Reset profile
5. `PATCH /api/style/profiles/:subspecialty/strength` - Adjust strength
6. `POST /api/style/profiles/:subspecialty/analyze` - Manual analysis
7. Add input validation with Zod

**Files:**
- `src/app/api/style/profiles/route.ts` (new)
- `src/app/api/style/profiles/[subspecialty]/route.ts` (new)
- `src/app/api/style/profiles/[subspecialty]/strength/route.ts` (new)
- `src/app/api/style/profiles/[subspecialty]/analyze/route.ts` (new)

**Verification:**
```bash
npm run typecheck
npm run lint
```

---

### [ ] Step 10: API Endpoints - Seed Letters

Create REST API endpoints for seed letter management.

**Tasks:**
1. `POST /api/style/seed` - Upload seed letters
2. `GET /api/style/seed` - List seed letters
3. `DELETE /api/style/seed/:id` - Remove seed letter
4. Integrate with `analyzeHistoricalLetters()` for subspecialty

**Files:**
- `src/app/api/style/seed/route.ts` (new)
- `src/app/api/style/seed/[id]/route.ts` (new)

**Verification:**
```bash
npm run typecheck
npm run lint
```

---

### [ ] Step 11: Update Existing API Endpoints

Update existing endpoints to be subspecialty-aware.

**Tasks:**
1. Update `POST /api/letters` to accept subspecialty
2. Update `POST /api/style/analyze` to accept subspecialty
3. Update `GET /api/style/analyze` to return profiles summary
4. Update `POST /api/style/upload` to accept subspecialty

**Files:**
- `src/app/api/letters/route.ts` (modify)
- `src/app/api/style/analyze/route.ts` (modify)
- `src/app/api/style/upload/route.ts` (modify)

**Verification:**
```bash
npm run typecheck
npm run lint
```

---

### [ ] Step 12: Frontend - Subspecialty Style Components

Create React components for the subspecialty style UI.

**Tasks:**
1. Create `SubspecialtyStyleCard` component
2. Create `LearningStrengthSlider` component
3. Create `SeedLetterUpload` component (subspecialty-scoped)
4. Create `StyleModeSelector` (global vs. subspecialty)
5. Add API hooks for profile management

**Files:**
- `src/app/(dashboard)/settings/style/components/SubspecialtyStyleCard.tsx` (new)
- `src/app/(dashboard)/settings/style/components/LearningStrengthSlider.tsx` (new)
- `src/app/(dashboard)/settings/style/components/SeedLetterUpload.tsx` (new)
- `src/app/(dashboard)/settings/style/components/StyleModeSelector.tsx` (new)
- `src/hooks/useStyleProfiles.ts` (new)

**Verification:**
```bash
npm run typecheck
npm run lint
```

---

### [ ] Step 13: Frontend - Settings Page Integration

Integrate new components into the settings style page.

**Tasks:**
1. Add subspecialty profile listing
2. Add per-subspecialty profile cards
3. Add seed letter management UI
4. Add learning strength controls
5. Add reset confirmation dialogs
6. Wire up to new API endpoints

**Files:**
- `src/app/(dashboard)/settings/style/page.tsx` (modify)

**Verification:**
```bash
npm run typecheck
npm run lint
```

---

### [ ] Step 14: Analytics Aggregator (Internal)

Implement the de-identified analytics aggregation pipeline.

**Tasks:**
1. Create `aggregateStyleAnalytics()` function
2. Implement PHI stripping utilities
3. Implement pattern extraction (common additions, deletions, phrases)
4. Create admin endpoint `GET /api/admin/style-analytics`
5. Add role-based access control

**Files:**
- `src/domains/style/analytics-aggregator.ts` (new)
- `src/app/api/admin/style-analytics/route.ts` (new)

**Verification:**
```bash
npm run typecheck
npm run lint
```

---

### [ ] Step 15: Integration Tests

Write integration tests for the complete learning flow.

**Tasks:**
1. Test: Draft → Edit → Approve → Profile Update
2. Test: Profile exists → Generation uses style
3. Test: Fallback chain (subspecialty → global → default)
4. Test: Reset profile behavior
5. Test: Learning strength adjustment

**Files:**
- `tests/integration/style/learning-flow.test.ts` (new)
- `tests/integration/style/generation-conditioning.test.ts` (new)

**Verification:**
```bash
npm run test:integration
```

---

### [ ] Step 16: E2E Tests

Write end-to-end tests for the UI workflows.

**Tasks:**
1. Test: Settings UI - view profiles
2. Test: Settings UI - adjust learning strength
3. Test: Settings UI - reset profile
4. Test: Settings UI - upload seed letters
5. Test: Letter generation with profile applied

**Files:**
- `tests/e2e/flows/style-profiles.spec.ts` (new)

**Verification:**
```bash
npm run test:e2e
```

---

### [ ] Step 17: Documentation

Update technical documentation.

**Tasks:**
1. Update TECH_NOTES.md with schema documentation
2. Document API endpoints
3. Document PHI handling in analytics
4. Add compliance notes
5. Create DESIGN_NOTES.md for architecture decisions

**Files:**
- `docs/TECH_NOTES.md` (create or modify)
- `docs/DESIGN_NOTES.md` (create)

**Verification:**
Manual review

---

### [ ] Step 18: Final Verification & Cleanup

Run full verification suite and clean up.

**Tasks:**
1. Run full test suite
2. Run linting and type checking
3. Review all changes
4. Test with synthetic clinicians
5. Write implementation report

**Verification:**
```bash
npm run lint
npm run typecheck
npm run test
npm run test:e2e
npm run verify:full
```

**Report:** Write to `{@artifacts_path}/report.md`

---

## Summary

| Phase | Steps | Description |
|-------|-------|-------------|
| Foundation | 1-2 | Database schema, type definitions |
| Core Logic | 3-6 | Diff analyzer, profile service, learning pipeline, prompt conditioner |
| Integration | 7-8 | Wire into approval and generation flows |
| API Layer | 9-11 | REST endpoints for all operations |
| Frontend | 12-13 | UI components and page integration |
| Analytics | 14 | Internal aggregation pipeline |
| Testing | 15-16 | Integration and E2E tests |
| Finalization | 17-18 | Documentation and verification |
