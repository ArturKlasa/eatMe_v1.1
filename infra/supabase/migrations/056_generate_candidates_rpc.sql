-- 056_generate_candidates_rpc.sql
-- Created: 2026-03-19
--
-- Adds the generate_candidates() SQL function used by the Phase 5 feed pipeline.
--
-- Stage 1 of the two-stage feed:
--   • PostGIS radius filter (hard geographic bound)
--   • Hard permanent filters: diet, allergens, religious restrictions
--   • Exclude previously disliked dishes
--   • If preference_vector supplied: order by cosine distance (ANN via HNSW)
--   • Cold start (NULL vector): order by popularity_score DESC then distance ASC
--   • Returns up to 200 candidates for JS Stage 2 scoring
--
-- Called from the feed Edge Function via:
--   supabase.rpc('generate_candidates', { ... })

CREATE OR REPLACE FUNCTION generate_candidates(
  -- Location
  p_lat                    FLOAT,
  p_lng                    FLOAT,
  p_radius_m               FLOAT DEFAULT 10000,   -- metres (default 10 km)

  -- User personalisation
  p_preference_vector      vector(1536) DEFAULT NULL,
  p_disliked_dish_ids      UUID[]       DEFAULT '{}',

  -- Hard permanent filters (empty array = no filter applied)
  p_allergens              TEXT[]       DEFAULT '{}',
  p_diet_tag               TEXT         DEFAULT NULL, -- e.g. 'vegan', 'vegetarian'
  p_religious_tags         TEXT[]       DEFAULT '{}',

  -- Candidate pool size
  p_limit                  INT          DEFAULT 200
)
RETURNS TABLE (
  -- dish columns
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
  -- computed columns
  vector_distance      FLOAT,
  distance_m           FLOAT,
  -- restaurant info
  restaurant_name      TEXT,
  restaurant_cuisines  TEXT[],
  restaurant_rating    NUMERIC,
  restaurant_location  JSONB,
  -- analytics
  popularity_score     FLOAT,
  view_count           BIGINT,
  right_swipe_count    BIGINT
)
LANGUAGE sql
STABLE
SECURITY INVOKER
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

    -- vector distance: cosine distance to preference vector (NULL if cold start)
    CASE
      WHEN p_preference_vector IS NOT NULL AND d.embedding IS NOT NULL
      THEN (d.embedding <=> p_preference_vector)
      ELSE NULL
    END AS vector_distance,

    -- geographic distance in metres
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

  -- Optional analytics join
  LEFT JOIN dish_analytics da ON da.dish_id = d.id

  WHERE
    -- Geographic hard filter
    r.is_active = true
    AND ST_DWithin(
      r.location_point,
      ST_MakePoint(p_lng, p_lat)::geography,
      p_radius_m
    )

    -- Availability
    AND d.is_available = true

    -- Exclude disliked dishes
    AND (
      array_length(p_disliked_dish_ids, 1) IS NULL
      OR d.id <> ALL(p_disliked_dish_ids)
    )

    -- Hard allergen exclusion (dish must not contain any of the user's allergens)
    AND (
      array_length(p_allergens, 1) IS NULL
      OR NOT (d.allergens && p_allergens)
    )

    -- Hard diet tag filter (dish must include the required tag)
    AND (
      p_diet_tag IS NULL
      OR d.dietary_tags @> ARRAY[p_diet_tag]
    )

    -- Hard religious restrictions (dish must include ALL required tags)
    AND (
      array_length(p_religious_tags, 1) IS NULL
      OR d.dietary_tags @> p_religious_tags
    )

  ORDER BY
    -- Primary: vector ANN when preference_vector is available
    CASE
      WHEN p_preference_vector IS NOT NULL AND d.embedding IS NOT NULL
      THEN (d.embedding <=> p_preference_vector)
      ELSE NULL
    END ASC NULLS LAST,

    -- Cold-start / unembedded fallback: popularity then distance
    COALESCE(da.popularity_score, 0) DESC,
    ST_Distance(
      r.location_point,
      ST_MakePoint(p_lng, p_lat)::geography
    ) ASC

  LIMIT p_limit;
$$;

-- Allow the anon role and authenticated role to call this function
-- (the feed Edge Function uses the service role, but mobile clients may call
--  the feed via the anon key through the API gateway)
GRANT EXECUTE ON FUNCTION generate_candidates TO anon, authenticated;
