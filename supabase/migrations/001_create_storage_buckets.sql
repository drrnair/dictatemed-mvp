-- Supabase Storage Bucket Setup for DictateMED
-- This migration creates private storage buckets for PHI data with RLS policies.
--
-- IMPORTANT: Run this migration via Supabase Dashboard SQL Editor or supabase CLI.
-- This is NOT a Prisma migration - it manages Supabase Storage infrastructure.
--
-- ============================================================================
-- PHI SECURITY ARCHITECTURE
-- ============================================================================
-- - All buckets are PRIVATE (no public access)
-- - Supabase provides at-rest encryption automatically
-- - Signed URLs are required for all file access
-- - File paths embed user/practice IDs for logical isolation
--
-- ============================================================================
-- AUTH0 vs SUPABASE AUTH - CRITICAL NOTE
-- ============================================================================
-- DictateMED uses Auth0 for authentication, NOT Supabase Auth. This means:
--
-- 1. auth.uid() returns NULL for Auth0-authenticated requests
-- 2. RLS policies below that use auth.uid() will NOT work automatically
-- 3. ALL storage operations use the SERVICE ROLE client (server-side only)
-- 4. Authorization is enforced in APPLICATION CODE before calling Supabase
--
-- The RLS policies below serve as:
-- a) DEFENSE IN DEPTH: Blocks anon/public key access to storage
-- b) DOCUMENTATION: Shows intended access patterns
-- c) FUTURE-PROOFING: Ready if custom JWT claims are configured
--
-- SECURITY GUARANTEE:
-- - Service role key is ONLY used on the backend (never exposed to clients)
-- - User authentication is verified via Auth0 session before any storage operation
-- - File paths are validated to match authenticated user's ID
-- ============================================================================

-- ============================================================================
-- STORAGE BUCKETS
-- ============================================================================

-- Create audio-recordings bucket (private)
-- Stores consultation audio files (ambient and dictation modes)
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'audio-recordings',
  'audio-recordings',
  false,  -- Private bucket
  524288000,  -- 500MB max file size (supports 30+ min recordings)
  ARRAY['audio/webm', 'audio/mp4', 'audio/wav', 'audio/mpeg', 'audio/ogg']::text[]
)
ON CONFLICT (id) DO UPDATE SET
  public = EXCLUDED.public,
  file_size_limit = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;

-- Create clinical-documents bucket (private)
-- Stores PDFs, referral letters (text), ECG images, echo reports, iPhone photos (HEIC), etc.
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'clinical-documents',
  'clinical-documents',
  false,  -- Private bucket
  52428800,  -- 50MB max file size
  ARRAY['application/pdf', 'image/png', 'image/jpeg', 'image/tiff', 'text/plain', 'image/heic', 'image/heif']::text[]
)
ON CONFLICT (id) DO UPDATE SET
  public = EXCLUDED.public,
  file_size_limit = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;

-- Create user-assets bucket (private)
-- Stores signatures and letterheads
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'user-assets',
  'user-assets',
  false,  -- Private bucket
  5242880,  -- 5MB max file size (signatures and letterheads are small)
  ARRAY['image/png', 'image/jpeg', 'image/gif', 'image/webp']::text[]
)
ON CONFLICT (id) DO UPDATE SET
  public = EXCLUDED.public,
  file_size_limit = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;

-- ============================================================================
-- STORAGE RLS POLICIES
-- ============================================================================
-- File path convention: {user_id}/{resource_id}/{filename}
-- This allows RLS to enforce user-level isolation based on path prefix.

-- Enable RLS on storage.objects (should already be enabled, but ensure it)
ALTER TABLE storage.objects ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist (for idempotent re-runs)
DROP POLICY IF EXISTS "audio_recordings_select" ON storage.objects;
DROP POLICY IF EXISTS "audio_recordings_insert" ON storage.objects;
DROP POLICY IF EXISTS "audio_recordings_update" ON storage.objects;
DROP POLICY IF EXISTS "audio_recordings_delete" ON storage.objects;

DROP POLICY IF EXISTS "clinical_documents_select" ON storage.objects;
DROP POLICY IF EXISTS "clinical_documents_insert" ON storage.objects;
DROP POLICY IF EXISTS "clinical_documents_update" ON storage.objects;
DROP POLICY IF EXISTS "clinical_documents_delete" ON storage.objects;

DROP POLICY IF EXISTS "user_assets_select" ON storage.objects;
DROP POLICY IF EXISTS "user_assets_insert" ON storage.objects;
DROP POLICY IF EXISTS "user_assets_update" ON storage.objects;
DROP POLICY IF EXISTS "user_assets_delete" ON storage.objects;

-- ============================================================================
-- AUDIO RECORDINGS POLICIES
-- ============================================================================
-- Path format: {user_id}/{consultation_id}/{timestamp}_{mode}.{ext}

