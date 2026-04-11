-- Migration 075: Fix Eat Together Feature — Security, Missing RPCs, and Session Expiry
-- Created: 2026-04-07
-- Description:
--   1. Private schema + security definer participant check (breaks RLS recursion)
--   2. Scoped SELECT policies on all 4 eat_together_* tables (replace open USING(true) policies)
--   3. generate_session_code() RPC — creates unique 6-char uppercase alphanumeric code (A-Z, 0-9; 36^6 ≈ 2.2B space)
--   4. get_vote_results() RPC — aggregated vote results with participant guard
--   5. pg_cron job — expire stale sessions every 5 minutes

-- ============================================================================
-- SECTION 1.1: Private schema + security definer function
-- ============================================================================

-- Private schema is not exposed by Supabase API (safe for internal functions)
CREATE SCHEMA IF NOT EXISTS private;

-- Security definer: runs as function owner (bypasses RLS), not as caller.
-- SET search_path = '' prevents search-path injection attacks.
-- (SELECT auth.uid()) enables initPlan caching per statement.
CREATE OR REPLACE FUNCTION private.is_eat_together_participant(p_session_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.eat_together_members
    WHERE session_id = p_session_id
      AND user_id = (SELECT auth.uid())
      AND left_at IS NULL
  );
END;
$$;

-- ============================================================================
-- SECTION 1.2: Fix RLS SELECT policies on all 4 eat_together_* tables
--
-- Migration 019 deployed these SELECT policies (now broken/leaky):
--   eat_together_sessions:       "Users can view their own sessions or sessions they created"  → host_id = auth.uid() only
--   eat_together_members:        "Users can view members"                                       → USING(true)
--   eat_together_recommendations:"Users can view recommendations"                               → USING(true)
--   eat_together_votes:          "Users can view votes"                                         → USING(true)
--
-- All four are dropped and replaced with scoped policies below.
-- INSERT/UPDATE policies are intentionally left unchanged.
-- ============================================================================

-- ---- eat_together_sessions ----
DROP POLICY IF EXISTS "Users can view their own sessions or sessions they created"
  ON public.eat_together_sessions;

-- Host OR active non-host member can view the session.
-- Also allows any authenticated user to read 'waiting' sessions so they can
-- look up a session by code before joining (the join flow would break otherwise).
-- (SELECT private.is_eat_together_participant(id)) wrapping enables initPlan caching.
CREATE POLICY "Users can view sessions they participate in"
  ON public.eat_together_sessions
  FOR SELECT
  USING (
    auth.uid() = host_id
    OR (SELECT private.is_eat_together_participant(id))
    OR status = 'waiting'
  );

-- ---- eat_together_members ----
DROP POLICY IF EXISTS "Users can view members"
  ON public.eat_together_members;

-- User can see their own row OR any row in a session they belong to.
CREATE POLICY "Participants can view session members"
  ON public.eat_together_members
  FOR SELECT
  USING (
    auth.uid() = user_id
    OR (SELECT private.is_eat_together_participant(session_id))
  );

-- ---- eat_together_recommendations ----
DROP POLICY IF EXISTS "Users can view recommendations"
  ON public.eat_together_recommendations;

-- Only active session participants can see recommendations.
CREATE POLICY "Participants can view session recommendations"
  ON public.eat_together_recommendations
  FOR SELECT
  USING (
    (SELECT private.is_eat_together_participant(session_id))
  );

-- ---- eat_together_votes ----
DROP POLICY IF EXISTS "Users can view votes"
  ON public.eat_together_votes;

-- Only active session participants can see votes.
CREATE POLICY "Participants can view session votes"
  ON public.eat_together_votes
  FOR SELECT
  USING (
    (SELECT private.is_eat_together_participant(session_id))
  );

-- ============================================================================
-- SECTION 1.3: Missing RPC functions
-- ============================================================================

