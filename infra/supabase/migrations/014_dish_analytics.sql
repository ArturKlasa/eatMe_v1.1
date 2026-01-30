-- Dish Analytics for Popularity Scoring
-- Created: 2026-01-28
-- Description: Track dish popularity metrics for recommendation scoring

-- ============================================================================
-- CREATE DISH_ANALYTICS TABLE
-- ============================================================================

CREATE TABLE IF NOT EXISTS dish_analytics (
  dish_id UUID PRIMARY KEY REFERENCES dishes(id) ON DELETE CASCADE,
  
  -- Engagement metrics (from swipes)
  view_count INTEGER DEFAULT 0,
  right_swipe_count INTEGER DEFAULT 0,
  left_swipe_count INTEGER DEFAULT 0,
  super_like_count INTEGER DEFAULT 0,
  
  -- Conversion metrics (will add when orders are implemented)
  favorite_count INTEGER DEFAULT 0,
  order_count INTEGER DEFAULT 0,
  
  -- Calculated scores (auto-updated)
  engagement_rate FLOAT,
  popularity_score FLOAT,
  
  -- Trending detection
  recent_views_24h INTEGER DEFAULT 0,
  recent_swipes_24h INTEGER DEFAULT 0,
  is_trending BOOLEAN DEFAULT false,
  
  -- Metadata
  last_updated_at TIMESTAMPTZ DEFAULT NOW(),
  first_tracked_at TIMESTAMPTZ DEFAULT NOW()
);

COMMENT ON TABLE dish_analytics IS 'Popularity metrics for dish recommendation scoring';
COMMENT ON COLUMN dish_analytics.engagement_rate IS 'right_swipes / (right_swipes + left_swipes)';
COMMENT ON COLUMN dish_analytics.popularity_score IS 'Weighted score: views + right_swipes * 2 + super_likes * 5';
COMMENT ON COLUMN dish_analytics.is_trending IS 'True if dish has high recent activity';

-- ============================================================================
-- INDEXES
-- ============================================================================

CREATE INDEX IF NOT EXISTS dish_analytics_popularity_idx 
ON dish_analytics(popularity_score DESC NULLS LAST);

CREATE INDEX IF NOT EXISTS dish_analytics_trending_idx 
ON dish_analytics(is_trending, recent_swipes_24h DESC) WHERE is_trending = true;

CREATE INDEX IF NOT EXISTS dish_analytics_last_updated_idx 
ON dish_analytics(last_updated_at DESC);

-- ============================================================================
-- ROW LEVEL SECURITY
-- ============================================================================

ALTER TABLE dish_analytics ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Anyone can read dish analytics" ON dish_analytics;
DROP POLICY IF EXISTS "Service role can manage analytics" ON dish_analytics;

-- Public read access (for displaying popularity)
CREATE POLICY "Anyone can read dish analytics"
ON dish_analytics FOR SELECT
TO public
USING (true);

-- Service role (Edge Functions) can write
CREATE POLICY "Service role can manage analytics"
ON dish_analytics FOR ALL
TO service_role
USING (true);

-- ============================================================================
-- TRIGGER: AUTO-UPDATE ANALYTICS FROM SWIPES
-- ============================================================================

CREATE OR REPLACE FUNCTION update_dish_analytics()
RETURNS TRIGGER AS $$
DECLARE
  v_views INTEGER;
  v_rights INTEGER;
  v_lefts INTEGER;
  v_supers INTEGER;
  v_engagement FLOAT;
  v_popularity FLOAT;
BEGIN
  -- Aggregate metrics for this dish
  SELECT 
    COUNT(*)::INTEGER,
    COUNT(*) FILTER (WHERE action = 'right')::INTEGER,
    COUNT(*) FILTER (WHERE action = 'left')::INTEGER,
    COUNT(*) FILTER (WHERE action = 'super')::INTEGER
  INTO v_views, v_rights, v_lefts, v_supers
  FROM user_swipes
  WHERE dish_id = NEW.dish_id;

  -- Calculate engagement rate
  IF (v_rights + v_lefts) > 0 THEN
    v_engagement := v_rights::FLOAT / (v_rights + v_lefts)::FLOAT;
  ELSE
    v_engagement := 0;
  END IF;

  -- Calculate popularity score (weighted formula)
  -- views * 1 + right_swipes * 2 + super_likes * 5
  v_popularity := v_views + (v_rights * 2) + (v_supers * 5);

  -- Upsert analytics
  INSERT INTO dish_analytics (
    dish_id,
    view_count,
    right_swipe_count,
    left_swipe_count,
    super_like_count,
    engagement_rate,
    popularity_score,
    last_updated_at
  ) VALUES (
    NEW.dish_id,
    v_views,
    v_rights,
    v_lefts,
    v_supers,
    v_engagement,
    v_popularity,
    NOW()
  )
  ON CONFLICT (dish_id) DO UPDATE SET
    view_count = v_views,
    right_swipe_count = v_rights,
    left_swipe_count = v_lefts,
    super_like_count = v_supers,
    engagement_rate = v_engagement,
    popularity_score = v_popularity,
    last_updated_at = NOW();

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger fires after each swipe
DROP TRIGGER IF EXISTS trigger_update_dish_analytics ON user_swipes;
CREATE TRIGGER trigger_update_dish_analytics
AFTER INSERT ON user_swipes
FOR EACH ROW
EXECUTE FUNCTION update_dish_analytics();

