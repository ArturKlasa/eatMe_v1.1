-- 106_dish_ingredients_concept_id_not_null.sql
-- Created: 2026-04-19
-- Phase 6A cutover — final step.
--
-- Enforces the invariant that every dish_ingredients row carries a
-- concept_id. Runs after:
--   - Migration 104 + 104b backfilled every existing row.
--   - All three writer paths (menu-scan confirm, admin dish form,
--     lib/ingredients.addDishIngredients, POST /api/ingredients mirror)
--     were updated in Phase 6A step 2 to always set concept_id on insert.
--
-- Safety: this migration will fail loudly if any row is still null,
-- surfacing a missed writer before it corrupts the dataset further.

-- PostgreSQL's SET NOT NULL verifies every row passes the constraint before
-- applying it — so if any row still has concept_id = NULL, this fails with
-- "column contains null values" and rolls back cleanly. Migrations 104 +
-- 104b backfilled everything, so this should succeed on first run.

ALTER TABLE public.dish_ingredients
  ALTER COLUMN concept_id SET NOT NULL;
