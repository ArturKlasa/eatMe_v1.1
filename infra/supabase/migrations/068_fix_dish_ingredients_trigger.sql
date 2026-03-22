-- 068_fix_dish_ingredients_trigger.sql
-- Created: 2026-03-22
--
-- ROOT CAUSE FIX: The dish_ingredients_update_attributes trigger called
-- update_dish_attributes(), which recalculated BOTH allergens AND dietary_tags
-- after every INSERT/UPDATE/DELETE on dish_ingredients, silently overwriting
-- whatever the form had just saved.
--
-- Both allergens and dietary_tags are user-managed labels set via checkboxes
-- in DishFormDialog. The ingredient-based allergen calculation (calculate_dish_allergens)
-- is display-only in the UI (AllergenWarnings component) and is never merged back
-- into the form's allergens field.
--
-- Fix: make update_dish_attributes() a no-op. The trigger definition stays in place
-- but no longer overwrites dish columns when ingredients change.

CREATE OR REPLACE FUNCTION update_dish_attributes()
RETURNS TRIGGER AS $$
BEGIN
  -- allergens and dietary_tags are user-managed via the form UI.
  -- They must not be auto-calculated from ingredient links.
  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = extensions, public;
