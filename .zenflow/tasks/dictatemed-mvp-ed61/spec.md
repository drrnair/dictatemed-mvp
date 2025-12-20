# DictateMED MVP - Technical Specification

**Version:** 1.0
**Date:** December 2025
**Status:** Draft
**Based on:** requirements.md v1.0

---

## 1. Technical Context

### 1.1 Technology Stack

| Layer | Technology | Version | Rationale |
|-------|------------|---------|-----------|
| **Frontend** | React | 18.x | PWA support, component ecosystem, Claude Code efficiency |
| **Frontend Framework** | Next.js | 14.x | SSR, API routes, excellent DX, App Router |
| **Styling** | Tailwind CSS | 3.x | Rapid UI development, responsive design |
| **UI Components** | shadcn/ui | Latest | Accessible, composable, Tailwind-native |
| **State Management** | Zustand | 4.x | Lightweight, TypeScript-first |
| **Backend Runtime** | Node.js | 20.x LTS | TypeScript support, AWS SDK compatibility |
| **API Layer** | Next.js API Routes | 14.x | Co-located with frontend, serverless-ready |
| **Database** | PostgreSQL | 15.x | ACID compliance, JSONB for flexible schemas |
| **ORM** | Prisma | 5.x | Type-safe queries, migrations, excellent DX |
| **Authentication** | Auth0 | Latest | MFA support, healthcare compliance, SOC2 |
| **File Storage** | AWS S3 | - | Document/audio storage, encryption at rest |
| **Transcription** | Deepgram Nova-3 Medical | - | 63.7% better WER, medical keyterms, diarization |
| **AI/LLM** | Claude via AWS Bedrock | Opus/Sonnet | BAA coverage, zero retention, best quality |
| **Hosting** | AWS (Sydney) | ap-southeast-2 | Australian data residency requirement |
| **Deployment** | AWS Amplify or Vercel | - | Next.js optimized, edge functions |

### 1.2 Key Dependencies

```json
{
  "dependencies": {
    "next": "^14.0.0",
    "react": "^18.2.0",
    "react-dom": "^18.2.0",
    "@prisma/client": "^5.0.0",
    "@auth0/nextjs-auth0": "^3.0.0",
    "@aws-sdk/client-s3": "^3.0.0",
    "@aws-sdk/client-bedrock-runtime": "^3.0.0",
    "@deepgram/sdk": "^3.0.0",
    "zustand": "^4.4.0",
    "zod": "^3.22.0",
    "date-fns": "^3.0.0",
    "uuid": "^9.0.0"
  },
  "devDependencies": {
    "typescript": "^5.3.0",
    "prisma": "^5.0.0",
    "@types/node": "^20.0.0",
    "@types/react": "^18.2.0",
    "eslint": "^8.0.0",
    "eslint-config-next": "^14.0.0",
    "vitest": "^1.0.0",
    "@testing-library/react": "^14.0.0",
    "playwright": "^1.40.0"
  }
}
```

### 1.3 External Service Contracts

#### Deepgram API
- **Endpoint:** `https://api.deepgram.com/v1/listen`
- **Auth:** API Key (Bearer token)
- **Model:** `nova-3-medical`
- **Features:** `diarize=true`, `smart_format=true`, `redact=pci,ssn,numbers`
- **Keyterms:** Custom cardiology vocabulary (100 terms)
- **BAA:** Required before production

#### AWS Bedrock (Claude)
- **Region:** ap-southeast-2 (Sydney)
- **Models:** `anthropic.claude-3-opus-20240229`, `anthropic.claude-3-sonnet-20240229`
- **Auth:** IAM roles via AWS SDK
- **BAA:** Covered under AWS BAA

#### Auth0
- **Tenant:** Dedicated (healthcare compliance)
- **MFA:** Required for all users
- **Connections:** Username/password, SSO (optional)
- **RBAC:** Admin, Specialist roles

---

## 2. Implementation Approach

### 2.1 Architecture Pattern

**Modular Monolith** with clear domain boundaries, designed for future extraction:

```
┌─────────────────────────────────────────────────────────────┐
│                     Next.js Application                      │
├─────────────────────────────────────────────────────────────┤
│  ┌─────────┐  ┌─────────┐  ┌─────────┐  ┌─────────────────┐ │
│  │   UI    │  │  Auth   │  │  Audio  │  │    Document     │ │
│  │ Layer   │  │ Module  │  │ Module  │  │     Module      │ │
│  └────┬────┘  └────┬────┘  └────┬────┘  └────────┬────────┘ │
│       │            │            │                │          │
│  ┌────┴────────────┴────────────┴────────────────┴────────┐ │
│  │                    API Layer (tRPC-style)               │ │
│  └─────────────────────────────┬───────────────────────────┘ │
│                                │                             │
│  ┌─────────────────────────────┴───────────────────────────┐ │
│  │                    Domain Services                       │ │
│  │  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌─────────────┐ │ │
│  │  │Recording │ │ Letter   │ │  Safety  │ │   Style     │ │ │
│  │  │ Service  │ │ Service  │ │ Service  │ │  Service    │ │ │
│  │  └──────────┘ └──────────┘ └──────────┘ └─────────────┘ │ │
│  └─────────────────────────────────────────────────────────┘ │
│                                │                             │
│  ┌─────────────────────────────┴───────────────────────────┐ │
│  │                  Infrastructure Layer                    │ │
│  │  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌─────────────┐ │ │
│  │  │ Deepgram │ │ Bedrock  │ │   S3     │ │  Prisma/DB  │ │ │
│  │  │  Client  │ │  Client  │ │  Client  │ │   Client    │ │ │
│  │  └──────────┘ └──────────┘ └──────────┘ └─────────────┘ │ │
│  └─────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────┘
```

