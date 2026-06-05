-- 155_retire_dietary_allergen_rpcs.sql
-- Created: 2026-06-05
--
-- Part 1 of 2 in the "abandon dish-level allergens + dietary tags" rollout
-- (docs/plans/abandon-allergens-dietary.md, Phase 7). This migration rewrites
-- every live RPC that still reads or writes the dish/option allergen + dietary
-- columns, so that migration 156 can drop those columns without breaking any
-- function at runtime. RPCs MUST be replaced before the columns are dropped.
--
-- Product context: EatMe is a discovery + protein-based filtering app, NOT an
-- allergen-safety app. primary_protein (11-value enum) is the sole surviving
-- food-classification axis. The dish-level allergens[] / dietary_tags[] data was
-- always empty (no reliable data-entry path), so this is dead-weight removal,
-- not a feature regression.
--
-- Changes (all behaviour-preserving except the intended allergen/dietary drop):
--
--   1. generate_candidates — RETURNS TABLE shape changes (drops dietary_tags +
--      allergens columns) and the param list changes (drops p_allergens +
--      p_religious_tags), so DROP + CREATE is required (Postgres 42P13).
--        * diet filter rewired from dietary_tags[] to protein-based:
--            vegan      -> primary_protein = 'vegan'
--            vegetarian -> no meat/poultry/fish/shellfish protein family (eggs OK)
--          This mirrors the Phase 2 feed Edge Function semantics exactly.
--        * required_groups_safe rewired from allergen/removes_dietary_tags to
--          protein-based: a required group is "safe" if it has >=1 available
--          option whose primary_protein is compatible with the diet (or NULL =
--          inherits the dish, which already passed the dish-level filter).
--        * option modifier JSONB drops adds_dietary_tags / removes_dietary_tags
--          / adds_allergens.
--
--   2. get_group_candidates — same protein rewrite, inlined (no CTE). RETURN
--      type unchanged (restaurants only), so CREATE OR REPLACE suffices. Drops
--      p_allergens + p_religious_tags params.
--
--   3. admin_confirm_menu_scan — drops allergens/dietary_tags from the three
--      dish INSERTs (they only ever wrote ARRAY[]::text[]) and drops
--      removes_dietary_tags/adds_dietary_tags/adds_allergens from the options
--      INSERT (the worker no longer emits those keys — Phase 2). Body otherwise
--      verbatim from migration 146.
--
--   4. Drops the orphaned calculate_dish_allergens / calculate_dish_dietary_tags
--      RPCs (no callers anywhere; appear only in stale generated types).
--
-- Pre-apply checklist:
--   1. Migrations up to 154 applied.
--   2. Deploy the Phase 2 edge functions (feed, group-recommendations,
--      menu-scan-worker, enrich-dish, nearby-restaurants) BEFORE or WITH this —
--      they already stopped passing p_allergens/p_religious_tags and stopped
--      reading dietary_tags/allergens.
--   3. Apply 156 immediately after (drops the now-unreferenced columns + tables).
--   4. Regenerate types:
--        supabase gen types typescript --linked > packages/database/src/types.ts
--   5. Spot-check:
--        SELECT id, name, primary_protein FROM generate_candidates(40.7,-74.0,5000) LIMIT 5;
--        SELECT id, name FROM get_group_candidates(40.7,-74.0,5000) LIMIT 5;
--
-- Reverse: 155_REVERSE_ONLY_retire_dietary_allergen_rpcs.sql restores the
-- migration 150 / 143 / 146 function bodies verbatim. (calculate_dish_* are not
-- restored — they have no source in-repo and no callers.)

BEGIN;

-- ════════════════════════════════════════════════════════════════════════════
-- (1) generate_candidates — protein-based, no allergens/dietary_tags
-- ════════════════════════════════════════════════════════════════════════════

