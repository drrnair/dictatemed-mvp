-- Add two-phase extraction support for fast multi-document upload
-- Phase 1: Fast extraction - patient identifiers only (<5 seconds)
-- Phase 2: Full extraction - complete context in background (<60 seconds)

-- CreateEnum for fast extraction status
CREATE TYPE "FastExtractionStatus" AS ENUM ('PENDING', 'PROCESSING', 'COMPLETE', 'FAILED');

-- CreateEnum for full extraction status
CREATE TYPE "FullExtractionStatus" AS ENUM ('PENDING', 'PROCESSING', 'COMPLETE', 'FAILED');

-- Add fast extraction columns to referral_documents
ALTER TABLE "referral_documents" ADD COLUMN "fast_extraction_status" "FastExtractionStatus" DEFAULT 'PENDING';
ALTER TABLE "referral_documents" ADD COLUMN "fast_extraction_data" JSONB;
ALTER TABLE "referral_documents" ADD COLUMN "fast_extraction_started_at" TIMESTAMP(3);
ALTER TABLE "referral_documents" ADD COLUMN "fast_extraction_completed_at" TIMESTAMP(3);
ALTER TABLE "referral_documents" ADD COLUMN "fast_extraction_error" TEXT;

-- Add full extraction status columns (result stored in existing extractedData)
ALTER TABLE "referral_documents" ADD COLUMN "full_extraction_status" "FullExtractionStatus" DEFAULT 'PENDING';
ALTER TABLE "referral_documents" ADD COLUMN "full_extraction_started_at" TIMESTAMP(3);
ALTER TABLE "referral_documents" ADD COLUMN "full_extraction_completed_at" TIMESTAMP(3);
ALTER TABLE "referral_documents" ADD COLUMN "full_extraction_error" TEXT;

-- Create indexes for status filtering
CREATE INDEX "referral_documents_fast_extraction_status_idx" ON "referral_documents"("fast_extraction_status");
CREATE INDEX "referral_documents_full_extraction_status_idx" ON "referral_documents"("full_extraction_status");
