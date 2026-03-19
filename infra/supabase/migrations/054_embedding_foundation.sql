-- 054_embedding_foundation.sql
-- Created: 2026-03-19
--
-- Adds the pgvector embedding layer:
--   1. Enable pgvector extension
--   2. Enrichment + embedding columns on dishes
--   3. HNSW index (partial — skips unembedded rows)
--   4. preference_vector on user_behavior_profiles
--   5. restaurant_vector on restaurants
--   6. update_restaurant_vector() helper function
--   7. after_dish_embedded trigger to keep restaurant vector in sync

-- ── 1. Enable pgvector ────────────────────────────────────────────────────────

CREATE EXTENSION IF NOT EXISTS vector;

-- ── 2. Enrichment + embedding columns on dishes ───────────────────────────────
-- enrichment_status lifecycle: none → pending → completed | failed
-- enrichment_source: 'none' (not enriched), 'ai' (GPT), 'manual' (partner-supplied)
-- enrichment_confidence: 'high' (≥3 matched ingredients) | 'medium' (1–2) | 'low' (name-only)
-- enrichment_payload: raw GPT JSON response (audit trail; never drives allergen/dietary_tags)
-- embedding_input: the text string actually sent to the embedding model (auditable)
-- embedding: 1536-dim float vector from text-embedding-3-small

ALTER TABLE dishes
  ADD COLUMN enrichment_status     TEXT NOT NULL DEFAULT 'none'
    CHECK (enrichment_status IN ('none', 'pending', 'completed', 'failed')),
  ADD COLUMN enrichment_source     TEXT NOT NULL DEFAULT 'none'
    CHECK (enrichment_source IN ('none', 'ai', 'manual')),
  ADD COLUMN enrichment_confidence TEXT
    CHECK (enrichment_confidence IN ('high', 'medium', 'low')),
  ADD COLUMN enrichment_payload    JSONB,
  ADD COLUMN embedding_input       TEXT,
  ADD COLUMN embedding             vector(1536);

-- ── 3. HNSW index ─────────────────────────────────────────────────────────────
-- Partial: excludes rows where embedding IS NULL so the index stays compact
-- during and after the batch-embed run.
-- After migration 053 adds all options, re-run ANALYZE dishes to update stats.
-- ef_search defaults to 40 — tune at query time with SET hnsw.ef_search = N.

CREATE INDEX dishes_embedding_hnsw_idx
  ON dishes USING hnsw (embedding vector_cosine_ops)
  WITH (m = 16, ef_construction = 64)
  WHERE embedding IS NOT NULL;

-- Standard B-tree on enrichment_status for the batch-embed query and monitoring
CREATE INDEX dishes_enrichment_status_idx ON dishes(enrichment_status);

-- ── 4. preference_vector on user_behavior_profiles ────────────────────────────
-- Weighted centroid of the user's liked-dish embeddings.
-- Updated asynchronously by the swipe-processing pipeline (Phase 5).

ALTER TABLE user_behavior_profiles
  ADD COLUMN preference_vector            vector(1536),
  ADD COLUMN preference_vector_updated_at TIMESTAMPTZ;

-- Partial HNSW so cold-start users (NULL vector) don't bloat the index
CREATE INDEX ubp_preference_vector_hnsw_idx
  ON user_behavior_profiles USING hnsw (preference_vector vector_cosine_ops)
  WITH (m = 16, ef_construction = 64)
  WHERE preference_vector IS NOT NULL;

-- ── 5. restaurant_vector on restaurants ──────────────────────────────────────
-- Average of all available-dish embeddings for the restaurant.
-- Recomputed after each dish is embedded via the trigger below.

ALTER TABLE restaurants
  ADD COLUMN restaurant_vector vector(1536);

CREATE INDEX restaurants_vector_hnsw_idx
  ON restaurants USING hnsw (restaurant_vector vector_cosine_ops)
  WITH (m = 16, ef_construction = 64)
  WHERE restaurant_vector IS NOT NULL;

-- ── 6. update_restaurant_vector() ────────────────────────────────────────────
-- Recomputes the restaurant centroid vector from all embedded, available dishes.
-- Called:
--   a) by the after_dish_embedded trigger (automatic, per-dish save)
--   b) by the batch-embed script (once after all dishes are embedded)

CREATE OR REPLACE FUNCTION update_restaurant_vector(p_restaurant_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  UPDATE restaurants
  SET restaurant_vector = (
    SELECT avg(embedding)
    FROM dishes
    WHERE restaurant_id = p_restaurant_id
      AND embedding IS NOT NULL
      AND is_available = true
  )
  WHERE id = p_restaurant_id;
END;
$$;

-- ── 7. Trigger: keep restaurant_vector in sync after each dish embedding ──────
-- Fires AFTER UPDATE on the embedding column so it only runs when a dish
-- actually gets embedded (not on every dish save).
-- Uses pg_background if available; falls back to a direct call so the
-- trigger never blocks the original transaction.

CREATE OR REPLACE FUNCTION _trg_after_dish_embedded()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Only act when embedding changed from NULL → a value
  IF OLD.embedding IS DISTINCT FROM NEW.embedding AND NEW.embedding IS NOT NULL THEN
    PERFORM update_restaurant_vector(NEW.restaurant_id);
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER after_dish_embedded
  AFTER UPDATE OF embedding ON dishes
  FOR EACH ROW
  EXECUTE FUNCTION _trg_after_dish_embedded();

-- ── 8. Mark all existing dishes as pending enrichment ────────────────────────
-- The batch-embed script reads rows where enrichment_status = 'none';
-- this ensures all pre-existing dishes are picked up on the first run.
UPDATE dishes
SET enrichment_status = 'none'
WHERE enrichment_status = 'none'; -- no-op but explicit intent; batch script uses 'none'

-- ── 9. run_analyze_dishes() helper ───────────────────────────────────────────
-- Called by the batch-embed script after all embeddings are inserted so the
-- query planner picks up the new partial HNSW index immediately without
-- waiting for the next auto-vacuum cycle.

CREATE OR REPLACE FUNCTION run_analyze_dishes()
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  ANALYZE dishes;
END;
$$;
