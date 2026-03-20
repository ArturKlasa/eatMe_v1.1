-- 058_batch_preference_vector_cron.sql
-- Created: 2026-03-19
--
-- Phase 6: Behaviour Profile Pipeline — batch fallback
--
-- 1. Helper RPC: get_users_needing_vector_update
--    Returns up to p_limit users whose preference_vector is stale (>24h old
--    or NULL) AND who have at least 5 new interactions since their last vector
--    update. The 5-interaction threshold avoids recomputing vectors for users
--    with negligible new data (cost control at scale).
--    Called by the batch-update-preference-vectors Edge Function.
--
-- 2. pg_cron schedule
--    Runs ONCE A WEEK (Mon at 03:00 UTC). Weekly is the right cadence because
--    the preference vector is a long-term taste profile — it shouldn't react
--    to individual meals. "I ate ramen so I want something different this week"
--    is a session-recency signal, not a vector concern (handled separately in
--    Stage 2 feed scoring).
--    The real-time trigger (update-preference-vector, 5-min debounce) handles
--    the new-user ramp-up case. This job is a safety net only.
--    Scheduled manually via Supabase Dashboard → Database → Cron Jobs.
--    Requires pg_cron + pg_net extensions enabled.

-- ── Helper function ───────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION get_users_needing_vector_update(p_limit integer DEFAULT 200)
RETURNS TABLE(user_id uuid)
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
  SELECT udi.user_id
  FROM user_dish_interactions udi
  LEFT JOIN user_behavior_profiles ubp ON ubp.user_id = udi.user_id
  WHERE
    -- Vector is missing or was last updated more than 24 hours ago
    (
      ubp.preference_vector_updated_at IS NULL
      OR ubp.preference_vector_updated_at < NOW() - INTERVAL '24 hours'
    )
    -- Only interactions newer than the last vector update count
    AND udi.created_at > COALESCE(ubp.preference_vector_updated_at, '1970-01-01'::timestamptz)
  GROUP BY udi.user_id
  -- Require at least 5 new interactions: avoids recomputing for users with
  -- negligible new signal (cost control — real-time trigger handles the rest).
  HAVING COUNT(*) >= 5
  ORDER BY udi.user_id
  LIMIT p_limit;
$$;

-- ── pg_cron job ───────────────────────────────────────────────────────────────
-- Requires: pg_cron + pg_net extensions enabled in Supabase Dashboard.
-- Runs Mon at 03:00 UTC (weekly — safety net only).
-- Scheduled manually: Dashboard → Database → Cron Jobs
--   Schedule:  0 3 * * 1

DO $do$
DECLARE
  v_supabase_url     text;
  v_service_role_key text;
  v_cmd              text;
BEGIN
  v_supabase_url     := current_setting('app.settings.supabase_url',     true);
  v_service_role_key := current_setting('app.settings.service_role_key', true);

  IF v_supabase_url IS NOT NULL AND v_service_role_key IS NOT NULL THEN
    -- Build the cron command using plain string concatenation (no nested
    -- dollar-quoting, which confuses the parser in some Postgres versions).
    v_cmd :=
      'SELECT net.http_post('
      || ' url := ' || quote_literal(v_supabase_url || '/functions/v1/batch-update-preference-vectors') || ','
      || ' headers := ' || quote_literal('{"Content-Type":"application/json","Authorization":"Bearer ' || v_service_role_key || '"}') || '::jsonb,'
      || ' body := ' || quote_literal('{}') || '::jsonb'
      || ');';

    PERFORM cron.schedule(
      'batch-preference-vector-update',  -- job name (unique, idempotent)
      '0 3 * * 1',                      -- Mon at 03:00 UTC (weekly)
      v_cmd
    );
    RAISE NOTICE 'pg_cron job scheduled: batch-preference-vector-update (Mon 03:00 UTC)';
  ELSE
    RAISE NOTICE 'Skipping pg_cron setup: app.settings.supabase_url or service_role_key not configured. Schedule manually via Supabase Dashboard → Database → Cron Jobs.';
  END IF;

EXCEPTION
  WHEN undefined_function THEN
    RAISE NOTICE 'pg_cron not available. Schedule manually via Supabase Dashboard → Database → Cron Jobs.';
END;
$do$;
