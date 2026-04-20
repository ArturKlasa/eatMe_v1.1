-- 100_backfill_ingredient_concepts.sql
-- Created: 2026-04-18
-- Phase 2 of ingredient system refactor.
--
-- Populates the new tables from existing canonical_ingredients +
-- ingredient_aliases. Legacy tables are read-only in this migration; nothing
-- is deleted. Idempotent via ON CONFLICT — safe to re-run.
--
-- Expected results (based on Phase 0 audit):
--   ingredient_concepts: ~614 rows (one per canonical_ingredient)
--   ingredient_variants: ~614 rows (one default per concept)
--   concept_translations: ~614 'en' rows + ~1-2k non-'en' rows (best-effort seed)
--   ingredient_aliases_v2: up to 3245 rows (some may drop due to case collisions)

-- ============================================================================
-- SECTION 1: Concepts — one per canonical_ingredient
-- ============================================================================
-- slug reuses canonical_name (already lowercase/underscored).
-- legacy_canonical_id preserves lineage for Phase 5 dish_ingredients remap.
-- allergens left empty; Phase 2b curation will populate.

INSERT INTO public.ingredient_concepts
  (slug, family, is_vegetarian, is_vegan, allergens, legacy_canonical_id)
SELECT
  canonical_name,
  ingredient_family_name,
  COALESCE(is_vegetarian, true),
  COALESCE(is_vegan, false),
  '{}'::text[],
  id
FROM public.canonical_ingredients
ON CONFLICT (slug) DO NOTHING;

-- ============================================================================
-- SECTION 2: Default variants — exactly one per concept, modifier=null
-- ============================================================================

INSERT INTO public.ingredient_variants (concept_id, modifier, is_default)
SELECT c.id, NULL, true
FROM public.ingredient_concepts c
WHERE c.legacy_canonical_id IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM public.ingredient_variants v
    WHERE v.concept_id = c.id AND v.is_default = true
  );

-- ============================================================================
-- SECTION 3: English concept translations — derived from slug
-- ============================================================================
-- "olive_oil" → "Olive Oil". Will be overwritten by Phase 2b curation where
-- a better value exists (e.g. "Olive oil" with only-first-letter capitalized).

INSERT INTO public.concept_translations (concept_id, language, name)
SELECT
  c.id,
  'en',
  initcap(replace(c.slug, '_', ' '))
FROM public.ingredient_concepts c
WHERE c.legacy_canonical_id IS NOT NULL
ON CONFLICT (concept_id, language) DO NOTHING;

-- ============================================================================
-- SECTION 4: Aliases — lowercased copy of old ingredient_aliases
-- ============================================================================
-- Stored lowercase for case-insensitive matching. Original casing is not
-- needed here since aliases are match-only; concept_translations preserve
-- display casing.
--
-- Duplicate collisions can occur after lowercasing (e.g. "Abadejo" +
-- "abadejo" → both become "abadejo"). ON CONFLICT DO NOTHING drops the
-- second; the first-seen row wins.

INSERT INTO public.ingredient_aliases_v2
  (alias_text, language, concept_id, variant_id)
SELECT
  lower(trim(a.display_name)),
  a.language,
  c.id,
  NULL  -- null variant_id → alias resolves to the concept's default variant
FROM public.ingredient_aliases a
JOIN public.ingredient_concepts c ON c.legacy_canonical_id = a.canonical_ingredient_id
ON CONFLICT (alias_text, language) DO NOTHING;

-- ============================================================================
-- SECTION 5: Non-English concept translations — best-effort seed from aliases
-- ============================================================================
-- For each (concept, non-'en' language) pair, pick the SHORTEST alias as the
-- display translation seed. Shortest usually = cleanest/most common form
-- (e.g. "tomate" over "tomate maduro"). Uses original-case display_name from
-- the old ingredient_aliases table to preserve capitalization.
--
-- Phase 2b curation will overwrite these with reviewed values where we care
-- about quality.

INSERT INTO public.concept_translations (concept_id, language, name)
SELECT DISTINCT ON (c.id, a.language)
  c.id,
  a.language,
  a.display_name
FROM public.ingredient_aliases a
JOIN public.ingredient_concepts c ON c.legacy_canonical_id = a.canonical_ingredient_id
WHERE a.language <> 'en'
ORDER BY c.id, a.language, length(a.display_name) ASC, a.display_name ASC
ON CONFLICT (concept_id, language) DO NOTHING;

-- ============================================================================
-- SUCCESS
-- ============================================================================
DO $$
DECLARE
  concept_count int;
  variant_count int;
  translation_count int;
  alias_count int;
BEGIN
  SELECT count(*) INTO concept_count FROM public.ingredient_concepts;
  SELECT count(*) INTO variant_count FROM public.ingredient_variants;
  SELECT count(*) INTO translation_count FROM public.concept_translations;
  SELECT count(*) INTO alias_count FROM public.ingredient_aliases_v2;

  RAISE NOTICE '========================================';
  RAISE NOTICE 'Migration 100: backfill complete';
  RAISE NOTICE '  ingredient_concepts:    % rows', concept_count;
  RAISE NOTICE '  ingredient_variants:    % rows (should match concepts)', variant_count;
  RAISE NOTICE '  concept_translations:   % rows', translation_count;
  RAISE NOTICE '  ingredient_aliases_v2:  % rows', alias_count;
  RAISE NOTICE '';
  RAISE NOTICE '  Legacy tables untouched. dish_ingredients still FKs to';
  RAISE NOTICE '  canonical_ingredients. No readers wired to new tables yet.';
  RAISE NOTICE '========================================';
END $$;
