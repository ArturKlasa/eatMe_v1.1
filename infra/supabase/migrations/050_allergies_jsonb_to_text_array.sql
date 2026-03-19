-- 050_allergies_jsonb_to_text_array.sql
-- Created: 2026-03-18
--
-- Migrates user_preferences.allergies from a JSONB boolean map
-- (e.g. {"soy": false, "nuts": true, "gluten": false}) to TEXT[]
-- (e.g. ["soybeans", "tree_nuts"]) containing only the ACTIVE allergen codes.
--
-- IMPORTANT: JSONB keys do NOT map 1:1 to allergens.code values:
--   "soy"  → "soybeans"  (DB code differs)
--   "nuts" → "tree_nuts" (DB code differs)
--   All others (gluten, sesame, lactose, peanuts, shellfish) match directly.
--
-- Codes in the resulting TEXT[] match the allergens.code column (all lowercase),
-- so dishes.allergens && user_preferences.allergies array-overlap works correctly.

-- PostgreSQL does not allow subqueries in ALTER COLUMN ... USING.
-- Pattern: add new TEXT[] column → populate via UPDATE → drop old JSONB → rename.

-- Step 1: Add the replacement column.
ALTER TABLE user_preferences ADD COLUMN allergies_new TEXT[] DEFAULT '{}';

-- Step 2: Populate with active allergen codes, applying the key→code mapping.
UPDATE user_preferences
SET allergies_new = (
  SELECT COALESCE(
    array_agg(
      CASE key
        WHEN 'soy'  THEN 'soybeans'   -- filterStore key differs from allergens.code
        WHEN 'nuts' THEN 'tree_nuts'  -- filterStore key differs from allergens.code
        ELSE key                      -- gluten, sesame, lactose, peanuts, shellfish match
      END
    ),
    '{}'::TEXT[]
  )
  FROM jsonb_each_text(COALESCE(allergies, '{}'::jsonb))
  WHERE value = 'true'
);

-- Step 3: Swap columns.
ALTER TABLE user_preferences DROP COLUMN allergies;
ALTER TABLE user_preferences RENAME COLUMN allergies_new TO allergies;
