-- Eat Together Feature
-- Created: 2026-01-31
-- Description: Group dining coordination with location-based restaurant recommendations

-- ============================================================================
-- STEP 1: CREATE ENUMS
-- ============================================================================

-- Session status enum
DO $$ BEGIN
  CREATE TYPE session_status AS ENUM ('waiting', 'recommending', 'voting', 'decided', 'cancelled', 'expired');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- Location calculation mode enum
DO $$ BEGIN
  CREATE TYPE location_mode AS ENUM ('host_location', 'midpoint', 'max_radius');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- ============================================================================
-- STEP 2: CREATE EAT_TOGETHER_SESSIONS TABLE
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.eat_together_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  host_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  session_code TEXT NOT NULL UNIQUE,
  status session_status DEFAULT 'waiting',
  location_mode location_mode DEFAULT 'host_location',
  selected_restaurant_id UUID REFERENCES public.restaurants(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  expires_at TIMESTAMPTZ DEFAULT (NOW() + INTERVAL '3 hours'),
  closed_at TIMESTAMPTZ,
  
  CONSTRAINT valid_session_code CHECK (length(session_code) = 6)
);

-- Indexes
CREATE INDEX IF NOT EXISTS eat_together_sessions_host_id_idx ON public.eat_together_sessions(host_id);
CREATE INDEX IF NOT EXISTS eat_together_sessions_code_idx ON public.eat_together_sessions(session_code);
CREATE INDEX IF NOT EXISTS eat_together_sessions_status_idx ON public.eat_together_sessions(status);
CREATE INDEX IF NOT EXISTS eat_together_sessions_expires_at_idx ON public.eat_together_sessions(expires_at);

-- Enable RLS
ALTER TABLE public.eat_together_sessions ENABLE ROW LEVEL SECURITY;

-- RLS Policies (basic policies only, cross-table policies added later)
CREATE POLICY "Host can insert own sessions"
  ON public.eat_together_sessions
  FOR INSERT
  WITH CHECK (auth.uid() = host_id);

CREATE POLICY "Host can update own sessions"
  ON public.eat_together_sessions
  FOR UPDATE
  USING (auth.uid() = host_id)
  WITH CHECK (auth.uid() = host_id);

-- ============================================================================
-- STEP 3: CREATE EAT_TOGETHER_MEMBERS TABLE
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.eat_together_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID NOT NULL REFERENCES public.eat_together_sessions(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  is_host BOOLEAN DEFAULT false,
  current_location GEOGRAPHY(POINT),
  joined_at TIMESTAMPTZ DEFAULT NOW(),
  left_at TIMESTAMPTZ,
  
  CONSTRAINT unique_session_user UNIQUE(session_id, user_id)
);

-- Indexes
CREATE INDEX IF NOT EXISTS eat_together_members_session_id_idx ON public.eat_together_members(session_id);
CREATE INDEX IF NOT EXISTS eat_together_members_user_id_idx ON public.eat_together_members(user_id);
CREATE INDEX IF NOT EXISTS eat_together_members_location_idx ON public.eat_together_members USING GIST(current_location);

-- Enable RLS
ALTER TABLE public.eat_together_members ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Users can view members of their sessions"
  ON public.eat_together_members
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.eat_together_sessions s
      WHERE s.id = session_id 
      AND (s.host_id = auth.uid() OR EXISTS (
        SELECT 1 FROM public.eat_together_members m2
        WHERE m2.session_id = s.id AND m2.user_id = auth.uid()
      ))
    )
  );

CREATE POLICY "Users can insert themselves as members"
  ON public.eat_together_members
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own member record"
  ON public.eat_together_members
  FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Host can update any member in their session"
  ON public.eat_together_members
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.eat_together_sessions
      WHERE id = session_id AND host_id = auth.uid()
    )
  );

-- ============================================================================
-- STEP 4: CREATE EAT_TOGETHER_RECOMMENDATIONS TABLE
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.eat_together_recommendations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID NOT NULL REFERENCES public.eat_together_sessions(id) ON DELETE CASCADE,
  restaurant_id UUID NOT NULL REFERENCES public.restaurants(id) ON DELETE CASCADE,
  compatibility_score INTEGER NOT NULL,
  distance_from_center FLOAT,
  members_satisfied INTEGER NOT NULL,
  total_members INTEGER NOT NULL,
  dietary_compatibility JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  
  CONSTRAINT unique_session_restaurant UNIQUE(session_id, restaurant_id)
);

-- Indexes
CREATE INDEX IF NOT EXISTS eat_together_recommendations_session_id_idx ON public.eat_together_recommendations(session_id);
CREATE INDEX IF NOT EXISTS eat_together_recommendations_restaurant_id_idx ON public.eat_together_recommendations(restaurant_id);
CREATE INDEX IF NOT EXISTS eat_together_recommendations_score_idx ON public.eat_together_recommendations(compatibility_score DESC);

-- Enable RLS
ALTER TABLE public.eat_together_recommendations ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Users can view recommendations for their sessions"
  ON public.eat_together_recommendations
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.eat_together_sessions s
      WHERE s.id = session_id 
      AND (s.host_id = auth.uid() OR EXISTS (
        SELECT 1 FROM public.eat_together_members m
        WHERE m.session_id = s.id AND m.user_id = auth.uid()
      ))
    )
  );

CREATE POLICY "Host can insert recommendations"
  ON public.eat_together_recommendations
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.eat_together_sessions
      WHERE id = session_id AND host_id = auth.uid()
    )
  );

