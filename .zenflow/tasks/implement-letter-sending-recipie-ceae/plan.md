# Implementation Plan: Letter Sending, Recipient Management & Dark Mode

## Configuration
- **Artifacts Path**: `.zenflow/tasks/implement-letter-sending-recipie-ceae`
- **Spec Document**: `spec.md`

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

Created comprehensive technical specification in `spec.md` covering:
- Data model design (PatientContact, LetterSend)
- Email infrastructure with adapter pattern
- API endpoints
- Frontend components
- Theme system integration
- Privacy/security considerations

**Difficulty**: HARD (multiple models, new infrastructure, multi-phase UI, compliance considerations)

---

### [x] Step 1: Database Schema - Contact and Send Models
<!-- chat-id: c6bbf1a4-566f-43b9-a540-8f7c33c1f0ea -->

Add new Prisma models and run migration.

**Files to modify:**
- `prisma/schema.prisma` - Add `PatientContact`, `LetterSend`, enums

**Tasks:**
1. Add `ContactType` enum (GP, REFERRER, SPECIALIST, OTHER)
2. Add `ChannelType` enum (EMAIL, SECURE_MESSAGING, FAX, POST)
3. Add `SendStatus` enum (QUEUED, SENDING, SENT, FAILED, BOUNCED)
4. Add `PatientContact` model with patient relation
5. Add `LetterSend` model with letter, sender, and contact relations
6. Add relations to existing `Patient`, `Letter`, `User` models
7. Run migration: `npm run db:migrate`

**Verification:**
- `npm run db:generate` completes without errors
- `npm run typecheck` passes

**Completed:** Added all enums and models to `prisma/schema.prisma`. Created migration file at `prisma/migrations/20251222_add_patient_contacts_and_letter_sends/migration.sql`. Prisma generate and typecheck both pass.

**Schema Refinements (per review):**
- Added `updatedAt DateTime @updatedAt` to `LetterSend` for status transition tracking
- Added `patientId String?` with `Patient` relation (onDelete: SetNull) for direct audit queries
- Added `@@index([patientId])` for efficient patient-based queries
- Updated migration SQL to include new fields
- Updated `sending.service.ts` to populate `patientId` when creating LetterSend records
- Fixed test files to use proper `PatientData` type (with dateOfBirth) and non-null assertions

---

### [x] Step 2: Contact Domain - Service and Validation

Implement CRUD service for patient contacts.

**Files created:**
- `src/domains/contacts/index.ts` - Barrel export
- `src/domains/contacts/contact.service.ts` - CRUD operations
- `src/domains/contacts/contact.types.ts` - TypeScript interfaces
- `src/domains/contacts/contact.validation.ts` - Zod schemas
- `tests/unit/domains/contacts/contact.service.test.ts` - 27 unit tests
- `tests/unit/domains/contacts/contact.validation.test.ts` - 35 unit tests

**Tasks completed:**
1. Defined TypeScript types: `PatientContact`, `CreateContactInput`, `UpdateContactInput`, `ContactListQuery`, `ContactListResult`
2. Created Zod validation schemas with:
   - GP-specific validation (must have contact method)
   - Channel-specific validation (email required for EMAIL channel, etc.)
   - Email/phone format validation
   - Default values for `preferredChannel` (EMAIL) and `isDefaultForPatient` (false)
3. Implemented CRUD service functions:
   - `createContact(input)` - Creates contact, auto-unsets other defaults of same type
   - `getContact(id, patientId?)` - Get by ID with optional auth check
   - `listContactsForPatient(query)` - Paginated list with filters
   - `updateContact(id, input, patientId?)` - Update with auth check
   - `deleteContact(id, patientId?)` - Delete with auth check
   - `getDefaultContactForPatient(patientId, type)` - Get default of type
   - `getDefaultContactsForPatient(patientId)` - Get all defaults
   - `getContactsByIds(ids)` - Batch fetch for letter sending
   - `hasContacts(patientId)` - Check if patient has contacts
4. Added helper functions: `isValidEmail()`, `isValidPhone()`, `normalizePhone()`

**Verification:**
- `npm run typecheck` passes
- `npm run test` passes (62 new tests, 139 total)

---

### [x] Step 3: Contact API Endpoints
<!-- chat-id: cb6361de-e562-4a17-a5c7-ca02ccdba486 -->

Create REST API endpoints for contact management.

