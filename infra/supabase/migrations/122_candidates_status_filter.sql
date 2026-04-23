-- 122_candidates_status_filter.sql
-- Created: 2026-04-23
--
-- Adds r.status='published', d.status='published', and
-- (m.id IS NULL OR m.status='published') WHERE-clause guards to both
-- candidate-producing RPCs so draft/archived rows are invisible to consumers.
--
-- Depends on: migrations 116 (restaurants.status) + 117 (menus.status)
--             + dishes.status added in 114 (ADD COLUMN ... DEFAULT 'published')
--
-- NOTE: get_group_candidates does NOT receive d.is_template=false in this step.
-- That is a pre-existing bug in the EXISTS sub-query flagged in design §8.2 as
-- out-of-v2-scope. See TODO comment inline.
--
-- Reverse: 122_REVERSE_ONLY_candidates_status_filter.sql

BEGIN;

-- ── generate_candidates ───────────────────────────────────────────────────────
-- Full body from migration 114 plus three added status clauses (marked ★).

CREATE OR REPLACE FUNCTION generate_candidates(
  p_lat                    FLOAT,
  p_lng                    FLOAT,
  p_radius_m               FLOAT        DEFAULT 10000,
  p_preference_vector      vector(1536) DEFAULT NULL,
  p_disliked_dish_ids      UUID[]       DEFAULT '{}',
  p_allergens              TEXT[]       DEFAULT '{}',
  p_diet_tag               TEXT         DEFAULT NULL,
  p_religious_tags         TEXT[]       DEFAULT '{}',
  p_exclude_families       TEXT[]       DEFAULT '{}',
  p_exclude_spicy          BOOLEAN      DEFAULT false,
  p_limit                  INT          DEFAULT 200,
  p_current_time           TIME         DEFAULT NULL,
  p_current_day            TEXT         DEFAULT NULL,
  p_schedule_type          TEXT         DEFAULT NULL,
  p_group_meals            BOOLEAN      DEFAULT false
)
RETURNS TABLE (
  id                       UUID,
  restaurant_id            UUID,
  name                     TEXT,
  description              TEXT,
  price                    NUMERIC,
  dietary_tags             TEXT[],
  allergens                TEXT[],
  calories                 INTEGER,
  spice_level              TEXT,
  image_url                TEXT,
  is_available             BOOLEAN,
  dish_kind                TEXT,
  display_price_prefix     TEXT,
  enrichment_status        TEXT,
  vector_distance          FLOAT,
  distance_m               FLOAT,
  restaurant_name          TEXT,
  restaurant_cuisines      TEXT[],
  restaurant_rating        NUMERIC,
  restaurant_location      JSONB,
  popularity_score         FLOAT,
  view_count               BIGINT,
  protein_families         TEXT[],
  protein_canonical_names  TEXT[],
  parent_dish_id           UUID,
  serves                   INTEGER,
  price_per_person         NUMERIC,
  primary_protein          TEXT
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

    COALESCE(da.popularity_score, 0)::FLOAT   AS popularity_score,
    COALESCE(da.view_count, 0)::BIGINT        AS view_count,

    COALESCE(d.protein_families, '{}')        AS protein_families,
    COALESCE(d.protein_canonical_names, '{}') AS protein_canonical_names,

    d.parent_dish_id,
    d.serves,
    d.price_per_person,

    d.primary_protein

  FROM dishes d
  JOIN restaurants r ON r.id = d.restaurant_id
  LEFT JOIN dish_analytics da ON da.dish_id = d.id
  LEFT JOIN dish_categories dc ON dc.id = d.dish_category_id
  LEFT JOIN menu_categories mc ON mc.id = d.menu_category_id
  LEFT JOIN menus m            ON m.id  = mc.menu_id

  WHERE
    r.is_active = true
    AND r.status = 'published'                         -- ★ v2 status gate

    AND ST_DWithin(
      r.location_point,
      ST_SetSRID(ST_MakePoint(p_lng, p_lat), 4326)::geography,
      p_radius_m
    )
    AND d.is_available = true
    AND d.status = 'published'                         -- ★ v2 status gate

    -- Exclude parent display-only dishes from feed
    AND d.is_parent = false

    -- Exclude template dishes from feed (added in migration 114)
    AND d.is_template = false

    -- Exclude drinks
    AND (dc.id IS NULL OR dc.is_drink = false)

    AND (m.id IS NULL OR m.menu_type = 'food')
    AND (m.id IS NULL OR m.status = 'published')       -- ★ v2 status gate (LEFT JOIN null-safe)

    -- Exclude desserts
    AND (dc.id IS NULL OR lower(dc.name) <> 'dessert')

    -- Disliked dishes
    AND (
      array_length(p_disliked_dish_ids, 1) IS NULL
      OR d.id <> ALL(p_disliked_dish_ids)
    )

    -- Allergens (hard exclude)
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

    -- Permanent protein family exclusions (noMeat, noFish, noSeafood, noEggs, noDairy)
    AND (
      array_length(p_exclude_families, 1) IS NULL
      OR NOT (COALESCE(d.protein_families, '{}') && p_exclude_families)
    )

    -- Permanent spicy exclusion (noSpicy)
    AND (
      NOT p_exclude_spicy
      OR COALESCE(d.spice_level, 'none') <> 'hot'
    )

    -- Schedule type filter
    AND (
      p_schedule_type IS NULL
      OR m.id IS NULL
      OR m.schedule_type = p_schedule_type
    )

    -- Group/family meals filter
    AND (
      NOT p_group_meals
      OR d.serves >= 2
    )

    -- Time-based menu availability filter
    AND (
      p_current_time IS NULL
      OR m.id IS NULL
      OR m.available_start_time IS NULL
      OR m.available_end_time IS NULL
      OR (
        CASE
          WHEN m.available_start_time <= m.available_end_time THEN
            p_current_time BETWEEN m.available_start_time AND m.available_end_time
          ELSE
            p_current_time >= m.available_start_time OR p_current_time <= m.available_end_time
        END
      )
    )

    -- Day-of-week availability filter
    AND (
      p_current_day IS NULL
      OR m.id IS NULL
      OR m.available_days IS NULL
      OR array_length(m.available_days, 1) IS NULL
      OR p_current_day = ANY(m.available_days)
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

-- ── get_group_candidates ──────────────────────────────────────────────────────
-- Full body from migration 088 plus three added status clauses (marked ★).
--
-- TODO(design §8.2): d.is_template = false is NOT added here — the EXISTS
-- sub-query already filters enough for group recs and this is a pre-existing
-- gap flagged as out-of-v2-scope. Address in a dedicated follow-up migration.

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
    AND r.status = 'published'                         -- ★ v2 status gate
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
        AND d.status = 'published'                     -- ★ v2 status gate
        AND d.is_parent = false
        AND (dc.id IS NULL OR dc.is_drink = false)
        AND m.menu_type = 'food'
        AND m.status = 'published'                     -- ★ v2 status gate
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

COMMIT;
