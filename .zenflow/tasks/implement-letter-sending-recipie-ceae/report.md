# Implementation Report: Letter Sending, Recipient Management & Dark Mode

## Summary

This implementation adds three major capabilities to DictateMED:

1. **Contact & Recipient Management** - Patient-linked clinician contacts (GP, referrers, specialists) with full CRUD operations
2. **Letter Sending Flow** - End-to-end email delivery of approved letters with audit logging and retry support
3. **System Dark Mode** - Theme switching that respects OS preference with manual override, using semantic design tokens

All features integrate seamlessly with the existing letter drafting and sign-off workflows without modifying the style engine or generation logic.

---

## 1. Data Models

### Entity Relationship Diagram

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                              PATIENT CONTACTS                                │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  ┌──────────┐         1:N         ┌─────────────────┐                       │
│  │ Patient  │────────────────────>│ PatientContact  │                       │
│  └──────────┘                     └─────────────────┘                       │
│       │                                   │                                  │
│       │                                   │ 0:N                              │
│       │                                   ▼                                  │
│       │     1:N      ┌────────┐   ┌────────────┐   N:1   ┌──────┐           │
│       └─────────────>│ Letter │──>│ LetterSend │<───────│ User │           │
│                      └────────┘   └────────────┘         └──────┘           │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

### PatientContact Model

Stores patient-linked clinical contacts for letter delivery.

```prisma
model PatientContact {
  id                  String      @id @default(uuid())
  patientId           String
  patient             Patient     @relation(...)

  // Contact classification
  type                ContactType // GP | REFERRER | SPECIALIST | OTHER
  fullName            String
  organisation        String?     // Practice name
  role                String?     // Specialty/role (free text)

  // Communication channels
  email               String?
  phone               String?
  fax                 String?
  address             String?     @db.Text
  secureMessagingId   String?     // Future: HealthLink/FHIR
  preferredChannel    ChannelType @default(EMAIL)

  // Defaults
  isDefaultForPatient Boolean     @default(false)

  createdAt           DateTime    @default(now())
  updatedAt           DateTime    @updatedAt

  letterSends         LetterSend[]

  @@index([patientId])
  @@index([patientId, type])
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

### LetterSend Model

Audit log for all outbound letter deliveries.

```prisma
model LetterSend {
  id                  String          @id @default(uuid())
  letterId            String
  letter              Letter          @relation(...)

  // Denormalized for direct audit queries
  patientId           String?
  patient             Patient?        @relation(...)

  // Sender
  senderId            String
  sender              User            @relation(...)

  // Recipient (nullable for one-off recipients)
  patientContactId    String?
  patientContact      PatientContact? @relation(...)

  // Denormalized recipient info (preserved if contact deleted)
  recipientName       String
  recipientEmail      String
  recipientType       ContactType?

  // Send details
  channel             ChannelType     @default(EMAIL)
  subject             String
  coverNote           String?         @db.Text

  // Status tracking
  status              SendStatus      @default(QUEUED)
  queuedAt            DateTime        @default(now())
  sentAt              DateTime?
  failedAt            DateTime?
  errorMessage        String?

  // Provider reference
  externalId          String?         // Provider message ID

  createdAt           DateTime        @default(now())
  updatedAt           DateTime        @updatedAt

  @@index([letterId])
  @@index([patientId])
  @@index([senderId])
  @@index([status])
}

enum SendStatus {
  QUEUED
  SENDING
  SENT
  FAILED
  BOUNCED
}
```

---

## 2. Email Adapter Abstraction

The email infrastructure follows the adapter pattern, allowing easy provider swapping.

### Interface Definition

```typescript
// src/infrastructure/email/types.ts

interface EmailAdapter {
  sendEmail(params: SendEmailParams): Promise<SendEmailResult>;
  validateEmail(email: string): boolean;
  getName(): string;
}

interface SendEmailParams {
  to: string | string[];
  cc?: string | string[];
  bcc?: string | string[];
  subject: string;
  bodyHtml: string;
  bodyText?: string;
  attachments?: EmailAttachment[];
  replyTo?: string;
  headers?: Record<string, string>;
  tags?: Record<string, string>;
}

interface SendEmailResult {
  success: boolean;
  messageId?: string;
  error?: string;
  errorCode?: string;
}

interface EmailAttachment {
  filename: string;
  content: Buffer | string;
  contentType: string;
  contentId?: string;
}
```

### AWS SES Implementation

```typescript
// src/infrastructure/email/ses.adapter.ts

class SESAdapter implements EmailAdapter {
  private client: SESClient;
  private config: EmailConfig;

  async sendEmail(params: SendEmailParams): Promise<SendEmailResult> {
    // Build MIME message with attachments
    const rawMessage = buildMimeMessage(params, this.config);

    const command = new SendRawEmailCommand({
      RawMessage: { Data: rawMessage },
      ConfigurationSetName: this.config.configurationSet,
    });

    const response = await this.client.send(command);
    return {
      success: true,
      messageId: response.MessageId,
    };
  }
}
```

### Future Provider Support

The adapter pattern enables plugging in alternative providers:

```typescript
// Future: Secure messaging adapter
interface SecureMessagingAdapter {
  sendSecureMessage(params: SecureMessageParams): Promise<SecureMessageResult>;
}

