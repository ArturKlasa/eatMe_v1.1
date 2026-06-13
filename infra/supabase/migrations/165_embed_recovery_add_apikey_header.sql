-- 165_embed_recovery_add_apikey_header.sql
-- Created: 2026-06-12
--
-- Fixes the embed-recovery cron's silent delivery failure.
--
-- The bug
-- ───────
-- _cron_embed_recovery_tick enqueues net.http_post calls to the enrich-dish Edge
-- Function with ONLY an `Authorization: Bearer <service-role>` header. enrich-dish
-- runs behind Supabase's API gateway with verify_jwt ON, and the gateway requires
-- an `apikey` header to route the request at all — exactly the 401 that bit
-- batch-embed.ts until it was fixed to send BOTH `apikey` and `Authorization`.
-- Without `apikey`, every recovery tick's request is rejected at the gateway and
-- the response (a 401) is buried in net._http_response, invisible to logs. Net
-- effect: the recovery cron has never actually re-enriched anything — stuck
-- dishes were only ever cleared by manual enrich-dish calls.
--
-- Verified 2026-06-12: a dish set to 'failed' was NOT recovered by the cron over
-- 100s, but a direct enrich-dish POST (apikey + Authorization) healed it in <1s.
--
-- The fix
-- ───────
-- Add the `apikey` header to the net.http_post call (same value as the bearer:
-- the service-role key from vault). Everything else is identical to the
-- migration-164 body.
--
-- NOTE: this assumes the vault secret `enrich_dish_service_key` exists and holds
-- the service-role key (created by migration 132). If it is missing, the function
-- still RETURNs early with a WARNING and enqueues nothing — verify separately.

BEGIN;

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
      AND (embedding IS NULL OR enrichment_status = 'failed')
      AND updated_at < now() - interval '1 minute'
    ORDER BY updated_at ASC
    LIMIT 100
  LOOP
    PERFORM net.http_post(
      url     := v_url,
      body    := jsonb_build_object('dish_id', v_dish_id),
      headers := jsonb_build_object(
                   'Content-Type',  'application/json',
                   'apikey',        v_key,
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

COMMIT;
