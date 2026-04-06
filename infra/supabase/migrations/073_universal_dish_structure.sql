-- 073_universal_dish_structure.sql
-- Created: 2026-04-06
--
-- Implements the Universal Dish Structure redesign:
-- - Adds parent-child variant model to dishes table (parent_dish_id, is_parent)
-- - Adds serves + price_per_person (generated) to dishes table
-- - Expands dish_kind CHECK constraint to include 'combo'
-- - Adds schedule_type to menus table
-- - Adds performance indexes
--
-- Migration is ADDITIVE ONLY — no data loss, no breaking changes.
-- All new columns have sensible defaults so existing rows continue to work.

-- ── 1. dishes table: add parent-child variant columns ─────────────────────────

ALTER TABLE public.dishes
  ADD COLUMN IF NOT EXISTS parent_dish_id uuid
    REFERENCES public.dishes(id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS is_parent boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS serves integer NOT NULL DEFAULT 1
    CHECK (serves >= 1),
  ADD COLUMN IF NOT EXISTS price_per_person numeric
    GENERATED ALWAYS AS (
      CASE WHEN serves > 0 THEN ROUND(price / serves, 2) ELSE price END
    ) STORED;

-- ── 2. dishes table: expand dish_kind to include 'combo' ──────────────────────

-- Drop the existing check constraint (name varies by DB version, use IF EXISTS pattern)
ALTER TABLE public.dishes
  DROP CONSTRAINT IF EXISTS dishes_dish_kind_check;

ALTER TABLE public.dishes
  ADD CONSTRAINT dishes_dish_kind_check
    CHECK (dish_kind = ANY (ARRAY[
      'standard'::text,
      'template'::text,
      'experience'::text,
      'combo'::text
    ]));

-- ── 3. menus table: add schedule_type ─────────────────────────────────────────

ALTER TABLE public.menus
  ADD COLUMN IF NOT EXISTS schedule_type text NOT NULL DEFAULT 'regular'::text
    CHECK (schedule_type = ANY (ARRAY[
      'regular'::text,
      'daily'::text,
      'rotating'::text
    ]));

-- ── 4. Performance indexes ─────────────────────────────────────────────────────

-- Index for parent-child lookups (fetch all variants of a parent)
CREATE INDEX IF NOT EXISTS idx_dishes_parent_dish_id
  ON public.dishes(parent_dish_id)
  WHERE parent_dish_id IS NOT NULL;

-- Index for feed: exclude parent dishes quickly
CREATE INDEX IF NOT EXISTS idx_dishes_is_parent
  ON public.dishes(is_parent)
  WHERE is_parent = false;

-- ── 5. Update generate_candidates() to exclude parent dishes ──────────────────
--
-- Drop + recreate required because we're adding new parameters to the signature.

DROP FUNCTION IF EXISTS generate_candidates(
  double precision,   -- p_lat
  double precision,   -- p_lng
  double precision,   -- p_radius_m
  vector,             -- p_preference_vector
  uuid[],             -- p_disliked_dish_ids
  text[],             -- p_allergens
  text,               -- p_diet_tag
  text[],             -- p_religious_tags
  text[],             -- p_exclude_families
  boolean,            -- p_exclude_spicy
  integer             -- p_limit
);

CREATE OR REPLACE FUNCTION generate_candidates(
  p_lat                    FLOAT,
  p_lng                    FLOAT,
  p_radius_m               FLOAT    DEFAULT 10000,
  p_preference_vector      vector(1536) DEFAULT NULL,
  p_disliked_dish_ids      UUID[]   DEFAULT '{}',
  p_allergens              TEXT[]   DEFAULT '{}',
  p_diet_tag               TEXT     DEFAULT NULL,
  p_religious_tags         TEXT[]   DEFAULT '{}',
  p_exclude_families       TEXT[]   DEFAULT '{}',
  p_exclude_spicy          BOOLEAN  DEFAULT false,
  p_limit                  INT      DEFAULT 200,
  -- New parameters for Universal Dish Structure (all optional with safe defaults)
  p_current_time           TIME     DEFAULT NULL,
  p_current_day            TEXT     DEFAULT NULL,   -- 'mon'|'tue'|'wed'|'thu'|'fri'|'sat'|'sun'
  p_schedule_type          TEXT     DEFAULT NULL,   -- 'regular'|'daily'|'rotating'; NULL = all
  p_group_meals            BOOLEAN  DEFAULT false   -- true = serves >= 2
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
  -- New return columns
  parent_dish_id           UUID,
  serves                   INTEGER,
  price_per_person         NUMERIC
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
    d.price_per_person

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

    -- Exclude parent display-only dishes from feed (NEW)
    AND d.is_parent = false

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

    -- Schedule type filter: only show dishes from menus of matching schedule_type (NEW)
    AND (
      p_schedule_type IS NULL
      OR m.id IS NULL
      OR m.schedule_type = p_schedule_type
    )

    -- Group/family meals filter: only dishes that serve >= 2 people (NEW)
    AND (
      NOT p_group_meals
      OR d.serves >= 2
    )

    -- Time-based menu availability filter (NEW)
    -- Only apply if current time is provided and menu has explicit time constraints
    AND (
      p_current_time IS NULL
      OR m.id IS NULL
      OR m.available_start_time IS NULL
      OR m.available_end_time IS NULL
      OR (
        -- Handle overnight menus (e.g. 22:00–02:00)
        CASE
          WHEN m.available_start_time <= m.available_end_time THEN
            p_current_time BETWEEN m.available_start_time AND m.available_end_time
          ELSE
            p_current_time >= m.available_start_time OR p_current_time <= m.available_end_time
        END
      )
    )

    -- Day-of-week availability filter (NEW)
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

-- ── 6. Update get_group_candidates() to exclude parent dishes ─────────────────
--
-- get_group_candidates() filters at the dish level to enforce allergen/diet/
-- religious hard constraints, then aggregates to the restaurant level.
-- Parent dishes (is_parent=true) are display-only containers and must be excluded
-- so they don't inflate restaurant candidate scores.

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
  id               UUID,
  name             TEXT,
  cuisine_types    TEXT[],
  rating           NUMERIC,
  address          TEXT,
  phone            TEXT,
  location         JSONB,
  distance_m       FLOAT,
  restaurant_vector vector(1536),
  vector_distance  FLOAT
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
    AND ST_DWithin(
      r.location_point,
      ST_SetSRID(ST_MakePoint(p_lng, p_lat), 4326)::geography,
      p_radius_m
    )
    -- Restaurant must have at least one non-parent dish satisfying all hard constraints
    AND EXISTS (
      SELECT 1
      FROM dishes d
      JOIN menu_categories mc ON mc.id = d.menu_category_id
      JOIN menus m ON m.id = mc.menu_id
      LEFT JOIN dish_categories dc ON dc.id = d.dish_category_id
      WHERE
        d.restaurant_id = r.id
        AND d.is_available = true
        -- Exclude parent display-only dishes (NEW)
        AND d.is_parent = false
        -- Exclude drinks
        AND (dc.id IS NULL OR dc.is_drink = false)
        AND m.menu_type = 'food'
        -- Allergens (hard exclude: union of all members' allergens)
        AND (
          array_length(p_allergens, 1) IS NULL
          OR NOT (d.allergens && p_allergens)
        )
        -- Diet tag
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
