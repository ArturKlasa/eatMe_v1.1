-- 118_extend_menu_scan_jobs.sql
-- Created: 2026-04-23
--
-- Extends menu_scan_jobs for the v2 worker claim pattern:
--   - input jsonb       — stores { images: [{bucket, path, page}] } from the upload step
--   - attempts int      — incremented on each claim; triggers 'failed' at max_attempts
--   - locked_until      — claim expiry; worker re-claims stuck jobs when past this
--   - last_error text   — diagnostic from the most recent failed attempt
--
-- Also replaces the 4-value status CHECK with a 5-value one that adds 'pending'
-- and flips the DEFAULT from 'processing' to 'pending' (new jobs land in queue).
--
-- Reverse: 118_REVERSE_ONLY_extend_menu_scan_jobs.sql

BEGIN;

-- New columns (IF NOT EXISTS = idempotent on re-run).
ALTER TABLE public.menu_scan_jobs
  ADD COLUMN IF NOT EXISTS input        jsonb,
  ADD COLUMN IF NOT EXISTS attempts     int  NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS locked_until timestamptz,
  ADD COLUMN IF NOT EXISTS last_error   text;

-- Replace inline status CHECK (auto-named menu_scan_jobs_status_check by Postgres).
ALTER TABLE public.menu_scan_jobs
  DROP CONSTRAINT IF EXISTS menu_scan_jobs_status_check;

ALTER TABLE public.menu_scan_jobs
  ADD CONSTRAINT menu_scan_jobs_status_check
    CHECK (status IN ('pending', 'processing', 'needs_review', 'completed', 'failed'));

-- Flip default: new rows inserted by the owner app start as 'pending'.
ALTER TABLE public.menu_scan_jobs
  ALTER COLUMN status SET DEFAULT 'pending';

-- Indexes for the worker claim query (status + locked_until).
CREATE INDEX IF NOT EXISTS idx_menu_scan_jobs_status
  ON public.menu_scan_jobs (status);

CREATE INDEX IF NOT EXISTS idx_menu_scan_jobs_locked_until
  ON public.menu_scan_jobs (locked_until)
  WHERE status IN ('processing', 'pending');

COMMIT;
