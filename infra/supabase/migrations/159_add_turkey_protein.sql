-- 159_add_turkey_protein.sql
-- Created: 2026-06-11
--
-- Add 'turkey' to the primary_protein enum (operator issue #11: "Pechuga de
-- Pavo" was being classified as chicken — turkey/pavo is common in Mexican
-- menus and deserves its own value).
--
-- Turkey is poultry, so it derives the same protein families as chicken:
-- {meat, poultry}. Mobile keeps surfacing it under the "Other" daily meat
-- toggle for now (product decision 2026-06-11: backend stores turkey, the
-- dedicated mobile toggle can be added later — the feed's 'other' fallback
-- already matches any meat whose canonical name isn't chicken/beef/pork/
-- lamb/goat).
--
-- Follows migration 131's playbook (duck→goat) — CHECK-constraint swap on
-- dishes + user_preferences — plus the turkey arms in the two candidate RPCs
-- from migration 155 (option-level vegetarian NOT IN lists + the
-- reachable-protein-families CASE).
--
-- ALSO (discovered 2026-06-11 while scoping this change): NOTHING populates
-- dishes.protein_families / protein_canonical_names anymore. The columns were
-- fed by the retired ingredient pipeline (Phase A, 2026-05-17), and of the
-- writers that remain only the owner web-portal derives them app-side
-- (deriveProteinFields); the admin scan-confirm RPC — the source of nearly
-- all dishes — never set them. At migration time 7,104 of 7,382 dishes had
-- primary_protein set but protein_families = '{}', which let meat dishes pass
-- generate_candidates' dish-level vegetarian check
-- (NOT (protein_families && ARRAY['meat',...]) is true for empty arrays).
-- Sections 5–6 fix this for good: a trigger (compute_dish_protein_families —
-- the function long assumed to exist; verified absent in prod 2026-06-11)
-- plus a one-time backfill.
--
-- No turkey data rewrite: no existing rows carry 'turkey' (it was not a legal
-- value until now). Existing turkey dishes misclassified as chicken keep their
-- value until re-scanned or edited.

BEGIN;

-- ── 1. dishes: swap CHECK constraint ─────────────────────────────────────────

ALTER TABLE public.dishes
  DROP CONSTRAINT IF EXISTS dishes_primary_protein_check;

ALTER TABLE public.dishes
  ADD CONSTRAINT dishes_primary_protein_check
  CHECK (
    primary_protein IS NULL OR primary_protein IN (
      'chicken', 'turkey', 'beef', 'pork', 'lamb', 'goat', 'other_meat',
      'fish', 'shellfish', 'eggs',
      'vegetarian', 'vegan'
    )
  );

-- ── 2. user_preferences: swap CHECK constraint ───────────────────────────────

ALTER TABLE public.user_preferences
  DROP CONSTRAINT IF EXISTS user_preferences_primary_protein_check;

ALTER TABLE public.user_preferences
  ADD CONSTRAINT user_preferences_primary_protein_check
  CHECK (
    primary_protein IS NULL OR primary_protein IN (
      'chicken', 'turkey', 'beef', 'pork', 'lamb', 'goat', 'other_meat',
      'fish', 'shellfish', 'eggs',
      'vegetarian', 'vegan'
    )
  );

-- ── 3. generate_candidates: turkey in vegetarian exclusion + family CASE ─────
-- Full body copied from migration 155 with two edits:
--   * option-level vegetarian check: 'turkey' added to the NOT IN list
--   * reachable-protein-families CASE: chicken arm widened to (chicken, turkey)

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

-- ── 4. get_group_candidates: turkey in vegetarian exclusion ──────────────────
-- Full body copied from migration 155 with one edit: option-level vegetarian
-- check adds 'turkey' to the NOT IN list. (The dish-level vegetarian check is
-- protein_families-based, so it picks turkey up automatically via section 5.)

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

-- ── 5. compute_dish_protein_families: derive families on every dish write ────
-- Trigger-level mirror of packages/shared/src/logic/protein.ts
-- deriveProteinFields() — keep the two in lockstep. The trigger is the single
-- source of truth: it overwrites whatever the application sends for
-- protein_families / protein_canonical_names whenever primary_protein is
-- written (the web-portal sends the same derived values, so this is a no-op
-- there; the admin RPCs send nothing, which is exactly the gap being fixed).
-- Fires only on INSERT or UPDATE OF primary_protein, so the 179 legacy rows
-- with pipeline-era fine-grained canonical names (ham, beef_jerky, …) keep
-- them until their protein is actually edited.

CREATE OR REPLACE FUNCTION public.compute_dish_protein_families()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  CASE NEW.primary_protein
    WHEN 'chicken' THEN
      NEW.protein_families        := ARRAY['meat', 'poultry'];
      NEW.protein_canonical_names := ARRAY[NEW.primary_protein];
    WHEN 'turkey' THEN
      NEW.protein_families        := ARRAY['meat', 'poultry'];
      NEW.protein_canonical_names := ARRAY[NEW.primary_protein];
    WHEN 'beef', 'pork', 'lamb', 'goat', 'other_meat' THEN
      NEW.protein_families        := ARRAY['meat'];
      NEW.protein_canonical_names := ARRAY[NEW.primary_protein];
    WHEN 'fish' THEN
      NEW.protein_families        := ARRAY['fish'];
      NEW.protein_canonical_names := ARRAY[NEW.primary_protein];
    WHEN 'shellfish' THEN
      NEW.protein_families        := ARRAY['shellfish'];
      NEW.protein_canonical_names := ARRAY[NEW.primary_protein];
    WHEN 'eggs' THEN
      NEW.protein_families        := ARRAY['eggs'];
      NEW.protein_canonical_names := ARRAY[NEW.primary_protein];
    ELSE
      -- vegetarian / vegan / NULL
      NEW.protein_families        := ARRAY[]::text[];
      NEW.protein_canonical_names := ARRAY[]::text[];
  END CASE;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_compute_dish_protein_families ON public.dishes;

CREATE TRIGGER trg_compute_dish_protein_families
  BEFORE INSERT OR UPDATE OF primary_protein ON public.dishes
  FOR EACH ROW
  EXECUTE FUNCTION public.compute_dish_protein_families();

-- ── 6. Backfill the rows the missing trigger left empty ──────────────────────
-- Only rows that are visibly un-derived (both arrays empty) are touched, so
-- legacy pipeline-era enrichments are preserved. vegetarian/vegan/NULL rows
-- derive to empty arrays anyway — excluded to keep the UPDATE minimal.

UPDATE public.dishes
SET
  protein_families = CASE
    WHEN primary_protein IN ('chicken', 'turkey')                          THEN ARRAY['meat', 'poultry']
    WHEN primary_protein IN ('beef', 'pork', 'lamb', 'goat', 'other_meat') THEN ARRAY['meat']
    WHEN primary_protein = 'fish'                                          THEN ARRAY['fish']
    WHEN primary_protein = 'shellfish'                                     THEN ARRAY['shellfish']
    WHEN primary_protein = 'eggs'                                          THEN ARRAY['eggs']
  END,
  protein_canonical_names = ARRAY[primary_protein]
WHERE primary_protein IN (
        'chicken', 'turkey', 'beef', 'pork', 'lamb', 'goat', 'other_meat',
        'fish', 'shellfish', 'eggs'
      )
  AND COALESCE(protein_families, '{}')        = '{}'
  AND COALESCE(protein_canonical_names, '{}') = '{}';

COMMIT;
