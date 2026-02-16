-- Fix Profile Completion Calculation Function
-- Created: 2026-02-16
-- Description: Fix array_length function calls to handle NULL arrays properly

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
    CASE WHEN protein_preferences IS NOT NULL AND array_length(protein_preferences, 1) > 0 THEN 15 ELSE 0 END +
    CASE WHEN favorite_cuisines IS NOT NULL AND array_length(favorite_cuisines, 1) >= 3 THEN 20 ELSE 
         CASE WHEN favorite_cuisines IS NOT NULL AND array_length(favorite_cuisines, 1) > 0 THEN 10 ELSE 0 END END +
    CASE WHEN favorite_dishes IS NOT NULL AND array_length(favorite_dishes, 1) >= 3 THEN 20 ELSE 
         CASE WHEN favorite_dishes IS NOT NULL AND array_length(favorite_dishes, 1) > 0 THEN 10 ELSE 0 END END +
    CASE WHEN spice_tolerance IS NOT NULL THEN 10 ELSE 0 END +
    
    -- Optional fields (5 points each = 20 points max)
    CASE WHEN allergies IS NOT NULL AND array_length(allergies, 1) > 0 THEN 5 ELSE 0 END +
    CASE WHEN default_price_min != 10 OR default_price_max != 50 THEN 5 ELSE 0 END +
    CASE WHEN meal_times IS NOT NULL AND array_length(meal_times, 1) > 0 THEN 5 ELSE 0 END +
    CASE WHEN dining_occasions IS NOT NULL AND array_length(dining_occasions, 1) > 0 THEN 5 ELSE 0 END
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
    CASE WHEN onboarding_completed THEN 50 ELSE 0 END +
    
    -- Detailed preferences (10 points each)
    CASE WHEN favorite_cuisines IS NOT NULL AND array_length(favorite_cuisines, 1) >= 5 THEN 10 ELSE 0 END +
    CASE WHEN favorite_dishes IS NOT NULL AND array_length(favorite_dishes, 1) >= 5 THEN 10 ELSE 0 END +
    CASE WHEN protein_preferences IS NOT NULL AND array_length(protein_preferences, 1) >= 2 THEN 10 ELSE 0 END +
    
    -- Optional fields (5 points each)
    CASE WHEN allergies IS NOT NULL AND array_length(allergies, 1) > 0 THEN 5 ELSE 0 END
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

-- ============================================================================
-- UPDATE TRIGGER FUNCTION
-- ============================================================================

CREATE OR REPLACE FUNCTION update_profile_stats()
RETURNS TRIGGER AS $$
BEGIN
  -- Calculate and update profile completion percentage
  NEW.profile_completion_percentage := calculate_profile_completion(NEW.user_id);
  
  -- Calculate and update profile points
  NEW.profile_points := calculate_profile_points(NEW.user_id);
  
  -- Update timestamp
  NEW.updated_at := NOW();
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Drop existing trigger if it exists
DROP TRIGGER IF EXISTS update_user_preferences_stats ON user_preferences;

-- Recreate trigger
CREATE TRIGGER update_user_preferences_stats
  BEFORE INSERT OR UPDATE ON user_preferences
  FOR EACH ROW
  EXECUTE FUNCTION update_profile_stats();

COMMENT ON FUNCTION calculate_profile_completion(UUID) IS 
  'Calculates profile completion percentage based on filled preferences (0-100)';

COMMENT ON FUNCTION calculate_profile_points(UUID) IS 
  'Calculates gamification points based on preference completeness';

COMMENT ON FUNCTION update_profile_stats() IS 
  'Trigger function to auto-update profile completion and points on preference changes';