**Files created/modified:**
- `src/app/api/contacts/route.ts` - GET (list), POST (create)
- `src/app/api/contacts/[id]/route.ts` - GET, PUT, DELETE
- `tests/integration/api/contacts.test.ts` - 31 integration tests

**Tasks completed:**
1. Implemented GET `/api/contacts?patientId=xxx` with auth and pagination
2. Implemented POST `/api/contacts` with validation and rate limiting
3. Implemented GET `/api/contacts/[id]` with auth check
4. Implemented PUT `/api/contacts/[id]` with validation
5. Implemented DELETE `/api/contacts/[id]`
6. Fixed rate limit resource key (was using 'standard', changed to 'default')
7. Created comprehensive integration tests covering:
   - Authentication (401 for unauthenticated)
   - Authorization (403 for wrong practice)
   - Validation (400 for invalid input)
   - Rate limiting (429 when exceeded)
   - Success cases for all CRUD operations
   - Default contact handling

**Verification:**
- `npm run typecheck` passes
- `npm run test:integration` passes (31 tests)

---

### [x] Step 4: Email Infrastructure - Adapter Pattern
<!-- chat-id: 1089ded4-7856-4233-8467-7b2e76786364 -->

Create email sending infrastructure module.

**Files created:**
- `src/infrastructure/email/index.ts`
- `src/infrastructure/email/types.ts`
- `src/infrastructure/email/validation.ts`
- `src/infrastructure/email/ses.adapter.ts`

**Dependencies added:**
- `@aws-sdk/client-ses@^3.500.0`

**Tasks:**
1. Define `EmailAdapter` interface with `sendEmail()` method
2. Define `SendEmailParams` and `SendEmailResult` types
3. Implement email validation helper
4. Implement AWS SES adapter:
   - Configure SES client (singleton pattern like S3)
   - Build raw email with MIME for attachments
   - Handle errors and return structured result
5. Export factory function to get adapter

**Completed:** All email infrastructure files created with proper MIME building, attachment support, and validation utilities. Uses AWS SES with singleton pattern.

---

### [x] Step 5: PDF Generation Service
<!-- chat-id: 0b3b26c6-aafe-4338-a3dc-dfbb5c407e81 -->

Create service to generate letter PDFs for attachment.

**Files created/modified:**
- `src/domains/letters/pdf.service.ts` - Main PDF generation service
- `src/domains/letters/index.ts` - Added exports for `generateLetterPdf` and `generateSimplePdf`
- `tests/unit/domains/letters/pdf.service.test.ts` - 23 unit tests

**Dependencies used:**
- `pdf-lib@^1.17.1` (already in package.json)

**Tasks completed:**
1. Verified `generateLetterPdf(letterId)` implementation:
   - Fetches letter content, patient data, and practice info
   - Decrypts patient name from encrypted data
   - Formats content as A4 PDF pages with proper margins
   - Adds practice name header, date, subject line
   - Text wrapping and multi-page support
   - Signature area with clinician name and practice
   - Footer with page numbers and confidentiality notice
   - Returns PDF as Buffer
2. Verified `generateSimplePdf(content, title, author)` helper function
3. Added exports to domain index
4. Created comprehensive unit tests covering:
   - Valid PDF generation with magic bytes verification
   - Long content handling
   - Missing patient data handling
   - Decryption failure handling
   - Different letter types
   - Error cases (not found, no content)
   - Prisma query verification

**Verification:**
- `npm run typecheck` passes
- `npm run test` passes (195 tests total, 23 PDF service tests)

---

### [x] Step 6: Letter Sending Service
<!-- chat-id: 9b01f569-b877-4fe1-81cb-8607fa2d6bfc -->

Create orchestration service for sending letters.

**Files created:**
- `src/domains/letters/sending.service.ts`
- `src/domains/letters/sending.types.ts`

**Tasks:**
1. Define `SendLetterInput` and `SendLetterResult` types
2. Implement `sendLetter(input)`:
   - Validate letter is APPROVED status
   - Generate PDF attachment
   - For each recipient:
     - Create LetterSend record (QUEUED)
     - Call email adapter
     - Update status (SENT or FAILED)
   - Return aggregate result
3. Implement `retrySend(sendId)` for failed sends
4. Add AuditLog entries for sends

**Files created/modified:**
- `src/domains/letters/sending.service.ts` - Main sending orchestration
- `src/domains/letters/sending.types.ts` - Type definitions
- `src/domains/letters/index.ts` - Added exports for sending functions
- `tests/unit/domains/letters/sending.service.test.ts` - 33 unit tests

