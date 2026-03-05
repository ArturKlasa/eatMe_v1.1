-- User Swipe Tracking System
-- Created: 2026-01-28
-- Description: Track every swipe action for behavior learning and recommendation improvement

-- ============================================================================
-- CREATE USER_SWIPES TABLE
-- ============================================================================

CREATE TABLE IF NOT EXISTS user_swipes (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  dish_id UUID REFERENCES dishes(id) ON DELETE CASCADE NOT NULL,
  action TEXT CHECK (action IN ('left', 'right', 'super')) NOT NULL,
  
  -- Engagement metrics
  view_duration INTEGER, -- milliseconds spent viewing this dish
  position_in_feed INTEGER, -- 1st, 2nd, 3rd dish shown in the feed
  session_id TEXT, -- Group swipes by session for analysis
  
  -- Context at time of swipe (for ML later)
  context JSONB DEFAULT '{}'::jsonb,
  
  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW()
);

COMMENT ON TABLE user_swipes IS 'Tracks every dish swipe action for behavior learning';
COMMENT ON COLUMN user_swipes.action IS 'left (dislike), right (like), super (strong like)';
COMMENT ON COLUMN user_swipes.view_duration IS 'Milliseconds user spent viewing before swiping';
COMMENT ON COLUMN user_swipes.position_in_feed IS 'Position in feed (1st, 2nd, 3rd, etc.)';
COMMENT ON COLUMN user_swipes.session_id IS 'Groups swipes in same browsing session';
COMMENT ON COLUMN user_swipes.context IS 'Additional context: time_of_day, filters_active, etc.';

-- ============================================================================
-- INDEXES FOR PERFORMANCE
-- ============================================================================

CREATE INDEX IF NOT EXISTS user_swipes_user_id_idx ON user_swipes(user_id);
CREATE INDEX IF NOT EXISTS user_swipes_dish_id_idx ON user_swipes(dish_id);
CREATE INDEX IF NOT EXISTS user_swipes_created_at_idx ON user_swipes(created_at DESC);
CREATE INDEX IF NOT EXISTS user_swipes_action_idx ON user_swipes(action);
CREATE INDEX IF NOT EXISTS user_swipes_session_idx ON user_swipes(session_id) WHERE session_id IS NOT NULL;

-- Composite index for user behavior analysis
CREATE INDEX IF NOT EXISTS user_swipes_user_action_created_idx 
ON user_swipes(user_id, action, created_at DESC);

-- ============================================================================
-- ROW LEVEL SECURITY
-- ============================================================================

ALTER TABLE user_swipes ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Users can insert their own swipes" ON user_swipes;
DROP POLICY IF EXISTS "Users can view their own swipes" ON user_swipes;
DROP POLICY IF EXISTS "Service role can manage all swipes" ON user_swipes;

-- Users can insert their own swipes
CREATE POLICY "Users can insert their own swipes"
ON user_swipes FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = user_id);

-- Users can view their own swipes
CREATE POLICY "Users can view their own swipes"
ON user_swipes FOR SELECT
TO authenticated
USING (auth.uid() = user_id);

-- Service role (Edge Functions) can read all swipes for analytics
CREATE POLICY "Service role can manage all swipes"
ON user_swipes FOR ALL
TO service_role
USING (true);

-- ============================================================================
-- HELPER FUNCTIONS
-- ============================================================================

-- Get user's swipe statistics
CREATE OR REPLACE FUNCTION get_user_swipe_stats(p_user_id UUID)
RETURNS TABLE(
  total_swipes BIGINT,
  right_swipes BIGINT,
  left_swipes BIGINT,
  super_swipes BIGINT,
  right_swipe_rate NUMERIC
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    COUNT(*)::BIGINT AS total_swipes,
    COUNT(*) FILTER (WHERE action = 'right')::BIGINT AS right_swipes,
    COUNT(*) FILTER (WHERE action = 'left')::BIGINT AS left_swipes,
    COUNT(*) FILTER (WHERE action = 'super')::BIGINT AS super_swipes,
    CASE 
      WHEN COUNT(*) > 0 THEN 
        ROUND((COUNT(*) FILTER (WHERE action = 'right')::NUMERIC / COUNT(*)::NUMERIC) * 100, 2)
      ELSE 0
    END AS right_swipe_rate
  FROM user_swipes
  WHERE user_id = p_user_id;
END;
$$ LANGUAGE plpgsql STABLE;

COMMENT ON FUNCTION get_user_swipe_stats IS 'Returns swipe statistics for a user';

-- Get most swiped dishes for a user (to find patterns)
CREATE OR REPLACE FUNCTION get_user_liked_dishes(p_user_id UUID, p_limit INTEGER DEFAULT 20)
RETURNS TABLE(
  dish_id UUID,
  dish_name TEXT,
  swipe_count BIGINT,
  last_swiped TIMESTAMPTZ
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    us.dish_id,
    d.name AS dish_name,
    COUNT(*)::BIGINT AS swipe_count,
    MAX(us.created_at) AS last_swiped
  FROM user_swipes us
  JOIN dishes d ON us.dish_id = d.id
  WHERE us.user_id = p_user_id
    AND us.action IN ('right', 'super')
  GROUP BY us.dish_id, d.name
  ORDER BY swipe_count DESC, last_swiped DESC
  LIMIT p_limit;
END;
$$ LANGUAGE plpgsql STABLE;

COMMENT ON FUNCTION get_user_liked_dishes IS 'Returns dishes the user has liked, ordered by frequency';

-- ============================================================================
-- SUCCESS MESSAGE
-- ============================================================================

DO $$ 
BEGIN
  RAISE NOTICE '========================================';
  RAISE NOTICE 'User Swipe Tracking System Installed!';
  RAISE NOTICE '========================================';
  RAISE NOTICE 'Tables Created:';
  RAISE NOTICE '  ✓ user_swipes - Tracks all swipe actions';
  RAISE NOTICE '';
  RAISE NOTICE 'Functions Available:';
  RAISE NOTICE '  ✓ get_user_swipe_stats(user_id)';
  RAISE NOTICE '  ✓ get_user_liked_dishes(user_id, limit)';
  RAISE NOTICE '';
  RAISE NOTICE 'Ready for Edge Function integration!';
  RAISE NOTICE '========================================';
END $$;
