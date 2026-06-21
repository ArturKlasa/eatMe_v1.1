-- 176_invalidate_cache_triggers.sql
-- Created: 2026-06-21
--
-- Codifies the dashboard-configured feed-cache invalidation webhook as a
-- tracked, public-schema trigger and WIDENS its coverage to INSERT + UPDATE +
-- DELETE on restaurants / menus / dishes (codify-drift, Phase 3 precedent).
--
-- Context (F-21 / Phase 7 PERF-03 SC#4):
--   The invalidate-cache Edge Function was previously invoked by a Supabase
--   dashboard Database Webhook — which under the hood is a
--   `supabase_functions.http_request` trigger in the `supabase_functions`
--   schema, invisible to a `public`-schema trigger dump and documented as
--   UPDATE-only. That left two problems: (a) the wiring lived outside the repo
--   (untracked drift) and (b) INSERT and DELETE events never busted the cache.
--
--   This migration makes the wiring a tracked `public`-schema `net.http_post`
--   trigger (the in-repo backend→edge pattern established by migrations 132/135,
--   NOT `supabase_functions.http_request`) and widens coverage to all three
--   write events. The trigger is fire-and-forget: a failure (Vault secret
--   missing, pg_net error) NEVER blocks or rolls back the originating write.
--
-- ⚠️  Per-environment prerequisite (Vault secret):
--   Before applying this migration on a new environment, you MUST first store
--   the service-role JWT in Vault:
--
--     SELECT vault.create_secret(
--       '<service-role JWT for this project>',
--       'invalidate_cache_service_key',
--       'Service-role JWT used by _trg_invalidate_feed_cache'
--     );
--
--   Without that secret, the trigger logs a WARNING and skips the http_post on
--   every restaurant/menu/dish change (fail-soft, never blocks the write).
--   invalidate-cache will simply not be invoked and the feed cache falls back
--   to TTL-only (5 min) staleness.
--
-- ⚠️  Operator action at apply time (avoid double-flush):
--   DISABLE or DELETE the existing untracked dashboard Database Webhook for
--   invalidate-cache BEFORE/AT apply, otherwise BOTH the dashboard webhook and
--   this tracked trigger fire on every write (a harmless but wasteful double
--   cache flush).
--
-- Webhook body shape (must match invalidate-cache/index.ts parsing):
--   { type, table, schema, record, old_record }
--   On DELETE: record IS NULL, old_record IS to_jsonb(OLD).
--   On INSERT: old_record IS NULL, record IS to_jsonb(NEW).

BEGIN;

CREATE OR REPLACE FUNCTION public._trg_invalidate_feed_cache()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''   -- hardening: a SECURITY DEFINER fn must pin its search_path so it
                       -- can't be hijacked via an attacker-controlled schema. Safe here:
                       -- every reference below is schema-qualified (vault.*, net.*) or a
                       -- pg_catalog builtin (implicitly resolved), so '' breaks nothing.
AS $function$
DECLARE
  v_url TEXT := 'https://tqroqqvxabolydyznewa.supabase.co/functions/v1/invalidate-cache';  -- same project ref as migration 132:43
  v_key TEXT;
BEGIN
  SELECT decrypted_secret INTO v_key
  FROM vault.decrypted_secrets
  WHERE name = 'invalidate_cache_service_key';

  IF v_key IS NULL THEN
    RAISE WARNING 'invalidate_cache_service_key not in vault';
    RETURN COALESCE(NEW, OLD);
  END IF;

  -- Fire-and-forget: PERFORM (not awaited), so a pg_net failure can never block
  -- or roll back the originating write. Body shape matches the Supabase DB-webhook
  -- contract invalidate-cache already parses (type/table/schema/record/old_record).
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

-- ── triggers ────────────────────────────────────────────────────────────────
-- Each trigger is AFTER (insert/update/delete), FOR EACH ROW. Full-row (no column
-- scoping): the feed depends on more than name/description, so any write invalidates.
-- Idempotent (DROP IF EXISTS + CREATE), 135 pattern.

DROP TRIGGER IF EXISTS trg_invalidate_cache_on_restaurant_change ON public.restaurants;
CREATE TRIGGER trg_invalidate_cache_on_restaurant_change
  AFTER INSERT OR UPDATE OR DELETE ON public.restaurants
  FOR EACH ROW
  EXECUTE FUNCTION public._trg_invalidate_feed_cache();

DROP TRIGGER IF EXISTS trg_invalidate_cache_on_menu_change ON public.menus;
CREATE TRIGGER trg_invalidate_cache_on_menu_change
  AFTER INSERT OR UPDATE OR DELETE ON public.menus
  FOR EACH ROW
  EXECUTE FUNCTION public._trg_invalidate_feed_cache();

DROP TRIGGER IF EXISTS trg_invalidate_cache_on_dish_change ON public.dishes;
CREATE TRIGGER trg_invalidate_cache_on_dish_change
  AFTER INSERT OR UPDATE OR DELETE ON public.dishes
  FOR EACH ROW
  EXECUTE FUNCTION public._trg_invalidate_feed_cache();

COMMIT;
