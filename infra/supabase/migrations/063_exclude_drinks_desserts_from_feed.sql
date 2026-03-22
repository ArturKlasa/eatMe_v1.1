-- 063_exclude_drinks_desserts_from_feed.sql
-- Created: 2026-03-21
-- Description: Exclude drinks and desserts from the feed / recommended dishes.
--
--   Problem: generate_candidates returned ALL available dishes including drinks
--   (cocktails, coffee, juice …) and desserts. The map-view recommended-dish
--   carousel should only show main-course / savoury items.
--
--   Approach:
--     1. JOIN dish_categories (via dishes.dish_category_id) and exclude rows
--        where is_drink = true  OR  name = 'Dessert'.
--     2. JOIN through menu_categories → menus and exclude rows where
--        menus.menu_type = 'drink'.
--     Both are LEFT JOINs so dishes with NULL category / menu are still included.

-- ── generate_candidates (replaces 061 version) ───────────────────────────────

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
  -- Join category to detect drinks / desserts
  LEFT JOIN dish_categories dc ON dc.id = d.dish_category_id
  -- Join through menu_categories → menus to detect drink menus
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

    -- ── Exclude drinks ──
    -- Via dish_categories.is_drink flag
    AND (dc.id IS NULL OR dc.is_drink = false)
    -- Via menus.menu_type = 'drink'
    AND (m.id IS NULL OR m.menu_type = 'food')

    -- ── Exclude desserts ──
    AND (dc.id IS NULL OR lower(dc.name) <> 'dessert')

    -- Existing hard filters
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
