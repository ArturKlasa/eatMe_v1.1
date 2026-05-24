-- 146_admin_confirm_menu_scan_portion_size.sql
-- Created: 2026-05-24
--
-- CREATE OR REPLACE the admin_confirm_menu_scan RPC to persist the new
-- portion_amount + portion_unit columns (added in migration 145).
--
-- Body is verbatim copy of 144_admin_menu_scan_and_modifier_rpcs.sql's
-- admin_confirm_menu_scan function, with two columns added to each of
-- the three `INSERT INTO public.dishes` statements:
--
--   * legacy parent path (was line 397 in 144)
--   * legacy variant path (was line 423 in 144)
--   * standalone path    (was line 481 in 144) — the only one reachable
--     from the current reviewedDishSchema; the other two persist NULL
--     because v_dish / v_variant won't carry the keys.
--
-- NEXT REVISION: when this RPC needs another change, base it on THIS
-- file, not migration 144.
--
-- Reverse: 146_REVERSE_ONLY_admin_confirm_menu_scan_portion_size.sql
-- restores the 144 body.

BEGIN;

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

      -- Variants
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
  'Phase 4.2 — atomically persist a reviewed menu scan. Accepts both legacy '
  '(variant_dishes + courses) and new (modifier_groups) per-dish payload '
  'shapes. Persists portion_amount + portion_unit on all dish inserts '
  '(migration 146). SECURITY INVOKER; service-role-only.';

COMMIT;
