-- 139_drop_dead_enrichment_columns.sql
-- Created: 2026-05-16
--
-- Drops five dishes columns that have no remaining writers after Phase 2
-- stripped enrich-dish to embedding-only and Phase 5 cleaned up the legacy
-- web-portal writes:
--
--   - enrichment_payload         (was: JSON of GPT-4o-mini inferences)
--   - enrichment_review_status   (was: 'pending_review' flag for admin queue)
--   - embedding_input            (was: text fed into the embedding API)
--   - enrichment_source          (was: 'ai' / 'manual' / 'none')
--   - enrichment_confidence      (was: 'high' / 'medium' / 'low')
--
-- Plus the partial index on enrichment_review_status that was used to power
-- the (never-built) admin review queue.
--
-- enrichment_status column STAYS — still used by trigger, cron, and recovery
-- sweep to track 'pending' / 'completed' / 'failed' lifecycle.
--
-- Pre-apply checklist (DO NOT SKIP):
--   1. enrich-dish must already be deployed without writes to embedding_input
--      (commit removes it). If you apply this migration with stale enrich-dish
--      running, every embedding completion will fail and dishes get stuck.
--   2. apps/web-portal/app/api/menu-scan/confirm/route.ts must already be
--      updated to not write enrichment_source / enrichment_confidence.
--   3. After applying, regenerate types:
--        supabase gen types typescript --linked > packages/database/src/types.ts
--   4. Verify all apps build clean:
--        turbo build && turbo check-types && turbo lint

BEGIN;

ALTER TABLE public.dishes
  DROP COLUMN IF EXISTS enrichment_payload,
  DROP COLUMN IF EXISTS enrichment_review_status,
  DROP COLUMN IF EXISTS embedding_input,
  DROP COLUMN IF EXISTS enrichment_source,
  DROP COLUMN IF EXISTS enrichment_confidence;

DROP INDEX IF EXISTS public.dishes_enrichment_review_status_idx;

COMMIT;
