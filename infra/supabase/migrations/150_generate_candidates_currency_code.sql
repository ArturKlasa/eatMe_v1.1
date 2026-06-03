-- 150_generate_candidates_currency_code.sql
-- Created: 2026-06-03
--
-- Surfaces restaurants.currency_code (migration 147) through the
-- generate_candidates RPC so the feed Edge Function can pass it to the mobile
-- swipe-feed renderer. Closes the "Known follow-up" left open by the
-- restaurant-currency-handling rollout (docs/plans/restaurant-currency-handling.md):
-- without this column the swipe feed defaults dish prices to USD via
-- formatPrice(amount, undefined), even for PLN/EUR/etc. restaurants.
--
-- Single behavioural change relative to migration 142:
--   1. NEW return column:
--      - restaurant_currency_code TEXT — direct projection of r.currency_code
--        (NOT NULL since migration 147, CHECK ~ '^[A-Z]{3}$').
--
-- No WHERE-clause changes. No new joins. `restaurants r` was already joined
-- since migration 070 — this is a one-column projection addition.
--
-- Pre-apply checklist:
--   1. Migration 147 must be applied (provides restaurants.currency_code).
--   2. After applying, regenerate types:
--        supabase gen types typescript --linked > packages/database/src/types.ts
--      (optional — the feed Edge Function casts the rpc result to a local
--      Candidate type, so generated-type drift does not break runtime.)
--   3. Spot-check:
--        SELECT id, name, restaurant_name, restaurant_currency_code
--        FROM generate_candidates(40.7, -74.0, 5000) LIMIT 5;
--      Every row should carry a 3-letter uppercase code.
--
-- Reverse: 150_REVERSE_ONLY_generate_candidates_currency_code.sql restores
-- the migration 142 function body verbatim.

BEGIN;

-- RETURNS TABLE shape changes (adding 1 new column), so CREATE OR REPLACE
-- won't work — Postgres rejects it with 42P13. Drop the function first, then
-- recreate. The REVERSE_ONLY does the same dance in the other direction.
DROP FUNCTION IF EXISTS generate_candidates(
  FLOAT, FLOAT, FLOAT, vector(1536), UUID[], TEXT[], TEXT, TEXT[], TEXT[],
  BOOLEAN, INT, TIME, TEXT, TEXT, BOOLEAN
);