**Implementation details:**
1. `sendLetter(input)`:
   - Validates letter is APPROVED status
   - Verifies sender has practice-level access
   - Generates PDF attachment via `generateLetterPdf()`
   - Sends to each recipient sequentially:
     - Creates LetterSend record (QUEUED)
     - Updates to SENDING
     - Calls email adapter
     - Updates to SENT or FAILED with timestamps
   - Creates audit log entry with metadata
   - Returns aggregate result with per-recipient status
2. `retrySend(input)`:
   - Validates send exists and is FAILED
   - Verifies user authorization
   - Regenerates PDF and retries email
   - Updates status accordingly
3. `getSendHistory(letterId)`:
   - Returns all send records for a letter
4. `getSend(sendId)`:
   - Returns single send record
5. `processSubjectTemplate(template, data)`:
   - Replaces tokens: `{{patient_name}}`, `{{letter_type}}`, `{{subspecialty}}`, `{{date}}`
6. Email body includes:
   - Optional cover note
   - Confidentiality notice
   - PDF attachment with sanitized filename

**Verification:**
- `npm run typecheck` passes
- `npm run test` passes (195 tests total, 33 sending service tests)

---

### [x] Step 7: Letter Send API Endpoints
<!-- chat-id: 39a3072d-7660-4d73-88ab-fe70b90c5697 -->

Create API endpoints for letter sending.

**Files created:**
- `src/app/api/letters/[id]/send/route.ts` - POST
- `src/app/api/letters/[id]/sends/route.ts` - GET
- `src/app/api/letters/[id]/sends/[sendId]/retry/route.ts` - POST

**Tasks:**
1. Implement POST `/api/letters/[id]/send`:
   - Validate letter ownership and APPROVED status
   - Validate recipients array
   - Call sending service
   - Return structured result
2. Implement GET `/api/letters/[id]/sends`:
   - Return send history with pagination
3. Implement POST `/api/letters/[id]/sends/[sendId]/retry`:
   - Retry failed send

**Completed:** All endpoints with auth, validation, rate limiting, and proper error handling.

---

### [x] Step 8: User Settings - Letter Sending Preferences
<!-- chat-id: bef5df5c-120e-4f93-9dba-b37e4f7143e1 -->

Add letter sending preferences to user settings.

**Files created/verified:**
- `src/app/api/user/settings/letters/route.ts` - GET, PUT endpoints
- `src/app/(dashboard)/settings/letters/page.tsx` - Settings page
- `src/components/settings/LetterSendingSettings.tsx` - Settings form component
- `src/app/(dashboard)/settings/page.tsx` - Already has "Letter Sending" link
- `tests/integration/api/letter-settings.test.ts` - 17 integration tests

**Implementation details:**
1. API endpoints (`/api/user/settings/letters`):
   - GET: Returns preferences merged with defaults
   - PUT: Updates preferences with Zod validation
   - Stores in user.settings JSON as `letterSending` object
   - Max 500 chars for subject template, 2000 for cover note
2. Settings form component:
   - Checkboxes for: CC GP, CC self, include referrer
   - Subject template input with available tokens display
   - Cover note textarea with max length
   - Loading, saving, success, and error states
3. Types defined in `src/domains/letters/sending.types.ts`:
   - `LetterSendingPreferences` interface
   - `DEFAULT_SENDING_PREFERENCES` constant

**Verification:**
- `npm run typecheck` passes
- `npm run test:integration` passes (48 tests, 17 for letter settings)

---

### [x] Step 9: Send Letter Dialog Component
<!-- chat-id: 1b3fc734-6f7e-483d-bd9c-d5c93445e4b8 -->

Create the main send letter dialog UI.

**Files created/modified:**
- `src/components/letters/SendLetterDialog.tsx` - Already existed with full implementation
- `src/app/(dashboard)/letters/[id]/LetterReviewClient.tsx` - Added SendLetterDialog integration
- `src/app/(dashboard)/letters/[id]/page.tsx` - Updated to pass user email and subspecialties
- `tests/unit/components/SendLetterDialog.test.tsx` - 36 comprehensive unit tests

**Implementation details:**
1. Multi-step wizard dialog (recipients → message → confirm → sending → result)
2. Recipient selection:
   - Auto-fetches patient contacts on open
   - Auto-selects based on user preferences (CC GP, CC self, include referrer)
   - Toggle to CC self with user email display
   - Available patient contacts with type badges (GP, REFERRER, etc.)
   - One-off recipient form with email validation
   - Remove recipients with X button
