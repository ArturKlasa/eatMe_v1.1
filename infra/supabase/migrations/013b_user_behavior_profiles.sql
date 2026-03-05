-- User Behavior Profiles
-- Created: 2026-01-28
-- Description: Aggregated user preferences learned from swipe behavior

-- ============================================================================
-- CREATE USER_BEHAVIOR_PROFILES TABLE
-- ============================================================================

CREATE TABLE IF NOT EXISTS user_behavior_profiles (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  
  -- Swipe statistics (updated from user_swipes)
  total_swipes INTEGER DEFAULT 0,
  right_swipes INTEGER DEFAULT 0,
  left_swipes INTEGER DEFAULT 0,
  super_swipes INTEGER DEFAULT 0,
  
  -- Calculated swipe rate (automatically computed)
  right_swipe_rate FLOAT GENERATED ALWAYS AS (
    CASE 
      WHEN total_swipes > 0 THEN right_swipes::float / total_swipes::float
      ELSE 0 
    END
  ) STORED,
  
  -- Learned preferences (arrays for flexibility)
  preferred_cuisines TEXT[] DEFAULT ARRAY[]::TEXT[],
  preferred_dish_types TEXT[] DEFAULT ARRAY[]::TEXT[],
  preferred_price_range FLOAT[2], -- [min, max] e.g., [10, 25]
  
  -- Nutritional preferences
  avg_calories_viewed INTEGER,
  preferred_dietary_tags TEXT[] DEFAULT ARRAY[]::TEXT[],
  
  -- Engagement patterns
  avg_view_duration INTEGER, -- milliseconds
  most_active_time_of_day TEXT, -- 'breakfast', 'lunch', 'dinner', 'latenight'
  
  -- Favorites (quick access)
  favorite_dish_ids UUID[] DEFAULT ARRAY[]::UUID[],
  
  -- Metadata
  last_active_at TIMESTAMPTZ DEFAULT NOW(),
  profile_updated_at TIMESTAMPTZ DEFAULT NOW(),
  profile_version INTEGER DEFAULT 1
);

COMMENT ON TABLE user_behavior_profiles IS 'Aggregated user preferences learned from behavior';
COMMENT ON COLUMN user_behavior_profiles.right_swipe_rate IS 'Automatically calculated: right_swipes / total_swipes';
COMMENT ON COLUMN user_behavior_profiles.preferred_cuisines IS 'Cuisines user swipes right on most';
COMMENT ON COLUMN user_behavior_profiles.preferred_price_range IS 'Price range [min, max] user prefers';
COMMENT ON COLUMN user_behavior_profiles.avg_view_duration IS 'Average milliseconds spent viewing dishes';
COMMENT ON COLUMN user_behavior_profiles.profile_version IS 'Increment when recommendation algorithm changes';

-- ============================================================================
-- INDEXES
-- ============================================================================

CREATE INDEX IF NOT EXISTS user_behavior_profiles_last_active_idx 
ON user_behavior_profiles(last_active_at DESC);

CREATE INDEX IF NOT EXISTS user_behavior_profiles_cuisines_idx 
ON user_behavior_profiles USING GIN(preferred_cuisines);

-- ============================================================================
-- ROW LEVEL SECURITY
-- ============================================================================

ALTER TABLE user_behavior_profiles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view their own profile" ON user_behavior_profiles;
DROP POLICY IF EXISTS "Users can update their own profile" ON user_behavior_profiles;
DROP POLICY IF EXISTS "Service role can manage all profiles" ON user_behavior_profiles;

-- Users can view their own profile
CREATE POLICY "Users can view their own profile"
ON user_behavior_profiles FOR SELECT
TO authenticated
USING (auth.uid() = user_id);

-- Users can update their own profile (for favorites)
CREATE POLICY "Users can update their own profile"
ON user_behavior_profiles FOR UPDATE
TO authenticated
USING (auth.uid() = user_id);

-- Service role (Edge Functions) can manage all profiles
CREATE POLICY "Service role can manage all profiles"
ON user_behavior_profiles FOR ALL
TO service_role
USING (true);

-- ============================================================================
-- TRIGGER: AUTO-UPDATE PROFILE FROM SWIPES
-- ============================================================================

CREATE OR REPLACE FUNCTION update_user_behavior_profile()
RETURNS TRIGGER AS $$
DECLARE
  v_total INTEGER;
  v_right INTEGER;
  v_left INTEGER;
  v_super INTEGER;
  v_avg_duration INTEGER;
BEGIN
  -- Aggregate swipe counts
  SELECT 
    COUNT(*)::INTEGER,
    COUNT(*) FILTER (WHERE action = 'right')::INTEGER,
    COUNT(*) FILTER (WHERE action = 'left')::INTEGER,
    COUNT(*) FILTER (WHERE action = 'super')::INTEGER,
    AVG(view_duration)::INTEGER
  INTO v_total, v_right, v_left, v_super, v_avg_duration
  FROM user_swipes
  WHERE user_id = NEW.user_id;

  -- Upsert behavior profile
  INSERT INTO user_behavior_profiles (
    user_id,
    total_swipes,
    right_swipes,
    left_swipes,
    super_swipes,
    avg_view_duration,
    last_active_at,
    profile_updated_at
  ) VALUES (
    NEW.user_id,
    v_total,
    v_right,
    v_left,
    v_super,
    v_avg_duration,
    NOW(),
    NOW()
  )
  ON CONFLICT (user_id) DO UPDATE SET
    total_swipes = v_total,
    right_swipes = v_right,
    left_swipes = v_left,
    super_swipes = v_super,
    avg_view_duration = v_avg_duration,
    last_active_at = NOW(),
    profile_updated_at = NOW();

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger fires after each swipe insert
DROP TRIGGER IF EXISTS trigger_update_behavior_profile ON user_swipes;
CREATE TRIGGER trigger_update_behavior_profile
AFTER INSERT ON user_swipes
FOR EACH ROW
EXECUTE FUNCTION update_user_behavior_profile();

