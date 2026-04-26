-- 124_REVERSE_ONLY_canonical_menu_categories.sql
-- Reverse migration for 124_canonical_menu_categories.sql
--
-- WARNING: This drops the canonical-categories table and the new menu_categories
-- columns. Any per-restaurant menu_categories rows that were created with a
-- canonical_category_id link will lose that link (rows themselves are kept —
-- the FK is ON DELETE SET NULL — but here we drop the column entirely).
-- name_translations data is also lost.

BEGIN;

-- Drop partial unique indexes on menu_categories first (depend on the new col)
DROP INDEX IF EXISTS public.menu_categories_canonical_unique;
DROP INDEX IF EXISTS public.menu_categories_custom_name_unique;

-- Drop the new columns from menu_categories
ALTER TABLE public.menu_categories
  DROP COLUMN IF EXISTS canonical_category_id,
  DROP COLUMN IF EXISTS source_language_code,
  DROP COLUMN IF EXISTS name_translations;

-- Drop policies + table
DROP POLICY IF EXISTS "canonical_menu_categories: public read"
  ON public.canonical_menu_categories;

DROP TABLE IF EXISTS public.canonical_menu_categories;

COMMIT;
