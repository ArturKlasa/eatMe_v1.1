-- 104_backfill_dish_ingredients_concept_id.sql
-- Created: 2026-04-19
-- Phase 6A cutover — step 1 of 3 migrations.
--
-- Populates dish_ingredients.concept_id and variant_id for every existing
-- row. Rows ingested before Phase 3 have concept_id=NULL today; Phase 6A
-- step 6 (migration 106) flips the column to NOT NULL after this backfill
-- and the writer-side updates land.
--
-- variant_id stays NULL here — existing dishes didn't carry variant
-- information at ingestion time, and we can't invent it retroactively.
-- All concepts have a legacy_canonical_id thanks to migration 103, so the
-- join always resolves.
--
-- Idempotent: only touches rows where concept_id is still null.

BEGIN;

UPDATE public.dish_ingredients di
SET concept_id = ic.id
FROM public.ingredient_concepts ic
WHERE di.concept_id IS NULL
  AND ic.legacy_canonical_id = di.ingredient_id;

COMMIT;
