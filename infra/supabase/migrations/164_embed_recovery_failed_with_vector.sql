-- 164_embed_recovery_failed_with_vector.sql
-- Created: 2026-06-12
--
-- Closes a blind spot in the embed-recovery cron (_cron_embed_recovery_tick,
-- last defined in migration 163 §5).
--
-- The bug
-- ───────
-- enrich-dish writes `embedding` and `enrichment_status='completed'` in a single
-- UPDATE; on UPDATE failure it stamps 'failed' (and its catch block leaves status
-- untouched). When the insert trigger fires enrich-dish twice for the same dish
-- (e.g. a menu-scan confirm followed by an edit, or two trigger events racing),
-- one pass can write the embedding while a later pass — whose UPDATE hit a
-- transient error (statement timeout, etc.) — stamps 'failed'. The row ends up
--   enrichment_status = 'failed'  AND  embedding IS NOT NULL.
--
-- The recovery loop only selected rows with `embedding IS NULL`, so these
-- failed-but-embedded rows were invisible to it and stayed 'failed' forever.
-- Observed 2026-06-12: 8 such rows from a single scan-confirm; all recovered
-- fine once enrich-dish was re-invoked manually.
--
-- The fix
-- ───────
-- Recover `failed` rows regardless of whether they carry an embedding. We
-- RE-EMBED them (call enrich-dish) rather than just relabel to 'completed',
-- because a failed-with-embedding row may carry a STALE vector (dish edited
-- after a prior completion) — re-embedding regenerates it from current content
-- and sets 'completed'. `pending` rows stay gated on `embedding IS NULL` (a
-- pending row with a vector is a normal just-finished/in-flight state; the
-- 1-minute age guard already covers the trigger race).
--
-- Cost: a transient failure clears on the next 5-min tick. A hypothetical
-- deterministically-failing row would re-embed once per tick (capped by LIMIT
-- 100) — negligible given how rare failures are in this single-operator app.

BEGIN;

-- Visibility only: report how many failed-but-embedded rows are present at apply
-- time. The widened function below re-embeds them on the next 5-minute tick; no
-- manual backfill is needed.
DO $$
DECLARE
  v_stuck INT;
BEGIN
  SELECT count(*) INTO v_stuck
  FROM public.dishes
  WHERE enrichment_status = 'failed' AND embedding IS NOT NULL;
  RAISE NOTICE '164: % failed-but-embedded dishes will be re-embedded by the next recovery tick', v_stuck;
END $$;

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
    -- 'failed' is recovered whether or not it already has a (possibly stale)
    -- embedding; 'pending' only when the embedding is genuinely missing.
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
