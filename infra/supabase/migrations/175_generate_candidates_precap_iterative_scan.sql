-- ══════════════════════════════════════════════════════════════════════════════
-- Migration 175: generate_candidates — coordinated D-11 change set
--   (a) hnsw.iterative_scan GUC (D-04/D-05, PERF-01 SC#2)
--   (b) per-restaurant ROW_NUMBER() pre-cap K=8 (D-06/D-07, PERF-02 SC#3)
--
-- D-06 (pre-cap) and D-04 (iterative_scan) BOTH modify generate_candidates, so per
-- D-11 they land together as ONE coordinated change set with a single REVERSE pair.
--
-- The 13-arg signature AND the 32-column RETURNS TABLE shape are UNCHANGED from
-- migration 169, so PART (b) is a CREATE OR REPLACE (no DROP) — backward/forward
-- compatible with either feed build, no deploy-ordering constraint.
--
-- ── PART (a): iterative_scan ───────────────────────────────────────────────────
-- pgvector applies hard filters AFTER the HNSW index scan, so a heavily-filtered
-- personalized request (radius + diet + exclude-families + time/day windows,
-- 169:153-299) applied after the `d.embedding <=> p_preference_vector` ANN ordering
-- can under-return badly with the default ef_search=40. `hnsw.iterative_scan =
-- relaxed_order` auto-expands the scan until the LIMIT is met (the durable half of
-- PERF-01; complementary to, not replaced by, the Plan-04 tiered-radius loop). The
-- GUC is scoped to ONLY this function via ALTER FUNCTION (not session-global), so it
-- self-restores at function exit and never leaks across pooled connections.
-- `relaxed_order` is safe here because BOTH the CTE inner ORDER BY and the outer
-- query re-impose the vector_distance sort, and the JS Stage-2 re-scores anyway —
-- so the only effect is WHICH candidate set survives (recall), not the order.
-- The GUC tunes the HNSW index scan on dishes.embedding (migration 136,
-- dishes_embedding_hnsw_idx) inside the materialized CTE.
--
-- ── PART (b): per-restaurant pre-cap ───────────────────────────────────────────
-- The candidates CTE is wrapped in a windowed `ranked` subquery that computes
-- ROW_NUMBER() OVER (PARTITION BY d.restaurant_id ORDER BY <same proxy as the global
-- sort>) and keeps only rn <= 8 per restaurant before the existing global
-- ORDER BY + LIMIT p_limit. This bounds the Stage-1 → Stage-2 handoff payload
-- (PERF-02). The window ORDER BY uses the underlying expressions (not the OUT-param
-- aliases) because `rn` is computed before the `ranked`-layer aliases are visible.
-- K=8 is >2.5x the JS applyDiversity max-3 cap (feed/index.ts:951), so the JS top-3
-- is almost always within the proxy top-8 — behavior-preserving (Plan-01
-- precap-behavior.test.ts is the automated gate, SC#3).
--
-- Everything from the CTE-close `)` through the LATERAL modifier-JSON block and the
-- final projection is byte-identical to migration 169 (single round-trip + the
-- migration-167 open_hours/timezone/country_code fold preserved). The
-- `#variable_conflict use_column` directive is KEPT — the new ROW_NUMBER ORDER BY
-- relies on the OUTER bare column refs resolving to columns, not OUT params.
--
-- The GUC values below are TUNABLE STARTING POINTS. Recall/latency of iterative_scan
-- is OPERATOR-GATED (D-04): this migration is authored + dry-run only — it is NOT
-- pushed/applied from here. The operator applies it to prod (Plan 05 handoff) and
-- validates recall + latency, then tunes ef_search / max_scan_tuples / scan_mem_multiplier.
-- ══════════════════════════════════════════════════════════════════════════════

BEGIN;

-- ── PART (a): scope the iterative-scan GUCs to ONLY the feed RPC ────────────────
-- Full 13-arg signature is required to uniquely identify the function (taken
-- verbatim from 169:42-54 declared types; `vector(1536)` is written bare `vector`,
-- as 167_REVERSE:13-15 proves both forms resolve).
--
-- Primary form: comma-separated multi-SET (PostgreSQL ALTER FUNCTION accepts a list
-- of SET actions). Pitfall-1 fallback (commented prose only): if the prod pg version
-- rejects the multi-SET form, emit one statement per GUC instead — all four are
-- independent and idempotent:
--   ALTER FUNCTION generate_candidates(...) SET hnsw.iterative_scan      = 'relaxed_order';
--   ALTER FUNCTION generate_candidates(...) SET hnsw.max_scan_tuples     = 20000;
--   ALTER FUNCTION generate_candidates(...) SET hnsw.scan_mem_multiplier = 2;
--   ALTER FUNCTION generate_candidates(...) SET hnsw.ef_search           = 400;
ALTER FUNCTION generate_candidates(
  FLOAT, FLOAT, FLOAT, vector, UUID[], TEXT, TEXT[], BOOLEAN, INT, TIME, TEXT, TEXT, BOOLEAN
)
  SET hnsw.iterative_scan      = 'relaxed_order'   -- D-05: order re-imposed downstream by the CTE + outer ORDER BY
  SET hnsw.max_scan_tuples     = 20000             -- default ceiling; bounds worst-case scan cost under heavy filters (tunable)
  SET hnsw.scan_mem_multiplier = 2                 -- headroom over work_mem so raising max_scan_tuples can help recall (tunable)
  SET hnsw.ef_search           = 400;              -- >= 2x p_limit=200 per pgvector guidance (tunable)

-- ── PART (b): re-emit generate_candidates with the per-restaurant ROW_NUMBER pre-cap
-- (CREATE OR REPLACE — 32-column shape unchanged, no DROP).
CREATE OR REPLACE FUNCTION generate_candidates(
  p_lat                    FLOAT,
  p_lng                    FLOAT,
  p_radius_m               FLOAT        DEFAULT 10000,
  p_preference_vector      vector(1536) DEFAULT NULL,
  p_disliked_dish_ids      UUID[]       DEFAULT '{}',
  p_diet_tag               TEXT         DEFAULT NULL,
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
  calories                    INTEGER,
  spice_level                 TEXT,
  image_url                   TEXT,
  is_available                BOOLEAN,
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
  serves                      INTEGER,
  primary_protein             TEXT,
  reachable_proteins          TEXT[],
  reachable_protein_families  TEXT[],
  dining_format               TEXT,
  bundled_items               JSONB,
  modifier_groups             JSONB,
  open_hours                  JSONB,
  timezone                    TEXT,
  country_code                TEXT
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = extensions, public
AS $$
#variable_conflict use_column
BEGIN
  RETURN QUERY
  -- (1) Pick the top-N in-range dishes with NO modifier work. MATERIALIZED so the
  --     planner computes this set (filter → per-restaurant pre-cap → sort → LIMIT)
  --     before the LATERAL below ever runs. Sort keys are carried as columns for the
  --     outer ORDER BY.
  WITH candidates AS MATERIALIZED (
    -- D-06/D-07 pre-cap: the inner SELECT (identical column projection + JOINs +
    -- WHERE to migration 169) is wrapped in a `ranked` subquery that computes a
    -- per-restaurant ROW_NUMBER. The window ORDER BY uses the underlying
    -- expressions (NOT the vector_distance/popularity_score/distance_m aliases),
    -- because `rn` is computed before those aliases are visible at the `ranked`
    -- layer. It mirrors the global sort proxy exactly, so the K survivors per
    -- restaurant are the best K by the same signal the function already trusts.
    SELECT * FROM (
      SELECT
        d.id,
        d.restaurant_id,
        d.name,
        d.description,
        d.price,
        d.calories,
        d.spice_level,
        d.image_url,
        d.is_available,
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

        d.serves,
        d.primary_protein,
        d.dining_format,
        d.bundled_items,
        r.open_hours,
        r.timezone,
        r.country_code,

        -- D-06/D-07: per-restaurant rank by the SAME proxy as the global sort
        -- (vector_distance, then popularity_score, then distance_m), expressed via
        -- the underlying expressions (aliases are not visible to the window here).
        ROW_NUMBER() OVER (
          PARTITION BY d.restaurant_id
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
        ) AS rn

      FROM dishes d
      JOIN restaurants r ON r.id = d.restaurant_id
      LEFT JOIN dish_analytics da ON da.dish_id = d.id
      LEFT JOIN dish_categories dc ON dc.id = d.dish_category_id
      LEFT JOIN menu_categories mc ON mc.id = d.menu_category_id
      LEFT JOIN menus m            ON m.id  = mc.menu_id

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

        AND (dc.id IS NULL OR dc.is_drink = false)

        AND (m.id IS NULL OR m.menu_type = 'food')
        AND (m.id IS NULL OR m.status = 'published')

        AND (dc.id IS NULL OR lower(dc.name) <> 'dessert')

        AND (
          array_length(p_disliked_dish_ids, 1) IS NULL
          OR d.id <> ALL(p_disliked_dish_ids)
        )

        -- Diet hard filter (protein-based; replaces the old dietary_tags[] logic):
        --   vegan      -> dish primary_protein must be 'vegan'
        --   vegetarian -> dish must carry no meat/poultry/fish/shellfish family
        --                 (eggs are allowed = lacto-ovo)
        AND (
          p_diet_tag IS NULL
          OR CASE p_diet_tag
               WHEN 'vegan'      THEN d.primary_protein = 'vegan'
               WHEN 'vegetarian' THEN NOT (
                 COALESCE(d.protein_families, '{}') && ARRAY['meat', 'poultry', 'fish', 'shellfish']
               )
               ELSE true
             END
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

        -- required_groups_safe, inlined from migration 167's dish_modifiers CTE.
        -- Exclude a dish iff it has any required (min_selections >= 1), active group
        -- with NO available option compatible with the active diet filter. An option
        -- with NULL primary_protein inherits the dish (which already passed the
        -- dish-level diet filter), so it is always compatible. Boundary cases match
        -- the old bool_and form exactly: no diet filter -> passes (short-circuits);
        -- dish with no groups -> passes; required group with no compatible option ->
        -- excluded.
        AND (
          p_diet_tag IS NULL
          OR NOT EXISTS (
            SELECT 1
            FROM option_groups g
            WHERE g.dish_id = d.id
              AND g.is_active = true
              AND g.min_selections >= 1
              AND NOT EXISTS (
                SELECT 1
                FROM options o2
                WHERE o2.option_group_id = g.id
                  AND o2.is_available = true
                  AND (
                    o2.primary_protein IS NULL
                    OR CASE p_diet_tag
                         WHEN 'vegan'      THEN o2.primary_protein = 'vegan'
                         WHEN 'vegetarian' THEN o2.primary_protein NOT IN
                           ('chicken','turkey','beef','pork','lamb','goat','other_meat','fish','shellfish')
                         ELSE true
                       END
                  )
              )
          )
        )
    ) ranked
    WHERE ranked.rn <= 8   -- per-restaurant pre-cap K (D-07; range 5-10, start 8 = >2.5x the JS max-3 cap at feed/index.ts:951)

    ORDER BY
      vector_distance ASC NULLS LAST,
      popularity_score DESC,
      distance_m ASC

    LIMIT p_limit
  )
  -- (2) Build modifier JSON + option_proteins for ONLY the survivors, then project
  --     the modifier-derived columns (reachable_proteins/families, modifier_groups).
  SELECT
    c.id,
    c.restaurant_id,
    c.name,
    c.description,
    c.price,
    c.calories,
    c.spice_level,
    c.image_url,
    c.is_available,
    c.display_price_prefix,
    c.enrichment_status,
    c.vector_distance,
    c.distance_m,
    c.restaurant_name,
    c.restaurant_cuisines,
    c.restaurant_rating,
    c.restaurant_location,
    c.restaurant_currency_code,
    c.popularity_score,
    c.view_count,
    c.protein_families,
    c.protein_canonical_names,
    c.serves,
    c.primary_protein,

    ARRAY(
      SELECT DISTINCT p.protein
      FROM unnest(
        ARRAY[c.primary_protein] || COALESCE(dm.option_proteins, ARRAY[]::TEXT[])
      ) AS p(protein)
      WHERE p.protein IS NOT NULL
    )::TEXT[] AS reachable_proteins,

    COALESCE((
      SELECT array_agg(DISTINCT f.fam)
      FROM unnest(
        ARRAY[c.primary_protein] || COALESCE(dm.option_proteins, ARRAY[]::TEXT[])
      ) AS p(protein)
      CROSS JOIN LATERAL unnest(
        CASE
          WHEN p.protein IN ('chicken', 'turkey')                          THEN ARRAY['meat', 'poultry']
          WHEN p.protein IN ('beef', 'pork', 'lamb', 'goat', 'other_meat') THEN ARRAY['meat']
          WHEN p.protein = 'fish'                                          THEN ARRAY['fish']
          WHEN p.protein = 'shellfish'                                     THEN ARRAY['shellfish']
          WHEN p.protein = 'eggs'                                          THEN ARRAY['eggs']
          ELSE ARRAY[]::TEXT[]
        END
      ) AS f(fam)
      WHERE p.protein IS NOT NULL
    ), ARRAY[]::TEXT[])::TEXT[] AS reachable_protein_families,

    c.dining_format,
    c.bundled_items,
    dm.modifier_groups,
    c.open_hours,
    c.timezone,
    c.country_code

  FROM candidates c
  LEFT JOIN LATERAL (
    SELECT
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
        FILTER (WHERE opt.primary_protein IS NOT NULL) AS option_proteins
    FROM option_groups g
    LEFT JOIN options opt
      ON opt.option_group_id = g.id
      AND opt.is_available = true
    WHERE g.is_active = true
      AND g.dish_id = c.id
    GROUP BY g.dish_id
  ) dm ON true

  ORDER BY
    c.vector_distance ASC NULLS LAST,
    c.popularity_score DESC,
    c.distance_m ASC;
END;
$$;

GRANT EXECUTE ON FUNCTION generate_candidates TO anon, authenticated, service_role;

COMMIT;
