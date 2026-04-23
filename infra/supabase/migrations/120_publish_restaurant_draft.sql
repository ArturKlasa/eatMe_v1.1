-- 120_publish_restaurant_draft.sql
-- Created: 2026-04-23
--
-- Adds the publish_restaurant_draft(uuid) Postgres function.
-- Atomically transitions a restaurant + all its draft menus + draft dishes
-- from 'draft' → 'published' in a single transaction.
--
-- Authorization: owner_id = auth.uid() OR public.is_admin()
-- Security model: SECURITY DEFINER so the function can bypass row-level ownership
--   checks when updating child menus/dishes owned by the same user. search_path
--   is pinned to public to prevent search_path injection attacks.
--
-- Idempotent: a second call on an already-published restaurant is a no-op
--   (menus/dishes WHERE status='draft' returns 0 rows).
--
-- Depends on: migrations 116 (restaurants.status) + 117 (menus.status) + dishes.status
--   already existing from migration 114.
--
-- Reverse: 120_REVERSE_ONLY_publish_restaurant_draft.sql

BEGIN;

CREATE OR REPLACE FUNCTION public.publish_restaurant_draft(p_restaurant_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_owner_id uuid;
BEGIN
  -- Authorization: owner or admin only.
  SELECT owner_id INTO v_owner_id
    FROM public.restaurants
   WHERE id = p_restaurant_id;

  IF v_owner_id IS NULL THEN
    RAISE EXCEPTION 'Restaurant % not found', p_restaurant_id
      USING ERRCODE = 'NO_DATA_FOUND';
  END IF;

  IF v_owner_id <> auth.uid() AND NOT public.is_admin() THEN
    RAISE EXCEPTION 'Forbidden: not owner or admin'
      USING ERRCODE = 'insufficient_privilege';
  END IF;

  -- Atomic multi-table flip (implicit function transaction).
  UPDATE public.restaurants
     SET status = 'published', updated_at = now()
   WHERE id = p_restaurant_id;

  UPDATE public.menus
     SET status = 'published', updated_at = now()
   WHERE restaurant_id = p_restaurant_id
     AND status = 'draft';

  UPDATE public.dishes
     SET status = 'published', updated_at = now()
   WHERE restaurant_id = p_restaurant_id
     AND status = 'draft';
END;
$$;

REVOKE ALL ON FUNCTION public.publish_restaurant_draft(uuid) FROM public;
GRANT EXECUTE ON FUNCTION public.publish_restaurant_draft(uuid) TO authenticated;

COMMIT;
