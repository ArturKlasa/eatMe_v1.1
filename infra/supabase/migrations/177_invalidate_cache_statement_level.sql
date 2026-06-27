-- 177_invalidate_cache_statement_level.sql
-- Created: 2026-06-26
--
-- Fixes the "canceling statement due to statement timeout" (57014) that operators
-- hit when confirming a large menu scan or publishing a restaurant with many
-- dishes (debug session: .planning/debug/publish-statement-timeout.md).
--
-- ROOT CAUSE
-- ──────────
-- Migration 176 wired feed-cache invalidation as a FOR EACH ROW, full-row trigger
-- (`_trg_invalidate_feed_cache`) on restaurants/menus/dishes. Every row write did
-- a Vault decrypt + net.http_post. Two compounding problems on bulk writes:
--   1. The enrich-dish trigger (mig 132) runs `UPDATE dishes SET enrichment_status`
--      inside its own AFTER-INSERT body; because the invalidate trigger is full-row
--      and unscoped, that nested UPDATE RE-FIRED invalidate → a second decrypt +
--      http_post per dish (and the original INSERT fired it too).
--   2. The confirm RPC inserts every dish/group/option in one transaction, so the
--      per-row fan-out is O(N)–O(3N) inside a single PostgREST statement. On large
--      sucursal menus this blows past statement_timeout.
-- (If the legacy dashboard Database Webhook was never disabled — see 176's header —
--  every flush also fired twice, doubling the work again.)
--
-- THE FIX (D-08 flush-all stays; we just stop firing it per-row)
-- ─────────────────────────────────────────────────────────────
-- The feed cache key is `feed:v2:*` — restaurant-AGNOSTIC, so invalidate-cache
-- always does a single flush-all and the per-restaurant key block is best-effort.
-- Those per-restaurant keys (`restaurant:{id}`, `restaurant:cuisines:{id}`) are
-- WRITTEN (deleted) only by invalidate-cache and READ by nothing — confirmed dead.
-- So a row-level trigger buys us nothing; one flush per write statement is enough.
--
-- This migration replaces the 3 row-level triggers with STATEMENT-level triggers
-- backed by transition tables, gated on relevance:
--   • restaurants — any change flushes once per statement.
--   • menus/dishes — flush ONLY when a 'published' row is involved. Drafts are not
--     in the feed, so a confirm (all-draft inserts) flushes NOTHING; a publish
--     (draft→published) or an edit of an already-published row flushes once.
-- A pg_trigger_depth() guard makes a nested write (the enrich self-UPDATE) a no-op.
--
-- Net effect: publish goes from O(N) http_post to O(1); confirm's invalidate
-- fan-out drops to zero. (The enrich trigger's own per-dish enqueue is untouched —
-- it no longer cascades and is the only remaining per-row HTTP on confirm.)
--
-- NOTE: this is the repo's first use of trigger transition tables (REFERENCING
-- NEW/OLD TABLE). A statement-level trigger can't carry per-row NEW/OLD, so the
-- old `_trg_invalidate_feed_cache` (kept intact for the reverse migration) is NOT
-- reused — a new `_trg_invalidate_feed_cache_stmt` is introduced instead.
--
-- ⚠️  Operator action at apply time: confirm the legacy dashboard Database Webhook
--    for invalidate-cache is DISABLED/DELETED (176 already warned). If it's still
--    on it keeps firing per-row, defeating this fix.

BEGIN;

-- ── statement-level invalidation function ─────────────────────────────────────
CREATE OR REPLACE FUNCTION public._trg_invalidate_feed_cache_stmt()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''   -- hardening (176 precedent): every reference below is
                       -- schema-qualified (vault.*, net.*), a pg_catalog builtin
                       -- (pg_trigger_depth, jsonb_build_object), or a transition
                       -- table alias (newrows/oldrows — resolved specially, not via
                       -- search_path), so '' breaks nothing.
AS $function$
DECLARE
  v_url      TEXT := 'https://tqroqqvxabolydyznewa.supabase.co/functions/v1/invalidate-cache';  -- same project ref as 176:60
  v_key      TEXT;
  v_relevant boolean := false;
