-- User Preferences and Onboarding System
-- Created: 2026-02-14
-- Description: Store user food preferences for personalized recommendations

-- ============================================================================
-- CREATE USER_PREFERENCES TABLE
-- ============================================================================

CREATE TABLE IF NOT EXISTS user_preferences (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE UNIQUE,
  
  -- Timestamps (always present)
  preferences_updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Add columns if they don't exist (safe to run multiple times)
DO $$ 
BEGIN
  -- Dietary Preferences
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                 WHERE table_name='user_preferences' AND column_name='diet_type') THEN
    ALTER TABLE user_preferences ADD COLUMN diet_type TEXT DEFAULT 'all' CHECK (diet_type IN ('all', 'vegetarian', 'vegan'));
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                 WHERE table_name='user_preferences' AND column_name='protein_preferences') THEN
    ALTER TABLE user_preferences ADD COLUMN protein_preferences TEXT[] DEFAULT ARRAY[]::TEXT[];
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                 WHERE table_name='user_preferences' AND column_name='allergies') THEN
    ALTER TABLE user_preferences ADD COLUMN allergies TEXT[] DEFAULT ARRAY[]::TEXT[];
  END IF;

  -- Food Preferences
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                 WHERE table_name='user_preferences' AND column_name='favorite_cuisines') THEN
    ALTER TABLE user_preferences ADD COLUMN favorite_cuisines TEXT[] DEFAULT ARRAY[]::TEXT[];
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                 WHERE table_name='user_preferences' AND column_name='favorite_dishes') THEN
    ALTER TABLE user_preferences ADD COLUMN favorite_dishes TEXT[] DEFAULT ARRAY[]::TEXT[];
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                 WHERE table_name='user_preferences' AND column_name='spice_tolerance') THEN
    ALTER TABLE user_preferences ADD COLUMN spice_tolerance TEXT DEFAULT 'medium' CHECK (spice_tolerance IN ('none', 'mild', 'medium', 'spicy', 'very_spicy'));
  END IF;

  -- Budget Preferences
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                 WHERE table_name='user_preferences' AND column_name='default_price_min') THEN
    ALTER TABLE user_preferences ADD COLUMN default_price_min INTEGER DEFAULT 10;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                 WHERE table_name='user_preferences' AND column_name='default_price_max') THEN
    ALTER TABLE user_preferences ADD COLUMN default_price_max INTEGER DEFAULT 50;
  END IF;

  -- Dining Context
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                 WHERE table_name='user_preferences' AND column_name='service_preferences') THEN
    ALTER TABLE user_preferences ADD COLUMN service_preferences JSONB DEFAULT '{"dine_in": true, "takeout": true, "delivery": true}'::jsonb;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                 WHERE table_name='user_preferences' AND column_name='meal_times') THEN
    ALTER TABLE user_preferences ADD COLUMN meal_times TEXT[] DEFAULT ARRAY[]::TEXT[];
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                 WHERE table_name='user_preferences' AND column_name='dining_occasions') THEN
    ALTER TABLE user_preferences ADD COLUMN dining_occasions TEXT[] DEFAULT ARRAY[]::TEXT[];
  END IF;

  -- Onboarding & Gamification
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                 WHERE table_name='user_preferences' AND column_name='onboarding_completed') THEN
    ALTER TABLE user_preferences ADD COLUMN onboarding_completed BOOLEAN DEFAULT FALSE;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                 WHERE table_name='user_preferences' AND column_name='onboarding_completed_at') THEN
    ALTER TABLE user_preferences ADD COLUMN onboarding_completed_at TIMESTAMP WITH TIME ZONE;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                 WHERE table_name='user_preferences' AND column_name='profile_completion_percentage') THEN
    ALTER TABLE user_preferences ADD COLUMN profile_completion_percentage INTEGER DEFAULT 0;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                 WHERE table_name='user_preferences' AND column_name='profile_points') THEN
    ALTER TABLE user_preferences ADD COLUMN profile_points INTEGER DEFAULT 0;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                 WHERE table_name='user_preferences' AND column_name='last_prompt_shown_at') THEN
    ALTER TABLE user_preferences ADD COLUMN last_prompt_shown_at TIMESTAMP WITH TIME ZONE;
  END IF;
END $$;

-- ============================================================================
-- CREATE INDEXES
-- ============================================================================

CREATE INDEX IF NOT EXISTS user_preferences_user_id_idx ON user_preferences(user_id);
CREATE INDEX IF NOT EXISTS user_preferences_onboarding_completed_idx ON user_preferences(onboarding_completed);
CREATE INDEX IF NOT EXISTS user_preferences_profile_completion_idx ON user_preferences(profile_completion_percentage);

-- ============================================================================
-- ROW LEVEL SECURITY
-- ============================================================================

ALTER TABLE user_preferences ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Users can read own preferences" ON user_preferences;
DROP POLICY IF EXISTS "Users can insert own preferences" ON user_preferences;
DROP POLICY IF EXISTS "Users can update own preferences" ON user_preferences;
DROP POLICY IF EXISTS "Users can delete own preferences" ON user_preferences;

