-- 118_REVERSE_ONLY_extend_menu_scan_jobs.sql
-- Reverse migration for 118_extend_menu_scan_jobs.sql
--
-- WARNING: Once any 'pending' rows exist, reverting resets default to 'processing'
-- and removes the 'pending' value from the CHECK — existing 'pending' rows would
-- violate the constraint on the next write. Verify first:
--   SELECT count(*) FROM menu_scan_jobs WHERE status = 'pending';

BEGIN;

DROP INDEX IF EXISTS public.idx_menu_scan_jobs_locked_until;
DROP INDEX IF EXISTS public.idx_menu_scan_jobs_status;

ALTER TABLE public.menu_scan_jobs
  DROP CONSTRAINT IF EXISTS menu_scan_jobs_status_check;

ALTER TABLE public.menu_scan_jobs
  ADD CONSTRAINT menu_scan_jobs_status_check
    CHECK (status IN ('processing', 'needs_review', 'completed', 'failed'));

ALTER TABLE public.menu_scan_jobs
  ALTER COLUMN status SET DEFAULT 'processing';

ALTER TABLE public.menu_scan_jobs
  DROP COLUMN IF EXISTS last_error,
  DROP COLUMN IF EXISTS locked_until,
  DROP COLUMN IF EXISTS attempts,
  DROP COLUMN IF EXISTS input;

COMMIT;
