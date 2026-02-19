-- Fix array_length issues in profile completion functions
-- Created: 2026-02-16
-- Description: Convert TEXT[] columns to JSONB and use jsonb_array_length

-- ============================================================================
-- ALTER COLUMNS TO JSONB TYPE
-- ============================================================================

-- Drop default values first
ALTER TABLE user_preferences 
  ALTER COLUMN protein_preferences DROP DEFAULT,
  ALTER COLUMN allergies DROP DEFAULT,
  ALTER COLUMN favorite_cuisines DROP DEFAULT,
  ALTER COLUMN favorite_dishes DROP DEFAULT,
  ALTER COLUMN meal_times DROP DEFAULT,
  ALTER COLUMN dining_occasions DROP DEFAULT;

-- Convert array columns from TEXT[] to JSONB
ALTER TABLE user_preferences 
  ALTER COLUMN protein_preferences TYPE JSONB USING to_jsonb(protein_preferences),
  ALTER COLUMN allergies TYPE JSONB USING to_jsonb(allergies),
  ALTER COLUMN favorite_cuisines TYPE JSONB USING to_jsonb(favorite_cuisines),
  ALTER COLUMN favorite_dishes TYPE JSONB USING to_jsonb(favorite_dishes),
  ALTER COLUMN meal_times TYPE JSONB USING to_jsonb(meal_times),
  ALTER COLUMN dining_occasions TYPE JSONB USING to_jsonb(dining_occasions);

-- Set new JSONB defaults
ALTER TABLE user_preferences 
  ALTER COLUMN protein_preferences SET DEFAULT '[]'::jsonb,
  ALTER COLUMN allergies SET DEFAULT '[]'::jsonb,
  ALTER COLUMN favorite_cuisines SET DEFAULT '[]'::jsonb,
  ALTER COLUMN favorite_dishes SET DEFAULT '[]'::jsonb,
  ALTER COLUMN meal_times SET DEFAULT '[]'::jsonb,
  ALTER COLUMN dining_occasions SET DEFAULT '[]'::jsonb;

-- Update spice_tolerance default
ALTER TABLE user_preferences 
  ALTER COLUMN spice_tolerance DROP DEFAULT;

ALTER TABLE user_preferences 
  ALTER COLUMN spice_tolerance SET DEFAULT 'no';

-- Update existing spice_tolerance values to new format (including NULL)
-- Force update ALL rows to ensure consistency
UPDATE user_preferences 
SET spice_tolerance = 'no'
WHERE spice_tolerance IS NULL OR spice_tolerance NOT IN ('yes', 'no');

-- Update rows that should be 'yes'
UPDATE user_preferences 
SET spice_tolerance = 'yes'
WHERE spice_tolerance IN ('medium', 'spicy', 'very_spicy');

-- Verify all rows have valid values before adding constraint
DO $$
DECLARE
  invalid_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO invalid_count
  FROM user_preferences
  WHERE spice_tolerance NOT IN ('yes', 'no');
  
  IF invalid_count > 0 THEN
    RAISE EXCEPTION 'Still have % rows with invalid spice_tolerance values', invalid_count;
  END IF;
END $$;

-- Update spice_tolerance check constraint to new values
-- First, drop ALL constraints on the column to be safe
DO $$ 
DECLARE 
    r RECORD;
BEGIN
    FOR r IN (SELECT conname FROM pg_constraint 
              WHERE conrelid = 'user_preferences'::regclass 
              AND conname LIKE '%spice%') 
    LOOP
        EXECUTE 'ALTER TABLE user_preferences DROP CONSTRAINT IF EXISTS ' || quote_ident(r.conname);
    END LOOP;
END $$;

-- Now add the new constraint
ALTER TABLE user_preferences 
  ADD CONSTRAINT user_preferences_spice_tolerance_check 
  CHECK (spice_tolerance IN ('yes', 'no'));

-- ============================================================================
-- UPDATE FUNCTION TO CALCULATE PROFILE COMPLETION
-- ============================================================================

CREATE OR REPLACE FUNCTION calculate_profile_completion(
  p_user_id UUID
) RETURNS INTEGER AS $$
DECLARE
  completion_score INTEGER := 0;
