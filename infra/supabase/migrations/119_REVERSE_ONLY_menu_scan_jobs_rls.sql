-- 119_REVERSE_ONLY_menu_scan_jobs_rls.sql
-- Reverse migration for 119_menu_scan_jobs_rls.sql
--
-- WARNING (security): DISABLE ROW LEVEL SECURITY re-opens the table to anon reads.
-- Only run this during a controlled rollback — never in production while v2 is live.

BEGIN;

DROP POLICY IF EXISTS "menu_scan_jobs: owner or admin select" ON public.menu_scan_jobs;
DROP POLICY IF EXISTS "menu_scan_jobs: owner insert"          ON public.menu_scan_jobs;
DROP POLICY IF EXISTS "menu_scan_jobs: owner or admin update" ON public.menu_scan_jobs;

ALTER PUBLICATION supabase_realtime DROP TABLE public.menu_scan_jobs;

ALTER TABLE public.menu_scan_jobs DISABLE ROW LEVEL SECURITY;

COMMIT;
