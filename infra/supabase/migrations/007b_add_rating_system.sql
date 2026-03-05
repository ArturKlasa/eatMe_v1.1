-- Migration: Add rating system tables
-- Created: 2026-02-02
-- Description: Tables for user ratings, sessions, visits, and points system

-- ============================================================================
-- 1. USER SESSIONS TABLE
-- ============================================================================
-- Tracks user app sessions to determine when to show rating prompts
CREATE TABLE IF NOT EXISTS public.user_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  started_at TIMESTAMPTZ DEFAULT NOW(),
  ended_at TIMESTAMPTZ,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_user_sessions_user_id ON public.user_sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_user_sessions_is_active ON public.user_sessions(is_active);
CREATE INDEX IF NOT EXISTS idx_user_sessions_started_at ON public.user_sessions(started_at DESC);

ALTER TABLE public.user_sessions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own sessions"
  ON public.user_sessions FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own sessions"
  ON public.user_sessions FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own sessions"
  ON public.user_sessions FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

COMMENT ON TABLE public.user_sessions IS 'User app sessions for tracking viewing patterns';

-- ============================================================================
-- 2. SESSION VIEWS TABLE
-- ============================================================================
-- Tracks what restaurants/dishes users viewed in each session
CREATE TABLE IF NOT EXISTS public.session_views (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID NOT NULL REFERENCES public.user_sessions(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  entity_type TEXT NOT NULL CHECK (entity_type IN ('restaurant', 'dish', 'menu')),
  entity_id UUID NOT NULL,
  viewed_at TIMESTAMPTZ DEFAULT NOW(),
  duration_seconds INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_session_views_session_id ON public.session_views(session_id);
CREATE INDEX IF NOT EXISTS idx_session_views_user_id ON public.session_views(user_id);
CREATE INDEX IF NOT EXISTS idx_session_views_entity ON public.session_views(entity_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_session_views_viewed_at ON public.session_views(viewed_at DESC);

ALTER TABLE public.session_views ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own session views"
  ON public.session_views FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own session views"
  ON public.session_views FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

COMMENT ON TABLE public.session_views IS 'Tracks what users viewed in each session';

-- ============================================================================
-- 3. USER VISITS TABLE
-- ============================================================================
-- Tracks confirmed restaurant visits (user confirmed they ate there)
CREATE TABLE IF NOT EXISTS public.user_visits (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  restaurant_id UUID NOT NULL REFERENCES public.restaurants(id) ON DELETE CASCADE,
  session_id UUID REFERENCES public.user_sessions(id) ON DELETE SET NULL,
  visited_at TIMESTAMPTZ DEFAULT NOW(),
  confirmed_at TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_user_visits_user_id ON public.user_visits(user_id);
CREATE INDEX IF NOT EXISTS idx_user_visits_restaurant_id ON public.user_visits(restaurant_id);
CREATE INDEX IF NOT EXISTS idx_user_visits_visited_at ON public.user_visits(visited_at DESC);

ALTER TABLE public.user_visits ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own visits"
  ON public.user_visits FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own visits"
  ON public.user_visits FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own visits"
  ON public.user_visits FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

COMMENT ON TABLE public.user_visits IS 'Confirmed restaurant visits by users';

-- ============================================================================
-- 4. DISH OPINIONS TABLE
-- ============================================================================
-- Stores user opinions/ratings of dishes (liked/okay/disliked)
CREATE TABLE IF NOT EXISTS public.dish_opinions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  dish_id UUID NOT NULL REFERENCES public.dishes(id) ON DELETE CASCADE,
  visit_id UUID REFERENCES public.user_visits(id) ON DELETE SET NULL,
  opinion TEXT NOT NULL CHECK (opinion IN ('liked', 'okay', 'disliked')),
  tags TEXT[] DEFAULT '{}',
  photo_id UUID REFERENCES public.dish_photos(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, dish_id, visit_id)
);

CREATE INDEX IF NOT EXISTS idx_dish_opinions_user_id ON public.dish_opinions(user_id);
CREATE INDEX IF NOT EXISTS idx_dish_opinions_dish_id ON public.dish_opinions(dish_id);
CREATE INDEX IF NOT EXISTS idx_dish_opinions_opinion ON public.dish_opinions(opinion);
CREATE INDEX IF NOT EXISTS idx_dish_opinions_created_at ON public.dish_opinions(created_at DESC);

ALTER TABLE public.dish_opinions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view dish opinions"
  ON public.dish_opinions FOR SELECT
  USING (true);

CREATE POLICY "Users can insert their own dish opinions"
  ON public.dish_opinions FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own dish opinions"
  ON public.dish_opinions FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete their own dish opinions"
  ON public.dish_opinions FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

-- Trigger for updated_at
CREATE OR REPLACE FUNCTION public.update_dish_opinions_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_dish_opinions_updated_at
  BEFORE UPDATE ON public.dish_opinions
  FOR EACH ROW
  EXECUTE FUNCTION public.update_dish_opinions_updated_at();

COMMENT ON TABLE public.dish_opinions IS 'User ratings and opinions of dishes';

-- ============================================================================
-- 5. RESTAURANT EXPERIENCE RESPONSES TABLE
-- ============================================================================
-- Stores answers to rotating restaurant experience questions
CREATE TABLE IF NOT EXISTS public.restaurant_experience_responses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  restaurant_id UUID NOT NULL REFERENCES public.restaurants(id) ON DELETE CASCADE,
  visit_id UUID REFERENCES public.user_visits(id) ON DELETE SET NULL,
  question_type TEXT NOT NULL CHECK (question_type IN (
    'service_friendly',
    'clean',
    'wait_time_reasonable',
    'would_recommend',
    'good_value'
  )),
  response BOOLEAN NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_restaurant_exp_user_id ON public.restaurant_experience_responses(user_id);
CREATE INDEX IF NOT EXISTS idx_restaurant_exp_restaurant_id ON public.restaurant_experience_responses(restaurant_id);
CREATE INDEX IF NOT EXISTS idx_restaurant_exp_question ON public.restaurant_experience_responses(question_type);
CREATE INDEX IF NOT EXISTS idx_restaurant_exp_created_at ON public.restaurant_experience_responses(created_at DESC);

ALTER TABLE public.restaurant_experience_responses ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view restaurant experience responses"
  ON public.restaurant_experience_responses FOR SELECT
  USING (true);

CREATE POLICY "Users can insert their own restaurant experience responses"
  ON public.restaurant_experience_responses FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

COMMENT ON TABLE public.restaurant_experience_responses IS 'User feedback on restaurant experience aspects';

-- ============================================================================
-- 6. USER POINTS TABLE
-- ============================================================================
-- Tracks points earned by users for various actions
CREATE TABLE IF NOT EXISTS public.user_points (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  points INTEGER NOT NULL,
  action_type TEXT NOT NULL CHECK (action_type IN (
    'dish_rating',
    'dish_tags',
    'dish_photo',
    'restaurant_question',
    'first_rating_bonus',
    'weekly_streak_bonus',
    'photo_views_milestone'
  )),
  reference_id UUID, -- ID of the related action (opinion_id, photo_id, etc.)
  description TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_user_points_user_id ON public.user_points(user_id);
CREATE INDEX IF NOT EXISTS idx_user_points_action_type ON public.user_points(action_type);
CREATE INDEX IF NOT EXISTS idx_user_points_created_at ON public.user_points(created_at DESC);

ALTER TABLE public.user_points ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own points"
  ON public.user_points FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own points"
  ON public.user_points FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

COMMENT ON TABLE public.user_points IS 'Points earned by users for various rating actions';

-- ============================================================================
-- 7. MATERIALIZED VIEW: DISH RATINGS SUMMARY
-- ============================================================================
-- Aggregated dish ratings for quick lookups
CREATE MATERIALIZED VIEW IF NOT EXISTS public.dish_ratings_summary AS
WITH dish_stats AS (
  SELECT 
    dish_id,
    COUNT(*) as total_ratings,
    COUNT(*) FILTER (WHERE opinion = 'liked') as liked_count,
    COUNT(*) FILTER (WHERE opinion = 'okay') as okay_count,
    COUNT(*) FILTER (WHERE opinion = 'disliked') as disliked_count,
    ROUND((COUNT(*) FILTER (WHERE opinion = 'liked')::numeric / COUNT(*)::numeric * 100), 1) as like_percentage
  FROM public.dish_opinions
  GROUP BY dish_id
),
tag_aggregates AS (
  SELECT 
    dish_id,
    array_agg(DISTINCT tag) as top_tags
  FROM public.dish_opinions, unnest(tags) as tag
  WHERE tags IS NOT NULL AND array_length(tags, 1) > 0
  GROUP BY dish_id
)
SELECT 
  ds.dish_id,
  ds.total_ratings,
  ds.liked_count,
  ds.okay_count,
  ds.disliked_count,
  ds.like_percentage,
  COALESCE(ta.top_tags, '{}') as top_tags
FROM dish_stats ds
LEFT JOIN tag_aggregates ta ON ta.dish_id = ds.dish_id;

CREATE UNIQUE INDEX ON public.dish_ratings_summary (dish_id);

-- Refresh function
CREATE OR REPLACE FUNCTION public.refresh_dish_ratings_summary()
RETURNS void AS $$
BEGIN
  REFRESH MATERIALIZED VIEW CONCURRENTLY public.dish_ratings_summary;
END;
$$ LANGUAGE plpgsql;

COMMENT ON MATERIALIZED VIEW public.dish_ratings_summary IS 'Aggregated dish ratings for performance';

-- ============================================================================
-- 8. MATERIALIZED VIEW: RESTAURANT RATINGS SUMMARY
-- ============================================================================
-- Aggregated restaurant ratings from dishes and experience responses
CREATE MATERIALIZED VIEW IF NOT EXISTS public.restaurant_ratings_summary AS
WITH dish_scores AS (
  SELECT 
    d.restaurant_id,
    AVG(CASE 
      WHEN dop.opinion = 'liked' THEN 1.0
      WHEN dop.opinion = 'okay' THEN 0.5
      ELSE 0.0
    END) as avg_dish_score
  FROM public.dish_opinions dop
  JOIN public.dishes d ON d.id = dop.dish_id
  GROUP BY d.restaurant_id
),
experience_scores AS (
  SELECT 
    restaurant_id,
    question_type,
    AVG(CASE WHEN response THEN 1.0 ELSE 0.0 END) as avg_score
  FROM public.restaurant_experience_responses
  GROUP BY restaurant_id, question_type
)
SELECT 
  r.id as restaurant_id,
  COALESCE(ds.avg_dish_score, 0.5) as food_score,
  COALESCE(MAX(es.avg_score) FILTER (WHERE es.question_type = 'service_friendly'), 0.5) as service_score,
  COALESCE(MAX(es.avg_score) FILTER (WHERE es.question_type = 'clean'), 0.5) as cleanliness_score,
  COALESCE(MAX(es.avg_score) FILTER (WHERE es.question_type = 'wait_time_reasonable'), 0.5) as wait_time_score,
  COALESCE(MAX(es.avg_score) FILTER (WHERE es.question_type = 'good_value'), 0.5) as value_score,
  ROUND((
    COALESCE(ds.avg_dish_score, 0.5) * 0.7 +
    COALESCE(AVG(es.avg_score), 0.5) * 0.3
  ) * 100, 1) as overall_percentage
FROM public.restaurants r
LEFT JOIN dish_scores ds ON ds.restaurant_id = r.id
LEFT JOIN experience_scores es ON es.restaurant_id = r.id
GROUP BY r.id, ds.avg_dish_score;

CREATE UNIQUE INDEX ON public.restaurant_ratings_summary (restaurant_id);

-- Refresh function
CREATE OR REPLACE FUNCTION public.refresh_restaurant_ratings_summary()
RETURNS void AS $$
BEGIN
  REFRESH MATERIALIZED VIEW CONCURRENTLY public.restaurant_ratings_summary;
END;
$$ LANGUAGE plpgsql;

COMMENT ON MATERIALIZED VIEW public.restaurant_ratings_summary IS 'Aggregated restaurant ratings from dishes and experience';

-- ============================================================================
-- 9. FUNCTION: GET USER TOTAL POINTS
-- ============================================================================
CREATE OR REPLACE FUNCTION public.get_user_total_points(p_user_id UUID)
RETURNS INTEGER AS $$
BEGIN
  RETURN COALESCE(
    (SELECT SUM(points) FROM public.user_points WHERE user_id = p_user_id),
    0
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION public.get_user_total_points IS 'Get total points earned by a user';

-- ============================================================================
-- 10. FUNCTION: AWARD POINTS
-- ============================================================================
CREATE OR REPLACE FUNCTION public.award_points(
  p_user_id UUID,
  p_points INTEGER,
  p_action_type TEXT,
  p_reference_id UUID DEFAULT NULL,
  p_description TEXT DEFAULT NULL
)
RETURNS UUID AS $$
DECLARE
  v_point_id UUID;
BEGIN
  INSERT INTO public.user_points (user_id, points, action_type, reference_id, description)
  VALUES (p_user_id, p_points, p_action_type, p_reference_id, p_description)
  RETURNING id INTO v_point_id;
  
  RETURN v_point_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION public.award_points IS 'Award points to a user for an action';