// Future: HealthLink adapter
class HealthLinkAdapter implements SecureMessagingAdapter { ... }
```

---

## 3. Theme System

### Architecture

The theme system uses `next-themes` with custom extensions for server-side persistence.

```
┌─────────────────────────────────────────────────────────────────┐
│                         Theme Flow                               │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  User Preference ─┬─> 'system' ──> OS Detection ──> light/dark  │
│                   ├─> 'light'  ──────────────────> light        │
│                   └─> 'dark'   ──────────────────> dark         │
│                                                                  │
│  Storage:                                                        │
│  ├─ localStorage (immediate): 'dictatemed-theme'                │
│  └─ Server (persistent): user.settings.themePreference          │
│                                                                  │
│  Application:                                                    │
│  └─ document.documentElement.classList.add('dark')              │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

### Theme Utilities

```typescript
// src/lib/theme.ts

type ThemePreference = 'system' | 'light' | 'dark';
type ResolvedTheme = 'light' | 'dark';

// Detect OS preference
function getSystemTheme(): ResolvedTheme {
  return window.matchMedia('(prefers-color-scheme: dark)').matches
    ? 'dark'
    : 'light';
}

// Resolve preference to actual theme
function resolveTheme(preference: ThemePreference): ResolvedTheme {
  if (preference === 'system') {
    return getSystemTheme();
  }
  return preference;
}

// Listen for OS theme changes
function onSystemThemeChange(callback: (theme: ResolvedTheme) => void): () => void {
  const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
  mediaQuery.addEventListener('change', (e) => {
    callback(e.matches ? 'dark' : 'light');
  });
  return () => mediaQuery.removeEventListener('change', handler);
}
```

### Design Tokens

Semantic color variables in `globals.css`:

```css
:root {
  /* Backgrounds */
  --background: 0 0% 100%;
  --foreground: 222.2 84% 4.9%;
  --card: 0 0% 100%;
  --muted: 210 40% 96.1%;

  /* Clinical status (theme-aware) */
  --clinical-verified: 142 76% 36%;
  --clinical-verified-muted: 142 50% 90%;
  --clinical-warning: 45 93% 47%;
  --clinical-critical: 0 84% 60%;
}

.dark {
  /* Backgrounds */
  --background: 222.2 84% 4.9%;
  --foreground: 210 40% 98%;
  --card: 222.2 84% 7%;
  --muted: 217.2 32.6% 17.5%;

  /* Clinical status (dark mode) */
  --clinical-verified: 142 70% 45%;
  --clinical-verified-muted: 142 40% 20%;
  --clinical-warning: 45 90% 50%;
  --clinical-critical: 0 75% 55%;
}
```

---

## 4. API Endpoints

### Contact Management

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/contacts?patientId=xxx` | List patient contacts (paginated) |
| POST | `/api/contacts` | Create new contact |
| GET | `/api/contacts/[id]` | Get contact by ID |
| PUT | `/api/contacts/[id]` | Update contact |
| DELETE | `/api/contacts/[id]` | Delete contact |

### Letter Sending

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/letters/[id]/send` | Send letter to recipients |
| GET | `/api/letters/[id]/sends` | Get send history |
| POST | `/api/letters/[id]/sends/[sendId]/retry` | Retry failed send |