3. Message section:
   - Subject input with template token preview ({{patient_name}}, {{letter_type}}, etc.)
   - Cover note textarea (optional)
   - Available tokens displayed for reference
4. Confirmation step:
   - Lists all recipients with their emails
   - Shows subject preview and patient name
   - Shows cover note if provided
5. Send action:
   - Calls POST `/api/letters/[id]/send` with recipients, subject, coverNote
   - Shows sending spinner state
   - Displays success/partial success/failure results
   - Color-coded badges for each recipient status
   - onSendComplete callback for parent component
6. "Send Letter" button added to LetterReviewClient header for approved letters

**Verification:**
- `npm run typecheck` passes
- `npm run test` passes (231 tests total, 36 SendLetterDialog tests)

---

### [x] Step 10: Send History Component

Create send history display for letter detail page.

**Files already existed:**
- `src/components/letters/SendHistory.tsx` - Full implementation with retry support

**Files modified:**
- `src/app/(dashboard)/letters/[id]/LetterReviewClient.tsx` - Added SendHistory integration

**Files created:**
- `tests/unit/components/SendHistory.test.tsx` - 26 comprehensive unit tests

**Implementation details:**
1. SendHistory component (already existed):
   - List of sends with recipient name, email, type badge
   - Status badges with icons (SENT=green checkmark, FAILED=red x, QUEUED/SENDING=clock)
   - Formatted timestamps for each status
   - Error message display with truncation and tooltip for full message
   - Retry button for failed sends with loading state
   - Empty state when no sends
2. Integration into LetterReviewClient:
   - Added state: `sendHistory`, `isLoadingHistory`, `showHistory`
   - Added `fetchSendHistory()` callback to fetch from `/api/letters/[id]/sends`
   - Added `handleRetrySend()` callback for retry functionality
   - Added "View History" toggle button in header (for approved letters)
   - Collapsible history panel on the right side of the editor
   - Auto-refresh history after sending letters via SendLetterDialog
   - Updated `onSendComplete` to refresh history and show the panel

**Verification:**
- `npm run typecheck` passes
- `npm run lint` passes (no errors)
- `npm test` passes (257 tests total, 26 SendHistory tests)

---

### [x] Step 11: Patient Contact Management UI

Create UI for managing patient contacts.

**Files already existed (verified and integrated):**
- `src/components/consultation/PatientContacts.tsx` - Full CRUD implementation with:
  - Contact list with type badges (GP, REFERRER, SPECIALIST, OTHER)
  - Full card mode and compact mode display
  - Inline add/edit forms
  - Delete functionality with loading states
  - Error handling and display
  - Default contact indicators
  - `onContactSelect` callback for integration with send dialog
- `src/components/consultation/ContactForm.tsx` - Contact add/edit form with:
  - Contact type selection (GP, Referrer, Specialist, Other)
  - Full name, organisation, role/title fields
  - Contact methods: email, phone, fax, address
  - Preferred channel selection (Email, Fax, Post, Secure Messaging)
  - Default contact checkbox
  - Form validation (required fields, email format)
  - Loading and error states

**Files modified:**
- `src/components/consultation/ConsultationContextForm.tsx` - Added collapsible "Manage Patient Contacts" section that appears after patient is selected
- `src/components/consultation/index.ts` - Added exports for `PatientContacts`, `ContactForm`, and `ContactFormData` type
- `tests/setup.ts` - Added ResizeObserver, pointer capture, and scrollIntoView mocks for Radix UI components

**Files created:**
- `tests/unit/components/PatientContacts.test.tsx` - 27 comprehensive unit tests covering:
  - Loading states
  - Empty states
  - Contact list display (full and compact modes)
  - CRUD operations (create, update, delete)
  - Error handling
  - API calls verification
- `tests/unit/components/ContactForm.test.tsx` - 30 comprehensive unit tests covering:
  - Initial render and field display
  - Form validation (required fields, email format, contact methods)
  - Form submission with data trimming
  - Initial data population
  - Loading states
  - Accessibility

**Verification:**
- `npm run typecheck` passes
- `npm run lint` passes (no errors)
- `npm run test` passes (314 tests total, 57 new component tests)

---

