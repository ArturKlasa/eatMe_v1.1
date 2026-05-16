-- 136_REVERSE_ONLY_hnsw_dishes_embedding.sql
-- Reverses 136_hnsw_dishes_embedding.sql.
--
-- Dropping the HNSW index causes the consumer feed query to fall back
-- to a sequential scan of all published dishes per request. Latency
-- and read IOPS grow linearly with dish count. Only roll back if the
-- index is causing observable problems (memory pressure, wrong query
-- plans the planner won't unlearn, etc.).

BEGIN;

DROP INDEX IF EXISTS public.dishes_embedding_hnsw_idx;

COMMIT;