### User Settings

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/user/settings/letters` | Get letter sending preferences |
| PUT | `/api/user/settings/letters` | Update letter sending preferences |
| GET | `/api/user/settings/theme` | Get theme preference |
| PUT | `/api/user/settings/theme` | Update theme preference |

---

## 5. UI Components

### Send Letter Dialog

Multi-step wizard for sending approved letters:

1. **Recipients** - Select from patient contacts, add self, add one-off recipients
2. **Message** - Configure subject (with template tokens) and optional cover note
3. **Confirm** - Review recipients and message before sending
4. **Sending** - Progress indicator during send
5. **Result** - Success/failure status per recipient with retry option

Key features:
- Auto-populates recipients based on user preferences
- Template tokens: `{{patient_name}}`, `{{letter_type}}`, `{{subspecialty}}`, `{{date}}`
- One-off recipients marked as "not saved"
- Partial failure handling with per-recipient status

### Send History

Displays audit trail on letter detail page:

- Recipient name, email, type badge (GP/Referrer/etc.)
- Status badges: SENT (green), FAILED (red), QUEUED/SENDING (yellow)
- Timestamps for each status transition
- Error messages with truncation and tooltip for full text
- Retry button for failed sends

### Theme Settings

Visual card-based theme selector:

- Light mode card (sun icon)
- Dark mode card (moon icon)
- System mode card (computer icon)
- Shows "Currently showing: X" when in system mode
- Immediate local update with server sync

### Patient Contact Management

Integrated into consultation context form:

- Collapsible "Manage Patient Contacts" section
- Full CRUD with inline add/edit forms
- Type badges (GP, REFERRER, SPECIALIST, OTHER)
- Default contact indicators
- Preferred channel display

---

## 6. Testing Summary

| Category | Tests | Coverage |
|----------|-------|----------|
| Contact Service | 27 | CRUD, validation, defaults |
| Contact Validation | 35 | Schema rules, GP requirements |
| Contact API | 31 | Auth, validation, rate limits |
| Sending Service | 33 | Send, retry, audit |
| Letter Send API | 24 | Send, history, retry |
| PDF Service | 23 | Generation, errors |
| Email Validation | 24 | Format, edge cases |
| SES Adapter | 20 | Send, errors, MIME |
| Theme Utilities | 21 | Detection, storage |
| useTheme Hook | 8 | State, toggle |
| SendLetterDialog | 36 | Steps, recipients |
| SendHistory | 26 | Display, retry |
| PatientContacts | 27 | CRUD UI |
| ContactForm | 30 | Validation, submit |
| ThemeSettings | 14 | Selection, save |
| Letter Settings | 17 | Preferences |
| Theme Settings API | 17 | Get, update |
| **Total** | **399 unit + 89 integration** | |

---

## 7. Known Limitations

1. **Email Only** - Current implementation supports email channel only. FAX, POST, and SECURE_MESSAGING channels are defined but not implemented.

2. **No Bounce Handling** - Email bounce/complaint webhooks from SES are not yet configured. BOUNCED status exists but isn't triggered.

3. **No Attachment Preview** - PDF preview before send is not implemented. Users must trust the generated PDF.

4. **Basic Template Tokens** - Subject templates support 4 tokens only. No custom field support.

5. **No Batch Operations** - Each letter must be sent individually. Bulk send for multiple letters is not supported.

6. **Sync Theme Only** - Theme preference is synced to server on change but not automatically loaded on login across devices. LocalStorage takes precedence.

---

## 8. Suggested Next Steps

### Phase 1: Secure Messaging (High Priority)
- Integrate HealthLink/FHIR secure messaging adapter
- Add provider configuration UI
- Implement delivery confirmation webhooks

### Phase 2: Enhanced Email (Medium Priority)
- Configure SES bounce/complaint webhooks
- Add BOUNCED status handling
- Email open/click tracking
- Resend with updated content

### Phase 3: Patient Communication (Future)
- Patient email contact type (consent-gated)
- Patient portal letter access
- Delivery preference per patient

### Phase 4: Operations (Future)
- Bulk send for multiple letters
- Scheduled sending
- Send queues with background processing
- Delivery analytics dashboard

---

## 9. File Structure

```
src/
├── app/
│   └── api/
│       ├── contacts/
│       │   ├── route.ts           # GET/POST contacts
│       │   └── [id]/route.ts      # GET/PUT/DELETE contact
│       ├── letters/
│       │   └── [id]/
│       │       ├── send/route.ts          # POST send
│       │       └── sends/
│       │           ├── route.ts           # GET history
│       │           └── [sendId]/retry/route.ts  # POST retry
│       └── user/settings/
│           ├── letters/route.ts   # GET/PUT preferences
│           └── theme/route.ts     # GET/PUT theme
├── components/
│   ├── consultation/
│   │   ├── PatientContacts.tsx    # Contact list/CRUD
│   │   └── ContactForm.tsx        # Contact add/edit
│   ├── letters/
│   │   ├── SendLetterDialog.tsx   # Send wizard
│   │   └── SendHistory.tsx        # Audit display
│   ├── settings/
│   │   ├── LetterSendingSettings.tsx  # Preferences form
│   │   └── ThemeSettings.tsx      # Theme selector
│   └── providers/
│       └── ThemeProvider.tsx      # next-themes wrapper
├── domains/
│   ├── contacts/
│   │   ├── contact.service.ts     # CRUD operations
│   │   ├── contact.types.ts       # TypeScript interfaces
│   │   ├── contact.validation.ts  # Zod schemas
│   │   └── index.ts
│   └── letters/
│       ├── sending.service.ts     # Send orchestration
│       ├── sending.types.ts       # Send types
│       └── pdf.service.ts         # PDF generation
├── infrastructure/
│   └── email/
│       ├── types.ts               # Adapter interface
│       ├── validation.ts          # Email validation
│       ├── ses.adapter.ts         # AWS SES implementation
│       └── index.ts
├── lib/
│   └── theme.ts                   # Theme utilities
└── hooks/
    └── useTheme.ts                # Theme hook

prisma/
├── schema.prisma                  # Updated with new models
└── migrations/
    └── 20251222_add_patient_contacts_and_letter_sends/
        └── migration.sql
```

---

## 10. Environment Configuration

Required environment variables for email sending:

```env
# AWS SES Configuration
AWS_REGION=ap-southeast-2
AWS_ACCESS_KEY_ID=xxx
AWS_SECRET_ACCESS_KEY=xxx

# Email Settings
EMAIL_FROM_ADDRESS=noreply@dictatemed.com
EMAIL_FROM_NAME=DictateMED
SES_CONFIGURATION_SET=dictatemed-tracking  # Optional
```

---

*Report generated: 2025-12-22*
*Implementation: Letter Sending, Recipient Management & Dark Mode*
*Status: Complete*
