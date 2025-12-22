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

**Completed:** Full sending service with PDF generation, email sending, status tracking, retry support, audit logging, and subject template processing.

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

### [ ] Step 8: User Settings - Letter Sending Preferences

Add letter sending preferences to user settings.

**Files to create:**
- `src/app/api/user/settings/letters/route.ts` - GET, PUT
- `src/app/(dashboard)/settings/letters/page.tsx`
- `src/components/settings/LetterSendingSettings.tsx`

**Files to modify:**
- `src/app/(dashboard)/settings/page.tsx` - Add "Letters" link

**Tasks:**
1. Define settings schema in validation file
2. Implement GET/PUT endpoints for letter settings
3. Create settings form component:
   - Checkboxes for default recipients (CC GP, CC self, include referrer)
   - Subject template input with token help text
   - Cover note textarea
4. Add settings page with form
5. Add link to settings index

**Verification:**
- Verify settings persist on reload
- `npm run test` passes

---

### [ ] Step 9: Send Letter Dialog Component

Create the main send letter dialog UI.

**Files to create:**
- `src/components/letters/SendLetterDialog.tsx`

**Tasks:**
1. Build dialog using Radix Dialog component
2. Implement recipient list section:
   - Fetch patient contacts
   - Pre-populate based on user preferences
   - Checkbox per recipient
   - Add one-off recipient input
3. Implement message section:
   - Subject input with template substitution preview
   - Cover note textarea
4. Implement confirmation step:
   - "You are about to send to N recipients" summary
5. Implement send action:
   - Call send API
   - Show progress/status for each recipient
   - Close on success or show errors

**Verification:**
- Manual test in browser
- Verify accessibility (keyboard nav, screen reader)

---

### [ ] Step 10: Send History Component

Create send history display for letter detail page.

**Files to create:**
- `src/components/letters/SendHistory.tsx`

**Files to modify:**
- `src/app/(dashboard)/letters/[id]/LetterReviewClient.tsx` - Add SendHistory
- `src/app/(dashboard)/letters/[id]/page.tsx` - Pass send history data

**Tasks:**
1. Create SendHistory component:
   - Table/list of sends
   - Columns: recipient, type, status, timestamp
   - Retry button for failed sends
   - Status badges with icons
2. Integrate into letter detail page (after approval)
3. Add "Send Letter" button after approval

**Verification:**
- Manual test send flow and verify history appears
- Verify retry functionality

---

### [ ] Step 11: Patient Contact Management UI

Create UI for managing patient contacts.

**Files to create:**
- `src/components/consultation/PatientContacts.tsx`
- `src/components/consultation/ContactForm.tsx`

**Files to modify:**
- Integration point in consultation context or patient detail

**Tasks:**
1. Create contact list component with CRUD actions
2. Create contact form (add/edit) with validation
3. Add to appropriate location (consultation context form or patient view)
4. Handle inline editing or modal form

**Verification:**
- Manual test CRUD operations
- Verify validation errors display

---

### [ ] Step 12: Theme System - Provider and Storage

Implement theme preference system.

**Files to create:**
- `src/lib/theme.ts` - Theme utilities
- `src/hooks/useTheme.ts` - Theme hook
- `src/components/providers/ThemeProvider.tsx`

**Files to modify:**
- `src/app/layout.tsx` - Wrap with ThemeProvider

**Tasks:**
1. Create theme utility functions:
   - `getSystemTheme()` using matchMedia
   - `applyTheme()` to set class on document
   - `resolveTheme(preference)` to compute actual theme
2. Create ThemeProvider:
   - Manage theme state
   - Sync with user settings
   - Listen for system theme changes
   - Apply theme on mount/change
3. Create useTheme hook for components
4. Wrap app with ThemeProvider

**Verification:**
- Toggle system preference, verify app follows
- Set explicit preference, verify it overrides
- Verify theme persists on reload

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
