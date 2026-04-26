-- 126_dish_category_fuzzy_match.sql
-- Created: 2026-04-25
--
-- Adds infrastructure for fuzzy-matching free-text dish category suggestions
-- (emitted by the menu-scan worker) against the seeded dish_categories
-- taxonomy (~800 rows from migration 112).
--
-- Pieces:
--   (a) unaccent extension (pg_trgm already enabled by migration 099)
--   (b) f_unaccent IMMUTABLE wrapper — unaccent is STABLE, so it can't be
--       used in index expressions or generated columns without a wrapper.
--   (c) GIN trigram index on dish_categories — keeps fuzzy lookups fast as
--       the taxonomy grows beyond the seeded baseline.
--   (d) fuzzy_match_dish_category(text) RPC — single-best-match lookup with
--       a 0.7 similarity threshold. Returns id/name/score or empty set.
--
-- Reverse: 126_REVERSE_ONLY_dish_category_fuzzy_match.sql

BEGIN;

-- ── (a) Extensions ───────────────────────────────────────────────────────────
CREATE EXTENSION IF NOT EXISTS unaccent;

-- ── (b) IMMUTABLE wrapper for unaccent ───────────────────────────────────────
-- unaccent() is declared STABLE in the extension because it consults a
-- dictionary at runtime. Index expressions and generated columns require
-- IMMUTABLE functions. This wrapper pins the dictionary explicitly so the
-- function can be marked IMMUTABLE — the standard pattern recommended by
-- the Postgres docs for indexed unaccented columns.
CREATE OR REPLACE FUNCTION public.f_unaccent(p_text text)
RETURNS text
LANGUAGE sql
IMMUTABLE
PARALLEL SAFE
STRICT
AS $$
  SELECT public.unaccent('public.unaccent', p_text);
$$;

-- ── (c) GIN trigram index on unaccented lower(name) ─────────────────────────
CREATE INDEX IF NOT EXISTS dish_categories_name_trgm_idx
  ON public.dish_categories
  USING gin (public.f_unaccent(lower(name)) gin_trgm_ops);

-- ── (d) fuzzy_match_dish_category RPC ────────────────────────────────────────
-- Returns the single best dish_category match for a free-text query.
-- Threshold: 0.7 similarity (after lower + unaccent normalization).
-- Returns empty set when no row clears the threshold — caller treats as null.
--
-- The `%` operator + similarity() > 0.7 are both applied: the operator allows
-- the GIN index to prune candidates, the explicit threshold guarantees the
-- numeric cutoff regardless of session-level set_limit() state.
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

COMMIT;
