-- Migration 079: Rating System Redesign
-- Adds in-context rating support, note field, streak/badge tables,
-- and updates materialized views for Bayesian food scores.

-- ============================================================
-- 1. Add columns to existing tables
-- ============================================================

ALTER TABLE public.dish_opinions
  ADD COLUMN IF NOT EXISTS note text CHECK (char_length(note) <= 47),
  ADD COLUMN IF NOT EXISTS source text DEFAULT 'full_flow' CHECK (source IN ('full_flow', 'in_context'));

ALTER TABLE public.user_visits
  ADD COLUMN IF NOT EXISTS source text DEFAULT 'full_flow' CHECK (source IN ('full_flow', 'in_context'));

-- ============================================================
-- 2. New tables: user_streaks and user_badges
-- ============================================================

CREATE TABLE IF NOT EXISTS public.user_streaks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id),
  current_streak integer DEFAULT 0,
  longest_streak integer DEFAULT 0,
  last_rating_week date,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(user_id)
);

ALTER TABLE public.user_streaks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read own streaks"
  ON public.user_streaks FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can update own streaks"
  ON public.user_streaks FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Service can insert streaks"
  ON public.user_streaks FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE TABLE IF NOT EXISTS public.user_badges (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id),
  badge_type text NOT NULL CHECK (badge_type IN ('trusted_taster')),
  earned_at timestamptz DEFAULT now(),
  UNIQUE(user_id, badge_type)
);

ALTER TABLE public.user_badges ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read own badges"
  ON public.user_badges FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own badges"
  ON public.user_badges FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- ============================================================
-- 3. Drop materialized views in reverse dependency order
--    restaurant_ratings_summary depends on dish_ratings_summary
-- ============================================================

DROP MATERIALIZED VIEW IF EXISTS public.restaurant_ratings_summary;
DROP MATERIALIZED VIEW IF EXISTS public.dish_ratings_summary;

-- ============================================================
-- 4. Recreate dish_ratings_summary
-- ============================================================

CREATE MATERIALIZED VIEW public.dish_ratings_summary AS
SELECT
  do_agg.dish_id,
  do_agg.total_ratings,
  do_agg.like_percentage,
  do_agg.okay_percentage,
  do_agg.dislike_percentage,
  do_agg.liked_count,
  do_agg.okay_count,
  do_agg.disliked_count,
  tag_agg.top_tags,
  note_agg.recent_notes
FROM (
  SELECT
    dish_id,
    COUNT(*) AS total_ratings,
    COUNT(*) FILTER (WHERE opinion = 'liked') AS liked_count,
    COUNT(*) FILTER (WHERE opinion = 'okay') AS okay_count,
    COUNT(*) FILTER (WHERE opinion = 'disliked') AS disliked_count,
    ROUND(100.0 * COUNT(*) FILTER (WHERE opinion = 'liked') / NULLIF(COUNT(*), 0), 1) AS like_percentage,
    ROUND(100.0 * COUNT(*) FILTER (WHERE opinion = 'okay') / NULLIF(COUNT(*), 0), 1) AS okay_percentage,
    ROUND(100.0 * COUNT(*) FILTER (WHERE opinion = 'disliked') / NULLIF(COUNT(*), 0), 1) AS dislike_percentage
  FROM public.dish_opinions
  GROUP BY dish_id
) do_agg
LEFT JOIN LATERAL (
  SELECT ARRAY_AGG(tag ORDER BY cnt DESC) AS top_tags
  FROM (
    SELECT UNNEST(tags) AS tag, COUNT(*) AS cnt
    FROM public.dish_opinions
    WHERE dish_id = do_agg.dish_id
    GROUP BY tag
    ORDER BY cnt DESC
    LIMIT 5
  ) t
) tag_agg ON true
LEFT JOIN LATERAL (
  SELECT ARRAY_AGG(note ORDER BY created_at DESC) AS recent_notes
  FROM (
    SELECT note, created_at
    FROM public.dish_opinions
    WHERE dish_id = do_agg.dish_id AND note IS NOT NULL
    ORDER BY created_at DESC
    LIMIT 3
  ) n
) note_agg ON true;

CREATE UNIQUE INDEX ON public.dish_ratings_summary (dish_id);

-- ============================================================
-- 5. Recreate restaurant_ratings_summary
-- ============================================================

CREATE MATERIALIZED VIEW public.restaurant_ratings_summary AS
WITH dish_scores AS (
  SELECT
    d.restaurant_id,
    drs.like_percentage,
    drs.total_ratings
  FROM public.dish_ratings_summary drs
  JOIN public.dishes d ON d.id = drs.dish_id
  WHERE drs.total_ratings >= 1
),
bayesian AS (
  SELECT
    ds.restaurant_id,
    ROUND(
      (10 * (SELECT AVG(like_percentage) FROM public.dish_ratings_summary) + SUM(ds.like_percentage))
      / (10 + COUNT(*))
    , 1) AS food_score,
    SUM(ds.total_ratings) AS total_dish_ratings
  FROM dish_scores ds
  GROUP BY ds.restaurant_id
),
experience AS (
  SELECT
    restaurant_id,
    ROUND(100.0 * AVG(CASE WHEN response THEN 1 ELSE 0 END), 1) AS overall_experience,
    ROUND(100.0 * AVG(CASE WHEN question_type = 'service_friendly' AND response THEN 1
                            WHEN question_type = 'service_friendly' THEN 0 END), 1) AS service_pct,
    ROUND(100.0 * AVG(CASE WHEN question_type = 'clean' AND response THEN 1
                            WHEN question_type = 'clean' THEN 0 END), 1) AS cleanliness_pct,
    ROUND(100.0 * AVG(CASE WHEN question_type = 'wait_time_reasonable' AND response THEN 1
                            WHEN question_type = 'wait_time_reasonable' THEN 0 END), 1) AS wait_time_pct,
    ROUND(100.0 * AVG(CASE WHEN question_type = 'good_value' AND response THEN 1
                            WHEN question_type = 'good_value' THEN 0 END), 1) AS value_pct,
    ROUND(100.0 * AVG(CASE WHEN question_type = 'would_recommend' AND response THEN 1
                            WHEN question_type = 'would_recommend' THEN 0 END), 1) AS would_recommend_pct,
    COUNT(*) AS total_experience_responses
  FROM public.restaurant_experience_responses
  GROUP BY restaurant_id
)
SELECT
  COALESCE(b.restaurant_id, e.restaurant_id) AS restaurant_id,
  b.food_score,
  b.total_dish_ratings,
  e.service_pct AS service_percentage,
  e.cleanliness_pct AS cleanliness_percentage,
  e.wait_time_pct AS wait_time_percentage,
  e.value_pct AS value_percentage,
  e.would_recommend_pct AS would_recommend_percentage,
  e.total_experience_responses,
  ROUND(COALESCE(b.food_score, 0) * 0.6 + COALESCE(e.overall_experience, 0) * 0.4, 1) AS overall_percentage
FROM bayesian b
FULL OUTER JOIN experience e ON b.restaurant_id = e.restaurant_id;

CREATE UNIQUE INDEX ON public.restaurant_ratings_summary (restaurant_id);

-- ============================================================
-- 6. Update refresh_materialized_views() RPC
--    dish_ratings_summary MUST be refreshed before restaurant_ratings_summary
-- ============================================================

CREATE OR REPLACE FUNCTION public.refresh_materialized_views()
RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  REFRESH MATERIALIZED VIEW CONCURRENTLY public.dish_ratings_summary;
  REFRESH MATERIALIZED VIEW CONCURRENTLY public.restaurant_ratings_summary;
END;
$$;
