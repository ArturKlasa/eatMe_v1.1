-- 047b_drop_ingredients_master.sql
-- Created: 2026-03-18
--
-- Drops the legacy ingredients_master system (table + its two junction tables).
-- All live application code uses canonical_ingredients instead.
-- The allergen/dietary trigger functions were rewritten in 047a to use the
-- canonical tables, so dropping these does not break any active functionality.
--
-- Prerequisites: 047a must be applied and verified first.
--
-- Drop order respects FK dependencies:
--   ingredient_dietary_tags → ingredients_master
--   ingredient_allergens    → ingredients_master
--   ingredients_master      (no outbound FKs remaining after above)

DROP TABLE IF EXISTS ingredient_dietary_tags;
DROP TABLE IF EXISTS ingredient_allergens;
DROP TABLE IF EXISTS ingredients_master;
