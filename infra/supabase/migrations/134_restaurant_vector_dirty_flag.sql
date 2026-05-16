-- 134_restaurant_vector_dirty_flag.sql
-- Created: 2026-05-15
--
-- Moves restaurant-centroid recomputation off the synchronous embedding-write
-- path. Per-dish embedding writes used to fire update_restaurant_vector(...)
-- inline via _trg_after_dish_embedded, meaning a 30-dish menu confirm caused
-- ~30 redundant centroid recomputes on the same restaurant.
--
-- New behavior:
--   1. _trg_after_dish_embedded writes restaurants.restaurant_vector_dirty_at
--      (with a 1-min per-row debounce) instead of calling the RPC directly.
--      In a 30-dish batch, the first row writes the flag, the next 29
--      short-circuit on the debounce guard.
--   2. A pg_cron job 'restaurant-vector-recompute' fires every 2 min,
--      processes up to 50 dirty restaurants per tick, and clears each
--      flag after a successful recompute.
--
-- Trade-off: centroids are now up to ~2 min stale, but per-restaurant RPC
-- load drops by a factor of (dishes_in_menu × menus_per_period).
--
-- Per-environment prerequisite: pg_cron extension enabled (already required
-- by migration 133).

BEGIN;

-- ── 1. Dirty flag column + partial index ────────────────────────────────

ALTER TABLE public.restaurants
  ADD COLUMN IF NOT EXISTS restaurant_vector_dirty_at timestamptz;

CREATE INDEX IF NOT EXISTS restaurants_dirty_idx
  ON public.restaurants (restaurant_vector_dirty_at)
  WHERE restaurant_vector_dirty_at IS NOT NULL;

-- ── 2. Replace _trg_after_dish_embedded body ───────────────────────────
-- Was: PERFORM update_restaurant_vector(NEW.restaurant_id);
-- Now: per-row debounced flag write.

CREATE OR REPLACE FUNCTION public._trg_after_dish_embedded()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $function$
BEGIN
  IF OLD.embedding IS DISTINCT FROM NEW.embedding AND NEW.embedding IS NOT NULL THEN
    UPDATE public.restaurants
      SET restaurant_vector_dirty_at = now()
      WHERE id = NEW.restaurant_id
        AND (
          restaurant_vector_dirty_at IS NULL
          OR restaurant_vector_dirty_at < now() - interval '1 minute'
        );
  END IF;
  RETURN NEW;
END;
$function$;

-- ── 3. Cron worker function ────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public._cron_restaurant_vector_recompute()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $function$
DECLARE
  v_restaurant_id UUID;
  v_count INT := 0;
BEGIN
  FOR v_restaurant_id IN
    SELECT id FROM public.restaurants
    WHERE restaurant_vector_dirty_at IS NOT NULL
    ORDER BY restaurant_vector_dirty_at ASC
    LIMIT 50
  LOOP
    PERFORM public.update_restaurant_vector(v_restaurant_id);

    UPDATE public.restaurants
      SET restaurant_vector_dirty_at = NULL
      WHERE id = v_restaurant_id
        AND restaurant_vector_dirty_at <= now();

    v_count := v_count + 1;
  END LOOP;

  IF v_count > 0 THEN
    RAISE NOTICE 'restaurant-vector-recompute: processed % restaurants', v_count;
  END IF;
END;
$function$;

-- ── 4. Schedule the cron ───────────────────────────────────────────────

SELECT cron.schedule(
  'restaurant-vector-recompute',
  '*/2 * * * *',
  $$SELECT public._cron_restaurant_vector_recompute();$$
);

COMMIT;