COMMENT ON TRIGGER trigger_update_dish_analytics ON user_swipes IS 
  'Automatically updates dish analytics after each swipe';

-- ============================================================================
-- HELPER FUNCTIONS
-- ============================================================================

-- Get top trending dishes (high recent activity)
CREATE OR REPLACE FUNCTION get_trending_dishes(p_limit INTEGER DEFAULT 20)
RETURNS TABLE(
  dish_id UUID,
  dish_name TEXT,
  restaurant_name TEXT,
  popularity_score FLOAT,
  recent_swipes_24h INTEGER,
  engagement_rate FLOAT
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    da.dish_id,
    d.name AS dish_name,
    r.name AS restaurant_name,
    da.popularity_score,
    da.recent_swipes_24h,
    da.engagement_rate
  FROM dish_analytics da
  JOIN dishes d ON da.dish_id = d.id
  JOIN restaurants r ON d.restaurant_id = r.id
  WHERE da.is_trending = true
  ORDER BY da.recent_swipes_24h DESC, da.popularity_score DESC
  LIMIT p_limit;
END;
$$ LANGUAGE plpgsql STABLE;

COMMENT ON FUNCTION get_trending_dishes IS 'Returns currently trending dishes with high recent activity';

-- Get most popular dishes overall
CREATE OR REPLACE FUNCTION get_popular_dishes(p_limit INTEGER DEFAULT 50)
RETURNS TABLE(
  dish_id UUID,
  dish_name TEXT,
  restaurant_name TEXT,
  popularity_score FLOAT,
  engagement_rate FLOAT,
  view_count INTEGER
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    da.dish_id,
    d.name AS dish_name,
    r.name AS restaurant_name,
    da.popularity_score,
    da.engagement_rate,
    da.view_count
  FROM dish_analytics da
  JOIN dishes d ON da.dish_id = d.id
  JOIN restaurants r ON d.restaurant_id = r.id
  WHERE da.view_count > 10 -- Filter out dishes with too few views
  ORDER BY da.popularity_score DESC
  LIMIT p_limit;
END;
$$ LANGUAGE plpgsql STABLE;

COMMENT ON FUNCTION get_popular_dishes IS 'Returns most popular dishes by popularity score';

-- Update trending status (run periodically, e.g., every hour)
CREATE OR REPLACE FUNCTION update_trending_dishes()
RETURNS INTEGER AS $$
DECLARE
  v_count INTEGER := 0;
  v_threshold INTEGER;
BEGIN
  -- Calculate recent activity from last 24 hours
  UPDATE dish_analytics da
  SET 
    recent_views_24h = (
      SELECT COUNT(*)::INTEGER
      FROM user_swipes us
      WHERE us.dish_id = da.dish_id
        AND us.created_at > NOW() - INTERVAL '24 hours'
    ),
    recent_swipes_24h = (
      SELECT COUNT(*)::INTEGER
      FROM user_swipes us
      WHERE us.dish_id = da.dish_id
        AND us.created_at > NOW() - INTERVAL '24 hours'
        AND us.action IN ('right', 'super')
    );

  -- Determine trending threshold (e.g., top 10% of recent activity)
  SELECT PERCENTILE_CONT(0.9) WITHIN GROUP (ORDER BY recent_swipes_24h)
  INTO v_threshold
  FROM dish_analytics
  WHERE recent_swipes_24h > 0;

  -- Mark dishes as trending
  UPDATE dish_analytics
  SET 
    is_trending = (recent_swipes_24h >= COALESCE(v_threshold, 5)),
    last_updated_at = NOW();

  GET DIAGNOSTICS v_count = ROW_COUNT;
  
  RETURN v_count;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION update_trending_dishes IS 'Recalculate trending status based on 24h activity (run hourly)';

-- ============================================================================
-- SUCCESS MESSAGE
-- ============================================================================

DO $$ 
BEGIN
  RAISE NOTICE '========================================';
  RAISE NOTICE 'Dish Analytics System Installed!';
  RAISE NOTICE '========================================';
  RAISE NOTICE 'Tables Created:';
  RAISE NOTICE '  ✓ dish_analytics - Popularity metrics';
  RAISE NOTICE '';
  RAISE NOTICE 'Auto-Update:';
  RAISE NOTICE '  ✓ Analytics update after each swipe (trigger)';
  RAISE NOTICE '';
  RAISE NOTICE 'Functions Available:';
  RAISE NOTICE '  ✓ get_trending_dishes(limit)';
  RAISE NOTICE '  ✓ get_popular_dishes(limit)';
  RAISE NOTICE '  ✓ update_trending_dishes() - Run hourly';
  RAISE NOTICE '';
  RAISE NOTICE 'Metrics tracked: views, swipes, engagement, popularity';
  RAISE NOTICE '========================================';
END $$;
