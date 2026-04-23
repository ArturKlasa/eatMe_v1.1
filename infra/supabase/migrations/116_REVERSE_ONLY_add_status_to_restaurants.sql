-- 116_REVERSE_ONLY_add_status_to_restaurants.sql
-- Reverse migration for 116_add_status_to_restaurants.sql
--
-- WARNING: Once any app writes a 'draft' or 'archived' row, reverting this
-- migration drops those values and loses the lifecycle data permanently.
-- Check for non-published rows before running:
--   SELECT count(*) FROM restaurants WHERE status <> 'published';
-- Only proceed if the count is 0.

BEGIN;

DROP INDEX IF EXISTS public.idx_restaurants_status;

ALTER TABLE public.restaurants
  DROP COLUMN IF EXISTS status;

COMMIT;
