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

ALTER TABLE user_preferences
  ALTER COLUMN allergies TYPE TEXT[]
    USING (
      SELECT COALESCE(
        array_agg(
          CASE key
            WHEN 'soy'  THEN 'soybeans'   -- JSONB key differs from allergens.code
            WHEN 'nuts' THEN 'tree_nuts'  -- JSONB key differs from allergens.code
            ELSE key                      -- gluten, sesame, lactose, peanuts, shellfish match
          END
        ),
        '{}'::TEXT[]
      )
      FROM jsonb_each_text(COALESCE(allergies, '{}'::jsonb))
      WHERE value = 'true'
    );

ALTER TABLE user_preferences
  ALTER COLUMN allergies SET DEFAULT '{}';
