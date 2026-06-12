-- 163_phase7_coordinated_drop.sql
-- Created: 2026-06-12
--
-- Dish-model rewrite Phase 7 — the coordinated destructive cutover.
-- Drops dishes.dish_kind / parent_dish_id / is_parent / is_template /
-- price_per_person and tables dish_courses + dish_course_items, atomically
-- with every live DB reader rewritten in the same transaction:
--
--   * generate_candidates        (body from 159; DROP+CREATE — signature change)
--   * get_group_candidates       (body from 159; filter cut)
--   * admin_confirm_menu_scan    (body from 155; legacy parent/variant/course
--                                 branch deleted; flat shape only)
--   * admin_copy_restaurant_menu (body from 160; legacy columns + course guard cut)
--   * _cron_embed_recovery_tick  (body from 133; filter cut)
--   * confirm_menu_scan          (121, legacy web-portal scan RPC) — DROPPED,
--                                 sole caller is apps/web-portal-v2 (on ice)
--
-- Partial indexes idx_dishes_parent_dish_id / idx_dishes_is_parent (073) and
-- CHECK dishes_dish_kind_check (115) drop automatically with their columns;
-- dish_courses/dish_course_items RLS policies + indexes drop with the tables.
--
-- ⚠ App code must already be on commit e34db9f+ (Commit A: no app reads or
-- writes these columns) and edge functions feed + enrich-dish redeployed.
-- apps/web-portal (legacy v1 owner portal, being retired) still writes
-- dish_kind from its dish form — its dish create/edit breaks after this
-- migration. Accepted per docs/project/dish-model-rewrite-plan.md (out of scope).
--
-- ⚠ Reverse is schema-only (163_REVERSE_ONLY): column data is unrecoverable,
-- but nothing meaningful is lost — migration 158 already converted all
-- parent/variant data to modifier groups (verified + triaged 2026-06-11).
--
-- Plan: docs/plans/dish-model-rewrite-phase-7-cleanup.md

BEGIN;

-- ── (0) Pre-flight guards — abort if any legacy data still exists ─────────────

DO $guard$
DECLARE
  v_cnt bigint;
BEGIN
  SELECT count(*) INTO v_cnt FROM public.dishes WHERE is_parent = true;
  IF v_cnt > 0 THEN
    RAISE EXCEPTION 'PHASE7_GUARD: % dishes still have is_parent=true — run/finish migration 158 first', v_cnt;
  END IF;

  SELECT count(*) INTO v_cnt FROM public.dishes WHERE parent_dish_id IS NOT NULL;
  IF v_cnt > 0 THEN
    RAISE EXCEPTION 'PHASE7_GUARD: % variant children (parent_dish_id NOT NULL) remain', v_cnt;
  END IF;

  SELECT count(*) INTO v_cnt FROM public.dishes WHERE is_template = true;
  IF v_cnt > 0 THEN
    RAISE EXCEPTION 'PHASE7_GUARD: % template dishes remain', v_cnt;
  END IF;

  SELECT count(*) INTO v_cnt FROM public.dish_courses;
  IF v_cnt > 0 THEN
    RAISE EXCEPTION 'PHASE7_GUARD: dish_courses is not empty (%)', v_cnt;
  END IF;

  SELECT count(*) INTO v_cnt FROM public.dish_course_items;
  IF v_cnt > 0 THEN
    RAISE EXCEPTION 'PHASE7_GUARD: dish_course_items is not empty (%)', v_cnt;
  END IF;
END;
$guard$;

-- ══════════════════════════════════════════════════════════════════════════════
-- (1) generate_candidates — body verbatim from migration 159 §3 minus:
--     dish_kind / parent_dish_id / price_per_person (RETURN TABLE + SELECT)
--     and the is_parent/is_template filters. Signature (RETURNS TABLE) changes,
--     so DROP + CREATE.
-- ══════════════════════════════════════════════════════════════════════════════

