-- 179_suggest_copy_source_restaurants.sql
-- Created: 2026-06-27
--
-- Operator issue #1: proactively suggest copying a menu when a similarly-named
-- restaurant already exists (sucursales/branches). Copy-menu itself already
-- exists (admin_copy_restaurant_menu, migration 160; CopyMenuSection UI), but
-- the operator has to blind-search for the source. This RPC ranks likely
-- branches by trigram name similarity so the admin app can surface them up
-- front in the empty-menu section.
--
-- Matching follows the migration 126 precedent (fuzzy_match_dish_category):
--   * Explicit similarity() >= cutoff rather than the `%` operator — `%` is tied
--     to pg_trgm's session similarity_threshold (default 0.3), so a hard-coded
--     numeric cutoff is deterministic regardless of set_limit() state.
--   * f_unaccent(lower(...)) folds case + Spanish accents ("Café X" ~ "Cafe X").
--   * 0.30 cutoff is recall-favoring (a missed branch defeats the feature; an
--     extra suggestion is bounded by the top-3 cap + a dismiss control in the UI).
--
-- Source eligibility: any OTHER restaurant with >= 1 dish (matches the bar the
-- manual search applies — it disables zero-dish results). No owner scoping and
-- no published-only filter (locked decisions 2026-06-27): owners aren't set
-- consistently in this single-operator model, and a draft sister branch is a
-- valid source.
--
-- The explicit-similarity form can't use idx_restaurants_name_trgm, but the
-- restaurants table is operator-scale so the seq scan is negligible.
--
-- Called by the admin app via the service-role client (RLS bypassed), same as
-- admin_copy_restaurant_menu — hence SECURITY INVOKER.
--
-- Reverse: 179_REVERSE_ONLY_suggest_copy_source_restaurants.sql

BEGIN;

CREATE OR REPLACE FUNCTION public.suggest_copy_source_restaurants(
  p_target_restaurant_id uuid,
  p_limit int DEFAULT 3
)
RETURNS TABLE (
  id         uuid,
  name       text,
  city       text,
  status     text,
  dish_count bigint
)
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = public, extensions
AS $$
  SELECT
    r.id,
    r.name,
    r.city,
    r.status::text,
    (SELECT count(*) FROM public.dishes d WHERE d.restaurant_id = r.id) AS dish_count
  FROM public.restaurants r
  CROSS JOIN LATERAL (
    SELECT name FROM public.restaurants WHERE id = p_target_restaurant_id
  ) tgt
  WHERE r.id <> p_target_restaurant_id
    AND similarity(public.f_unaccent(lower(r.name)), public.f_unaccent(lower(tgt.name))) >= 0.30
    AND EXISTS (SELECT 1 FROM public.dishes d WHERE d.restaurant_id = r.id)
  ORDER BY
    similarity(public.f_unaccent(lower(r.name)), public.f_unaccent(lower(tgt.name))) DESC,
    r.name
  LIMIT p_limit;
$$;

REVOKE ALL    ON FUNCTION public.suggest_copy_source_restaurants(uuid, int) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.suggest_copy_source_restaurants(uuid, int) TO authenticated;
GRANT EXECUTE ON FUNCTION public.suggest_copy_source_restaurants(uuid, int) TO service_role;

COMMIT;
