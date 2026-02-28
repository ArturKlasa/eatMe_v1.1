-- Clean up user_preferences table
-- Created: 2026-02-26
-- Description:
--   1. Drop columns that belong in the app, not the database:
--        - last_prompt_shown_at       → now stored in AsyncStorage
--        - profile_completion_percentage → computed locally by updateProfileStats()
--        - profile_points             → computed locally; canonical ledger is user_points
--   2. Drop columns that are duplicates or replaced:
--        - diet_type       → duplicate of diet_preference (same CHECK constraint, same values)
--                            App now writes/reads diet_preference exclusively.
--        - default_price_min / default_price_max → USD-hardcoded integers, never
--                            written or read by the app; price range is session-only.
--        - default_price_range        → JSONB tier fallback, also never used after
--                            the currency-aware filterStore was introduced.
--   3. Fix the allergies column default that was accidentally changed to '[]'::jsonb
--      by migration 024, and normalise any rows that got the broken default.

-- ============================================================================
-- STEP 1: Drop the trigger and function that reference the columns being removed
-- ============================================================================

-- update_profile_stats() (migration 022) wrote to profile_completion_percentage
-- and profile_points. Both columns are being dropped; the trigger must go first
-- or the column drop will fail with "record NEW has no field ..." errors.
DROP TRIGGER IF EXISTS update_profile_stats_trigger ON public.user_preferences;
DROP FUNCTION IF EXISTS update_profile_stats() CASCADE;

-- These helper functions are also no longer needed (values computed in-app):
DROP FUNCTION IF EXISTS calculate_profile_completion(UUID);
DROP FUNCTION IF EXISTS calculate_profile_points(UUID);

-- ============================================================================
-- STEP 2: Drop dead columns
-- ============================================================================

ALTER TABLE public.user_preferences
  DROP COLUMN IF EXISTS last_prompt_shown_at,
  DROP COLUMN IF EXISTS profile_completion_percentage,
  DROP COLUMN IF EXISTS profile_points,
  DROP COLUMN IF EXISTS diet_type,
  DROP COLUMN IF EXISTS default_price_min,
  DROP COLUMN IF EXISTS default_price_max,
  DROP COLUMN IF EXISTS default_price_range;

-- ============================================================================
-- STEP 3: Fix the allergies column
-- ============================================================================

-- Reset allergies to the correct object format for all rows.
-- No production data exists, so we normalise everything unconditionally.
UPDATE public.user_preferences
SET allergies = '{
  "lactose": false,
  "gluten": false,
  "peanuts": false,
  "soy": false,
  "sesame": false,
  "shellfish": false,
  "nuts": false
}'::jsonb;

-- Restore the column default to the correct object format
ALTER TABLE public.user_preferences
  ALTER COLUMN allergies SET DEFAULT '{
    "lactose": false,
    "gluten": false,
    "peanuts": false,
    "soy": false,
    "sesame": false,
    "shellfish": false,
    "nuts": false
  }'::jsonb;

-- ============================================================================
-- SUCCESS MESSAGE
-- ============================================================================

DO $$
BEGIN
  RAISE NOTICE '========================================';
  RAISE NOTICE 'user_preferences cleanup complete';
  RAISE NOTICE '========================================';
  RAISE NOTICE 'Columns dropped:';
  RAISE NOTICE '  ✓ last_prompt_shown_at      (moved to AsyncStorage)';
  RAISE NOTICE '  ✓ profile_completion_percentage (computed locally)';
  RAISE NOTICE '  ✓ profile_points            (computed locally)';
  RAISE NOTICE '  ✓ diet_type                 (duplicate of diet_preference)';
  RAISE NOTICE '  ✓ default_price_min         (USD-hardcoded, unused)';
  RAISE NOTICE '  ✓ default_price_max         (USD-hardcoded, unused)';
  RAISE NOTICE '  ✓ default_price_range       (replaced by currency-aware filterStore)';
  RAISE NOTICE 'Column fixed:';
  RAISE NOTICE '  ✓ allergies default restored to object format';
  RAISE NOTICE '  ✓ existing array-format rows normalised to object format';
  RAISE NOTICE '========================================';
END $$;
