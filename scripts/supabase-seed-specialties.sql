-- ============================================================================
-- DictateMED: Medical Specialties Setup for Supabase
-- ============================================================================
-- This script creates the medical specialty tables (if not exist) and seeds
-- them with specialty data. Safe to run multiple times (idempotent).
--
-- Run this in: Supabase Dashboard → SQL Editor → New Query → Paste & Run
-- ============================================================================

-- ============================================================================
-- STEP 1: Add onboarding column to users (if not exists)
-- ============================================================================
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "onboarding_completed_at" TIMESTAMP(3);

-- ============================================================================
-- STEP 2: Create enum types (if not exist)
-- ============================================================================
DO $$ BEGIN
    CREATE TYPE "ClinicianRole" AS ENUM ('MEDICAL', 'NURSING', 'ALLIED_HEALTH');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE "CustomRequestStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- Add clinician role to users (if not exists)
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "clinician_role" "ClinicianRole" NOT NULL DEFAULT 'MEDICAL';

-- ============================================================================
-- STEP 3: Create medical_specialties table
-- ============================================================================
CREATE TABLE IF NOT EXISTS "medical_specialties" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "description" TEXT,
    "synonyms" JSONB NOT NULL DEFAULT '[]',
    "active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "medical_specialties_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "medical_specialties_name_key" ON "medical_specialties"("name");
CREATE UNIQUE INDEX IF NOT EXISTS "medical_specialties_slug_key" ON "medical_specialties"("slug");
CREATE INDEX IF NOT EXISTS "medical_specialties_active_idx" ON "medical_specialties"("active");

