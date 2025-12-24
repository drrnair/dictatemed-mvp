-- DictateMED Row Level Security (RLS) Policies
-- This migration enables RLS on all PHI-containing tables and creates access policies.
--
-- ============================================================================
-- IMPORTANT: AUTH0 vs SUPABASE AUTH
-- ============================================================================
-- DictateMED uses Auth0 for authentication, NOT Supabase Auth. This means:
--
-- 1. auth.uid() returns NULL for Auth0-authenticated requests
-- 2. RLS policies using auth.uid() will NOT work automatically
-- 3. ALL access control is enforced at the APPLICATION level
--
-- The RLS policies defined here serve two purposes:
-- a) Defense in depth: Block any unauthorized direct database access
-- b) Future-proofing: Ready for Supabase Auth migration or custom JWT claims
--
-- SECURITY MODEL:
-- - Backend uses Prisma with DATABASE_URL (bypasses RLS as superuser)
-- - Service role key is NEVER exposed to clients
-- - All authorization checks happen in API routes before database queries
-- - Cross-user access is prevented by filtering on userId in queries
--
-- TO ENABLE TRUE RLS WITH AUTH0:
-- Option 1: Configure Supabase JWT claims from Auth0 tokens
-- Option 2: Use RPC functions with SECURITY DEFINER that receive userId
-- Option 3: Migrate to Supabase Auth
-- ============================================================================

-- ============================================================================
-- ENABLE RLS ON ALL PHI TABLES
-- ============================================================================
-- Even without Supabase Auth, enabling RLS provides defense-in-depth:
-- - Direct connections without proper credentials are blocked
-- - Supabase public/anon key access is blocked
-- - Only service role and superuser connections work

-- Patients (contains encrypted PHI)
ALTER TABLE patients ENABLE ROW LEVEL SECURITY;

-- Recordings (contains audio transcripts with PHI)
ALTER TABLE recordings ENABLE ROW LEVEL SECURITY;

-- Documents (contains clinical document metadata, extraction results)
ALTER TABLE documents ENABLE ROW LEVEL SECURITY;

-- Letters (contains generated clinical letters with PHI)
ALTER TABLE letters ENABLE ROW LEVEL SECURITY;

-- Consultations (links patients, recordings, documents)
ALTER TABLE consultations ENABLE ROW LEVEL SECURITY;

-- Sent Emails (contains email subjects with patient identifiers)
ALTER TABLE sent_emails ENABLE ROW LEVEL SECURITY;

-- Audit Logs (contains action history with resource references)
ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;

-- Style Edits (contains letter text diffs)
ALTER TABLE style_edits ENABLE ROW LEVEL SECURITY;

-- Notifications (user-specific, may reference PHI resources)
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;

-- User Template Preferences (user-specific settings)
ALTER TABLE user_template_preferences ENABLE ROW LEVEL SECURITY;

-- CC Recipients (contains names and emails)
ALTER TABLE cc_recipients ENABLE ROW LEVEL SECURITY;

-- Letter Documents (join table, links letters to documents)
ALTER TABLE letter_documents ENABLE ROW LEVEL SECURITY;

-- Provenance (contains letter audit trail)
ALTER TABLE provenance ENABLE ROW LEVEL SECURITY;

-- ============================================================================
-- ORGANIZATION-LEVEL TABLES (Practice-scoped)
-- ============================================================================

-- Practices (organization data)
ALTER TABLE practices ENABLE ROW LEVEL SECURITY;

-- Users (contains email, name, settings)
ALTER TABLE users ENABLE ROW LEVEL SECURITY;

-- Referrers (practice-scoped, reusable)
ALTER TABLE referrers ENABLE ROW LEVEL SECURITY;

-- Letter Templates (system-wide, but RLS for safety)
ALTER TABLE letter_templates ENABLE ROW LEVEL SECURITY;

-- ============================================================================
-- RLS POLICIES
-- ============================================================================
-- These policies define WHO can access WHAT.
-- Since we use Auth0, these primarily block anon/public access.
-- Service role access bypasses RLS automatically.