### 2.2 Key Design Decisions

#### Decision 1: Next.js App Router
**Choice:** Use Next.js 14 App Router with Server Components
**Rationale:**
- Server Components reduce client bundle size
- API routes co-located with app
- Built-in streaming for AI responses
- Serverless deployment ready

#### Decision 2: Domain-Driven Modules
**Choice:** Organize code by domain, not by technical layer
**Rationale:**
- Clear ownership boundaries
- Easier to reason about
- Prepares for future microservices if needed

#### Decision 3: PHI Handling Strategy
**Choice:** Tokenize PHI before LLM, detokenize after
**Rationale:**
- Defense in depth beyond BAA
- Audit trail shows only tokens
- Reduces liability surface

#### Decision 4: Offline-First Recording
**Choice:** Record to IndexedDB, sync when online
**Rationale:**
- Hospital networks unreliable
- No lost recordings
- PWA requirement

#### Decision 5: Background Processing via Queues
**Choice:** Use AWS SQS + Lambda for heavy processing
**Rationale:**
- Transcription can take minutes
- Don't block user workflows
- Reliable retry mechanism

---

## 3. Source Code Structure

```
dictatemed-mvp/
├── .github/
│   └── workflows/
│       ├── ci.yml                    # Lint, test, type-check
│       └── deploy.yml                # Production deployment
│
├── prisma/
│   ├── schema.prisma                 # Database schema
│   ├── migrations/                   # Migration history
│   └── seed.ts                       # Dev data seeding
│
├── public/
│   ├── manifest.json                 # PWA manifest
│   ├── sw.js                         # Service worker
│   └── icons/                        # App icons
│
├── src/
│   ├── app/                          # Next.js App Router
│   │   ├── (auth)/                   # Auth route group
│   │   │   ├── login/page.tsx
│   │   │   ├── callback/page.tsx
│   │   │   └── logout/page.tsx
│   │   │
│   │   ├── (dashboard)/              # Authenticated routes
│   │   │   ├── layout.tsx            # Dashboard layout with nav
│   │   │   ├── page.tsx              # Dashboard home
│   │   │   ├── record/
│   │   │   │   └── page.tsx          # Recording interface
│   │   │   ├── letters/
│   │   │   │   ├── page.tsx          # Letter list
│   │   │   │   ├── [id]/
│   │   │   │   │   ├── page.tsx      # Letter review/edit
│   │   │   │   │   └── provenance/page.tsx
│   │   │   │   └── new/page.tsx      # New letter wizard
│   │   │   ├── settings/
│   │   │   │   ├── page.tsx          # User settings
│   │   │   │   ├── practice/page.tsx # Practice settings (admin)
│   │   │   │   └── style/page.tsx    # Style preferences
│   │   │   └── patients/
│   │   │       └── page.tsx          # Patient list (minimal)
│   │   │
│   │   ├── api/                      # API routes
│   │   │   ├── auth/[...auth0]/route.ts
│   │   │   ├── recordings/
│   │   │   │   ├── route.ts          # POST create, GET list
│   │   │   │   ├── [id]/route.ts     # GET, DELETE
│   │   │   │   └── [id]/upload/route.ts
│   │   │   ├── documents/
│   │   │   │   ├── route.ts          # POST upload
│   │   │   │   └── [id]/route.ts
│   │   │   ├── letters/
│   │   │   │   ├── route.ts          # POST create, GET list
│   │   │   │   ├── [id]/route.ts     # GET, PATCH, DELETE
│   │   │   │   ├── [id]/approve/route.ts
│   │   │   │   └── [id]/provenance/route.ts
│   │   │   ├── transcription/
│   │   │   │   └── webhook/route.ts  # Deepgram callback
│   │   │   └── health/route.ts
│   │   │
│   │   ├── layout.tsx                # Root layout
│   │   ├── page.tsx                  # Landing/redirect
│   │   └── globals.css
│   │
│   ├── components/                   # React components
│   │   ├── ui/                       # shadcn/ui primitives
│   │   │   ├── button.tsx
│   │   │   ├── input.tsx
│   │   │   ├── dialog.tsx
│   │   │   └── ...
│   │   │
│   │   ├── recording/
│   │   │   ├── RecordingControls.tsx
│   │   │   ├── AudioQualityIndicator.tsx
│   │   │   ├── ModeSelector.tsx
│   │   │   ├── ConsentDialog.tsx
│   │   │   └── WaveformVisualizer.tsx
│   │   │
│   │   ├── documents/
│   │   │   ├── DocumentUploader.tsx
│   │   │   ├── DocumentPreview.tsx
│   │   │   └── DocumentList.tsx
│   │   │
│   │   ├── letters/
│   │   │   ├── LetterEditor.tsx
│   │   │   ├── SourcePanel.tsx
│   │   │   ├── VerificationPanel.tsx
│   │   │   ├── DifferentialView.tsx
│   │   │   ├── ClinicalConceptsPanel.tsx
│   │   │   └── LetterCard.tsx
│   │   │
│   │   ├── layout/
│   │   │   ├── Sidebar.tsx
│   │   │   ├── Header.tsx
│   │   │   ├── OfflineIndicator.tsx
│   │   │   └── NotificationCenter.tsx
│   │   │
│   │   └── common/
│   │       ├── LoadingSpinner.tsx
│   │       ├── ErrorBoundary.tsx
│   │       └── ConfirmDialog.tsx
│   │
│   ├── domains/                      # Domain logic
│   │   ├── recording/
│   │   │   ├── recording.service.ts
│   │   │   ├── recording.types.ts
│   │   │   ├── transcription.service.ts
│   │   │   └── audio-quality.ts
│   │   │
│   │   ├── documents/
│   │   │   ├── document.service.ts
│   │   │   ├── document.types.ts
│   │   │   ├── extraction.service.ts
│   │   │   └── extractors/
│   │   │       ├── echo-report.ts
│   │   │       ├── angiogram-report.ts
│   │   │       └── generic.ts
│   │   │
│   │   ├── letters/
│   │   │   ├── letter.service.ts
│   │   │   ├── letter.types.ts
│   │   │   ├── generation.service.ts
│   │   │   ├── templates/
│   │   │   │   ├── new-patient.ts
│   │   │   │   ├── follow-up.ts
│   │   │   │   ├── angiogram-procedure.ts
│   │   │   │   └── echo-report.ts
│   │   │   └── prompts/
│   │   │       ├── generation.ts
│   │   │       ├── style-learning.ts
│   │   │       └── critic.ts
│   │   │
│   │   ├── safety/
│   │   │   ├── phi-obfuscator.ts
│   │   │   ├── value-extractor.ts
│   │   │   ├── hallucination-detector.ts
│   │   │   ├── clinical-concepts.ts
│   │   │   └── cardiology-terms.ts
│   │   │
│   │   ├── style/
│   │   │   ├── style.service.ts
│   │   │   ├── style.types.ts
│   │   │   └── style-analyzer.ts
│   │   │
│   │   └── audit/
│   │       ├── provenance.service.ts
│   │       └── audit-log.service.ts
│   │
│   ├── infrastructure/               # External service clients
│   │   ├── deepgram/
│   │   │   ├── client.ts
│   │   │   ├── types.ts
│   │   │   └── keyterms.ts           # Cardiology vocabulary
│   │   │
│   │   ├── bedrock/
│   │   │   ├── client.ts
│   │   │   ├── types.ts
│   │   │   └── model-selector.ts     # Opus vs Sonnet logic
│   │   │
│   │   ├── s3/
│   │   │   ├── client.ts
│   │   │   └── presigned-urls.ts
│   │   │
│   │   └── db/
│   │       └── client.ts             # Prisma client singleton
│   │
│   ├── lib/                          # Shared utilities
│   │   ├── auth.ts                   # Auth0 helpers
│   │   ├── validation.ts             # Zod schemas
│   │   ├── errors.ts                 # Custom error classes
│   │   ├── logger.ts                 # Structured logging
│   │   └── utils.ts                  # General utilities
│   │
│   ├── hooks/                        # React hooks
│   │   ├── useRecording.ts
│   │   ├── useAudioLevel.ts
│   │   ├── useOfflineQueue.ts
│   │   ├── useLetter.ts
│   │   └── useNotifications.ts
│   │
│   └── stores/                       # Zustand stores
│       ├── recording.store.ts
│       ├── letter.store.ts
│       └── ui.store.ts
│
├── tests/
│   ├── unit/
│   │   ├── domains/
│   │   └── lib/
│   ├── integration/
│   │   └── api/
│   └── e2e/
│       └── flows/
│
├── scripts/
│   ├── setup-dev.sh
│   └── seed-keyterms.ts
│
├── .env.example
├── .env.local                        # Local dev (gitignored)
├── .gitignore
├── next.config.js
├── tailwind.config.js
├── tsconfig.json
├── vitest.config.ts
├── playwright.config.ts
├── package.json
└── README.md
```

