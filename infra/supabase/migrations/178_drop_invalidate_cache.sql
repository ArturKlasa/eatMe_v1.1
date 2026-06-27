-- 178_drop_invalidate_cache.sql
-- Created: 2026-06-27
--
-- Retires the discovery-feed cache-busting subsystem. The `feed` edge function
-- KEEPS its Redis cache (a heavy PostGIS + pgvector RPC — worth caching); we only
-- remove the EARLY busting, so feed entries now expire purely by their 300s TTL.
--
-- WHY
-- ───
-- After migration 177 made invalidation cheap (one flush per statement, only on
-- published-row writes), the sole remaining value of invalidate-cache was operator
-- convenience: a newly published / suspended restaurant showing in the DISCOVERY
-- feed within seconds instead of ≤5 min. We accept the ≤5-min TTL lag in exchange
-- for fewer moving parts (no Vault decrypt, no pg_net, no edge function, no trigger
-- machinery on the publish/confirm hot path). Correctness is unaffected:
--   • The mobile restaurant-detail screen reads `dishes` LIVE from Postgres
--     (uncached) — menu accuracy never depended on this.
--   • The 300s TTL already bounds discovery staleness.
--   • The per-restaurant keys (restaurant:{id}, restaurant:cuisines:{id}) were
--     written only by invalidate-cache and read by nothing — dead either way.
--
-- WHAT THIS DROPS (everything migrations 176 + 177 created that's still live)
-- ─────────────────────────────────────────────────────────────────────────
--   • the 7 statement-level triggers from mig 177
--   • public._trg_invalidate_feed_cache_stmt()  (mig 177's function)
--   • public._trg_invalidate_feed_cache()        (mig 176's legacy function, which
--     177 left intact only as its own rollback target)
--
-- After applying, the invalidate-cache edge function has no caller and can be
-- undeployed (`supabase functions delete invalidate-cache`); the
-- `invalidate_cache_service_key` Vault secret becomes dead and may be removed.
-- Both are out-of-band operator steps — this migration only touches the database.
--
-- Reverse: 178_REVERSE_ONLY_drop_invalidate_cache.sql restores the migration-177
-- state (both functions + the 7 statement-level triggers).

BEGIN;

-- ── drop the migration-177 statement-level triggers ───────────────────────────
DROP TRIGGER IF EXISTS trg_invalidate_cache_on_dish_delete       ON public.dishes;
DROP TRIGGER IF EXISTS trg_invalidate_cache_on_dish_update       ON public.dishes;
DROP TRIGGER IF EXISTS trg_invalidate_cache_on_dish_insert       ON public.dishes;
DROP TRIGGER IF EXISTS trg_invalidate_cache_on_menu_delete       ON public.menus;
DROP TRIGGER IF EXISTS trg_invalidate_cache_on_menu_update       ON public.menus;
DROP TRIGGER IF EXISTS trg_invalidate_cache_on_menu_insert       ON public.menus;
DROP TRIGGER IF EXISTS trg_invalidate_cache_on_restaurant_change ON public.restaurants;

-- ── drop the trigger functions (no remaining dependents) ──────────────────────
DROP FUNCTION IF EXISTS public._trg_invalidate_feed_cache_stmt();
DROP FUNCTION IF EXISTS public._trg_invalidate_feed_cache();

COMMIT;
