# Technical Specification: Low-Friction Specialty Onboarding

## Task Complexity Assessment

**Difficulty: HARD**

This task is complex because:
1. **Schema redesign**: Current system uses a flat `Subspecialty` enum with 7 cardiology values. Task requires a full hierarchical specialty → subspecialty model with 25+ specialties and many subspecialties
2. **Custom entries with pending status**: Need to support user-submitted specialties/subspecialties that are immediately usable but flagged for admin review
3. **New data models**: 6 new tables required (MedicalSpecialty, MedicalSubspecialty, ClinicianSpecialty, ClinicianSubspecialty, CustomSpecialty, CustomSubspecialty)
4. **Migration complexity**: Must preserve existing cardiology subspecialty data while migrating to new model
5. **UI redesign**: Move from grid-card selection to fast type-ahead combobox with chips
6. **Role system**: Add user role field (medical/nursing/allied_health)
7. **Multi-specialty support**: Users can have multiple specialties with independent subspecialties per specialty
8. **Seed data**: 25+ specialties with subspecialties need to be curated and seeded

---

## Technical Context

**Stack**:
- Next.js 14.2.0 with App Router
- React 18.2.0
- TypeScript 5.3.3
- Prisma 6.19.1 + PostgreSQL
- Radix UI + Tailwind CSS
- Zod for validation
- Vitest + React Testing Library for tests

**Relevant Existing Code**:
- `prisma/schema.prisma` - Current `Subspecialty` enum (legacy cardiology types)
- `src/domains/letters/templates/template.types.ts` - Current subspecialty types
- `src/app/(dashboard)/onboarding/page.tsx` - Current onboarding (grid selection)
- `src/app/api/user/subspecialties/route.ts` - Current subspecialties API
- `src/app/(dashboard)/settings/subspecialties/page.tsx` - Current settings page
- `src/components/ui/` - Available Radix UI components

---

## Implementation Approach

### 1. Data Model Changes

#### New Tables

```prisma
// Medical specialties (global, curated list)
model MedicalSpecialty {
  id          String   @id @default(uuid())
  name        String   @unique  // e.g., "Cardiology"
  slug        String   @unique  // e.g., "cardiology"
  description String?  @db.Text
  synonyms    Json     @default("[]")  // e.g., ["cardiologist", "cardiac medicine"]
  active      Boolean  @default(true)
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt

  subspecialties         MedicalSubspecialty[]
  clinicianSpecialties   ClinicianSpecialty[]
  customSubspecialties   CustomSubspecialty[]

  @@index([active])
  @@map("medical_specialties")
}

// Medical subspecialties (linked to specialties)
model MedicalSubspecialty {
  id           String           @id @default(uuid())
  specialtyId  String
  specialty    MedicalSpecialty @relation(fields: [specialtyId], references: [id], onDelete: Cascade)
  name         String           // e.g., "Interventional Cardiology"
  slug         String           // e.g., "interventional-cardiology"
  description  String?          @db.Text
  active       Boolean          @default(true)
  createdAt    DateTime         @default(now())
  updatedAt    DateTime         @updatedAt

  clinicianSubspecialties ClinicianSubspecialty[]

  @@unique([specialtyId, slug])
  @@index([specialtyId])
  @@index([active])
  @@map("medical_subspecialties")
}

// Junction: Clinician → Specialty
model ClinicianSpecialty {
  id          String           @id @default(uuid())
  userId      String
  user        User             @relation(fields: [userId], references: [id], onDelete: Cascade)
  specialtyId String
  specialty   MedicalSpecialty @relation(fields: [specialtyId], references: [id], onDelete: Cascade)
  createdAt   DateTime         @default(now())

  @@unique([userId, specialtyId])
  @@index([userId])
  @@index([specialtyId])
  @@map("clinician_specialties")
}

// Junction: Clinician → Subspecialty
model ClinicianSubspecialty {
  id              String              @id @default(uuid())
  userId          String
  user            User                @relation(fields: [userId], references: [id], onDelete: Cascade)
  subspecialtyId  String
  subspecialty    MedicalSubspecialty @relation(fields: [subspecialtyId], references: [id], onDelete: Cascade)
  createdAt       DateTime            @default(now())

  @@unique([userId, subspecialtyId])
  @@index([userId])
  @@index([subspecialtyId])
  @@map("clinician_subspecialties")
}

// Custom specialty requests (pending admin review)
model CustomSpecialty {
  id        String               @id @default(uuid())
  userId    String
  user      User                 @relation(fields: [userId], references: [id], onDelete: Cascade)
  name      String
  region    String?              // e.g., "AU", "US" for regional specialties
  notes     String?              @db.Text
  status    CustomRequestStatus  @default(PENDING)
  createdAt DateTime             @default(now())
  updatedAt DateTime             @updatedAt

  // If approved, link to the created MedicalSpecialty
  approvedSpecialtyId String?

  // Custom subspecialties linked to this custom specialty
  customSubspecialties CustomSubspecialty[]

  @@index([userId])
  @@index([status])
  @@map("custom_specialties")
}

// Custom subspecialty requests (pending admin review)
model CustomSubspecialty {
  id          String               @id @default(uuid())
  userId      String
  user        User                 @relation(fields: [userId], references: [id], onDelete: Cascade)
  name        String
  description String?              @db.Text
  status      CustomRequestStatus  @default(PENDING)
  createdAt   DateTime             @default(now())
  updatedAt   DateTime             @updatedAt

  // Can be linked to either a global specialty or a custom specialty
  specialtyId       String?
  specialty         MedicalSpecialty? @relation(fields: [specialtyId], references: [id], onDelete: Cascade)
  customSpecialtyId String?
  customSpecialty   CustomSpecialty?  @relation(fields: [customSpecialtyId], references: [id], onDelete: Cascade)

  // If approved, link to the created MedicalSubspecialty
  approvedSubspecialtyId String?

  @@index([userId])
  @@index([specialtyId])
  @@index([customSpecialtyId])
  @@index([status])
  @@map("custom_subspecialties")
}

enum CustomRequestStatus {
  PENDING
  APPROVED
  REJECTED
}
```

