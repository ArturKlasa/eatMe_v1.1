-- 121_REVERSE_ONLY_confirm_menu_scan.sql
-- Reverse migration for 121_confirm_menu_scan.sql
--
-- WARNING: One-way at first confirm_menu_scan invocation (inserted dishes exist).
-- Check before running:
--   SELECT count(*) FROM menu_scan_confirmations;  -- must be 0

BEGIN;

DROP FUNCTION IF EXISTS public.fail_menu_scan_job(uuid, text, int);
DROP FUNCTION IF EXISTS public.complete_menu_scan_job(uuid, jsonb);
DROP FUNCTION IF EXISTS public.claim_menu_scan_job(int);
DROP FUNCTION IF EXISTS public.confirm_menu_scan(uuid, jsonb, text);

-- Drops policies + table (CASCADE removes the PK-indexed rows).
DROP TABLE IF EXISTS public.menu_scan_confirmations CASCADE;

ALTER TABLE public.menu_scan_jobs
  DROP COLUMN IF EXISTS saved_at,
  DROP COLUMN IF EXISTS saved_dish_ids;

COMMIT;
