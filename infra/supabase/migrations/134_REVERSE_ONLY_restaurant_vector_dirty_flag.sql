-- 134_REVERSE_ONLY_restaurant_vector_dirty_flag.sql
-- Reverses 134_restaurant_vector_dirty_flag.sql.
--
-- Restores the per-row inline update_restaurant_vector call. After this
-- reverse, centroids recompute synchronously on every embedding write
-- (high RPC load for batch operations). Drops the cron and flag column.

BEGIN;

SELECT cron.unschedule('restaurant-vector-recompute');

DROP FUNCTION IF EXISTS public._cron_restaurant_vector_recompute();

CREATE OR REPLACE FUNCTION public._trg_after_dish_embedded()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $function$
BEGIN
  IF OLD.embedding IS DISTINCT FROM NEW.embedding AND NEW.embedding IS NOT NULL THEN
    PERFORM update_restaurant_vector(NEW.restaurant_id);
  END IF;
  RETURN NEW;
END;
$function$;

DROP INDEX IF EXISTS public.restaurants_dirty_idx;

ALTER TABLE public.restaurants
  DROP COLUMN IF EXISTS restaurant_vector_dirty_at;

COMMIT;
