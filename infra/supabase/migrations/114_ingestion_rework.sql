-- 114_ingestion_rework.sql
-- Created: 2026-04-22
--
-- Implements the dish ingestion & menu-scan review rework (Step 1 of plan):
--
-- 1. Adds new columns to dishes: status, is_template, source_image_index, source_region
-- 2. Relaxes dish_kind CHECK to accept old + new values (transitional window)
-- 3. Auto-renames data: combo→bundle, template→configurable (+ is_template=true)
-- 4. Fixes dish_ingredients FK to cascade on dish delete
-- 5. Creates dish_courses + dish_course_items tables with indexes and RLS
-- 6. Extends menu_scan_jobs with saved_dish_ids + saved_at for soft-undo
-- 7. Updates generate_candidates() to exclude template dishes (is_template=false)
--
-- NOTE: This migration is additive. The CHECK constraint on dish_kind is RELAXED
-- here to accept both old ('template','experience','combo') and new values.
-- Migration 115 (operationally gated) will tighten it once admin triage completes.

BEGIN;

-- ── 1. dishes: add new columns ────────────────────────────────────────────────

ALTER TABLE public.dishes
  ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'published'
    CHECK (status IN ('published', 'draft', 'archived')),
  ADD COLUMN IF NOT EXISTS is_template boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS source_image_index int,
  ADD COLUMN IF NOT EXISTS source_region jsonb;

COMMENT ON COLUMN public.dishes.status IS
  'Publishing state of the dish. Defaults to published for all existing rows.';
COMMENT ON COLUMN public.dishes.is_template IS
  'True for reusable template shells: excluded from the consumer feed and cloneable by admins.';
COMMENT ON COLUMN public.dishes.source_image_index IS
  '0-based index of the source menu image this dish was extracted from during menu scanning.';
COMMENT ON COLUMN public.dishes.source_region IS
  'Reserved for future region-level source-image linkage. Not wired this cycle.';

-- ── 2. Relax dish_kind CHECK to accept both old and new values ────────────────
--
-- Old values: standard, template, experience, combo
-- New values: standard, bundle, configurable, course_menu, buffet
-- Transitional union: all 8 values accepted during Steps 1–6.
-- Migration 115 will tighten to 5 new values after admin triage is complete.

ALTER TABLE public.dishes DROP CONSTRAINT IF EXISTS dishes_dish_kind_check;
ALTER TABLE public.dishes ADD CONSTRAINT dishes_dish_kind_check
  CHECK (dish_kind IN (
    'standard', 'template', 'experience', 'combo',
    'bundle', 'configurable', 'course_menu', 'buffet'
  ));

-- ── 3. Auto-rename existing data ──────────────────────────────────────────────
--
-- combo → bundle (direct rename, no semantic change)
-- template → configurable + is_template=true (template was a reusable shell concept)
-- experience rows are left as-is; admin triage screen (Step 5) handles them.

UPDATE public.dishes SET dish_kind = 'bundle' WHERE dish_kind = 'combo';
UPDATE public.dishes
  SET dish_kind = 'configurable', is_template = true
  WHERE dish_kind = 'template';

-- ── 4. Fix dish_ingredients FK: add ON DELETE CASCADE ────────────────────────
--
-- The existing FK has no cascade; deleting a dish leaves orphaned ingredient rows.
-- The undo endpoint (Step 4) deletes dishes and expects ingredient rows to follow.

ALTER TABLE public.dish_ingredients
  DROP CONSTRAINT IF EXISTS dish_ingredients_dish_id_fkey;

ALTER TABLE public.dish_ingredients
  ADD CONSTRAINT dish_ingredients_dish_id_fkey
    FOREIGN KEY (dish_id) REFERENCES public.dishes(id) ON DELETE CASCADE;

-- ── 5. New tables: dish_courses + dish_course_items ──────────────────────────

CREATE TABLE IF NOT EXISTS public.dish_courses (
  id             uuid    PRIMARY KEY DEFAULT gen_random_uuid(),
  parent_dish_id uuid    NOT NULL REFERENCES public.dishes(id) ON DELETE CASCADE,
  course_number  int     NOT NULL CHECK (course_number >= 1),
  course_name    text,
  required_count int     NOT NULL DEFAULT 1,
  choice_type    text    NOT NULL CHECK (choice_type IN ('fixed', 'one_of')),
  created_at     timestamptz DEFAULT now(),
  UNIQUE (parent_dish_id, course_number)
);

COMMENT ON TABLE public.dish_courses IS
  'Ordered courses within a course_menu dish. Each course groups one or more selectable items.';

CREATE TABLE IF NOT EXISTS public.dish_course_items (
  id                uuid    PRIMARY KEY DEFAULT gen_random_uuid(),
  course_id         uuid    NOT NULL REFERENCES public.dish_courses(id) ON DELETE CASCADE,
  option_label      text    NOT NULL,
  price_delta       numeric NOT NULL DEFAULT 0,
  links_to_dish_id  uuid    REFERENCES public.dishes(id) ON DELETE SET NULL,
  sort_order        int     NOT NULL DEFAULT 0,
  created_at        timestamptz DEFAULT now()
);