BEGIN
  -- Never fire from inside another trigger's nested write (e.g. the enrich
  -- self-UPDATE of enrichment_status). The top-level statement already flushes.
  IF pg_trigger_depth() > 1 THEN
    RETURN NULL;
  END IF;

  -- Relevance gate: only feed-visible writes need a flush. Drafts are not in the
  -- feed. Each statement-level trigger declares exactly the transition table valid
  -- for its event, so we branch on TG_OP and only touch the one that exists.
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

  -- Statement-level can't carry per-row data; record/old_record are NULL.
  -- invalidate-cache treats that as a clean flush-all (feed:v2:*) and skips the
  -- dead per-restaurant key block (restaurantId resolves null → no-op).
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

-- ── drop the migration-176 row-level triggers ─────────────────────────────────
DROP TRIGGER IF EXISTS trg_invalidate_cache_on_restaurant_change ON public.restaurants;
DROP TRIGGER IF EXISTS trg_invalidate_cache_on_menu_change       ON public.menus;
DROP TRIGGER IF EXISTS trg_invalidate_cache_on_dish_change       ON public.dishes;

-- ── restaurants: one statement-level trigger (always relevant, no transition table)
CREATE TRIGGER trg_invalidate_cache_on_restaurant_change
  AFTER INSERT OR UPDATE OR DELETE ON public.restaurants
  FOR EACH STATEMENT
  EXECUTE FUNCTION public._trg_invalidate_feed_cache_stmt();

-- ── menus: per-op statement-level triggers (transition tables for the published gate)
DROP TRIGGER IF EXISTS trg_invalidate_cache_on_menu_insert ON public.menus;
CREATE TRIGGER trg_invalidate_cache_on_menu_insert
  AFTER INSERT ON public.menus
  REFERENCING NEW TABLE AS newrows
  FOR EACH STATEMENT
  EXECUTE FUNCTION public._trg_invalidate_feed_cache_stmt();

DROP TRIGGER IF EXISTS trg_invalidate_cache_on_menu_update ON public.menus;
CREATE TRIGGER trg_invalidate_cache_on_menu_update
  AFTER UPDATE ON public.menus
  REFERENCING NEW TABLE AS newrows OLD TABLE AS oldrows
  FOR EACH STATEMENT
  EXECUTE FUNCTION public._trg_invalidate_feed_cache_stmt();

DROP TRIGGER IF EXISTS trg_invalidate_cache_on_menu_delete ON public.menus;
CREATE TRIGGER trg_invalidate_cache_on_menu_delete
  AFTER DELETE ON public.menus
  REFERENCING OLD TABLE AS oldrows
  FOR EACH STATEMENT
  EXECUTE FUNCTION public._trg_invalidate_feed_cache_stmt();

-- ── dishes: per-op statement-level triggers ───────────────────────────────────
DROP TRIGGER IF EXISTS trg_invalidate_cache_on_dish_insert ON public.dishes;
CREATE TRIGGER trg_invalidate_cache_on_dish_insert
  AFTER INSERT ON public.dishes
  REFERENCING NEW TABLE AS newrows
  FOR EACH STATEMENT
  EXECUTE FUNCTION public._trg_invalidate_feed_cache_stmt();

DROP TRIGGER IF EXISTS trg_invalidate_cache_on_dish_update ON public.dishes;
CREATE TRIGGER trg_invalidate_cache_on_dish_update
  AFTER UPDATE ON public.dishes
  REFERENCING NEW TABLE AS newrows OLD TABLE AS oldrows
  FOR EACH STATEMENT
  EXECUTE FUNCTION public._trg_invalidate_feed_cache_stmt();

DROP TRIGGER IF EXISTS trg_invalidate_cache_on_dish_delete ON public.dishes;
CREATE TRIGGER trg_invalidate_cache_on_dish_delete
  AFTER DELETE ON public.dishes
  REFERENCING OLD TABLE AS oldrows
  FOR EACH STATEMENT
  EXECUTE FUNCTION public._trg_invalidate_feed_cache_stmt();

COMMIT;