-- ============================================================================
-- STEP 4: Create medical_subspecialties table
-- ============================================================================
CREATE TABLE IF NOT EXISTS "medical_subspecialties" (
    "id" TEXT NOT NULL,
    "specialty_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "description" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "medical_subspecialties_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "medical_subspecialties_specialty_id_idx" ON "medical_subspecialties"("specialty_id");
CREATE UNIQUE INDEX IF NOT EXISTS "medical_subspecialties_specialty_id_slug_key" ON "medical_subspecialties"("specialty_id", "slug");
CREATE INDEX IF NOT EXISTS "medical_subspecialties_active_idx" ON "medical_subspecialties"("active");

-- Add FK if not exists (wrapped to handle existing constraint)
DO $$ BEGIN
    ALTER TABLE "medical_subspecialties"
        ADD CONSTRAINT "medical_subspecialties_specialty_id_fkey"
        FOREIGN KEY ("specialty_id") REFERENCES "medical_specialties"("id")
        ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- ============================================================================
-- STEP 5: Create clinician_specialties junction table
-- ============================================================================
CREATE TABLE IF NOT EXISTS "clinician_specialties" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "specialty_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "clinician_specialties_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "clinician_specialties_user_id_specialty_id_key" ON "clinician_specialties"("user_id", "specialty_id");
CREATE INDEX IF NOT EXISTS "clinician_specialties_user_id_idx" ON "clinician_specialties"("user_id");
CREATE INDEX IF NOT EXISTS "clinician_specialties_specialty_id_idx" ON "clinician_specialties"("specialty_id");

DO $$ BEGIN
    ALTER TABLE "clinician_specialties"
        ADD CONSTRAINT "clinician_specialties_user_id_fkey"
        FOREIGN KEY ("user_id") REFERENCES "users"("id")
        ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    ALTER TABLE "clinician_specialties"
        ADD CONSTRAINT "clinician_specialties_specialty_id_fkey"
        FOREIGN KEY ("specialty_id") REFERENCES "medical_specialties"("id")
        ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- ============================================================================
-- STEP 6: Create clinician_subspecialties junction table
-- ============================================================================
CREATE TABLE IF NOT EXISTS "clinician_subspecialties" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "subspecialty_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "clinician_subspecialties_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "clinician_subspecialties_user_id_subspecialty_id_key" ON "clinician_subspecialties"("user_id", "subspecialty_id");
CREATE INDEX IF NOT EXISTS "clinician_subspecialties_user_id_idx" ON "clinician_subspecialties"("user_id");
CREATE INDEX IF NOT EXISTS "clinician_subspecialties_subspecialty_id_idx" ON "clinician_subspecialties"("subspecialty_id");

DO $$ BEGIN
    ALTER TABLE "clinician_subspecialties"
        ADD CONSTRAINT "clinician_subspecialties_user_id_fkey"
        FOREIGN KEY ("user_id") REFERENCES "users"("id")
        ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    ALTER TABLE "clinician_subspecialties"
        ADD CONSTRAINT "clinician_subspecialties_subspecialty_id_fkey"
        FOREIGN KEY ("subspecialty_id") REFERENCES "medical_subspecialties"("id")
        ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- ============================================================================
-- STEP 7: Create custom_specialties table
-- ============================================================================
CREATE TABLE IF NOT EXISTS "custom_specialties" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "region" TEXT,
    "notes" TEXT,
    "status" "CustomRequestStatus" NOT NULL DEFAULT 'PENDING',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "approved_specialty_id" TEXT,

    CONSTRAINT "custom_specialties_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "custom_specialties_user_id_idx" ON "custom_specialties"("user_id");
CREATE INDEX IF NOT EXISTS "custom_specialties_status_idx" ON "custom_specialties"("status");
CREATE UNIQUE INDEX IF NOT EXISTS "custom_specialties_user_id_name_key" ON "custom_specialties"("user_id", "name");

DO $$ BEGIN
    ALTER TABLE "custom_specialties"
        ADD CONSTRAINT "custom_specialties_user_id_fkey"
        FOREIGN KEY ("user_id") REFERENCES "users"("id")
        ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- ============================================================================
-- STEP 8: Create custom_subspecialties table
-- ============================================================================
CREATE TABLE IF NOT EXISTS "custom_subspecialties" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "specialty_id" TEXT,
    "custom_specialty_id" TEXT,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "status" "CustomRequestStatus" NOT NULL DEFAULT 'PENDING',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "approved_subspecialty_id" TEXT,

    CONSTRAINT "custom_subspecialties_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "custom_subspecialties_user_id_idx" ON "custom_subspecialties"("user_id");
CREATE INDEX IF NOT EXISTS "custom_subspecialties_specialty_id_idx" ON "custom_subspecialties"("specialty_id");
CREATE INDEX IF NOT EXISTS "custom_subspecialties_custom_specialty_id_idx" ON "custom_subspecialties"("custom_specialty_id");
CREATE INDEX IF NOT EXISTS "custom_subspecialties_status_idx" ON "custom_subspecialties"("status");
CREATE UNIQUE INDEX IF NOT EXISTS "custom_subspecialties_user_id_specialty_id_name_key" ON "custom_subspecialties"("user_id", "specialty_id", "name");

DO $$ BEGIN
    ALTER TABLE "custom_subspecialties"
        ADD CONSTRAINT "custom_subspecialties_user_id_fkey"
        FOREIGN KEY ("user_id") REFERENCES "users"("id")
        ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    ALTER TABLE "custom_subspecialties"
        ADD CONSTRAINT "custom_subspecialties_specialty_id_fkey"
        FOREIGN KEY ("specialty_id") REFERENCES "medical_specialties"("id")
        ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    ALTER TABLE "custom_subspecialties"
        ADD CONSTRAINT "custom_subspecialties_custom_specialty_id_fkey"
        FOREIGN KEY ("custom_specialty_id") REFERENCES "custom_specialties"("id")
        ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- ============================================================================
-- STEP 9: SEED MEDICAL SPECIALTIES (42 specialties)
-- ============================================================================
-- Using INSERT ... ON CONFLICT to make this idempotent

INSERT INTO "medical_specialties" ("id", "name", "slug", "description", "synonyms", "active", "updated_at") VALUES
-- Primary Care
('00000000-0001-0001-0001-000000000000', 'General Practice', 'general-practice', 'Primary care medicine providing comprehensive healthcare across all ages and conditions', '["GP", "family medicine", "family doctor", "primary care", "family physician"]', true, CURRENT_TIMESTAMP),
('00000000-0001-0001-0002-000000000000', 'Internal Medicine', 'internal-medicine', 'Diagnosis and non-surgical treatment of diseases affecting internal organs', '["internist", "general medicine", "physician", "general physician"]', true, CURRENT_TIMESTAMP),

-- Cardiology & Cardiovascular
('00000000-0001-0001-0003-000000000000', 'Cardiology', 'cardiology', 'Diagnosis and treatment of heart and blood vessel disorders', '["cardiologist", "heart doctor", "cardiac medicine", "cardiovascular medicine"]', true, CURRENT_TIMESTAMP),
('00000000-0001-0001-0004-000000000000', 'Cardiothoracic Surgery', 'cardiothoracic-surgery', 'Surgical treatment of diseases affecting the heart, lungs, and chest', '["cardiac surgery", "heart surgery", "CT surgery", "cardiovascular surgery"]', true, CURRENT_TIMESTAMP),
('00000000-0001-0001-0005-000000000000', 'Vascular Surgery', 'vascular-surgery', 'Surgical treatment of diseases affecting arteries and veins', '["vascular surgeon", "blood vessel surgery"]', true, CURRENT_TIMESTAMP),

-- Neurosciences
('00000000-0001-0001-0006-000000000000', 'Neurology', 'neurology', 'Diagnosis and treatment of disorders of the nervous system', '["neurologist", "brain doctor", "nerve doctor", "neurological medicine"]', true, CURRENT_TIMESTAMP),
('00000000-0001-0001-0007-000000000000', 'Neurosurgery', 'neurosurgery', 'Surgical treatment of disorders affecting the brain, spine, and nervous system', '["neurosurgeon", "brain surgery", "spine surgery"]', true, CURRENT_TIMESTAMP),

-- Surgical Specialties
('00000000-0001-0001-0008-000000000000', 'General Surgery', 'general-surgery', 'Surgical treatment of abdominal organs, trauma, and soft tissue', '["general surgeon", "surgeon"]', true, CURRENT_TIMESTAMP),
('00000000-0001-0001-0009-000000000000', 'Orthopaedic Surgery', 'orthopaedic-surgery', 'Surgical treatment of musculoskeletal system disorders', '["orthopaedics", "orthopedics", "ortho", "bone doctor", "bone surgery", "orthopedic surgery"]', true, CURRENT_TIMESTAMP),
('00000000-0001-0001-0010-000000000000', 'Thoracic Surgery', 'thoracic-surgery', 'Surgical treatment of diseases affecting the chest, excluding the heart', '["thoracic surgeon", "lung surgery", "chest surgery"]', true, CURRENT_TIMESTAMP),
('00000000-0001-0001-0011-000000000000', 'Plastic Surgery', 'plastic-surgery', 'Reconstructive and cosmetic surgery', '["plastic surgeon", "reconstructive surgery", "cosmetic surgery"]', true, CURRENT_TIMESTAMP),
('00000000-0001-0001-0012-000000000000', 'Urology', 'urology', 'Diagnosis and treatment of urinary tract and male reproductive system disorders', '["urologist", "urological surgery"]', true, CURRENT_TIMESTAMP),

-- Medical Subspecialties
('00000000-0001-0001-0013-000000000000', 'Gastroenterology', 'gastroenterology', 'Diagnosis and treatment of digestive system disorders', '["gastroenterologist", "GI", "gut doctor", "digestive medicine"]', true, CURRENT_TIMESTAMP),
('00000000-0001-0001-0014-000000000000', 'Respiratory Medicine', 'respiratory-medicine', 'Diagnosis and treatment of lung and respiratory disorders', '["pulmonology", "pulmonologist", "lung doctor", "thoracic medicine", "chest medicine"]', true, CURRENT_TIMESTAMP),
('00000000-0001-0001-0015-000000000000', 'Endocrinology', 'endocrinology', 'Diagnosis and treatment of hormone and metabolic disorders', '["endocrinologist", "diabetes doctor", "thyroid doctor", "hormone doctor"]', true, CURRENT_TIMESTAMP),
('00000000-0001-0001-0016-000000000000', 'Rheumatology', 'rheumatology', 'Diagnosis and treatment of autoimmune and musculoskeletal disorders', '["rheumatologist", "arthritis doctor", "autoimmune specialist"]', true, CURRENT_TIMESTAMP),
('00000000-0001-0001-0017-000000000000', 'Nephrology', 'nephrology', 'Diagnosis and treatment of kidney disorders', '["nephrologist", "kidney doctor", "renal medicine"]', true, CURRENT_TIMESTAMP),
('00000000-0001-0001-0018-000000000000', 'Infectious Diseases', 'infectious-diseases', 'Diagnosis and treatment of infections caused by bacteria, viruses, fungi, and parasites', '["ID", "infection specialist"]', true, CURRENT_TIMESTAMP),

-- Oncology & Haematology
('00000000-0001-0001-0019-000000000000', 'Medical Oncology', 'medical-oncology', 'Non-surgical treatment of cancer using chemotherapy and targeted therapies', '["oncologist", "cancer doctor", "oncology"]', true, CURRENT_TIMESTAMP),
('00000000-0001-0001-0020-000000000000', 'Radiation Oncology', 'radiation-oncology', 'Treatment of cancer using radiation therapy', '["radiation oncologist", "radiotherapy"]', true, CURRENT_TIMESTAMP),
('00000000-0001-0001-0021-000000000000', 'Haematology', 'haematology', 'Diagnosis and treatment of blood disorders', '["hematology", "haematologist", "hematologist", "blood doctor"]', true, CURRENT_TIMESTAMP),

-- Head & Sensory
('00000000-0001-0001-0022-000000000000', 'Otolaryngology', 'otolaryngology', 'Diagnosis and treatment of ear, nose, and throat disorders', '["ENT", "ear nose throat", "head and neck surgery", "ENT surgeon"]', true, CURRENT_TIMESTAMP),
('00000000-0001-0001-0023-000000000000', 'Ophthalmology', 'ophthalmology', 'Diagnosis and treatment of eye disorders', '["ophthalmologist", "eye doctor", "eye surgery", "eye surgeon"]', true, CURRENT_TIMESTAMP),
('00000000-0001-0001-0024-000000000000', 'Dermatology', 'dermatology', 'Diagnosis and treatment of skin, hair, and nail disorders', '["dermatologist", "skin doctor", "skin specialist"]', true, CURRENT_TIMESTAMP),

-- Critical Care & Anaesthesia
('00000000-0001-0001-0025-000000000000', 'Anaesthesiology', 'anaesthesiology', 'Perioperative care, anaesthesia, and pain management', '["anesthesiology", "anaesthetist", "anesthesiologist", "anaesthetics"]', true, CURRENT_TIMESTAMP),
('00000000-0001-0001-0026-000000000000', 'Intensive Care Medicine', 'intensive-care-medicine', 'Care of critically ill patients in intensive care units', '["ICU", "critical care", "intensivist", "ICU doctor"]', true, CURRENT_TIMESTAMP),
('00000000-0001-0001-0027-000000000000', 'Emergency Medicine', 'emergency-medicine', 'Acute care for patients with urgent medical conditions', '["EM", "emergency doctor", "ED", "emergency room", "A&E"]', true, CURRENT_TIMESTAMP),

-- Women''s & Children''s Health
('00000000-0001-0001-0028-000000000000', 'Obstetrics & Gynaecology', 'obstetrics-gynaecology', 'Healthcare for women including pregnancy, childbirth, and reproductive health', '["O&G", "OB-GYN", "obstetrician", "gynaecologist", "gynecologist", "womens health"]', true, CURRENT_TIMESTAMP),
('00000000-0001-0001-0029-000000000000', 'Paediatrics', 'paediatrics', 'Medical care for infants, children, and adolescents', '["pediatrics", "paediatrician", "pediatrician", "child health", "kids doctor"]', true, CURRENT_TIMESTAMP),
('00000000-0001-0001-0030-000000000000', 'Neonatology', 'neonatology', 'Care of newborn infants, especially premature and critically ill neonates', '["neonatologist", "newborn medicine", "NICU"]', true, CURRENT_TIMESTAMP),

-- Mental Health
('00000000-0001-0001-0031-000000000000', 'Psychiatry', 'psychiatry', 'Diagnosis and treatment of mental health disorders', '["psychiatrist", "mental health doctor", "psych"]', true, CURRENT_TIMESTAMP),

-- Radiology
('00000000-0001-0001-0032-000000000000', 'Diagnostic Radiology', 'diagnostic-radiology', 'Medical imaging for diagnosis of diseases', '["radiologist", "imaging", "radiology", "X-ray doctor"]', true, CURRENT_TIMESTAMP),
('00000000-0001-0001-0033-000000000000', 'Interventional Radiology', 'interventional-radiology', 'Minimally invasive image-guided procedures for diagnosis and treatment', '["IR", "interventional radiologist"]', true, CURRENT_TIMESTAMP),
('00000000-0001-0001-0034-000000000000', 'Nuclear Medicine', 'nuclear-medicine', 'Use of radioactive materials for diagnosis and treatment', '["nuclear medicine physician"]', true, CURRENT_TIMESTAMP),

-- Other Specialties
('00000000-0001-0001-0035-000000000000', 'Geriatric Medicine', 'geriatric-medicine', 'Healthcare for elderly patients', '["geriatrician", "aged care", "elderly medicine", "geriatrics"]', true, CURRENT_TIMESTAMP),
('00000000-0001-0001-0036-000000000000', 'Palliative Medicine', 'palliative-medicine', 'Care focused on comfort and quality of life for patients with serious illness', '["palliative care", "hospice", "end of life care"]', true, CURRENT_TIMESTAMP),
('00000000-0001-0001-0037-000000000000', 'Rehabilitation Medicine', 'rehabilitation-medicine', 'Physical medicine and rehabilitation after injury or illness', '["physiatry", "PM&R", "rehab medicine", "physical medicine"]', true, CURRENT_TIMESTAMP),
('00000000-0001-0001-0038-000000000000', 'Sports Medicine', 'sports-medicine', 'Prevention and treatment of sports-related injuries', '["sports doctor", "sports physician"]', true, CURRENT_TIMESTAMP),
('00000000-0001-0001-0039-000000000000', 'Pain Medicine', 'pain-medicine', 'Diagnosis and treatment of chronic pain conditions', '["pain specialist", "pain management", "pain doctor"]', true, CURRENT_TIMESTAMP),
('00000000-0001-0001-0040-000000000000', 'Pathology', 'pathology', 'Laboratory diagnosis of disease through examination of tissues and fluids', '["pathologist", "laboratory medicine"]', true, CURRENT_TIMESTAMP),
('00000000-0001-0001-0041-000000000000', 'Clinical Genetics', 'clinical-genetics', 'Diagnosis and management of genetic disorders', '["geneticist", "genetic medicine", "medical genetics"]', true, CURRENT_TIMESTAMP),
('00000000-0001-0001-0042-000000000000', 'Immunology & Allergy', 'immunology-allergy', 'Diagnosis and treatment of immune system disorders and allergies', '["immunologist", "allergist", "allergy doctor", "clinical immunology"]', true, CURRENT_TIMESTAMP)

ON CONFLICT ("id") DO UPDATE SET
    "name" = EXCLUDED."name",
    "slug" = EXCLUDED."slug",
    "description" = EXCLUDED."description",
    "synonyms" = EXCLUDED."synonyms",
    "active" = EXCLUDED."active",
    "updated_at" = CURRENT_TIMESTAMP;

-- ============================================================================
-- STEP 10: SEED MEDICAL SUBSPECIALTIES (56 subspecialties)
-- ============================================================================

INSERT INTO "medical_subspecialties" ("id", "specialty_id", "name", "slug", "description", "active", "updated_at") VALUES
-- General Practice Subspecialties
('00000000-0001-0002-0101-000000000000', '00000000-0001-0001-0001-000000000000', 'Women''s Health', 'womens-health', 'Focus on health issues specific to women', true, CURRENT_TIMESTAMP),
('00000000-0001-0002-0102-000000000000', '00000000-0001-0001-0001-000000000000', 'Sexual Health', 'sexual-health', 'Focus on sexual and reproductive health', true, CURRENT_TIMESTAMP),
('00000000-0001-0002-0103-000000000000', '00000000-0001-0001-0001-000000000000', 'Chronic Disease Management', 'chronic-disease-management', 'Ongoing management of chronic conditions like diabetes, hypertension', true, CURRENT_TIMESTAMP),
('00000000-0001-0002-0104-000000000000', '00000000-0001-0001-0001-000000000000', 'Mental Health', 'gp-mental-health', 'Primary care mental health including anxiety and depression', true, CURRENT_TIMESTAMP),
('00000000-0001-0002-0105-000000000000', '00000000-0001-0001-0001-000000000000', 'Aged Care', 'aged-care', 'Primary care for elderly patients', true, CURRENT_TIMESTAMP),
('00000000-0001-0002-0106-000000000000', '00000000-0001-0001-0001-000000000000', 'Sports Medicine', 'gp-sports-medicine', 'Sports injuries and exercise medicine in primary care', true, CURRENT_TIMESTAMP),
('00000000-0001-0002-0107-000000000000', '00000000-0001-0001-0001-000000000000', 'Addiction Medicine', 'addiction-medicine', 'Treatment of substance use disorders in primary care', true, CURRENT_TIMESTAMP),
('00000000-0001-0002-0108-000000000000', '00000000-0001-0001-0001-000000000000', 'Paediatrics', 'gp-paediatrics', 'Primary care for children and adolescents', true, CURRENT_TIMESTAMP),

-- Cardiology Subspecialties
('00000000-0001-0002-0301-000000000000', '00000000-0001-0001-0003-000000000000', 'General Cardiology', 'general-cardiology', 'Comprehensive cardiac care including diagnosis and medical management', true, CURRENT_TIMESTAMP),
('00000000-0001-0002-0302-000000000000', '00000000-0001-0001-0003-000000000000', 'Interventional Cardiology', 'interventional-cardiology', 'Catheter-based procedures including PCI, stenting, and structural interventions', true, CURRENT_TIMESTAMP),
('00000000-0001-0002-0303-000000000000', '00000000-0001-0001-0003-000000000000', 'Structural Heart', 'structural-heart', 'Transcatheter treatment of structural heart disease including TAVI, MitraClip', true, CURRENT_TIMESTAMP),
('00000000-0001-0002-0304-000000000000', '00000000-0001-0001-0003-000000000000', 'Electrophysiology', 'electrophysiology', 'Diagnosis and treatment of cardiac arrhythmias including ablation and device implantation', true, CURRENT_TIMESTAMP),
('00000000-0001-0002-0305-000000000000', '00000000-0001-0001-0003-000000000000', 'Cardiac Imaging', 'cardiac-imaging', 'Advanced cardiac imaging including echocardiography, CT, and MRI', true, CURRENT_TIMESTAMP),
('00000000-0001-0002-0306-000000000000', '00000000-0001-0001-0003-000000000000', 'Heart Failure & Transplant', 'heart-failure-transplant', 'Advanced heart failure management including mechanical support and transplantation', true, CURRENT_TIMESTAMP),
('00000000-0001-0002-0307-000000000000', '00000000-0001-0001-0003-000000000000', 'Adult Congenital Heart Disease', 'adult-congenital-heart-disease', 'Care of adults with congenital heart defects', true, CURRENT_TIMESTAMP),
('00000000-0001-0002-0308-000000000000', '00000000-0001-0001-0003-000000000000', 'Preventive Cardiology', 'preventive-cardiology', 'Cardiovascular risk assessment and prevention', true, CURRENT_TIMESTAMP),

-- Cardiothoracic Surgery Subspecialties
('00000000-0001-0002-0401-000000000000', '00000000-0001-0001-0004-000000000000', 'Adult Cardiac Surgery', 'adult-cardiac-surgery', 'CABG, valve surgery, and aortic surgery in adults', true, CURRENT_TIMESTAMP),
('00000000-0001-0002-0402-000000000000', '00000000-0001-0001-0004-000000000000', 'General Thoracic Surgery', 'general-thoracic-surgery', 'Lung resection, esophageal surgery, and chest wall surgery', true, CURRENT_TIMESTAMP),
('00000000-0001-0002-0403-000000000000', '00000000-0001-0001-0004-000000000000', 'Congenital Cardiac Surgery', 'congenital-cardiac-surgery', 'Surgical repair of congenital heart defects in children and adults', true, CURRENT_TIMESTAMP),
('00000000-0001-0002-0404-000000000000', '00000000-0001-0001-0004-000000000000', 'Heart & Lung Transplant', 'heart-lung-transplant', 'Heart and lung transplantation surgery', true, CURRENT_TIMESTAMP),
('00000000-0001-0002-0405-000000000000', '00000000-0001-0001-0004-000000000000', 'Mechanical Circulatory Support', 'mechanical-circulatory-support', 'VAD implantation and ECMO management', true, CURRENT_TIMESTAMP),

-- Neurology Subspecialties
('00000000-0001-0002-0601-000000000000', '00000000-0001-0001-0006-000000000000', 'Stroke & Vascular Neurology', 'stroke-vascular-neurology', 'Prevention, acute treatment, and rehabilitation of stroke', true, CURRENT_TIMESTAMP),
('00000000-0001-0002-0602-000000000000', '00000000-0001-0001-0006-000000000000', 'Epilepsy', 'epilepsy', 'Diagnosis and management of seizure disorders', true, CURRENT_TIMESTAMP),
('00000000-0001-0002-0603-000000000000', '00000000-0001-0001-0006-000000000000', 'Movement Disorders', 'movement-disorders', 'Parkinson''s disease, dystonia, tremor, and other movement disorders', true, CURRENT_TIMESTAMP),
('00000000-0001-0002-0604-000000000000', '00000000-0001-0001-0006-000000000000', 'Neuromuscular Medicine', 'neuromuscular-medicine', 'Disorders of peripheral nerves, muscles, and neuromuscular junction', true, CURRENT_TIMESTAMP),
('00000000-0001-0002-0605-000000000000', '00000000-0001-0001-0006-000000000000', 'Multiple Sclerosis & Neuroimmunology', 'ms-neuroimmunology', 'MS and other autoimmune neurological conditions', true, CURRENT_TIMESTAMP),
('00000000-0001-0002-0606-000000000000', '00000000-0001-0001-0006-000000000000', 'Cognitive & Behavioural Neurology', 'cognitive-behavioural-neurology', 'Dementia, memory disorders, and neuropsychiatry', true, CURRENT_TIMESTAMP),
('00000000-0001-0002-0607-000000000000', '00000000-0001-0001-0006-000000000000', 'Headache Medicine', 'headache-medicine', 'Migraine and other headache disorders', true, CURRENT_TIMESTAMP),
('00000000-0001-0002-0608-000000000000', '00000000-0001-0001-0006-000000000000', 'Neurophysiology', 'neurophysiology', 'EEG, EMG, and nerve conduction studies', true, CURRENT_TIMESTAMP),

-- Orthopaedic Surgery Subspecialties
('00000000-0001-0002-0901-000000000000', '00000000-0001-0001-0009-000000000000', 'Joint Replacement', 'joint-replacement', 'Hip, knee, and other joint arthroplasty', true, CURRENT_TIMESTAMP),
('00000000-0001-0002-0902-000000000000', '00000000-0001-0001-0009-000000000000', 'Spine Surgery', 'ortho-spine-surgery', 'Surgical treatment of spinal disorders', true, CURRENT_TIMESTAMP),
('00000000-0001-0002-0903-000000000000', '00000000-0001-0001-0009-000000000000', 'Sports Surgery', 'sports-surgery', 'ACL reconstruction and sports-related injuries', true, CURRENT_TIMESTAMP),
('00000000-0001-0002-0904-000000000000', '00000000-0001-0001-0009-000000000000', 'Hand & Upper Limb', 'hand-upper-limb', 'Surgery of the hand, wrist, elbow, and shoulder', true, CURRENT_TIMESTAMP),
('00000000-0001-0002-0905-000000000000', '00000000-0001-0001-0009-000000000000', 'Foot & Ankle', 'foot-ankle', 'Surgery of the foot and ankle', true, CURRENT_TIMESTAMP),
('00000000-0001-0002-0906-000000000000', '00000000-0001-0001-0009-000000000000', 'Trauma', 'ortho-trauma', 'Fractures and orthopaedic trauma', true, CURRENT_TIMESTAMP),
('00000000-0001-0002-0907-000000000000', '00000000-0001-0001-0009-000000000000', 'Paediatric Orthopaedics', 'paediatric-orthopaedics', 'Musculoskeletal conditions in children', true, CURRENT_TIMESTAMP),

-- Gastroenterology Subspecialties
('00000000-0001-0002-1301-000000000000', '00000000-0001-0001-0013-000000000000', 'Hepatology', 'hepatology', 'Liver diseases including viral hepatitis, cirrhosis, and transplant', true, CURRENT_TIMESTAMP),
('00000000-0001-0002-1302-000000000000', '00000000-0001-0001-0013-000000000000', 'Inflammatory Bowel Disease', 'inflammatory-bowel-disease', 'Crohn''s disease and ulcerative colitis', true, CURRENT_TIMESTAMP),
('00000000-0001-0002-1303-000000000000', '00000000-0001-0001-0013-000000000000', 'Therapeutic Endoscopy', 'therapeutic-endoscopy', 'Advanced endoscopic procedures including ERCP and EUS', true, CURRENT_TIMESTAMP),

-- Respiratory Medicine Subspecialties
('00000000-0001-0002-1401-000000000000', '00000000-0001-0001-0014-000000000000', 'Sleep Medicine', 'sleep-medicine', 'Sleep disorders including sleep apnea and insomnia', true, CURRENT_TIMESTAMP),
('00000000-0001-0002-1402-000000000000', '00000000-0001-0001-0014-000000000000', 'Interstitial Lung Disease', 'interstitial-lung-disease', 'Pulmonary fibrosis and other interstitial lung diseases', true, CURRENT_TIMESTAMP),
('00000000-0001-0002-1403-000000000000', '00000000-0001-0001-0014-000000000000', 'Interventional Pulmonology', 'interventional-pulmonology', 'Bronchoscopy and pleural procedures', true, CURRENT_TIMESTAMP),

-- Obstetrics & Gynaecology Subspecialties
('00000000-0001-0002-2801-000000000000', '00000000-0001-0001-0028-000000000000', 'Maternal-Fetal Medicine', 'maternal-fetal-medicine', 'High-risk pregnancy and fetal diagnosis', true, CURRENT_TIMESTAMP),
('00000000-0001-0002-2802-000000000000', '00000000-0001-0001-0028-000000000000', 'Reproductive Endocrinology', 'reproductive-endocrinology', 'Infertility and assisted reproduction', true, CURRENT_TIMESTAMP),
('00000000-0001-0002-2803-000000000000', '00000000-0001-0001-0028-000000000000', 'Gynaecological Oncology', 'gynaecological-oncology', 'Cancer of the female reproductive system', true, CURRENT_TIMESTAMP),
('00000000-0001-0002-2804-000000000000', '00000000-0001-0001-0028-000000000000', 'Urogynaecology', 'urogynaecology', 'Pelvic floor disorders and incontinence', true, CURRENT_TIMESTAMP),

-- Psychiatry Subspecialties
('00000000-0001-0002-3101-000000000000', '00000000-0001-0001-0031-000000000000', 'Child & Adolescent Psychiatry', 'child-adolescent-psychiatry', 'Mental health care for children and adolescents', true, CURRENT_TIMESTAMP),
('00000000-0001-0002-3102-000000000000', '00000000-0001-0001-0031-000000000000', 'Consultation-Liaison Psychiatry', 'consultation-liaison-psychiatry', 'Psychiatric care in medical settings', true, CURRENT_TIMESTAMP),
('00000000-0001-0002-3103-000000000000', '00000000-0001-0001-0031-000000000000', 'Addiction Psychiatry', 'addiction-psychiatry', 'Treatment of substance use disorders', true, CURRENT_TIMESTAMP),
('00000000-0001-0002-3104-000000000000', '00000000-0001-0001-0031-000000000000', 'Forensic Psychiatry', 'forensic-psychiatry', 'Psychiatry at the intersection of mental health and law', true, CURRENT_TIMESTAMP),
('00000000-0001-0002-3105-000000000000', '00000000-0001-0001-0031-000000000000', 'Geriatric Psychiatry', 'geriatric-psychiatry', 'Mental health care for elderly patients', true, CURRENT_TIMESTAMP)

ON CONFLICT ("id") DO UPDATE SET
    "specialty_id" = EXCLUDED."specialty_id",
    "name" = EXCLUDED."name",
    "slug" = EXCLUDED."slug",
    "description" = EXCLUDED."description",
    "active" = EXCLUDED."active",
    "updated_at" = CURRENT_TIMESTAMP;

-- ============================================================================
-- VERIFICATION
-- ============================================================================
SELECT
    'Specialties' as table_name,
    COUNT(*) as row_count
FROM medical_specialties
UNION ALL
SELECT
    'Subspecialties' as table_name,
    COUNT(*) as row_count
FROM medical_subspecialties;
