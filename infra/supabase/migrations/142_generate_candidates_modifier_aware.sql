-- 142_generate_candidates_modifier_aware.sql
-- Created: 2026-05-18
--
-- Phase 1 of the dish-model rewrite (docs/plans/dish-model-rewrite-phase-1-database.md §3).
-- Modifier-aware rewrite of generate_candidates. Five additive design points
-- relative to the migration 122 baseline:
--
--   1. NEW return columns (5):
--      - reachable_proteins        TEXT[]   base.primary_protein + all option.primary_protein
--      - reachable_protein_families TEXT[]  CASE-mapped families (matches
--                                            deriveProteinFields() in
--                                            packages/shared/src/logic/protein.ts:24)
--      - dining_format             TEXT     direct projection from migration 141
--      - bundled_items             JSONB    direct projection from migration 141
--      - modifier_groups           JSONB    pre-aggregated [{group, options[]}]
--                                            for the feed function's variant
--                                            selection step
--
--   2. NEW WHERE clauses:
--      - dish-level availability windows (uses p_current_time / p_current_day
--        params consistent with the existing menu-level pattern; uses
--        CURRENT_DATE directly for date ranges)
--      - serves_delta accounting in p_group_meals (a dish passes the group-meals
--        filter if ANY available option can push serves >= 2)
--      - required_groups_safe pre-filter: dishes with a required modifier group
--        whose options ALL conflict with the user's p_allergens or p_diet_tag
--        are excluded. Religious tags are intentionally NOT considered here —
--        no worker / admin tool currently emits religious-tag removes for
--        modifier options, so the filter would no-op (decided 2026-05-18).
--
--   3. CTE design: a single `dish_modifiers` CTE pre-aggregates modifier_groups
--      JSON, option_proteins array, and required_groups_safe boolean per dish_id.
--      LEFT JOIN'd to dishes — dishes without any active option_groups get NULL
--      from the CTE, treated as safe by COALESCE in WHERE. Net effect: zero
--      behavioural change for legacy data (no dishes have modifier groups
--      until Phase 4 / Phase 6).
--
--   4. Protein-family CASE mirrors deriveProteinFields() exactly:
--        chicken                          → ['meat', 'poultry']
--        beef/pork/lamb/goat/other_meat   → ['meat']
--        fish                             → ['fish']
--        shellfish                        → ['shellfish']
--        eggs                             → ['eggs']
--        vegetarian/vegan/other           → []
--      The multi-value mapping for chicken AND the empty-array mapping for
--      vegetarian/vegan are load-bearing — the existing protein_families column
--      uses the same shape, so the new reachable_protein_families is
--      drop-in-compatible with feed scoring code that reads either column.
--
--   5. required_groups_safe is intentionally NOT in RETURNS TABLE — since we
--      filter on it in WHERE, every returned row has it equal to true, so the
--      column would be wire-payload waste (decided 2026-05-18). Diagnostic
--      access is still possible via direct CTE inspection if needed.
--
-- Pre-apply checklist:
--   1. Migrations 140 + 141 + 141a must already be applied.
--   2. After applying, regenerate types:
--        supabase gen types typescript --linked > packages/database/src/types.ts
--   3. Spot-check existing dishes return identical rows + new columns:
--        SELECT id, name, primary_protein, reachable_proteins,
--               reachable_protein_families, dining_format, modifier_groups
--        FROM generate_candidates(40.7, -74.0, 5000) LIMIT 5;
--      For dishes without modifier groups expect:
--        reachable_proteins         = ARRAY[primary_protein]
--        reachable_protein_families = same as protein_families column
--        modifier_groups            = NULL
--   4. Performance benchmark: p95 within 20% of migration 122 baseline (per
--      docs/plans/dish-model-rewrite-phase-1-database.md §7 acceptance).
--      No new indexes added — option_groups is empty in prod today, so the
--      CTE costs ~nothing. Re-evaluate if Phase 4 ships meaningful modifier
--      data.
--
-- Reverse: 142_REVERSE_ONLY_generate_candidates_modifier_aware.sql restores
-- the migration 122 function body verbatim.

