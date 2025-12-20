# DictateMED MVP - Implementation Plan

**Version:** 1.1
**Date:** December 2025
**Based on:** spec.md v1.0, requirements.md v1.0

---

## Workflow Steps

### [x] Step: Requirements
<!-- chat-id: 5381099a-c05c-4a37-ba99-46c45fec8b9f -->
Create a Product Requirements Document (PRD) based on the feature description.
**Status:** Complete - see `requirements.md`

### [x] Step: Technical Specification
<!-- chat-id: c01c1e8f-17bf-4945-a4b5-e6763ff94a74 -->
Create a technical specification based on the PRD.
**Status:** Complete - see `spec.md`

### [x] Step: Planning
<!-- chat-id: ba45781e-e56b-4477-9afa-0e63c756ff61 -->
Create a detailed implementation plan based on `spec.md`.
**Status:** Complete - detailed tasks below

---

## Important Notes

> **Model IDs**: The spec references older Claude model IDs (`claude-3-opus-20240229`, `claude-3-sonnet-20240229`). Before implementation, verify current Bedrock model IDs and update accordingly. Current models may include `claude-sonnet-4-20250514` or newer.

> **Tests**: Unit and integration tests should be created alongside each feature, not batched at the end. Each task's verification section indicates when tests are expected.

---

## Implementation Tasks

### Phase 1: Foundation (Weeks 1-3)

#### [x] 1.1 Project Scaffolding
Create Next.js 14 project with TypeScript, Tailwind CSS, and essential tooling.

**Tasks:**
- Initialize Next.js 14 with App Router (`npx create-next-app@latest`)
- Configure TypeScript strict mode
- Set up Tailwind CSS with custom cardiology color palette
- Install and configure shadcn/ui components
- Set up ESLint + Prettier with medical terminology dictionary
- Configure Vitest for unit testing
- Configure Playwright for E2E testing
- Create `.gitignore` with node_modules, .env.local, .next, dist, coverage
- Create test directory structure (`tests/unit/`, `tests/integration/`, `tests/e2e/`)
- Create development setup script

**Files to create:**
- `package.json` - dependencies per spec section 1.2
- `tsconfig.json` - strict TypeScript config
- `tailwind.config.js` - custom theme
- `next.config.js` - PWA and security headers
- `vitest.config.ts` - test configuration
- `playwright.config.ts` - E2E configuration
- `.env.example` - environment template per spec section 10.1
- `scripts/setup-dev.sh` - development environment setup
- `tests/unit/.gitkeep`, `tests/integration/.gitkeep`, `tests/e2e/.gitkeep`

**Verification:**
```bash
npm run lint && npm run typecheck && npm run test
```

#### [x] 1.2 Database Schema & Prisma Setup
Set up PostgreSQL database with Prisma ORM and initial schema.

**Tasks:**
- Install Prisma and PostgreSQL client
- Create Prisma schema per spec section 4.1 (all models)
- Generate initial migration
- Create seed script for development data
- Set up Prisma client singleton
- Implement patient data encryption service for PHI fields

**Files to create:**
- `prisma/schema.prisma` - full schema from spec
- `prisma/seed.ts` - development seed data
- `src/infrastructure/db/client.ts` - Prisma singleton
- `src/infrastructure/db/encryption.ts` - PHI encryption/decryption service

**Verification:**
```bash
npx prisma migrate dev && npx prisma db seed
```

#### [x] 1.3 Auth0 Integration
Implement authentication with MFA support.

**Tasks:**
- Set up Auth0 tenant configuration
- Install `@auth0/nextjs-auth0`
- Create auth API routes
- Implement protected route middleware
- Add MFA enforcement settings
- Create login/logout pages
- Add session timeout (30 min)
- Implement audit logging for auth events

**Files to create:**
- `src/app/api/auth/[...auth0]/route.ts` - Auth0 handler
- `src/app/(auth)/login/page.tsx` - Login page
- `src/app/(auth)/callback/page.tsx` - OAuth callback
- `src/app/(auth)/logout/page.tsx` - Logout page
- `src/lib/auth.ts` - Auth helpers and middleware
- `src/domains/audit/audit-log.service.ts` - Audit logging

