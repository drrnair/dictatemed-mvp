# Low-Friction Specialty Onboarding Implementation Plan

## Configuration
- **Artifacts Path**: `.zenflow/tasks/implement-low-friction-specialty-9acd`
- **Spec Document**: `spec.md`

---

## Complexity Assessment

**Difficulty: HARD**

This task involves:
- 6 new database tables with relationships
- Data migration for existing users
- Complex type-ahead UI components
- 25+ specialties with subspecialties to seed
- Role system addition
- Multi-specialty support per user

---

## Workflow Steps

### [x] Step: Technical Specification
<!-- chat-id: 63df4b38-e8e4-46f1-bc22-e80bd5528632 -->

Created comprehensive technical specification in `spec.md` covering:
- Data model changes (6 new tables)
- Seed data strategy (25+ specialties, subspecialties for priority areas)
- API design (5 new endpoints)
- UI components (4 new components)
- Migration strategy (3 phases)
- Backwards compatibility approach

---

### [x] Step 1: Database Schema & Migration
<!-- chat-id: 4b48b2b0-570e-45ad-b49f-de7386c30bb3 -->

**Goal**: Add new tables for medical specialties taxonomy and custom entries.

**Tasks**:
1. Add new enums to `prisma/schema.prisma`:
   - `ClinicianRole` (MEDICAL, NURSING, ALLIED_HEALTH)
   - `CustomRequestStatus` (PENDING, APPROVED, REJECTED)

2. Add new models to `prisma/schema.prisma`:
   - `MedicalSpecialty`
   - `MedicalSubspecialty`
   - `ClinicianSpecialty`
   - `ClinicianSubspecialty`
   - `CustomSpecialty`
   - `CustomSubspecialty`

3. Update `User` model:
   - Add `clinicianRole` field with default MEDICAL
   - Add relations to new tables

4. Generate and apply migration:
   ```bash
   npx prisma migrate dev --name add_medical_specialty_tables
   ```

**Verification**:
- `npx prisma validate` passes
- Migration applies cleanly to dev database
- `npm run typecheck` passes

**Completed**:
- Added `ClinicianRole` enum (MEDICAL, NURSING, ALLIED_HEALTH)
- Added `CustomRequestStatus` enum (PENDING, APPROVED, REJECTED)
- Added `MedicalSpecialty` model with name, slug, description, synonyms, active fields
- Added `MedicalSubspecialty` model linked to specialty with name, slug, description, active fields
- Added `ClinicianSpecialty` junction table (User <-> MedicalSpecialty)
- Added `ClinicianSubspecialty` junction table (User <-> MedicalSubspecialty)
- Added `CustomSpecialty` model for user-submitted custom specialties (pending admin review)
- Added `CustomSubspecialty` model for user-submitted custom subspecialties
- Updated `User` model with `clinicianRole` field and relations to new tables
- Updated test mocks to include `clinicianRole` field
- Prisma schema validates successfully
- TypeScript typecheck passes

---

### [x] Step 2: Seed Data
<!-- chat-id: d0ec0442-00a0-4837-b3e3-0b98e02e0f46 -->

**Goal**: Populate medical specialties and subspecialties with curated data.

**Tasks**:
1. Create seed data file `prisma/seeds/medical-specialties.ts`:
   - Define 25+ specialties with names, slugs, descriptions, synonyms
   - Define subspecialties for priority areas (Cardiology, Cardiothoracic Surgery, Neurology, GP)

2. Update `prisma/seed.ts` to call the specialty seeder

3. Run seed:
   ```bash
   npx prisma db seed
   ```

**Verification**:
- Seed runs without errors
- Query database to verify specialty count
- Verify cardiology subspecialties match existing enum values

**Files**:
- `prisma/seeds/medical-specialties.ts` (create)
- `prisma/seed.ts` (modify)