---

## 4. Data Models

### 4.1 Database Schema (Prisma)

```prisma
// prisma/schema.prisma

generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

// ============ Organization & Users ============

model Practice {
  id          String   @id @default(uuid())
  name        String
  settings    Json     @default("{}")
  letterhead  String?  // S3 key for letterhead image
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt

  users       User[]

  @@map("practices")
}

model User {
  id            String    @id @default(uuid())
  auth0Id       String    @unique
  email         String    @unique
  name          String
  role          UserRole  @default(SPECIALIST)
  signature     String?   // S3 key for signature image
  styleProfile  Json      @default("{}") // Learned style preferences
  settings      Json      @default("{}")
  practiceId    String
  practice      Practice  @relation(fields: [practiceId], references: [id])
  createdAt     DateTime  @default(now())
  updatedAt     DateTime  @updatedAt
  lastLoginAt   DateTime?

  recordings    Recording[]
  documents     Document[]
  letters       Letter[]
  auditLogs     AuditLog[]

  @@map("users")
}

enum UserRole {
  ADMIN
  SPECIALIST
}

// ============ Patients ============

model Patient {
  id              String   @id @default(uuid())
  // PHI stored encrypted, minimal data
  encryptedData   String   // Encrypted JSON: name, dob, medicare, etc.
  practiceId      String
  createdAt       DateTime @default(now())
  updatedAt       DateTime @updatedAt

  recordings      Recording[]
  documents       Document[]
  letters         Letter[]

  @@map("patients")
}

// ============ Recordings ============

model Recording {
  id              String          @id @default(uuid())
  userId          String
  user            User            @relation(fields: [userId], references: [id])
  patientId       String?
  patient         Patient?        @relation(fields: [patientId], references: [id])

  mode            RecordingMode
  status          RecordingStatus @default(UPLOADING)

  // Audio metadata
  durationSeconds Int?
  audioQuality    String?         // excellent/good/fair/poor
  s3AudioKey      String?

  // Consent
  consentType     ConsentType?
  consentAt       DateTime?

  // Transcription
  transcriptRaw   Json?           // Full Deepgram response
  transcriptText  String?         // Plain text transcript
  speakers        Json?           // Speaker diarization data

  // Processing
  processingError String?
  processedAt     DateTime?

  createdAt       DateTime        @default(now())
  updatedAt       DateTime        @updatedAt

  letters         Letter[]

  @@index([userId, createdAt])
  @@map("recordings")
}

enum RecordingMode {
  AMBIENT
  DICTATION
}

enum RecordingStatus {
  UPLOADING
  UPLOADED
  TRANSCRIBING
  TRANSCRIBED
  FAILED
}

enum ConsentType {
  VERBAL
  WRITTEN
  STANDING
}

// ============ Documents ============

model Document {
  id              String         @id @default(uuid())
  userId          String
  user            User           @relation(fields: [userId], references: [id])
  patientId       String?
  patient         Patient?       @relation(fields: [patientId], references: [id])

  filename        String
  mimeType        String
  sizeBytes       Int
  s3Key           String

  documentType    DocumentType?
  status          DocumentStatus @default(UPLOADING)

  // Extraction results
  extractedData   Json?          // Structured clinical data
  extractedText   String?        // OCR/parsed text
  processingError String?
  processedAt     DateTime?

  createdAt       DateTime       @default(now())
  updatedAt       DateTime       @updatedAt

  letterDocuments LetterDocument[]

  @@index([userId, createdAt])
  @@map("documents")
}

enum DocumentType {
  ECHO_REPORT
  ANGIOGRAM_REPORT
  ECG_REPORT
  HOLTER_REPORT
  REFERRAL_LETTER
  OTHER
}

enum DocumentStatus {
  UPLOADING
  UPLOADED
  PROCESSING
  PROCESSED
  FAILED
}

// ============ Letters ============

model Letter {
  id                String        @id @default(uuid())
  userId            String
  user              User          @relation(fields: [userId], references: [id])
  patientId         String?
  patient           Patient?      @relation(fields: [patientId], references: [id])
  recordingId       String?
  recording         Recording?    @relation(fields: [recordingId], references: [id])

  letterType        LetterType
  status            LetterStatus  @default(GENERATING)

  // Content
  contentDraft      String?       // Initial AI-generated content
  contentFinal      String?       // After physician edits
  contentDiff       Json?         // Diff between draft and final

  // Source anchoring
  sourceAnchors     Json?         // Map of text segments to sources

  // Clinical safety
  extractedValues   Json?         // LVEF, stenosis, etc.
  verifiedValues    Json?         // Which values physician confirmed
  hallucinationFlags Json?        // Critic model findings
  clinicalConcepts  Json?         // Diagnoses, meds, procedures

  // Model tracking
  primaryModel      String?       // claude-3-opus, claude-3-sonnet
  criticModel       String?       // Model used for hallucination check
  styleConfidence   Float?        // 0-1 confidence in style match

  // Timing
  generatedAt       DateTime?
  reviewStartedAt   DateTime?
  approvedAt        DateTime?
  reviewDurationMs  Int?          // Time spent reviewing

  // Processing
  processingError   String?

  createdAt         DateTime      @default(now())
  updatedAt         DateTime      @updatedAt

  documents         LetterDocument[]
  provenance        Provenance?

  @@index([userId, createdAt])
  @@index([status])
  @@map("letters")
}

enum LetterType {
  NEW_PATIENT
  FOLLOW_UP
  ANGIOGRAM_PROCEDURE
  ECHO_REPORT
}

enum LetterStatus {
  GENERATING
  DRAFT
  IN_REVIEW
  APPROVED
  FAILED
}

model LetterDocument {
  id          String   @id @default(uuid())
  letterId    String
  letter      Letter   @relation(fields: [letterId], references: [id], onDelete: Cascade)
  documentId  String
  document    Document @relation(fields: [documentId], references: [id])

  @@unique([letterId, documentId])
  @@map("letter_documents")
}

// ============ Provenance & Audit ============

model Provenance {
  id                String   @id @default(uuid())
  letterId          String   @unique
  letter            Letter   @relation(fields: [letterId], references: [id], onDelete: Cascade)

  // Complete audit trail as structured JSON
  data              Json

  // Cryptographic hash for tamper detection
  hash              String

  createdAt         DateTime @default(now())

  @@map("provenance")
}

model AuditLog {
  id          String    @id @default(uuid())
  userId      String?
  user        User?     @relation(fields: [userId], references: [id])
  action      String    // login, logout, letter.create, letter.approve, etc.
  resourceType String?  // letter, recording, document
  resourceId  String?
  metadata    Json      @default("{}")
  ipAddress   String?
  userAgent   String?
  createdAt   DateTime  @default(now())

  @@index([userId, createdAt])
  @@index([action, createdAt])
  @@map("audit_logs")
}
```

