# Supabase Setup

This directory contains Supabase-specific migrations and configuration for DictateMED.

## Prerequisites

1. Create a Supabase project at https://supabase.com
2. Copy your project credentials:
   - Project URL (Settings → API → Project URL)
   - Anon public key (Settings → API → Project API keys → anon public)
   - Service role key (Settings → API → Project API keys → service_role)

## Environment Variables

Add these to your `.env.local`:

```bash
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
```

**SECURITY WARNING**: Never expose `SUPABASE_SERVICE_ROLE_KEY` to the client. It bypasses Row Level Security.

## Running Migrations

### Option 1: Supabase Dashboard (Recommended for initial setup)

1. Go to your Supabase project dashboard
2. Navigate to SQL Editor
3. Copy and paste the contents of each migration file in order
4. Execute each migration

### Option 2: Supabase CLI

```bash
# Install Supabase CLI
npm install -g supabase

# Link to your project
supabase link --project-ref your-project-ref

# Run migrations
supabase db push
```

## Storage Buckets

The migrations create three private storage buckets:

| Bucket | Purpose | Max Size | Allowed Types |
|--------|---------|----------|---------------|
| `audio-recordings` | Consultation audio | 500MB | webm, mp4, wav, mpeg, ogg |
| `clinical-documents` | Clinical PDFs/images | 50MB | pdf, png, jpeg, tiff |
| `user-assets` | Signatures, letterheads | 5MB | png, jpeg, gif, webp |

All buckets:
- Are **private** (no public access)
- Have Row Level Security enabled
- Enforce user-level isolation via path prefix
- Require signed URLs for all access

## File Path Conventions

### Audio Recordings
```
{user_id}/{consultation_id}/{timestamp}_{mode}.{ext}
```
Example: `550e8400-e29b-41d4-a716-446655440000/abc123/1703460000000_dictation.webm`

### Clinical Documents
```
{user_id}/{patient_id}/{document_type}/{filename}_{timestamp}.{ext}
```
Example: `550e8400-e29b-41d4-a716-446655440000/patient123/echocardiogram/report_1703460000000.pdf`

### User Assets (Signatures)
```
signatures/{user_id}/{timestamp}.{ext}
```
Example: `signatures/550e8400-e29b-41d4-a716-446655440000/1703460000000.png`

### User Assets (Letterheads)
```
letterheads/{practice_id}/{timestamp}.{ext}
```
Example: `letterheads/practice-abc123/1703460000000.png`

## RLS Policies

Storage RLS policies enforce that:
- Users can only access files in their own user_id folder
- All CRUD operations require authentication
- No cross-user access is possible even with file path knowledge

## Verification

After running migrations, verify setup with these queries in SQL Editor:

```sql
-- Check buckets exist
SELECT * FROM storage.buckets
WHERE id IN ('audio-recordings', 'clinical-documents', 'user-assets');

-- Check policies exist
SELECT policyname, tablename, cmd
FROM pg_policies
WHERE schemaname = 'storage' AND tablename = 'objects';
```

## PHI/HIPAA Notes

- All PHI is stored in private buckets with RLS
- Server-side uses service role key (bypasses RLS after authorization check)
- Signed URLs are short-lived (15 min upload, 1 hour download)
- Audio is deleted after successful transcription
- Documents have configurable retention policies
- All storage access is logged to audit_logs table
