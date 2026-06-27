-- 178_REVERSE_ONLY_drop_invalidate_cache.sql
-- Reverse migration for 178_drop_invalidate_cache.sql
--
-- Restores the migration-177 state: recreates both trigger functions
-- (_trg_invalidate_feed_cache_stmt + the legacy _trg_invalidate_feed_cache) and
-- the 7 statement-level invalidate triggers. This brings back the CHEAP busting
-- setup (one flush per statement, published-row-gated) — NOT the slow row-level
-- one from migration 176.
--
-- ⚠️  After running this you must also REDEPLOY the invalidate-cache edge function
--    (deleted from the repo in this task) and ensure the
--    `invalidate_cache_service_key` Vault secret exists, or the triggers will only
--    RAISE WARNING / post to a dead endpoint and the feed falls back to TTL-only.
--
-- Bodies below are verbatim from 176 (_trg_invalidate_feed_cache) and 177
-- (_trg_invalidate_feed_cache_stmt + triggers).

BEGIN;

-- ── legacy row-level function (176) — recreated only so 177_REVERSE stays usable
CREATE OR REPLACE FUNCTION public._trg_invalidate_feed_cache()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $function$
DECLARE
  v_url TEXT := 'https://tqroqqvxabolydyznewa.supabase.co/functions/v1/invalidate-cache';
  v_key TEXT;
BEGIN
  SELECT decrypted_secret INTO v_key
  FROM vault.decrypted_secrets
  WHERE name = 'invalidate_cache_service_key';

  IF v_key IS NULL THEN
    RAISE WARNING 'invalidate_cache_service_key not in vault';
    RETURN COALESCE(NEW, OLD);
  END IF;

  PERFORM net.http_post(
    url     := v_url,
    body    := jsonb_build_object(
                 'type',       TG_OP,
                 'table',      TG_TABLE_NAME,
                 'schema',     TG_TABLE_SCHEMA,
                 'record',     CASE WHEN TG_OP = 'DELETE' THEN NULL ELSE to_jsonb(NEW) END,
                 'old_record', CASE WHEN TG_OP = 'INSERT' THEN NULL ELSE to_jsonb(OLD) END
               ),
    headers := jsonb_build_object(
                 'Content-Type',  'application/json',
                 'Authorization', 'Bearer ' || v_key
               )
  );

  RETURN COALESCE(NEW, OLD);
END;
$function$;

-- ── statement-level function (177) ────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public._trg_invalidate_feed_cache_stmt()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $function$
DECLARE
  v_url      TEXT := 'https://tqroqqvxabolydyznewa.supabase.co/functions/v1/invalidate-cache';
  v_key      TEXT;
  v_relevant boolean := false;
BEGIN
  IF pg_trigger_depth() > 1 THEN
    RETURN NULL;
  END IF;

  IF TG_TABLE_NAME = 'restaurants' THEN
    v_relevant := true;
  ELSIF TG_OP = 'INSERT' THEN
    SELECT EXISTS (SELECT 1 FROM newrows WHERE status = 'published') INTO v_relevant;
  ELSIF TG_OP = 'DELETE' THEN
    SELECT EXISTS (SELECT 1 FROM oldrows WHERE status = 'published') INTO v_relevant;
  ELSE  -- UPDATE
    SELECT EXISTS (SELECT 1 FROM newrows WHERE status = 'published')
        OR EXISTS (SELECT 1 FROM oldrows WHERE status = 'published')
      INTO v_relevant;
  END IF;

  IF NOT v_relevant THEN
    RETURN NULL;
  END IF;

  SELECT decrypted_secret INTO v_key
  FROM vault.decrypted_secrets
  WHERE name = 'invalidate_cache_service_key';

  IF v_key IS NULL THEN
    RAISE WARNING 'invalidate_cache_service_key not in vault';
    RETURN NULL;
  END IF;

  PERFORM net.http_post(
    url     := v_url,
    body    := jsonb_build_object(
                 'type',       TG_OP,
                 'table',      TG_TABLE_NAME,
                 'schema',     TG_TABLE_SCHEMA,
                 'record',     NULL,
                 'old_record', NULL
               ),
    headers := jsonb_build_object(
                 'Content-Type',  'application/json',
                 'Authorization', 'Bearer ' || v_key
               )
  );

  RETURN NULL;
END;
$function$;

-- ── restaurants: one statement-level trigger (no transition table) ─────────────
CREATE TRIGGER trg_invalidate_cache_on_restaurant_change
  AFTER INSERT OR UPDATE OR DELETE ON public.restaurants
  FOR EACH STATEMENT
  EXECUTE FUNCTION public._trg_invalidate_feed_cache_stmt();

-- ── menus: per-op statement-level triggers ────────────────────────────────────
CREATE TRIGGER trg_invalidate_cache_on_menu_insert
  AFTER INSERT ON public.menus
  REFERENCING NEW TABLE AS newrows
  FOR EACH STATEMENT
  EXECUTE FUNCTION public._trg_invalidate_feed_cache_stmt();

CREATE TRIGGER trg_invalidate_cache_on_menu_update
  AFTER UPDATE ON public.menus
  REFERENCING NEW TABLE AS newrows OLD TABLE AS oldrows
  FOR EACH STATEMENT
  EXECUTE FUNCTION public._trg_invalidate_feed_cache_stmt();

CREATE TRIGGER trg_invalidate_cache_on_menu_delete
  AFTER DELETE ON public.menus
  REFERENCING OLD TABLE AS oldrows
  FOR EACH STATEMENT
  EXECUTE FUNCTION public._trg_invalidate_feed_cache_stmt();

-- ── dishes: per-op statement-level triggers ───────────────────────────────────
CREATE TRIGGER trg_invalidate_cache_on_dish_insert
  AFTER INSERT ON public.dishes
  REFERENCING NEW TABLE AS newrows
  FOR EACH STATEMENT
  EXECUTE FUNCTION public._trg_invalidate_feed_cache_stmt();

CREATE TRIGGER trg_invalidate_cache_on_dish_update
  AFTER UPDATE ON public.dishes
  REFERENCING NEW TABLE AS newrows OLD TABLE AS oldrows
  FOR EACH STATEMENT
  EXECUTE FUNCTION public._trg_invalidate_feed_cache_stmt();

CREATE TRIGGER trg_invalidate_cache_on_dish_delete
  AFTER DELETE ON public.dishes
  REFERENCING OLD TABLE AS oldrows
  FOR EACH STATEMENT
  EXECUTE FUNCTION public._trg_invalidate_feed_cache_stmt();

COMMIT;
