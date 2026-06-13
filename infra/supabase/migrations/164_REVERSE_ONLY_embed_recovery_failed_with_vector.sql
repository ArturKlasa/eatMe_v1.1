-- 164_REVERSE_ONLY_embed_recovery_failed_with_vector.sql
-- Reverse of 164: restores the recovery loop's WHERE clause to the migration-163
-- form (only rows with embedding IS NULL are recovered). Re-introduces the
-- failed-but-embedded blind spot — apply only if 164 must be rolled back.

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
      AND embedding IS NULL
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
