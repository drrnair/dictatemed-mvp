# Implementation Report: Low-Friction Specialty Onboarding

## Summary

Successfully implemented a minimal-friction onboarding flow for DictateMED that allows clinicians to quickly specify their medical specialties and subspecialties via a type-ahead interface.

## Deliverables Completed

### 1. Database Schema (Step 1)

**Files Created/Modified:**
- `prisma/schema.prisma` - Added 6 new models and 2 enums
- `prisma/migrations/20251224_add_medical_specialty_tables/migration.sql`

**New Models:**
| Model | Purpose |
|-------|---------|
| `MedicalSpecialty` | Global curated list of 42 specialties |
| `MedicalSubspecialty` | Subspecialties linked to parent specialty (51 total) |
| `ClinicianSpecialty` | Junction: User → Specialty (many-to-many) |
| `ClinicianSubspecialty` | Junction: User → Subspecialty (many-to-many) |
| `CustomSpecialty` | User-submitted specialties pending admin review |
| `CustomSubspecialty` | User-submitted subspecialties pending admin review |

**New Enums:**
- `ClinicianRole`: MEDICAL, NURSING, ALLIED_HEALTH
- `CustomRequestStatus`: PENDING, APPROVED, REJECTED

**User Model Updates:**
- Added `clinicianRole` field (default: MEDICAL)
- Added `onboardingCompletedAt` field for new onboarding status

### 2. Seed Data (Step 2)

**File Created:** `prisma/seeds/medical-specialties.ts`

**Coverage:**
- 42 medical specialties (exceeds 25+ requirement)
- 51 subspecialties across priority areas
- Synonyms for search matching (e.g., "GP", "cardiologist", "ENT")
- Deterministic UUIDs for reproducible seeding

