-- Live restaurant rating from community opinions
-- Created: 2026-02-26
-- Description:
--   restaurants.rating has always been 0 because nothing wrote to it after
--   initial INSERT.  The materialized views (restaurant_ratings_summary,
--   dish_ratings_summary) hold the real computed ratings but were never
--   connected back to the column.
--
--   This migration:
--     1. Creates a trigger function that recalculates restaurants.rating
--        after every dish_opinion INSERT / UPDATE / DELETE.
--     2. Creates the trigger on dish_opinions.
--     3. Backfills all existing restaurants immediately.
--
--   Rating formula (0.0 – 5.0):
--     score = AVG over liked dishes (liked=1.0, okay=0.5, disliked=0.0)
--     rating = ROUND(score * 5.0, 2)
--   Matches the food_score logic in restaurant_ratings_summary (food is the
--   primary signal; experience responses are secondary and sparse).
--
--   A restaurant with no opinions keeps rating = 0.00 (explicit "unrated"),
--   rather than a fake fallback like 4.5.

-- ============================================================================
-- STEP 1: Trigger function
-- ============================================================================

CREATE OR REPLACE FUNCTION update_restaurant_rating_on_opinion()
RETURNS TRIGGER AS $$
DECLARE
  v_restaurant_id UUID;
  v_new_rating    NUMERIC(3, 2);
BEGIN
  -- Resolve the restaurant from either the new or old row's dish
  SELECT restaurant_id INTO v_restaurant_id
  FROM public.dishes
  WHERE id = COALESCE(NEW.dish_id, OLD.dish_id);

  IF v_restaurant_id IS NULL THEN
    RETURN COALESCE(NEW, OLD);
  END IF;

  -- Recalculate rating for this restaurant
  SELECT ROUND(
    COALESCE(
      AVG(
        CASE opinion
          WHEN 'liked'    THEN 1.0
          WHEN 'okay'     THEN 0.5
          ELSE            0.0
        END
      ) * 5.0,
      0.0   -- no opinions yet → 0.00 (unrated)
    )::numeric,
    2
  )
  INTO v_new_rating
  FROM public.dish_opinions dop
  JOIN public.dishes        d   ON d.id = dop.dish_id
  WHERE d.restaurant_id = v_restaurant_id;

  UPDATE public.restaurants
  SET    rating = v_new_rating
  WHERE  id = v_restaurant_id;

  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION update_restaurant_rating_on_opinion IS
  'Recalculates restaurants.rating (0–5) after any dish_opinion change.';

-- ============================================================================
-- STEP 2: Trigger
-- ============================================================================

DROP TRIGGER IF EXISTS after_dish_opinion_rating_update ON public.dish_opinions;

CREATE TRIGGER after_dish_opinion_rating_update
  AFTER INSERT OR UPDATE OR DELETE ON public.dish_opinions
  FOR EACH ROW
  EXECUTE FUNCTION update_restaurant_rating_on_opinion();

COMMENT ON TRIGGER after_dish_opinion_rating_update ON public.dish_opinions IS
  'Keeps restaurants.rating live after every opinion change.';

-- ============================================================================
-- STEP 3: Utility function for manual / scheduled full sync
-- ============================================================================

CREATE OR REPLACE FUNCTION sync_all_restaurant_ratings()
RETURNS INTEGER AS $$
DECLARE
  v_count INTEGER;
BEGIN
  UPDATE public.restaurants r
  SET rating = ROUND(
    COALESCE(
      (
        SELECT AVG(
          CASE dop.opinion
            WHEN 'liked'  THEN 1.0
            WHEN 'okay'   THEN 0.5
            ELSE          0.0
          END
        ) * 5.0
        FROM public.dish_opinions dop
        JOIN public.dishes        d ON d.id = dop.dish_id
        WHERE d.restaurant_id = r.id
      ),
      0.0
    )::numeric,
    2
  );

  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION sync_all_restaurant_ratings IS
  'Recalculates restaurants.rating for all rows. '
  'Call after bulk data imports or to fix any drift.';

-- ============================================================================
-- STEP 4: Backfill existing restaurants
-- ============================================================================

SELECT sync_all_restaurant_ratings();

-- ============================================================================
-- SUCCESS MESSAGE
-- ============================================================================

DO $$
BEGIN
  RAISE NOTICE '========================================';
  RAISE NOTICE 'Live restaurant rating installed';
  RAISE NOTICE '========================================';
  RAISE NOTICE 'Trigger: after_dish_opinion_rating_update';
  RAISE NOTICE '  fires AFTER INSERT/UPDATE/DELETE on dish_opinions';
  RAISE NOTICE '  updates restaurants.rating (0.0–5.0) immediately';
  RAISE NOTICE '';
  RAISE NOTICE 'Utility: sync_all_restaurant_ratings()';
  RAISE NOTICE '  call after bulk imports to fix any drift';
  RAISE NOTICE '';
  RAISE NOTICE 'Backfill run for all existing restaurants.';
  RAISE NOTICE '========================================';
END $$;
