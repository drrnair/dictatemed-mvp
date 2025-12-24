-- Add Supabase Storage fields to recordings table
-- This migration adds storagePath (for Supabase Storage) and audioDeletedAt (for retention tracking)

-- Add storagePath column for Supabase Storage paths
-- Format: {userId}/{consultationId}/{timestamp}_{mode}.{ext}
ALTER TABLE "recordings" ADD COLUMN "storagePath" TEXT;

-- Add audioDeletedAt for tracking when audio was deleted (retention policy)
ALTER TABLE "recordings" ADD COLUMN "audioDeletedAt" TIMESTAMP(3);

-- Create index for finding recordings with audio still in storage
-- Useful for retention cleanup jobs
CREATE INDEX "recordings_audioDeletedAt_idx" ON "recordings"("audioDeletedAt") WHERE "audioDeletedAt" IS NULL;

-- Note: s3AudioKey is deprecated but kept for backward compatibility during migration
-- It can be removed in a future migration once all data is migrated to Supabase
