-- 160_admin_copy_restaurant_menu.sql
-- Created: 2026-06-11
--
-- One-time menu copy between restaurants (operator issue #16: multi-branch
-- restaurants share one menu; no branch/chain concept exists in the schema, so
-- the pragmatic fix — confirmed by user 2026-06-09 — is a deep copy at branch
-- setup time; later edits are per-branch).
--
-- admin_copy_restaurant_menu(source, target) clones, in one transaction:
--   menus → menu_categories → dishes → option_groups → options
-- Everything lands as DRAFT (menus + dishes) so the admin reviews + publishes
-- via the normal flow. The target keeps its own location/hours/currency.
--
-- Mapping strategy: per-table temp tables pre-generate new UUIDs
-- (old_id → new_id), so FK remapping (menu_id, menu_category_id,
-- parent_dish_id, dish_id, option_group_id) is set-based — same pattern as
-- admin_confirm_menu_scan's _tuple_to_category.
--
-- Notes:
--   * dishes.embedding is copied so the branch's feed works immediately; the
--     enrich trigger (trg_enrich_on_dish_change) still fires on insert and
--     will re-embed identical text — harmless, just embedding-call cost.
--   * protein_families / protein_canonical_names are NOT copied — the
--     compute_dish_protein_families trigger (migration 159) derives them from
--     primary_protein on insert.
--   * dish_courses / dish_course_items are NOT copied (zero rows in prod,
--     column shapes unverified). A guard aborts the copy if the source ever
--     has course data, instead of silently dropping it.
--   * Re-running on the same target is blocked when the target already has
--     menus (one-time copy semantics; prevents accidental duplication).
--
-- Called by the admin app via the service-role client (RLS bypassed), same as
-- admin_confirm_menu_scan — hence SECURITY INVOKER.

BEGIN;

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
  -- Course menus are stored in dish_courses / dish_course_items, which this
  -- copy does not clone yet. Abort loudly instead of losing course data.
  IF EXISTS (
    SELECT 1
    FROM dish_courses dc
    JOIN dishes d ON d.id = dc.dish_id
    WHERE d.restaurant_id = p_source_restaurant_id
  ) THEN
    RAISE EXCEPTION 'SOURCE_HAS_COURSE_MENUS';
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
    description_visibility, ingredients_visibility, dish_kind,
    display_price_prefix, enrichment_status, embedding,
    parent_dish_id, is_parent, serves, price_per_person, primary_protein,
    status, is_template, source_image_index, source_region, dining_format,
    bundled_items, available_days, available_hours_start, available_hours_end,
    available_from, available_until, portion_amount, portion_unit
  )
  SELECT
    d.new_id, p_target_restaurant_id, cm.new_id, src.name, src.description,
    src.price, src.calories, src.spice_level, src.image_url, src.is_available,
    src.dish_category_id, src.description_visibility, src.ingredients_visibility,
    src.dish_kind, src.display_price_prefix, src.enrichment_status, src.embedding,
    pm.new_id, src.is_parent, src.serves, src.price_per_person,
    src.primary_protein, 'draft', src.is_template, src.source_image_index,
    src.source_region, src.dining_format, src.bundled_items, src.available_days,
    src.available_hours_start, src.available_hours_end, src.available_from,
    src.available_until, src.portion_amount, src.portion_unit
  FROM dishes src
  JOIN _dish_map d ON d.old_id = src.id
  LEFT JOIN _cat_map  cm ON cm.old_id = src.menu_category_id
  LEFT JOIN _dish_map pm ON pm.old_id = src.parent_dish_id;
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

COMMIT;