**Priority Area Subspecialties:**
| Specialty | Subspecialties |
|-----------|----------------|
| General Practice | 8 (Women's Health, Mental Health, Chronic Disease, etc.) |
| Cardiology | 8 (Interventional, Electrophysiology, Heart Failure, etc.) |
| Cardiothoracic Surgery | 5 (Adult Cardiac, Thoracic, Congenital, etc.) |
| Neurology | 8 (Stroke, Epilepsy, Movement Disorders, etc.) |
| Orthopaedic Surgery | 7 (Joint Replacement, Spine, Sports, etc.) |

### 3. Domain Service (Step 3)

**Files Created:**
- `src/domains/specialties/specialty.types.ts` - Type definitions
- `src/domains/specialties/specialty.service.ts` - Business logic
- `src/domains/specialties/index.ts` - Public exports

**Service Functions:**
- `searchSpecialties()` - Type-ahead with synonym matching
- `getSubspecialtiesForSpecialty()` - Subspecialty lookup
- `createCustomSpecialty()` / `createCustomSubspecialty()` - Inline custom entry
- `getUserPracticeProfile()` / `updateUserPracticeProfile()` - Profile CRUD
- `hasCompletedPracticeProfile()` - Onboarding check

### 4. API Endpoints (Step 4)

**Endpoints Created:**

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/api/specialties` | GET | Search specialties with query |
| `/api/specialties/[id]/subspecialties` | GET | Get subspecialties for specialty |
| `/api/specialties/custom` | POST | Create custom specialty |
| `/api/subspecialties/custom` | POST | Create custom subspecialty |
| `/api/user/practice-profile` | GET/PUT | Get/update practice profile |
| `/api/user/onboarding/complete` | POST | Mark onboarding complete |

### 5. UI Components (Steps 5-6)

**Files Created:**
- `src/components/specialty/SpecialtyChip.tsx` - Removable selection chip
- `src/components/specialty/SpecialtyCombobox.tsx` - Type-ahead multi-select
- `src/components/specialty/SubspecialtyPanel.tsx` - Collapsible subspecialty selector
- `src/components/specialty/PracticeProfileForm.tsx` - Combined form component
- `src/hooks/usePracticeProfile.ts` - Profile state management

**UX Features:**
- ✅ 150ms debounced search
- ✅ Keyboard navigation (Arrow keys, Enter, Escape)
- ✅ Max 7 results + "Add as custom" option
- ✅ Selected items as removable chips
- ✅ Inline custom entry creation (no modal)
- ✅ ARIA attributes for accessibility
- ✅ Auto-focus on page load (onboarding mode)

### 6. Onboarding Page (Step 7)

**File Modified:** `src/app/(dashboard)/onboarding/page.tsx`

**Changes:**
- Replaced grid selection with `PracticeProfileForm`
- Added intro text: "Tell DictateMED what you practice"
- "Get Started" and "Skip for now" buttons
- Redirects to dashboard on completion

### 7. Settings Page (Step 8)

**Files Modified:**
- `src/app/(dashboard)/settings/page.tsx` - Updated navigation link
- Created `src/app/(dashboard)/settings/specialties/page.tsx` - New settings page

**Changes:**
- Renamed "Subspecialties" to "Your Specialties"
- Changed icon from Heart to Stethoscope
- Reuses `PracticeProfileForm` in settings mode

### 8. Data Migration Script (Step 9)

**File Created:** `prisma/migrations/scripts/migrate-subspecialties.ts`

**Features:**
- Maps legacy `Subspecialty` enum values to new model
- Creates `ClinicianSpecialty` and `ClinicianSubspecialty` records
- Sets `onboardingCompletedAt` for migrated users
- Idempotent (safe to run multiple times)
- `--dry-run` flag for preview

**NPM Scripts:**
```bash
npm run db:migrate:subspecialties          # Run migration
npm run db:migrate:subspecialties:dry-run  # Preview only
```

### 9. Tests (Step 10)

**Test Files Created:**
- `tests/unit/domains/specialties/specialty.service.test.ts` - 34 unit tests
- `tests/integration/specialties/specialty-api.test.ts` - 18 integration tests
- `tests/integration/specialties/onboarding-flow.test.ts` - 18 integration tests

**Coverage:**
- Total new tests: 70
- All 643 tests pass

### 10. Documentation (Step 11)

**Files Updated:**
- `docs/TECH_NOTES.md` - Added Medical Specialty Taxonomy section

**Documentation Includes:**
- Data model explanation
- Seed data sources (ABMS, AHPRA, RACGP, RACP)
- Legacy subspecialty mapping table
- Data migration instructions
- Custom specialty workflow
- UUID scheme documentation

## Verification Results

```bash
npm run verify
```

✅ **Lint**: No ESLint warnings or errors
✅ **TypeScript**: No type errors
✅ **Tests**: 643 passed (0 failed)

## Architecture Decisions

### 1. No cmdk dependency
Used custom implementation with existing Radix UI patterns instead of adding cmdk library.

### 2. Inline custom entry
Custom specialties created via dropdown option without modal, following "no heavy modals" UX principle.

### 3. Backwards compatibility
Legacy `subspecialties[]` field preserved. New system is additive. Migration script handles existing users.

### 4. Deterministic UUIDs
Seed data uses deterministic UUIDs (`00000000-0001-0001-NNNN-000000000000`) for reproducibility.

### 5. Mode-aware autoFocus
Form auto-focuses input in onboarding mode but not in settings mode (better UX for editing).

## Files Changed Summary

| Category | Files Created | Files Modified |
|----------|--------------|----------------|
| Schema | 1 | 1 |
| Seeds | 1 | 1 |
| Domain | 3 | 0 |
| API | 6 | 0 |
| Components | 5 | 0 |
| Hooks | 1 | 0 |
| Pages | 1 | 3 |
| Migration | 2 | 0 |
| Tests | 3 | 1 |
| Docs | 1 | 1 |
| **Total** | **24** | **7** |

## Future Considerations

1. **Admin UI for custom specialty approval** - Out of scope, but schema supports it
2. **Full-text search** - Current ILIKE is sufficient; consider tsvector for scale
3. **Nursing/Allied Health onboarding** - Role field in place, UI shows "Coming soon"
4. **Style learning integration** - New specialty model can be wired to existing style profiles

---

*Generated: 2025-12-24*