### [x] Step 12: Theme System - Provider and Storage
<!-- chat-id: 548dadd0-58fb-4559-822c-93668cd79ac5 -->

Implement theme preference system.

**Files created:**
- `src/lib/theme.ts` - Theme utilities with:
  - `getSystemTheme()` - Detects OS preference via matchMedia
  - `resolveTheme(preference)` - Resolves 'system' to actual theme
  - `applyTheme(theme)` - Applies dark/light class to document
  - `getStoredThemePreference()` / `storeThemePreference()` - LocalStorage helpers
  - `onSystemThemeChange(callback)` - Listener for system preference changes
  - `THEME_STORAGE_KEY`, `DEFAULT_THEME_PREFERENCE` constants
- `src/hooks/useTheme.ts` - Custom hook wrapping next-themes with:
  - `theme` - Current resolved theme ('light' | 'dark')
  - `preference` - User preference ('system' | 'light' | 'dark')
  - `setPreference(preference)` - Update theme preference
  - `toggleTheme()` - Toggle between light/dark
  - `isLoading` - Hydration state
  - `systemTheme` - OS preference
  - `isSystemPreference` - Whether using system preference
- `tests/unit/lib/theme.test.ts` - 21 unit tests for theme utilities
- `tests/unit/hooks/useTheme.test.tsx` - 8 unit tests for useTheme hook

**Files modified:**
- `src/components/providers/ThemeProvider.tsx` - Enhanced with:
  - `ThemeSyncContext` for syncing server-side user preferences
  - `useThemeSync()` hook exported for components to sync theme from API
  - Custom storage key `dictatemed-theme`
- `src/app/layout.tsx` - Already wrapped with ThemeProvider (no change needed)

**Already existed (leveraged):**
- `next-themes@0.4.6` dependency
- Dark mode CSS variables in `globals.css`

**Verification:**
- `npm run typecheck` passes
- `npm run lint` passes
- `npm run test` passes (343 tests total, 29 new theme tests)

---

### [ ] Step 13: Theme Settings UI

Add theme preference to settings.

**Files to create:**
- `src/app/api/user/settings/theme/route.ts` - GET, PUT
- `src/components/settings/ThemeSettings.tsx`

**Files to modify:**
- `src/app/(dashboard)/settings/profile/page.tsx` - Add theme section
  OR create new appearance page

**Tasks:**
1. Implement theme settings API endpoints
2. Create ThemeSettings component:
   - Radio group: System / Light / Dark
   - Preview area (optional)
3. Add to settings page
4. Connect to ThemeProvider

**Verification:**
- Toggle settings, verify immediate theme change
- Verify persists across sessions

---

### [ ] Step 14: Dark Mode Styling Verification

Verify and enhance dark mode across all screens.

**Files to modify:**
- `src/app/globals.css` - Add any missing dark mode variables
- Various components as needed

**Tasks:**
1. Audit all screens in dark mode:
   - Dashboard
   - Letters list and detail
   - Consultation context
   - Settings pages
   - New components from this task
2. Verify WCAG AA contrast ratios
3. Fix any styling issues
4. Verify clinical status colors work in both themes

**Verification:**
- Manual audit of all screens in both themes
- Use browser DevTools contrast checker
- `npm run test:a11y` passes

---

### [ ] Step 15: Comprehensive Testing

Write comprehensive tests and run full verification.

**Tasks:**
1. Add missing unit tests
2. Add integration tests for all new APIs
3. Add E2E test scenarios:
   - Create patient with contacts, send letter, verify history
   - Toggle theme preference, verify persistence
   - Handle send failures and retry
4. Run full test suite

**Verification:**
```bash
npm run lint
npm run typecheck
npm run test
npm run test:integration
npm run test:e2e
npm run verify:full
```

All commands must pass.

---

### [ ] Step 16: Documentation and Report

Create final report documenting the implementation.

**Files to create:**
- `.zenflow/tasks/implement-letter-sending-recipie-ceae/report.md`

**Content:**
1. Summary of what was implemented
2. ERD snippets for new models
3. Email adapter abstraction overview
4. Theme system explanation
5. Screenshots/GIFs of:
   - Send letter dialog
   - Send history
   - App in light and dark themes
6. Known limitations
7. Suggested next steps (secure messaging, patient email)

---

## Notes

- Each step is designed to be independently testable
- Steps can be adjusted based on user feedback or blockers
- Always run `npm run typecheck` after schema changes
- Follow existing patterns in codebase for consistency
