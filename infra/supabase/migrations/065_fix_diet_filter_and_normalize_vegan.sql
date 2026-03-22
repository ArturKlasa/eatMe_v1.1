-- 065_fix_diet_filter_and_normalize_vegan.sql
-- Created: 2026-03-22
--
-- Fixes TWO issues with dietary tag filtering:
--
-- 1. REGRESSION in 063: generate_candidates used `@> ARRAY[p_diet_tag]` which
--    requires a literal match. Vegetarian filter missed vegan-only dishes.
--    Restores the CASE-based logic from 061 where vegetarian uses `&&`
--    (overlap) to match dishes tagged with EITHER 'vegetarian' OR 'vegan'.
--
-- 2. BACKFILL: Menu-scan pipeline stored vegan dishes with only ['vegan']
--    instead of ['vegan','vegetarian']. This UPDATE adds the missing
--    'vegetarian' tag to all existing dishes that have 'vegan' but not
--    'vegetarian'.

-- ── 1. Fix generate_candidates diet filter ────────────────────────────────────

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
  LEFT JOIN dish_categories dc ON dc.id = d.dish_category_id
  LEFT JOIN menu_categories mc ON mc.id = d.menu_category_id
  LEFT JOIN menus m            ON m.id  = mc.menu_id

  WHERE
    r.is_active = true
    AND ST_DWithin(
      r.location_point,
      ST_SetSRID(ST_MakePoint(p_lng, p_lat), 4326)::geography,
      p_radius_m
    )
    AND d.is_available = true

    -- Exclude drinks
    AND (dc.id IS NULL OR dc.is_drink = false)
    AND (m.id IS NULL OR m.menu_type = 'food')

    -- Exclude desserts
    AND (dc.id IS NULL OR lower(dc.name) <> 'dessert')

    -- Disliked dishes
    AND (
      array_length(p_disliked_dish_ids, 1) IS NULL
      OR d.id <> ALL(p_disliked_dish_ids)
    )

    -- Allergens
    AND (
      array_length(p_allergens, 1) IS NULL
      OR NOT (d.allergens && p_allergens)
    )

    -- Diet tag: vegetarian uses overlap (&&) so vegan dishes also match
    AND (
      p_diet_tag IS NULL
      OR CASE p_diet_tag
           WHEN 'vegan'      THEN d.dietary_tags @> ARRAY['vegan']
           WHEN 'vegetarian' THEN d.dietary_tags && ARRAY['vegetarian', 'vegan']
           ELSE d.dietary_tags @> ARRAY[p_diet_tag]
         END
    )

    -- Religious tags
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

-- ── 2. Backfill: add 'vegetarian' to all vegan dishes missing it ──────────────

UPDATE dishes
SET dietary_tags = array_append(dietary_tags, 'vegetarian')
WHERE 'vegan' = ANY(dietary_tags)
  AND NOT ('vegetarian' = ANY(dietary_tags));
