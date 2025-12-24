-- DictateMED RLS Policy Verification Script
-- ============================================================================
-- This script verifies that Row Level Security is properly configured
-- for all PHI-containing tables.
--
-- HOW TO RUN:
-- 1. Connect to your Supabase database via SQL Editor or psql
-- 2. Run this entire script
-- 3. Review the output for any FAIL results
--
-- EXPECTED RESULTS:
-- - All PHI tables should have RLS enabled
-- - All tables should have appropriate policies
-- - Storage buckets should exist and be private
-- ============================================================================

-- ============================================================================
-- SECTION 1: Verify RLS is Enabled on All Tables
-- ============================================================================

SELECT '====== SECTION 1: RLS Enabled Check ======' AS section;

WITH expected_tables AS (
    SELECT unnest(ARRAY[
        'patients', 'recordings', 'documents', 'letters', 'consultations',
        'sent_emails', 'audit_logs', 'style_edits', 'notifications',
        'user_template_preferences', 'cc_recipients', 'letter_documents',
        'provenance', 'practices', 'users', 'referrers', 'letter_templates'
    ]) AS tablename
),
rls_status AS (
    SELECT
        t.tablename,
        CASE WHEN pt.rowsecurity THEN 'PASS' ELSE 'FAIL - RLS NOT ENABLED' END AS status
    FROM expected_tables t
    LEFT JOIN pg_tables pt ON pt.tablename = t.tablename AND pt.schemaname = 'public'
)
SELECT
    tablename,
    status,
    CASE WHEN status = 'PASS' THEN '✓' ELSE '✗' END AS result
FROM rls_status
ORDER BY tablename;

-- ============================================================================
-- SECTION 2: Verify Policies Exist for Each Table
-- ============================================================================

SELECT '====== SECTION 2: Policy Existence Check ======' AS section;

WITH expected_policies AS (
    SELECT
        tablename,
        expected_policies
    FROM (VALUES
        ('patients', 4),  -- SELECT, INSERT, UPDATE, DELETE
        ('recordings', 4),
        ('documents', 4),
        ('letters', 4),
        ('consultations', 4),
        ('sent_emails', 4),
        ('audit_logs', 2),  -- SELECT, INSERT only (immutable)
        ('style_edits', 2),  -- SELECT, INSERT only (append-only)
        ('notifications', 4),
        ('user_template_preferences', 4),
        ('cc_recipients', 3),  -- SELECT, INSERT, DELETE
        ('letter_documents', 3),
        ('provenance', 2),  -- SELECT, INSERT only (immutable)
        ('practices', 2),  -- SELECT, UPDATE
        ('users', 2),  -- SELECT, UPDATE
        ('referrers', 4),
        ('letter_templates', 1)  -- SELECT only for regular users
    ) AS t(tablename, expected_policies)
),
actual_policies AS (
    SELECT
        tablename::text,
        COUNT(*) AS policy_count
    FROM pg_policies
    WHERE schemaname = 'public'
    GROUP BY tablename
)
SELECT
    e.tablename,
    COALESCE(a.policy_count, 0) AS actual_policies,
    e.expected_policies,
    CASE
        WHEN COALESCE(a.policy_count, 0) >= e.expected_policies THEN 'PASS'
        WHEN COALESCE(a.policy_count, 0) > 0 THEN 'PARTIAL'
        ELSE 'FAIL - NO POLICIES'
    END AS status,
    CASE
        WHEN COALESCE(a.policy_count, 0) >= e.expected_policies THEN '✓'
        ELSE '✗'
    END AS result
FROM expected_policies e
LEFT JOIN actual_policies a ON a.tablename = e.tablename
ORDER BY e.tablename;

-- ============================================================================
-- SECTION 3: List All Policies for Review
-- ============================================================================

SELECT '====== SECTION 3: All Policies Detail ======' AS section;

SELECT
    tablename,
    policyname,
    cmd AS operation,
    roles::text
FROM pg_policies
WHERE schemaname = 'public'
ORDER BY tablename, cmd;

-- ============================================================================
-- SECTION 4: Verify Storage Buckets
-- ============================================================================

SELECT '====== SECTION 4: Storage Bucket Check ======' AS section;