BEGIN
  SELECT 
    -- Base fields (20 points each = 100 points total for core)
    CASE WHEN diet_type IS NOT NULL AND diet_type != 'all' THEN 15 ELSE 0 END +
    CASE WHEN protein_preferences IS NOT NULL AND jsonb_typeof(protein_preferences) = 'array' AND jsonb_array_length(protein_preferences) > 0 THEN 15 ELSE 0 END +
    CASE WHEN favorite_cuisines IS NOT NULL AND jsonb_typeof(favorite_cuisines) = 'array' AND jsonb_array_length(favorite_cuisines) >= 3 THEN 20 ELSE 
         CASE WHEN favorite_cuisines IS NOT NULL AND jsonb_typeof(favorite_cuisines) = 'array' AND jsonb_array_length(favorite_cuisines) > 0 THEN 10 ELSE 0 END END +
    CASE WHEN favorite_dishes IS NOT NULL AND jsonb_typeof(favorite_dishes) = 'array' AND jsonb_array_length(favorite_dishes) >= 3 THEN 20 ELSE 
         CASE WHEN favorite_dishes IS NOT NULL AND jsonb_typeof(favorite_dishes) = 'array' AND jsonb_array_length(favorite_dishes) > 0 THEN 10 ELSE 0 END END +
    CASE WHEN spice_tolerance IS NOT NULL THEN 10 ELSE 0 END +
    
    -- Optional fields (5 points each = 20 points max)
    CASE WHEN allergies IS NOT NULL AND jsonb_typeof(allergies) = 'array' AND jsonb_array_length(allergies) > 0 THEN 5 ELSE 0 END +
    CASE WHEN COALESCE(default_price_min, 10) != 10 OR COALESCE(default_price_max, 50) != 50 THEN 5 ELSE 0 END +
    CASE WHEN meal_times IS NOT NULL AND jsonb_typeof(meal_times) = 'array' AND jsonb_array_length(meal_times) > 0 THEN 5 ELSE 0 END +
    CASE WHEN dining_occasions IS NOT NULL AND jsonb_typeof(dining_occasions) = 'array' AND jsonb_array_length(dining_occasions) > 0 THEN 5 ELSE 0 END
  INTO completion_score
  FROM user_preferences
  WHERE user_id = p_user_id;
  
  -- If no record found, return 0
  IF completion_score IS NULL THEN
    completion_score := 0;
  END IF;
  
  -- Cap at 100
  RETURN LEAST(completion_score, 100);
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- UPDATE FUNCTION TO CALCULATE PROFILE POINTS
-- ============================================================================

CREATE OR REPLACE FUNCTION calculate_profile_points(
  p_user_id UUID
) RETURNS INTEGER AS $$
DECLARE
  points INTEGER := 0;
BEGIN
  SELECT 
    -- Core completion (50 points)
    CASE WHEN COALESCE(onboarding_completed, false) THEN 50 ELSE 0 END +
    
    -- Detailed preferences (10 points each)
    CASE WHEN favorite_cuisines IS NOT NULL AND jsonb_typeof(favorite_cuisines) = 'array' AND jsonb_array_length(favorite_cuisines) >= 5 THEN 10 ELSE 0 END +
    CASE WHEN favorite_dishes IS NOT NULL AND jsonb_typeof(favorite_dishes) = 'array' AND jsonb_array_length(favorite_dishes) >= 5 THEN 10 ELSE 0 END +
    CASE WHEN protein_preferences IS NOT NULL AND jsonb_typeof(protein_preferences) = 'array' AND jsonb_array_length(protein_preferences) >= 2 THEN 10 ELSE 0 END +
    
    -- Optional fields (5 points each)
    CASE WHEN allergies IS NOT NULL AND jsonb_typeof(allergies) = 'array' AND jsonb_array_length(allergies) > 0 THEN 5 ELSE 0 END +
    CASE WHEN meal_times IS NOT NULL AND jsonb_typeof(meal_times) = 'array' AND jsonb_array_length(meal_times) >= 2 THEN 5 ELSE 0 END +
    CASE WHEN dining_occasions IS NOT NULL AND jsonb_typeof(dining_occasions) = 'array' AND jsonb_array_length(dining_occasions) >= 2 THEN 5 ELSE 0 END +
    
    -- Engagement bonus
    CASE WHEN last_prompt_shown_at IS NOT NULL THEN 5 ELSE 0 END
  INTO points
  FROM user_preferences
  WHERE user_id = p_user_id;
  
  -- If no record found, return 0
  IF points IS NULL THEN
    points := 0;
  END IF;
  
  RETURN points;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION calculate_profile_completion IS 'Calculate user profile completion percentage (0-100) using jsonb_typeof and jsonb_array_length for safe JSONB array handling';
COMMENT ON FUNCTION calculate_profile_points IS 'Calculate gamification points based on profile completeness using jsonb_typeof and jsonb_array_length for safe JSONB array handling';