-- generate_session_code()
-- Called by eatTogetherService.ts (line 79) to create a unique 6-char session code.
-- Loops until a collision-free code is found (virtually always first try).
CREATE OR REPLACE FUNCTION public.generate_session_code()
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  code TEXT;
  code_exists BOOLEAN;
BEGIN
  LOOP
    -- Build a 6-char code from the full uppercase alphanumeric set (A-Z, 0-9 = 36 chars).
    -- Using random() per character gives a 36^6 ≈ 2.2 B code space vs md5's hex-only 16^6 ≈ 16 M.
    SELECT string_agg(
      substr('ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789', (floor(random() * 36) + 1)::int, 1),
      ''
    )
    INTO code
    FROM generate_series(1, 6);

    SELECT EXISTS (
      SELECT 1 FROM public.eat_together_sessions
      WHERE session_code = code
    ) INTO code_exists;
    EXIT WHEN NOT code_exists;
  END LOOP;
  RETURN code;
END;
$$;

-- get_vote_results()
-- Called by eatTogetherService.ts (line 370) to fetch aggregated vote tallies.
-- Verifies the caller is an active participant before returning data.
CREATE OR REPLACE FUNCTION public.get_vote_results(p_session_id UUID)
RETURNS TABLE (
  restaurant_id UUID,
  restaurant_name TEXT,
  restaurant_address TEXT,
  cuisine_types TEXT[],
  vote_count BIGINT,
  voters TEXT[]
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  -- Guard: only session participants may fetch results
  IF NOT private.is_eat_together_participant(p_session_id) THEN
    RAISE EXCEPTION 'Not a participant of this session';
  END IF;

  RETURN QUERY
  SELECT
    v.restaurant_id,
    r.name         AS restaurant_name,
    r.address      AS restaurant_address,
    r.cuisine_types,
    COUNT(*)::BIGINT AS vote_count,
    ARRAY_AGG(u.profile_name)::TEXT[] AS voters
  FROM public.eat_together_votes v
  JOIN public.restaurants  r ON r.id = v.restaurant_id
  JOIN public.users        u ON u.id = v.user_id
  WHERE v.session_id = p_session_id
  GROUP BY v.restaurant_id, r.name, r.address, r.cuisine_types
  ORDER BY vote_count DESC;
END;
$$;

-- Grant execute permissions so PostgREST (and supabase.rpc()) can call these functions.
-- Pattern matches migrations 071, 072, 073 which all grant to anon, authenticated, service_role.
GRANT EXECUTE ON FUNCTION public.generate_session_code() TO anon, authenticated, service_role;
-- get_vote_results has a participant guard so anon access is harmless, but authenticated is required.
GRANT EXECUTE ON FUNCTION public.get_vote_results(UUID) TO authenticated, service_role;

-- ============================================================================
-- SECTION 1.4: pg_cron session expiry job
-- ============================================================================

-- Runs every 5 minutes; transitions any session past its expires_at to 'expired'.
-- Skips sessions already in a terminal state (decided / cancelled / expired).
-- cron.schedule() is idempotent — safe to run in migrations.
SELECT cron.schedule(
  'expire-eat-together-sessions',
  '*/5 * * * *',
  $$
    UPDATE public.eat_together_sessions
    SET status = 'expired', closed_at = now()
    WHERE status NOT IN ('decided', 'cancelled', 'expired')
      AND expires_at < now()
  $$
);

-- ============================================================================
-- SUCCESS
-- ============================================================================
DO $$
BEGIN
  RAISE NOTICE '========================================';
  RAISE NOTICE 'Migration 075: Eat Together fixes applied';
  RAISE NOTICE '  - private.is_eat_together_participant() created';
  RAISE NOTICE '  - RLS SELECT policies scoped on all 4 tables';
  RAISE NOTICE '  - generate_session_code() RPC created';
  RAISE NOTICE '  - get_vote_results() RPC created';
  RAISE NOTICE '  - expire-eat-together-sessions cron job scheduled';
  RAISE NOTICE '  - GRANT EXECUTE on generate_session_code() + get_vote_results()';
  RAISE NOTICE '========================================';
END $$;
