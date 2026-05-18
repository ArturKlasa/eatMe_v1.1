-- 143_get_group_candidates_modifier_aware.sql
-- Created: 2026-05-18
--
-- Phase 1 of the dish-model rewrite (docs/plans/dish-model-rewrite-phase-1-database.md §4).
-- Modifier-aware rewrite of get_group_candidates. Two changes relative to the
-- migration 122 baseline:
--
--   1. Adds `d.is_template = false` to the inner EXISTS subquery. Closes the
--      pre-existing TODO from migration 122 ("d.is_template = false is NOT
--      added here ... pre-existing gap flagged as out-of-v2-scope. Address in
--      a dedicated follow-up migration."). Doing it here because we're already
--      touching the function and the fix is one line.
--
--   2. Adds a modifier-aware safety check: a dish only counts toward "does
--      this restaurant have any viable food?" if EVERY required option_group
--      has AT LEAST ONE option that survives the user's allergen + diet
--      filters. Mirrors required_groups_safe from migration 142, but inlined
--      (no CTE) — the outer EXISTS is restaurant-scoped, not dish-scoped, so
--      shared aggregation across restaurants doesn't help.
--
-- RETURN TYPE unchanged (no modifier columns added — get_group_candidates
-- returns restaurants only, not per-dish modifier metadata). CREATE OR REPLACE
-- is sufficient; no DROP FUNCTION needed.
--
-- Religious tags are intentionally NOT considered in the modifier safety
-- check, matching migration 142's decision (no worker emits religious-tag
-- removes today).
--
-- Pre-apply checklist:
--   1. Migrations 140 + 141 + 141a + 142 must already be applied.
--   2. After applying, no type regeneration needed (no schema change).
--   3. Spot-check: existing restaurants should return identical results until
--      Phase 4 ships modifier data. Restaurant with only a Pad Thai dish
--      whose chicken option strips vegetarianness: pre-143, restaurant
--      surfaces for a vegetarian user (BASE dish is vegetarian); post-143,
--      restaurant is correctly filtered out.
--
-- Reverse: 143_REVERSE_ONLY_get_group_candidates_modifier_aware.sql restores
-- the migration 122 function body verbatim.

BEGIN;

CREATE OR REPLACE FUNCTION get_group_candidates(
  p_lat            FLOAT,
  p_lng            FLOAT,
  p_radius_m       FLOAT        DEFAULT 10000,
  p_group_vector   vector(1536) DEFAULT NULL,
  p_allergens      TEXT[]       DEFAULT '{}',
  p_diet_tag       TEXT         DEFAULT NULL,
  p_religious_tags TEXT[]       DEFAULT '{}',
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
        AND d.is_parent = false
        -- NEW: close the migration 122 TODO — exclude template dishes from
        -- the "does this restaurant have viable food?" check.
        AND d.is_template = false
        AND (dc.id IS NULL OR dc.is_drink = false)
        AND m.menu_type = 'food'
        AND m.status = 'published'
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
        -- NEW: modifier-aware safety check. A dish counts only if EVERY
        -- required option_group has at least one safe option. Mirrors
        -- required_groups_safe from migration 142 but inlined.
        AND NOT EXISTS (
          SELECT 1 FROM option_groups g
          WHERE g.dish_id = d.id
            AND g.is_active = true
            AND g.min_selections >= 1
            AND NOT EXISTS (
              SELECT 1 FROM options o
              WHERE o.option_group_id = g.id
                AND o.is_available = true
                AND NOT (o.adds_allergens && COALESCE(p_allergens, '{}'))
                AND NOT (
                  p_diet_tag IS NOT NULL
                  AND p_diet_tag = ANY(o.removes_dietary_tags)
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

COMMIT;
