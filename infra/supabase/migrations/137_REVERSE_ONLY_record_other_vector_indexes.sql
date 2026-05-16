-- 137_REVERSE_ONLY_record_other_vector_indexes.sql
-- Reverses 137_record_other_vector_indexes.sql.
--
-- WARNING: dropping these indexes degrades:
--   - User similarity queries (slower as user_behavior_profiles grows)
--   - Restaurant-level vector matching (slower as restaurant count grows)
-- Only roll back if Phase 4 is being fully reverted.

BEGIN;

DROP INDEX IF EXISTS public.ubp_preference_vector_hnsw_idx;
DROP INDEX IF EXISTS public.restaurants_vector_hnsw_idx;

COMMIT;
