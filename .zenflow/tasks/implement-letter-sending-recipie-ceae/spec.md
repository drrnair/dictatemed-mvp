# Technical Specification: Letter Sending, Recipient Management & Dark Mode

## Difficulty Assessment: **HARD**

This task involves:
- Multiple new data models with complex relationships
- New infrastructure module (email service) with adapter pattern
- Multi-phase UI workflow (send letter dialog)
- Theme system integration
- Privacy/compliance considerations
- Comprehensive audit logging
- Multiple settings pages

---

## Technical Context

### Technology Stack
- **Frontend**: Next.js 14 (App Router), React 18, TypeScript 5.3
- **Backend**: Next.js API Routes, Prisma 5.10, PostgreSQL
- **Styling**: Tailwind CSS 3.4 with dark mode (`darkMode: ['class']`)
- **State**: Zustand 4.5
- **Validation**: Zod 3.22
- **Auth**: Auth0
- **Testing**: Vitest, Playwright, Testing Library

### Existing Patterns to Leverage
- `Referrer` model: Already tracks GP/referring doctors (reusable contacts)
- `CCRecipient` model: Consultation-specific recipients (ephemeral)
- `AuditLog` model: Activity logging with metadata
- `Notification` service: In-app notifications (can extend for email)
- `User.settings` JSON field: Stores user preferences
- Infrastructure modules: Follow patterns from `src/infrastructure/s3/`, `src/infrastructure/bedrock/`

---

## Implementation Approach

### 1. Data Models

#### 1.1 Contact Model (Patient-linked recipients)
Extend beyond existing `Referrer` to support per-patient contacts:

```prisma
model PatientContact {
  id                    String   @id @default(uuid())
  patientId             String
  patient               Patient  @relation(fields: [patientId], references: [id], onDelete: Cascade)

  type                  ContactType  // gp | referrer | specialist | other
  fullName              String
  organisation          String?      // Practice name
  role                  String?      // Specialty/role (free text)

  // Communication
  email                 String?
  phone                 String?
  fax                   String?
  address               String?      @db.Text
  secureMessagingId     String?      // Future: HealthLink/FHIR
  preferredChannel      ChannelType  @default(EMAIL)

  // Defaults
  isDefaultForPatient   Boolean      @default(false)

  createdAt             DateTime @default(now())
  updatedAt             DateTime @updatedAt

  // Letter send history
  letterSends           LetterSend[]

  @@index([patientId])
  @@index([patientId, type])
  @@map("patient_contacts")
}

enum ContactType {
  GP
  REFERRER
  SPECIALIST
  OTHER
}

enum ChannelType {
  EMAIL
  SECURE_MESSAGING
  FAX
  POST
}
```

#### 1.2 LetterSend Model (Audit trail for sends)

```prisma
model LetterSend {
  id                    String       @id @default(uuid())
  letterId              String
  letter                Letter       @relation(fields: [letterId], references: [id], onDelete: Cascade)

  // Who sent
  senderId              String
  sender                User         @relation(fields: [senderId], references: [id])

  // Recipient info
  patientContactId      String?      // Nullable for one-off recipients
  patientContact        PatientContact? @relation(fields: [patientContactId], references: [id])

  // Denormalized recipient info (for audit even if contact deleted)
  recipientName         String
  recipientEmail        String
  recipientType         ContactType?

  // Send details
  channel               ChannelType  @default(EMAIL)
  subject               String
  coverNote             String?      @db.Text

  // Status tracking
  status                SendStatus   @default(QUEUED)
  queuedAt              DateTime     @default(now())
  sentAt                DateTime?
  failedAt              DateTime?
  errorMessage          String?

  // Email provider reference
  externalId            String?      // Provider message ID for tracking

  createdAt             DateTime     @default(now())

  @@index([letterId])
  @@index([senderId])
  @@index([status])
  @@map("letter_sends")
}

enum SendStatus {
  QUEUED
  SENDING
  SENT
  FAILED
  BOUNCED
}
```

#### 1.3 User Settings Extension
Add to existing `User.settings` JSON:

```typescript
interface UserSettings {
  // Existing settings...

  // Letter sending preferences
  letterSending?: {
    alwaysCcGp: boolean;           // Always CC GP if available
    alwaysCcSelf: boolean;         // Always send copy to self
    includeReferrer: boolean;      // Include referring doctor by default
    defaultSubjectTemplate: string; // e.g., "{{patient_name}} - {{subspecialty}} clinic letter - {{date}}"
    defaultCoverNote: string;      // Default cover note text
  };

  // Theme preference
  themePreference?: 'system' | 'light' | 'dark';
}
```

### 2. Email Infrastructure

#### 2.1 Email Adapter Interface
Create new infrastructure module: `src/infrastructure/email/`

```typescript
// src/infrastructure/email/types.ts
export interface EmailAttachment {
  filename: string;
  content: Buffer | string;
  contentType: string;
}

export interface SendEmailParams {
  to: string | string[];
  cc?: string | string[];
  bcc?: string | string[];
  subject: string;
  bodyHtml: string;
  bodyText?: string;
  attachments?: EmailAttachment[];
  replyTo?: string;
  tags?: Record<string, string>; // For tracking
}

export interface SendEmailResult {
  success: boolean;
  messageId?: string;
  error?: string;
}

export interface EmailAdapter {
  sendEmail(params: SendEmailParams): Promise<SendEmailResult>;
  validateEmail(email: string): boolean;
}
```

#### 2.2 Default Implementation (AWS SES or generic SMTP)
Start with AWS SES since AWS is already in use:

```typescript
// src/infrastructure/email/ses.adapter.ts
import { SESClient, SendRawEmailCommand } from '@aws-sdk/client-ses';

export class SESEmailAdapter implements EmailAdapter {
  // Implementation using AWS SES
}
```

Fallback: Basic SMTP adapter using nodemailer if needed.

### 3. Letter Sending Service

```typescript
// src/domains/letters/sending.service.ts
export interface SendLetterInput {
  letterId: string;
  senderId: string;
  recipients: Array<{
    contactId?: string;        // Null for one-off
    email: string;
    name: string;
    type?: ContactType;
    channel: ChannelType;
  }>;
  subject: string;
  coverNote?: string;
}

export interface SendLetterResult {
  totalRecipients: number;
  successful: number;
  failed: number;
  sends: Array<{
    recipientEmail: string;
    status: SendStatus;
    error?: string;
  }>;
}

export async function sendLetter(input: SendLetterInput): Promise<SendLetterResult>;
```

### 4. PDF Generation
For letter attachment, leverage existing letter content:

```typescript
// src/domains/letters/pdf.service.ts
export async function generateLetterPdf(letterId: string): Promise<Buffer>;
```

Options:
1. **Simple**: HTML-to-PDF using `@react-pdf/renderer` or `puppeteer`
2. **Recommended**: `pdf-lib` for lightweight PDF generation from formatted content

### 5. Frontend Components

#### 5.1 Send Letter Dialog
New component: `src/components/letters/SendLetterDialog.tsx`

```typescript
interface SendLetterDialogProps {
  letter: Letter;
  patientId: string;
  onClose: () => void;
  onSent: () => void;
}
```

Features:
- Pre-populated recipients (GP, referrer, self)
- Add/remove recipients
- Add one-off recipient (email entry)
- Subject line with template tokens
- Cover note textarea
- Confirmation step
- Progress/status for multi-recipient sends

#### 5.2 Send History Component
New component: `src/components/letters/SendHistory.tsx`

Display on letter detail page:
- List of past sends
- Recipient, channel, status, timestamp
- Retry button for failed sends

#### 5.3 Patient Contact Management
New component: `src/components/consultation/PatientContacts.tsx`

CRUD interface for patient contacts:
- Add/edit/delete contacts
- Set defaults
- Email validation

#### 5.4 Settings: Letter Sending Preferences
New settings page: `src/app/(dashboard)/settings/letters/page.tsx`

Settings form for:
- Default recipient toggles
- Subject template editor
- Cover note default

#### 5.5 Settings: Theme Preference
Add to profile settings or new appearance page:
- Radio group: System / Light / Dark
- Preview capability

