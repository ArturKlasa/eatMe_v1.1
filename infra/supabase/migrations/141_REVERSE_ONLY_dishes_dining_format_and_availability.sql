-- 141_REVERSE_ONLY_dishes_dining_format_and_availability.sql
-- Reverses 141_dishes_dining_format_and_availability.sql.
--
-- WARNING: drops seven dishes columns. ALL DATA IN THESE COLUMNS IS LOST.
-- Safe to roll back only if Phase 1 is being abandoned entirely — nothing
-- pre-existing depends on these columns (they are pure-additive).

BEGIN;

ALTER TABLE public.dishes
  DROP CONSTRAINT IF EXISTS bundled_items_is_array,
  DROP CONSTRAINT IF EXISTS dishes_dining_format_check;

ALTER TABLE public.dishes
  DROP COLUMN IF EXISTS available_until,
  DROP COLUMN IF EXISTS available_from,
  DROP COLUMN IF EXISTS available_hours_end,
  DROP COLUMN IF EXISTS available_hours_start,
  DROP COLUMN IF EXISTS available_days,
  DROP COLUMN IF EXISTS bundled_items,
  DROP COLUMN IF EXISTS dining_format;

COMMIT;
