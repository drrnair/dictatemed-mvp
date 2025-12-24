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

### [x] Step 4: Specialty API Endpoints
<!-- chat-id: a4925a4f-92ff-4c63-a214-c128f27f7b1f -->

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

**Completed**:
- Created `src/app/api/specialties/route.ts`:
  - `GET /api/specialties?query=...&limit=7&includeCustom=true` - search specialties with synonyms
  - Returns all specialties if no query provided
  - Input validation with Zod
- Created `src/app/api/specialties/[id]/subspecialties/route.ts`:
  - `GET /api/specialties/:id/subspecialties?query=...` - get subspecialties for specialty
  - Validates specialty exists before fetching subspecialties
  - Returns specialty info along with subspecialties
- Created `src/app/api/specialties/custom/route.ts`:
  - `POST /api/specialties/custom` - create custom specialty
  - Rate limited
  - Validates name (2-100 chars), optional region and notes
- Created `src/app/api/subspecialties/custom/route.ts`:
  - `POST /api/subspecialties/custom` - create custom subspecialty
  - Rate limited
  - Requires either specialtyId or customSpecialtyId
- Created `src/app/api/user/practice-profile/route.ts`:
  - `GET /api/user/practice-profile` - get user's complete practice profile
  - `PUT /api/user/practice-profile` - update clinician role and specialty selections
  - Rate limited for updates
- All endpoints follow existing patterns (session auth, rate limiting, Zod validation, logging)
- TypeScript typecheck passes

---

### [x] Step 5: UI Components - Combobox & Chips
<!-- chat-id: b9d85f39-5c32-42e1-b24c-543405b91116 -->

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

**Completed**:
- Created `src/components/specialty/SpecialtyChip.tsx`:
  - Displays name with optional "(custom)" suffix
  - Removable "x" button with keyboard accessibility
  - Size variants (sm, default) for different contexts
  - Custom vs standard styling differentiation
  - Disabled state support
- Created `src/components/specialty/SpecialtyCombobox.tsx`:
  - Type-ahead searchable multi-select with 150ms debounce
  - Dropdown with max 7 results plus "Add as custom" option
  - Full keyboard navigation (ArrowUp/Down, Enter, Escape)
  - Selected items as removable chips below input
  - Inline custom specialty creation without modal
  - Loading states for search and custom creation
  - ARIA attributes for accessibility (combobox, listbox roles)
  - Auto-focus support for onboarding flow
- Created `src/components/specialty/SubspecialtyPanel.tsx`:
  - Collapsible accordion panel using Radix Accordion
  - Titled "Any particular areas in {specialty}?"
  - Subspecialty combobox with type-ahead search
  - Optional "Popular choices" quick-select suggestions
  - Inline custom subspecialty creation
  - Selection count badge in panel header
  - Helper text for optional nature
- Created `src/components/specialty/index.ts` for public exports
- Used existing UI patterns (Radix Accordion, Input, Button, Badge styling)
- No cmdk dependency needed - custom implementation using existing patterns
- TypeScript typecheck passes
- ESLint passes

**Review Fixes Applied**:
- Created `src/app/api/specialties/custom/[id]/subspecialties/route.ts`:
  - API endpoint for fetching subspecialties for custom specialties
  - Validates custom specialty exists and belongs to user (403 for unauthorized access)
  - Uses `getSubspecialtiesForSpecialty` service with `customSpecialtyId`
- Removed unused `ChevronDown` import from SubspecialtyPanel.tsx
- Added `booleanString` helper to `src/lib/validation.ts` for proper query parameter parsing
- Updated all 3 subspecialty-related endpoints to use shared `booleanString` helper:
  - `src/app/api/specialties/route.ts`
  - `src/app/api/specialties/[id]/subspecialties/route.ts`
  - `src/app/api/specialties/custom/[id]/subspecialties/route.ts`
- `aria-labelledby` prop added to SpecialtyCombobox for accessibility

---

### [x] Step 6: Practice Profile Form Component
<!-- chat-id: a010008d-9789-4c5d-87fd-088c2495cac7 -->

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