**Verification:**
- User can log in with MFA
- Session expires after 30 min inactivity
- Auth events logged in database

#### [x] 1.4 AWS S3 Configuration
Set up S3 bucket for document and audio storage.

**Tasks:**
- Configure S3 bucket with encryption (AES-256)
- Set up IAM role with minimal permissions
- Implement pre-signed URL generation
- Configure CORS policy for browser uploads (allow app domain)
- Set lifecycle rules (audio 24h, documents 90d)
- Document S3 bucket setup in setup script

**Files to create:**
- `src/infrastructure/s3/client.ts` - S3 client wrapper
- `src/infrastructure/s3/presigned-urls.ts` - URL generation
- `scripts/setup-s3.sh` - S3 bucket configuration script (optional, for documentation)

**Verification:**
- Can generate pre-signed upload URL
- Can generate pre-signed download URL
- Files encrypted at rest
- CORS allows uploads from localhost and production domain

#### [x] 1.5 Basic UI Layout
Create application shell with navigation and responsive layout.

**Tasks:**
- Create dashboard layout with sidebar
- Implement responsive navigation
- Add offline status indicator
- Create loading and error states
- Set up Zustand stores for UI state
- Implement notification center placeholder

**Files to create:**
- `src/app/(dashboard)/layout.tsx` - Dashboard layout
- `src/app/(dashboard)/page.tsx` - Dashboard home
- `src/components/layout/Sidebar.tsx` - Navigation sidebar
- `src/components/layout/Header.tsx` - Top header
- `src/components/layout/OfflineIndicator.tsx` - Offline badge
- `src/components/common/LoadingSpinner.tsx`
- `src/components/common/ErrorBoundary.tsx`
- `src/stores/ui.store.ts` - UI state management

**Verification:**
- Navigation works on desktop and tablet
- Offline indicator appears when disconnected
- Error boundary catches and displays errors

#### [x] 1.6 CI/CD Pipeline
Set up GitHub Actions for continuous integration.

**Tasks:**
- Create CI workflow (lint, typecheck, test)
- Create deployment workflow (staging, production)
- Configure environment secrets
- Add PR check requirements

**Files to create:**
- `.github/workflows/ci.yml` - CI pipeline
- `.github/workflows/deploy.yml` - Deployment pipeline

**Verification:**
- CI passes on all commits
- Deployment triggers on main branch

---

### Phase 2: Audio & Transcription (Weeks 4-6)

#### [x] 2.1 IndexedDB Offline Infrastructure
Set up IndexedDB schema and offline-first infrastructure for PWA functionality.

**Tasks:**
- Design IndexedDB schema for recordings, documents, and pending operations
- Implement generic IndexedDB wrapper with TypeScript types
- Create offline detection service
- Build sync manager base class for background operations
- Set up service worker foundation for offline caching

**Files to create:**
- `src/lib/offline-db.ts` - IndexedDB wrapper with typed collections
- `src/lib/offline-detection.ts` - Network status monitoring
- `src/lib/sync-manager.ts` - Base sync manager class
- `public/sw.js` - Service worker skeleton (expanded in Phase 6)

**Verification:**
- IndexedDB initializes without errors
- Can store and retrieve test data
- Offline detection fires appropriate events

#### [x] 2.2 Recording Interface
Build dual-mode audio recording UI with quality monitoring.

**Tasks:**
- Create mode selector (Ambient/Dictation)
- Implement audio recording controls (start/stop/pause)
- Add waveform visualizer
- Build audio quality indicator (SNR-based)
- Create consent dialog with type selection
- Implement recording timer display

**Files to create:**
- `src/app/(dashboard)/record/page.tsx` - Recording page
- `src/components/recording/RecordingControls.tsx` - Start/stop/pause
- `src/components/recording/ModeSelector.tsx` - Ambient/Dictation toggle
- `src/components/recording/WaveformVisualizer.tsx` - Audio waveform
- `src/components/recording/AudioQualityIndicator.tsx` - Quality meter
- `src/components/recording/ConsentDialog.tsx` - Patient consent
- `src/hooks/useRecording.ts` - Recording state hook
- `src/hooks/useAudioLevel.ts` - Audio level monitoring

**Verification:**
- Can switch between Ambient and Dictation modes
- Audio quality indicator updates in real-time
- Consent must be confirmed before recording starts