BEGIN;

-- RETURNS TABLE shape changes (adding 5 new columns), so CREATE OR REPLACE
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
  popularity_score            FLOAT,
  view_count                  BIGINT,
  protein_families            TEXT[],
  protein_canonical_names     TEXT[],
  parent_dish_id              UUID,
  serves                      INTEGER,
  price_per_person            NUMERIC,
  primary_protein             TEXT,
  -- NEW columns (5)
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

      -- For each active option_group, the group is "safe" if it's optional
      -- (min_selections < 1) OR at least one available option survives the
      -- user's allergen/diet hard filters. bool_and aggregates across all
      -- groups for the dish — safe iff every required group has a safe option.
      --
      -- Diet-tag safety uses exact match against removes_dietary_tags. The
      -- worker contract (docs/plans/dish-model-rewrite-phase-2-backend.md §1)
      -- requires that meat/fish/dairy-adding options emit BOTH 'vegetarian'
      -- AND 'vegan' in removes_dietary_tags. A worker that emits only 'vegan'
      -- would silently let chicken options through for vegetarian users; that
      -- contract is enforced in the worker tests, not here.
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

    COALESCE(da.popularity_score, 0)::FLOAT   AS popularity_score,
    COALESCE(da.view_count, 0)::BIGINT        AS view_count,

    COALESCE(d.protein_families, '{}')        AS protein_families,
    COALESCE(d.protein_canonical_names, '{}') AS protein_canonical_names,

    d.parent_dish_id,
    d.serves,
    d.price_per_person,

    d.primary_protein,

    -- NEW: reachable_proteins = base.primary_protein UNION option proteins
    ARRAY(
      SELECT DISTINCT p.protein
      FROM unnest(
        ARRAY[d.primary_protein] || COALESCE(dm.option_proteins, ARRAY[]::TEXT[])
      ) AS p(protein)
      WHERE p.protein IS NOT NULL
    )::TEXT[] AS reachable_proteins,

    -- NEW: reachable_protein_families — mirrors deriveProteinFields() exactly.
    -- Multi-value mapping for chicken; empty for vegetarian/vegan/other.
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

    -- Exclude parent display-only dishes from feed (drop in Phase 7)
    AND d.is_parent = false

    -- Exclude template dishes from feed (drop in Phase 7)
    AND d.is_template = false

    -- Exclude drinks
    AND (dc.id IS NULL OR dc.is_drink = false)

    AND (m.id IS NULL OR m.menu_type = 'food')
    AND (m.id IS NULL OR m.status = 'published')

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

    -- Religious tags (base dish dietary_tags only)
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

    -- Group/family meals filter — extended: a dish passes if its base serves
    -- >= 2, OR if any available option in any active group can push serves
    -- (via serves_delta) to >= 2.
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

    -- Menu-level time filter (existing, unchanged)
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

    -- Menu-level day filter (existing, unchanged)
    AND (
      p_current_day IS NULL
      OR m.id IS NULL
      OR m.available_days IS NULL
      OR array_length(m.available_days, 1) IS NULL
      OR p_current_day = ANY(m.available_days)
    )

    -- NEW: dish-level availability windows (param-driven for hours/days,
    -- CURRENT_DATE for date ranges). Hours filter mirrors the menu-level CASE
    -- pattern above to support overnight windows (e.g., a dinner dish open
    -- 17:00–02:00). Filter is disabled when EITHER bound is NULL, matching the
    -- menu-level pattern; single-bounded windows are not supported by design.
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

    -- NEW: required_groups_safe pre-filter. Dishes with no active option_groups
    -- yield NULL from the LEFT JOIN — COALESCE to true (no required groups
    -- means nothing to violate).
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
