-- 153_REVERSE_ONLY_drop_ingredient_columns.sql
-- Reverses 153_drop_ingredient_columns.sql by recreating the three columns
-- as NULL-defaulted text[] / uuid. Data is not restored — Phase C chose not
-- to snapshot. The columns existed solely as trigger inputs (allergens_override,
-- dietary_tags_override) or as a FK into a dropped table
-- (canonical_ingredient_id). All three are unrecoverable from current state.

BEGIN;

ALTER TABLE public.dishes
  ADD COLUMN IF NOT EXISTS allergens_override    text[] DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS dietary_tags_override text[] DEFAULT NULL;

ALTER TABLE public.options
  ADD COLUMN IF NOT EXISTS canonical_ingredient_id uuid DEFAULT NULL;

COMMIT;
