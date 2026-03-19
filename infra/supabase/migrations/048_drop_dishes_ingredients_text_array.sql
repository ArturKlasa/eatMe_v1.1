-- 048_drop_dishes_ingredients_text_array.sql
-- Created: 2026-03-18
--
-- Drops the legacy dishes.ingredients TEXT[] column.
-- All application code now uses the normalised dish_ingredients join table
-- (ingredient_id → canonical_ingredients). The TEXT[] column was a migration
-- artefact from before the canonical ingredient system existed.
--
-- Prerequisites:
--   - All writes to dishes.ingredients have been removed from application code
--     (restaurantService.ts, DishFormDialog.tsx, export.ts, validation.ts).
--   - Verify no dish has data in the TEXT[] that is NOT in dish_ingredients:
--       SELECT d.id, d.name, d.ingredients
--       FROM dishes d
--       WHERE d.ingredients IS NOT NULL
--         AND array_length(d.ingredients, 1) > 0
--         AND d.id NOT IN (SELECT DISTINCT dish_id FROM dish_ingredients);
--   - Result must be empty before running this migration.

ALTER TABLE dishes DROP COLUMN IF EXISTS ingredients;
