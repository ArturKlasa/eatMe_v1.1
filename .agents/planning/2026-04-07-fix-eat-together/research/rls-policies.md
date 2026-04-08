# Research: RLS Policies

## Current State

Migrations 018 (initial schema) and 019 (RLS fix) have been **removed from the migrations directory** but exist in git history. The current deployed state reflects migration 019's simplified policies.

**Next migration number: 075**

## Migration 019's Fix (Currently Deployed)

Migration 019 fixed infinite recursion caused by circular cross-table RLS references in 018. The fix simplified all policies:

### eat_together_sessions
```sql
-- SELECT: Host-only (BROKEN for non-host members)
USING (auth.uid() = host_id)

-- INSERT: Host can insert own sessions
WITH CHECK (auth.uid() = host_id)

-- UPDATE: Host can update own sessions
USING (auth.uid() = host_id) WITH CHECK (auth.uid() = host_id)
```

### eat_together_members
```sql
-- SELECT: Open read (leaks cross-session data)
USING (true)

-- INSERT: Users can insert themselves
WITH CHECK (auth.uid() = user_id)

-- UPDATE (self): Users can update own record
USING (auth.uid() = user_id)

-- UPDATE (host): Host can update members in their sessions
USING (EXISTS (SELECT 1 FROM eat_together_sessions s WHERE s.id = session_id AND s.host_id = auth.uid()))
```

### eat_together_recommendations
```sql
-- SELECT: Open read (leaks cross-session data)
USING (true)

-- INSERT: Host can insert recommendations
WITH CHECK (EXISTS (SELECT 1 FROM eat_together_sessions WHERE id = session_id AND host_id = auth.uid()))
```

### eat_together_votes
```sql
-- SELECT: Open read (leaks cross-session data)
USING (true)

-- INSERT: Users can insert own vote
WITH CHECK (auth.uid() = user_id)

-- UPDATE: Users can update own vote
USING (auth.uid() = user_id)
```

## Problems

1. **Sessions SELECT blocks non-host members** — only `host_id = auth.uid()` check
2. **Members/Recommendations/Votes SELECT use USING(true)** — any authenticated user can read any session's data

## Supabase Best Practices for Security Definer Functions

Source: [Supabase RLS docs](https://supabase.com/docs/guides/database/postgres/row-level-security)

1. **Place in private schema** — never in exposed schemas
2. **Wrap in (SELECT ...)** — enables initPlan caching per statement (99%+ perf improvement)
3. **Set search_path** — `SET search_path = ''` for security
4. **Pattern:**
```sql
CREATE FUNCTION private.is_eat_together_participant(p_session_id UUID)
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
```

## Proposed New RLS Strategy

All tables use `is_eat_together_participant()` OR `host_id = auth.uid()` for SELECT, eliminating both the recursion problem and the data leakage problem.
