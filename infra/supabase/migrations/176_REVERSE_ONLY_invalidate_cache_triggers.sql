-- 176_REVERSE_ONLY_invalidate_cache_triggers.sql
-- Reverse migration for 176_invalidate_cache_triggers.sql
--
-- WARNING (cache staleness): after this rollback, NO migration-tracked feed-cache
-- invalidation fires on restaurants/menus/dishes writes. If the untracked
-- dashboard Database Webhook was DISABLED/DELETED when 176 was applied, the feed
-- cache reverts to TTL-only staleness (5 min) until you re-create that webhook
-- (or re-apply 176). Controlled rollback only.
--
-- This drops exactly what 176 created: the 3 trg_invalidate_cache_on_* triggers
-- (reverse order: dishes, menus, restaurants) then the
-- public._trg_invalidate_feed_cache() function.

BEGIN;

DROP TRIGGER IF EXISTS trg_invalidate_cache_on_dish_change ON public.dishes;
DROP TRIGGER IF EXISTS trg_invalidate_cache_on_menu_change ON public.menus;
DROP TRIGGER IF EXISTS trg_invalidate_cache_on_restaurant_change ON public.restaurants;

DROP FUNCTION IF EXISTS public._trg_invalidate_feed_cache();

COMMIT;