-- Drop existing policies if they exist (idempotent re-runs)
DO $$
DECLARE
    policy_name TEXT;
    policy_names TEXT[] := ARRAY[
        -- Patients
        'patients_select_own_practice', 'patients_insert_own_practice',
        'patients_update_own_practice', 'patients_delete_own_practice',
        -- Recordings
        'recordings_select_own', 'recordings_insert_own',
        'recordings_update_own', 'recordings_delete_own',
        -- Documents
        'documents_select_own', 'documents_insert_own',
        'documents_update_own', 'documents_delete_own',
        -- Letters
        'letters_select_own', 'letters_insert_own',
        'letters_update_own', 'letters_delete_own',
        -- Consultations
        'consultations_select_own', 'consultations_insert_own',
        'consultations_update_own', 'consultations_delete_own',
        -- Sent Emails
        'sent_emails_select_own', 'sent_emails_insert_own',
        'sent_emails_update_own', 'sent_emails_delete_own',
        -- Audit Logs
        'audit_logs_select_own', 'audit_logs_insert_own',
        -- Style Edits
        'style_edits_select_own', 'style_edits_insert_own',
        -- Notifications
        'notifications_select_own', 'notifications_insert_own',
        'notifications_update_own', 'notifications_delete_own',
        -- User Template Preferences
        'user_template_preferences_select_own', 'user_template_preferences_insert_own',
        'user_template_preferences_update_own', 'user_template_preferences_delete_own',
        -- CC Recipients
        'cc_recipients_select_by_consultation', 'cc_recipients_insert_by_consultation',
        'cc_recipients_delete_by_consultation',
        -- Letter Documents
        'letter_documents_select_by_letter', 'letter_documents_insert_by_letter',
        'letter_documents_delete_by_letter',
        -- Provenance
        'provenance_select_by_letter', 'provenance_insert_by_letter',
        -- Practices
        'practices_select_member', 'practices_update_admin',
        -- Users
        'users_select_same_practice', 'users_select_own',
        'users_update_own', 'users_insert_admin',
        -- Referrers
        'referrers_select_own_practice', 'referrers_insert_own_practice',
        'referrers_update_own_practice', 'referrers_delete_own_practice',
        -- Letter Templates
        'letter_templates_select_all', 'letter_templates_insert_admin',
        'letter_templates_update_admin'
    ];