### 6. Theme System

#### 6.1 Theme Context
```typescript
// src/lib/theme.ts
export type ThemePreference = 'system' | 'light' | 'dark';
export type ResolvedTheme = 'light' | 'dark';

export function getSystemTheme(): ResolvedTheme;
export function applyTheme(theme: ResolvedTheme): void;
```

#### 6.2 Theme Provider
```typescript
// src/components/providers/ThemeProvider.tsx
// Wrap app, manage state, detect system preference changes
```

#### 6.3 CSS Variables
Already defined in `globals.css` for `.dark` class. Verify WCAG AA contrast for all clinical/status colors.

---

## Source Code Structure Changes

### New Files

```
src/
├── infrastructure/
│   └── email/
│       ├── index.ts
│       ├── types.ts
│       ├── ses.adapter.ts           # AWS SES implementation
│       └── validation.ts            # Email format validation
├── domains/
│   ├── letters/
│   │   ├── sending.service.ts       # Letter send orchestration
│   │   ├── sending.types.ts         # Types for sending
│   │   └── pdf.service.ts           # PDF generation
│   └── contacts/
│       ├── index.ts
│       ├── contact.service.ts       # CRUD for patient contacts
│       ├── contact.types.ts
│       └── contact.validation.ts    # Zod schemas
├── components/
│   ├── letters/
│   │   ├── SendLetterDialog.tsx     # Send dialog after approval
│   │   └── SendHistory.tsx          # Send history list
│   ├── consultation/
│   │   └── PatientContacts.tsx      # Contact management
│   ├── settings/
│   │   ├── LetterSendingSettings.tsx
│   │   └── ThemeSettings.tsx
│   └── providers/
│       └── ThemeProvider.tsx
├── app/
│   ├── api/
│   │   ├── contacts/
│   │   │   ├── route.ts             # GET (list), POST (create)
│   │   │   └── [id]/
│   │   │       └── route.ts         # GET, PUT, DELETE
│   │   └── letters/
│   │       └── [id]/
│   │           └── send/
│   │               └── route.ts     # POST (send letter)
│   └── (dashboard)/
│       └── settings/
│           ├── letters/
│           │   └── page.tsx         # Letter sending preferences
│           └── appearance/
│               └── page.tsx         # Theme settings (or add to profile)
├── hooks/
│   └── useTheme.ts                  # Theme hook
└── lib/
    └── theme.ts                     # Theme utilities

prisma/
└── migrations/
    └── YYYYMMDD_add_patient_contacts_and_letter_sends/
        └── migration.sql
```

### Modified Files

```
prisma/schema.prisma                 # Add PatientContact, LetterSend, enums
src/app/globals.css                  # Verify/enhance dark mode variables
src/app/(dashboard)/settings/page.tsx # Add Letters and Appearance links
src/app/(dashboard)/letters/[id]/page.tsx # Add SendHistory section
src/app/(dashboard)/letters/[id]/LetterReviewClient.tsx # Add Send button after approval
src/app/layout.tsx                   # Wrap with ThemeProvider
src/lib/auth.ts                      # Export AuthUser for theme storage
```

---

## API Endpoints

### Contacts API

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/contacts?patientId=xxx` | List contacts for patient |
| POST | `/api/contacts` | Create contact |
| GET | `/api/contacts/[id]` | Get contact by ID |
| PUT | `/api/contacts/[id]` | Update contact |
| DELETE | `/api/contacts/[id]` | Delete contact |

### Letter Sending API

| Method | Path | Description |
|--------|------|-------------|
| POST | `/api/letters/[id]/send` | Send letter to recipients |
| GET | `/api/letters/[id]/sends` | Get send history |
| POST | `/api/letters/[id]/sends/[sendId]/retry` | Retry failed send |

### User Settings API

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/user/settings/letters` | Get letter sending preferences |
| PUT | `/api/user/settings/letters` | Update letter sending preferences |
| GET | `/api/user/settings/theme` | Get theme preference |
| PUT | `/api/user/settings/theme` | Update theme preference |

---

## Data Model Changes