COMMENT ON TRIGGER trigger_update_behavior_profile ON user_swipes IS 
  'Automatically updates user behavior profile after each swipe';

-- ============================================================================
-- HELPER FUNCTIONS
-- ============================================================================

-- Manually recalculate user profile (for batch updates)
CREATE OR REPLACE FUNCTION recalculate_user_profile(p_user_id UUID)
RETURNS VOID AS $$
DECLARE
  v_cuisines TEXT[];
  v_price_range FLOAT[2];
  v_avg_calories INTEGER;
  v_dietary_tags TEXT[];
BEGIN
  -- Find preferred cuisines (top 5 most swiped right)
  SELECT array_agg(cuisine ORDER BY swipe_count DESC)
  INTO v_cuisines
  FROM (
    SELECT r.cuisine, COUNT(*) AS swipe_count
    FROM user_swipes us
    JOIN dishes d ON us.dish_id = d.id
    JOIN restaurants r ON d.restaurant_id = r.id
    WHERE us.user_id = p_user_id
      AND us.action IN ('right', 'super')
    GROUP BY r.cuisine
    ORDER BY swipe_count DESC
    LIMIT 5
  ) t;

  -- Calculate preferred price range (25th to 75th percentile)
  SELECT 
    ARRAY[
      PERCENTILE_CONT(0.25) WITHIN GROUP (ORDER BY d.price),
      PERCENTILE_CONT(0.75) WITHIN GROUP (ORDER BY d.price)
    ]
  INTO v_price_range
  FROM user_swipes us
  JOIN dishes d ON us.dish_id = d.id
  WHERE us.user_id = p_user_id
    AND us.action IN ('right', 'super');

  -- Calculate average calories of liked dishes
  SELECT AVG(d.calories)::INTEGER
  INTO v_avg_calories
  FROM user_swipes us
  JOIN dishes d ON us.dish_id = d.id
  WHERE us.user_id = p_user_id
    AND us.action IN ('right', 'super')
    AND d.calories IS NOT NULL;

  -- Find preferred dietary tags
  SELECT array_agg(DISTINCT tag)
  INTO v_dietary_tags
  FROM user_swipes us
  JOIN dishes d ON us.dish_id = d.id
  CROSS JOIN LATERAL unnest(d.dietary_tags) AS tag
  WHERE us.user_id = p_user_id
    AND us.action IN ('right', 'super')
  LIMIT 10;

  -- Update profile
  UPDATE user_behavior_profiles
  SET 
    preferred_cuisines = COALESCE(v_cuisines, ARRAY[]::TEXT[]),
    preferred_price_range = v_price_range,
    avg_calories_viewed = v_avg_calories,
    preferred_dietary_tags = COALESCE(v_dietary_tags, ARRAY[]::TEXT[]),
    profile_updated_at = NOW()
  WHERE user_id = p_user_id;

END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION recalculate_user_profile IS 'Manually recalculate all user preferences from swipe history';

-- Recalculate all user profiles (for periodic batch jobs)
CREATE OR REPLACE FUNCTION recalculate_all_profiles()
RETURNS INTEGER AS $$
DECLARE
  v_count INTEGER := 0;
  v_user_id UUID;
BEGIN
  FOR v_user_id IN 
    SELECT DISTINCT user_id FROM user_swipes
  LOOP
    PERFORM recalculate_user_profile(v_user_id);
    v_count := v_count + 1;
  END LOOP;
  
  RETURN v_count;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION recalculate_all_profiles IS 'Recalculate all user profiles (use for batch updates)';

-- ============================================================================
-- SUCCESS MESSAGE
-- ============================================================================

DO $$ 
BEGIN
  RAISE NOTICE '========================================';
  RAISE NOTICE 'User Behavior Profiles Installed!';
  RAISE NOTICE '========================================';
  RAISE NOTICE 'Tables Created:';
  RAISE NOTICE '  ✓ user_behavior_profiles - Aggregated preferences';
  RAISE NOTICE '';
  RAISE NOTICE 'Auto-Update:';
  RAISE NOTICE '  ✓ Profile updates after each swipe (trigger)';
  RAISE NOTICE '';
  RAISE NOTICE 'Functions Available:';
  RAISE NOTICE '  ✓ recalculate_user_profile(user_id)';
  RAISE NOTICE '  ✓ recalculate_all_profiles()';
  RAISE NOTICE '';
  RAISE NOTICE 'Profile learns: cuisines, price range, calories, dietary tags';
  RAISE NOTICE '========================================';
END $$;
