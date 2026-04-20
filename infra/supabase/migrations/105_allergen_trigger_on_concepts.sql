-- 105_allergen_trigger_on_concepts.sql
-- Created: 2026-04-19
-- Phase 6A cutover — step 3 of 3 migrations.
--
-- Rewrites compute_dish_allergens / compute_dish_dietary_tags to read from
-- ingredient_concepts.allergens (array) and the is_vegetarian / is_vegan
-- boolean flags, instead of joining through the legacy junction tables
-- canonical_ingredient_allergens and canonical_ingredient_dietary_tags.
--
-- Benefits:
--   - Single join per lookup (dish_ingredients → ingredient_concepts)
--     instead of two (through canonical_ingredients and the junction).
--   - Array membership is cheaper than junction joins for the small number
--     of rows per dish.
--   - Preparing Phase 6B, which will drop the legacy junction tables.
--
-- Other dietary_tags (halal, kosher, pescatarian, etc.) are NOT represented
-- in ingredient_concepts yet, so this migration only recomputes vegetarian
-- and vegan from the boolean flags. Richer tags remain on the legacy
-- junction via canonical_ingredient_dietary_tags until Phase 6B migrates
-- them to concept-level storage.
--
-- Invariant preserved: a dish is vegetarian iff every linked ingredient
-- concept is vegetarian; a dish is vegan iff every linked ingredient is
-- vegan. This matches the prior trigger behaviour.

BEGIN;

-- ============================================================================
-- SECTION 1: compute_dish_allergens — concept.allergens array
-- ============================================================================

CREATE OR REPLACE FUNCTION public.compute_dish_allergens(p_dish_id uuid)
RETURNS text[]
LANGUAGE sql STABLE
AS $$
  SELECT coalesce(
    array_agg(DISTINCT allergen_code ORDER BY allergen_code),
    ARRAY[]::text[]
  )
  FROM public.dish_ingredients di
  JOIN public.ingredient_concepts ic ON ic.id = di.concept_id
  CROSS JOIN LATERAL unnest(ic.allergens) AS allergen_code
  WHERE di.dish_id = p_dish_id;
$$;

-- ============================================================================
-- SECTION 2: compute_dish_dietary_tags — boolean flags + legacy junction
-- ============================================================================
-- Union the boolean-derived tags (vegetarian / vegan) with any other tags
-- still sourced from the legacy junction. Phase 6B will drop the junction
-- half after confirming nothing else depends on it.

CREATE OR REPLACE FUNCTION public.compute_dish_dietary_tags(p_dish_id uuid)
RETURNS text[]
LANGUAGE sql STABLE
AS $$
  WITH concept_tags AS (
    -- vegetarian — every linked concept must be vegetarian
    SELECT 'vegetarian'::text AS code
    WHERE EXISTS (SELECT 1 FROM public.dish_ingredients WHERE dish_id = p_dish_id)
      AND NOT EXISTS (
        SELECT 1
        FROM public.dish_ingredients di
        JOIN public.ingredient_concepts ic ON ic.id = di.concept_id
        WHERE di.dish_id = p_dish_id AND ic.is_vegetarian = false
      )
    UNION ALL
    -- vegan — every linked concept must be vegan
    SELECT 'vegan'::text AS code
    WHERE EXISTS (SELECT 1 FROM public.dish_ingredients WHERE dish_id = p_dish_id)
      AND NOT EXISTS (
        SELECT 1
        FROM public.dish_ingredients di
        JOIN public.ingredient_concepts ic ON ic.id = di.concept_id
        WHERE di.dish_id = p_dish_id AND ic.is_vegan = false
      )
  ),
  legacy_tags AS (
    -- Other dietary tags still sourced from the legacy junction (halal,
    -- kosher, etc.). Only picks up tags where every linked ingredient
    -- carries the tag — matches the prior "every ingredient" semantics.
    SELECT dt.code
    FROM public.dietary_tags dt
    WHERE dt.code NOT IN ('vegetarian', 'vegan')
      AND EXISTS (SELECT 1 FROM public.dish_ingredients WHERE dish_id = p_dish_id)
      AND NOT EXISTS (
        SELECT 1
        FROM public.dish_ingredients di
        WHERE di.dish_id = p_dish_id
          AND NOT EXISTS (
            SELECT 1
            FROM public.canonical_ingredient_dietary_tags cidt
            WHERE cidt.canonical_ingredient_id = di.ingredient_id
              AND cidt.dietary_tag_id = dt.id
          )
      )
  )
  SELECT coalesce(array_agg(DISTINCT code ORDER BY code), ARRAY[]::text[])
  FROM (
    SELECT code FROM concept_tags
    UNION
    SELECT code FROM legacy_tags
  ) all_tags;
$$;

-- ============================================================================
-- SECTION 3: Refresh every dish to apply the new computations
-- ============================================================================
-- The cascade trigger itself does not need changes — it still calls
-- refresh_dish_dietary, which now computes via the rewritten functions.
-- Walk every dish once so dishes.allergens / dietary_tags reflect the
-- new logic immediately.

DO $$
DECLARE
  r record;
BEGIN
  FOR r IN SELECT id FROM public.dishes LOOP
    PERFORM public.refresh_dish_dietary(r.id);
  END LOOP;
END;
$$;

COMMIT;
