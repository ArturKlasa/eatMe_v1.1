-- 128_REVERSE_ONLY_dish_category_aliases.sql
-- Reverse migration for 128_dish_category_aliases.sql
--
-- Drops the aliases column (data loss — admin-added aliases gone) and
-- restores the previous single-tier fuzzy_match_dish_category at threshold 0.7.

BEGIN;

CREATE OR REPLACE FUNCTION public.fuzzy_match_dish_category(p_query text)
RETURNS TABLE (id uuid, name text, score real)
LANGUAGE sql
STABLE
PARALLEL SAFE
AS $$
  SELECT
    dc.id,
    dc.name,
    similarity(
      public.f_unaccent(lower(dc.name)),
      public.f_unaccent(lower(p_query))
    ) AS score
  FROM public.dish_categories dc
  WHERE dc.is_active
    AND public.f_unaccent(lower(dc.name)) % public.f_unaccent(lower(p_query))
    AND similarity(
          public.f_unaccent(lower(dc.name)),
          public.f_unaccent(lower(p_query))
        ) > 0.7
  ORDER BY score DESC
  LIMIT 1;
$$;

REVOKE ALL ON FUNCTION public.fuzzy_match_dish_category(text) FROM public;
GRANT EXECUTE ON FUNCTION public.fuzzy_match_dish_category(text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.fuzzy_match_dish_category(text) TO service_role;

ALTER TABLE public.dish_categories
  DROP COLUMN IF EXISTS aliases;

COMMIT;
