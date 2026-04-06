-- 072_remove_swipe_feature.sql
-- Created: 2026-04-06
--
-- Removes all database artefacts belonging to the dish-preference swipe feature.
-- The swipe Edge Function (/functions/v1/swipe) must be undeployed before this
-- migration runs, otherwise active calls would fail.
--
-- Preserved (not touched here):
--   - preference_vector / preference_vector_updated_at  (written by update-preference-vector)
--   - user_dish_interactions  (used by interaction + preference vector pipeline)
--   - popularity_score, view_count in dish_analytics    (used by the feed function)
--   - super_like_count in dish_analytics                (used for future explicit ratings)

-- ── 1. Drop user_swipes table ─────────────────────────────────────────────────
-- No other table has a FK pointing TO user_swipes, so a plain DROP is safe.

DROP TABLE IF EXISTS public.user_swipes;

-- ── 2. Remove swipe counters from dish_analytics ─────────────────────────────

ALTER TABLE public.dish_analytics
  DROP COLUMN IF EXISTS right_swipe_count,
  DROP COLUMN IF EXISTS left_swipe_count,
  DROP COLUMN IF EXISTS recent_swipes_24h;

-- ── 3. Remove swipe counters from user_behavior_profiles ─────────────────────

ALTER TABLE public.user_behavior_profiles
  DROP COLUMN IF EXISTS total_swipes,
  DROP COLUMN IF EXISTS right_swipes,
  DROP COLUMN IF EXISTS left_swipes,
  DROP COLUMN IF EXISTS super_swipes,
  DROP COLUMN IF EXISTS right_swipe_rate;

-- ── 4. Recreate generate_candidates without right_swipe_count ────────────────
--
-- The existing function (migration 071) returns right_swipe_count in its result
-- set.  Because we just dropped the source column, we must replace the function
-- before any caller can invoke it.  The return-type change requires DROP + CREATE.

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
  p_limit                  INT      DEFAULT 200
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
  protein_canonical_names  TEXT[]
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
    COALESCE(d.protein_canonical_names, '{}') AS protein_canonical_names

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