DROP FUNCTION IF EXISTS generate_candidates(
  FLOAT, FLOAT, FLOAT, vector, UUID[], TEXT, TEXT[], BOOLEAN, INT, TIME, TEXT, TEXT, BOOLEAN
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
                     ('chicken','turkey','beef','pork','lamb','goat','other_meat','fish','shellfish')
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

-- ══════════════════════════════════════════════════════════════════════════════
-- (2) get_group_candidates — body verbatim from migration 159 §4 minus the
--     is_parent/is_template filters in the EXISTS subquery.
-- ══════════════════════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION get_group_candidates(
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
                         ('chicken','turkey','beef','pork','lamb','goat','other_meat','fish','shellfish')
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

-- ══════════════════════════════════════════════════════════════════════════════
-- (3) admin_confirm_menu_scan — body verbatim from migration 155 §3 minus the
--     legacy parent/variant/course branch. Flat payload shape only; legacy
--     payload keys are ignored.
-- ══════════════════════════════════════════════════════════════════════════════

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
  v_modifier_groups_count  integer := 0;
  v_modifier_options_count integer := 0;

  -- Iteration vars
  v_dish                   jsonb;
  v_group                  jsonb;
  v_option                 jsonb;

  v_dish_id                uuid;
  v_group_id               uuid;

  v_menu_category_id       uuid;
  v_canonical_slug         text;
  v_custom_name            text;
  v_existing_id            uuid;

  -- Working temp table for per-tuple → menu_category_id mapping
  -- (constructed inline below)
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
  -- One flat shape: dish → option_groups → options. Legacy parent/variant/
  -- course payload keys (is_parent, dish_kind, variant_dishes, courses) are
  -- ignored if present — the columns/tables were dropped by migration 163.

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

    INSERT INTO public.dishes (
      restaurant_id, menu_category_id, dish_category_id,
      name, description, price, primary_protein,
      display_price_prefix, serves, status,
      source_image_index,
      dining_format, bundled_items,
      portion_amount, portion_unit
    ) VALUES (
      v_restaurant_id, v_menu_category_id,
      NULLIF(v_dish->>'dish_category_id', '')::uuid,
      v_dish->>'name', v_dish->>'description',
      COALESCE((v_dish->>'price')::numeric, 0),
      v_dish->>'primary_protein',
      COALESCE(v_dish->>'display_price_prefix', 'exact'),
      COALESCE((v_dish->>'serves')::integer, 1),
      'draft',
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
    'modifier_groups_count', v_modifier_groups_count,
    'modifier_options_count', v_modifier_options_count
  );
END;
$fn$;

REVOKE EXECUTE ON FUNCTION public.admin_confirm_menu_scan(uuid, uuid, text, jsonb) FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION public.admin_confirm_menu_scan(uuid, uuid, text, jsonb) TO service_role;

COMMENT ON FUNCTION public.admin_confirm_menu_scan(uuid, uuid, text, jsonb) IS
  'Atomically persist a reviewed menu scan. Flat per-dish payloads only — '
  'dish -> option_groups -> options (+ dining_format / bundled_items / '
  'portions). Legacy parent/variant/course payload keys are ignored '
  '(migration 163 dropped the columns/tables). '
  'SECURITY INVOKER; service-role-only.';

-- ══════════════════════════════════════════════════════════════════════════════
-- (4) admin_copy_restaurant_menu — body verbatim from migration 160 minus the
--     legacy dish columns and the dish_courses guard.
-- ══════════════════════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION public.admin_copy_restaurant_menu(
  p_source_restaurant_id uuid,
  p_target_restaurant_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public, extensions
AS $fn$
DECLARE
  v_menus          int;
  v_categories     int;
  v_dishes         int;
  v_option_groups  int;
  v_options        int;
BEGIN
  IF p_source_restaurant_id = p_target_restaurant_id THEN
    RAISE EXCEPTION 'SOURCE_IS_TARGET';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM restaurants WHERE id = p_source_restaurant_id) THEN
    RAISE EXCEPTION 'SOURCE_NOT_FOUND';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM restaurants WHERE id = p_target_restaurant_id) THEN
    RAISE EXCEPTION 'TARGET_NOT_FOUND';
  END IF;
  -- One-time copy: a target that already has menus was either copied into or
  -- built by hand — refuse rather than duplicate.
  IF EXISTS (SELECT 1 FROM menus WHERE restaurant_id = p_target_restaurant_id) THEN
    RAISE EXCEPTION 'TARGET_HAS_MENUS';
  END IF;
  -- ── id maps ────────────────────────────────────────────────────────────────

  CREATE TEMP TABLE _menu_map ON COMMIT DROP AS
    SELECT id AS old_id, gen_random_uuid() AS new_id
    FROM menus WHERE restaurant_id = p_source_restaurant_id;

  CREATE TEMP TABLE _cat_map ON COMMIT DROP AS
    SELECT id AS old_id, gen_random_uuid() AS new_id
    FROM menu_categories WHERE restaurant_id = p_source_restaurant_id;

  CREATE TEMP TABLE _dish_map ON COMMIT DROP AS
    SELECT id AS old_id, gen_random_uuid() AS new_id
    FROM dishes WHERE restaurant_id = p_source_restaurant_id;

  CREATE TEMP TABLE _group_map ON COMMIT DROP AS
    SELECT g.id AS old_id, gen_random_uuid() AS new_id
    FROM option_groups g WHERE g.restaurant_id = p_source_restaurant_id;

  -- ── menus ──────────────────────────────────────────────────────────────────

  INSERT INTO menus (
    id, restaurant_id, name, description, display_order, is_active,
    available_start_time, available_end_time, available_days,
    menu_type, schedule_type, status
  )
  SELECT
    m.new_id, p_target_restaurant_id, src.name, src.description,
    src.display_order, src.is_active,
    src.available_start_time, src.available_end_time, src.available_days,
    src.menu_type, src.schedule_type, 'draft'
  FROM menus src
  JOIN _menu_map m ON m.old_id = src.id;
  GET DIAGNOSTICS v_menus = ROW_COUNT;

  -- ── menu_categories ────────────────────────────────────────────────────────

  INSERT INTO menu_categories (
    id, restaurant_id, name, description, type, display_order, is_active,
    menu_id, canonical_category_id, source_language_code,
    name_translations, description_translations
  )
  SELECT
    c.new_id, p_target_restaurant_id, src.name, src.description, src.type,
    src.display_order, src.is_active,
    mm.new_id, src.canonical_category_id, src.source_language_code,
    src.name_translations, src.description_translations
  FROM menu_categories src
  JOIN _cat_map c ON c.old_id = src.id
  LEFT JOIN _menu_map mm ON mm.old_id = src.menu_id;
  GET DIAGNOSTICS v_categories = ROW_COUNT;

  -- ── dishes ─────────────────────────────────────────────────────────────────
  -- protein_families / protein_canonical_names omitted on purpose: the
  -- compute_dish_protein_families trigger derives them on insert.

  INSERT INTO dishes (
    id, restaurant_id, menu_category_id, name, description, price,
    calories, spice_level, image_url, is_available, dish_category_id,
    description_visibility, ingredients_visibility,
    display_price_prefix, enrichment_status, embedding,
    serves, primary_protein,
    status, source_image_index, source_region, dining_format,
    bundled_items, available_days, available_hours_start, available_hours_end,
    available_from, available_until, portion_amount, portion_unit
  )
  SELECT
    d.new_id, p_target_restaurant_id, cm.new_id, src.name, src.description,
    src.price, src.calories, src.spice_level, src.image_url, src.is_available,
    src.dish_category_id, src.description_visibility, src.ingredients_visibility,
    src.display_price_prefix, src.enrichment_status, src.embedding,
    src.serves,
    src.primary_protein, 'draft', src.source_image_index,
    src.source_region, src.dining_format, src.bundled_items, src.available_days,
    src.available_hours_start, src.available_hours_end, src.available_from,
    src.available_until, src.portion_amount, src.portion_unit
  FROM dishes src
  JOIN _dish_map d ON d.old_id = src.id
  LEFT JOIN _cat_map  cm ON cm.old_id = src.menu_category_id;
  GET DIAGNOSTICS v_dishes = ROW_COUNT;

  -- ── option_groups ──────────────────────────────────────────────────────────

  INSERT INTO option_groups (
    id, restaurant_id, dish_id, name, description, selection_type,
    min_selections, max_selections, display_order, is_active, display_in_card
  )
  SELECT
    g.new_id, p_target_restaurant_id, dm.new_id, src.name, src.description,
    src.selection_type, src.min_selections, src.max_selections,
    src.display_order, src.is_active, src.display_in_card
  FROM option_groups src
  JOIN _group_map g ON g.old_id = src.id
  JOIN _dish_map dm ON dm.old_id = src.dish_id;
  GET DIAGNOSTICS v_option_groups = ROW_COUNT;

  -- ── options ────────────────────────────────────────────────────────────────

  INSERT INTO options (
    option_group_id, name, description, price_delta, calories_delta,
    is_available, display_order, price_override, primary_protein,
    serves_delta, is_default
  )
  SELECT
    gm.new_id, src.name, src.description, src.price_delta, src.calories_delta,
    src.is_available, src.display_order, src.price_override,
    src.primary_protein, src.serves_delta, src.is_default
  FROM options src
  JOIN _group_map gm ON gm.old_id = src.option_group_id;
  GET DIAGNOSTICS v_options = ROW_COUNT;

  RETURN jsonb_build_object(
    'menus_copied',         v_menus,
    'categories_copied',    v_categories,
    'dishes_copied',        v_dishes,
    'option_groups_copied', v_option_groups,
    'options_copied',       v_options
  );
END;
$fn$;

-- ══════════════════════════════════════════════════════════════════════════════
-- (5) _cron_embed_recovery_tick — body verbatim from migration 133 minus the
--     is_parent/is_template filters.
-- ══════════════════════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION public._cron_embed_recovery_tick()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $function$
DECLARE
  v_key      TEXT;
  v_url      TEXT := 'https://tqroqqvxabolydyznewa.supabase.co/functions/v1/enrich-dish';
  v_dish_id  UUID;
  v_count    INT := 0;
BEGIN
  SELECT decrypted_secret INTO v_key
  FROM vault.decrypted_secrets
  WHERE name = 'enrich_dish_service_key';

  IF v_key IS NULL THEN
    RAISE WARNING 'enrich_dish_service_key not in vault; recovery tick skipped';
    RETURN;
  END IF;

  FOR v_dish_id IN
    SELECT id FROM public.dishes
    WHERE enrichment_status IN ('pending', 'failed')
      AND embedding IS NULL
      AND updated_at < now() - interval '1 minute'
    ORDER BY updated_at ASC
    LIMIT 100
  LOOP
    PERFORM net.http_post(
      url     := v_url,
      body    := jsonb_build_object('dish_id', v_dish_id),
      headers := jsonb_build_object(
                   'Content-Type',  'application/json',
                   'Authorization', 'Bearer ' || v_key
                 )
    );
    v_count := v_count + 1;
  END LOOP;

  IF v_count > 0 THEN
    RAISE NOTICE 'embed-recovery-tick: enqueued % dishes', v_count;
  END IF;
END;
$function$;

-- ══════════════════════════════════════════════════════════════════════════════
-- (6) Drop the legacy web-portal scan RPC (121). Sole caller is
--     apps/web-portal-v2 (on ice); it inserts dish_kind/is_template and cannot
--     survive the column drop.
-- ══════════════════════════════════════════════════════════════════════════════

DROP FUNCTION IF EXISTS public.confirm_menu_scan(uuid, jsonb, text);

-- ══════════════════════════════════════════════════════════════════════════════
-- (7) The drops
-- ══════════════════════════════════════════════════════════════════════════════

DROP TABLE IF EXISTS public.dish_course_items;
DROP TABLE IF EXISTS public.dish_courses;

ALTER TABLE public.dishes
  DROP COLUMN IF EXISTS dish_kind,
  DROP COLUMN IF EXISTS parent_dish_id,
  DROP COLUMN IF EXISTS is_parent,
  DROP COLUMN IF EXISTS is_template,
  DROP COLUMN IF EXISTS price_per_person;

COMMIT;
