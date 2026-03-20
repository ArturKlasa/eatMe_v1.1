-- 060_fix_generate_candidates_security.sql
-- Created: 2026-03-20
--
-- Fixes: "Cannot find SRID (4326) in spatial_ref_sys"
--
-- Root cause:
--   generate_candidates was SECURITY INVOKER with no explicit search_path.
--   PostGIS geography operations (::geography cast, ST_DWithin, ST_Distance)
--   internally look up SRID 4326 in spatial_ref_sys.  When the function runs
--   without 'extensions' in its search_path, the lookup fails — even when
--   called as service_role — because SQL functions inherit the client's
--   search_path, which typically does not include the 'extensions' schema.
--
-- Fix:
--   Re-create generate_candidates as SECURITY DEFINER with an explicit
--   SET search_path = public, extensions.  This guarantees:
--     1. The function always runs as the function owner (postgres superuser)
--        who has unrestricted access to spatial_ref_sys.
--     2. PostGIS can always resolve SRID 4326 regardless of the calling
--        client's search_path or role.
--
-- Security note:
--   SECURITY DEFINER is safe here because generate_candidates:
--     - Takes only scalar inputs (no user-supplied table/column names)
--     - Applies hard filters (allergens, diet tags, disliked dishes) inside
--       the function body — callers cannot bypass them
--     - Is not writable (STABLE, SELECT-only)

CREATE OR REPLACE FUNCTION generate_candidates(
  -- Location
  p_lat                    FLOAT,
  p_lng                    FLOAT,
  p_radius_m               FLOAT DEFAULT 10000,

  -- User personalisation
  p_preference_vector      vector(1536) DEFAULT NULL,
  p_disliked_dish_ids      UUID[]       DEFAULT '{}',

  -- Hard permanent filters (empty/NULL = no filter applied)
  p_allergens              TEXT[]       DEFAULT '{}',
  p_diet_tag               TEXT         DEFAULT NULL,
  p_religious_tags         TEXT[]       DEFAULT '{}',

  -- Candidate pool size
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
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, extensions
AS $$
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
    END AS vector_distance,

    ST_Distance(
      r.location_point,
      ST_MakePoint(p_lng, p_lat)::geography
    ) AS distance_m,

    r.name           AS restaurant_name,
    r.cuisine_types  AS restaurant_cuisines,
    r.rating         AS restaurant_rating,
    r.location       AS restaurant_location,

    COALESCE(da.popularity_score, 0)     AS popularity_score,
    COALESCE(da.view_count, 0)           AS view_count,
    COALESCE(da.right_swipe_count, 0)    AS right_swipe_count

  FROM dishes d
  JOIN restaurants r ON r.id = d.restaurant_id
  LEFT JOIN dish_analytics da ON da.dish_id = d.id

  WHERE
    r.is_active = true
    AND ST_DWithin(
      r.location_point,
      ST_MakePoint(p_lng, p_lat)::geography,
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
      ST_MakePoint(p_lng, p_lat)::geography
    ) ASC

  LIMIT p_limit;
$$;

-- Preserve the grants from migration 056
GRANT EXECUTE ON FUNCTION generate_candidates TO anon, authenticated;
