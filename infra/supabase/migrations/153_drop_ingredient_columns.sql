-- 153_drop_ingredient_columns.sql
-- Created: 2026-06-04
--
-- Phase C continuation: drop the three dead columns that referenced the
-- ingredient pipeline (now retired by migration 152).
--
--   - dishes.allergens_override    — write-only, never read; trigger system
--                                    that consumed it was dropped in 151.
--   - dishes.dietary_tags_override — same pattern.
--   - options.canonical_ingredient_id — pointed at canonical_ingredients
--                                       (dropped in 152). Mobile read path
--                                       migrated to option.adds_allergens.
--
-- dishes.allergens / dishes.dietary_tags themselves are PRESERVED — they
-- are now direct-write columns populated by the menu-scan worker and the
-- admin app.
--
-- Reverse: 153_REVERSE_ONLY_drop_ingredient_columns.sql recreates the
-- columns as NULL-defaulted (data unrecoverable).

BEGIN;

ALTER TABLE public.dishes
  DROP COLUMN IF EXISTS allergens_override,
  DROP COLUMN IF EXISTS dietary_tags_override;

ALTER TABLE public.options
  DROP COLUMN IF EXISTS canonical_ingredient_id;

COMMIT;
