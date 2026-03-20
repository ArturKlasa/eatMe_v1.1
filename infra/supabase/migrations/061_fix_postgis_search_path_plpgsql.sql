-- 061_fix_postgis_search_path_plpgsql.sql
-- Created: 2026-03-20
--
-- Fixes: "Cannot find SRID (4326) in spatial_ref_sys" that persists after 060.
--
-- Root cause (deeper):
--   Migration 060 changed generate_candidates to SECURITY DEFINER +
--   SET search_path = public, extensions, but the function remained
--   LANGUAGE sql.  In a SQL-language function, SET search_path in the
--   function header applies to SQL *parsing* (resolving identifiers in the
--   function body) but does NOT propagate to the C-level SPI queries that
--   PostGIS fires internally to resolve SRID 4326 from spatial_ref_sys.
--   PL/pgSQL properly sets the search_path on the session stack before
--   any execution begins, including all nested C/SPI calls.
--
-- Fix:
--   Rewrite both PostGIS-using functions as LANGUAGE plpgsql.
--   Also flip the search_path order to extensions, public — PostGIS
--   extension objects (including spatial_ref_sys in newer Supabase
--   projects) live in the extensions schema.
--
-- Functions affected:
--   • generate_candidates   (originally 056, patched in 060)
--   • get_group_candidates  (originally 059 — same bug, not yet patched)