#### User Model Updates

```prisma
model User {
  // ... existing fields ...

  // New: Role for onboarding flow
  clinicianRole ClinicianRole @default(MEDICAL)

  // New: Relations to specialty models
  clinicianSpecialties    ClinicianSpecialty[]
  clinicianSubspecialties ClinicianSubspecialty[]
  customSpecialties       CustomSpecialty[]
  customSubspecialties    CustomSubspecialty[]
}

enum ClinicianRole {
  MEDICAL
  NURSING       // Coming soon
  ALLIED_HEALTH // Coming soon
}
```

### 2. Seed Data Strategy

**Specialties** (25+ from ABMS/AHPRA):
- General Practice / Family Medicine
- Internal Medicine
- Cardiology
- Cardiothoracic Surgery
- Thoracic Surgery
- Neurology
- Neurosurgery
- General Surgery
- Vascular Surgery
- Orthopaedic Surgery
- ENT / Otolaryngology
- Ophthalmology
- Dermatology
- Anaesthesiology
- Intensive Care Medicine
- Emergency Medicine
- Obstetrics & Gynaecology
- Psychiatry
- Diagnostic Radiology
- Interventional Radiology
- Oncology / Medical Oncology
- Haematology
- Paediatrics and Child Health
- Endocrinology
- Respiratory Medicine
- Gastroenterology
- Rheumatology

**Subspecialties** (priority areas with 3-6 each):
- Cardiology: Interventional, Electrophysiology, Heart Failure/Transplant, Adult Congenital, Cardiac Imaging
- Cardiothoracic Surgery: Adult Cardiac (CABG/Valves/Aortic), General Thoracic, Congenital Cardiac
- Neurology: Stroke/Vascular, Epilepsy, Movement Disorders, Neuromuscular, MS/Neuroimmunology, Cognitive/Behavioural
- General Practice: Women's Health, Sexual Health, Chronic Disease Management, Mental Health, Aged Care/Geriatrics, Sports Medicine, Addiction Medicine

### 3. API Design

#### New Endpoints

```
GET  /api/specialties?query=cardio           # Search specialties (global + user's custom)
GET  /api/specialties/:id/subspecialties     # Get subspecialties for a specialty
POST /api/specialties/custom                 # Create custom specialty
POST /api/subspecialties/custom              # Create custom subspecialty

GET  /api/user/practice-profile              # Get user's practice profile (role, specialties, subspecialties)
PUT  /api/user/practice-profile              # Save user's practice profile
```

#### Response Types

