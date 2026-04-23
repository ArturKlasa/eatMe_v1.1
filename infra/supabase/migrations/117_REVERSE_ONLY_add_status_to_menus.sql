-- 117_REVERSE_ONLY_add_status_to_menus.sql
-- Reverse migration for 117_add_status_to_menus.sql
--
-- WARNING: Check for non-published menu rows before running:
--   SELECT count(*) FROM menus WHERE status <> 'published';
-- Only proceed if the count is 0.

BEGIN;

DROP INDEX IF EXISTS public.idx_menus_status;

ALTER TABLE public.menus
  DROP COLUMN IF EXISTS status;

COMMIT;
