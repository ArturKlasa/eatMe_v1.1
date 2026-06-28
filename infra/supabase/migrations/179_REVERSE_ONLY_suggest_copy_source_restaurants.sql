-- 179_REVERSE_ONLY_suggest_copy_source_restaurants.sql
-- Rollback for 179_suggest_copy_source_restaurants.sql
--
-- Drops the branch-suggestion RPC. Does NOT touch f_unaccent / pg_trgm /
-- unaccent — those are shared with migration 126 (dish-category fuzzy match).

BEGIN;

DROP FUNCTION IF EXISTS public.suggest_copy_source_restaurants(uuid, int);

COMMIT;
