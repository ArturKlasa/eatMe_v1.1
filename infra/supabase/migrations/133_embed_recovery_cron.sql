-- 133_embed_recovery_cron.sql
-- Created: 2026-05-15
--
-- Adds an automatic recovery sweep for dishes stuck at enrichment_status
-- 'pending' or 'failed' with no embedding.
--
-- Without this safety net, a transient failure in the synchronous live path
-- (trigger → enrich-dish → embedding write) leaves dishes silently broken:
-- they pass the admin UI confirm flow but never appear (or appear demoted) in
-- the consumer feed because they have no vector to compare against the
-- preference_vector.
--
-- Design:
--   1. Partial index narrows the cron's lookup to broken rows only.
--   2. _cron_embed_recovery_tick() loads the service-role JWT from Vault, then
--      enqueues one net.http_post per candidate dish directly to enrich-dish.
--      pg_net handles concurrency; we don't need a separate batch Edge Fn.
--   3. cron.schedule fires the function every 5 minutes.
--
-- Tuning knobs:
--   - Schedule: every 5 min keeps recovery latency low without flooding pg_net.
--   - LIMIT 100 per tick caps the worst-case burst on a backlog.
--   - 1-minute age guard avoids racing with the trigger's own in-flight call.
--
-- Per-environment prerequisite:
--   The Vault secret 'enrich_dish_service_key' must already exist (created
--   by migration 132). If it doesn't, the function logs a WARNING and skips.

BEGIN;

CREATE INDEX IF NOT EXISTS dishes_pending_embed_idx
  ON public.dishes (updated_at)
  WHERE enrichment_status IN ('pending', 'failed') AND embedding IS NULL;

CREATE OR REPLACE FUNCTION public._cron_embed_recovery_tick()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $function$
DECLARE
  v_key      TEXT;
  v_url      TEXT := 'https://tqroqqvxabolydyznewa.supabase.co/functions/v1/enrich-dish';
  v_dish_id  UUID;
  v_count    INT := 0;
BEGIN
  SELECT decrypted_secret INTO v_key
  FROM vault.decrypted_secrets
  WHERE name = 'enrich_dish_service_key';

  IF v_key IS NULL THEN
    RAISE WARNING 'enrich_dish_service_key not in vault; recovery tick skipped';
    RETURN;
  END IF;

  FOR v_dish_id IN
    SELECT id FROM public.dishes
    WHERE enrichment_status IN ('pending', 'failed')
      AND embedding IS NULL
      AND is_parent = false
      AND is_template = false
      AND updated_at < now() - interval '1 minute'
    ORDER BY updated_at ASC
    LIMIT 100
  LOOP
    PERFORM net.http_post(
      url     := v_url,
      body    := jsonb_build_object('dish_id', v_dish_id),
      headers := jsonb_build_object(
                   'Content-Type',  'application/json',
                   'Authorization', 'Bearer ' || v_key
                 )
    );
    v_count := v_count + 1;
  END LOOP;

  IF v_count > 0 THEN
    RAISE NOTICE 'embed-recovery-tick: enqueued % dishes', v_count;
  END IF;
END;
$function$;

SELECT cron.schedule(
  'embed-recovery-tick',
  '*/5 * * * *',
  $$SELECT public._cron_embed_recovery_tick();$$
);

COMMIT;
