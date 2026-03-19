-- 057_interaction_idempotency.sql
-- Created: 2026-03-19
--
-- Phase 6: Behaviour Profile Pipeline
--
-- 1. Partial unique index on user_dish_interactions to prevent duplicate
--    interaction rows for the same user+dish+type within a 24-hour window.
--    Uses a functional index on date_trunc('day', created_at) so that the
--    same user can re-interact with the same dish on different days (e.g.
--    views the same dish at a restaurant a week later).
--
-- 2. Index to speed up the update-preference-vector function's query
--    (filters by user_id, ordered by created_at DESC, limit 500).

-- Idempotency: prevent duplicate same-type interactions on the same dish
-- within the same calendar day (UTC). Allows re-interaction on future days.
CREATE UNIQUE INDEX IF NOT EXISTS user_dish_interactions_dedup_idx
  ON user_dish_interactions (
    user_id,
    dish_id,
    interaction_type,
    date_trunc('day', created_at)
  );

-- Performance: preference vector computation scans by user_id ordered by created_at
CREATE INDEX IF NOT EXISTS user_dish_interactions_user_created_idx
  ON user_dish_interactions (user_id, created_at DESC);