### 4.2 Key Type Definitions

```typescript
// src/domains/recording/recording.types.ts

export interface RecordingSession {
  id: string;
  mode: 'AMBIENT' | 'DICTATION';
  status: RecordingStatus;
  startedAt: Date;
  audioBlob?: Blob;
  audioQuality: AudioQualityLevel;
  consent: ConsentInfo | null;
}

export type AudioQualityLevel = 'excellent' | 'good' | 'fair' | 'poor';

export interface ConsentInfo {
  type: 'VERBAL' | 'WRITTEN' | 'STANDING';
  timestamp: Date;
}

export interface TranscriptResult {
  text: string;
  speakers: SpeakerSegment[];
  confidence: number;
  duration: number;
}

export interface SpeakerSegment {
  speaker: number; // 0 = clinician, 1 = patient
  start: number;   // seconds
  end: number;
  text: string;
  confidence: number;
}
```

```typescript
// src/domains/letters/letter.types.ts

export interface LetterDraft {
  id: string;
  type: LetterType;
  content: string;
  sourceAnchors: SourceAnchor[];
  extractedValues: ExtractedValue[];
  clinicalConcepts: ClinicalConcepts;
  hallucinationFlags: HallucinationFlag[];
  styleConfidence: number;
  generatedAt: Date;
}

export interface SourceAnchor {
  id: string;
  textStart: number;      // Character offset in letter
  textEnd: number;
  sourceType: 'transcript' | 'document';
  sourceId: string;       // Recording or Document ID
  sourceLocation: string; // "timestamp:12:34" or "page:2,line:14"
  excerpt: string;        // Source text snippet
}

export interface ExtractedValue {
  id: string;
  category: ValueCategory;
  name: string;           // "LVEF", "LAD stenosis"
  value: string;          // "45%", "80%"
  unit?: string;
  sourceAnchorId: string;
  verified: boolean;
  verifiedAt?: Date;
}

export type ValueCategory =
  | 'cardiac_function'
  | 'coronary_disease'
  | 'valvular'
  | 'procedural'
  | 'hemodynamic'
  | 'medication';

export interface ClinicalConcepts {
  diagnoses: string[];
  medications: MedicationEntry[];
  procedures: string[];
  followUp: string[];
}

export interface MedicationEntry {
  name: string;
  dose?: string;
  frequency?: string;
  sourceAnchorId: string;
}

export interface HallucinationFlag {
  id: string;
  textStart: number;
  textEnd: number;
  flaggedText: string;
  reason: string;
  severity: 'warning' | 'critical';
  dismissed: boolean;
  dismissedAt?: Date;
}
```

