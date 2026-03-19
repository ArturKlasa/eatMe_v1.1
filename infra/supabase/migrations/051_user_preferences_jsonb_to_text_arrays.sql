-- 051_user_preferences_jsonb_to_text_arrays.sql
-- Created: 2026-03-18
--
-- Migrates the remaining JSONB boolean-map columns on user_preferences to TEXT[].
-- Applies the same pattern as 050 (allergies) consistently.
--
-- Columns migrated:
--   exclude                — exclusion intents, mapped to closest dietary_tag codes
--   diet_types             — dietary preference tags (lowCarb → low_carb)
--   religious_restrictions — religious dietary codes (keys match dietary_tags.code)
--
-- Code mapping notes:
--   exclude:
--     noMeat    → 'vegetarian'   (intent: exclude meat → vegetarian dishes)
--     noDairy   → 'dairy_free'
--     noEggs    → 'no_eggs'      (no standard dietary_tag yet; stored as-is for future use)
--     noFish    → 'no_fish'
--     noSeafood → 'no_seafood'
--     noSpicy   → 'no_spicy'
--   diet_types:
--     lowCarb   → 'low_carb'     (camelCase → snake_case to match dietary_tags.code)
--     all others (keto, paleo, diabetic, pescatarian) match after lowercase
--   religious_restrictions:
--     all keys (halal, kosher, hindu, jain, buddhist) match dietary_tags.code directly

-- ── exclude → TEXT[] ──────────────────────────────────────────────────────────

ALTER TABLE user_preferences
  ALTER COLUMN exclude TYPE TEXT[]
    USING (
      SELECT COALESCE(
        array_agg(
          CASE key
            WHEN 'noMeat'    THEN 'vegetarian'
            WHEN 'noDairy'   THEN 'dairy_free'
            WHEN 'noEggs'    THEN 'no_eggs'
            WHEN 'noFish'    THEN 'no_fish'
            WHEN 'noSeafood' THEN 'no_seafood'
            WHEN 'noSpicy'   THEN 'no_spicy'
            ELSE lower(key)
          END
        ),
        '{}'::TEXT[]
      )
      FROM jsonb_each_text(COALESCE(exclude, '{}'::jsonb))
      WHERE value = 'true'
    );

ALTER TABLE user_preferences
  ALTER COLUMN exclude SET DEFAULT '{}';

-- ── diet_types → TEXT[] ───────────────────────────────────────────────────────

ALTER TABLE user_preferences
  ALTER COLUMN diet_types TYPE TEXT[]
    USING (
      SELECT COALESCE(
        array_agg(
          CASE key
            WHEN 'lowCarb' THEN 'low_carb'  -- camelCase → snake_case
            ELSE lower(key)                  -- keto, paleo, diabetic, pescatarian
          END
        ),
        '{}'::TEXT[]
      )
      FROM jsonb_each_text(COALESCE(diet_types, '{}'::jsonb))
      WHERE value = 'true'
    );

ALTER TABLE user_preferences
  ALTER COLUMN diet_types SET DEFAULT '{}';

-- ── religious_restrictions → TEXT[] ──────────────────────────────────────────

ALTER TABLE user_preferences
  ALTER COLUMN religious_restrictions TYPE TEXT[]
    USING (
      SELECT COALESCE(
        array_agg(lower(key)),  -- halal, kosher, hindu, jain, buddhist match dietary_tags.code
        '{}'::TEXT[]
      )
      FROM jsonb_each_text(COALESCE(religious_restrictions, '{}'::jsonb))
      WHERE value = 'true'
    );

ALTER TABLE user_preferences
  ALTER COLUMN religious_restrictions SET DEFAULT '{}';
