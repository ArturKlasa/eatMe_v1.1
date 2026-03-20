-- 058_batch_preference_vector_cron.sql
-- Created: 2026-03-19
--
-- Phase 6: Behaviour Profile Pipeline — daily batch fallback
--
-- 1. Helper RPC: get_users_needing_vector_update
--    Returns up to p_limit users whose preference_vector is stale (>24h old
--    or NULL) AND who have at least one interaction newer than their last
--    vector update. Called by the batch-update-preference-vectors Edge Function.
--
-- 2. pg_cron schedule
--    Calls the batch Edge Function once per day at 03:00 UTC via pg_net
--    (net.http_post). Requires pg_cron and pg_net extensions to be enabled
--    in the Supabase project (Dashboard → Database → Extensions).

-- ── Helper function ───────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION get_users_needing_vector_update(p_limit integer DEFAULT 200)
RETURNS TABLE(user_id uuid)
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
  SELECT DISTINCT udi.user_id
  FROM user_dish_interactions udi
  LEFT JOIN user_behavior_profiles ubp ON ubp.user_id = udi.user_id
  WHERE
    -- Vector is missing or was last updated more than 24 hours ago
    (
      ubp.preference_vector_updated_at IS NULL
      OR ubp.preference_vector_updated_at < NOW() - INTERVAL '24 hours'
    )
    -- And there is at least one interaction newer than the last vector update
    AND udi.created_at > COALESCE(ubp.preference_vector_updated_at, '1970-01-01'::timestamptz)
  ORDER BY udi.user_id
  LIMIT p_limit;
$$;

-- ── pg_cron job ───────────────────────────────────────────────────────────────
-- Requires: pg_cron + pg_net extensions enabled in Supabase Dashboard.
-- The job fires daily at 03:00 UTC and calls the batch Edge Function via HTTP.
-- Replace <PROJECT_REF> with your Supabase project reference if using a
-- hardcoded URL, or rely on the app.settings.supabase_url config below.

DO $$
DECLARE
  v_supabase_url text;
  v_service_role_key text;
BEGIN
  -- Read project URL and service key from Supabase vault / app settings.
  -- These are set automatically by Supabase in the pg_net context.
  v_supabase_url    := current_setting('app.settings.supabase_url',    true);
  v_service_role_key := current_setting('app.settings.service_role_key', true);

  -- Only schedule if pg_cron is available and we have the required settings.
  IF v_supabase_url IS NOT NULL AND v_service_role_key IS NOT NULL THEN
    PERFORM cron.schedule(
      'batch-preference-vector-update',   -- job name (unique)
      '0 3 * * *',                        -- daily at 03:00 UTC
      format(
        $$
          SELECT net.http_post(
            url     := %L || '/functions/v1/batch-update-preference-vectors',
            headers := jsonb_build_object(
              'Content-Type',  'application/json',
              'Authorization', 'Bearer ' || %L
            ),
            body    := '{}'::jsonb
          );
        $$,
        v_supabase_url,
        v_service_role_key
      )
    );
    RAISE NOTICE 'pg_cron job scheduled: batch-preference-vector-update';
  ELSE
    RAISE NOTICE 'Skipping pg_cron setup: app.settings.supabase_url or service_role_key not configured. Schedule manually via Supabase Dashboard → Database → Cron Jobs.';
  END IF;

EXCEPTION
  WHEN undefined_function THEN
    RAISE NOTICE 'pg_cron not available. Schedule manually via Supabase Dashboard → Database → Cron Jobs.';
END;
$$;