#### [x] 2.3 Offline Recording Queue
Implement offline recording storage using IndexedDB infrastructure.

**Tasks:**
- Extend IndexedDB schema for audio blobs
- Implement queue add/remove operations
- Create recording-specific sync manager
- Add offline-first recording workflow
- Show pending recordings indicator

**Files to create:**
- `src/hooks/useOfflineQueue.ts` - Queue management hook
- `src/domains/recording/offline-sync.ts` - Recording sync manager
- `src/stores/recording.store.ts` - Recording state

**Verification:**
- Recordings saved locally when offline
- Recordings sync automatically when online
- Pending count displayed in UI

#### [x] 2.4 Recording API Endpoints
Create backend API for recording management.

**Tasks:**
- Implement POST /api/recordings (create session, get upload URL)
- Implement POST /api/recordings/:id/upload (confirm upload)
- Implement GET /api/recordings/:id (get recording details)
- Implement GET /api/recordings (list recordings)
- Add request validation with Zod

**Files to create:**
- `src/app/api/recordings/route.ts` - Create/list recordings
- `src/app/api/recordings/[id]/route.ts` - Get recording
- `src/app/api/recordings/[id]/upload/route.ts` - Confirm upload
- `src/domains/recording/recording.service.ts` - Recording logic
- `src/domains/recording/recording.types.ts` - Type definitions
- `src/lib/validation.ts` - Zod schemas

**Verification:**
```bash
npm run test:integration -- recordings
```

#### [x] 2.5 Cardiology Keyterms Configuration
Create the 100-term cardiology vocabulary list for Deepgram.

