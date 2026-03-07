-- ============================================================================
-- Migration 043: Remove raw_user_meta_data fallback from admin checks
-- Date: (run after completing migration 042 ACTION REQUIRED step)
-- ============================================================================
-- Prerequisites — before running this migration:
--   1. Run in Supabase SQL Editor to confirm ALL admins have app_metadata set:
--      SELECT id, email,
--             raw_app_meta_data->>'role'  AS app_role,
--             raw_user_meta_data->>'role' AS user_role
--      FROM auth.users
--      WHERE raw_user_meta_data->>'role' = 'admin'
--        AND (raw_app_meta_data->>'role') IS DISTINCT FROM 'admin';
--      -- Must return 0 rows before proceeding.
--
--   2. Confirm verifyAdminRequest() fallback removed in supabase-server.ts.
-- ============================================================================


-- ============================================================================
-- 1. Harden is_admin() — remove raw_user_meta_data fallback
-- ============================================================================

CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
BEGIN
  RETURN COALESCE(
    (
      SELECT raw_app_meta_data->>'role' = 'admin'
      FROM auth.users
      WHERE id = auth.uid()
    ),
    false
  );
END;
$$;

COMMENT ON FUNCTION public.is_admin() IS
  'Returns true if the current user has role=admin in raw_app_meta_data. '
  'raw_app_meta_data is service-role-only and cannot be modified by end users.';


-- ============================================================================
-- 2. Harden get_admin_user_counts() — remove raw_user_meta_data fallback
-- ============================================================================

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
    COUNT(*) FILTER (WHERE raw_app_meta_data->>'role' = 'restaurant_owner'),
    COUNT(*) FILTER (WHERE raw_app_meta_data->>'role' = 'admin')
  INTO restaurant_owners, admin_users
  FROM auth.users;
END;
$$;

COMMENT ON FUNCTION public.get_admin_user_counts() IS
  'Returns (restaurant_owners, admin_users) counts from auth.users. '
  'Reads raw_app_meta_data only (service-role-only, not editable by end users). '
  'SECURITY DEFINER so the view can access auth schema without exposing it.';


-- ============================================================================
-- Verification
-- ============================================================================
-- -- Confirm no admin is locked out (should return > 0 if admins exist):
-- SELECT COUNT(*) FROM auth.users WHERE raw_app_meta_data->>'role' = 'admin';

DO $$
BEGIN
  RAISE NOTICE '========================================';
  RAISE NOTICE 'Migration 043 complete';
  RAISE NOTICE '========================================';
  RAISE NOTICE '  ✓ is_admin(): raw_user_meta_data fallback removed';
  RAISE NOTICE '  ✓ get_admin_user_counts(): raw_user_meta_data fallback removed';
  RAISE NOTICE '  Admin checks now read raw_app_meta_data only.';
  RAISE NOTICE '========================================';
END $$;
