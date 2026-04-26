-- 125_REVERSE_ONLY_menu_category_descriptions.sql
-- Reverse migration for 125_menu_category_descriptions.sql
--
-- WARNING: drops the description_translations column. Any localized
-- descriptions stored there are lost. Source-language descriptions in the
-- existing `description` column are unaffected.

BEGIN;

ALTER TABLE public.menu_categories
  DROP COLUMN IF EXISTS description_translations;

COMMIT;
