-- 047a_fix_allergen_trigger_functions.sql
-- Created: 2026-03-18
--
-- FIX: calculate_dish_allergens and calculate_dish_dietary_tags were joining
-- dish_ingredients.ingredient_id against ingredient_allergens.ingredient_id,
-- which references ingredients_master.id — a different FK domain.
-- dish_ingredients.ingredient_id actually references canonical_ingredients.id,
-- so the join was silently producing empty results for all dishes.
--
-- This migration rewrites both functions to use the canonical tables and
-- backfills allergens/dietary_tags for all existing dishes.
-- Run this BEFORE 047b (which drops ingredients_master).

-- ============================================================================
-- REWRITE calculate_dish_allergens
-- ============================================================================

CREATE OR REPLACE FUNCTION calculate_dish_allergens(p_dish_id UUID)
RETURNS TEXT[] AS $$
DECLARE
  allergen_codes TEXT[];
BEGIN
  SELECT array_agg(DISTINCT a.code ORDER BY a.code)
  INTO allergen_codes
  FROM dish_ingredients di
  JOIN canonical_ingredient_allergens cia ON di.ingredient_id = cia.canonical_ingredient_id
  JOIN allergens a ON cia.allergen_id = a.id
  WHERE di.dish_id = p_dish_id;

  RETURN COALESCE(allergen_codes, ARRAY[]::TEXT[]);
END;
$$ LANGUAGE plpgsql STABLE;

COMMENT ON FUNCTION calculate_dish_allergens IS
  'Calculates allergen codes for a dish from its canonical ingredient links.
   Codes match allergens.code (all lowercase, e.g. "milk", "tree_nuts").';

-- ============================================================================
-- REWRITE calculate_dish_dietary_tags
-- ============================================================================

CREATE OR REPLACE FUNCTION calculate_dish_dietary_tags(p_dish_id UUID)
RETURNS TEXT[] AS $$
DECLARE
  dietary_tag_codes TEXT[];
  total_ingredients INTEGER;
BEGIN
  SELECT COUNT(*) INTO total_ingredients
  FROM dish_ingredients
  WHERE dish_id = p_dish_id;

  IF total_ingredients = 0 THEN
    RETURN ARRAY[]::TEXT[];
  END IF;

  -- A dietary tag is assigned only when ALL ingredients carry it.
  SELECT array_agg(DISTINCT dt.code ORDER BY dt.code)
  INTO dietary_tag_codes
  FROM dietary_tags dt
  WHERE dt.id IN (
    SELECT cidt.dietary_tag_id
    FROM canonical_ingredient_dietary_tags cidt
    WHERE cidt.canonical_ingredient_id IN (
      SELECT di.ingredient_id FROM dish_ingredients di WHERE di.dish_id = p_dish_id
    )
    GROUP BY cidt.dietary_tag_id
    HAVING COUNT(DISTINCT cidt.canonical_ingredient_id) = total_ingredients
  );

  RETURN COALESCE(dietary_tag_codes, ARRAY[]::TEXT[]);
END;
$$ LANGUAGE plpgsql STABLE;

COMMENT ON FUNCTION calculate_dish_dietary_tags IS
  'Calculates dietary tag codes for a dish. A tag is included only when
   every canonical ingredient in the dish carries that tag.';

-- ============================================================================
-- BACKFILL: update all dishes that have canonical ingredient links
-- ============================================================================

UPDATE dishes
SET
  allergens    = calculate_dish_allergens(id),
  dietary_tags = calculate_dish_dietary_tags(id)
WHERE id IN (SELECT DISTINCT dish_id FROM dish_ingredients);

-- Log the backfill result for visibility in migration output
DO $$
DECLARE
  updated_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO updated_count
  FROM dishes
  WHERE id IN (SELECT DISTINCT dish_id FROM dish_ingredients);
  RAISE NOTICE 'Backfilled allergens/dietary_tags for % dishes', updated_count;
END $$;
