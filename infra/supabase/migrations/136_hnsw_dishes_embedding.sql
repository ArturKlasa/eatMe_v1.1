-- 136_hnsw_dishes_embedding.sql
-- Created: 2026-05-16
--
-- Records the HNSW index on dishes.embedding that exists in production
-- (drift from prior unrecorded build). Without recording it, fresh-
-- environment migration applies would lack vector search index support
-- for `generate_candidates` and any future similarity queries.
--
-- Index tuning (pgvector defaults for 1536-dim text-embedding-3-small):
--   m                = 16  — bidirectional connections per node
--   ef_construction  = 64  — build-time search width
--
-- Why the broad WHERE (embedding IS NOT NULL) rather than the tighter
-- partial filter we initially planned:
--   The live index was built with WHERE embedding IS NOT NULL. We chose
--   to mirror that here rather than rebuild with a narrower filter,
--   because:
--     a) The drift fix should match production, not an aspirational state
--     b) The broader filter adds ~17% to index size at our scale
--        (parents/drafts/templates), which is negligible at 6 MB
--     c) The narrower filter only helps if the planner actually adopts
--        the index, which at current dish counts (~375 indexed rows) it
--        does not (see scale threshold note in
--        docs/plans/iops-rework-enrichment-pipeline.md Phase 4 section)
--
-- Apply notes:
--   - Non-concurrent CREATE INDEX; briefly locks the dishes table. Fine
--     for fresh environments. No-op on production (index already exists).
--   - For very large fresh databases (>50k dishes), consider building
--     via `CREATE INDEX CONCURRENTLY` in a manual SQL step before
--     applying this migration.

BEGIN;

CREATE INDEX IF NOT EXISTS dishes_embedding_hnsw_idx
  ON public.dishes
  USING hnsw (embedding vector_cosine_ops)
  WITH (m = 16, ef_construction = 64)
  WHERE embedding IS NOT NULL;

COMMIT;
