-- 139_REVERSE_ONLY_drop_dead_enrichment_columns.sql
-- Reverses 139_drop_dead_enrichment_columns.sql.
--
-- WARNING: this reverse re-creates the column shells but ALL DATA IS
-- LOST. The dropped columns held AI-inference metadata from the old
-- pipeline that hasn't been written since Phase 2 (2026-05-15 / 2026-05-16).
-- Re-creating the columns yields empty/NULL rows everywhere.
--
-- Only roll back if Phase 5 is being abandoned entirely. To actually
-- recover the prior data, restore from a pre-2026-05-16 backup.

BEGIN;

ALTER TABLE public.dishes
  ADD COLUMN IF NOT EXISTS enrichment_payload jsonb,
  ADD COLUMN IF NOT EXISTS enrichment_review_status text
    CHECK (enrichment_review_status IS NULL OR enrichment_review_status = ANY(
      ARRAY['pending_review'::text, 'reviewed'::text, 'rejected'::text]
    )),
  ADD COLUMN IF NOT EXISTS embedding_input text,
  ADD COLUMN IF NOT EXISTS enrichment_source text NOT NULL DEFAULT 'none'
    CHECK (enrichment_source = ANY(ARRAY['none'::text, 'ai'::text, 'manual'::text])),
  ADD COLUMN IF NOT EXISTS enrichment_confidence text
    CHECK (enrichment_confidence = ANY(ARRAY['high'::text, 'medium'::text, 'low'::text]));

CREATE INDEX IF NOT EXISTS dishes_enrichment_review_status_idx
  ON public.dishes (enrichment_review_status)
  WHERE enrichment_review_status IS NOT NULL;

COMMIT;
