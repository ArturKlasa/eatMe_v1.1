-- 103_mirror_canonical_ingredients.sql
-- Created: 2026-04-18
-- Phase 3 of ingredient system refactor.
--
-- The Phase 2b curated seed introduced ~258 ingredient_concepts that have
-- no corresponding canonical_ingredients row (legacy_canonical_id IS NULL).
-- Menu-scan writes still require a valid dish_ingredients.ingredient_id
-- (FK to canonical_ingredients) during the transition — and the allergen
-- trigger (migration 092) joins through canonical_ingredient_allergens /
-- canonical_ingredient_dietary_tags.
--
-- This migration creates a mirror canonical_ingredients row for each
-- new-only concept, links them back via legacy_canonical_id, and
-- re-syncs the allergen + dietary-tag junction tables. It is idempotent:
-- rerunning only affects concepts still lacking a mirror.
--
-- The mirror rows are disposable; they retire alongside canonical_ingredients
-- at Phase 6 cutover.

BEGIN;

-- ============================================================================
-- SECTION 1: Create mirror canonical_ingredients rows
-- ============================================================================
-- canonical_ingredients.canonical_name is UNIQUE; ingredient_concepts.slug is
-- UNIQUE; the slugs of new-only concepts do not collide with existing
-- canonical_names (those would have been matched by the Phase 2 backfill).

INSERT INTO public.canonical_ingredients (
  canonical_name,
  is_vegetarian,
  is_vegan,
  ingredient_family_name
)
SELECT
  c.slug,
  c.is_vegetarian,
  c.is_vegan,
  c.family
FROM public.ingredient_concepts c
WHERE c.legacy_canonical_id IS NULL;

-- ============================================================================
-- SECTION 2: Link concepts back to their mirror rows
-- ============================================================================

UPDATE public.ingredient_concepts c
SET legacy_canonical_id = ci.id
FROM public.canonical_ingredients ci
WHERE c.legacy_canonical_id IS NULL
  AND ci.canonical_name = c.slug;

-- ============================================================================
-- SECTION 3: Sync allergens
-- ============================================================================
-- Insert canonical_ingredient_allergens rows from the concept.allergens[]
-- array for every concept that now has a legacy_canonical_id. Idempotent
-- via the composite primary key.

INSERT INTO public.canonical_ingredient_allergens (canonical_ingredient_id, allergen_id)
SELECT DISTINCT c.legacy_canonical_id, a.id
FROM public.ingredient_concepts c
CROSS JOIN LATERAL unnest(c.allergens) AS ac(code)
JOIN public.allergens a ON a.code = ac.code
WHERE c.legacy_canonical_id IS NOT NULL
ON CONFLICT DO NOTHING;

-- ============================================================================
-- SECTION 4: Sync dietary tags (vegetarian / vegan)
-- ============================================================================
-- Only these two tags are derivable from the concept's boolean flags.
-- Richer tags (halal, kosher, jain, etc.) remain admin-curated on the
-- legacy junction table and are not inferred here.

INSERT INTO public.canonical_ingredient_dietary_tags (canonical_ingredient_id, dietary_tag_id)
SELECT c.legacy_canonical_id, dt.id
FROM public.ingredient_concepts c
JOIN public.dietary_tags dt ON dt.code = 'vegetarian'
WHERE c.is_vegetarian = true
  AND c.legacy_canonical_id IS NOT NULL
ON CONFLICT DO NOTHING;

INSERT INTO public.canonical_ingredient_dietary_tags (canonical_ingredient_id, dietary_tag_id)
SELECT c.legacy_canonical_id, dt.id
FROM public.ingredient_concepts c
JOIN public.dietary_tags dt ON dt.code = 'vegan'
WHERE c.is_vegan = true
  AND c.legacy_canonical_id IS NOT NULL
ON CONFLICT DO NOTHING;

COMMIT;
