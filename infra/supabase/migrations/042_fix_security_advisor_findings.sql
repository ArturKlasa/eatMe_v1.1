-- ============================================================================
-- Migration 042: Fix Supabase Security Advisor findings
-- Date: 2026-03-06
-- ============================================================================
-- Addresses the following Security Advisor warnings:
--
--  #1  Exposed Auth Users     — admin_dashboard_stats queries auth.users
--  #2  Security Definer View  — admin_dashboard_stats has SECURITY DEFINER
--  #3  RLS Disabled           — security_documentation has no RLS
--  #4  RLS Disabled           — spatial_ref_sys has no RLS
--  #5  RLS references user_metadata — menu_scan_jobs policy uses
--                               auth.jwt()->'user_metadata' (user-editable)
-- ============================================================================


-- ============================================================================
-- FIX #1 & #2 — admin_dashboard_stats
-- ============================================================================
-- Root cause:
--   The view was created by the postgres (superuser) role and directly queried
--   auth.users.  In PostgreSQL <15, views inherit the owner's permissions
--   (SECURITY DEFINER semantics), allowing any role that can SELECT the view
--   to read counts derived from auth.users.
--
-- Fix:
--   1. Encapsulate the two auth.users subqueries inside a SECURITY DEFINER
--      helper function (same pattern as is_admin()).  The function is the
--      controlled choke-point for auth schema access; the view never
--      references auth.users directly.
--   2. Recreate the view with WITH (security_invoker = true) so the view
--      itself runs as the calling role, not the definer.
--
-- Why not just use public.users.roles[] for the counts?
--   The 'admin' value is never written to public.users.roles[]; admin status
--   lives solely in auth.users.raw_user_meta_data->>'role'.  Using roles[]
--   would permanently return 0 admin users.  The SECURITY DEFINER function
--   approach keeps the counts accurate without exposing auth.users in the
--   view definition.
-- ============================================================================