---

## 5. API Contracts

### 5.1 Recording Endpoints

```typescript
// POST /api/recordings
// Create a new recording session
interface CreateRecordingRequest {
  mode: 'AMBIENT' | 'DICTATION';
  patientId?: string;
  consent: {
    type: 'VERBAL' | 'WRITTEN' | 'STANDING';
  };
}

interface CreateRecordingResponse {
  id: string;
  uploadUrl: string;  // Pre-signed S3 URL
  expiresAt: string;
}

// POST /api/recordings/:id/upload
// Confirm upload complete, trigger transcription
interface UploadCompleteRequest {
  durationSeconds: number;
  audioQuality: 'excellent' | 'good' | 'fair' | 'poor';
}

interface UploadCompleteResponse {
  id: string;
  status: 'TRANSCRIBING';
  estimatedCompletionSeconds: number;
}

// GET /api/recordings/:id
interface GetRecordingResponse {
  id: string;
  mode: 'AMBIENT' | 'DICTATION';
  status: RecordingStatus;
  durationSeconds?: number;
  transcript?: {
    text: string;
    speakers: SpeakerSegment[];
  };
  createdAt: string;
}
```

### 5.2 Document Endpoints

```typescript
// POST /api/documents
// Get upload URL for document
interface CreateDocumentRequest {
  filename: string;
  mimeType: 'application/pdf' | 'image/png' | 'image/jpeg';
  sizeBytes: number;
  patientId?: string;
}

interface CreateDocumentResponse {
  id: string;
  uploadUrl: string;
  expiresAt: string;
}

// POST /api/documents/:id/process
// Trigger document extraction
interface ProcessDocumentResponse {
  id: string;
  status: 'PROCESSING';
  estimatedCompletionSeconds: number;
}

// GET /api/documents/:id
interface GetDocumentResponse {
  id: string;
  filename: string;
  documentType?: DocumentType;
  status: DocumentStatus;
  extractedData?: {
    values: ExtractedValue[];
    text: string;
  };
  thumbnailUrl?: string;
  createdAt: string;
}
```

### 5.3 Letter Endpoints

```typescript
// POST /api/letters
// Generate a new letter
interface CreateLetterRequest {
  type: LetterType;
  recordingId?: string;
  documentIds: string[];
  patientId?: string;
}

interface CreateLetterResponse {
  id: string;
  status: 'GENERATING';
  estimatedCompletionSeconds: number;
}

// GET /api/letters/:id
interface GetLetterResponse {
  id: string;
  type: LetterType;
  status: LetterStatus;
  content?: string;
  sourceAnchors?: SourceAnchor[];
  extractedValues?: ExtractedValue[];
  clinicalConcepts?: ClinicalConcepts;
  hallucinationFlags?: HallucinationFlag[];
  styleConfidence?: number;
  reviewDurationMs?: number;
  createdAt: string;
  generatedAt?: string;
  approvedAt?: string;
}

// PATCH /api/letters/:id
// Update letter content during review
interface UpdateLetterRequest {
  content?: string;
  verifiedValueIds?: string[];
  dismissedFlagIds?: string[];
}

// POST /api/letters/:id/approve
// Finalize and approve letter
interface ApproveLetterRequest {
  reviewDurationMs: number;
}

interface ApproveLetterResponse {
  id: string;
  status: 'APPROVED';
  approvedAt: string;
  provenanceId: string;
}

// GET /api/letters/:id/provenance
interface GetProvenanceResponse {
  id: string;
  letterId: string;
  data: {
    generatedAt: string;
    primaryModel: string;
    criticModel: string;
    sourceFiles: string[];
    valueVerifications: ValueVerification[];
    hallucinationCheckResults: HallucinationCheckResult[];
    reviewingPhysician: string;
    reviewDurationMs: number;
    edits: EditRecord[];
    approvedAt: string;
  };
  hash: string;
  createdAt: string;
}
```

