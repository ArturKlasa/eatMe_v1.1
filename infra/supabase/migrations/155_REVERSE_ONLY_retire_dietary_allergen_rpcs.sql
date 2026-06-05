-- 155_REVERSE_ONLY_retire_dietary_allergen_rpcs.sql
-- Reverse of 155_retire_dietary_allergen_rpcs.sql.
--
-- Restores the migration 150 (generate_candidates), 143 (get_group_candidates),
-- and 146 (admin_confirm_menu_scan) function bodies verbatim — i.e. the
-- allergen/dietary-aware versions. Run 156_REVERSE_ONLY FIRST so the columns
-- these functions reference exist again, otherwise these CREATEs will fail.
--
-- calculate_dish_allergens / calculate_dish_dietary_tags are NOT restored — they
-- have no source in-repo (only stale generated types) and no callers.

BEGIN;

-- ════════════════════════════════════════════════════════════════════════════
-- (1) generate_candidates — restore migration 150 body
-- ════════════════════════════════════════════════════════════════════════════
DROP FUNCTION IF EXISTS generate_candidates(
  FLOAT, FLOAT, FLOAT, vector(1536), UUID[], TEXT, TEXT[],
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


-- ════════════════════════════════════════════════════════════════════════════
-- (2) get_group_candidates — restore migration 143 body
-- ════════════════════════════════════════════════════════════════════════════
DROP FUNCTION IF EXISTS get_group_candidates(
  FLOAT, FLOAT, FLOAT, vector(1536), TEXT, INT
);

CREATE FUNCTION get_group_candidates(
  p_lat            FLOAT,
  p_lng            FLOAT,
  p_radius_m       FLOAT        DEFAULT 10000,
  p_group_vector   vector(1536) DEFAULT NULL,
  p_allergens      TEXT[]       DEFAULT '{}',
  p_diet_tag       TEXT         DEFAULT NULL,
  p_religious_tags TEXT[]       DEFAULT '{}',
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
        AND NOT EXISTS (
          SELECT 1 FROM option_groups g
          WHERE g.dish_id = d.id
            AND g.is_active = true
            AND g.min_selections >= 1
            AND NOT EXISTS (
              SELECT 1 FROM options o
              WHERE o.option_group_id = g.id
                AND o.is_available = true
                AND NOT (o.adds_allergens && COALESCE(p_allergens, '{}'))
                AND NOT (
                  p_diet_tag IS NOT NULL
                  AND p_diet_tag = ANY(o.removes_dietary_tags)
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
-- (3) admin_confirm_menu_scan — restore migration 146 body
-- ════════════════════════════════════════════════════════════════════════════
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
  v_job                    public.menu_scan_jobs%ROWTYPE;
  v_restaurant_id          uuid;
  v_country_code           text;
  v_source_language        text;
  v_prev_status            text;
  v_menu_id                uuid;
  v_menu_created           boolean := false;
  v_categories_created     integer := 0;
  v_categories_linked      integer := 0;
  v_inserted_ids           uuid[]  := ARRAY[]::uuid[];
  v_parents_count          integer := 0;
  v_variants_count         integer := 0;
  v_courses_count          integer := 0;
  v_course_items_count     integer := 0;
  v_modifier_groups_count  integer := 0;
  v_modifier_options_count integer := 0;
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
  v_dish_kind              text;
  v_is_parent              boolean;
  v_force_price_zero       boolean;
  v_item_sort              integer;
BEGIN
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

  SELECT country_code INTO v_country_code FROM public.restaurants
   WHERE id = v_restaurant_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'RESTAURANT_NOT_FOUND' USING ERRCODE = 'P0002';
  END IF;

  v_source_language := COALESCE(p_payload->>'source_language_code', 'en');

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

  CREATE TEMP TABLE IF NOT EXISTS _tuple_to_category (
    key text PRIMARY KEY,
    menu_category_id uuid NOT NULL
  ) ON COMMIT DROP;
  TRUNCATE _tuple_to_category;

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
        CONTINUE;
      END IF;

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
          SELECT id INTO v_menu_category_id FROM public.menu_categories
           WHERE restaurant_id = v_restaurant_id
             AND menu_id = v_menu_id
             AND canonical_category_id = v_canon_id;
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
      v_categories_linked := v_categories_linked + 1;

      INSERT INTO _tuple_to_category (key, menu_category_id)
      VALUES ('c:' || v_canonical_slug, v_menu_category_id)
      ON CONFLICT (key) DO NOTHING;
    END;
  END LOOP;

  FOR v_custom_name IN
    SELECT DISTINCT (d->>'category_custom_name') AS name
      FROM jsonb_array_elements(p_payload->'dishes') d
     WHERE (d->>'category_custom_name') IS NOT NULL
       AND (d->>'category_canonical_slug') IS NULL
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

  FOR v_dish IN SELECT * FROM jsonb_array_elements(p_payload->'dishes') LOOP
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
      v_force_price_zero := v_dish_kind IN ('configurable', 'standard');

      INSERT INTO public.dishes (
        restaurant_id, menu_category_id, dish_category_id,
        name, description, price, dish_kind, primary_protein,
        is_parent, parent_dish_id, display_price_prefix,
        serves, is_template, status,
        allergens, dietary_tags, source_image_index,
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
        ARRAY[]::text[], ARRAY[]::text[],
        NULLIF(v_dish->>'source_image_index', '')::integer,
        NULLIF(v_dish->>'portion_amount', '')::integer,
        NULLIF(v_dish->>'portion_unit', '')
      )
      RETURNING id INTO v_parent_dish_id;

      v_parents_count := v_parents_count + 1;
      v_inserted_ids := array_append(v_inserted_ids, v_parent_dish_id);

      FOR v_variant IN SELECT * FROM jsonb_array_elements(COALESCE(v_dish->'variant_dishes', '[]'::jsonb)) LOOP
        INSERT INTO public.dishes (
          restaurant_id, menu_category_id, dish_category_id,
          name, description, price, dish_kind, primary_protein,
          is_parent, parent_dish_id, display_price_prefix,
          serves, is_template, status,
          allergens, dietary_tags, source_image_index,
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
          ARRAY[]::text[], ARRAY[]::text[],
          NULLIF(v_variant->>'source_image_index', '')::integer,
          NULLIF(v_variant->>'portion_amount', '')::integer,
          NULLIF(v_variant->>'portion_unit', '')
        )
        RETURNING id INTO v_variant_id;
        v_variants_count := v_variants_count + 1;
        v_inserted_ids := array_append(v_inserted_ids, v_variant_id);
      END LOOP;

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
      INSERT INTO public.dishes (
        restaurant_id, menu_category_id, dish_category_id,
        name, description, price, dish_kind, primary_protein,
        is_parent, parent_dish_id, display_price_prefix,
        serves, is_template, status,
        allergens, dietary_tags, source_image_index,
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
        ARRAY[]::text[], ARRAY[]::text[],
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
                removes_dietary_tags, adds_dietary_tags, adds_allergens,
                serves_delta, is_default, display_order, is_available
              ) VALUES (
                v_group_id, v_option->>'name',
                COALESCE((v_option->>'price_delta')::numeric, 0),
                NULLIF(v_option->>'price_override', '')::numeric,
                NULLIF(v_option->>'primary_protein', ''),
                COALESCE(
                  ARRAY(SELECT jsonb_array_elements_text(COALESCE(v_option->'removes_dietary_tags', '[]'::jsonb))),
                  ARRAY[]::text[]
                ),
                COALESCE(
                  ARRAY(SELECT jsonb_array_elements_text(COALESCE(v_option->'adds_dietary_tags', '[]'::jsonb))),
                  ARRAY[]::text[]
                ),
                COALESCE(
                  ARRAY(SELECT jsonb_array_elements_text(COALESCE(v_option->'adds_allergens', '[]'::jsonb))),
                  ARRAY[]::text[]
                ),
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

  UPDATE public.menu_scan_jobs
     SET status = 'completed',
         saved_dish_ids = to_jsonb(v_inserted_ids),
         saved_at = now(),
         updated_at = now()
   WHERE id = p_job_id;

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

COMMIT;
