-- 170_codify_behavioral_rls.sql
-- Created: 2026-06-19
--
-- CODIFY the row-level security already enforced in production on the 11
-- mobile-direct behavioral tables. The production database has RLS enabled on
-- all of these tables with owner / public / service-role policies (verified by
-- the F-11 prod probe, 2026-06-19), but the repo migration baseline contains
-- ZERO row-level-security declarations for them -- prod was configured out-of-band.
-- This migration closes that migrations<->prod drift by making the canonical
-- RLS state live in version control (requirement SEC-02).
--
-- PRECONDITION (D-12): all 11 tables are assumed to ALREADY EXIST (created
-- pre-071 / out-of-band). This migration codifies PROTECTION on existing
-- tables; it does NOT create them. Therefore the operator's validation target
-- MUST be a PROD CLONE (Supabase branch / shadow DB), NOT a from-scratch
-- "migrations/" build.
--
-- This file is authored + dry-run only. Production is already protected, so the
-- agent NEVER applies this to prod (stage-don't-apply, D-13). The operator
-- validates it on a branch / shadow DB per the plan's Task 3 handoff.
--
-- Codification rules (no access changes vs prod):
--   * own-row predicate is the InitPlan form (select auth.uid()) = owner column
--     everywhere (functionally identical to the bare call; InitPlan-optimized).
--   * own-row read/write policies target the authenticated role.
--   * genuine public reads stay USING (true), open to the public role.
--   * NO admin override on any behavioral table.
--   * NO extra / missing command coverage vs the prod probe.
--
-- Reverse: 170_REVERSE_ONLY_codify_behavioral_rls.sql

BEGIN;

-- ---------------------------------------------------------------------------
-- dish_analytics -- dish-keyed public aggregate (PK dish_id; no owner column).
-- NOT user-owned (D-07): public read + service-role manage only. No owner
-- policy and no owner index.
-- ---------------------------------------------------------------------------
ALTER TABLE public.dish_analytics ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "dish_analytics: public read" ON public.dish_analytics;
CREATE POLICY "dish_analytics: public read"
  ON public.dish_analytics FOR SELECT
  USING (true);

DROP POLICY IF EXISTS "dish_analytics: service role manage" ON public.dish_analytics;
CREATE POLICY "dish_analytics: service role manage"
  ON public.dish_analytics FOR ALL
  TO service_role
  USING (true) WITH CHECK (true);

-- ---------------------------------------------------------------------------
-- dish_opinions -- public read; own-row insert / update / delete.
-- ---------------------------------------------------------------------------
ALTER TABLE public.dish_opinions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "dish_opinions: public read" ON public.dish_opinions;
CREATE POLICY "dish_opinions: public read"
  ON public.dish_opinions FOR SELECT
  USING (true);

DROP POLICY IF EXISTS "dish_opinions: owner insert" ON public.dish_opinions;
CREATE POLICY "dish_opinions: owner insert"
  ON public.dish_opinions FOR INSERT TO authenticated
  WITH CHECK ((select auth.uid()) = user_id);

DROP POLICY IF EXISTS "dish_opinions: owner update" ON public.dish_opinions;
CREATE POLICY "dish_opinions: owner update"
  ON public.dish_opinions FOR UPDATE TO authenticated
  USING ((select auth.uid()) = user_id)
  WITH CHECK ((select auth.uid()) = user_id);

DROP POLICY IF EXISTS "dish_opinions: owner delete" ON public.dish_opinions;
CREATE POLICY "dish_opinions: owner delete"
  ON public.dish_opinions FOR DELETE TO authenticated
  USING ((select auth.uid()) = user_id);

CREATE INDEX IF NOT EXISTS idx_dish_opinions_user_id ON public.dish_opinions(user_id);

-- ---------------------------------------------------------------------------
-- dish_photos -- public read; own-row insert / update / delete.
-- ---------------------------------------------------------------------------
ALTER TABLE public.dish_photos ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "dish_photos: public read" ON public.dish_photos;
CREATE POLICY "dish_photos: public read"
  ON public.dish_photos FOR SELECT
  USING (true);

DROP POLICY IF EXISTS "dish_photos: owner insert" ON public.dish_photos;
CREATE POLICY "dish_photos: owner insert"
  ON public.dish_photos FOR INSERT TO authenticated
  WITH CHECK ((select auth.uid()) = user_id);

DROP POLICY IF EXISTS "dish_photos: owner update" ON public.dish_photos;
CREATE POLICY "dish_photos: owner update"
  ON public.dish_photos FOR UPDATE TO authenticated
  USING ((select auth.uid()) = user_id)
  WITH CHECK ((select auth.uid()) = user_id);

DROP POLICY IF EXISTS "dish_photos: owner delete" ON public.dish_photos;
CREATE POLICY "dish_photos: owner delete"
  ON public.dish_photos FOR DELETE TO authenticated
  USING ((select auth.uid()) = user_id);

CREATE INDEX IF NOT EXISTS idx_dish_photos_user_id ON public.dish_photos(user_id);

-- ---------------------------------------------------------------------------
-- favorites -- own-row select / insert / delete (no update).
-- Owner lookup already served by the 076 composite (leading owner column)
-- -- NO new single-column index (D-09).
-- ---------------------------------------------------------------------------
ALTER TABLE public.favorites ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "favorites: owner select" ON public.favorites;
CREATE POLICY "favorites: owner select"
  ON public.favorites FOR SELECT TO authenticated
  USING ((select auth.uid()) = user_id);

DROP POLICY IF EXISTS "favorites: owner insert" ON public.favorites;
CREATE POLICY "favorites: owner insert"
  ON public.favorites FOR INSERT TO authenticated
  WITH CHECK ((select auth.uid()) = user_id);

DROP POLICY IF EXISTS "favorites: owner delete" ON public.favorites;
CREATE POLICY "favorites: owner delete"
  ON public.favorites FOR DELETE TO authenticated
  USING ((select auth.uid()) = user_id);

-- ---------------------------------------------------------------------------
-- restaurant_experience_responses -- public read; own-row insert only.
-- ---------------------------------------------------------------------------
ALTER TABLE public.restaurant_experience_responses ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "restaurant_experience_responses: public read" ON public.restaurant_experience_responses;
CREATE POLICY "restaurant_experience_responses: public read"
  ON public.restaurant_experience_responses FOR SELECT
  USING (true);

DROP POLICY IF EXISTS "restaurant_experience_responses: owner insert" ON public.restaurant_experience_responses;
CREATE POLICY "restaurant_experience_responses: owner insert"
  ON public.restaurant_experience_responses FOR INSERT TO authenticated
  WITH CHECK ((select auth.uid()) = user_id);

CREATE INDEX IF NOT EXISTS idx_restaurant_experience_responses_user_id ON public.restaurant_experience_responses(user_id);

-- ---------------------------------------------------------------------------
-- session_views -- own-row select / insert.
-- Owner lookup already served by the 076 composite (leading owner column)
-- -- NO new single-column index (D-09).
-- ---------------------------------------------------------------------------
ALTER TABLE public.session_views ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "session_views: owner select" ON public.session_views;
CREATE POLICY "session_views: owner select"
  ON public.session_views FOR SELECT TO authenticated
  USING ((select auth.uid()) = user_id);

DROP POLICY IF EXISTS "session_views: owner insert" ON public.session_views;
CREATE POLICY "session_views: owner insert"
  ON public.session_views FOR INSERT TO authenticated
  WITH CHECK ((select auth.uid()) = user_id);

-- ---------------------------------------------------------------------------
-- user_behavior_profiles -- own-row select / update; service-role manage.
-- ---------------------------------------------------------------------------
ALTER TABLE public.user_behavior_profiles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "user_behavior_profiles: owner select" ON public.user_behavior_profiles;
CREATE POLICY "user_behavior_profiles: owner select"
  ON public.user_behavior_profiles FOR SELECT TO authenticated
  USING ((select auth.uid()) = user_id);

DROP POLICY IF EXISTS "user_behavior_profiles: owner update" ON public.user_behavior_profiles;
CREATE POLICY "user_behavior_profiles: owner update"
  ON public.user_behavior_profiles FOR UPDATE TO authenticated
  USING ((select auth.uid()) = user_id)
  WITH CHECK ((select auth.uid()) = user_id);

DROP POLICY IF EXISTS "user_behavior_profiles: service role manage" ON public.user_behavior_profiles;
CREATE POLICY "user_behavior_profiles: service role manage"
  ON public.user_behavior_profiles FOR ALL
  TO service_role
  USING (true) WITH CHECK (true);

CREATE INDEX IF NOT EXISTS idx_user_behavior_profiles_user_id ON public.user_behavior_profiles(user_id);

-- ---------------------------------------------------------------------------
-- user_dish_interactions -- own-row select / insert.
-- Owner lookup already served by the 076 composite (leading owner column)
-- -- NO new single-column index (D-09).
-- ---------------------------------------------------------------------------
ALTER TABLE public.user_dish_interactions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "user_dish_interactions: owner select" ON public.user_dish_interactions;
CREATE POLICY "user_dish_interactions: owner select"
  ON public.user_dish_interactions FOR SELECT TO authenticated
  USING ((select auth.uid()) = user_id);

DROP POLICY IF EXISTS "user_dish_interactions: owner insert" ON public.user_dish_interactions;
CREATE POLICY "user_dish_interactions: owner insert"
  ON public.user_dish_interactions FOR INSERT TO authenticated
  WITH CHECK ((select auth.uid()) = user_id);

-- ---------------------------------------------------------------------------
-- user_points -- own-row select / insert.
-- ---------------------------------------------------------------------------
ALTER TABLE public.user_points ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "user_points: owner select" ON public.user_points;
CREATE POLICY "user_points: owner select"
  ON public.user_points FOR SELECT TO authenticated
  USING ((select auth.uid()) = user_id);

DROP POLICY IF EXISTS "user_points: owner insert" ON public.user_points;
CREATE POLICY "user_points: owner insert"
  ON public.user_points FOR INSERT TO authenticated
  WITH CHECK ((select auth.uid()) = user_id);

CREATE INDEX IF NOT EXISTS idx_user_points_user_id ON public.user_points(user_id);

-- ---------------------------------------------------------------------------
-- user_sessions -- own-row select / insert / update.
-- ---------------------------------------------------------------------------
ALTER TABLE public.user_sessions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "user_sessions: owner select" ON public.user_sessions;
CREATE POLICY "user_sessions: owner select"
  ON public.user_sessions FOR SELECT TO authenticated
  USING ((select auth.uid()) = user_id);

DROP POLICY IF EXISTS "user_sessions: owner insert" ON public.user_sessions;
CREATE POLICY "user_sessions: owner insert"
  ON public.user_sessions FOR INSERT TO authenticated
  WITH CHECK ((select auth.uid()) = user_id);

DROP POLICY IF EXISTS "user_sessions: owner update" ON public.user_sessions;
CREATE POLICY "user_sessions: owner update"
  ON public.user_sessions FOR UPDATE TO authenticated
  USING ((select auth.uid()) = user_id)
  WITH CHECK ((select auth.uid()) = user_id);

CREATE INDEX IF NOT EXISTS idx_user_sessions_user_id ON public.user_sessions(user_id);

-- ---------------------------------------------------------------------------
-- user_visits -- own-row select / insert / update.
-- ---------------------------------------------------------------------------
ALTER TABLE public.user_visits ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "user_visits: owner select" ON public.user_visits;
CREATE POLICY "user_visits: owner select"
  ON public.user_visits FOR SELECT TO authenticated
  USING ((select auth.uid()) = user_id);

DROP POLICY IF EXISTS "user_visits: owner insert" ON public.user_visits;
CREATE POLICY "user_visits: owner insert"
  ON public.user_visits FOR INSERT TO authenticated
  WITH CHECK ((select auth.uid()) = user_id);

DROP POLICY IF EXISTS "user_visits: owner update" ON public.user_visits;
CREATE POLICY "user_visits: owner update"
  ON public.user_visits FOR UPDATE TO authenticated
  USING ((select auth.uid()) = user_id)
  WITH CHECK ((select auth.uid()) = user_id);

CREATE INDEX IF NOT EXISTS idx_user_visits_user_id ON public.user_visits(user_id);

COMMIT;