### 5.4 Webhook Endpoints

```typescript
// POST /api/transcription/webhook
// Deepgram callback when transcription complete
interface DeepgramWebhookPayload {
  request_id: string;
  metadata: {
    request_id: string;
    created: string;
    duration: number;
    channels: number;
  };
  results: {
    channels: Array<{
      alternatives: Array<{
        transcript: string;
        confidence: number;
        words: Word[];
      }>;
    }>;
    utterances?: Utterance[];
  };
}
```

---

## 6. External Service Integration

### 6.1 Deepgram Integration

```typescript
// src/infrastructure/deepgram/client.ts

import { createClient, DeepgramClient } from '@deepgram/sdk';
import { CARDIOLOGY_KEYTERMS } from './keyterms';

export class DeepgramService {
  private client: DeepgramClient;

  constructor() {
    this.client = createClient(process.env.DEEPGRAM_API_KEY!);
  }

  async transcribeRecording(
    audioUrl: string,
    mode: 'AMBIENT' | 'DICTATION'
  ): Promise<TranscriptionResult> {
    const options = {
      model: 'nova-3-medical',
      smart_format: true,
      diarize: mode === 'AMBIENT',
      diarize_version: '2024-10-01',
      keyterms: CARDIOLOGY_KEYTERMS,
      redact: ['pci', 'ssn', 'phone', 'email'],
      callback: process.env.DEEPGRAM_WEBHOOK_URL,
    };

    const response = await this.client.listen.prerecorded.transcribeUrl(
      { url: audioUrl },
      options
    );

    return this.parseResponse(response);
  }
}
```

### 6.2 AWS Bedrock Integration

```typescript
// src/infrastructure/bedrock/client.ts

import {
  BedrockRuntimeClient,
  InvokeModelCommand,
} from '@aws-sdk/client-bedrock-runtime';
import { selectModel } from './model-selector';

export class BedrockService {
  private client: BedrockRuntimeClient;

  constructor() {
    this.client = new BedrockRuntimeClient({
      region: 'ap-southeast-2',
    });
  }

  async generateLetter(
    prompt: string,
    context: LetterContext
  ): Promise<GenerationResult> {
    const modelId = selectModel(context);

    const command = new InvokeModelCommand({
      modelId,
      contentType: 'application/json',
      accept: 'application/json',
      body: JSON.stringify({
        anthropic_version: 'bedrock-2023-05-31',
        max_tokens: 4096,
        messages: [{ role: 'user', content: prompt }],
      }),
    });

    const response = await this.client.send(command);
    return this.parseResponse(response);
  }

  async runHallucinationCheck(
    letter: string,
    sources: SourceMaterial[]
  ): Promise<HallucinationCheckResult> {
    // Use faster model for critic
    const modelId = 'anthropic.claude-3-sonnet-20240229';
    // ... implementation
  }
}
```

### 6.3 Model Selection Logic

```typescript
// src/infrastructure/bedrock/model-selector.ts

interface LetterContext {
  letterType: LetterType;
  sourceCount: number;
  hasConflictingData: boolean;
  styleConfidence: number;
  procedureComplexity: 'standard' | 'complex';
}

export function selectModel(context: LetterContext): string {
  const OPUS = 'anthropic.claude-3-opus-20240229';
  const SONNET = 'anthropic.claude-3-sonnet-20240229';

  // Use Opus (30% of cases) for:
  // - New patient letters (more comprehensive)
  // - Complex procedures (TAVI, TEER, complex PCI)
  // - Multiple conflicting sources
  // - Low style confidence (needs more reasoning)

  if (context.letterType === 'NEW_PATIENT') return OPUS;
  if (context.procedureComplexity === 'complex') return OPUS;
  if (context.hasConflictingData) return OPUS;
  if (context.styleConfidence < 0.5) return OPUS;

  // Use Sonnet (70% of cases) for:
  // - Follow-up letters
  // - Standard procedures
  // - High style confidence
  // - Single source documents

  return SONNET;
}
```

---

## 7. Security Implementation

### 7.1 PHI Obfuscation Pipeline

```typescript
// src/domains/safety/phi-obfuscator.ts

interface TokenMapping {
  token: string;
  value: string;
  type: PHIType;
}

type PHIType = 'name' | 'dob' | 'medicare' | 'address' | 'phone' | 'email';

const TOKEN_PATTERNS: Record<PHIType, string> = {
  name: '[PATIENT_NAME]',
  dob: '[DOB]',
  medicare: '[MEDICARE_ID]',
  address: '[ADDRESS]',
  phone: '[PHONE]',
  email: '[EMAIL]',
};

export class PHIObfuscator {
  private mappings: Map<string, TokenMapping> = new Map();

  obfuscate(text: string, patientData: PatientData): string {
    let obfuscated = text;

    // Replace each PHI field with token
    if (patientData.name) {
      const token = this.createToken('name', patientData.name);
      obfuscated = obfuscated.replace(
        new RegExp(escapeRegex(patientData.name), 'gi'),
        token
      );
    }

    // ... repeat for other PHI types

    return obfuscated;
  }

  deobfuscate(text: string): string {
    let result = text;

    for (const [token, mapping] of this.mappings) {
      result = result.replace(new RegExp(escapeRegex(token), 'g'), mapping.value);
    }

    return result;
  }

  private createToken(type: PHIType, value: string): string {
    const token = TOKEN_PATTERNS[type];
    this.mappings.set(token, { token, value, type });
    return token;
  }
}
```

