-- Migration: Add Supabase Storage fields to Document table
-- This migration adds support for:
-- 1. Supabase Storage path (replacing S3)
-- 2. Retention policy fields for PHI compliance
-- 3. Soft delete support for documents

-- Make s3Key nullable (deprecated, now using storagePath)
ALTER TABLE "documents" ALTER COLUMN "s3Key" DROP NOT NULL;

-- Add Supabase Storage path
ALTER TABLE "documents" ADD COLUMN IF NOT EXISTS "storagePath" TEXT;

-- Add retention policy fields
ALTER TABLE "documents" ADD COLUMN IF NOT EXISTS "retentionUntil" TIMESTAMP(3);
ALTER TABLE "documents" ADD COLUMN IF NOT EXISTS "deletedAt" TIMESTAMP(3);
ALTER TABLE "documents" ADD COLUMN IF NOT EXISTS "deletionReason" TEXT;

-- Add index for retention cleanup job
CREATE INDEX IF NOT EXISTS "documents_retentionUntil_idx" ON "documents"("retentionUntil");

-- Add comment for documentation
COMMENT ON COLUMN "documents"."s3Key" IS 'DEPRECATED: Use storagePath for Supabase Storage';
COMMENT ON COLUMN "documents"."storagePath" IS 'Supabase Storage path: {userId}/{patientId}/{docType}/{filename}_{timestamp}.{ext}';
COMMENT ON COLUMN "documents"."retentionUntil" IS 'When the document should be deleted per retention policy';
COMMENT ON COLUMN "documents"."deletedAt" IS 'When the document file was deleted from storage (soft delete)';
COMMENT ON COLUMN "documents"."deletionReason" IS 'Reason for deletion: retention_expired, user_requested, etc.';
