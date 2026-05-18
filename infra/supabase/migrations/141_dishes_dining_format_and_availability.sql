-- 141_dishes_dining_format_and_availability.sql
-- Created: 2026-05-17
--
-- Phase 1 of the dish-model rewrite (docs/plans/dish-model-rewrite-phase-1-database.md §2).
-- Pure-additive extensions to the dishes table:
--
--   - dining_format text NULL — UX presentation hint. NULL = normal dish row.
--     One of: 'buffet','course_menu','interactive_table','shared_plates','sampler'.
--     The mobile app switches layout flavor based on this column.
--
--   - bundled_items jsonb NULL — "comes with [...]" informational metadata.
--     Pure description, never relationally queried. Validated as an array
--     via a CHECK constraint (array elements are {name, note?} per the worker
--     schema; the array-ness check is the only DB-level guarantee — element
--     shape is enforced by application code).
--
--   - available_days text[] NULL — e.g. ['mon','tue','wed']. NULL = always.
--   - available_hours_start time NULL — e.g. '17:00:00' for dinner-only.
--   - available_hours_end   time NULL — e.g. '22:00:00'.
--   - available_from date NULL — start of seasonal availability window.
--   - available_until date NULL — end of seasonal availability window.
--
-- All defaults are NULL = "always available, no UX hint". Existing rows are
-- unaffected. The generate_candidates RPC in migration 142 will add WHERE
-- clauses that respect these windows; until then they're cosmetic columns.
--
-- Pre-apply checklist:
--   1. Migration 140 must already be applied (no cross-dependency, but
--      Phase 1 migrations should land in order for reviewability).
--   2. After applying, regenerate types:
--        supabase gen types typescript --linked > packages/database/src/types.ts

BEGIN;

ALTER TABLE public.dishes
  ADD COLUMN IF NOT EXISTS dining_format         text   NULL,
  ADD COLUMN IF NOT EXISTS bundled_items         jsonb  NULL,
  ADD COLUMN IF NOT EXISTS available_days        text[] NULL,
  ADD COLUMN IF NOT EXISTS available_hours_start time   NULL,
  ADD COLUMN IF NOT EXISTS available_hours_end   time   NULL,
  ADD COLUMN IF NOT EXISTS available_from        date   NULL,
  ADD COLUMN IF NOT EXISTS available_until       date   NULL;

-- dining_format value check (separate ALTER so we can name the constraint
-- explicitly — easier to reverse and to reference in future migrations)
ALTER TABLE public.dishes
  DROP CONSTRAINT IF EXISTS dishes_dining_format_check;

ALTER TABLE public.dishes
  ADD CONSTRAINT dishes_dining_format_check
  CHECK (
    dining_format IS NULL
    OR dining_format IN ('buffet','course_menu','interactive_table','shared_plates','sampler')
  );

-- bundled_items shape: must be a JSON array (or NULL). Element shape
-- ({name, note?}) is enforced by application code, not the DB.
ALTER TABLE public.dishes
  DROP CONSTRAINT IF EXISTS bundled_items_is_array;

ALTER TABLE public.dishes
  ADD CONSTRAINT bundled_items_is_array
  CHECK (bundled_items IS NULL OR jsonb_typeof(bundled_items) = 'array');

COMMENT ON COLUMN public.dishes.dining_format IS
  'UX presentation hint. Switches mobile layout flavor. NULL = normal dish row. '
  'One of: buffet, course_menu, interactive_table, shared_plates, sampler.';
COMMENT ON COLUMN public.dishes.bundled_items IS
  'Informational "comes with" list as JSON array of {name, note?}. Pure description, never relationally queried.';
COMMENT ON COLUMN public.dishes.available_days IS
  'Lowercase 3-letter day codes the dish is available (e.g. {mon,tue,wed}). NULL = always.';
COMMENT ON COLUMN public.dishes.available_hours_start IS
  'Daily start time the dish is orderable (e.g. 17:00:00 for dinner). NULL = no start cutoff.';
COMMENT ON COLUMN public.dishes.available_hours_end IS
  'Daily end time the dish is orderable. NULL = no end cutoff.';
COMMENT ON COLUMN public.dishes.available_from IS
  'Start of seasonal availability window. NULL = no start date.';
COMMENT ON COLUMN public.dishes.available_until IS
  'End of seasonal availability window. NULL = no end date.';

COMMIT;