### 7.2 Value Extraction & Verification

```typescript
// src/domains/safety/value-extractor.ts

const CARDIOLOGY_VALUE_PATTERNS = {
  cardiac_function: [
    { name: 'LVEF', pattern: /LVEF[:\s]+(\d{1,2}(?:\.\d)?)\s*%/i },
    { name: 'RVEF', pattern: /RVEF[:\s]+(\d{1,2}(?:\.\d)?)\s*%/i },
    { name: 'GLS', pattern: /GLS[:\s]+(-?\d{1,2}(?:\.\d)?)\s*%/i },
  ],
  coronary_disease: [
    { name: 'LAD stenosis', pattern: /LAD[^.]*?(\d{1,3})\s*%\s*(?:stenosis|lesion)/i },
    { name: 'LCx stenosis', pattern: /(?:LCx|circumflex)[^.]*?(\d{1,3})\s*%/i },
    { name: 'RCA stenosis', pattern: /RCA[^.]*?(\d{1,3})\s*%/i },
  ],
  valvular: [
    { name: 'Aortic valve area', pattern: /(?:AVA|aortic valve area)[:\s]+(\d+(?:\.\d+)?)\s*cm/i },
    { name: 'Mean gradient', pattern: /mean (?:gradient|PG)[:\s]+(\d+)\s*mmHg/i },
  ],
  medication: [
    { name: 'medication', pattern: /(\w+)\s+(\d+(?:\.\d+)?)\s*(mg|mcg)\s*(daily|BD|TDS|QID|nocte)?/gi },
  ],
};

export class ValueExtractor {
  extract(text: string): ExtractedValue[] {
    const values: ExtractedValue[] = [];

    for (const [category, patterns] of Object.entries(CARDIOLOGY_VALUE_PATTERNS)) {
      for (const { name, pattern } of patterns) {
        const matches = text.matchAll(pattern);
        for (const match of matches) {
          values.push({
            id: generateId(),
            category: category as ValueCategory,
            name,
            value: match[1],
            unit: this.inferUnit(name),
            verified: false,
          });
        }
      }
    }

    return values;
  }
}
```

---

## 8. Delivery Phases

### Phase 1: Foundation (Weeks 1-3)
**Goal:** Working authentication, database, and project scaffolding

**Deliverables:**
- [ ] Project setup (Next.js, Tailwind, TypeScript, Prisma)
- [ ] Auth0 integration with MFA
- [ ] Database schema and migrations
- [ ] Basic UI scaffold (layout, navigation)
- [ ] S3 bucket configuration
- [ ] CI/CD pipeline (lint, test, deploy)

**Verification:**
- User can log in with MFA
- Database migrations run successfully
- CI passes on all commits
- Basic navigation works

### Phase 2: Audio & Transcription (Weeks 4-6)
**Goal:** Complete recording and transcription flow

**Deliverables:**
- [ ] Recording interface (mode selection, controls)
- [ ] Audio quality monitoring
- [ ] Offline recording queue (IndexedDB)
- [ ] S3 upload with pre-signed URLs
- [ ] Deepgram integration with webhook
- [ ] Transcript display with speaker labels
- [ ] Consent tracking

**Verification:**
- Can record 20-minute consultation
- Transcription completes with <5% WER on cardiology terms
- Speaker diarization distinguishes clinician/patient
- Offline recordings sync when reconnected

### Phase 3: Document Processing (Weeks 7-8)
**Goal:** Document upload and clinical data extraction

**Deliverables:**
- [ ] Document upload interface
- [ ] PDF/image parsing via Claude Vision
- [ ] Clinical value extraction (LVEF, stenosis, etc.)
- [ ] Document preview component
- [ ] Document-to-letter association

**Verification:**
- Echo report extracted with >95% accuracy on key values
- Angiogram report extracted with vessel-specific findings
- Documents viewable in review interface

### Phase 4: Letter Generation (Weeks 9-11)
**Goal:** AI-powered letter generation with safety features

**Deliverables:**
- [ ] Letter generation prompts (4 types)
- [ ] Source anchoring system
- [ ] PHI obfuscation pipeline
- [ ] Intelligent model selection
- [ ] Hallucination detection (critic model)
- [ ] Clinical concept extraction
- [ ] Value extraction and verification panel

**Verification:**
- Letters generated in <30 seconds
- All clinical values linked to sources
- Hallucination flags appear for fabricated content
- Verification panel shows all critical values

### Phase 5: Review Interface (Weeks 12-13)
**Goal:** Complete letter review and approval workflow

**Deliverables:**
- [ ] Letter editor with rich text
- [ ] Source panel (click to view source)
- [ ] Verification panel with mandatory confirmations
- [ ] Differential view mode
- [ ] Approval workflow
- [ ] Provenance report generation

**Verification:**
- Can review and approve letter in <3 minutes
- All sources viewable via click
- Cannot approve without verifying critical values
- Provenance report contains complete audit trail

### Phase 6: Polish & Pilot Prep (Weeks 14-16)
**Goal:** Production-ready for pilot launch

