-- 166_embed_recovery_raise_pgnet_timeout.sql
-- Created: 2026-06-12
--
-- The actual fix for the embed-recovery cron's silent delivery failure.
--
-- Diagnosis (net._http_response, 2026-06-12)
-- ──────────────────────────────────────────
-- The vault secret exists and the apikey header (165) is correct — pg_net DOES
-- reach enrich-dish and gets 200s on warm calls. But a large fraction of calls
-- record `status_code = NULL, "Timeout of 5000 ms reached"`, with the TCP/SSL
-- handshake ALONE taking ~3.6s. That's an enrich-dish cold start consuming
-- almost the entire default 5000ms pg_net budget; the call is aborted before
-- enrich-dish can run its OpenAI embedding + write-back, so the dish stays
-- 'failed'. Because the cron fires only every 5 minutes, enrich-dish is usually
-- cold when it's called, so recovery almost always hit the cold-start timeout —
-- which is why it appeared to never work.
--
-- The fix
-- ───────
-- Pass an explicit, generous timeout to net.http_post (30s) so a cold-started
-- enrich-dish has room to complete the handshake, the embedding call, and the
-- status write. The cron is fire-and-forget (it never reads the response); the
-- longer timeout only keeps the connection open long enough for enrich-dish to
-- finish. Body otherwise identical to migration 165.

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
      url                  := v_url,
      body                 := jsonb_build_object('dish_id', v_dish_id),
      headers              := jsonb_build_object(
                                'Content-Type',  'application/json',
                                'apikey',        v_key,
                                'Authorization', 'Bearer ' || v_key
                              ),
      timeout_milliseconds := 30000
    );
    v_count := v_count + 1;
  END LOOP;

  IF v_count > 0 THEN
    RAISE NOTICE 'embed-recovery-tick: enqueued % dishes', v_count;
  END IF;
END;
$function$;

COMMIT;