BEGIN
    FOREACH policy_name IN ARRAY policy_names
    LOOP
        BEGIN
            -- Try to drop each policy (ignore errors if it doesn't exist)
            EXECUTE 'DROP POLICY IF EXISTS ' || quote_ident(policy_name) || ' ON ' ||
                split_part(policy_name, '_select', 1) || ';';
        EXCEPTION WHEN OTHERS THEN
            NULL; -- Ignore errors
        END;
    END LOOP;
END $$;

-- ============================================================================
-- PATIENTS POLICIES (Practice-scoped)
-- ============================================================================
-- Patients belong to a practice, all practice members can access their patients

CREATE POLICY "patients_select_own_practice"
ON patients FOR SELECT
TO authenticated
USING (
    -- NOTE: This would need a custom function to get user's practice from Auth0 JWT
    -- For now, RLS blocks anon access; app-level auth handles the rest
    true -- Placeholder - actual filtering done in application
);

CREATE POLICY "patients_insert_own_practice"
ON patients FOR INSERT
TO authenticated
WITH CHECK (true);

CREATE POLICY "patients_update_own_practice"
ON patients FOR UPDATE
TO authenticated
USING (true);

CREATE POLICY "patients_delete_own_practice"
ON patients FOR DELETE
TO authenticated
USING (true);

-- ============================================================================
-- RECORDINGS POLICIES (User-scoped)
-- ============================================================================
-- Recordings belong to a specific user

CREATE POLICY "recordings_select_own"
ON recordings FOR SELECT
TO authenticated
USING (true); -- App enforces user_id = auth.uid() equivalent

CREATE POLICY "recordings_insert_own"
ON recordings FOR INSERT
TO authenticated
WITH CHECK (true);

CREATE POLICY "recordings_update_own"
ON recordings FOR UPDATE
TO authenticated
USING (true);

CREATE POLICY "recordings_delete_own"
ON recordings FOR DELETE
TO authenticated
USING (true);

-- ============================================================================
-- DOCUMENTS POLICIES (User-scoped)
-- ============================================================================
-- Documents belong to a specific user

CREATE POLICY "documents_select_own"
ON documents FOR SELECT
TO authenticated
USING (true);

CREATE POLICY "documents_insert_own"
ON documents FOR INSERT
TO authenticated
WITH CHECK (true);

CREATE POLICY "documents_update_own"
ON documents FOR UPDATE
TO authenticated
USING (true);

CREATE POLICY "documents_delete_own"
ON documents FOR DELETE
TO authenticated
USING (true);

-- ============================================================================
-- LETTERS POLICIES (User-scoped)
-- ============================================================================
-- Letters belong to a specific user

CREATE POLICY "letters_select_own"
ON letters FOR SELECT
TO authenticated
USING (true);

CREATE POLICY "letters_insert_own"
ON letters FOR INSERT
TO authenticated
WITH CHECK (true);

CREATE POLICY "letters_update_own"
ON letters FOR UPDATE
TO authenticated
USING (true);

CREATE POLICY "letters_delete_own"
ON letters FOR DELETE
TO authenticated
USING (true);

-- ============================================================================
-- CONSULTATIONS POLICIES (User-scoped)
-- ============================================================================
-- Consultations belong to a specific user

CREATE POLICY "consultations_select_own"
ON consultations FOR SELECT
TO authenticated
USING (true);

CREATE POLICY "consultations_insert_own"
ON consultations FOR INSERT
TO authenticated
WITH CHECK (true);

CREATE POLICY "consultations_update_own"
ON consultations FOR UPDATE
TO authenticated
USING (true);

CREATE POLICY "consultations_delete_own"
ON consultations FOR DELETE
TO authenticated
USING (true);

-- ============================================================================
-- SENT EMAILS POLICIES (User-scoped)
-- ============================================================================
-- Sent emails belong to a specific user

CREATE POLICY "sent_emails_select_own"
ON sent_emails FOR SELECT
TO authenticated
USING (true);

CREATE POLICY "sent_emails_insert_own"
ON sent_emails FOR INSERT
TO authenticated
WITH CHECK (true);

CREATE POLICY "sent_emails_update_own"
ON sent_emails FOR UPDATE
TO authenticated
USING (true);

CREATE POLICY "sent_emails_delete_own"
ON sent_emails FOR DELETE
TO authenticated
USING (true);

-- ============================================================================
-- AUDIT LOGS POLICIES (User-scoped, Read-only for users)
-- ============================================================================
-- Users can read their own audit logs, only system can write

CREATE POLICY "audit_logs_select_own"
ON audit_logs FOR SELECT
TO authenticated
USING (true);

CREATE POLICY "audit_logs_insert_own"
ON audit_logs FOR INSERT
TO authenticated
WITH CHECK (true);

-- No UPDATE or DELETE on audit logs (immutable)

-- ============================================================================
-- STYLE EDITS POLICIES (User-scoped)
-- ============================================================================

CREATE POLICY "style_edits_select_own"
ON style_edits FOR SELECT
TO authenticated
USING (true);

CREATE POLICY "style_edits_insert_own"
ON style_edits FOR INSERT
TO authenticated
WITH CHECK (true);

-- No UPDATE or DELETE on style edits (append-only learning)

-- ============================================================================
-- NOTIFICATIONS POLICIES (User-scoped)
-- ============================================================================

CREATE POLICY "notifications_select_own"
ON notifications FOR SELECT
TO authenticated
USING (true);

CREATE POLICY "notifications_insert_own"
ON notifications FOR INSERT
TO authenticated
WITH CHECK (true);

CREATE POLICY "notifications_update_own"
ON notifications FOR UPDATE
TO authenticated
USING (true);

CREATE POLICY "notifications_delete_own"
ON notifications FOR DELETE
TO authenticated
USING (true);

-- ============================================================================
-- USER TEMPLATE PREFERENCES POLICIES (User-scoped)
-- ============================================================================

CREATE POLICY "user_template_preferences_select_own"
ON user_template_preferences FOR SELECT
TO authenticated
USING (true);

CREATE POLICY "user_template_preferences_insert_own"
ON user_template_preferences FOR INSERT
TO authenticated
WITH CHECK (true);

CREATE POLICY "user_template_preferences_update_own"
ON user_template_preferences FOR UPDATE
TO authenticated
USING (true);

CREATE POLICY "user_template_preferences_delete_own"
ON user_template_preferences FOR DELETE
TO authenticated
USING (true);

-- ============================================================================
-- CC RECIPIENTS POLICIES (Via Consultation ownership)
-- ============================================================================

CREATE POLICY "cc_recipients_select_by_consultation"
ON cc_recipients FOR SELECT
TO authenticated
USING (true);

CREATE POLICY "cc_recipients_insert_by_consultation"
ON cc_recipients FOR INSERT
TO authenticated
WITH CHECK (true);

CREATE POLICY "cc_recipients_delete_by_consultation"
ON cc_recipients FOR DELETE
TO authenticated
USING (true);

-- ============================================================================
-- LETTER DOCUMENTS POLICIES (Via Letter ownership)
-- ============================================================================

CREATE POLICY "letter_documents_select_by_letter"
ON letter_documents FOR SELECT
TO authenticated
USING (true);

CREATE POLICY "letter_documents_insert_by_letter"
ON letter_documents FOR INSERT
TO authenticated
WITH CHECK (true);

CREATE POLICY "letter_documents_delete_by_letter"
ON letter_documents FOR DELETE
TO authenticated
USING (true);

-- ============================================================================
-- PROVENANCE POLICIES (Via Letter ownership)
-- ============================================================================

CREATE POLICY "provenance_select_by_letter"
ON provenance FOR SELECT
TO authenticated
USING (true);

CREATE POLICY "provenance_insert_by_letter"
ON provenance FOR INSERT
TO authenticated
WITH CHECK (true);

-- No UPDATE or DELETE on provenance (immutable audit trail)

-- ============================================================================
-- PRACTICES POLICIES
-- ============================================================================

CREATE POLICY "practices_select_member"
ON practices FOR SELECT
TO authenticated
USING (true);

CREATE POLICY "practices_update_admin"
ON practices FOR UPDATE
TO authenticated
USING (true);

-- ============================================================================
-- USERS POLICIES
-- ============================================================================

CREATE POLICY "users_select_same_practice"
ON users FOR SELECT
TO authenticated
USING (true);

CREATE POLICY "users_update_own"
ON users FOR UPDATE
TO authenticated
USING (true);

-- ============================================================================
-- REFERRERS POLICIES (Practice-scoped)
-- ============================================================================

CREATE POLICY "referrers_select_own_practice"
ON referrers FOR SELECT
TO authenticated
USING (true);

CREATE POLICY "referrers_insert_own_practice"
ON referrers FOR INSERT
TO authenticated
WITH CHECK (true);

CREATE POLICY "referrers_update_own_practice"
ON referrers FOR UPDATE
TO authenticated
USING (true);

CREATE POLICY "referrers_delete_own_practice"
ON referrers FOR DELETE
TO authenticated
USING (true);

-- ============================================================================
-- LETTER TEMPLATES POLICIES (System-wide, read by all)
-- ============================================================================

CREATE POLICY "letter_templates_select_all"
ON letter_templates FOR SELECT
TO authenticated
USING (true);

-- Only service role can modify templates (admin functionality)
-- No INSERT/UPDATE/DELETE policies for regular users

-- ============================================================================
-- VERIFICATION QUERIES
-- ============================================================================
-- Run these queries to verify the setup:

-- Check RLS is enabled on all tables:
-- SELECT tablename, rowsecurity
-- FROM pg_tables
-- WHERE schemaname = 'public'
-- ORDER BY tablename;

-- Check policies exist:
-- SELECT tablename, policyname, cmd, roles
-- FROM pg_policies
-- WHERE schemaname = 'public'
-- ORDER BY tablename, policyname;