COMMENT ON TABLE public.dish_course_items IS
  'Items within a dish_course. For fixed courses there is one item; for one_of courses there are multiple.';

CREATE INDEX IF NOT EXISTS idx_dish_courses_parent
  ON public.dish_courses (parent_dish_id, course_number);

CREATE INDEX IF NOT EXISTS idx_dish_course_items_course
  ON public.dish_course_items (course_id, sort_order);

-- RLS: dish_courses ────────────────────────────────────────────────────────────

ALTER TABLE public.dish_courses ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Public read dish_courses" ON public.dish_courses;
CREATE POLICY "Public read dish_courses"
  ON public.dish_courses FOR SELECT USING (true);

DROP POLICY IF EXISTS "Owners can write own dish_courses" ON public.dish_courses;
CREATE POLICY "Owners can write own dish_courses"
  ON public.dish_courses FOR ALL TO authenticated
  USING (
    public.is_admin() OR EXISTS (
      SELECT 1 FROM public.dishes d
      JOIN public.restaurants r ON r.id = d.restaurant_id
      WHERE d.id = dish_courses.parent_dish_id AND r.owner_id = auth.uid()
    )
  )
  WITH CHECK (
    public.is_admin() OR EXISTS (
      SELECT 1 FROM public.dishes d
      JOIN public.restaurants r ON r.id = d.restaurant_id
      WHERE d.id = dish_courses.parent_dish_id AND r.owner_id = auth.uid()
    )
  );

-- RLS: dish_course_items ───────────────────────────────────────────────────────

ALTER TABLE public.dish_course_items ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Public read dish_course_items" ON public.dish_course_items;
CREATE POLICY "Public read dish_course_items"
  ON public.dish_course_items FOR SELECT USING (true);

DROP POLICY IF EXISTS "Owners can write own dish_course_items" ON public.dish_course_items;
CREATE POLICY "Owners can write own dish_course_items"
  ON public.dish_course_items FOR ALL TO authenticated
  USING (
    public.is_admin() OR EXISTS (
      SELECT 1 FROM public.dish_courses dc
      JOIN public.dishes d ON d.id = dc.parent_dish_id
      JOIN public.restaurants r ON r.id = d.restaurant_id
      WHERE dc.id = dish_course_items.course_id AND r.owner_id = auth.uid()
    )
  )
  WITH CHECK (
    public.is_admin() OR EXISTS (
      SELECT 1 FROM public.dish_courses dc
      JOIN public.dishes d ON d.id = dc.parent_dish_id
      JOIN public.restaurants r ON r.id = d.restaurant_id
      WHERE dc.id = dish_course_items.course_id AND r.owner_id = auth.uid()
    )
  );

-- ── 6. menu_scan_jobs: add soft-undo columns ──────────────────────────────────

ALTER TABLE public.menu_scan_jobs
  ADD COLUMN IF NOT EXISTS saved_dish_ids jsonb,
  ADD COLUMN IF NOT EXISTS saved_at       timestamptz;

COMMENT ON COLUMN public.menu_scan_jobs.saved_dish_ids IS
  'JSONB array of dish UUIDs saved in the most recent confirm action. Used for 15-minute soft-undo.';
COMMENT ON COLUMN public.menu_scan_jobs.saved_at IS
  'Timestamp of the most recent confirm action. Soft-undo is blocked after 15 minutes from this time.';

-- ── 7. generate_candidates(): exclude template dishes ────────────────────────
--
-- Added filter: AND d.is_template = false
-- All other logic copied verbatim from migration 111 (latest baseline).
-- DROP required because we cannot ALTER a function body without CREATE OR REPLACE,
-- and the convention in this project is DROP + CREATE for clarity.

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
  integer,            -- p_limit
  time,               -- p_current_time
  text,               -- p_current_day
  text,               -- p_schedule_type
  boolean             -- p_group_meals
);

CREATE OR REPLACE FUNCTION generate_candidates(
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
  parent_dish_id           UUID,
  serves                   INTEGER,
  price_per_person         NUMERIC,
  primary_protein          TEXT
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
    d.price_per_person,

    d.primary_protein

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

    -- Exclude parent display-only dishes from feed
    AND d.is_parent = false

    -- Exclude template dishes from feed (added in migration 114)
    AND d.is_template = false

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

    -- Schedule type filter
    AND (
      p_schedule_type IS NULL
      OR m.id IS NULL
      OR m.schedule_type = p_schedule_type
    )

    -- Group/family meals filter
    AND (
      NOT p_group_meals
      OR d.serves >= 2
    )

    -- Time-based menu availability filter
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

    -- Day-of-week availability filter
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

COMMIT;