WITH expected_buckets AS (
    SELECT unnest(ARRAY['audio-recordings', 'clinical-documents', 'user-assets']) AS bucket_id
),
bucket_status AS (
    SELECT
        e.bucket_id,
        CASE
            WHEN b.id IS NULL THEN 'FAIL - BUCKET NOT FOUND'
            WHEN b.public = true THEN 'FAIL - BUCKET IS PUBLIC'
            ELSE 'PASS'
        END AS status
    FROM expected_buckets e
    LEFT JOIN storage.buckets b ON b.id = e.bucket_id
)
SELECT
    bucket_id,
    status,
    CASE WHEN status = 'PASS' THEN '✓' ELSE '✗' END AS result
FROM bucket_status
ORDER BY bucket_id;

-- ============================================================================
-- SECTION 5: Verify Storage Policies
-- ============================================================================

SELECT '====== SECTION 5: Storage Policy Check ======' AS section;

SELECT
    policyname,
    cmd AS operation,
    'storage.objects' AS tablename
FROM pg_policies
WHERE schemaname = 'storage' AND tablename = 'objects'
ORDER BY policyname;

-- ============================================================================
-- SECTION 6: Summary Report
-- ============================================================================

SELECT '====== SECTION 6: Summary Report ======' AS section;

WITH rls_check AS (
    SELECT COUNT(*) AS tables_with_rls
    FROM pg_tables
    WHERE schemaname = 'public'
    AND tablename IN (
        'patients', 'recordings', 'documents', 'letters', 'consultations',
        'sent_emails', 'audit_logs', 'style_edits', 'notifications',
        'user_template_preferences', 'cc_recipients', 'letter_documents',
        'provenance', 'practices', 'users', 'referrers', 'letter_templates'
    )
    AND rowsecurity = true
),
policy_check AS (
    SELECT COUNT(DISTINCT tablename) AS tables_with_policies
    FROM pg_policies
    WHERE schemaname = 'public'
),
bucket_check AS (
    SELECT COUNT(*) AS private_buckets
    FROM storage.buckets
    WHERE id IN ('audio-recordings', 'clinical-documents', 'user-assets')
    AND public = false
)
SELECT
    rls_check.tables_with_rls || ' / 17' AS "Tables with RLS",
    policy_check.tables_with_policies || ' / 17' AS "Tables with Policies",
    bucket_check.private_buckets || ' / 3' AS "Private Storage Buckets",
    CASE
        WHEN rls_check.tables_with_rls = 17
        AND policy_check.tables_with_policies = 17
        AND bucket_check.private_buckets = 3
        THEN '✓ ALL CHECKS PASSED'
        ELSE '✗ SOME CHECKS FAILED - Review sections above'
    END AS "Overall Status"
FROM rls_check, policy_check, bucket_check;

-- ============================================================================
-- SECTION 7: Application-Level Authorization Notes
-- ============================================================================

SELECT '====== SECTION 7: Authorization Architecture Notes ======' AS section;

SELECT '
AUTHORIZATION ARCHITECTURE
==========================

Since DictateMED uses Auth0 (not Supabase Auth), authorization works as follows:

1. AUTHENTICATION LAYER (Auth0)
   - Users authenticate via Auth0
   - Auth0 session/token is validated in API routes
   - User ID and Practice ID are extracted from session

2. APPLICATION LAYER (Next.js API Routes)
   - Every API route calls requireAuth() to verify Auth0 session
   - User context (userId, practiceId, role) is available in all handlers
   - All database queries include WHERE userId = ? clauses
   - Practice-scoped queries include WHERE practiceId = ? clauses

3. DATABASE LAYER (Supabase with Prisma)
   - Prisma connects using DATABASE_URL (superuser, bypasses RLS)
   - RLS provides defense-in-depth against direct DB access
   - anon/public key access is blocked by RLS policies

4. STORAGE LAYER (Supabase Storage)
   - Service role client used for all operations
   - File paths embed userId for logical isolation
   - Authorization checked before generating signed URLs

SECURITY PROPERTIES
===================
✓ User A cannot access User B''s recordings, documents, or letters
✓ Practice A cannot access Practice B''s patients or referrers
✓ Practice admins cannot read raw PHI (only aggregates via views)
✓ All PHI access is logged to audit_logs
✓ Storage files require signed URLs (no public access)
✓ Service role key never exposed to clients
' AS notes;