**Completed**:
- Created `src/hooks/usePracticeProfile.ts`:
  - `usePracticeProfile()` - fetch and update user's practice profile
  - `saveProfile()` returns the updated `PracticeProfile` on success (not just boolean)
  - `createCustomSpecialty()` and `createCustomSubspecialty()` for inline custom entry creation
  - Helper functions: `profileToFormState()` and `formStateToSaveData()` for form data transformation
- Created `src/components/specialty/PracticeProfileForm.tsx`:
  - Section A: Intro with "About your practice" header and reassurance text
  - Section B: SpecialtyCombobox for primary specialty selection with `aria-labelledby` for accessibility
  - Section C: Dynamic SubspecialtyPanel components per selected specialty
  - Full change tracking to enable/disable save button appropriately
  - Loading, saving, and error states with clear user feedback
  - Mode support: 'onboarding' (with Skip) and 'settings' (with Cancel)
  - Mode-aware autoFocus: defaults to true for onboarding, false for settings
  - Proper cleanup of subspecialty state when specialties are removed
  - `onSave` callback receives the updated profile from the API (not stale state)
- Updated `src/components/specialty/SpecialtyCombobox.tsx`:
  - Added `aria-labelledby` prop for accessibility
- Updated `src/components/specialty/index.ts` with PracticeProfileForm exports
- Removed unused `src/hooks/useSpecialtySearch.ts` (search logic is inline in SpecialtyCombobox)
- Fixed test type issues in `tests/integration/specialties/onboarding-flow.test.ts`
- TypeScript typecheck passes
- ESLint passes with no warnings

---

### [x] Step 7: Onboarding Page Redesign
<!-- chat-id: abfdc0c0-840a-4b3c-8045-e6c565bff1ff -->

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

**Completed**:
- Replaced grid selection with `PracticeProfileForm` component
- Added welcome header with intro text explaining personalization
- Configured form in "onboarding" mode with "Get Started" and "Skip for now" buttons
- Added `onboardingCompletedAt` field to User model (nullable DateTime)
- Created migration `20251224_add_medical_specialty_tables/migration.sql` with all specialty tables and onboardingCompletedAt field
- Updated `auth.ts` to check `onboardingCompletedAt` OR legacy subspecialties for onboarding status
- Created `/api/user/onboarding/complete` endpoint to mark onboarding complete (for skip action)
- Updated `OnboardingRedirect` to allow `/settings/specialties` path
- Updated test mocks to include `onboardingCompletedAt` field
- TypeScript typecheck passes
- ESLint passes with no warnings

---

### [x] Step 8: Settings Page Update
<!-- chat-id: f0196d9a-7889-45e0-bb65-66fddbdf2185 -->

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

**Completed**:
- Updated `src/app/(dashboard)/settings/page.tsx`:
  - Changed "Subspecialties" link to "Your Specialties"
  - Updated icon from Heart to Stethoscope for better semantic match
  - Updated description to "Manage your medical specialties and subspecialties for tailored content"
  - Changed route from `/settings/subspecialties` to `/settings/specialties`
- Created new `src/app/(dashboard)/settings/specialties/page.tsx`:
  - Uses PracticeProfileForm component in "settings" mode
  - Header with back navigation to settings main page
  - Form auto-focuses disabled in settings mode (derived from mode prop)
  - Save redirects back to settings, Cancel also returns to settings
  - Added aria-label="Back to settings" on back link for accessibility
- Updated `src/components/specialty/PracticeProfileForm.tsx`:
  - Changed autoFocus default to be mode-aware (true for onboarding, false for settings)
  - Uses `shouldAutoFocus = autoFocus ?? mode === 'onboarding'` pattern
  - Made "change this later in Settings" hint only show in onboarding mode (contextually appropriate)
- Deleted orphaned `src/app/(dashboard)/settings/subspecialties/` directory (old page no longer needed)
- OnboardingRedirect already allowed `/settings/specialties` path (from Step 7)
- ESLint passes with no warnings

---

### [x] Step 9: Data Migration for Existing Users
<!-- chat-id: 2d5284bb-8695-42af-8669-070a5f39d99a -->

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

