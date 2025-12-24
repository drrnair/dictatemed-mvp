-- Add onboarding completion tracking to users
ALTER TABLE "users" ADD COLUMN "onboarding_completed_at" TIMESTAMP(3);

-- Add clinician role enum type if not exists
DO $$ BEGIN
    CREATE TYPE "ClinicianRole" AS ENUM ('MEDICAL', 'NURSING', 'ALLIED_HEALTH');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- Add clinician role to users (default MEDICAL for existing users)
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "clinician_role" "ClinicianRole" NOT NULL DEFAULT 'MEDICAL';

-- Add custom request status enum type if not exists
DO $$ BEGIN
    CREATE TYPE "CustomRequestStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- Create medical specialties table (global taxonomy)
CREATE TABLE IF NOT EXISTS "medical_specialties" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "description" TEXT,
    "synonyms" JSONB NOT NULL DEFAULT '[]',
    "active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "medical_specialties_pkey" PRIMARY KEY ("id")
);

-- Create unique indexes on medical_specialties
CREATE UNIQUE INDEX IF NOT EXISTS "medical_specialties_name_key" ON "medical_specialties"("name");
CREATE UNIQUE INDEX IF NOT EXISTS "medical_specialties_slug_key" ON "medical_specialties"("slug");
CREATE INDEX IF NOT EXISTS "medical_specialties_active_idx" ON "medical_specialties"("active");

-- Create medical subspecialties table
CREATE TABLE IF NOT EXISTS "medical_subspecialties" (
    "id" TEXT NOT NULL,
    "specialty_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "description" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "medical_subspecialties_pkey" PRIMARY KEY ("id")
);

-- Create indexes on medical_subspecialties
CREATE INDEX IF NOT EXISTS "medical_subspecialties_specialty_id_idx" ON "medical_subspecialties"("specialty_id");
CREATE UNIQUE INDEX IF NOT EXISTS "medical_subspecialties_specialty_id_slug_key" ON "medical_subspecialties"("specialty_id", "slug");
CREATE INDEX IF NOT EXISTS "medical_subspecialties_active_idx" ON "medical_subspecialties"("active");

-- Add foreign key constraint
ALTER TABLE "medical_subspecialties"
    ADD CONSTRAINT "medical_subspecialties_specialty_id_fkey"
    FOREIGN KEY ("specialty_id") REFERENCES "medical_specialties"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;

-- Create clinician specialty junction table
CREATE TABLE IF NOT EXISTS "clinician_specialties" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "specialty_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "clinician_specialties_pkey" PRIMARY KEY ("id")
);

-- Create indexes on clinician_specialties
CREATE UNIQUE INDEX IF NOT EXISTS "clinician_specialties_user_id_specialty_id_key" ON "clinician_specialties"("user_id", "specialty_id");
CREATE INDEX IF NOT EXISTS "clinician_specialties_user_id_idx" ON "clinician_specialties"("user_id");
CREATE INDEX IF NOT EXISTS "clinician_specialties_specialty_id_idx" ON "clinician_specialties"("specialty_id");

-- Add foreign key constraints
ALTER TABLE "clinician_specialties"
    ADD CONSTRAINT "clinician_specialties_user_id_fkey"
    FOREIGN KEY ("user_id") REFERENCES "users"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "clinician_specialties"
    ADD CONSTRAINT "clinician_specialties_specialty_id_fkey"
    FOREIGN KEY ("specialty_id") REFERENCES "medical_specialties"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;

-- Create clinician subspecialty junction table
CREATE TABLE IF NOT EXISTS "clinician_subspecialties" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "subspecialty_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "clinician_subspecialties_pkey" PRIMARY KEY ("id")
);

-- Create indexes on clinician_subspecialties
CREATE UNIQUE INDEX IF NOT EXISTS "clinician_subspecialties_user_id_subspecialty_id_key" ON "clinician_subspecialties"("user_id", "subspecialty_id");
CREATE INDEX IF NOT EXISTS "clinician_subspecialties_user_id_idx" ON "clinician_subspecialties"("user_id");
CREATE INDEX IF NOT EXISTS "clinician_subspecialties_subspecialty_id_idx" ON "clinician_subspecialties"("subspecialty_id");

-- Add foreign key constraints
ALTER TABLE "clinician_subspecialties"
    ADD CONSTRAINT "clinician_subspecialties_user_id_fkey"
    FOREIGN KEY ("user_id") REFERENCES "users"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "clinician_subspecialties"
    ADD CONSTRAINT "clinician_subspecialties_subspecialty_id_fkey"
    FOREIGN KEY ("subspecialty_id") REFERENCES "medical_subspecialties"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;

-- Create custom specialty table (user-submitted, pending review)
CREATE TABLE IF NOT EXISTS "custom_specialties" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "region" TEXT,
    "notes" TEXT,
    "status" "CustomRequestStatus" NOT NULL DEFAULT 'PENDING',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "custom_specialties_pkey" PRIMARY KEY ("id")
);

-- Create indexes on custom_specialties
CREATE INDEX IF NOT EXISTS "custom_specialties_user_id_idx" ON "custom_specialties"("user_id");
CREATE INDEX IF NOT EXISTS "custom_specialties_status_idx" ON "custom_specialties"("status");
CREATE UNIQUE INDEX IF NOT EXISTS "custom_specialties_user_id_name_key" ON "custom_specialties"("user_id", "name");

-- Add foreign key constraint
ALTER TABLE "custom_specialties"
    ADD CONSTRAINT "custom_specialties_user_id_fkey"
    FOREIGN KEY ("user_id") REFERENCES "users"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;

-- Create custom subspecialty table (user-submitted, pending review)
CREATE TABLE IF NOT EXISTS "custom_subspecialties" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "specialty_id" TEXT,
    "custom_specialty_id" TEXT,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "status" "CustomRequestStatus" NOT NULL DEFAULT 'PENDING',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "custom_subspecialties_pkey" PRIMARY KEY ("id")
);

-- Create indexes on custom_subspecialties
CREATE INDEX IF NOT EXISTS "custom_subspecialties_user_id_idx" ON "custom_subspecialties"("user_id");
CREATE INDEX IF NOT EXISTS "custom_subspecialties_specialty_id_idx" ON "custom_subspecialties"("specialty_id");
CREATE INDEX IF NOT EXISTS "custom_subspecialties_custom_specialty_id_idx" ON "custom_subspecialties"("custom_specialty_id");
CREATE INDEX IF NOT EXISTS "custom_subspecialties_status_idx" ON "custom_subspecialties"("status");
CREATE UNIQUE INDEX IF NOT EXISTS "custom_subspecialties_user_id_specialty_id_name_key" ON "custom_subspecialties"("user_id", "specialty_id", "name");

-- Add foreign key constraints
ALTER TABLE "custom_subspecialties"
    ADD CONSTRAINT "custom_subspecialties_user_id_fkey"
    FOREIGN KEY ("user_id") REFERENCES "users"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "custom_subspecialties"
    ADD CONSTRAINT "custom_subspecialties_specialty_id_fkey"
    FOREIGN KEY ("specialty_id") REFERENCES "medical_specialties"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "custom_subspecialties"
    ADD CONSTRAINT "custom_subspecialties_custom_specialty_id_fkey"
    FOREIGN KEY ("custom_specialty_id") REFERENCES "custom_specialties"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;

-- For existing users who completed old onboarding (have legacy subspecialties),
-- mark their onboarding as complete
UPDATE "users"
SET "onboarding_completed_at" = "created_at"
WHERE array_length("subspecialties", 1) > 0
  AND "onboarding_completed_at" IS NULL;
