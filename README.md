# DictateMED

Clinical documentation tool for medical specialists. Records consultations, ingests clinical documents, generates AI-drafted letters, and emails them to referrers.

## Architecture

- **Framework**: Next.js 14 (App Router)
- **Database**: PostgreSQL (Prisma ORM)
- **Storage**: Supabase Storage (private buckets)
- **Authentication**: Auth0
- **AI**: AWS Bedrock (Claude models)
- **Transcription**: Deepgram
- **Email**: Resend

## Quick Start

### Prerequisites

- Node.js 18+
- PostgreSQL 14+
- Supabase project
- Auth0 application
- AWS account (for Bedrock)
- Deepgram account
- Resend account

### Installation

```bash
# Install dependencies
npm install

# Copy environment file
cp .env.example .env.local

# Generate Prisma client
npm run db:generate

# Run database migrations
npm run db:migrate

# Start development server
npm run dev
```

## Environment Setup

### Required Environment Variables

Copy `.env.example` to `.env.local` and configure:

#### Database
```
DATABASE_URL="postgresql://user:password@localhost:5432/dictatemed"
```

#### Auth0
```
AUTH0_SECRET="[generate-random-32-bytes]"
AUTH0_BASE_URL="http://localhost:3000"
AUTH0_ISSUER_BASE_URL="https://your-tenant.auth0.com"
AUTH0_CLIENT_ID="your-client-id"
AUTH0_CLIENT_SECRET="your-client-secret"
```

#### Supabase (Storage)
Get credentials from Supabase Dashboard → Settings → API:
```
NEXT_PUBLIC_SUPABASE_URL="https://your-project.supabase.co"
NEXT_PUBLIC_SUPABASE_ANON_KEY="your-anon-public-key"
SUPABASE_SERVICE_ROLE_KEY="your-service-role-key"
```

**Security**: Never expose `SUPABASE_SERVICE_ROLE_KEY` to the client.

#### AWS Bedrock (AI)
```
AWS_REGION="ap-southeast-2"
AWS_ACCESS_KEY_ID="your-access-key"
AWS_SECRET_ACCESS_KEY="your-secret-key"
BEDROCK_OPUS_MODEL_ID="anthropic.claude-opus-4-20250514-v1:0"
BEDROCK_SONNET_MODEL_ID="anthropic.claude-sonnet-4-20250514-v1:0"
```

#### Deepgram (Transcription)
```
DEEPGRAM_API_KEY="your-api-key"
DEEPGRAM_WEBHOOK_URL="https://your-domain.com/api/transcription/webhook"
DEEPGRAM_WEBHOOK_SECRET="your-webhook-secret"
```

#### Resend (Email)
```
RESEND_API_KEY="re_your-api-key"
RESEND_FROM_EMAIL="noreply@dictatemed.com"
```

#### Security
```
PHI_ENCRYPTION_KEY="[generate-with: openssl rand -base64 32]"
```

## Supabase Setup

### 1. Create Storage Buckets

Run the SQL migrations in your Supabase SQL Editor:

```bash
# Option 1: Use Supabase CLI
supabase link --project-ref your-project-ref
supabase db push

# Option 2: Copy migration files to SQL Editor
# See supabase/migrations/ directory
```

The migrations create three private storage buckets:

| Bucket | Purpose | Max Size |
|--------|---------|----------|
| `audio-recordings` | Consultation audio | 500MB |
| `clinical-documents` | Clinical PDFs/images | 50MB |
| `user-assets` | Signatures, letterheads | 10MB |

### 2. Verify Setup

```bash
npx tsx scripts/verify-supabase.ts
```

See [supabase/README.md](supabase/README.md) for detailed setup instructions.

## Database Setup

### Prisma Migrations

```bash
# Development: create and apply migrations
npm run db:migrate

# Production: apply migrations only
npx prisma migrate deploy

# View database
npm run db:studio
```

### RLS Policies

Row Level Security is configured for PHI protection. Run the RLS migration after Prisma migrations:

```sql
-- In Supabase SQL Editor
-- See supabase/migrations/002_enable_rls_policies.sql
```

## Development

### Scripts

```bash
npm run dev          # Start dev server
npm run build        # Production build
npm run lint         # ESLint
npm run typecheck    # TypeScript check
npm run test         # Run unit tests
npm run test:e2e     # Run Playwright tests
npm run verify       # Lint + typecheck + tests
```

### Project Structure

```
src/
├── app/              # Next.js App Router
│   └── api/          # API routes
├── components/       # React components
├── domains/          # Business logic by domain
│   ├── recording/    # Audio recording & transcription
│   ├── documents/    # Clinical document processing
│   ├── letters/      # Letter generation
│   └── ...
├── infrastructure/   # External service integrations
│   ├── supabase/     # Supabase storage client
│   ├── bedrock/      # AWS Bedrock AI
│   └── email/        # Resend email service
└── lib/              # Shared utilities
```

## PHI and HIPAA Considerations

DictateMED processes Protected Health Information (PHI). The architecture follows HIPAA-aligned patterns:

### Storage Security
- All storage buckets are **private** (no public URLs)
- Files accessed via **signed URLs** (15 min upload, 1 hour download)
- **Row Level Security** enforces user isolation
- Audio recordings deleted after transcription

### Data Flow
- Patient data encrypted at rest (AES-256-GCM)
- Supabase provides encryption at rest
- All PHI access logged to `audit_logs` table

### Email Security
- PHI in PDF attachment only
- Generic subject lines (patient initials only)
- Medico-legal disclaimer in body
- All sends logged to `sent_emails` table

### Access Control
- Users can only access their own data
- Practice admins see aggregates, not raw PHI
- Service role keys server-side only

## Verification Scripts

```bash
# Verify Supabase connection
npx tsx scripts/verify-supabase.ts

# Run automated smoke test
npx tsx scripts/e2e-smoke-test.ts

# Interactive migration verification
npx tsx scripts/verify-migration-workflow.ts
```

## Deployment

### Vercel

1. Connect repository to Vercel
2. Add environment variables in Vercel dashboard
3. Deploy

### Required External Services

1. **Supabase**: Create project, run migrations, get API keys
2. **Auth0**: Create application, configure callbacks
3. **AWS**: Enable Bedrock access in your region
4. **Deepgram**: Get API key, configure webhooks
5. **Resend**: Verify domain, get API key

## License

Proprietary - All rights reserved.
