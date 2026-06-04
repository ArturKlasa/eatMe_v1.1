-- 152_drop_ingredient_pipeline.sql
-- Created: 2026-06-04
--
-- Phase C of the ingredient pipeline retirement (per
-- docs/plans/ingredient-pipeline-phase-c-schema-retirement.md): drop the
-- nine ingredient tables that have had no application readers since Phase A
-- (shipped 2026-05-17) and no DB triggers since Phase B (shipped 2026-06-03,
-- migration 151).
--
-- Sequencing deviation from the original plan: the plan called for a 4-6
-- week observation window after Phase B plus an 18-month data snapshot to
-- cold storage. Both gates are about production-traffic ergonomics and
-- multi-year revival scenarios. With no production users today, both
-- collapse — proceeding without the wait and without the snapshot.
--
-- Migration 153 drops the dead columns on dishes (allergens_override,
-- dietary_tags_override) and options (canonical_ingredient_id).
--
-- Pre-apply checklist:
--   - Phase A (read paths) shipped: confirmed.
--   - Phase B (triggers) shipped: confirmed (migration 151).
--   - Mobile useRestaurantDetail.ts reads option.adds_allergens instead of
--     canonical_ingredient_allergens: confirmed (commit 6d56101).
--   - Legacy admin surface in apps/web-portal/app/admin/ deleted: confirmed.
--   - All application-side ingredient writes removed: confirmed.
--
-- Reverse: 152_REVERSE_ONLY_drop_ingredient_pipeline.sql is intentionally
-- minimal — it only marks the migration reversed; the actual data is
-- unrecoverable without a snapshot, which we chose not to take. Restoration
-- requires replaying migrations 099-106 plus re-curating the data.

BEGIN;

-- Drop in dependency order. All FKs are within this set; nothing outside
-- the ingredient pipeline references these tables. CASCADE is defensive
-- against any policy / view / index that may have been added in a separate
-- migration.

DROP TABLE IF EXISTS public.variant_translations           CASCADE;
DROP TABLE IF EXISTS public.concept_translations           CASCADE;
DROP TABLE IF EXISTS public.ingredient_variants            CASCADE;
DROP TABLE IF EXISTS public.canonical_ingredient_allergens CASCADE;
DROP TABLE IF EXISTS public.dish_ingredients               CASCADE;
DROP TABLE IF EXISTS public.ingredient_aliases             CASCADE;
DROP TABLE IF EXISTS public.ingredient_aliases_v2          CASCADE;
DROP TABLE IF EXISTS public.ingredient_concepts            CASCADE;
DROP TABLE IF EXISTS public.canonical_ingredients          CASCADE;

COMMIT;
