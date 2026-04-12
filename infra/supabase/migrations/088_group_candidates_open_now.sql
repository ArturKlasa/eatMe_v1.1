-- 088_group_candidates_open_now.sql
-- Created: 2026-04-12
--
-- Fixes bug where group recommendations included dishes from currently-closed
-- restaurants. Adds an `is_restaurant_open_now` helper and extends
-- get_group_candidates() to filter on current-time-within-open-hours.
--
-- open_hours JSONB shape: { "monday": { "open": "09:00", "close": "22:00" }, ... }

CREATE OR REPLACE FUNCTION public.is_restaurant_open_now(
  p_open_hours jsonb,
  p_now        timestamptz DEFAULT now()
)
RETURNS boolean
LANGUAGE plpgsql
IMMUTABLE
AS $$
DECLARE
  day_key   text;
  entry     jsonb;
  open_t    time;
  close_t   time;
  cur_t     time;
BEGIN
  IF p_open_hours IS NULL THEN
    RETURN false;
  END IF;

  day_key := lower(to_char(p_now, 'FMday'));
  entry   := p_open_hours -> day_key;
  IF entry IS NULL THEN
    RETURN false;
  END IF;

  BEGIN
    open_t  := (entry ->> 'open')::time;
    close_t := (entry ->> 'close')::time;
  EXCEPTION WHEN others THEN
    RETURN false;
  END;

  cur_t := p_now::time;

  -- Overnight span (e.g. 22:00 – 02:00)
  IF close_t < open_t THEN
    RETURN cur_t >= open_t OR cur_t < close_t;
  END IF;

  RETURN cur_t >= open_t AND cur_t < close_t;
END;
$$;

GRANT EXECUTE ON FUNCTION public.is_restaurant_open_now(jsonb, timestamptz)
  TO anon, authenticated, service_role;

-- Replace get_group_candidates with the same body as migration 073 plus an
-- `is_restaurant_open_now(r.open_hours)` check in the WHERE clause.
CREATE OR REPLACE FUNCTION get_group_candidates(
  p_lat           FLOAT,
  p_lng           FLOAT,
  p_radius_m      FLOAT        DEFAULT 10000,
  p_group_vector  vector(1536) DEFAULT NULL,
  p_allergens     TEXT[]       DEFAULT '{}',
  p_diet_tag      TEXT         DEFAULT NULL,
  p_religious_tags TEXT[]      DEFAULT '{}',
  p_limit         INT          DEFAULT 40
)
RETURNS TABLE (
  id                UUID,
  name              TEXT,
  cuisine_types     TEXT[],
  rating            NUMERIC,
  address           TEXT,
  phone             TEXT,
  location          JSONB,
  distance_m        FLOAT,
  restaurant_vector vector(1536),
  vector_distance   FLOAT
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = extensions, public
AS $$
BEGIN
  RETURN QUERY
  SELECT DISTINCT ON (r.id)
    r.id,
    r.name,
    r.cuisine_types,
    r.rating,
    r.address,
    r.phone,
    r.location,
    ST_Distance(
      r.location_point,
      ST_SetSRID(ST_MakePoint(p_lng, p_lat), 4326)::geography
    )::FLOAT AS distance_m,
    r.restaurant_vector,
    CASE
      WHEN p_group_vector IS NOT NULL AND r.restaurant_vector IS NOT NULL
      THEN (r.restaurant_vector <=> p_group_vector)::FLOAT
      ELSE NULL
    END AS vector_distance
  FROM restaurants r
  WHERE
    r.is_active = true
    AND public.is_restaurant_open_now(r.open_hours)
    AND ST_DWithin(
      r.location_point,
      ST_SetSRID(ST_MakePoint(p_lng, p_lat), 4326)::geography,
      p_radius_m
    )
    AND EXISTS (
      SELECT 1
      FROM dishes d
      JOIN menu_categories mc ON mc.id = d.menu_category_id
      JOIN menus m ON m.id = mc.menu_id
      LEFT JOIN dish_categories dc ON dc.id = d.dish_category_id
      WHERE
        d.restaurant_id = r.id
        AND d.is_available = true
        AND d.is_parent = false
        AND (dc.id IS NULL OR dc.is_drink = false)
        AND m.menu_type = 'food'
        AND (
          array_length(p_allergens, 1) IS NULL
          OR NOT (d.allergens && p_allergens)
        )
        AND (
          p_diet_tag IS NULL
          OR CASE p_diet_tag
               WHEN 'vegan'      THEN d.dietary_tags @> ARRAY['vegan']
               WHEN 'vegetarian' THEN d.dietary_tags && ARRAY['vegetarian', 'vegan']
               ELSE d.dietary_tags @> ARRAY[p_diet_tag]
             END
        )
        AND (
          array_length(p_religious_tags, 1) IS NULL
          OR d.dietary_tags @> p_religious_tags
        )
    )
  ORDER BY
    r.id,
    CASE
      WHEN p_group_vector IS NOT NULL AND r.restaurant_vector IS NOT NULL
      THEN (r.restaurant_vector <=> p_group_vector)
      ELSE NULL
    END ASC NULLS LAST,
    ST_Distance(
      r.location_point,
      ST_SetSRID(ST_MakePoint(p_lng, p_lat), 4326)::geography
    ) ASC
  LIMIT p_limit;
END;
$$;

GRANT EXECUTE ON FUNCTION get_group_candidates TO anon, authenticated, service_role;
