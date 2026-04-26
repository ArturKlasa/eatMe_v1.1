-- 126_REVERSE_ONLY_dish_category_fuzzy_match.sql
-- Reverse migration for 126_dish_category_fuzzy_match.sql
--
-- Drops the RPC, the index, and the f_unaccent wrapper. Leaves the unaccent
-- extension installed (cheap to keep, may be used by other code paths).

BEGIN;

DROP FUNCTION IF EXISTS public.fuzzy_match_dish_category(text);
DROP INDEX IF EXISTS public.dish_categories_name_trgm_idx;
DROP FUNCTION IF EXISTS public.f_unaccent(text);

COMMIT;
