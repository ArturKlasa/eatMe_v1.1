-- 059_get_group_candidates.sql
-- Created: 2026-03-19
--
-- Phase 7: Group Recommendations V2
--
-- RPC function used by the group-recommendations Edge Function.
-- Returns restaurants within radius that have at least one dish satisfying
-- ALL of the group's unioned hard constraints, ordered by vector ANN distance
-- (or PostGIS distance as fallback when no group vector is available).
--
-- Hard constraints applied at the DISH level (correct — a restaurant satisfies
-- the group only if it can actually serve food everyone can eat):
--   - Allergen exclusion: no group allergen appears in dish.allergens
--   - Diet: dish.dietary_tags must include the required tag
--   - Religious: dish.dietary_tags must include ALL required tags
--
-- Parameters:
--   p_lat, p_lng          Search centre (decimal degrees)
--   p_radius_m            Search radius in metres
--   p_group_vector        Average of all members' preference_vectors (nullable)
--   p_allergens           Union of all members' allergen TEXT[] (nullable)
--   p_diet_tag            Strictest diet tag required: 'vegan'|'vegetarian'|NULL
--   p_religious_tags      Union of all members' religious_restrictions (nullable)
--   p_limit               Max restaurants to return (default 20)

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
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
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
    )                                                          AS distance_m,
    r.restaurant_vector,
    CASE
      WHEN p_group_vector IS NOT NULL AND r.restaurant_vector IS NOT NULL
        THEN r.restaurant_vector <=> p_group_vector
      ELSE NULL
    END                                                        AS vector_distance
  FROM restaurants r
  WHERE
    r.is_active    = true
    AND r.suspended_at IS NULL
    -- Radius filter (PostGIS)
    AND ST_DWithin(
      r.location_point,
      ST_SetSRID(ST_MakePoint(p_lng, p_lat), 4326)::geography,
      p_radius_m
    )
    -- Hard constraint: restaurant must have at least one AVAILABLE dish that
    -- passes ALL of the group's unioned dietary requirements.
    AND EXISTS (
      SELECT 1
      FROM dishes d
      WHERE d.restaurant_id = r.id
        AND d.is_available  = true
        -- Allergen exclusion: dish must NOT contain any group allergen
        AND (
          p_allergens IS NULL
          OR NOT (d.allergens && p_allergens)
        )
        -- Diet requirement
        AND (
          p_diet_tag IS NULL
          OR CASE p_diet_tag
               WHEN 'vegan'       THEN d.dietary_tags @> ARRAY['vegan']
               WHEN 'vegetarian'  THEN d.dietary_tags && ARRAY['vegetarian', 'vegan']
               ELSE true
             END
        )
        -- Religious requirements: ALL tags must be present on the dish
        AND (
          p_religious_tags IS NULL
          OR d.dietary_tags @> p_religious_tags
        )
    )
  ORDER BY
    -- ANN ordering when group vector available, distance fallback otherwise
    CASE
      WHEN p_group_vector IS NOT NULL AND r.restaurant_vector IS NOT NULL
        THEN r.restaurant_vector <=> p_group_vector
      ELSE NULL
    END ASC NULLS LAST,
    distance_m ASC
  LIMIT p_limit;
$$;
