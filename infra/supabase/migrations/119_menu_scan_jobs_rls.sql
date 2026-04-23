-- 119_menu_scan_jobs_rls.sql
-- Created: 2026-04-23
--
-- Enables RLS on menu_scan_jobs and adds owner-scoped policies.
-- Also adds the table to the supabase_realtime publication so the owner app
-- can subscribe to job status transitions via Supabase Realtime (Step 21).
--
-- Policy design (design §5.1 row 119 + release-safety §3.4):
--   SELECT  — created_by = auth.uid()  OR  restaurant owner  OR  admin
--   INSERT  — created_by = auth.uid()  AND restaurant owner  (no forging)
--   UPDATE  — created_by = auth.uid()  OR  admin             (worker uses service role)
--
-- Service role bypasses RLS by default — no explicit service-role policy needed.
--
-- Reverse: 119_REVERSE_ONLY_menu_scan_jobs_rls.sql

BEGIN;

ALTER TABLE public.menu_scan_jobs ENABLE ROW LEVEL SECURITY;

-- SELECT: owner, restaurant owner, or admin.
CREATE POLICY "menu_scan_jobs: owner or admin select"
  ON public.menu_scan_jobs
  FOR SELECT
  TO authenticated
  USING (
    created_by = auth.uid()
    OR public.is_admin()
    OR EXISTS (
      SELECT 1 FROM public.restaurants
      WHERE id = menu_scan_jobs.restaurant_id
        AND owner_id = auth.uid()
    )
  );

-- INSERT: caller must be the created_by AND own the referenced restaurant.
CREATE POLICY "menu_scan_jobs: owner insert"
  ON public.menu_scan_jobs
  FOR INSERT
  TO authenticated
  WITH CHECK (
    created_by = auth.uid()
    AND EXISTS (
      SELECT 1 FROM public.restaurants
      WHERE id = menu_scan_jobs.restaurant_id
        AND owner_id = auth.uid()
    )
  );

-- UPDATE: owner or admin (worker operates via service role, bypasses RLS).
CREATE POLICY "menu_scan_jobs: owner or admin update"
  ON public.menu_scan_jobs
  FOR UPDATE
  TO authenticated
  USING (
    created_by = auth.uid()
    OR public.is_admin()
  );

-- Add to Realtime publication so owner app receives job status push events.
ALTER PUBLICATION supabase_realtime ADD TABLE public.menu_scan_jobs;

COMMIT;
