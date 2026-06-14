-- ══════════════════════════════════════════════════════════════════════════════
-- REVERSE of migration 168 — restore UTC-based open-now.
--
-- Restores migration 088's is_restaurant_open_now(jsonb, timestamptz) and the
-- migration-163 get_group_candidates (1-arg open-now call). Run only to roll back
-- 168. Order matters: recreate the helper before the function that calls it
-- (check_function_bodies validates the call at CREATE time).
-- ══════════════════════════════════════════════════════════════════════════════

-- ── (1) restore migration-088 is_restaurant_open_now (verbatim) ──────────────
DROP FUNCTION IF EXISTS public.is_restaurant_open_now(jsonb, text, timestamptz);

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

-- ── (2) restore migration-163 get_group_candidates (verbatim, 1-arg call) ─────
CREATE OR REPLACE FUNCTION get_group_candidates(
  p_lat            FLOAT,
  p_lng            FLOAT,
  p_radius_m       FLOAT        DEFAULT 10000,
  p_group_vector   vector(1536) DEFAULT NULL,
  p_diet_tag       TEXT         DEFAULT NULL,
  p_limit          INT          DEFAULT 40
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
    AND r.status = 'published'
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
        AND d.status = 'published'
        AND (dc.id IS NULL OR dc.is_drink = false)
        AND m.menu_type = 'food'
        AND m.status = 'published'
        -- Diet hard filter (protein-based; replaces the old dietary_tags[] logic)
        AND (
          p_diet_tag IS NULL
          OR CASE p_diet_tag
               WHEN 'vegan'      THEN d.primary_protein = 'vegan'
               WHEN 'vegetarian' THEN NOT (
                 COALESCE(d.protein_families, '{}') && ARRAY['meat', 'poultry', 'fish', 'shellfish']
               )
               ELSE true
             END
        )
        -- Modifier-aware safety check (protein-based). A dish counts only if
        -- EVERY required option_group offers at least one diet-compatible option
        -- (or an option with NULL primary_protein, which inherits the dish).
        -- No-op when p_diet_tag IS NULL.
        AND NOT EXISTS (
          SELECT 1 FROM option_groups g
          WHERE g.dish_id = d.id
            AND g.is_active = true
            AND g.min_selections >= 1
            AND p_diet_tag IS NOT NULL
            AND NOT EXISTS (
              SELECT 1 FROM options o
              WHERE o.option_group_id = g.id
                AND o.is_available = true
                AND (
                  o.primary_protein IS NULL
                  OR CASE p_diet_tag
                       WHEN 'vegan'      THEN o.primary_protein = 'vegan'
                       WHEN 'vegetarian' THEN o.primary_protein NOT IN
                         ('chicken','turkey','beef','pork','lamb','goat','other_meat','fish','shellfish')
                       ELSE true
                     END
                )
            )
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