-- ── generate_candidates ───────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION generate_candidates(
  p_lat                    FLOAT,
  p_lng                    FLOAT,
  p_radius_m               FLOAT DEFAULT 10000,
  p_preference_vector      vector(1536) DEFAULT NULL,
  p_disliked_dish_ids      UUID[]       DEFAULT '{}',
  p_allergens              TEXT[]       DEFAULT '{}',
  p_diet_tag               TEXT         DEFAULT NULL,
  p_religious_tags         TEXT[]       DEFAULT '{}',
  p_limit                  INT          DEFAULT 200
)
RETURNS TABLE (
  id                   UUID,
  restaurant_id        UUID,
  name                 TEXT,
  description          TEXT,
  price                NUMERIC,
  dietary_tags         TEXT[],
  allergens            TEXT[],
  calories             INTEGER,
  spice_level          TEXT,
  image_url            TEXT,
  is_available         BOOLEAN,
  dish_kind            TEXT,
  display_price_prefix TEXT,
  enrichment_status    TEXT,
  vector_distance      FLOAT,
  distance_m           FLOAT,
  restaurant_name      TEXT,
  restaurant_cuisines  TEXT[],
  restaurant_rating    NUMERIC,
  restaurant_location  JSONB,
  popularity_score     FLOAT,
  view_count           BIGINT,
  right_swipe_count    BIGINT
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = extensions, public
AS $$
BEGIN
  RETURN QUERY
  SELECT
    d.id,
    d.restaurant_id,
    d.name,
    d.description,
    d.price,
    d.dietary_tags,
    d.allergens,
    d.calories,
    d.spice_level,
    d.image_url,
    d.is_available,
    d.dish_kind,
    d.display_price_prefix,
    d.enrichment_status,

    CASE
      WHEN p_preference_vector IS NOT NULL AND d.embedding IS NOT NULL
      THEN (d.embedding <=> p_preference_vector)
      ELSE NULL
    END::FLOAT AS vector_distance,

    ST_Distance(
      r.location_point,
      ST_SetSRID(ST_MakePoint(p_lng, p_lat), 4326)::geography
    )::FLOAT AS distance_m,

    r.name           AS restaurant_name,
    r.cuisine_types  AS restaurant_cuisines,
    r.rating         AS restaurant_rating,
    r.location       AS restaurant_location,

    COALESCE(da.popularity_score, 0)::FLOAT  AS popularity_score,
    COALESCE(da.view_count, 0)::BIGINT       AS view_count,
    COALESCE(da.right_swipe_count, 0)::BIGINT AS right_swipe_count

  FROM dishes d
  JOIN restaurants r ON r.id = d.restaurant_id
  LEFT JOIN dish_analytics da ON da.dish_id = d.id

  WHERE
    r.is_active = true
    AND ST_DWithin(
      r.location_point,
      ST_SetSRID(ST_MakePoint(p_lng, p_lat), 4326)::geography,
      p_radius_m
    )
    AND d.is_available = true
    AND (
      array_length(p_disliked_dish_ids, 1) IS NULL
      OR d.id <> ALL(p_disliked_dish_ids)
    )
    AND (
      array_length(p_allergens, 1) IS NULL
      OR NOT (d.allergens && p_allergens)
    )
    AND (
      p_diet_tag IS NULL
      OR d.dietary_tags @> ARRAY[p_diet_tag]
    )
    AND (
      array_length(p_religious_tags, 1) IS NULL
      OR d.dietary_tags @> p_religious_tags
    )

  ORDER BY
    CASE
      WHEN p_preference_vector IS NOT NULL AND d.embedding IS NOT NULL
      THEN (d.embedding <=> p_preference_vector)
      ELSE NULL
    END ASC NULLS LAST,
    COALESCE(da.popularity_score, 0) DESC,
    ST_Distance(
      r.location_point,
      ST_SetSRID(ST_MakePoint(p_lng, p_lat), 4326)::geography
    ) ASC

  LIMIT p_limit;
END;
$$;

GRANT EXECUTE ON FUNCTION generate_candidates TO anon, authenticated, service_role;


-- ── get_group_candidates ─────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION get_group_candidates(
  p_lat            double precision,
  p_lng            double precision,
  p_radius_m       double precision,
  p_group_vector   vector(1536)  DEFAULT NULL,
  p_allergens      text[]        DEFAULT NULL,
  p_diet_tag       text          DEFAULT NULL,
  p_religious_tags text[]        DEFAULT NULL,
  p_limit          integer       DEFAULT 20
)
RETURNS TABLE (
  id               uuid,
  name             text,
  cuisine_types    text[],
  rating           numeric,
  address          text,
  phone            text,
  location         jsonb,
  distance_m       double precision,
  restaurant_vector vector(1536),
  vector_distance  double precision
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = extensions, public
AS $$
BEGIN
  RETURN QUERY
  SELECT
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
    ) AS distance_m,
    r.restaurant_vector,
    CASE
      WHEN p_group_vector IS NOT NULL AND r.restaurant_vector IS NOT NULL
        THEN r.restaurant_vector <=> p_group_vector
      ELSE NULL
    END AS vector_distance
  FROM restaurants r
  WHERE
    r.is_active    = true
    AND r.suspended_at IS NULL
    AND ST_DWithin(
      r.location_point,
      ST_SetSRID(ST_MakePoint(p_lng, p_lat), 4326)::geography,
      p_radius_m
    )
    AND EXISTS (
      SELECT 1
      FROM dishes d
      WHERE d.restaurant_id = r.id
        AND d.is_available  = true
        AND (
          p_allergens IS NULL
          OR NOT (d.allergens && p_allergens)
        )
        AND (
          p_diet_tag IS NULL
          OR CASE p_diet_tag
               WHEN 'vegan'      THEN d.dietary_tags @> ARRAY['vegan']
               WHEN 'vegetarian' THEN d.dietary_tags && ARRAY['vegetarian', 'vegan']
               ELSE true
             END
        )
        AND (
          p_religious_tags IS NULL
          OR d.dietary_tags @> p_religious_tags
        )
    )
  ORDER BY
    CASE
      WHEN p_group_vector IS NOT NULL AND r.restaurant_vector IS NOT NULL
        THEN r.restaurant_vector <=> p_group_vector
      ELSE NULL
    END ASC NULLS LAST,
    distance_m ASC
  LIMIT p_limit;
END;
$$;

GRANT EXECUTE ON FUNCTION get_group_candidates TO anon, authenticated, service_role;

-- ── Force PostgREST to pick up the new function definitions ──────────────────

NOTIFY pgrst, 'reload schema';


-- ============================================================================
-- Fix enrich-dish 401: add Authorization header to pg_net calls
-- ============================================================================
--
-- Root cause:
--   The _trg_notify_enrich_dish trigger fires pg_net without an Authorization
--   header. Supabase Edge Functions verify JWT by default and reject header-
--   less requests with HTTP 401 (before the function code even runs).
--
-- Fix:
--   Read the project anon key from a GUC (app.supabase_anon_key) and include
--   it as  Authorization: Bearer <anon_key>  in the pg_net call.
--   The enrich-dish function itself creates a SECURITY DEFINER Supabase client
--   using SUPABASE_SERVICE_ROLE_KEY internally, so the anon key is sufficient
--   for passing JWT verification — no service-role privileges are needed from
--   the caller.
--
-- One-time setup (run once in SQL Editor, keep secret):
--   ALTER DATABASE postgres
--     SET app.supabase_anon_key = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...';
--
-- The GUC falls back gracefully if not set (enrichment just won't run, same
-- as when app.enrich_dish_url is not set).
-- ============================================================================

CREATE OR REPLACE FUNCTION _trg_notify_enrich_dish()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_dish_id UUID;
  v_url     TEXT;
  v_anon_key TEXT;
BEGIN
  -- Determine dish_id from the triggering table
  IF TG_TABLE_NAME = 'dishes' THEN
    v_dish_id := NEW.id;
  ELSIF TG_TABLE_NAME = 'dish_ingredients' THEN
    IF TG_OP = 'DELETE' THEN
      v_dish_id := OLD.dish_id;
    ELSE
      v_dish_id := NEW.dish_id;
    END IF;
  ELSIF TG_TABLE_NAME = 'option_groups' THEN
    IF TG_OP = 'DELETE' THEN
      v_dish_id := OLD.dish_id;
    ELSE
      v_dish_id := NEW.dish_id;
    END IF;
  END IF;

  -- Only act on dish-level option_groups (not category-level)
  IF TG_TABLE_NAME = 'option_groups' AND v_dish_id IS NULL THEN
    RETURN NEW;
  END IF;

  -- Read config — both values must be set for enrichment to run
  v_url      := current_setting('app.enrich_dish_url',  true);
  v_anon_key := current_setting('app.supabase_anon_key', true);

  IF v_url IS NULL OR v_url = '' THEN
    RAISE WARNING '_trg_notify_enrich_dish: app.enrich_dish_url not set, skipping dish %', v_dish_id;
    RETURN NEW;
  END IF;

  IF v_anon_key IS NULL OR v_anon_key = '' THEN
    RAISE WARNING '_trg_notify_enrich_dish: app.supabase_anon_key not set, skipping dish %', v_dish_id;
    RETURN NEW;
  END IF;

  -- Mark as pending (debounce guard in enrich-dish checks this)
  UPDATE dishes SET enrichment_status = 'pending' WHERE id = v_dish_id;

  -- Fire-and-forget POST with Authorization header so the Edge Function
  -- passes JWT verification (HTTP 401 was previously returned without it)
  PERFORM net.http_post(
    url     := v_url,
    body    := jsonb_build_object('dish_id', v_dish_id),
    headers := jsonb_build_object(
                 'Content-Type',  'application/json',
                 'Authorization', 'Bearer ' || v_anon_key
               )
  );

  RETURN NEW;
END;
$$;