-- ============================================================================
-- STEP 5: CREATE EAT_TOGETHER_VOTES TABLE
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.eat_together_votes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID NOT NULL REFERENCES public.eat_together_sessions(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  restaurant_id UUID NOT NULL REFERENCES public.restaurants(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  
  CONSTRAINT unique_user_session_vote UNIQUE(session_id, user_id)
);

-- Indexes
CREATE INDEX IF NOT EXISTS eat_together_votes_session_id_idx ON public.eat_together_votes(session_id);
CREATE INDEX IF NOT EXISTS eat_together_votes_restaurant_id_idx ON public.eat_together_votes(restaurant_id);

-- Enable RLS
ALTER TABLE public.eat_together_votes ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Users can view votes for their sessions"
  ON public.eat_together_votes
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.eat_together_sessions s
      WHERE s.id = session_id 
      AND (s.host_id = auth.uid() OR EXISTS (
        SELECT 1 FROM public.eat_together_members m
        WHERE m.session_id = s.id AND m.user_id = auth.uid()
      ))
    )
  );

CREATE POLICY "Users can insert their own vote"
  ON public.eat_together_votes
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own vote"
  ON public.eat_together_votes
  FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- ============================================================================
-- STEP 6: ADD CROSS-TABLE RLS POLICIES
-- ============================================================================

-- Now that all tables exist, add policies that reference other tables

-- Sessions: Users can view sessions they're member of
CREATE POLICY "Users can view sessions they're member of"
  ON public.eat_together_sessions
  FOR SELECT
  USING (
    auth.uid() = host_id 
    OR EXISTS (
      SELECT 1 FROM public.eat_together_members 
      WHERE session_id = eat_together_sessions.id 
      AND user_id = auth.uid()
      AND left_at IS NULL
    )
  );

-- ============================================================================
-- STEP 7: HELPER FUNCTIONS
-- ============================================================================

-- Function to generate unique 6-character session code
CREATE OR REPLACE FUNCTION generate_session_code()
RETURNS TEXT AS $$
DECLARE
  chars TEXT := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; -- Excludes confusing chars (I,O,0,1)
  result TEXT := '';
  i INTEGER;
BEGIN
  FOR i IN 1..6 LOOP
    result := result || substr(chars, floor(random() * length(chars) + 1)::int, 1);
  END LOOP;
  
  -- Check if code already exists
  IF EXISTS (SELECT 1 FROM eat_together_sessions WHERE session_code = result) THEN
    RETURN generate_session_code(); -- Recursive retry
  END IF;
  
  RETURN result;
END;
$$ LANGUAGE plpgsql;

-- Function to get active members count
CREATE OR REPLACE FUNCTION get_active_members_count(p_session_id UUID)
RETURNS INTEGER AS $$
BEGIN
  RETURN (
    SELECT COUNT(*)
    FROM eat_together_members
    WHERE session_id = p_session_id 
    AND left_at IS NULL
  );
END;
$$ LANGUAGE plpgsql;

-- Function to check if user is session host
CREATE OR REPLACE FUNCTION is_session_host(p_session_id UUID, p_user_id UUID)
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM eat_together_sessions
    WHERE id = p_session_id AND host_id = p_user_id
  );
END;
$$ LANGUAGE plpgsql;

-- Function to calculate vote results
CREATE OR REPLACE FUNCTION get_vote_results(p_session_id UUID)
RETURNS TABLE (
  restaurant_id UUID,
  vote_count BIGINT,
  total_voters BIGINT,
  percentage FLOAT
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    v.restaurant_id,
    COUNT(*) as vote_count,
    (SELECT COUNT(*) FROM eat_together_votes WHERE session_id = p_session_id) as total_voters,
    (COUNT(*)::FLOAT / NULLIF((SELECT COUNT(*) FROM eat_together_votes WHERE session_id = p_session_id), 0) * 100) as percentage
  FROM eat_together_votes v
  WHERE v.session_id = p_session_id
  GROUP BY v.restaurant_id
  ORDER BY vote_count DESC;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- STEP 8: AUTOMATIC SESSION EXPIRY (Future Enhancement)
-- ============================================================================

-- Function to mark expired sessions
CREATE OR REPLACE FUNCTION expire_old_sessions()
RETURNS INTEGER AS $$
DECLARE
  expired_count INTEGER;
BEGIN
  UPDATE eat_together_sessions
  SET status = 'expired'
  WHERE status IN ('waiting', 'recommending', 'voting')
  AND expires_at < NOW();
  
  GET DIAGNOSTICS expired_count = ROW_COUNT;
  RETURN expired_count;
END;
$$ LANGUAGE plpgsql;

-- Note: You can run this via cron job or Edge Function
-- SELECT expire_old_sessions();

-- ============================================================================
-- SUCCESS MESSAGE
-- ============================================================================
DO $$ 
BEGIN
  RAISE NOTICE '========================================';
  RAISE NOTICE 'Eat Together feature created successfully!';
  RAISE NOTICE '========================================';
  RAISE NOTICE 'Tables created:';
  RAISE NOTICE '  ✓ eat_together_sessions';
  RAISE NOTICE '  ✓ eat_together_members';
  RAISE NOTICE '  ✓ eat_together_recommendations';
  RAISE NOTICE '  ✓ eat_together_votes';
  RAISE NOTICE '';
  RAISE NOTICE 'Helper functions:';
  RAISE NOTICE '  ✓ generate_session_code()';
  RAISE NOTICE '  ✓ get_active_members_count()';
  RAISE NOTICE '  ✓ is_session_host()';
  RAISE NOTICE '  ✓ get_vote_results()';
  RAISE NOTICE '  ✓ expire_old_sessions()';
  RAISE NOTICE '========================================';
END $$;