```typescript
interface SpecialtyOption {
  id: string;
  name: string;
  slug: string;
  description?: string;
  isCustom: boolean;  // true for user's custom entries
  customStatus?: 'PENDING' | 'APPROVED' | 'REJECTED';
}

interface SubspecialtyOption {
  id: string;
  specialtyId: string;
  name: string;
  slug: string;
  description?: string;
  isCustom: boolean;
  customStatus?: 'PENDING' | 'APPROVED' | 'REJECTED';
}

interface PracticeProfile {
  role: 'MEDICAL' | 'NURSING' | 'ALLIED_HEALTH';
  specialties: Array<{
    id: string;
    name: string;
    isCustom: boolean;
    subspecialties: Array<{
      id: string;
      name: string;
      isCustom: boolean;
    }>;
  }>;
}
```

### 4. UI Components

#### New Components Needed

1. **SpecialtyCombobox** (`src/components/specialty/SpecialtyCombobox.tsx`)
   - Type-ahead search with debouncing
   - Shows top 3-7 matches from specialties
   - Matches on name + synonyms
   - Enter selects top highlighted match
   - "Add '{typed}' as custom" option at bottom when no good matches
   - Renders selected items as chips with "x" remove button

2. **SubspecialtyPanel** (`src/components/specialty/SubspecialtyPanel.tsx`)
   - Collapsible panel per selected specialty
   - Contains SubspecialtyCombobox for that specialty
   - Shows selected subspecialties as chips

3. **SpecialtyChip** (`src/components/specialty/SpecialtyChip.tsx`)
   - Displays selected specialty/subspecialty
   - "(custom)" suffix for user-submitted entries
   - "x" button to remove

4. **PracticeProfileForm** (`src/components/specialty/PracticeProfileForm.tsx`)
   - Combines: role display, specialty combobox, subspecialty panels
   - Handles save/submit logic

### 5. Migration Strategy

#### Phase 1: Add New Tables (Non-Breaking)
- Create new tables without modifying existing User.subspecialties
- Seed MedicalSpecialty and MedicalSubspecialty with initial data
- Map existing cardiology subspecialties to new model

#### Phase 2: Data Migration
- For each user with subspecialties:
  - Create ClinicianSpecialty for Cardiology
  - Create ClinicianSubspecialty entries matching their current subspecialties

#### Phase 3: Update Application
- Switch onboarding UI to new model
- Update APIs to use new tables
- Keep old subspecialties field as read-only fallback

### 6. Source Code Changes

#### Files to Create

| File | Purpose |
|------|---------|
| `prisma/migrations/<timestamp>_add_medical_specialty_tables/migration.sql` | DB migration (auto-generated) |
| `prisma/seeds/medical-specialties.ts` | Seed data definitions |
| `src/domains/specialties/specialty.types.ts` | Type definitions |
| `src/domains/specialties/specialty.service.ts` | Business logic |
| `src/app/api/specialties/route.ts` | Search specialties API |
| `src/app/api/specialties/[id]/subspecialties/route.ts` | Get subspecialties API |
| `src/app/api/specialties/custom/route.ts` | Create custom specialty API |
| `src/app/api/subspecialties/custom/route.ts` | Create custom subspecialty API |
| `src/app/api/user/practice-profile/route.ts` | Practice profile API |
| `src/components/specialty/SpecialtyCombobox.tsx` | Type-ahead combobox |
| `src/components/specialty/SubspecialtyPanel.tsx` | Per-specialty panel |
| `src/components/specialty/SpecialtyChip.tsx` | Selection chip |
| `src/components/specialty/PracticeProfileForm.tsx` | Combined form |
| `tests/unit/specialty.service.test.ts` | Service unit tests |
| `tests/integration/specialty-onboarding.test.ts` | Integration tests |

#### Files to Modify

| File | Changes |
|------|---------|
| `prisma/schema.prisma` | Add new models and enums |
| `src/app/(dashboard)/onboarding/page.tsx` | Replace with new combobox UI |
| `src/app/(dashboard)/settings/subspecialties/page.tsx` | Rename to "Your Specialties", update UI |
| `src/lib/auth.ts` | Update AuthUser type with role |
| `src/domains/letters/templates/template.types.ts` | Keep for backwards compat, add migration helper |

---

## Verification Approach

### Unit Tests
- specialty.service.ts: search, create, update, delete operations
- Custom specialty creation and retrieval
- Clinician specialty/subspecialty mapping

