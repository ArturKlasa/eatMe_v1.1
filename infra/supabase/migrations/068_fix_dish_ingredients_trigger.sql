-- 068_fix_dish_ingredients_trigger.sql
-- Created: 2026-03-22
--
-- ROOT CAUSE FIX: The dish_ingredients_update_attributes trigger called
-- update_dish_attributes(), which recalculated BOTH allergens AND dietary_tags.
--
-- This caused: every time DishFormDialog saved a dish and then ran its
-- dish_ingredients DELETE (to sync the junction table), the trigger fired and
-- called calculate_dish_dietary_tags(). With 0 ingredients, that function
-- returns ARRAY[]::TEXT[] and overwrites whatever dietary_tags the user just
-- saved. Result: dietary_tags always ends up empty after editing a dish.
--
-- Fix: rewrite update_dish_attributes() to update ONLY allergens.
-- dietary_tags are user-managed labels set in the form UI and must never be
-- auto-calculated from ingredient links.

CREATE OR REPLACE FUNCTION update_dish_attributes()
RETURNS TRIGGER AS $$
DECLARE
  v_dish_id UUID;
BEGIN
  v_dish_id := COALESCE(NEW.dish_id, OLD.dish_id);

  UPDATE dishes
  SET allergens = calculate_dish_allergens(v_dish_id)
  WHERE id = v_dish_id;

  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = extensions, public;
