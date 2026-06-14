-- ══════════════════════════════════════════════════════════════════════════════
-- Migration 168: get_group_candidates open-now is timezone-correct
--
-- §S8 (docs/findings/mobile-performance-audit.md): is_restaurant_open_now derived
-- the weekday + time-of-day from now() in the DB's UTC clock, but open_hours are
-- stored in each restaurant's LOCAL time. For CDMX (UTC-6) restaurants, 20:00
-- local = 02:00 UTC next day → wrong weekday, reads CLOSED every evening, emptying
-- eatTogether group searches and tripping the 2x radius retry. Same bug the feed
-- already fixed in JS.
--
-- Fix (SQL only — no edge-function change):
--   (1) is_restaurant_open_now now takes the restaurant timezone and evaluates
--       "now" in that zone. timezone is backfilled from country_code by migration
--       149, so the column IS the resolved fallback — re-mapping country_code here
--       would duplicate migration 149's CASE / feed's COUNTRY_TO_TZ a third time
--       for zero extra coverage. Null/unknown tz falls back to UTC = legacy
--       behaviour, never worse.
--   (2) get_group_candidates passes r.timezone to the helper.
--
-- Sole caller of is_restaurant_open_now is get_group_candidates (verified), updated
-- here in lockstep. No edge-function deploy required — apply this migration only.
-- ══════════════════════════════════════════════════════════════════════════════

-- ── (1) timezone-aware is_restaurant_open_now ────────────────────────────────
-- Signature change ((jsonb,timestamptz) → (jsonb,text,timestamptz)) → DROP + CREATE.
-- Marked STABLE: AT TIME ZONE is stable, and the old IMMUTABLE label was incorrect
-- (the UTC-based to_char/::time already depended on the session TimeZone setting).
DROP FUNCTION IF EXISTS public.is_restaurant_open_now(jsonb, timestamptz);

CREATE FUNCTION public.is_restaurant_open_now(
  p_open_hours jsonb,
  p_timezone   text        DEFAULT NULL,
  p_now        timestamptz DEFAULT now()
)
RETURNS boolean
LANGUAGE plpgsql
STABLE
AS $$
DECLARE
  v_local   timestamp;
  day_key   text;
  entry     jsonb;
  open_t    time;
  close_t   time;
  cur_t     time;
BEGIN
  IF p_open_hours IS NULL THEN
    RETURN false;
  END IF;

  -- Evaluate "now" in the restaurant's LOCAL zone (open_hours are stored local).
  -- timezone is backfilled from country_code (migration 149); fall back to UTC when
  -- unknown (legacy behaviour, never worse). Guard against a malformed zone string.
  BEGIN
    v_local := p_now AT TIME ZONE COALESCE(NULLIF(p_timezone, ''), 'UTC');
  EXCEPTION WHEN others THEN
    v_local := p_now AT TIME ZONE 'UTC';
  END;

  day_key := lower(to_char(v_local, 'FMday'));
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

  cur_t := v_local::time;

  -- Overnight span (e.g. 22:00 – 02:00)
  IF close_t < open_t THEN
    RETURN cur_t >= open_t OR cur_t < close_t;
  END IF;

  RETURN cur_t >= open_t AND cur_t < close_t;
END;
$$;

GRANT EXECUTE ON FUNCTION public.is_restaurant_open_now(jsonb, text, timestamptz)
  TO anon, authenticated, service_role;

-- ── (2) get_group_candidates — verbatim from migration 163, with the open-now ──
-- call site changed to pass r.timezone. Body otherwise unchanged.

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
    AND public.is_restaurant_open_now(r.open_hours, r.timezone)
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