### New Enums
- `ContactType`: GP, REFERRER, SPECIALIST, OTHER
- `ChannelType`: EMAIL, SECURE_MESSAGING, FAX, POST
- `SendStatus`: QUEUED, SENDING, SENT, FAILED, BOUNCED

### New Models
- `PatientContact`: Patient-linked contacts
- `LetterSend`: Audit log for letter sends

### Modified Models
- `Letter`: Add relation to `LetterSend[]`
- `Patient`: Add relation to `PatientContact[]`
- `User`: Add relation to `LetterSend[]` (as sender)

---

## Verification Approach

### Unit Tests
```bash
npm run test
```

Test coverage for:
- `contact.service.ts` - CRUD operations
- `contact.validation.ts` - Zod schema validation
- `sending.service.ts` - Send orchestration logic
- `pdf.service.ts` - PDF generation
- `email/*.ts` - Email adapter
- `theme.ts` - Theme utility functions

### Integration Tests
```bash
npm run test:integration
```

Test:
- Contact API endpoints (auth, validation, CRUD)
- Letter send API (auth, validation, partial failures)
- Settings API (read/write preferences)

### E2E Tests
```bash
npm run test:e2e
```

Scenarios:
1. Create patient with GP contact, send letter, verify history
2. Theme toggle persists across reload
3. Send letter with multiple recipients, handle failures

### Manual QA Checklist
- [ ] Create patient with GP + referrer contacts
- [ ] Draft and sign letter
- [ ] Open "Send letter" dialog, verify pre-populated recipients
- [ ] Send to GP, referrer, self
- [ ] Verify send history shows correct status
- [ ] Toggle theme preference (system/light/dark)
- [ ] Verify theme persists on reload
- [ ] Verify both themes meet contrast requirements

### Verification Commands
```bash
npm run lint          # ESLint
npm run typecheck     # TypeScript
npm run test          # Unit tests
npm run verify        # lint + typecheck + test
npm run verify:full   # + E2E tests
```

---

## Privacy & Security Considerations

1. **PHI in logs**: Never log letter content or patient details. Only log IDs, status, and counts.
2. **Email validation**: Validate email format before attempting send.
3. **Auth checks**: All endpoints require authentication; verify practice ownership.
4. **Audit trail**: `LetterSend` records are immutable audit logs.
5. **Confirmation UI**: Always show "You are about to send to N recipients" before send.

---

## Environment Variables

```bash
# Email (AWS SES)
AWS_SES_REGION=ap-southeast-2          # Or use AWS_REGION
AWS_SES_FROM_ADDRESS=noreply@dictatemed.com

# Or for SMTP fallback
SMTP_HOST=smtp.example.com
SMTP_PORT=587
SMTP_USER=user
SMTP_PASS=password
SMTP_FROM=noreply@dictatemed.com
```

---

## Dependencies to Add

```json
{
  "dependencies": {
    "@aws-sdk/client-ses": "^3.500.0"
  },
  "devDependencies": {
    // No new dev dependencies required
  }
}
```

For PDF generation, evaluate:
- `@react-pdf/renderer` (React-based, heavier)
- `pdf-lib` (lightweight, programmatic)
- `puppeteer` (Chrome-based, most accurate but heavy)

Recommendation: Start with `pdf-lib` for simplicity.

---

## Open Questions / Decisions Needed

1. **PDF library choice**: `pdf-lib` (lightweight) vs `@react-pdf/renderer` (React ecosystem) vs `puppeteer` (accuracy)?
2. **Email provider**: AWS SES (already using AWS) vs SendGrid vs other?
3. **Theme storage**: User.settings JSON vs dedicated column?
4. **Letterhead in PDF**: Include practice letterhead image in PDF?
5. **Rate limiting**: Limit sends per hour/day per user?

---

## Risk Assessment

| Risk | Mitigation |
|------|------------|
| Email deliverability issues | Use proven provider (SES), implement retry logic |
| PDF rendering inconsistencies | Test across browsers, use well-supported library |
| Theme flash on load | Apply theme class in `<html>` before React hydration |
| Large refactor scope | Break into incremental PRs by feature area |
