-- Migration 087: Fix remaining auth.users FK constraints that block user deletion
--
-- After migrations 084 (CASCADE on user-owned tables) and 086 (SET NULL on UGC),
-- four FK columns still have NO ACTION (default RESTRICT), which blocks Auth API
-- user deletion with: "ERROR: permission denied for table restaurants (SQLSTATE 42501)"
--
-- Postgres checks permissions on child tables BEFORE evaluating the FK action.
-- supabase_auth_admin needs UPDATE permission to perform SET NULL.
--
-- Tables handled here:
--   restaurants.owner_id      → SET NULL (orphan the restaurant, don't delete)
--   restaurants.suspended_by  → SET NULL (preserve suspension record, clear actor ref)
--   menu_scan_jobs.created_by → SET NULL (preserve job history)
--   admin_audit_log.admin_id  → SET NULL (preserve audit trail)

-- ── restaurants ────────────────────────────────────────────────────────────

ALTER TABLE public.restaurants
  DROP CONSTRAINT IF EXISTS restaurants_owner_id_fkey,
  ADD CONSTRAINT restaurants_owner_id_fkey
    FOREIGN KEY (owner_id) REFERENCES auth.users(id) ON DELETE SET NULL;

ALTER TABLE public.restaurants
  DROP CONSTRAINT IF EXISTS restaurants_suspended_by_fkey,
  ADD CONSTRAINT restaurants_suspended_by_fkey
    FOREIGN KEY (suspended_by) REFERENCES auth.users(id) ON DELETE SET NULL;

-- ── menu_scan_jobs ─────────────────────────────────────────────────────────

ALTER TABLE public.menu_scan_jobs
  ALTER COLUMN created_by DROP NOT NULL;

ALTER TABLE public.menu_scan_jobs
  DROP CONSTRAINT IF EXISTS menu_scan_jobs_created_by_fkey,
  ADD CONSTRAINT menu_scan_jobs_created_by_fkey
    FOREIGN KEY (created_by) REFERENCES auth.users(id) ON DELETE SET NULL;

-- ── admin_audit_log ────────────────────────────────────────────────────────

ALTER TABLE public.admin_audit_log
  ALTER COLUMN admin_id DROP NOT NULL;

ALTER TABLE public.admin_audit_log
  DROP CONSTRAINT IF EXISTS admin_audit_log_admin_id_fkey,
  ADD CONSTRAINT admin_audit_log_admin_id_fkey
    FOREIGN KEY (admin_id) REFERENCES auth.users(id) ON DELETE SET NULL;

-- ── Grant supabase_auth_admin UPDATE on SET NULL tables ────────────────────
-- Postgres needs UPDATE permission to perform ON DELETE SET NULL.

GRANT SELECT, UPDATE ON public.restaurants      TO supabase_auth_admin;
GRANT SELECT, UPDATE ON public.menu_scan_jobs   TO supabase_auth_admin;
GRANT SELECT, UPDATE ON public.admin_audit_log  TO supabase_auth_admin;
