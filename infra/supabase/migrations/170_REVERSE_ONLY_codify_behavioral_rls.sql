-- 170_REVERSE_ONLY_codify_behavioral_rls.sql
-- Reverse migration for 170_codify_behavioral_rls.sql
--
-- WARNING (security): disabling row-level security re-opens these tables to anon
-- reads. Only run this during a controlled rollback -- NEVER while the live
-- mobile client depends on RLS for per-user data isolation.
--
-- This drops exactly what 170 created: the 7 single-column idx_<table>_user_id
-- indexes and the canonical policy set, then disables RLS on the 11 tables
-- (reverse order of the forward file).
--
-- ROLLBACK SEMANTICS: 170's forward step SWEEPS prod's original out-of-band
-- policies and replaces them with the canonical set. This reverse therefore
-- rolls back to NO-RLS (canonical policies dropped + RLS disabled); it does NOT
-- restore the original out-of-band policies (they were intentionally retired by
-- the codification). Controlled-rollback only.
--
-- NOTE: the pre-existing owner-lookup indexes that back favorites
-- (favorites_user_subject_unique, migration 154), session_views and
-- user_dish_interactions (the 076 composites) are intentionally NOT dropped --
-- migration 170 did not create them; dropping them would regress feed
-- performance (Pitfall 4).

BEGIN;

-- user_visits
DROP POLICY IF EXISTS "user_visits: owner select" ON public.user_visits;
DROP POLICY IF EXISTS "user_visits: owner insert" ON public.user_visits;
DROP POLICY IF EXISTS "user_visits: owner update" ON public.user_visits;
DROP INDEX IF EXISTS public.idx_user_visits_user_id;
ALTER TABLE public.user_visits DISABLE ROW LEVEL SECURITY;

-- user_sessions
DROP POLICY IF EXISTS "user_sessions: owner select" ON public.user_sessions;
DROP POLICY IF EXISTS "user_sessions: owner insert" ON public.user_sessions;
DROP POLICY IF EXISTS "user_sessions: owner update" ON public.user_sessions;
DROP INDEX IF EXISTS public.idx_user_sessions_user_id;
ALTER TABLE public.user_sessions DISABLE ROW LEVEL SECURITY;

-- user_points
DROP POLICY IF EXISTS "user_points: owner select" ON public.user_points;
DROP POLICY IF EXISTS "user_points: owner insert" ON public.user_points;
DROP INDEX IF EXISTS public.idx_user_points_user_id;
ALTER TABLE public.user_points DISABLE ROW LEVEL SECURITY;

-- user_dish_interactions (pre-existing 076 composite intentionally kept)
DROP POLICY IF EXISTS "user_dish_interactions: owner select" ON public.user_dish_interactions;
DROP POLICY IF EXISTS "user_dish_interactions: owner insert" ON public.user_dish_interactions;
ALTER TABLE public.user_dish_interactions DISABLE ROW LEVEL SECURITY;

-- user_behavior_profiles
DROP POLICY IF EXISTS "user_behavior_profiles: owner select" ON public.user_behavior_profiles;
DROP POLICY IF EXISTS "user_behavior_profiles: owner update" ON public.user_behavior_profiles;
DROP POLICY IF EXISTS "user_behavior_profiles: service role manage" ON public.user_behavior_profiles;
DROP INDEX IF EXISTS public.idx_user_behavior_profiles_user_id;
ALTER TABLE public.user_behavior_profiles DISABLE ROW LEVEL SECURITY;

-- session_views (pre-existing 076 composite intentionally kept)
DROP POLICY IF EXISTS "session_views: owner select" ON public.session_views;
DROP POLICY IF EXISTS "session_views: owner insert" ON public.session_views;
ALTER TABLE public.session_views DISABLE ROW LEVEL SECURITY;

-- restaurant_experience_responses
DROP POLICY IF EXISTS "restaurant_experience_responses: public read" ON public.restaurant_experience_responses;
DROP POLICY IF EXISTS "restaurant_experience_responses: owner insert" ON public.restaurant_experience_responses;
DROP INDEX IF EXISTS public.idx_restaurant_experience_responses_user_id;
ALTER TABLE public.restaurant_experience_responses DISABLE ROW LEVEL SECURITY;

-- favorites (pre-existing 076 composite intentionally kept)
DROP POLICY IF EXISTS "favorites: owner select" ON public.favorites;
DROP POLICY IF EXISTS "favorites: owner insert" ON public.favorites;
DROP POLICY IF EXISTS "favorites: owner delete" ON public.favorites;
ALTER TABLE public.favorites DISABLE ROW LEVEL SECURITY;

-- dish_photos
DROP POLICY IF EXISTS "dish_photos: public read" ON public.dish_photos;
DROP POLICY IF EXISTS "dish_photos: owner insert" ON public.dish_photos;
DROP POLICY IF EXISTS "dish_photos: owner update" ON public.dish_photos;
DROP POLICY IF EXISTS "dish_photos: owner delete" ON public.dish_photos;
DROP INDEX IF EXISTS public.idx_dish_photos_user_id;
ALTER TABLE public.dish_photos DISABLE ROW LEVEL SECURITY;

-- dish_opinions
DROP POLICY IF EXISTS "dish_opinions: public read" ON public.dish_opinions;
DROP POLICY IF EXISTS "dish_opinions: owner insert" ON public.dish_opinions;
DROP POLICY IF EXISTS "dish_opinions: owner update" ON public.dish_opinions;
DROP POLICY IF EXISTS "dish_opinions: owner delete" ON public.dish_opinions;
DROP INDEX IF EXISTS public.idx_dish_opinions_user_id;
ALTER TABLE public.dish_opinions DISABLE ROW LEVEL SECURITY;

-- dish_analytics
DROP POLICY IF EXISTS "dish_analytics: public read" ON public.dish_analytics;
DROP POLICY IF EXISTS "dish_analytics: service role manage" ON public.dish_analytics;
ALTER TABLE public.dish_analytics DISABLE ROW LEVEL SECURITY;

COMMIT;
