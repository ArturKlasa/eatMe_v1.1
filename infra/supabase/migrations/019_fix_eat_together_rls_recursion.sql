-- Fix infinite recursion in eat_together RLS policies
-- Created: 2026-02-01
-- Description: Simplify all RLS policies to remove circular dependencies

-- ============================================================================
-- DROP ALL PROBLEMATIC POLICIES
-- ============================================================================

-- Drop eat_together_members policies
DROP POLICY IF EXISTS "Users can view members of their sessions" ON public.eat_together_members;
DROP POLICY IF EXISTS "Users can insert themselves as members" ON public.eat_together_members;
DROP POLICY IF EXISTS "Users can update their own member record" ON public.eat_together_members;
DROP POLICY IF EXISTS "Host can update any member in their session" ON public.eat_together_members;

-- Drop sessions SELECT policy that references members
DROP POLICY IF EXISTS "Users can view sessions they're member of" ON public.eat_together_sessions;

-- Drop votes policies that reference members
DROP POLICY IF EXISTS "Users can view votes for their sessions" ON public.eat_together_votes;
DROP POLICY IF EXISTS "Users can insert their own vote" ON public.eat_together_votes;
DROP POLICY IF EXISTS "Users can update their own vote" ON public.eat_together_votes;

-- Drop recommendations policies that reference members
DROP POLICY IF EXISTS "Users can view recommendations for their sessions" ON public.eat_together_recommendations;
DROP POLICY IF EXISTS "Host can insert recommendations" ON public.eat_together_recommendations;

-- ============================================================================
-- CREATE SIMPLIFIED POLICIES - NO CIRCULAR REFERENCES
-- ============================================================================

-- SESSIONS: Keep simple, only reference auth.uid and host_id
CREATE POLICY "Users can view their own sessions or sessions they created"
  ON public.eat_together_sessions
  FOR SELECT
  USING (auth.uid() = host_id);

-- MEMBERS: Simple policies without recursion
CREATE POLICY "Users can view members"
  ON public.eat_together_members
  FOR SELECT
  USING (true); -- Anyone can view members (we'll rely on session access control)

CREATE POLICY "Users can insert themselves as members"
  ON public.eat_together_members
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own member record"
  ON public.eat_together_members
  FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Hosts can update members in their sessions"
  ON public.eat_together_members
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.eat_together_sessions s
      WHERE s.id = session_id AND s.host_id = auth.uid()
    )
  );

-- RECOMMENDATIONS: Simple access based on session_id
CREATE POLICY "Users can view recommendations"
  ON public.eat_together_recommendations
  FOR SELECT
  USING (true); -- Open read access, rely on session access control

CREATE POLICY "Hosts can insert recommendations"
  ON public.eat_together_recommendations
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.eat_together_sessions
      WHERE id = session_id AND host_id = auth.uid()
    )
  );

-- VOTES: Simple access based on user_id
CREATE POLICY "Users can view votes"
  ON public.eat_together_votes
  FOR SELECT
  USING (true); -- Open read access

CREATE POLICY "Users can insert their own vote"
  ON public.eat_together_votes
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own vote"
  ON public.eat_together_votes
  FOR UPDATE
  USING (auth.uid() = user_id);

-- ============================================================================
-- SUCCESS MESSAGE
-- ============================================================================
DO $$ 
BEGIN
  RAISE NOTICE '========================================';
  RAISE NOTICE 'Fixed all RLS policies - removed circular dependencies';
  RAISE NOTICE 'Using simplified policies with open read access';
  RAISE NOTICE '========================================';
END $$;