**Deliverables:**
- [ ] Style learning system
- [ ] Notification center
- [ ] Letter history with search/filter
- [ ] Practice settings (multi-user)
- [ ] PWA manifest and service worker
- [ ] Error handling and recovery
- [ ] Performance optimization
- [ ] Documentation and onboarding

**Verification:**
- Style confidence improves with usage
- Notifications work (in-app, email)
- PWA installable on Chrome/Safari
- <200ms UI response times
- Pilot users can self-onboard

---

## 9. Verification Approach

### 9.1 Testing Strategy

| Level | Tool | Coverage Target |
|-------|------|-----------------|
| Unit Tests | Vitest | 80% of domain logic |
| Integration Tests | Vitest + Prisma | All API endpoints |
| E2E Tests | Playwright | Critical user flows |
| Manual Testing | Checklist | Edge cases, clinical accuracy |

### 9.2 Key Test Scenarios

**Recording Flow:**
1. Start ambient recording → verify audio captured
2. Poor audio quality → verify warning displayed
3. Network disconnects → verify offline queue works
4. Long recording (30 min) → verify upload succeeds

**Transcription:**
1. Cardiology terms transcribed correctly
2. Speaker diarization labels correct
3. PHI redacted by Deepgram

**Document Processing:**
1. Echo report → LVEF, valve areas extracted
2. Angiogram → stenosis percentages per vessel
3. Low quality scan → graceful degradation

**Letter Generation:**
1. All clinical values appear with sources
2. Hallucination introduced → critic catches it
3. Style matches previous letters

**Review Flow:**
1. Verify all critical values before approval
2. Edit letter → diff saved
3. Approve → provenance generated

### 9.3 Clinical Accuracy Validation

**Pilot Validation Protocol:**
1. Founder (cardiologist) reviews first 50 letters
2. Compare extracted values to source documents
3. Log any discrepancies
4. Iterate on extraction patterns

**Success Criteria:**
- <1% hallucination rate
- >98% value extraction accuracy
- Zero critical errors in pilot

### 9.4 Commands

```bash
# Lint
npm run lint

# Type check
npm run typecheck

# Unit tests
npm run test

# Integration tests
npm run test:integration

# E2E tests
npm run test:e2e

# All checks (CI)
npm run verify
```

---

## 10. Environment Configuration

### 10.1 Environment Variables

```bash
# .env.example

# Database
DATABASE_URL="postgresql://user:password@localhost:5432/dictatemed"

# Auth0
AUTH0_SECRET="[generate-random-32-bytes]"
AUTH0_BASE_URL="http://localhost:3000"
AUTH0_ISSUER_BASE_URL="https://your-tenant.auth0.com"
AUTH0_CLIENT_ID="your-client-id"
AUTH0_CLIENT_SECRET="your-client-secret"

# AWS
AWS_REGION="ap-southeast-2"
AWS_ACCESS_KEY_ID="your-access-key"
AWS_SECRET_ACCESS_KEY="your-secret-key"
S3_BUCKET_NAME="dictatemed-uploads"

# Deepgram
DEEPGRAM_API_KEY="your-api-key"
DEEPGRAM_WEBHOOK_URL="https://your-domain.com/api/transcription/webhook"
DEEPGRAM_WEBHOOK_SECRET="your-webhook-secret"

# Feature Flags
ENABLE_HALLUCINATION_CHECK="true"
ENABLE_STYLE_LEARNING="true"
```

### 10.2 Infrastructure Setup

```yaml
# AWS Resources Required
- S3 Bucket: dictatemed-uploads (ap-southeast-2)
  - Encryption: AES-256
  - Lifecycle: Delete audio after 24h, documents after 90d
  - CORS: Allow uploads from app domain

- IAM Role: dictatemed-app
  - S3: GetObject, PutObject, DeleteObject
  - Bedrock: InvokeModel
  - CloudWatch: PutMetricData, CreateLogGroup, CreateLogStream, PutLogEvents

- RDS PostgreSQL: dictatemed-db (db.t3.medium)
  - Encryption: Enabled
  - Backup: 7 days
  - Multi-AZ: Enabled for production

- Secrets Manager: dictatemed-secrets
  - DATABASE_URL, DEEPGRAM_API_KEY, AUTH0_SECRET
```

---

## 11. Risk Mitigations

| Risk | Mitigation |
|------|------------|
| Deepgram accuracy insufficient | Custom keyterm list, fallback to AssemblyAI |
| Claude hallucinations | Critic model validation, source anchoring |
| Offline sync conflicts | Last-write-wins with conflict notification |
| PHI exposure | Tokenization before LLM, BAA coverage |
| Slow transcription | Background processing, notification system |
| Model cost overruns | Intelligent model selection, usage monitoring |

---

## 12. Dependencies & Constraints

### 12.1 External Dependencies

| Dependency | Risk Level | Fallback |
|------------|------------|----------|
| Deepgram Nova-3 Medical | Low | AssemblyAI |
| AWS Bedrock (Claude) | Low | Direct Anthropic API |
| Auth0 | Low | AWS Cognito |
| AWS Sydney region | Low | - |

### 12.2 Team Constraints

- 3-person team (1 full-stack dev, 1 clinical advisor, 1 part-time UX)
- $2,000 USD/month operational budget
- 15-16 week timeline

### 12.3 Compliance Constraints

- Australian data residency (Sydney region)
- Australian Privacy Act compliance
- BAA required before production with Deepgram, AWS
- Audio deleted immediately after transcription
- Account deletion must be GDPR-aligned (immediate, permanent)

---

*Technical Specification v1.0 | DictateMED MVP | December 2025*