**Completed**:
- Created `prisma/seeds/medical-specialties.ts` with:
  - 42 medical specialties (exceeds 25+ requirement)
  - 51 subspecialties across priority areas
  - Deterministic UUIDs for reproducible seeding
  - Synonyms for search matching (e.g., "GP", "cardiologist", "ENT")
  - Descriptions for all specialties
- Priority area subspecialty coverage:
  - General Practice: 8 subspecialties (Women's Health, Mental Health, Chronic Disease, Aged Care, etc.)
  - Cardiology: 8 subspecialties (Interventional, Electrophysiology, Heart Failure, Imaging, etc.)
  - Cardiothoracic Surgery: 5 subspecialties (Adult Cardiac, Thoracic, Congenital, etc.)
  - Neurology: 8 subspecialties (Stroke, Epilepsy, Movement Disorders, etc.)
  - Additional coverage: Orthopaedics (7), Psychiatry (5), O&G (4), GI (3), Respiratory (3)
- Created `LEGACY_SUBSPECIALTY_MAPPING` for migration of existing Subspecialty enum values
- Updated `prisma/seed.ts` to call `seedMedicalSpecialties()` function
- Updated `docs/TECH_NOTES.md` with:
  - Medical Specialty Taxonomy section
  - Seed data sources (ABMS, AHPRA, RACGP, RACP)
  - Legacy subspecialty mapping table
  - UUID scheme documentation
- TypeScript typecheck passes

---

### [x] Step 3: Specialty Domain Types & Service
<!-- chat-id: 7e67d038-e512-461b-844e-fbd935be991c -->

**Goal**: Create type definitions and business logic for specialty management.

**Tasks**:
1. Create `src/domains/specialties/specialty.types.ts`:
   - `SpecialtyOption`, `SubspecialtyOption` interfaces
   - `PracticeProfile` interface
   - `CreateCustomSpecialtyInput`, `CreateCustomSubspecialtyInput`

2. Create `src/domains/specialties/specialty.service.ts`:
   - `searchSpecialties(query: string, userId: string)` - search with synonyms
   - `getSpecialtyById(id: string)`
   - `getSubspecialtiesForSpecialty(specialtyId: string, userId: string)`
   - `createCustomSpecialty(userId: string, input: CreateCustomSpecialtyInput)`
   - `createCustomSubspecialty(userId: string, input: CreateCustomSubspecialtyInput)`
   - `getUserPracticeProfile(userId: string)`
   - `updateUserPracticeProfile(userId: string, profile: UpdatePracticeProfileInput)`

**Verification**:
- `npm run typecheck` passes
- Unit tests for service functions

**Files**:
- `src/domains/specialties/specialty.types.ts` (create)
- `src/domains/specialties/specialty.service.ts` (create)
- `src/domains/specialties/index.ts` (create)

**Completed**:
- Created `src/domains/specialties/specialty.types.ts` with:
  - `SpecialtyOption` and `CustomSpecialtyOption` interfaces for type-ahead display
  - `SubspecialtyOption` and `CustomSubspecialtyOption` interfaces
  - `AnySpecialtyOption` and `AnySubspecialtyOption` union types
  - `PracticeProfile` interface with selected specialties/subspecialties
  - `SelectedSpecialty` and `SelectedSubspecialty` for profile representation
  - Input types: `CreateCustomSpecialtyInput`, `CreateCustomSubspecialtyInput`, `UpdatePracticeProfileInput`
  - Query types: `SpecialtySearchOptions`, `SubspecialtySearchOptions`
  - Result types for all operations
- Created `src/domains/specialties/specialty.service.ts` with:
  - `searchSpecialties()` - search with synonym matching and relevance sorting
  - `getSpecialtyById()`, `getAllSpecialties()`, `getSpecialtyBySlug()`
  - `getSubspecialtiesForSpecialty()` - with optional query filtering
  - `getSubspecialtyById()`
  - `createCustomSpecialty()` - with duplicate detection
  - `createCustomSubspecialty()` - with validation and duplicate detection
  - `getUserPracticeProfile()` - builds complete profile with nested subspecialties
  - `updateUserPracticeProfile()` - transaction-based upsert
  - `hasCompletedPracticeProfile()` - for onboarding check
  - `getUserSpecialtyIds()`, `getUserSubspecialtyIds()` - for quick lookups
  - `getSuggestedSubspecialties()` - for UX hints
- Created `src/domains/specialties/index.ts` for public exports
- TypeScript typecheck passes

---

### [ ] Step 4: Specialty API Endpoints

**Goal**: Create REST API endpoints for specialty operations.

**Tasks**:
1. Create `src/app/api/specialties/route.ts`:
   - `GET /api/specialties?query=...` - search specialties

2. Create `src/app/api/specialties/[id]/subspecialties/route.ts`:
   - `GET /api/specialties/:id/subspecialties` - get subspecialties for specialty

3. Create `src/app/api/specialties/custom/route.ts`:
   - `POST /api/specialties/custom` - create custom specialty

4. Create `src/app/api/subspecialties/custom/route.ts`:
   - `POST /api/subspecialties/custom` - create custom subspecialty

5. Create `src/app/api/user/practice-profile/route.ts`:
   - `GET /api/user/practice-profile` - get user's practice profile
   - `PUT /api/user/practice-profile` - update user's practice profile

**Verification**:
- `npm run typecheck` passes
- Test endpoints via curl or Postman
- Input validation with Zod

**Files**:
- `src/app/api/specialties/route.ts` (create)
- `src/app/api/specialties/[id]/subspecialties/route.ts` (create)
- `src/app/api/specialties/custom/route.ts` (create)
- `src/app/api/subspecialties/custom/route.ts` (create)
- `src/app/api/user/practice-profile/route.ts` (create)

---

### [ ] Step 5: UI Components - Combobox & Chips

**Goal**: Build reusable type-ahead combobox and chip components.

**Tasks**:
1. Add cmdk dependency (or use custom combobox with Radix Popover):
   ```bash
   npm install cmdk
   ```

2. Create `src/components/specialty/SpecialtyChip.tsx`:
   - Display name with optional "(custom)" suffix
   - "x" button to remove
   - Props: name, isCustom, onRemove

3. Create `src/components/specialty/SpecialtyCombobox.tsx`:
   - Input with debounced search (150ms)
   - Dropdown with search results (max 7)
   - "Add '{text}' as custom" option when no matches
   - Selected items as chips below input
   - Keyboard navigation (Enter to select)
   - Props: value, onChange, placeholder

4. Create `src/components/specialty/SubspecialtyPanel.tsx`:
   - Collapsible panel for a specialty
   - Contains SubspecialtyCombobox for that specialty
   - Title: "Any particular areas in {specialty}?"
   - Props: specialty, selectedSubspecialties, onChange

**Verification**:
- Components render without errors
- Type-ahead works with keyboard
- Chips display and can be removed
- Storybook stories (optional) or manual testing

**Files**:
- `src/components/specialty/SpecialtyChip.tsx` (create)
- `src/components/specialty/SpecialtyCombobox.tsx` (create)
- `src/components/specialty/SubspecialtyPanel.tsx` (create)
- `src/components/specialty/index.ts` (create)

---

### [ ] Step 6: Practice Profile Form Component

**Goal**: Create the main form component combining role, specialties, and subspecialties.

**Tasks**:
1. Create `src/components/specialty/PracticeProfileForm.tsx`:
   - Section A: Intro text with reassurance
   - Section B: SpecialtyCombobox for primary specialties
   - Section C: SubspecialtyPanels for each selected specialty
   - Loading and error states
   - Save button with loading state
   - Props: initialProfile, onSave

2. Add helper hooks:
   - `useSpecialtySearch(query)` - debounced API search
   - `useSubspecialties(specialtyId)` - fetch subspecialties
   - `usePracticeProfile()` - fetch/update profile

**Verification**:
- Form renders with all sections
- Adding/removing specialties updates subspecialty panels
- Save submits to API
- Error handling works

**Files**:
- `src/components/specialty/PracticeProfileForm.tsx` (create)
- `src/hooks/useSpecialtySearch.ts` (create)
- `src/hooks/usePracticeProfile.ts` (create)

---

### [ ] Step 7: Onboarding Page Redesign

**Goal**: Replace existing onboarding page with new "About your practice" screen.

**Tasks**:
1. Update `src/app/(dashboard)/onboarding/page.tsx`:
   - Replace grid selection with PracticeProfileForm
   - Add intro section explaining personalization
   - Show role as "Medical" (pre-selected, not editable for now)
   - Handle "Skip for now" / "Finish" actions
   - Redirect to dashboard on complete

2. Update onboarding check logic:
   - Keep checking `onboardingCompleted` (derived from profile having been set)
   - Or add explicit `onboardingCompletedAt` field

**Verification**:
- New users see "About your practice" screen
- Can select specialties via type-ahead
- Can add custom specialties
- Can add subspecialties per specialty
- Completing saves profile and redirects
- Skipping works (generic profile)

**Files**:
- `src/app/(dashboard)/onboarding/page.tsx` (modify)

---

### [ ] Step 8: Settings Page Update

**Goal**: Update Settings → Subspecialties to "Your Specialties" with new UI.

**Tasks**:
1. Rename `src/app/(dashboard)/settings/subspecialties/page.tsx` to reflect specialties:
   - Update title to "Your Specialties"
   - Replace grid with PracticeProfileForm
   - Keep navigation and cancel/save pattern

2. Update settings navigation in `src/app/(dashboard)/settings/page.tsx`:
   - Change "Subspecialties" card to "Your Specialties"
   - Update description

**Verification**:
- Settings page shows "Your Specialties" section
- Editing specialties works
- Adding/removing subspecialties works
- Save persists changes

**Files**:
- `src/app/(dashboard)/settings/subspecialties/page.tsx` (modify)
- `src/app/(dashboard)/settings/page.tsx` (modify)

---

### [ ] Step 9: Data Migration for Existing Users

**Goal**: Migrate existing users with subspecialties to new model.

**Tasks**:
1. Create migration script `prisma/migrations/scripts/migrate-subspecialties.ts`:
   - For each user with `subspecialties` array:
     - Find or create "Cardiology" ClinicianSpecialty
     - Map old enum values to new MedicalSubspecialty IDs
     - Create ClinicianSubspecialty entries

2. Run migration on staging/production after deployment

**Verification**:
- Script runs without errors
- Existing users' profiles preserved
- New settings page shows correct specialties/subspecialties

**Files**:
- `prisma/migrations/scripts/migrate-subspecialties.ts` (create)

---

### [ ] Step 10: Unit & Integration Tests

**Goal**: Add comprehensive test coverage for new functionality.

**Tasks**:
1. Create `tests/unit/specialty.service.test.ts`:
   - Test searchSpecialties with various queries
   - Test custom specialty/subspecialty creation
   - Test practice profile operations

2. Create `tests/integration/specialty-onboarding.test.ts`:
   - Test full onboarding flow
   - Test settings edit flow
   - Test custom entry creation

3. Update existing tests if needed

**Verification**:
- `npm run test` passes
- Coverage for critical paths
- No regressions in existing tests

**Files**:
- `tests/unit/specialty.service.test.ts` (create)
- `tests/integration/specialty-onboarding.test.ts` (create)

---

### [ ] Step 11: Documentation & Cleanup

**Goal**: Document the implementation and clean up.

**Tasks**:
1. Update TECH_NOTES with:
   - Specialty data model explanation
   - Seed data sources (ABMS, AHPRA references)
   - Custom specialty workflow

2. Run final verification:
   ```bash
   npm run verify
   ```

3. Create implementation report in `report.md`

**Verification**:
- All lint/type checks pass
- Tests pass
- Manual testing of full flow

**Files**:
- `docs/TECH_NOTES.md` (update or create)
- `.zenflow/tasks/implement-low-friction-specialty-9acd/report.md` (create)
