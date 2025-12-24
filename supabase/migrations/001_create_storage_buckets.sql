-- Supabase Storage Bucket Setup for DictateMED
-- This migration creates private storage buckets for PHI data with RLS policies.
--
-- IMPORTANT: Run this migration via Supabase Dashboard SQL Editor or supabase CLI.
-- This is NOT a Prisma migration - it manages Supabase Storage infrastructure.
--
-- PHI Security Notes:
-- - All buckets are PRIVATE (no public access)
-- - RLS policies enforce user-level isolation
-- - Signed URLs are required for all access
-- - Supabase provides at-rest encryption automatically

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
-- Stores PDFs, ECG images, echo reports, etc.
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'clinical-documents',
  'clinical-documents',
  false,  -- Private bucket
  52428800,  -- 50MB max file size
  ARRAY['application/pdf', 'image/png', 'image/jpeg', 'image/tiff']::text[]
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
-- SERVICE ROLE ACCESS
-- ============================================================================
-- The service role key bypasses RLS by default in Supabase.
-- This is intentional for server-side operations that have already
-- performed authorization checks in application code.
--
-- SECURITY: Never expose the service role key to clients.

-- ============================================================================
-- VERIFICATION QUERIES
-- ============================================================================
-- Run these queries to verify the setup:

-- Check buckets exist:
-- SELECT * FROM storage.buckets WHERE id IN ('audio-recordings', 'clinical-documents');

-- Check policies exist:
-- SELECT policyname, tablename, cmd FROM pg_policies
-- WHERE schemaname = 'storage' AND tablename = 'objects';
