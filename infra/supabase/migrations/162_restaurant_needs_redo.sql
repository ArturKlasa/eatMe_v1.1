-- 162_restaurant_needs_redo.sql
-- Created: 2026-06-12
--
-- Operator flag: "this restaurant needs redoing". Set from the admin UI
-- (scan-review header or restaurant page) when scan review shows something
-- slightly wrong worth revisiting later; surfaced as a filter + badge in the
-- admin restaurants list. Admin-only bookkeeping — mobile and the owner
-- portal never read it.
--
-- Also extends get_admin_restaurants with the column + an optional filter.
-- The function is DROPped first: both the parameter list and the result type
-- change, so CREATE OR REPLACE would either fail (result type) or leave an
-- ambiguous overload behind (parameters).
--
-- Reverse: 162_REVERSE_ONLY_restaurant_needs_redo.sql

ALTER TABLE public.restaurants
  ADD COLUMN IF NOT EXISTS needs_redo boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN public.restaurants.needs_redo IS
  'Admin operator flag: scan/menu needs revisiting. Set during scan review; admin-only.';

DROP FUNCTION IF EXISTS get_admin_restaurants(text, text, boolean, text, int, int);

CREATE FUNCTION get_admin_restaurants(
  p_search     text    DEFAULT NULL,
  p_status     text    DEFAULT NULL,
  p_is_active  boolean DEFAULT NULL,
  p_city       text    DEFAULT NULL,
  p_needs_redo boolean DEFAULT NULL,
  p_limit      int     DEFAULT 50,
  p_offset     int     DEFAULT 0
)
RETURNS TABLE (
  id          uuid,
  name        text,
  city        text,
  status      text,
  is_active   boolean,
  needs_redo  boolean,
  owner_id    uuid,
  owner_email text,
  created_at  timestamptz,
  total_count bigint
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
BEGIN
  RETURN QUERY
  WITH base AS (
    SELECT
      r.id,
      r.name,
      r.city,
      r.status::text,
      COALESCE(r.is_active, true)        AS is_active,
      r.needs_redo,
      r.owner_id,
      COALESCE(u.email, '')::text        AS owner_email,
      r.created_at
    FROM public.restaurants r
    LEFT JOIN auth.users u ON u.id = r.owner_id
    WHERE
      (p_search    IS NULL OR r.name  ILIKE '%' || p_search || '%')
      AND (p_status     IS NULL OR r.status::text = p_status)
      AND (p_is_active  IS NULL OR COALESCE(r.is_active, true) = p_is_active)
      AND (p_city       IS NULL OR r.city ILIKE '%' || p_city || '%')
      AND (p_needs_redo IS NULL OR r.needs_redo = p_needs_redo)
  )
  SELECT
    b.id,
    b.name,
    b.city,
    b.status,
    b.is_active,
    b.needs_redo,
    b.owner_id,
    b.owner_email,
    b.created_at,
    COUNT(*) OVER ()::bigint AS total_count
  FROM base b
  ORDER BY b.created_at DESC
  LIMIT p_limit OFFSET p_offset;
END;
$$;

REVOKE ALL ON FUNCTION get_admin_restaurants FROM PUBLIC;
GRANT EXECUTE ON FUNCTION get_admin_restaurants TO authenticated;
GRANT EXECUTE ON FUNCTION get_admin_restaurants TO service_role;