-- Users can read their own preferences
CREATE POLICY "Users can read own preferences" 
  ON user_preferences 
  FOR SELECT 
  USING (auth.uid() = user_id);

-- Users can insert their own preferences
CREATE POLICY "Users can insert own preferences" 
  ON user_preferences 
  FOR INSERT 
  WITH CHECK (auth.uid() = user_id);

-- Users can update their own preferences
CREATE POLICY "Users can update own preferences" 
  ON user_preferences 
  FOR UPDATE 
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Users can delete their own preferences
CREATE POLICY "Users can delete own preferences" 
  ON user_preferences 
  FOR DELETE 
  USING (auth.uid() = user_id);

-- ============================================================================
-- FUNCTION TO CALCULATE PROFILE COMPLETION
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
    CASE WHEN array_length(protein_preferences, 1) > 0 THEN 15 ELSE 0 END +
    CASE WHEN array_length(favorite_cuisines, 1) >= 3 THEN 20 ELSE 
         CASE WHEN array_length(favorite_cuisines, 1) > 0 THEN 10 ELSE 0 END END +
    CASE WHEN array_length(favorite_dishes, 1) >= 3 THEN 20 ELSE 
         CASE WHEN array_length(favorite_dishes, 1) > 0 THEN 10 ELSE 0 END END +
    CASE WHEN spice_tolerance IS NOT NULL THEN 10 ELSE 0 END +
    
    -- Optional fields (5 points each = 20 points max)
    CASE WHEN array_length(allergies, 1) > 0 THEN 5 ELSE 0 END +
    CASE WHEN default_price_min != 10 OR default_price_max != 50 THEN 5 ELSE 0 END +
    CASE WHEN array_length(meal_times, 1) > 0 THEN 5 ELSE 0 END +
    CASE WHEN array_length(dining_occasions, 1) > 0 THEN 5 ELSE 0 END
  INTO completion_score
  FROM user_preferences
  WHERE user_id = p_user_id;
  
  -- Cap at 100
  RETURN LEAST(completion_score, 100);
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- FUNCTION TO CALCULATE PROFILE POINTS
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
    CASE WHEN array_length(favorite_cuisines, 1) >= 5 THEN 10 ELSE 0 END +
    CASE WHEN array_length(favorite_dishes, 1) >= 5 THEN 10 ELSE 0 END +
    CASE WHEN array_length(protein_preferences, 1) >= 2 THEN 10 ELSE 0 END +
    
    -- Optional but valuable (5 points each)
    CASE WHEN array_length(allergies, 1) > 0 THEN 5 ELSE 0 END +
    CASE WHEN array_length(meal_times, 1) >= 2 THEN 5 ELSE 0 END +
    CASE WHEN array_length(dining_occasions, 1) >= 2 THEN 5 ELSE 0 END +
    
    -- Engagement bonus (5 points)
    CASE WHEN preferences_updated_at > NOW() - INTERVAL '30 days' THEN 5 ELSE 0 END
  INTO points
  FROM user_preferences
  WHERE user_id = p_user_id;
  
  RETURN COALESCE(points, 0);
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- TRIGGER TO AUTO-UPDATE COMPLETION AND POINTS
-- ============================================================================

CREATE OR REPLACE FUNCTION update_profile_stats()
RETURNS TRIGGER AS $$
BEGIN
  NEW.profile_completion_percentage := calculate_profile_completion(NEW.user_id);
  NEW.profile_points := calculate_profile_points(NEW.user_id);
  NEW.updated_at := NOW();
  NEW.preferences_updated_at := NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS update_profile_stats_trigger ON user_preferences;

CREATE TRIGGER update_profile_stats_trigger
  BEFORE INSERT OR UPDATE ON user_preferences
  FOR EACH ROW
  EXECUTE FUNCTION update_profile_stats();

-- ============================================================================
-- FUNCTION TO AUTO-CREATE PREFERENCES ON USER SIGNUP
-- ============================================================================

CREATE OR REPLACE FUNCTION create_user_preferences_on_signup()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO user_preferences (user_id)
  VALUES (NEW.id)
  ON CONFLICT (user_id) DO NOTHING;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS create_user_preferences_trigger ON auth.users;

CREATE TRIGGER create_user_preferences_trigger
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION create_user_preferences_on_signup();

-- ============================================================================
-- SUCCESS MESSAGE
-- ============================================================================

DO $$ 
BEGIN
  RAISE NOTICE '========================================';
  RAISE NOTICE 'User preferences system created successfully';
  RAISE NOTICE 'Features:';
  RAISE NOTICE '- User preferences storage';
  RAISE NOTICE '- Profile completion percentage (0-100)';
  RAISE NOTICE '- Gamification points system';
  RAISE NOTICE '- Auto-calculation triggers';
  RAISE NOTICE '- RLS policies enabled';
  RAISE NOTICE '========================================';
END $$;