**Completed**:
- Created `prisma/migrations/scripts/migrate-subspecialties.ts`:
  - Finds all users with non-empty `subspecialties[]` array (legacy data)
  - Maps each legacy enum value to new specialty + subspecialty IDs using `LEGACY_SUBSPECIALTY_MAPPING`
  - Creates `ClinicianSpecialty` records (e.g., links user to Cardiology or Cardiothoracic Surgery)
  - Creates `ClinicianSubspecialty` records (e.g., links user to Interventional Cardiology)
  - Sets `onboardingCompletedAt` for migrated users who haven't completed new onboarding
  - Uses transactions per user for atomicity
  - Idempotent: safe to run multiple times, skips already-migrated users
  - Supports `--dry-run` flag to preview changes without modifying database
  - Detailed progress reporting and error handling
- Added npm scripts to `package.json`:
  - `npm run db:migrate:subspecialties` - run the migration
  - `npm run db:migrate:subspecialties:dry-run` - preview migration without changes
- Updated `docs/TECH_NOTES.md` with:
  - Data migration documentation section
  - Usage instructions and example output
  - Idempotency and safety notes
- TypeScript typecheck passes
- ESLint passes with no warnings

---

### [x] Step 10: Unit & Integration Tests
<!-- chat-id: 436c36ae-fb22-4553-82b2-99f01b42234b -->

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

**Completed**:
- Created `tests/unit/domains/specialties/specialty.service.test.ts`:
  - 34 unit tests covering all service functions
  - Tests for searchSpecialties with various query scenarios
  - Tests for getSpecialtyById, getAllSpecialties, getSpecialtyBySlug
  - Tests for getSubspecialtiesForSpecialty with filtering
  - Tests for createCustomSpecialty and createCustomSubspecialty
  - Tests for getUserPracticeProfile and updateUserPracticeProfile
  - Tests for hasCompletedPracticeProfile, getUserSpecialtyIds, getUserSubspecialtyIds
  - Tests for getSuggestedSubspecialties
- Created `tests/integration/api/specialties.test.ts`:
  - 35 integration tests for API endpoints
  - Tests for GET /api/specialties with auth, search, limit, includeCustom, synonyms
  - Tests for GET /api/specialties/:id/subspecialties with query filtering
  - Tests for POST /api/specialties/custom with validation
  - Tests for POST /api/subspecialties/custom with validation
  - Tests for GET /api/user/practice-profile auth and data retrieval
  - Tests for PUT /api/user/practice-profile with validation and rate limiting
- Created `tests/integration/specialty/specialty-onboarding.test.ts`:
  - 25 integration tests for onboarding flow
  - Flow 1: Complete onboarding with standard specialty (5 tests)
  - Flow 2: Select multiple specialties (1 test)
  - Flow 3: Skip onboarding without selecting specialties (2 tests)
  - Flow 4: Add custom specialty not in list (4 tests)
  - Flow 5: Add custom subspecialty not in list (3 tests)
  - Flow 6: Edit specialties from settings (3 tests)
  - Helper functions tests (4 tests)
  - Error handling tests (3 tests)
- Fixed bug in `src/app/api/specialties/route.ts`:
  - `includeCustom=false` query parameter was being coerced to `true` by z.coerce.boolean()
  - Added proper boolean string parsing with `booleanString` helper in `src/lib/validation.ts`
- All specialty tests pass: 34 unit tests + 60 integration tests (35 API + 25 onboarding)

---

### [x] Step 11: Documentation & Cleanup
<!-- chat-id: cce25902-3319-4cf0-b76a-1283292500fc -->

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

**Completed**:
- Updated `docs/TECH_NOTES.md`:
  - Version updated to 1.1.0
  - Date updated to 2025-12-24
  - Medical Specialty Taxonomy section already documented in Step 2 and Step 9
- Ran `npm run verify`:
  - ✅ ESLint: No warnings or errors
  - ✅ TypeScript: No type errors
  - ✅ Tests: 643 passed (0 failed)
- Created `.zenflow/tasks/implement-low-friction-specialty-9acd/report.md`:
  - Comprehensive implementation report
  - Summary of all 10 completed steps
  - Files changed summary (24 created, 7 modified)
  - Architecture decisions documented
  - Verification results
  - Future considerations noted
