-- 177_REVERSE_ONLY_invalidate_cache_statement_level.sql
-- Reverse migration for 177_invalidate_cache_statement_level.sql
--
-- Restores migration 176's behaviour: drops the statement-level triggers and the
-- `_trg_invalidate_feed_cache_stmt` function, then re-creates the 3 row-level
-- triggers wired to the original `_trg_invalidate_feed_cache` (which 177 left
-- intact). Use only for a controlled rollback — note this brings back the per-row
-- fan-out that 177 fixed, so large confirm/publish operations may time out again.

BEGIN;

-- Drop the statement-level triggers (reverse order: dishes, menus, restaurants).
DROP TRIGGER IF EXISTS trg_invalidate_cache_on_dish_delete       ON public.dishes;
DROP TRIGGER IF EXISTS trg_invalidate_cache_on_dish_update       ON public.dishes;
DROP TRIGGER IF EXISTS trg_invalidate_cache_on_dish_insert       ON public.dishes;
DROP TRIGGER IF EXISTS trg_invalidate_cache_on_menu_delete       ON public.menus;
DROP TRIGGER IF EXISTS trg_invalidate_cache_on_menu_update       ON public.menus;
DROP TRIGGER IF EXISTS trg_invalidate_cache_on_menu_insert       ON public.menus;
DROP TRIGGER IF EXISTS trg_invalidate_cache_on_restaurant_change ON public.restaurants;

DROP FUNCTION IF EXISTS public._trg_invalidate_feed_cache_stmt();

-- Re-create the migration-176 row-level triggers (verbatim from 176:99-115),
-- pointing back at the original _trg_invalidate_feed_cache function.
CREATE TRIGGER trg_invalidate_cache_on_restaurant_change
  AFTER INSERT OR UPDATE OR DELETE ON public.restaurants
  FOR EACH ROW
  EXECUTE FUNCTION public._trg_invalidate_feed_cache();

CREATE TRIGGER trg_invalidate_cache_on_menu_change
  AFTER INSERT OR UPDATE OR DELETE ON public.menus
  FOR EACH ROW
  EXECUTE FUNCTION public._trg_invalidate_feed_cache();

CREATE TRIGGER trg_invalidate_cache_on_dish_change
  AFTER INSERT OR UPDATE OR DELETE ON public.dishes
  FOR EACH ROW
  EXECUTE FUNCTION public._trg_invalidate_feed_cache();

COMMIT;
