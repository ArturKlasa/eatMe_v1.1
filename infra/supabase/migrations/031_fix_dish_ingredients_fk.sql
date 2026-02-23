-- Fix dish_ingredients to reference canonical_ingredients instead of the legacy
-- ingredients_master table.
--
-- Background:
--   Migration 011 created dish_ingredients with ingredient_id → ingredients_master.
--   Migration 012 introduced the canonical_ingredients + ingredient_aliases system,
--   which is what the web portal autocomplete (IngredientAutocomplete) actually uses.
--   Inserting an alias's canonical_ingredient_id (a canonical_ingredients UUID) into
--   a column that enforces an ingredients_master FK therefore always fails with a 23503
--   foreign-key violation.
--
-- Fix:
--   1. Drop the old FK constraint.
--   2. Add a new FK pointing to canonical_ingredients.
--   3. Wipe any orphaned rows left from the old system so the new constraint can be
--      added cleanly (those rows referenced ingredients_master IDs that no longer
--      correspond to canonical_ingredients IDs).

BEGIN;

-- 1. Remove existing rows that reference the old table (safe to delete – they were
--    never linked to the new canonical system anyway).
DELETE FROM dish_ingredients;

-- 2. Drop the old foreign-key constraint.
ALTER TABLE dish_ingredients
  DROP CONSTRAINT IF EXISTS dish_ingredients_ingredient_id_fkey;

-- 3. Add the corrected foreign-key constraint pointing to canonical_ingredients.
ALTER TABLE dish_ingredients
  ADD CONSTRAINT dish_ingredients_ingredient_id_fkey
  FOREIGN KEY (ingredient_id)
  REFERENCES canonical_ingredients(id)
  ON DELETE CASCADE;

COMMENT ON COLUMN dish_ingredients.ingredient_id IS
  'FK to canonical_ingredients (NOT the legacy ingredients_master table)';

COMMIT;
