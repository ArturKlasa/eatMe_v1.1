-- 170_codify_behavioral_rls.sql
-- Created: 2026-06-19
--
-- CODIFY the row-level security enforced in production on the 11 mobile-direct
-- behavioral tables, making the canonical RLS state live in version control
-- (requirement SEC-02). Production has RLS enabled on all of these tables with
-- owner / public / service-role policies (F-11 prod probe, 2026-06-19), but the
-- repo migration baseline contained ZERO row-level-security declarations for
-- them -- prod was configured out-of-band. This closes that migrations<->prod
-- drift.
--
-- IMPORTANT (drift reconciliation): prod's out-of-band policies use DIFFERENT
-- names than the canonical set below (e.g. "Users can view their own visits" vs
-- "user_visits: owner select"). A name-keyed "DROP IF EXISTS" would leave them
-- in place and ADD a duplicate set, so this migration first SWEEPS every
-- existing policy off the 11 tables (name-agnostic) and then creates exactly the
-- canonical set. Applied to a fresh DB or a prod clone it yields ONE canonical
-- set -- truly idempotent and drift-closing. Cross-checked functionally
-- equivalent to prod's 30 policies, with exactly these deliberate improvements
-- and zero access expansions:
--   * InitPlan form (select auth.uid()) = owner column everywhere (vs the bare
--     call) -- functionally identical, InitPlan-optimized (D-02 / SC#2).
--   * own-row read/write policies target the authenticated role; prod used the
--     public role for the favorites + user_dish_interactions own-row policies,
--     but anon's NULL uid fails the own-row predicate either way (D-04).
--   * user_behavior_profiles UPDATE gains WITH CHECK (prod omitted it) so a user
--     cannot reassign a row to another owner (tightening, not an expansion;
--     Pitfall 5).
--   * NO admin override on any behavioral table; genuine public reads stay
--     USING (true) open to the public role; no extra / missing command coverage.
--
-- PRECONDITION (D-12): the 11 tables already exist (created pre-071 / out-of-band).
-- This codifies PROTECTION on existing tables; it does NOT create them. The
-- operator's validation target MUST be a PROD CLONE, not a from-scratch
-- "migrations/" build.
--
-- Authored + dry-run only; the agent never applies this to prod (prod is already
-- protected, D-13). The operator validates on a branch / shadow DB.
--
-- Reverse: 170_REVERSE_ONLY_codify_behavioral_rls.sql

BEGIN;

-- ---------------------------------------------------------------------------
-- Preamble: sweep ALL pre-existing policies off the 11 tables (name-agnostic)
-- so the canonical CREATE POLICY statements below become the ONLY policy set,
-- regardless of the out-of-band names prod used. This is what makes the
-- migration both drift-closing and idempotent on re-run.
-- ---------------------------------------------------------------------------
DO $$
DECLARE
  pol record;
BEGIN
  FOR pol IN
    SELECT policyname, tablename
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename IN (
        'dish_analytics','dish_opinions','dish_photos','favorites',
        'restaurant_experience_responses','session_views','user_behavior_profiles',
        'user_dish_interactions','user_points','user_sessions','user_visits')
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', pol.policyname, pol.tablename);
  END LOOP;
END $$;

-- ---------------------------------------------------------------------------
-- dish_analytics -- dish-keyed public aggregate (PK dish_id; no owner column).
-- NOT user-owned (D-07): public read + service-role manage only. No owner
-- policy and no owner index.
-- ---------------------------------------------------------------------------
ALTER TABLE public.dish_analytics ENABLE ROW LEVEL SECURITY;

CREATE POLICY "dish_analytics: public read"
  ON public.dish_analytics FOR SELECT
  USING (true);

CREATE POLICY "dish_analytics: service role manage"
  ON public.dish_analytics FOR ALL
  TO service_role
  USING (true) WITH CHECK (true);

-- ---------------------------------------------------------------------------
-- dish_opinions -- public read; own-row insert / update / delete.
-- ---------------------------------------------------------------------------
ALTER TABLE public.dish_opinions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "dish_opinions: public read"
  ON public.dish_opinions FOR SELECT
  USING (true);

CREATE POLICY "dish_opinions: owner insert"
  ON public.dish_opinions FOR INSERT TO authenticated
  WITH CHECK ((select auth.uid()) = user_id);

CREATE POLICY "dish_opinions: owner update"
  ON public.dish_opinions FOR UPDATE TO authenticated
  USING ((select auth.uid()) = user_id)
  WITH CHECK ((select auth.uid()) = user_id);

CREATE POLICY "dish_opinions: owner delete"
  ON public.dish_opinions FOR DELETE TO authenticated
  USING ((select auth.uid()) = user_id);

CREATE INDEX IF NOT EXISTS idx_dish_opinions_user_id ON public.dish_opinions(user_id);

-- ---------------------------------------------------------------------------
-- dish_photos -- public read; own-row insert / update / delete.
-- ---------------------------------------------------------------------------
ALTER TABLE public.dish_photos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "dish_photos: public read"
  ON public.dish_photos FOR SELECT
  USING (true);

CREATE POLICY "dish_photos: owner insert"
  ON public.dish_photos FOR INSERT TO authenticated
  WITH CHECK ((select auth.uid()) = user_id);

CREATE POLICY "dish_photos: owner update"
  ON public.dish_photos FOR UPDATE TO authenticated
  USING ((select auth.uid()) = user_id)
  WITH CHECK ((select auth.uid()) = user_id);

CREATE POLICY "dish_photos: owner delete"
  ON public.dish_photos FOR DELETE TO authenticated
  USING ((select auth.uid()) = user_id);

CREATE INDEX IF NOT EXISTS idx_dish_photos_user_id ON public.dish_photos(user_id);

-- ---------------------------------------------------------------------------
-- favorites -- own-row select / insert / delete (no update).
-- Owner lookup already served by the favorites_user_subject_unique index
-- (migration 154 UNIQUE (user_id, subject_type, subject_id), leading owner
-- column) -- NO new single-column index (D-09).
-- ---------------------------------------------------------------------------
ALTER TABLE public.favorites ENABLE ROW LEVEL SECURITY;

CREATE POLICY "favorites: owner select"
  ON public.favorites FOR SELECT TO authenticated
  USING ((select auth.uid()) = user_id);

CREATE POLICY "favorites: owner insert"
  ON public.favorites FOR INSERT TO authenticated
  WITH CHECK ((select auth.uid()) = user_id);

CREATE POLICY "favorites: owner delete"
  ON public.favorites FOR DELETE TO authenticated
  USING ((select auth.uid()) = user_id);

-- ---------------------------------------------------------------------------
-- restaurant_experience_responses -- public read; own-row insert only.
-- ---------------------------------------------------------------------------
ALTER TABLE public.restaurant_experience_responses ENABLE ROW LEVEL SECURITY;

CREATE POLICY "restaurant_experience_responses: public read"
  ON public.restaurant_experience_responses FOR SELECT
  USING (true);

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

CREATE POLICY "session_views: owner select"
  ON public.session_views FOR SELECT TO authenticated
  USING ((select auth.uid()) = user_id);

CREATE POLICY "session_views: owner insert"
  ON public.session_views FOR INSERT TO authenticated
  WITH CHECK ((select auth.uid()) = user_id);

-- ---------------------------------------------------------------------------
-- user_behavior_profiles -- own-row select / update; service-role manage.
-- ---------------------------------------------------------------------------
ALTER TABLE public.user_behavior_profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "user_behavior_profiles: owner select"
  ON public.user_behavior_profiles FOR SELECT TO authenticated
  USING ((select auth.uid()) = user_id);

CREATE POLICY "user_behavior_profiles: owner update"
  ON public.user_behavior_profiles FOR UPDATE TO authenticated
  USING ((select auth.uid()) = user_id)
  WITH CHECK ((select auth.uid()) = user_id);

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

CREATE POLICY "user_dish_interactions: owner select"
  ON public.user_dish_interactions FOR SELECT TO authenticated
  USING ((select auth.uid()) = user_id);

CREATE POLICY "user_dish_interactions: owner insert"
  ON public.user_dish_interactions FOR INSERT TO authenticated
  WITH CHECK ((select auth.uid()) = user_id);

-- ---------------------------------------------------------------------------
-- user_points -- own-row select / insert.
-- ---------------------------------------------------------------------------
ALTER TABLE public.user_points ENABLE ROW LEVEL SECURITY;

CREATE POLICY "user_points: owner select"
  ON public.user_points FOR SELECT TO authenticated
  USING ((select auth.uid()) = user_id);

CREATE POLICY "user_points: owner insert"
  ON public.user_points FOR INSERT TO authenticated
  WITH CHECK ((select auth.uid()) = user_id);

CREATE INDEX IF NOT EXISTS idx_user_points_user_id ON public.user_points(user_id);

-- ---------------------------------------------------------------------------
-- user_sessions -- own-row select / insert / update.
-- ---------------------------------------------------------------------------
ALTER TABLE public.user_sessions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "user_sessions: owner select"
  ON public.user_sessions FOR SELECT TO authenticated
  USING ((select auth.uid()) = user_id);

CREATE POLICY "user_sessions: owner insert"
  ON public.user_sessions FOR INSERT TO authenticated
  WITH CHECK ((select auth.uid()) = user_id);

CREATE POLICY "user_sessions: owner update"
  ON public.user_sessions FOR UPDATE TO authenticated
  USING ((select auth.uid()) = user_id)
  WITH CHECK ((select auth.uid()) = user_id);

CREATE INDEX IF NOT EXISTS idx_user_sessions_user_id ON public.user_sessions(user_id);

-- ---------------------------------------------------------------------------
-- user_visits -- own-row select / insert / update.
-- ---------------------------------------------------------------------------
ALTER TABLE public.user_visits ENABLE ROW LEVEL SECURITY;

CREATE POLICY "user_visits: owner select"
  ON public.user_visits FOR SELECT TO authenticated
  USING ((select auth.uid()) = user_id);

CREATE POLICY "user_visits: owner insert"
  ON public.user_visits FOR INSERT TO authenticated
  WITH CHECK ((select auth.uid()) = user_id);

CREATE POLICY "user_visits: owner update"
  ON public.user_visits FOR UPDATE TO authenticated
  USING ((select auth.uid()) = user_id)
  WITH CHECK ((select auth.uid()) = user_id);

CREATE INDEX IF NOT EXISTS idx_user_visits_user_id ON public.user_visits(user_id);

COMMIT;