-- SELECT: Users can only read their own audio files
CREATE POLICY "audio_recordings_select"
ON storage.objects FOR SELECT
TO authenticated
USING (
  bucket_id = 'audio-recordings'
  AND (storage.foldername(name))[1] = auth.uid()::text
);

-- INSERT: Users can only upload to their own folder
CREATE POLICY "audio_recordings_insert"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'audio-recordings'
  AND (storage.foldername(name))[1] = auth.uid()::text
);

-- UPDATE: Users can only update their own files
CREATE POLICY "audio_recordings_update"
ON storage.objects FOR UPDATE
TO authenticated
USING (
  bucket_id = 'audio-recordings'
  AND (storage.foldername(name))[1] = auth.uid()::text
);

-- DELETE: Users can only delete their own files
CREATE POLICY "audio_recordings_delete"
ON storage.objects FOR DELETE
TO authenticated
USING (
  bucket_id = 'audio-recordings'
  AND (storage.foldername(name))[1] = auth.uid()::text
);

-- ============================================================================
-- CLINICAL DOCUMENTS POLICIES
-- ============================================================================
-- Path format: {user_id}/{patient_id}/{document_type}/{filename}_{timestamp}.{ext}

-- SELECT: Users can only read their own documents
CREATE POLICY "clinical_documents_select"
ON storage.objects FOR SELECT
TO authenticated
USING (
  bucket_id = 'clinical-documents'
  AND (storage.foldername(name))[1] = auth.uid()::text
);

-- INSERT: Users can only upload to their own folder
CREATE POLICY "clinical_documents_insert"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'clinical-documents'
  AND (storage.foldername(name))[1] = auth.uid()::text
);

-- UPDATE: Users can only update their own files
CREATE POLICY "clinical_documents_update"
ON storage.objects FOR UPDATE
TO authenticated
USING (
  bucket_id = 'clinical-documents'
  AND (storage.foldername(name))[1] = auth.uid()::text
);

-- DELETE: Users can only delete their own files
CREATE POLICY "clinical_documents_delete"
ON storage.objects FOR DELETE
TO authenticated
USING (
  bucket_id = 'clinical-documents'
  AND (storage.foldername(name))[1] = auth.uid()::text
);

-- ============================================================================
-- USER ASSETS POLICIES
-- ============================================================================
-- Path format:
--   Signatures: signatures/{user_id}/{timestamp}.{ext}
--   Letterheads: letterheads/{practice_id}/{timestamp}.{ext}
--
-- NOTE: Since the app uses Auth0 (not Supabase Auth), auth.uid() won't work
-- for RLS policies. Instead, we use the service role client for all operations
-- and implement authorization checks in application code.
--
-- The policies below are defined for completeness but won't be effective
-- until either:
-- 1. The app migrates to Supabase Auth, or
-- 2. Custom JWT claims are configured to pass Auth0 user IDs

-- SELECT: Users can read their own assets
CREATE POLICY "user_assets_select"
ON storage.objects FOR SELECT
TO authenticated
USING (
  bucket_id = 'user-assets'
  -- For signatures: user owns the file
  -- For letterheads: all practice members can read
  -- This simplified policy allows any authenticated user to read
  -- Application-level auth handles the actual access control
);

-- INSERT: Users can upload to their folder
CREATE POLICY "user_assets_insert"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'user-assets'
);

-- UPDATE: Users can update their files
CREATE POLICY "user_assets_update"
ON storage.objects FOR UPDATE
TO authenticated
USING (
  bucket_id = 'user-assets'
);

-- DELETE: Users can delete their files
CREATE POLICY "user_assets_delete"
ON storage.objects FOR DELETE
TO authenticated
USING (
  bucket_id = 'user-assets'
);

-- ============================================================================
-- SERVICE ROLE ACCESS
-- ============================================================================
-- The service role key bypasses RLS by default in Supabase.
-- This is intentional for server-side operations that have already
-- performed authorization checks in application code.
--
-- IMPORTANT: Since DictateMED uses Auth0 (not Supabase Auth), the RLS
-- policies above that use auth.uid() will NOT work for authenticated users.
-- All storage operations MUST use the service role client, and authorization
-- must be enforced in the application layer before calling Supabase.
--
-- SECURITY: Never expose the service role key to clients.

-- ============================================================================
-- VERIFICATION QUERIES
-- ============================================================================
-- Run these queries to verify the setup:

-- Check buckets exist:
-- SELECT * FROM storage.buckets WHERE id IN ('audio-recordings', 'clinical-documents', 'user-assets');

-- Check policies exist:
-- SELECT policyname, tablename, cmd FROM pg_policies
-- WHERE schemaname = 'storage' AND tablename = 'objects';