-- Param list + RETURNS TABLE both change → drop the old (migration 150)
-- signature first, then recreate.
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

      -- A required group (min_selections >= 1) is "safe" only if it offers at
      -- least one available option compatible with the hard diet filter. An
      -- option with NULL primary_protein inherits the dish (which already passed
      -- the dish-level diet filter), so it is always safe. When no diet filter
      -- is active, every group is trivially safe.
      bool_and(
        g.min_selections < 1
        OR p_diet_tag IS NULL
        OR EXISTS (
          SELECT 1 FROM options o2
          WHERE o2.option_group_id = g.id
            AND o2.is_available = true
            AND (
              o2.primary_protein IS NULL
              OR CASE p_diet_tag
                   WHEN 'vegan'      THEN o2.primary_protein = 'vegan'
                   WHEN 'vegetarian' THEN o2.primary_protein NOT IN
                     ('chicken','beef','pork','lamb','goat','other_meat','fish','shellfish')
                   ELSE true
                 END
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


-- ════════════════════════════════════════════════════════════════════════════
-- (2) get_group_candidates — protein-based, no allergens/dietary_tags
-- ════════════════════════════════════════════════════════════════════════════

-- Param list changes (drops p_allergens + p_religious_tags) → drop the old
-- (migration 143) signature first, then recreate. RETURN type is unchanged.
DROP FUNCTION IF EXISTS get_group_candidates(
  FLOAT, FLOAT, FLOAT, vector(1536), TEXT[], TEXT, TEXT[], INT
);

CREATE FUNCTION get_group_candidates(
  p_lat            FLOAT,
  p_lng            FLOAT,
  p_radius_m       FLOAT        DEFAULT 10000,
  p_group_vector   vector(1536) DEFAULT NULL,
  p_diet_tag       TEXT         DEFAULT NULL,
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
        AND d.is_template = false
        AND (dc.id IS NULL OR dc.is_drink = false)
        AND m.menu_type = 'food'
        AND m.status = 'published'
        -- Diet hard filter (protein-based; replaces the old dietary_tags[] logic)
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
        -- Modifier-aware safety check (protein-based). A dish counts only if
        -- EVERY required option_group offers at least one diet-compatible option
        -- (or an option with NULL primary_protein, which inherits the dish).
        -- No-op when p_diet_tag IS NULL.
        AND NOT EXISTS (
          SELECT 1 FROM option_groups g
          WHERE g.dish_id = d.id
            AND g.is_active = true
            AND g.min_selections >= 1
            AND p_diet_tag IS NOT NULL
            AND NOT EXISTS (
              SELECT 1 FROM options o
              WHERE o.option_group_id = g.id
                AND o.is_available = true
                AND (
                  o.primary_protein IS NULL
                  OR CASE p_diet_tag
                       WHEN 'vegan'      THEN o.primary_protein = 'vegan'
                       WHEN 'vegetarian' THEN o.primary_protein NOT IN
                         ('chicken','beef','pork','lamb','goat','other_meat','fish','shellfish')
                       ELSE true
                     END
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


-- ════════════════════════════════════════════════════════════════════════════
-- (3) admin_confirm_menu_scan — drop allergen/dietary inserts
-- ════════════════════════════════════════════════════════════════════════════
-- Body verbatim from migration 146, with:
--   * `allergens, dietary_tags,` removed from all three dish INSERT column lists
--     and their `ARRAY[]::text[], ARRAY[]::text[],` removed from VALUES.
--   * `removes_dietary_tags, adds_dietary_tags, adds_allergens,` removed from the
--     options INSERT column list and the three COALESCE(ARRAY(...)) value blocks.

CREATE OR REPLACE FUNCTION public.admin_confirm_menu_scan(
  p_job_id      uuid,
  p_admin_id    uuid,
  p_admin_email text,
  p_payload     jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public, extensions
AS $fn$
DECLARE
  -- Job + restaurant context
  v_job                    public.menu_scan_jobs%ROWTYPE;
  v_restaurant_id          uuid;
  v_country_code           text;
  v_source_language        text;
  v_prev_status            text;

  -- Menu resolution
  v_menu_id                uuid;
  v_menu_created           boolean := false;

  -- Category resolution
  v_categories_created     integer := 0;
  v_categories_linked      integer := 0;

  -- Dish counters
  v_inserted_ids           uuid[]  := ARRAY[]::uuid[];
  v_parents_count          integer := 0;
  v_variants_count         integer := 0;
  v_courses_count          integer := 0;
  v_course_items_count     integer := 0;
  v_modifier_groups_count  integer := 0;
  v_modifier_options_count integer := 0;

  -- Iteration vars
  v_dish                   jsonb;
  v_variant                jsonb;
  v_course                 jsonb;
  v_item                   jsonb;
  v_group                  jsonb;
  v_option                 jsonb;

  v_dish_id                uuid;
  v_parent_dish_id         uuid;
  v_variant_id             uuid;
  v_course_id              uuid;
  v_group_id               uuid;

  v_menu_category_id       uuid;
  v_canonical_slug         text;
  v_custom_name            text;
  v_existing_id            uuid;

  -- Working temp table for per-tuple → menu_category_id mapping
  -- (constructed inline below)

  v_dish_kind              text;
  v_is_parent              boolean;
  v_force_price_zero       boolean;
  v_item_sort              integer;
BEGIN
  -- ── (1) Load + lock job; reject if already completed ───────────────────
  SELECT * INTO v_job FROM public.menu_scan_jobs
   WHERE id = p_job_id
   FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'NOT_FOUND' USING ERRCODE = 'P0002';
  END IF;

  v_prev_status := v_job.status;
  IF v_prev_status = 'completed' THEN
    RAISE EXCEPTION 'ALREADY_COMPLETED' USING ERRCODE = 'P0001';
  END IF;

  v_restaurant_id := v_job.restaurant_id;

  -- ── (2) Load restaurant ────────────────────────────────────────────────
  SELECT country_code INTO v_country_code FROM public.restaurants
   WHERE id = v_restaurant_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'RESTAURANT_NOT_FOUND' USING ERRCODE = 'P0002';
  END IF;

  -- ── (3) Source language (caller resolves country→language fallback) ─────
  -- The TS wrapper resolves source_language_code from country if null. We
  -- treat the payload as authoritative; default to 'en' as last resort.
  v_source_language := COALESCE(p_payload->>'source_language_code', 'en');

  -- ── (4) Ensure restaurant has a food menu ──────────────────────────────
  SELECT id INTO v_menu_id FROM public.menus
   WHERE restaurant_id = v_restaurant_id
     AND menu_type = 'food'
   ORDER BY display_order ASC
   LIMIT 1;

  IF v_menu_id IS NULL THEN
    INSERT INTO public.menus (restaurant_id, name, menu_type, display_order, is_active, status)
    VALUES (v_restaurant_id, 'Main Menu', 'food', 0, true, 'draft')
    RETURNING id INTO v_menu_id;
    v_menu_created := true;
  END IF;

  -- ── (5) Validate dish_category_id references exist ────────────────────
  IF EXISTS (
    SELECT 1
      FROM jsonb_array_elements(p_payload->'dishes') d
     WHERE (d->>'dish_category_id') IS NOT NULL
       AND NOT EXISTS (
         SELECT 1 FROM public.dish_categories
          WHERE id = (d->>'dish_category_id')::uuid
       )
  ) THEN
    RAISE EXCEPTION 'INVALID_DISH_CATEGORY_ID' USING ERRCODE = 'P0001';
  END IF;

  -- ── (6) Validate existing-id menu_categories belong to this restaurant ─
  IF EXISTS (
    SELECT 1
      FROM jsonb_array_elements(p_payload->'dishes') d
     WHERE (d->>'category_existing_id') IS NOT NULL
       AND NOT EXISTS (
         SELECT 1 FROM public.menu_categories
          WHERE id = (d->>'category_existing_id')::uuid
            AND restaurant_id = v_restaurant_id
       )
  ) THEN
    RAISE EXCEPTION 'INVALID_CATEGORY_ID' USING ERRCODE = 'P0001';
  END IF;

  -- ── (7) Upsert menu_categories + build per-tuple → id map ──────────────
  -- We use a temp table to hold the mapping. Tuple key shapes mirror TS:
  --   'c:<canonical_slug>'   for canonical-linked
  --   'n:<lower(custom_name)>' for custom-named
  --   'e:<existing_id>'      for admin-selected existing rows
  CREATE TEMP TABLE IF NOT EXISTS _tuple_to_category (
    key text PRIMARY KEY,
    menu_category_id uuid NOT NULL
  ) ON COMMIT DROP;
  TRUNCATE _tuple_to_category;

  -- Build the set of unique tuples needed (canonical + custom only; existing
  -- IDs are validated above and used directly).
  -- For canonical:
  FOR v_canonical_slug IN
    SELECT DISTINCT (d->>'category_canonical_slug') AS slug
      FROM jsonb_array_elements(p_payload->'dishes') d
     WHERE (d->>'category_canonical_slug') IS NOT NULL
  LOOP
    DECLARE
      v_canon_id        uuid;
      v_canon_names     jsonb;
      v_canonical_label text;
      v_verbatim        text;
      v_use_verbatim    boolean;
      v_display_name    text;
      v_desc            text;
    BEGIN
      SELECT id, names INTO v_canon_id, v_canon_names
        FROM public.canonical_menu_categories
       WHERE slug = v_canonical_slug;
      IF NOT FOUND THEN
        -- Slug doesn't exist in canonical taxonomy — skip; dishes referencing
        -- it will fall through to category_custom_name or null below.
        CONTINUE;
      END IF;

      -- Description + verbatim for this canonical slug
      SELECT cd->>'description', cd->>'verbatim_name'
        INTO v_desc, v_verbatim
        FROM jsonb_array_elements(COALESCE(p_payload->'category_descriptions', '[]'::jsonb)) cd
       WHERE cd->>'canonical_slug' = v_canonical_slug
       LIMIT 1;

      v_canonical_label := COALESCE(v_canon_names->>v_source_language, v_canon_names->>'en', v_canonical_slug);
      v_use_verbatim := v_verbatim IS NOT NULL
                    AND v_verbatim <> ''
                    AND lower(v_verbatim) <> lower(v_canonical_label);
      v_display_name := CASE WHEN v_use_verbatim THEN v_verbatim ELSE v_canonical_label END;

      -- Try INSERT first; if conflict, re-SELECT.
      SELECT id INTO v_menu_category_id FROM public.menu_categories
       WHERE restaurant_id = v_restaurant_id
         AND menu_id = v_menu_id
         AND canonical_category_id = v_canon_id
       LIMIT 1;

      IF v_menu_category_id IS NULL THEN
        BEGIN
          INSERT INTO public.menu_categories (
            restaurant_id, menu_id, name, canonical_category_id,
            source_language_code, is_active,
            name_translations,
            description, description_translations
          ) VALUES (
            v_restaurant_id, v_menu_id, v_display_name, v_canon_id,
            v_source_language, true,
            CASE WHEN v_use_verbatim
                 THEN jsonb_build_object(v_source_language, v_verbatim)
                 ELSE '{}'::jsonb END,
            NULLIF(trim(COALESCE(v_desc, '')), ''),
            CASE WHEN COALESCE(trim(v_desc), '') <> ''
                 THEN jsonb_build_object(v_source_language, v_desc)
                 ELSE '{}'::jsonb END
          )
          RETURNING id INTO v_menu_category_id;
          v_categories_created := v_categories_created + 1;
        EXCEPTION WHEN unique_violation THEN
          -- Race: another writer created it concurrently. Re-SELECT.
          SELECT id INTO v_menu_category_id FROM public.menu_categories
           WHERE restaurant_id = v_restaurant_id
             AND menu_id = v_menu_id
             AND canonical_category_id = v_canon_id;
        END;
      ELSE
        -- Existed: fill-if-empty description (never overwrite admin's value)
        IF v_desc IS NOT NULL AND trim(v_desc) <> '' THEN
          UPDATE public.menu_categories
             SET description = v_desc,
                 description_translations = jsonb_build_object(v_source_language, v_desc)
           WHERE id = v_menu_category_id
             AND (description IS NULL OR trim(description) = '');
        END IF;
      END IF;
      v_categories_linked := v_categories_linked + 1;

      INSERT INTO _tuple_to_category (key, menu_category_id)
      VALUES ('c:' || v_canonical_slug, v_menu_category_id)
      ON CONFLICT (key) DO NOTHING;
    END;
  END LOOP;

  -- For custom names:
  FOR v_custom_name IN
    SELECT DISTINCT (d->>'category_custom_name') AS name
      FROM jsonb_array_elements(p_payload->'dishes') d
     WHERE (d->>'category_custom_name') IS NOT NULL
       AND (d->>'category_canonical_slug') IS NULL  -- canonical wins
  LOOP
    DECLARE
      v_desc text;
    BEGIN
      SELECT cd->>'description'
        INTO v_desc
        FROM jsonb_array_elements(COALESCE(p_payload->'category_descriptions', '[]'::jsonb)) cd
       WHERE lower(cd->>'custom_name') = lower(v_custom_name)
         AND cd->>'canonical_slug' IS NULL
       LIMIT 1;

      SELECT id INTO v_menu_category_id FROM public.menu_categories
       WHERE restaurant_id = v_restaurant_id
         AND menu_id = v_menu_id
         AND canonical_category_id IS NULL
         AND lower(name) = lower(v_custom_name)
       LIMIT 1;

      IF v_menu_category_id IS NULL THEN
        BEGIN
          INSERT INTO public.menu_categories (
            restaurant_id, menu_id, name, canonical_category_id,
            source_language_code, name_translations, is_active,
            description, description_translations
          ) VALUES (
            v_restaurant_id, v_menu_id, v_custom_name, NULL,
            v_source_language, jsonb_build_object(v_source_language, v_custom_name), true,
            NULLIF(trim(COALESCE(v_desc, '')), ''),
            CASE WHEN COALESCE(trim(v_desc), '') <> ''
                 THEN jsonb_build_object(v_source_language, v_desc)
                 ELSE '{}'::jsonb END
          )
          RETURNING id INTO v_menu_category_id;
          v_categories_created := v_categories_created + 1;
        EXCEPTION WHEN unique_violation THEN
          SELECT id INTO v_menu_category_id FROM public.menu_categories
           WHERE restaurant_id = v_restaurant_id
             AND menu_id = v_menu_id
             AND canonical_category_id IS NULL
             AND lower(name) = lower(v_custom_name);
        END;
      ELSE
        IF v_desc IS NOT NULL AND trim(v_desc) <> '' THEN
          UPDATE public.menu_categories
             SET description = v_desc,
                 description_translations = jsonb_build_object(v_source_language, v_desc)
           WHERE id = v_menu_category_id
             AND (description IS NULL OR trim(description) = '');
        END IF;
      END IF;

      INSERT INTO _tuple_to_category (key, menu_category_id)
      VALUES ('n:' || lower(v_custom_name), v_menu_category_id)
      ON CONFLICT (key) DO NOTHING;
    END;
  END LOOP;

  -- Fill-if-empty for admin-selected existing_id rows
  FOR v_existing_id IN
    SELECT DISTINCT (d->>'category_existing_id')::uuid AS id
      FROM jsonb_array_elements(p_payload->'dishes') d
     WHERE (d->>'category_existing_id') IS NOT NULL
  LOOP
    DECLARE
      v_desc text;
    BEGIN
      SELECT cd->>'description'
        INTO v_desc
        FROM jsonb_array_elements(COALESCE(p_payload->'category_descriptions', '[]'::jsonb)) cd
       WHERE (cd->>'existing_id')::uuid = v_existing_id
       LIMIT 1;
      IF v_desc IS NOT NULL AND trim(v_desc) <> '' THEN
        UPDATE public.menu_categories
           SET description = v_desc,
               description_translations = jsonb_build_object(v_source_language, v_desc)
         WHERE id = v_existing_id
           AND (description IS NULL OR trim(description) = '');
      END IF;
    END;
  END LOOP;

  -- ── (8) Insert dishes ──────────────────────────────────────────────────
  -- Branches per dish based on payload shape:
  --   * Legacy parent (is_parent=true): insert parent → variants → courses
  --   * New flat (modifier_groups present, is_parent missing/false): insert
  --     dish → option_groups → options
  --   * Standalone (no variants, no modifier_groups): insert dish only
  --
  -- portion_amount / portion_unit (migration 145) are persisted on all three
  -- paths. Only the standalone path is reachable from the current reviewedDishSchema;
  -- legacy parent/variant inserts will pass NULL because v_dish / v_variant
  -- never carry those keys today, but the columns are present for symmetry.

  FOR v_dish IN SELECT * FROM jsonb_array_elements(p_payload->'dishes') LOOP
    -- Resolve menu_category_id from per-dish tuple
    v_menu_category_id := NULL;
    IF (v_dish->>'category_existing_id') IS NOT NULL THEN
      v_menu_category_id := (v_dish->>'category_existing_id')::uuid;
    ELSIF (v_dish->>'category_canonical_slug') IS NOT NULL THEN
      SELECT menu_category_id INTO v_menu_category_id
        FROM _tuple_to_category
       WHERE key = 'c:' || (v_dish->>'category_canonical_slug');
    ELSIF (v_dish->>'category_custom_name') IS NOT NULL THEN
      SELECT menu_category_id INTO v_menu_category_id
        FROM _tuple_to_category
       WHERE key = 'n:' || lower(v_dish->>'category_custom_name');
    END IF;

    v_dish_kind := COALESCE(v_dish->>'dish_kind', 'standard');
    v_is_parent := COALESCE((v_dish->>'is_parent')::boolean, false);

    IF v_is_parent THEN
      -- Legacy parent path
      v_force_price_zero := v_dish_kind IN ('configurable', 'standard');

      INSERT INTO public.dishes (
        restaurant_id, menu_category_id, dish_category_id,
        name, description, price, dish_kind, primary_protein,
        is_parent, parent_dish_id, display_price_prefix,
        serves, is_template, status,
        source_image_index,
        portion_amount, portion_unit
      ) VALUES (
        v_restaurant_id, v_menu_category_id,
        NULLIF(v_dish->>'dish_category_id', '')::uuid,
        v_dish->>'name', v_dish->>'description',
        CASE WHEN v_force_price_zero THEN 0 ELSE COALESCE((v_dish->>'price')::numeric, 0) END,
        v_dish_kind, v_dish->>'primary_protein',
        true, NULL,
        COALESCE(v_dish->>'display_price_prefix', 'exact'),
        COALESCE((v_dish->>'serves')::integer, 1),
        false, 'draft',
        NULLIF(v_dish->>'source_image_index', '')::integer,
        NULLIF(v_dish->>'portion_amount', '')::integer,
        NULLIF(v_dish->>'portion_unit', '')
      )
      RETURNING id INTO v_parent_dish_id;

      v_parents_count := v_parents_count + 1;
      v_inserted_ids := array_append(v_inserted_ids, v_parent_dish_id);

      -- Variants
      FOR v_variant IN SELECT * FROM jsonb_array_elements(COALESCE(v_dish->'variant_dishes', '[]'::jsonb)) LOOP
        INSERT INTO public.dishes (
          restaurant_id, menu_category_id, dish_category_id,
          name, description, price, dish_kind, primary_protein,
          is_parent, parent_dish_id, display_price_prefix,
          serves, is_template, status,
          source_image_index,
          portion_amount, portion_unit
        ) VALUES (
          v_restaurant_id, v_menu_category_id,
          NULLIF(v_variant->>'dish_category_id', '')::uuid,
          v_variant->>'name', v_variant->>'description',
          COALESCE((v_variant->>'price')::numeric, 0),
          COALESCE(v_variant->>'dish_kind', 'standard'),
          v_variant->>'primary_protein',
          false, v_parent_dish_id,
          COALESCE(v_variant->>'display_price_prefix', 'exact'),
          COALESCE((v_variant->>'serves')::integer, 1),
          false, 'draft',
          NULLIF(v_variant->>'source_image_index', '')::integer,
          NULLIF(v_variant->>'portion_amount', '')::integer,
          NULLIF(v_variant->>'portion_unit', '')
        )
        RETURNING id INTO v_variant_id;
        v_variants_count := v_variants_count + 1;
        v_inserted_ids := array_append(v_inserted_ids, v_variant_id);
      END LOOP;

      -- Courses (only for course_menu parents)
      IF v_dish_kind = 'course_menu' THEN
        FOR v_course IN SELECT * FROM jsonb_array_elements(COALESCE(v_dish->'courses', '[]'::jsonb)) LOOP
          INSERT INTO public.dish_courses (
            parent_dish_id, course_number, course_name, choice_type, required_count
          ) VALUES (
            v_parent_dish_id,
            (v_course->>'course_number')::integer,
            v_course->>'course_name',
            v_course->>'choice_type',
            COALESCE((v_course->>'required_count')::integer, 1)
          )
          RETURNING id INTO v_course_id;
          v_courses_count := v_courses_count + 1;

          v_item_sort := 0;
          FOR v_item IN SELECT * FROM jsonb_array_elements(COALESCE(v_course->'items', '[]'::jsonb)) LOOP
            INSERT INTO public.dish_course_items (
              course_id, option_label, price_delta, sort_order
            ) VALUES (
              v_course_id,
              v_item->>'option_label',
              COALESCE((v_item->>'price_delta')::numeric, 0),
              v_item_sort
            );
            v_item_sort := v_item_sort + 1;
            v_course_items_count := v_course_items_count + 1;
          END LOOP;
        END LOOP;
      END IF;

    ELSE
      -- Standalone path (also handles the new modifier_groups shape)
      INSERT INTO public.dishes (
        restaurant_id, menu_category_id, dish_category_id,
        name, description, price, dish_kind, primary_protein,
        is_parent, parent_dish_id, display_price_prefix,
        serves, is_template, status,
        source_image_index,
        dining_format, bundled_items,
        portion_amount, portion_unit
      ) VALUES (
        v_restaurant_id, v_menu_category_id,
        NULLIF(v_dish->>'dish_category_id', '')::uuid,
        v_dish->>'name', v_dish->>'description',
        COALESCE((v_dish->>'price')::numeric, 0),
        v_dish_kind, v_dish->>'primary_protein',
        false, NULL,
        COALESCE(v_dish->>'display_price_prefix', 'exact'),
        COALESCE((v_dish->>'serves')::integer, 1),
        false, 'draft',
        NULLIF(v_dish->>'source_image_index', '')::integer,
        NULLIF(v_dish->>'dining_format', ''),
        CASE WHEN v_dish ? 'bundled_items' AND jsonb_typeof(v_dish->'bundled_items') = 'array'
             THEN v_dish->'bundled_items'
             ELSE NULL END,
        NULLIF(v_dish->>'portion_amount', '')::integer,
        NULLIF(v_dish->>'portion_unit', '')
      )
      RETURNING id INTO v_dish_id;

      v_inserted_ids := array_append(v_inserted_ids, v_dish_id);

      -- Modifier groups (new shape)
      IF v_dish ? 'modifier_groups' AND jsonb_array_length(COALESCE(v_dish->'modifier_groups', '[]'::jsonb)) > 0 THEN
        DECLARE
          v_group_order integer := 0;
          v_opt_order   integer;
        BEGIN
          FOR v_group IN SELECT * FROM jsonb_array_elements(v_dish->'modifier_groups') LOOP
            INSERT INTO public.option_groups (
              restaurant_id, dish_id, name,
              selection_type, min_selections, max_selections,
              display_order, is_active, display_in_card
            ) VALUES (
              v_restaurant_id, v_dish_id, v_group->>'name',
              COALESCE(v_group->>'selection_type', 'single'),
              COALESCE((v_group->>'min_selections')::integer, 0),
              COALESCE((v_group->>'max_selections')::integer, 1),
              v_group_order, true,
              COALESCE((v_group->>'display_in_card')::boolean, false)
            )
            RETURNING id INTO v_group_id;
            v_modifier_groups_count := v_modifier_groups_count + 1;
            v_group_order := v_group_order + 1;

            v_opt_order := 0;
            FOR v_option IN SELECT * FROM jsonb_array_elements(COALESCE(v_group->'options', '[]'::jsonb)) LOOP
              INSERT INTO public.options (
                option_group_id, name, price_delta,
                price_override, primary_protein,
                serves_delta, is_default, display_order, is_available
              ) VALUES (
                v_group_id, v_option->>'name',
                COALESCE((v_option->>'price_delta')::numeric, 0),
                NULLIF(v_option->>'price_override', '')::numeric,
                NULLIF(v_option->>'primary_protein', ''),
                COALESCE((v_option->>'serves_delta')::integer, 0),
                COALESCE((v_option->>'is_default')::boolean, false),
                v_opt_order, true
              );
              v_modifier_options_count := v_modifier_options_count + 1;
              v_opt_order := v_opt_order + 1;
            END LOOP;
          END LOOP;
        END;
      END IF;
    END IF;
  END LOOP;

  -- ── (9) Mark job completed ─────────────────────────────────────────────
  UPDATE public.menu_scan_jobs
     SET status = 'completed',
         saved_dish_ids = to_jsonb(v_inserted_ids),
         saved_at = now(),
         updated_at = now()
   WHERE id = p_job_id;

  -- ── (10) Audit log ─────────────────────────────────────────────────────
  INSERT INTO public.admin_audit_log (
    admin_id, admin_email, action,
    resource_type, resource_id,
    old_data, new_data
  ) VALUES (
    p_admin_id, COALESCE(p_admin_email, ''),
    'confirm_menu_scan',
    'menu_scan_job', p_job_id,
    jsonb_build_object('status', v_prev_status),
    jsonb_build_object(
      'status', 'completed',
      'inserted_count', array_length(v_inserted_ids, 1),
      'parents_count', v_parents_count,
      'variants_count', v_variants_count,
      'courses_count', v_courses_count,
      'course_items_count', v_course_items_count,
      'modifier_groups_count', v_modifier_groups_count,
      'modifier_options_count', v_modifier_options_count,
      'restaurant_id', v_restaurant_id,
      'menu_id', v_menu_id,
      'menu_created', v_menu_created,
      'categories_created', v_categories_created,
      'categories_linked', v_categories_linked,
      'source_language_code', v_source_language
    )
  );

  RETURN jsonb_build_object(
    'inserted_count', array_length(v_inserted_ids, 1),
    'menu_created', v_menu_created,
    'categories_created', v_categories_created,
    'categories_linked', v_categories_linked,
    'parents_count', v_parents_count,
    'variants_count', v_variants_count,
    'courses_count', v_courses_count,
    'course_items_count', v_course_items_count,
    'modifier_groups_count', v_modifier_groups_count,
    'modifier_options_count', v_modifier_options_count
  );
END;
$fn$;

REVOKE EXECUTE ON FUNCTION public.admin_confirm_menu_scan(uuid, uuid, text, jsonb) FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION public.admin_confirm_menu_scan(uuid, uuid, text, jsonb) TO service_role;

COMMENT ON FUNCTION public.admin_confirm_menu_scan(uuid, uuid, text, jsonb) IS
  'Atomically persist a reviewed menu scan. Accepts both legacy '
  '(variant_dishes + courses) and new (modifier_groups) per-dish payload '
  'shapes. Persists portion_amount + portion_unit on all dish inserts. '
  'Dish-level allergens/dietary_tags + option allergen/dietary modifiers '
  'removed (migration 155). SECURITY INVOKER; service-role-only.';


-- ════════════════════════════════════════════════════════════════════════════
-- (4) Drop orphaned allergen/dietary RPCs
-- ════════════════════════════════════════════════════════════════════════════
-- No callers anywhere in the codebase; survive only in stale generated types.
-- calculate_dish_* were fed by the ingredient pipeline retired in migrations
-- 151–153; validate_allergen_codes (migration 093) validated codes against the
-- public.allergens lookup table that migration 156 drops.
DROP FUNCTION IF EXISTS public.calculate_dish_allergens(uuid)    CASCADE;
DROP FUNCTION IF EXISTS public.calculate_dish_dietary_tags(uuid) CASCADE;
DROP FUNCTION IF EXISTS public.validate_allergen_codes(text[])   CASCADE;

COMMIT;