### Integration Tests
- Full onboarding flow: select specialties → add custom → save → verify profile
- Settings edit flow: add/remove specialties and subspecialties
- API endpoint validation

### Manual Verification
1. Create new user, go through onboarding
2. Search for "cardio" - should match Cardiology + Cardiothoracic Surgery
3. Add a specialty not in list - should create custom entry
4. Add subspecialties for selected specialty
5. Complete onboarding, verify profile saved
6. Go to Settings, edit specialties
7. Verify custom entries show "(custom)" suffix

### Commands
```bash
npm run verify          # Lint + typecheck + test
npm run test            # Unit tests only
npm run test:e2e        # E2E tests
npx prisma migrate dev  # Apply migrations
npx prisma db seed      # Run seed data
```

---

## Design Decisions

### Q1: How to handle backwards compatibility with existing Subspecialty enum?

**Decision**: Keep the existing `User.subspecialties` field and `Subspecialty` enum as-is for now. The new specialty system will be additive. Existing cardiology subspecialties will be mapped to the new model:

| Old Enum Value | New MedicalSubspecialty |
|----------------|-------------------------|
| GENERAL_CARDIOLOGY | General Cardiology |
| INTERVENTIONAL | Interventional Cardiology |
| STRUCTURAL | Structural Heart |
| ELECTROPHYSIOLOGY | Electrophysiology |
| IMAGING | Cardiac Imaging |
| HEART_FAILURE | Heart Failure / Transplant |
| CARDIAC_SURGERY | (maps to Cardiothoracic Surgery specialty) |

### Q2: How to identify the "type-ahead" UI component?

**Decision**: Build a custom combobox using Radix UI primitives (Popover + Command from cmdk library). Radix's built-in Select doesn't support search/type-ahead. We'll add `cmdk` as a dependency (commonly used with shadcn/ui).

### Q3: What happens when user selects no specialties?

**Decision**: Allow it. Set `clinicianRole = MEDICAL` with no ClinicianSpecialty entries. User proceeds with a "generic Medical doctor" profile. They can add specialties later in Settings.

### Q4: How to handle "Add as custom" flow?

**Decision**: Inline in the dropdown. No modal. When user types something with no matches:
1. Show "Add '{text}' as my specialty (custom)" option in dropdown
2. On click: create CustomSpecialty with status=PENDING via API
3. Immediately add chip to selection
4. Optional: show small "Add note" link near chip (expands to single-line input)

### Q5: Should we pre-populate the Cardiology specialty for existing users?

**Decision**: Yes. During data migration, for any user with existing subspecialties:
1. Create ClinicianSpecialty for "Cardiology"
2. Create ClinicianSubspecialty entries for their subspecialties (mapped to new model)

---

## Risks & Mitigations

| Risk | Mitigation |
|------|------------|
| Data migration breaks existing functionality | Keep old fields, add new ones; test thoroughly |
| Combobox UX not fast enough | Debounce search (150ms), limit results to 7, index synonyms |
| Custom specialty spam | Status field, admin review later (out of scope) |
| Slow specialty search | Add indexes on name, slug; consider full-text search later |

---

## Dependencies to Add

```json
{
  "cmdk": "^1.0.0"  // Command palette component for type-ahead
}
```

Or use Radix Combobox pattern with custom implementation.

---

## Additional Implementation Notes

### Search Strategy for Synonyms

The specialty search uses a two-phase approach:
1. **Direct match**: PostgreSQL `ILIKE` on `name` field for fast prefix matching
2. **Synonym match**: JSON array contains query using `@>` operator on the `synonyms` field

For higher volume, consider adding PostgreSQL full-text search (tsvector/tsquery) or a GIN index on synonyms.

### Error Handling for Custom Specialty Creation

When custom specialty creation fails:
1. Show an unobtrusive toast notification with the error
2. Keep the user's typed text in the input (don't clear it)
3. Show a "Retry" link in the toast that re-attempts the API call
4. Allow the user to continue with other selections while retrying

### Accessibility Requirements

The combobox components should implement:
- `role="combobox"` on the input
- `aria-expanded` to indicate dropdown state
- `aria-activedescendant` for keyboard navigation
- `role="listbox"` on the dropdown
- `role="option"` on each suggestion
- Arrow key navigation with visual focus indicator
- Screen reader announcements for selection changes
