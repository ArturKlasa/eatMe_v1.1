-- 137_record_other_vector_indexes.sql
-- Created: 2026-05-16
--
-- Records two additional HNSW indexes that exist in production but were
-- never captured in any prior migration (drift):
--
--   1. ubp_preference_vector_hnsw_idx — on user_behavior_profiles.preference_vector
--      Used for: matching one user's profile against similar users (collaborative
--      filtering signals, possibly the update-preference-vector pipeline).
--
--   2. restaurants_vector_hnsw_idx — on restaurants.restaurant_vector
--      Used for: restaurant-level similarity (the centroid that the Phase 3
--      cron now maintains). Queries that ask "find restaurants similar to X"
--      or "match this user's preference to restaurant centroids" depend on it.
--
-- Both use the same tuning as dishes_embedding_hnsw_idx (m=16, ef_construction=64)
-- because they store the same 1536-dim text-embedding-3-small vectors.
--
-- Apply notes:
--   - Non-concurrent CREATE INDEX; briefly locks the affected table. Fine
--     for fresh environments and effectively a no-op on production (both
--     indexes already exist there).
--   - Scale considerations match migration 136: the planner adopts these
--     indexes only above ~5k rows. Below that, sequential scan is cheaper.

BEGIN;

CREATE INDEX IF NOT EXISTS ubp_preference_vector_hnsw_idx
  ON public.user_behavior_profiles
  USING hnsw (preference_vector vector_cosine_ops)
  WITH (m = 16, ef_construction = 64)
  WHERE preference_vector IS NOT NULL;

CREATE INDEX IF NOT EXISTS restaurants_vector_hnsw_idx
  ON public.restaurants
  USING hnsw (restaurant_vector vector_cosine_ops)
  WITH (m = 16, ef_construction = 64)
  WHERE restaurant_vector IS NOT NULL;

COMMIT;
