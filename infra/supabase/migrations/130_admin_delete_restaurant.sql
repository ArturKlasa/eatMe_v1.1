-- 130_admin_delete_restaurant.sql
-- Created: 2026-04-30
--
-- Adds the admin_delete_restaurant(uuid) Postgres function. Hard-deletes a
-- restaurant and every row that references it (directly or transitively),
-- atomically inside one transaction.
--
-- Authorization: caller must be admin. The auth check lives in the calling
-- server action (withAdminAuth) — this matches the adminPublishRestaurant
-- pattern, which uses the service-role client (no JWT, so an in-SQL
-- is_admin() check would always fail).
--
-- Cascade order matters because most child FKs do NOT have ON DELETE CASCADE.
-- See the comment block inside for the dependency reasoning.
--
-- Returns jsonb with per-table delete counts plus the menu-scan storage paths
-- the caller should remove from the menu-scan-uploads bucket.
--
-- Reverse: 130_REVERSE_ONLY_admin_delete_restaurant.sql

BEGIN;

CREATE OR REPLACE FUNCTION public.admin_delete_restaurant(p_restaurant_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_dish_ids        uuid[];
  v_menu_ids        uuid[];
  v_storage_paths   text[];
  v_dishes_deleted          int := 0;
  v_menus_deleted           int := 0;
  v_categories_deleted      int := 0;
  v_opinions_deleted        int := 0;
  v_photos_deleted          int := 0;
  v_visits_deleted          int := 0;
  v_favorites_deleted       int := 0;
  v_scan_jobs_deleted       int := 0;
  v_option_groups_deleted   int := 0;
  v_options_deleted         int := 0;
  v_analytics_deleted       int := 0;
  v_interactions_deleted    int := 0;
  v_session_views_deleted   int := 0;
  v_sessions_unset          int := 0;
  v_recommendations_deleted int := 0;
  v_votes_deleted           int := 0;
  v_responses_deleted       int := 0;
  v_temp                    int;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM restaurants WHERE id = p_restaurant_id) THEN
    RAISE EXCEPTION 'Restaurant % not found', p_restaurant_id
      USING ERRCODE = 'NO_DATA_FOUND';
  END IF;

  -- Capture child IDs once. We delete children before parents, but several
  -- intermediate tables (favorites, session_views, options) are filtered by
  -- IDs that are gone after we delete the parent.
  SELECT array_agg(id) INTO v_dish_ids FROM dishes WHERE restaurant_id = p_restaurant_id;
  SELECT array_agg(id) INTO v_menu_ids FROM menus  WHERE restaurant_id = p_restaurant_id;

  -- Collect menu-scan storage paths for the caller's bucket cleanup.
  SELECT COALESCE(array_agg(p), ARRAY[]::text[])
    INTO v_storage_paths
    FROM (
      SELECT unnest(image_storage_paths) AS p
        FROM menu_scan_jobs
       WHERE restaurant_id = p_restaurant_id
    ) s
   WHERE p IS NOT NULL;

  v_dish_ids := COALESCE(v_dish_ids, ARRAY[]::uuid[]);
  v_menu_ids := COALESCE(v_menu_ids, ARRAY[]::uuid[]);

  -- ── Layer 1: dish-children that block dishes / dish_photos / user_visits ──
  --
  -- dish_opinions FK to (dish_id, visit_id, photo_id). Must come before
  -- dish_photos and user_visits.

  IF array_length(v_dish_ids, 1) > 0 THEN
    DELETE FROM dish_analytics WHERE dish_id = ANY(v_dish_ids);
    GET DIAGNOSTICS v_analytics_deleted = ROW_COUNT;

    DELETE FROM user_dish_interactions WHERE dish_id = ANY(v_dish_ids);
    GET DIAGNOSTICS v_interactions_deleted = ROW_COUNT;

    DELETE FROM dish_opinions WHERE dish_id = ANY(v_dish_ids);
    GET DIAGNOSTICS v_opinions_deleted = ROW_COUNT;

    DELETE FROM dish_photos WHERE dish_id = ANY(v_dish_ids);
    GET DIAGNOSTICS v_photos_deleted = ROW_COUNT;
  END IF;

  -- ── Layer 2: options + option_groups (both restaurant-scoped and dish-scoped) ──
  DELETE FROM options
   WHERE option_group_id IN (
     SELECT id FROM option_groups WHERE restaurant_id = p_restaurant_id
   );
  GET DIAGNOSTICS v_options_deleted = ROW_COUNT;

  DELETE FROM option_groups WHERE restaurant_id = p_restaurant_id;
  GET DIAGNOSTICS v_option_groups_deleted = ROW_COUNT;

  -- ── Layer 3: polymorphic / non-FK tables ──
  -- favorites uses (subject_type, subject_id) with no FK constraint.
  IF array_length(v_dish_ids, 1) > 0 THEN
    DELETE FROM favorites
     WHERE subject_type = 'dish'
       AND subject_id = ANY(v_dish_ids);
    GET DIAGNOSTICS v_temp = ROW_COUNT;
    v_favorites_deleted := v_favorites_deleted + v_temp;
  END IF;

  DELETE FROM favorites
   WHERE subject_type = 'restaurant'
     AND subject_id = p_restaurant_id;
  GET DIAGNOSTICS v_temp = ROW_COUNT;
  v_favorites_deleted := v_favorites_deleted + v_temp;

  -- session_views (entity_type, entity_id) — also no FK.
  DELETE FROM session_views
   WHERE entity_type = 'restaurant'
     AND entity_id = p_restaurant_id;
  GET DIAGNOSTICS v_temp = ROW_COUNT;
  v_session_views_deleted := v_session_views_deleted + v_temp;

  IF array_length(v_dish_ids, 1) > 0 THEN
    DELETE FROM session_views
     WHERE entity_type = 'dish'
       AND entity_id = ANY(v_dish_ids);
    GET DIAGNOSTICS v_temp = ROW_COUNT;
    v_session_views_deleted := v_session_views_deleted + v_temp;
  END IF;

  IF array_length(v_menu_ids, 1) > 0 THEN
    DELETE FROM session_views
     WHERE entity_type = 'menu'
       AND entity_id = ANY(v_menu_ids);
    GET DIAGNOSTICS v_temp = ROW_COUNT;
    v_session_views_deleted := v_session_views_deleted + v_temp;
  END IF;

  -- ── Layer 4: dishes → menu_categories → menus ──
  -- dishes.parent_dish_id is ON DELETE CASCADE (self-ref).
  -- dish_ingredients, dish_courses, dish_course_items cascade from dishes.
  DELETE FROM dishes WHERE restaurant_id = p_restaurant_id;
  GET DIAGNOSTICS v_dishes_deleted = ROW_COUNT;

  DELETE FROM menu_categories WHERE restaurant_id = p_restaurant_id;
  GET DIAGNOSTICS v_categories_deleted = ROW_COUNT;

  DELETE FROM menus WHERE restaurant_id = p_restaurant_id;
  GET DIAGNOSTICS v_menus_deleted = ROW_COUNT;

  -- ── Layer 5: tables FK'd directly to restaurants ──
  DELETE FROM eat_together_recommendations WHERE restaurant_id = p_restaurant_id;
  GET DIAGNOSTICS v_recommendations_deleted = ROW_COUNT;

  DELETE FROM eat_together_votes WHERE restaurant_id = p_restaurant_id;
  GET DIAGNOSTICS v_votes_deleted = ROW_COUNT;

  -- Preserve eat_together session history; just unlink the restaurant.
  UPDATE eat_together_sessions
     SET selected_restaurant_id = NULL
   WHERE selected_restaurant_id = p_restaurant_id;
  GET DIAGNOSTICS v_sessions_unset = ROW_COUNT;

  DELETE FROM restaurant_experience_responses WHERE restaurant_id = p_restaurant_id;
  GET DIAGNOSTICS v_responses_deleted = ROW_COUNT;

  -- user_visits is referenced by dish_opinions.visit_id, which we already
  -- deleted in Layer 1. Safe now.
  DELETE FROM user_visits WHERE restaurant_id = p_restaurant_id;
  GET DIAGNOSTICS v_visits_deleted = ROW_COUNT;

  -- menu_scan_confirmations cascades from menu_scan_jobs.
  DELETE FROM menu_scan_jobs WHERE restaurant_id = p_restaurant_id;
  GET DIAGNOSTICS v_scan_jobs_deleted = ROW_COUNT;

  -- ── Final ──
  DELETE FROM restaurants WHERE id = p_restaurant_id;

  RETURN jsonb_build_object(
    'dishes_deleted',          v_dishes_deleted,
    'menu_categories_deleted', v_categories_deleted,
    'menus_deleted',           v_menus_deleted,
    'opinions_deleted',        v_opinions_deleted,
    'photos_deleted',          v_photos_deleted,
    'visits_deleted',          v_visits_deleted,
    'favorites_deleted',       v_favorites_deleted,
    'scan_jobs_deleted',       v_scan_jobs_deleted,
    'option_groups_deleted',   v_option_groups_deleted,
    'options_deleted',         v_options_deleted,
    'analytics_deleted',       v_analytics_deleted,
    'interactions_deleted',    v_interactions_deleted,
    'session_views_deleted',   v_session_views_deleted,
    'sessions_unset',          v_sessions_unset,
    'recommendations_deleted', v_recommendations_deleted,
    'votes_deleted',           v_votes_deleted,
    'responses_deleted',       v_responses_deleted,
    'storage_paths',           to_jsonb(v_storage_paths)
  );
END;
$$;

REVOKE ALL ON FUNCTION public.admin_delete_restaurant(uuid) FROM public;
GRANT EXECUTE ON FUNCTION public.admin_delete_restaurant(uuid) TO authenticated;

COMMIT;
