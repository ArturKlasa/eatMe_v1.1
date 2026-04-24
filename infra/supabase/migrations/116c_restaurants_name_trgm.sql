-- Migration 116c: GIN trigram index on restaurants.name + admin browse helper
-- pg_trgm extension already installed via migration 099_new_ingredients_schema.sql

CREATE INDEX IF NOT EXISTS idx_restaurants_name_trgm
  ON restaurants USING gin (name gin_trgm_ops);

-- Admin-only paginated restaurants query with owner email.
-- Uses SECURITY DEFINER to join auth.users (inaccessible to regular roles).
-- App-layer enforces admin role check before calling this function.
CREATE OR REPLACE FUNCTION get_admin_restaurants(
  p_search     text    DEFAULT NULL,
  p_status     text    DEFAULT NULL,
  p_is_active  boolean DEFAULT NULL,
  p_city       text    DEFAULT NULL,
  p_limit      int     DEFAULT 50,
  p_offset     int     DEFAULT 0
)
RETURNS TABLE (
  id          uuid,
  name        text,
  city        text,
  status      text,
  is_active   boolean,
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
      COALESCE(r.is_active, true)  AS is_active,
      r.owner_id,
      COALESCE(u.email, '')        AS owner_email,
      r.created_at
    FROM public.restaurants r
    LEFT JOIN auth.users u ON u.id = r.owner_id
    WHERE
      (p_search    IS NULL OR r.name  ILIKE '%' || p_search || '%')
      AND (p_status    IS NULL OR r.status::text = p_status)
      AND (p_is_active IS NULL OR COALESCE(r.is_active, true) = p_is_active)
      AND (p_city      IS NULL OR r.city ILIKE '%' || p_city || '%')
  )
  SELECT
    b.id,
    b.name,
    b.city,
    b.status,
    b.is_active,
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
