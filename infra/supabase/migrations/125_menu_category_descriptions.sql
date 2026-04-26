-- 125_menu_category_descriptions.sql
-- Created: 2026-04-25
--
-- Adds description_translations jsonb to menu_categories so per-restaurant
-- categories can carry localized descriptions (e.g. "Hot Dogs" + "2 hot dogs
-- de salchicha de pavo con papas"). Mirrors the name_translations pattern
-- from migration 124.
--
-- description (existing column) stays as the source-language display.
-- description_translations holds locale-keyed translations (e.g.
-- {"es":"2 hot dogs...", "en":"2 turkey hot dogs..."}).
--
-- Mobile resolution (same shape as for name):
--   COALESCE(
--     description_translations->>$locale,
--     description
--   )
--
-- canonical_menu_categories intentionally has NO description field — category
-- descriptions are restaurant-specific (they describe what THIS restaurant
-- serves under that section), not abstract definitions of the canonical class.
--
-- Reverse: 125_REVERSE_ONLY_menu_category_descriptions.sql

BEGIN;

ALTER TABLE public.menu_categories
  ADD COLUMN IF NOT EXISTS description_translations jsonb NOT NULL DEFAULT '{}'::jsonb;

COMMIT;