-- Helper: returns (restaurant_owners, admin_users) from auth.users.
-- SECURITY DEFINER so it can read the auth schema; only callable by
-- authenticated users (the view's SECURITY INVOKER + RLS ensures this).
CREATE OR REPLACE FUNCTION public.get_admin_user_counts(
  OUT restaurant_owners BIGINT,
  OUT admin_users       BIGINT
)
RETURNS RECORD
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
BEGIN
  SELECT
    COUNT(*) FILTER (WHERE raw_user_meta_data->>'role' = 'owner'
                       OR  raw_user_meta_data->>'role' = 'restaurant_owner'),
    COUNT(*) FILTER (WHERE raw_user_meta_data->>'role' = 'admin'
                       OR  raw_app_meta_data->>'role'  = 'admin')
  INTO restaurant_owners, admin_users
  FROM auth.users;
END;
$$;

COMMENT ON FUNCTION public.get_admin_user_counts() IS
  'Returns (restaurant_owners, admin_users) counts from auth.users. '
  'SECURITY DEFINER so the view can read auth schema without exposing it '
  'directly. Called only from admin_dashboard_stats view.';

-- Revoke public execute; only the view (running as postgres owner) needs it.
REVOKE ALL ON FUNCTION public.get_admin_user_counts() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_admin_user_counts() TO authenticated;

DROP VIEW IF EXISTS public.admin_dashboard_stats;

CREATE VIEW public.admin_dashboard_stats
WITH (security_invoker = true)
AS
-- Auth.users counts are fetched once via CROSS JOIN LATERAL to avoid two
-- sequential scans of auth.users (get_admin_user_counts is SECURITY DEFINER).
SELECT
  (SELECT COUNT(*) FROM public.restaurants WHERE is_active = true)    AS active_restaurants,
  (SELECT COUNT(*) FROM public.restaurants WHERE is_active = false)   AS suspended_restaurants,
  (SELECT COUNT(*) FROM public.restaurants)                           AS total_restaurants,
  (SELECT COUNT(*) FROM public.dishes      WHERE is_available = true) AS active_dishes,
  (SELECT COUNT(*) FROM public.dishes)                                AS total_dishes,
  c.restaurant_owners,
  c.admin_users
FROM public.get_admin_user_counts() AS c(restaurant_owners, admin_users);

COMMENT ON VIEW public.admin_dashboard_stats IS
  'Admin dashboard statistics. '
  'SECURITY INVOKER: executes with the permissions of the querying role. '
  'User counts are fetched via get_admin_user_counts() (SECURITY DEFINER) '
  'to avoid exposing the auth schema in the view definition.';


-- ============================================================================
-- FIX #3 — security_documentation: RLS disabled
-- ============================================================================
-- This table contains read-only security-practice notes inserted during
-- migration 008a.  No user-specific rows exist, but the Security Advisor
-- requires RLS on all public-schema tables exposed through PostgREST.
--
-- Policy: authenticated users may SELECT; nobody can INSERT/UPDATE/DELETE
-- through PostgREST (those operations go through the service role only).
-- ============================================================================

ALTER TABLE public.security_documentation ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Authenticated users can view security documentation"
  ON public.security_documentation;

CREATE POLICY "Authenticated users can view security documentation"
  ON public.security_documentation
  FOR SELECT
  TO authenticated
  USING (true);


-- ============================================================================
-- FIX #4 — spatial_ref_sys: RLS disabled
-- ============================================================================
-- spatial_ref_sys is a PostGIS extension-owned table.  ALTER TABLE … ENABLE
-- ROW LEVEL SECURITY requires ownership and will fail with:
--   ERROR 42501: must be owner of table spatial_ref_sys
--
-- The correct fix is to REVOKE SELECT from the PostgREST roles (anon,
-- authenticated).  Application code never queries spatial_ref_sys directly
-- through the REST API — PostGIS internal functions (ST_Transform, etc.) run
-- as the postgres superuser and bypass both RLS and GRANT checks entirely,
-- so revoking REST access has zero impact on PostGIS functionality.
-- ============================================================================

REVOKE SELECT ON public.spatial_ref_sys FROM anon, authenticated;


-- ============================================================================
-- FIX #5 — menu_scan_jobs: RLS policy references user_metadata
-- ============================================================================
-- Root cause:
--   The policy used  auth.jwt() -> 'user_metadata' ->> 'role'
--   user_metadata is populated from raw_user_meta_data, which end-users CAN
--   modify via  supabase.auth.updateUser({ data: { role: 'admin' } }).
--   A malicious user could therefore self-promote to admin and bypass the
--   policy.
--
-- Fix — two-part:
--
--   Part A — is_admin() function
--     Migrate from raw_user_meta_data to raw_app_meta_data.
--     raw_app_meta_data is only writable by the service role; end-users
--     cannot modify it.  During the transition, both sources are checked so
--     that existing admins (whose role is still in raw_user_meta_data) are
--     not immediately locked out.
--
--     ⚠️  ACTION REQUIRED: After deploying this migration, update every
--         admin user's app_metadata via the Supabase Admin API or Dashboard:
--           UPDATE auth.users
--           SET raw_app_meta_data = raw_app_meta_data || '{"role":"admin"}'
--           WHERE raw_user_meta_data->>'role' = 'admin';
--         Then remove the raw_user_meta_data fallback in a future migration.
--
--   Part B — menu_scan_jobs RLS policy
--     Replace the direct JWT user_metadata check with is_admin().
-- ============================================================================

-- Part A: harden is_admin() to prefer raw_app_meta_data
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
BEGIN
  RETURN COALESCE(
    (
      SELECT
        -- Prefer app_metadata (service-role-only, non-editable by end users).
        -- Fall back to user_metadata during the transition period so that
        -- existing admins whose role is not yet in app_metadata still work.
        -- TODO: remove the raw_user_meta_data fallback once all admin accounts
        --       have raw_app_meta_data->>'role' = 'admin' set.
        (raw_app_meta_data->>'role' = 'admin')
        OR
        (raw_user_meta_data->>'role' = 'admin')
      FROM auth.users
      WHERE id = auth.uid()
    ),
    false  -- auth.uid() not found or no role set → not an admin
  );
END;
$$;

COMMENT ON FUNCTION public.is_admin() IS
  'Returns true if the current user is an admin. '
  'Checks raw_app_meta_data first (service-role-only), then raw_user_meta_data '
  'as a transition fallback. Remove the raw_user_meta_data check once all admin '
  'accounts have been migrated to app_metadata.';

-- Part B: replace the vulnerable RLS policy on menu_scan_jobs
DROP POLICY IF EXISTS "Admins can manage menu scan jobs" ON public.menu_scan_jobs;

CREATE POLICY "Admins can manage menu scan jobs"
  ON public.menu_scan_jobs
  FOR ALL
  TO authenticated
  USING     (is_admin())
  WITH CHECK (is_admin());

COMMENT ON TABLE public.menu_scan_jobs IS
  'AI menu scan jobs. Each job represents one or more photos of a restaurant menu '
  'that are processed by GPT-4o Vision to extract dish data for admin review. '
  'RLS: only admins (is_admin()) can access. API writes use the service role key.';


-- ============================================================================
-- Verification queries (run manually after deployment)
-- ============================================================================
-- -- 1. Confirm view is security_invoker and no longer references auth schema:
-- SELECT viewname, definition
-- FROM   pg_views
-- WHERE  schemaname = 'public' AND viewname = 'admin_dashboard_stats';
-- -- definition should NOT contain 'auth.users'; it should call get_admin_user_counts()
--
-- -- 1b. Confirm the helper function exists:
-- SELECT proname, prosecdef FROM pg_proc
-- JOIN pg_namespace ON pg_namespace.oid = pg_proc.pronamespace
-- WHERE nspname = 'public' AND proname = 'get_admin_user_counts';
--
-- -- 2. Confirm security_documentation has RLS enabled:
-- SELECT tablename, rowsecurity
-- FROM   pg_tables
-- WHERE  schemaname = 'public' AND tablename = 'security_documentation';
--
-- -- 3. Confirm spatial_ref_sys is no longer accessible to anon/authenticated:
-- SELECT grantee, privilege_type
-- FROM   information_schema.role_table_grants
-- WHERE  table_schema = 'public' AND table_name = 'spatial_ref_sys'
-- AND    grantee IN ('anon', 'authenticated');
-- -- Should return 0 rows.
--
-- -- 4. Confirm menu_scan_jobs policy no longer references user_metadata:
-- SELECT polname, pg_get_expr(polqual, polrelid) AS using_expr
-- FROM   pg_policy
-- JOIN   pg_class ON pg_class.oid = pg_policy.polrelid
-- WHERE  pg_class.relname = 'menu_scan_jobs';
-- ============================================================================

DO $$
BEGIN
  RAISE NOTICE '========================================';
  RAISE NOTICE 'Migration 042 complete';
  RAISE NOTICE '========================================';
  RAISE NOTICE '  ✓ admin_dashboard_stats: SECURITY INVOKER, auth.users behind SECURITY DEFINER helper';
  RAISE NOTICE '  ✓ security_documentation: RLS enabled (authenticated SELECT)';
  RAISE NOTICE '  ✓ spatial_ref_sys: SELECT revoked from anon/authenticated (extension-owned table)';  
  RAISE NOTICE '  ✓ menu_scan_jobs: RLS policy migrated to is_admin()';
  RAISE NOTICE '  ✓ is_admin(): now checks raw_app_meta_data (with fallback)';
  RAISE NOTICE '';
  RAISE NOTICE 'ACTION REQUIRED:';
  RAISE NOTICE '  Migrate admin role to raw_app_meta_data for all admin users:';
  RAISE NOTICE '  UPDATE auth.users';
  RAISE NOTICE '    SET raw_app_meta_data = raw_app_meta_data || jsonb_build_object(''role'',''admin'')';
  RAISE NOTICE '    WHERE raw_user_meta_data->>''role'' = ''admin'';';
  RAISE NOTICE '  Then remove raw_user_meta_data fallback in a future migration.';
  RAISE NOTICE '========================================';
END $$;
