-- 174_REVERSE_ONLY_drop_ingredient_columns_restrict.sql
-- Reverses 174_drop_ingredient_columns_restrict.sql.
--
-- STRUCTURAL RESTORE ONLY (D-05), mirroring the 156_REVERSE ADD COLUMN form.
-- Re-adds the two dropped dishes override columns with their original text[]
-- defaults. No data restore is meaningful: the columns were always empty/default
-- (direct-default-only and unread since migration 171 dropped the maintaining
-- trigger).

BEGIN;

ALTER TABLE public.dishes
  ADD COLUMN IF NOT EXISTS allergens_override    text[] DEFAULT ARRAY[]::text[],
  ADD COLUMN IF NOT EXISTS dietary_tags_override text[] DEFAULT ARRAY[]::text[];

COMMIT;
