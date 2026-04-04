-- 070_add_protein_families_column.sql
-- Created: 2026-03-28
--
-- Precomputes protein classification on dishes so the feed Edge Function
-- doesn't need to query dish_ingredients + canonical_ingredients at request
-- time for every protein-filter feed call.
--
-- Adds two columns to dishes:
--   protein_families TEXT[]          — ingredient family names present in the dish
--                                      e.g. '{meat,poultry}'
--                                      Values: meat | poultry | fish | shellfish |
--                                              eggs | dairy | plant_protein
--   protein_canonical_names TEXT[]   — canonical ingredient names for those families
--                                      e.g. '{chicken,butter}'
--                                      Used for meat-subtype matching.
--
-- Both are kept current by a trigger on dish_ingredients.
-- generate_candidates() is updated to return both columns so the Edge Function
-- can use them without any additional DB round-trips.

-- ── 1. Add columns ────────────────────────────────────────────────────────────

ALTER TABLE dishes
  ADD COLUMN IF NOT EXISTS protein_families       TEXT[] DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS protein_canonical_names TEXT[] DEFAULT '{}';

-- ── 2. Helper function (idempotent recalculation for one dish) ────────────────

CREATE OR REPLACE FUNCTION compute_dish_protein_families(p_dish_id UUID)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = extensions, public
AS $$
BEGIN
  UPDATE dishes d
  SET
    protein_families = (
      SELECT COALESCE(array_agg(DISTINCT ci.ingredient_family_name), '{}')
      FROM dish_ingredients di
      JOIN canonical_ingredients ci ON ci.id = di.ingredient_id
      WHERE di.dish_id = p_dish_id
        AND ci.ingredient_family_name IN (
          'meat', 'poultry', 'fish', 'shellfish', 'eggs', 'dairy', 'plant_protein'
        )
    ),
    protein_canonical_names = (
      SELECT COALESCE(array_agg(DISTINCT ci.canonical_name), '{}')
      FROM dish_ingredients di
      JOIN canonical_ingredients ci ON ci.id = di.ingredient_id
      WHERE di.dish_id = p_dish_id
        AND ci.ingredient_family_name IN (
          'meat', 'poultry', 'fish', 'shellfish', 'eggs', 'dairy', 'plant_protein'
        )
    )
  WHERE d.id = p_dish_id;
END;
$$;

-- ── 3. Backfill all existing dishes ──────────────────────────────────────────
-- Runs once at migration time. Safe to re-run.

UPDATE dishes d
SET
  protein_families = sub.families,
  protein_canonical_names = sub.names
FROM (
  SELECT
    di.dish_id,
    array_agg(DISTINCT ci.ingredient_family_name) FILTER (
      WHERE ci.ingredient_family_name IN (
        'meat', 'poultry', 'fish', 'shellfish', 'eggs', 'dairy', 'plant_protein'
      )
    ) AS families,
    array_agg(DISTINCT ci.canonical_name) FILTER (
      WHERE ci.ingredient_family_name IN (
        'meat', 'poultry', 'fish', 'shellfish', 'eggs', 'dairy', 'plant_protein'
      )
    ) AS names
  FROM dish_ingredients di
  JOIN canonical_ingredients ci ON ci.id = di.ingredient_id
  GROUP BY di.dish_id
) sub
WHERE d.id = sub.dish_id;

-- Dishes with no protein-family ingredients keep the '{}' default (already set above).

-- ── 4. GIN indexes for array containment / overlap queries ───────────────────

CREATE INDEX IF NOT EXISTS dishes_protein_families_idx
  ON dishes USING GIN (protein_families);

CREATE INDEX IF NOT EXISTS dishes_protein_canonical_names_idx
  ON dishes USING GIN (protein_canonical_names);

-- ── 5. Trigger function: keep columns current after dish_ingredients changes ──

CREATE OR REPLACE FUNCTION update_dish_protein_families()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = extensions, public
AS $$
DECLARE
  v_dish_id UUID;
BEGIN
  -- For INSERT/UPDATE use NEW.dish_id; for DELETE use OLD.dish_id
  v_dish_id := COALESCE(NEW.dish_id, OLD.dish_id);

  UPDATE dishes d
  SET
    protein_families = (
      SELECT COALESCE(array_agg(DISTINCT ci.ingredient_family_name), '{}')
      FROM dish_ingredients di
      JOIN canonical_ingredients ci ON ci.id = di.ingredient_id
      WHERE di.dish_id = v_dish_id
        AND ci.ingredient_family_name IN (
          'meat', 'poultry', 'fish', 'shellfish', 'eggs', 'dairy', 'plant_protein'
        )
    ),
    protein_canonical_names = (
      SELECT COALESCE(array_agg(DISTINCT ci.canonical_name), '{}')
      FROM dish_ingredients di
      JOIN canonical_ingredients ci ON ci.id = di.ingredient_id
      WHERE di.dish_id = v_dish_id
        AND ci.ingredient_family_name IN (
          'meat', 'poultry', 'fish', 'shellfish', 'eggs', 'dairy', 'plant_protein'
        )
    )
  WHERE d.id = v_dish_id;

  RETURN COALESCE(NEW, OLD);
END;
$$;

-- ── 6. Attach trigger to dish_ingredients ────────────────────────────────────

DROP TRIGGER IF EXISTS dish_ingredients_update_protein ON dish_ingredients;

CREATE TRIGGER dish_ingredients_update_protein
  AFTER INSERT OR UPDATE OR DELETE ON dish_ingredients
  FOR EACH ROW
  EXECUTE FUNCTION update_dish_protein_families();

-- ── 7. Update generate_candidates() to return both new columns ───────────────
-- Replaces the version from 065. All logic is identical except the two extra
-- columns in RETURNS TABLE and SELECT.
--
-- PostgreSQL requires DROP + CREATE when the RETURNS TABLE signature changes.
-- The anon/authenticated/service_role GRANTs are re-applied below.

DROP FUNCTION IF EXISTS generate_candidates(
  double precision,
  double precision,
  double precision,
  vector,
  uuid[],
  text[],
  text,
  text[],
  integer
);

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
  right_swipe_count        BIGINT,
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
    COALESCE(da.right_swipe_count, 0)::BIGINT AS right_swipe_count,

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
GRANT EXECUTE ON FUNCTION compute_dish_protein_families TO service_role;
