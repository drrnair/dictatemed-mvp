-- Migration: Add Per-Subspecialty Style Learning
-- Created: 2024-12-22
-- Description: Adds tables and columns for per-clinician, per-subspecialty style learning

-- Add subspecialty column to StyleEdit (nullable for existing records)
ALTER TABLE "style_edits" ADD COLUMN "subspecialty" TEXT;

-- Add subspecialty column to Letter (nullable for existing records)
ALTER TABLE "letters" ADD COLUMN "subspecialty" TEXT;

-- Create StyleProfile table for per-subspecialty preferences
CREATE TABLE "style_profiles" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "subspecialty" TEXT NOT NULL,
    "sectionOrder" TEXT[],
    "sectionInclusion" JSONB NOT NULL DEFAULT '{}',
    "sectionVerbosity" JSONB NOT NULL DEFAULT '{}',
    "phrasingPreferences" JSONB NOT NULL DEFAULT '{}',
    "avoidedPhrases" JSONB NOT NULL DEFAULT '{}',
    "vocabularyMap" JSONB NOT NULL DEFAULT '{}',
    "terminologyLevel" TEXT,
    "greetingStyle" TEXT,
    "closingStyle" TEXT,
    "signoffTemplate" TEXT,
    "formalityLevel" TEXT,
    "paragraphStructure" TEXT,
    "confidence" JSONB NOT NULL DEFAULT '{}',
    "learningStrength" DOUBLE PRECISION NOT NULL DEFAULT 1.0,
    "totalEditsAnalyzed" INTEGER NOT NULL DEFAULT 0,
    "lastAnalyzedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "style_profiles_pkey" PRIMARY KEY ("id")
);

-- Create StyleSeedLetter table for bootstrapping profiles
CREATE TABLE "style_seed_letters" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "subspecialty" TEXT NOT NULL,
    "letterText" TEXT NOT NULL,
    "analyzedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "style_seed_letters_pkey" PRIMARY KEY ("id")
);

-- Create StyleAnalyticsAggregate table for de-identified analytics
CREATE TABLE "style_analytics_aggregates" (
    "id" TEXT NOT NULL,
    "subspecialty" TEXT NOT NULL,
    "period" TEXT NOT NULL,
    "commonAdditions" JSONB,
    "commonDeletions" JSONB,
    "sectionOrderPatterns" JSONB,
    "phrasingPatterns" JSONB,
    "sampleSize" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "style_analytics_aggregates_pkey" PRIMARY KEY ("id")
);

-- Add unique constraint for userId + subspecialty on StyleProfile
CREATE UNIQUE INDEX "style_profiles_userId_subspecialty_key" ON "style_profiles"("userId", "subspecialty");

-- Add index on userId for faster lookups
CREATE INDEX "style_profiles_userId_idx" ON "style_profiles"("userId");

-- Add index on StyleSeedLetter for userId + subspecialty
CREATE INDEX "style_seed_letters_userId_subspecialty_idx" ON "style_seed_letters"("userId", "subspecialty");

-- Add unique constraint for subspecialty + period on StyleAnalyticsAggregate
CREATE UNIQUE INDEX "style_analytics_aggregates_subspecialty_period_key" ON "style_analytics_aggregates"("subspecialty", "period");

-- Add foreign key constraints
ALTER TABLE "style_profiles" ADD CONSTRAINT "style_profiles_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "style_seed_letters" ADD CONSTRAINT "style_seed_letters_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Add index on style_edits subspecialty for filtering
CREATE INDEX "style_edits_subspecialty_idx" ON "style_edits"("subspecialty");

-- Add index on letters subspecialty for filtering
CREATE INDEX "letters_subspecialty_idx" ON "letters"("subspecialty");