CREATE FUNCTION generate_candidates(
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
  id                          UUID,
  restaurant_id               UUID,
  name                        TEXT,
  description                 TEXT,
  price                       NUMERIC,
  dietary_tags                TEXT[],
  allergens                   TEXT[],
  calories                    INTEGER,
  spice_level                 TEXT,
  image_url                   TEXT,
  is_available                BOOLEAN,
  dish_kind                   TEXT,
  display_price_prefix        TEXT,
  enrichment_status           TEXT,
  vector_distance             FLOAT,
  distance_m                  FLOAT,
  restaurant_name             TEXT,
  restaurant_cuisines         TEXT[],
  restaurant_rating           NUMERIC,
  restaurant_location         JSONB,
  restaurant_currency_code    TEXT,
  popularity_score            FLOAT,
  view_count                  BIGINT,
  protein_families            TEXT[],
  protein_canonical_names     TEXT[],
  parent_dish_id              UUID,
  serves                      INTEGER,
  price_per_person            NUMERIC,
  primary_protein             TEXT,
  reachable_proteins          TEXT[],
  reachable_protein_families  TEXT[],
  dining_format               TEXT,
  bundled_items               JSONB,
  modifier_groups             JSONB
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = extensions, public
AS $$
BEGIN
  RETURN QUERY
  WITH dish_modifiers AS (
    SELECT
      g.dish_id,
      jsonb_agg(
        jsonb_build_object(
          'id',              g.id,
          'name',            g.name,
          'selection_type',  g.selection_type,
          'min_selections',  g.min_selections,
          'max_selections',  g.max_selections,
          'display_order',   g.display_order,
          'display_in_card', g.display_in_card,
          'options', (
            SELECT jsonb_agg(
              jsonb_build_object(
                'id',                   o.id,
                'name',                 o.name,
                'price_delta',          o.price_delta,
                'price_override',       o.price_override,
                'primary_protein',      o.primary_protein,
                'adds_dietary_tags',    o.adds_dietary_tags,
                'removes_dietary_tags', o.removes_dietary_tags,
                'adds_allergens',       o.adds_allergens,
                'serves_delta',         o.serves_delta,
                'is_default',           o.is_default,
                'display_order',        o.display_order
              ) ORDER BY o.display_order
            )
            FROM options o
            WHERE o.option_group_id = g.id AND o.is_available = true
          )
        ) ORDER BY g.display_order
      ) AS modifier_groups,

      array_agg(DISTINCT opt.primary_protein)
        FILTER (WHERE opt.primary_protein IS NOT NULL) AS option_proteins,

      bool_and(
        g.min_selections < 1
        OR EXISTS (
          SELECT 1 FROM options o2
          WHERE o2.option_group_id = g.id
            AND o2.is_available = true
            AND NOT (o2.adds_allergens && COALESCE(p_allergens, '{}'))
            AND NOT (
              p_diet_tag IS NOT NULL
              AND p_diet_tag = ANY(o2.removes_dietary_tags)
            )
        )
      ) AS required_groups_safe
    FROM option_groups g
    LEFT JOIN options opt
      ON opt.option_group_id = g.id
      AND opt.is_available = true
    WHERE g.is_active = true
    GROUP BY g.dish_id
  )
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
    r.currency_code  AS restaurant_currency_code,

    COALESCE(da.popularity_score, 0)::FLOAT   AS popularity_score,
    COALESCE(da.view_count, 0)::BIGINT        AS view_count,

    COALESCE(d.protein_families, '{}')        AS protein_families,
    COALESCE(d.protein_canonical_names, '{}') AS protein_canonical_names,

    d.parent_dish_id,
    d.serves,
    d.price_per_person,

    d.primary_protein,

    ARRAY(
      SELECT DISTINCT p.protein
      FROM unnest(
        ARRAY[d.primary_protein] || COALESCE(dm.option_proteins, ARRAY[]::TEXT[])
      ) AS p(protein)
      WHERE p.protein IS NOT NULL
    )::TEXT[] AS reachable_proteins,

    COALESCE((
      SELECT array_agg(DISTINCT f.fam)
      FROM unnest(
        ARRAY[d.primary_protein] || COALESCE(dm.option_proteins, ARRAY[]::TEXT[])
      ) AS p(protein)
      CROSS JOIN LATERAL unnest(
        CASE
          WHEN p.protein = 'chicken'                                       THEN ARRAY['meat', 'poultry']
          WHEN p.protein IN ('beef', 'pork', 'lamb', 'goat', 'other_meat') THEN ARRAY['meat']
          WHEN p.protein = 'fish'                                          THEN ARRAY['fish']
          WHEN p.protein = 'shellfish'                                     THEN ARRAY['shellfish']
          WHEN p.protein = 'eggs'                                          THEN ARRAY['eggs']
          ELSE ARRAY[]::TEXT[]
        END
      ) AS f(fam)
      WHERE p.protein IS NOT NULL
    ), ARRAY[]::TEXT[])::TEXT[] AS reachable_protein_families,

    d.dining_format,
    d.bundled_items,
    dm.modifier_groups

  FROM dishes d
  JOIN restaurants r ON r.id = d.restaurant_id
  LEFT JOIN dish_analytics da ON da.dish_id = d.id
  LEFT JOIN dish_categories dc ON dc.id = d.dish_category_id
  LEFT JOIN menu_categories mc ON mc.id = d.menu_category_id
  LEFT JOIN menus m            ON m.id  = mc.menu_id
  LEFT JOIN dish_modifiers dm  ON dm.dish_id = d.id

  WHERE
    r.is_active = true
    AND r.status = 'published'

    AND ST_DWithin(
      r.location_point,
      ST_SetSRID(ST_MakePoint(p_lng, p_lat), 4326)::geography,
      p_radius_m
    )
    AND d.is_available = true
    AND d.status = 'published'

    AND d.is_parent = false
    AND d.is_template = false

    AND (dc.id IS NULL OR dc.is_drink = false)

    AND (m.id IS NULL OR m.menu_type = 'food')
    AND (m.id IS NULL OR m.status = 'published')

    AND (dc.id IS NULL OR lower(dc.name) <> 'dessert')

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

    AND (
      array_length(p_exclude_families, 1) IS NULL
      OR NOT (COALESCE(d.protein_families, '{}') && p_exclude_families)
    )

    AND (
      NOT p_exclude_spicy
      OR COALESCE(d.spice_level, 'none') <> 'hot'
    )

    AND (
      p_schedule_type IS NULL
      OR m.id IS NULL
      OR m.schedule_type = p_schedule_type
    )

    AND (
      NOT p_group_meals
      OR d.serves >= 2
      OR EXISTS (
        SELECT 1
        FROM option_groups gg
        JOIN options oo ON oo.option_group_id = gg.id
        WHERE gg.dish_id = d.id
          AND gg.is_active = true
          AND oo.is_available = true
          AND (d.serves + oo.serves_delta) >= 2
      )
    )

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

    AND (
      p_current_day IS NULL
      OR m.id IS NULL
      OR m.available_days IS NULL
      OR array_length(m.available_days, 1) IS NULL
      OR p_current_day = ANY(m.available_days)
    )

    AND (
      p_current_time IS NULL
      OR d.available_hours_start IS NULL
      OR d.available_hours_end IS NULL
      OR (
        CASE
          WHEN d.available_hours_start <= d.available_hours_end THEN
            p_current_time BETWEEN d.available_hours_start AND d.available_hours_end
          ELSE
            p_current_time >= d.available_hours_start OR p_current_time <= d.available_hours_end
        END
      )
    )
    AND (
      p_current_day IS NULL
      OR d.available_days IS NULL
      OR array_length(d.available_days, 1) IS NULL
      OR p_current_day = ANY(d.available_days)
    )
    AND (d.available_from  IS NULL OR CURRENT_DATE >= d.available_from)
    AND (d.available_until IS NULL OR CURRENT_DATE <= d.available_until)

    AND COALESCE(dm.required_groups_safe, true) = true

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

COMMIT;