**Tasks:**
- Compile anatomy terms (LAD, LCx, RCA, LMCA, D1, D2, OM1, OM2, PDA, PLV)
- Compile procedure terms (TAVI, TEER, PCI, CABG, ICD, CRT-D, CRT-P, PPM)
- Compile measurement terms (LVEF, RVEF, GLS, TAPSE, E/e', LVEDP)
- Compile condition terms (NSTEMI, STEMI, HFrEF, HFpEF, HFmrEF, AF, AFL)
- Compile device terms (DES, BMS, Watchman, Amulet, MitraClip, SAPIEN, Evolut)
- Compile medication terms (Ticagrelor, Prasugrel, Apixaban, Rivaroxaban, Entresto)
- Create seed script for keyterms

**Files to create:**
- `src/infrastructure/deepgram/keyterms.ts` - Full 100-term vocabulary list
- `scripts/seed-keyterms.ts` - Keyterm seeding utility

**Verification:**
- 100 keyterms defined and categorized
- Keyterms exportable for Deepgram API

#### [x] 2.6 Deepgram Integration
Integrate Deepgram Nova-3 Medical for transcription.

**Tasks:**
- Set up Deepgram SDK client
- Configure Nova-3 Medical model
- Integrate cardiology keyterms from 2.5
- Implement speaker diarization for ambient mode
- Configure PHI redaction (PCI, SSN, phone, email)
- Set up webhook callback URL

**Files to create:**
- `src/infrastructure/deepgram/client.ts` - Deepgram service
- `src/infrastructure/deepgram/types.ts` - Type definitions
- `src/domains/recording/transcription.service.ts` - Transcription logic

**Verification:**
- Transcription completes for 5-min audio sample
- Cardiology terms transcribed correctly
- Speaker diarization labels correct

#### [x] 2.7 Transcription Webhook
Handle Deepgram webhook callbacks.

**Tasks:**
- Create webhook endpoint
- Validate webhook signature
- Parse and store transcript results
- Update recording status
- Trigger downstream processing

**Files to create:**
- `src/app/api/transcription/webhook/route.ts` - Webhook handler
- `src/domains/recording/webhook.handler.ts` - Processing logic

**Verification:**
- Webhook updates recording status
- Transcript stored in database
- Error handling for failed transcriptions

#### [x] 2.8 Transcript Display
Show transcription results with speaker labels.

**Tasks:**
- Create transcript viewer component
- Display speaker-labeled segments
- Add timestamp navigation
- Implement search within transcript
- Show transcription confidence

**Files to create:**
- `src/components/recording/TranscriptViewer.tsx` - Transcript display
- `src/components/recording/SpeakerSegment.tsx` - Speaker segment

**Verification:**
- Transcript displays with speaker labels
- Clicking timestamp navigates to position
- Search highlights matching text

---

### Phase 3: Document Processing (Weeks 7-8)

#### [ ] 3.1 Document Upload Interface
Build document upload and preview UI.

**Tasks:**
- Create drag-and-drop file upload zone
- Support PDF and image formats (PNG, JPG)
- Show upload progress indicator
- Create document thumbnail preview
- Implement multi-file selection
- Add file size validation (20MB max)

**Files to create:**
- `src/components/documents/DocumentUploader.tsx` - Upload zone
- `src/components/documents/DocumentPreview.tsx` - Preview/thumbnail
- `src/components/documents/DocumentList.tsx` - Uploaded docs list

**Verification:**
- Can drag-and-drop PDF/images
- Progress indicator shows during upload
- Large files rejected with message

#### [ ] 3.2 Document API Endpoints
Create backend API for document management.

**Tasks:**
- Implement POST /api/documents (create, get upload URL)
- Implement POST /api/documents/:id/process (trigger extraction)
- Implement GET /api/documents/:id (get document details)
- Implement DELETE /api/documents/:id (remove document)

**Files to create:**
- `src/app/api/documents/route.ts` - Create/list documents
- `src/app/api/documents/[id]/route.ts` - Get/delete document
- `src/app/api/documents/[id]/process/route.ts` - Process document
- `src/domains/documents/document.service.ts` - Document logic
- `src/domains/documents/document.types.ts` - Type definitions

**Verification:**
```bash
npm run test:integration -- documents
```

#### [ ] 3.3 Clinical Data Extraction
Extract structured data from clinical documents using Claude Vision.

**Tasks:**
- Implement PDF-to-image conversion for processing
- Create extraction service using Claude Vision
- Build echo report extractor (LVEF, valve data)
- Build angiogram report extractor (stenosis, vessels)
- Build generic document extractor
- Store extracted data in database

**Files to create:**
- `src/domains/documents/extraction.service.ts` - Extraction orchestration
- `src/domains/documents/extractors/echo-report.ts` - Echo extraction
- `src/domains/documents/extractors/angiogram-report.ts` - Angio extraction
- `src/domains/documents/extractors/generic.ts` - Generic extraction
- `src/infrastructure/bedrock/vision.ts` - Claude Vision client

**Verification:**
- Echo report: LVEF, valve areas extracted correctly
- Angio report: Stenosis percentages per vessel extracted
- Extraction completes in <30 seconds

#### [ ] 3.4 Document-Letter Association
Link documents to letters for source traceability.

**Tasks:**
- Create document selection UI for letter creation
- Implement document-letter linking in database
- Show linked documents in letter review

**Files to create:**
- `src/components/documents/DocumentSelector.tsx` - Selection UI
- Update letter creation flow to include documents

**Verification:**
- Documents can be linked to letters
- Linked documents visible in letter review

---

### Phase 4: Letter Generation (Weeks 9-11)

#### [ ] 4.1 Letter Generation Prompts
Create AI prompts for each letter type.

**Tasks:**
- Design base prompt structure with safety constraints
- Create new patient consultation prompt
- Create follow-up consultation prompt
- Create angiogram procedure prompt
- Create echo report letter prompt
- Add style learning context injection

**Files to create:**
- `src/domains/letters/prompts/base.ts` - Base prompt structure
- `src/domains/letters/prompts/generation.ts` - Generation prompts
- `src/domains/letters/prompts/style-learning.ts` - Style context
- `src/domains/letters/templates/new-patient.ts` - Template structure
- `src/domains/letters/templates/follow-up.ts`
- `src/domains/letters/templates/angiogram-procedure.ts`
- `src/domains/letters/templates/echo-report.ts`

**Verification:**
- Each prompt generates coherent letter structure
- Style context properly influences output

#### [ ] 4.2 AWS Bedrock Integration
Integrate Claude models via AWS Bedrock.

**Tasks:**
- Set up Bedrock SDK client
- Implement model invocation
- Add error handling and retries
- Configure streaming for long responses
- Implement response parsing

**Files to create:**
- `src/infrastructure/bedrock/client.ts` - Bedrock service
- `src/infrastructure/bedrock/types.ts` - Type definitions

**Verification:**
- Can invoke Claude Sonnet model
- Can invoke Claude Opus model
- Responses parsed correctly

#### [ ] 4.3 Intelligent Model Selection
Implement context-aware model routing.

**Tasks:**
- Implement selection logic per spec section 6.3
- Use Opus for: new patient, complex procedures, conflicting data, low confidence
- Use Sonnet for: follow-up, standard procedures, high confidence
- Log model selection decisions

**Files to create:**
- `src/infrastructure/bedrock/model-selector.ts` - Selection logic

**Verification:**
- New patient letters use Opus
- Follow-up letters use Sonnet
- Selection logged for analysis

#### [ ] 4.4 PHI Obfuscation Pipeline
Implement PHI tokenization before LLM processing.

**Tasks:**
- Create token mapping system
- Implement obfuscation for: names, DOB, Medicare, address, phone, email
- Create deobfuscation for final output
- Store token mappings securely (not in logs)

**Files to create:**
- `src/domains/safety/phi-obfuscator.ts` - Obfuscation service
- `src/domains/safety/phi-obfuscator.test.ts` - Unit tests

**Verification:**
- PHI replaced with tokens before LLM
- Tokens replaced with values in output
- No PHI visible in logs

#### [ ] 4.5 Source Anchoring System
Link generated text segments to their sources.

**Tasks:**
- Design source anchor data structure
- Implement source tracking during generation
- Create anchor extraction from Claude response
- Store anchors with letter

**Files to create:**
- `src/domains/letters/source-anchor.service.ts` - Anchor management
- `src/domains/letters/letter.types.ts` - Type definitions

**Verification:**
- Clinical facts have source anchors
- Anchors point to transcript or document
- Orphan statements flagged

#### [ ] 4.6 Clinical Value Extraction
Extract and structure critical clinical values.

**Tasks:**
- Implement regex-based value extraction per spec section 7.2
- Extract cardiac function (LVEF, RVEF, GLS)
- Extract coronary findings (stenosis percentages)
- Extract valvular data (gradients, areas)
- Extract medications (name, dose, frequency)

**Files to create:**
- `src/domains/safety/value-extractor.ts` - Value extraction
- `src/domains/safety/cardiology-terms.ts` - Term patterns
- `src/domains/safety/value-extractor.test.ts` - Unit tests

**Verification:**
- LVEF extracted from "LVEF 45%"
- LAD stenosis extracted from "LAD 80% stenosis"
- Medications extracted with dosages

#### [ ] 4.7 Hallucination Detection
Implement critic model for cross-validation.

**Tasks:**
- Create critic prompt template
- Implement fact comparison against sources
- Flag unsupported clinical statements
- Categorize flags by severity (warning/critical)

**Files to create:**
- `src/domains/safety/hallucination-detector.ts` - Detection service
- `src/domains/letters/prompts/critic.ts` - Critic prompt

**Verification:**
- Fabricated facts flagged
- Supported facts not flagged
- Processing adds <3 seconds

#### [ ] 4.8 Clinical Concept Extraction
Extract diagnoses, medications, procedures, follow-up.

**Tasks:**
- Extract diagnoses from letter
- Extract medication list
- Extract procedures mentioned
- Extract follow-up recommendations

**Files to create:**
- `src/domains/safety/clinical-concepts.ts` - Concept extraction

**Verification:**
- Diagnoses listed correctly
- Medications include dose/frequency
- Follow-up timeline captured

#### [ ] 4.9 Letter API Endpoints
Create backend API for letter management.

**Tasks:**
- Implement POST /api/letters (create, trigger generation)
- Implement GET /api/letters/:id (get letter details)
- Implement PATCH /api/letters/:id (update during review)
- Implement POST /api/letters/:id/approve (finalize)
- Implement GET /api/letters (list letters)

**Files to create:**
- `src/app/api/letters/route.ts` - Create/list letters
- `src/app/api/letters/[id]/route.ts` - Get/update letter
- `src/app/api/letters/[id]/approve/route.ts` - Approve letter
- `src/domains/letters/letter.service.ts` - Letter logic
- `src/domains/letters/generation.service.ts` - Generation orchestration

**Verification:**
```bash
npm run test:integration -- letters
```

---

### Phase 5: Review Interface (Weeks 12-13)

#### [ ] 5.1 Letter Editor
Create rich text editor for letter review.

**Tasks:**
- Implement text editing with formatting
- Add section management (add/remove/reorder)
- Create undo/redo functionality
- Track edits for diff generation
- Add quick phrase insertion

**Files to create:**
- `src/components/letters/LetterEditor.tsx` - Main editor
- `src/hooks/useLetter.ts` - Letter state management
- `src/stores/letter.store.ts` - Letter store

**Verification:**
- Can edit any text in letter
- Undo/redo works
- Edits tracked for provenance

#### [ ] 5.2 Source Panel
Show sources on click with excerpts.

**Tasks:**
- Create clickable text segments
- Build source panel with excerpt display
- Show transcript timestamp or document page
- Highlight source in context

**Files to create:**
- `src/components/letters/SourcePanel.tsx` - Source viewer
- `src/components/letters/SourceAnchor.tsx` - Clickable segment

**Verification:**
- Clicking text shows source panel
- Source excerpt highlighted
- Can navigate to full source

#### [ ] 5.3 Verification Panel
Build mandatory value confirmation UI.

**Tasks:**
- Display extracted clinical values
- Show source for each value
- Implement verification checkboxes
- Block approval until all verified
- Track verification timestamps

**Files to create:**
- `src/components/letters/VerificationPanel.tsx` - Value list
- `src/components/letters/ValueItem.tsx` - Single value row

**Verification:**
- All critical values displayed
- Cannot approve with unverified values
- Verification timestamps recorded

#### [ ] 5.4 Hallucination Flag Display
Show and manage hallucination warnings.

**Tasks:**
- Display flagged text with warning icons
- Show reason for flag
- Allow dismissal with confirmation
- Track dismissals in audit

**Files to create:**
- `src/components/letters/HallucinationFlag.tsx` - Flag display

**Verification:**
- Flags visible on suspicious text
- Can dismiss with reason
- Dismissals logged

#### [ ] 5.5 Differential View
Implement change-only viewing mode.

**Tasks:**
- Compare generated letter to template/previous
- Highlight changed sections
- Create collapsed "changes only" view
- Allow view mode toggle

**Files to create:**
- `src/components/letters/DifferentialView.tsx` - Diff display

**Verification:**
- Changes highlighted in yellow
- Changes-only mode collapses unchanged
- Can switch between view modes

#### [ ] 5.6 Clinical Concepts Panel
Display extracted clinical concepts.

**Tasks:**
- Show diagnoses list
- Show medications with sources
- Show procedures
- Show follow-up recommendations

**Files to create:**
- `src/components/letters/ClinicalConceptsPanel.tsx` - Concepts display

**Verification:**
- All concept categories displayed
- Each concept linked to source

#### [ ] 5.7 Letter Review Page
Assemble complete review interface.

**Tasks:**
- Create page layout with all panels
- Implement approval workflow
- Add save draft functionality
- Create review timer tracking
- Build navigation between letters

**Files to create:**
- `src/app/(dashboard)/letters/[id]/page.tsx` - Review page
- `src/app/(dashboard)/letters/page.tsx` - Letters list
- `src/app/(dashboard)/letters/new/page.tsx` - New letter wizard

**Verification:**
- Full review workflow functional
- Review time tracked
- Approval creates provenance

#### [ ] 5.8 Provenance Report
Generate downloadable audit trail.

**Tasks:**
- Create provenance data structure
- Generate cryptographic hash for integrity
- Build provenance viewer page
- Add PDF export capability

**Files to create:**
- `src/app/api/letters/[id]/provenance/route.ts` - Provenance API
- `src/app/(dashboard)/letters/[id]/provenance/page.tsx` - View page
- `src/domains/audit/provenance.service.ts` - Provenance logic

**Verification:**
- Provenance contains all required fields
- Hash validates integrity
- Can export as PDF

---

### Phase 6: Polish & Pilot Prep (Weeks 14-16)

#### [ ] 6.1 Style Learning System
Implement physician style profile learning.

**Tasks:**
- Analyze approved letters for style patterns
- Build style profile per physician
- Inject style context into prompts
- Display style confidence indicator
- Allow style reset option

**Files to create:**
- `src/domains/style/style.service.ts` - Style management
- `src/domains/style/style-analyzer.ts` - Pattern analysis
- `src/domains/style/style.types.ts` - Type definitions

**Verification:**
- Style confidence increases with usage
- Generated letters match physician style
- Style can be reset

#### [ ] 6.2 Notification Center
Build in-app notification system.

**Tasks:**
- Create notification store
- Build notification dropdown UI
- Implement notification types (letter ready, errors)
- Add notification preferences
- Create email notification hooks (optional)

**Files to create:**
- `src/components/layout/NotificationCenter.tsx` - Notification UI
- `src/hooks/useNotifications.ts` - Notification hook
- `src/lib/notifications.ts` - Notification helpers

**Verification:**
- Notifications appear for letter completion
- Can clear/dismiss notifications
- Preferences honored

#### [ ] 6.3 Letter History & Search
Build letter management with search/filter.

**Tasks:**
- Create letter list with pagination
- Add search by patient/date
- Implement status filters
- Show letter preview cards
- Add bulk actions (export, delete)

**Files to create:**
- `src/components/letters/LetterCard.tsx` - Letter preview
- `src/components/letters/LetterFilters.tsx` - Filter controls

**Verification:**
- Search finds letters by content
- Filters work correctly
- Pagination loads efficiently

#### [ ] 6.4 Patient Management (Minimal)
Implement minimal patient tracking for letter association.

**Tasks:**
- Create patients list page with search
- Implement patient creation/editing
- Add patient selection to letter creation flow
- Ensure PHI encryption for patient data
- Enable patient-based letter filtering

**Files to create:**
- `src/app/(dashboard)/patients/page.tsx` - Patient list
- `src/components/patients/PatientList.tsx` - Patient table
- `src/components/patients/PatientForm.tsx` - Create/edit form
- `src/domains/patients/patient.service.ts` - Patient logic

**Verification:**
- Can create and search patients
- Patient data encrypted in database
- Letters can be linked to patients

#### [ ] 6.5 Practice Settings (Multi-User)
Implement practice-level configuration.

**Tasks:**
- Create practice settings page
- Implement letterhead upload
- Add user management for admins
- Configure default settings
- Build usage reporting dashboard

**Files to create:**
- `src/app/(dashboard)/settings/practice/page.tsx` - Practice settings
- `src/components/settings/UserManagement.tsx` - User CRUD
- `src/components/settings/LetterheadUpload.tsx` - Letterhead config

**Verification:**
- Admin can add/remove users
- Letterhead appears on letters
- Usage stats visible

#### [ ] 6.6 User Settings
Build individual user preferences.

**Tasks:**
- Create user settings page
- Implement signature upload
- Add style preferences
- Configure notification preferences
- Handle account deletion (GDPR-aligned)

**Files to create:**
- `src/app/(dashboard)/settings/page.tsx` - User settings
- `src/app/(dashboard)/settings/style/page.tsx` - Style settings
- `src/components/settings/SignatureUpload.tsx`

**Verification:**
- Signature appears on letters
- Settings persist
- Account deletion removes all data

#### [ ] 6.7 PWA Configuration
Make application installable and offline-capable.

**Tasks:**
- Expand service worker from Phase 2.1 skeleton
- Create PWA manifest with app metadata
- Add install prompt handling
- Configure caching strategy (network-first for API, cache-first for assets)
- Integrate with Next.js using next-pwa or similar
- Test offline functionality end-to-end

**Files to create:**
- `public/manifest.json` - PWA manifest
- `public/icons/` - App icons (192x192, 512x512)
- Update `public/sw.js` - Full service worker implementation
- `next.config.js` - PWA plugin configuration

**Verification:**
- App installable on Chrome/Safari
- Offline indicator works
- Recording works offline
- Cached assets load when offline

#### [ ] 6.8 Error Handling & Recovery
Implement comprehensive error handling.

**Tasks:**
- Create error boundary with recovery
- Add retry logic for failed operations
- Implement graceful degradation
- Add error reporting/logging
- Create user-friendly error messages

**Files to create:**
- `src/components/common/ErrorBoundary.tsx` - Enhanced
- `src/lib/errors.ts` - Error classes
- `src/lib/logger.ts` - Structured logging

**Verification:**
- Errors caught and displayed gracefully
- Failed operations can be retried
- Errors logged for debugging

#### [ ] 6.9 Performance Optimization
Optimize for <200ms UI response.

**Tasks:**
- Implement code splitting
- Leverage React Server Components throughout
- Optimize bundle size (analyze with next/bundle-analyzer)
- Add loading states and Suspense boundaries
- Profile and fix bottlenecks
- Implement streaming for letter generation responses

**Verification:**
- UI response <200ms
- Initial load <3 seconds
- Lighthouse score >90

#### [ ] 6.10 Onboarding Flow
Create first-time user onboarding experience.

**Tasks:**
- Create step-by-step onboarding wizard
- Build in-app help tooltips for key features
- Create sample letter walkthrough
- Add contextual help triggers

**Files to create:**
- `src/components/onboarding/OnboardingFlow.tsx`
- `src/components/onboarding/OnboardingStep.tsx`
- `src/components/common/HelpTooltip.tsx`

**Verification:**
- New users complete onboarding
- Help available in context
- Pilot users can self-onboard

#### [ ] 6.11 Final Testing & Pilot Deploy
Complete testing and deploy for pilot.

**Tasks:**
- Run full E2E test suite
- Perform security review
- Load test with expected volume
- Deploy to production environment
- Onboard first 5 pilot users
- Monitor and address issues

**Verification:**
- All tests passing
- No critical security issues
- System handles expected load
- First users successfully onboarded

---

## Verification Commands

```bash
# Lint and format
npm run lint
npm run format:check

# Type checking
npm run typecheck

# Unit tests
npm run test

# Integration tests
npm run test:integration

# E2E tests
npm run test:e2e

# All checks (CI)
npm run verify

# Database
npx prisma migrate dev
npx prisma db seed
```

---

## Risk Mitigations

| Risk | Mitigation |
|------|------------|
| Deepgram accuracy insufficient | Custom keyterm list (100 terms), fallback to AssemblyAI |
| Claude hallucinations | Critic model validation, source anchoring, mandatory verification |
| Offline sync conflicts | Last-write-wins with conflict notification |
| PHI exposure | Tokenization before LLM, Deepgram redaction, BAA coverage |
| Slow transcription | Background processing, notification system |
| Model cost overruns | Intelligent Sonnet/Opus selection, usage monitoring |

---

## Success Criteria

**Phase Completion:**
- Phase 1: User can log in, navigate app, CI passes
- Phase 2: 20-minute recording transcribed with <5% WER
- Phase 3: Echo/angio reports extracted with >95% accuracy
- Phase 4: Letters generated in <30 seconds with source anchors
- Phase 5: Full review workflow, <3 minute average review time
- Phase 6: PWA installable, pilot users onboarded

**MVP Complete:**
- 10 pilot users active
- >60% using ambient mode
- Zero critical errors
- <3 minute average review time
- NPS >50

---

## Task Summary

| Phase | Tasks | Focus |
|-------|-------|-------|
| Phase 1 | 1.1 - 1.6 (6 tasks) | Foundation: scaffolding, database, auth, S3, UI, CI/CD |
| Phase 2 | 2.1 - 2.8 (8 tasks) | Audio: offline infra, recording, APIs, keyterms, Deepgram, webhook, display |
| Phase 3 | 3.1 - 3.4 (4 tasks) | Documents: upload, APIs, extraction, linking |
| Phase 4 | 4.1 - 4.9 (9 tasks) | Letters: prompts, Bedrock, model selection, PHI, anchoring, values, hallucination, concepts, APIs |
| Phase 5 | 5.1 - 5.8 (8 tasks) | Review: editor, source panel, verification, flags, diff view, concepts, review page, provenance |
| Phase 6 | 6.1 - 6.11 (11 tasks) | Polish: style, notifications, search, patients, practice settings, user settings, PWA, errors, performance, onboarding, deploy |

**Total: 46 tasks across 6 phases**

---

*Implementation Plan v1.1 | DictateMED MVP | December 2025*
