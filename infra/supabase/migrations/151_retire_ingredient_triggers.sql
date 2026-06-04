-- 151_retire_ingredient_triggers.sql
-- Created: 2026-06-04
--
-- Phase B of the ingredient pipeline retirement (per
-- docs/plans/ingredient-pipeline-phase-b-trigger-retirement.md).
--
-- Phase A (shipped 2026-05-17) removed all application-level read/write paths
-- for dish_ingredients / canonical_ingredients / ingredient_concepts. Three
-- DB triggers remained, all of which have been firing zero times since Phase A
-- because nothing writes to their tables:
--
--   1. dish_ingredients_refresh        (mig 092) — recomputed dishes.allergens
--                                                   / dietary_tags on
--                                                   dish_ingredients changes.
--   2. dishes_override_refresh         (mig 092) — merged
--                                                   allergens_override /
--                                                   dietary_tags_override into
--                                                   the computed columns.
--   3. trg_enrich_on_ingredient_change (mig 135) — notified enrich-dish on
--                                                   dish_ingredients writes.
--
-- After this migration:
--   - dishes.allergens / dietary_tags are direct-write only (worker + admin
--     set them explicitly; no trigger overrides).
--   - The dish_ingredients_* table is fully orphaned (no readers, no triggers).
--     Phase C will drop the table itself + the override columns.
--
-- Sequencing note: the original Phase B plan gated this on dish-model rewrite
-- Phases 6/7 plus a 1–2 week observation window. Both gates are about
-- production-traffic ergonomics (avoid noisy trigger fires during Phase 6's
-- destructive cutover; observe traffic for surprise consumers). With no
-- production users today, both gates collapse: Phase 6 noise is unobserved,
-- and there is no traffic to derive surprise consumers from. Proceeding
-- without dish-model Phase 6/7.
--
-- Independent safety check (grep across migrations + app code + edge functions):
-- the only callers of these functions are the trigger bodies themselves plus
-- one-shot backfill DO blocks in migrations 092 and 105. No supabase.rpc()
-- callsites, no app code references. The functions are genuinely dead.
--
-- Preserved (not touched by Phase B):
--   - dishes.allergens_override, dishes.dietary_tags_override columns (Phase C drops).
--   - dish_ingredients / canonical_ingredients / ingredient_concepts tables (Phase C drops).
--   - trg_enrich_on_dish_change (mig 135) — fires on dishes.name/description; still wanted.
--   - after_dish_embedded         (mig 135) — fires on dishes.embedding; still wanted.
--   - trg_enrich_on_option_group_change (mig 135) — fires on option_groups; still wanted.
--
-- Reverse: 151_REVERSE_ONLY_retire_ingredient_triggers.sql restores the
-- triggers + functions by recreating compute_dish_* from migration 105 (the
-- ingredient_concepts version), refresh_dish_dietary + trigger functions from
-- migration 092, and the enrich-on-ingredient-change trigger from migration
-- 135. It does NOT re-run the backfill DO blocks — those were one-shot
-- column-populate operations from the original migrations and have no
-- meaningful reverse.

BEGIN;

-- Triggers first (must come before the functions they call).
DROP TRIGGER IF EXISTS dish_ingredients_refresh        ON public.dish_ingredients;
DROP TRIGGER IF EXISTS dishes_override_refresh         ON public.dishes;
DROP TRIGGER IF EXISTS trg_enrich_on_ingredient_change ON public.dish_ingredients;

-- Trigger functions.
DROP FUNCTION IF EXISTS public.trg_dish_ingredients_refresh();
DROP FUNCTION IF EXISTS public.trg_dishes_override_refresh();

-- Helper functions. refresh_dish_dietary calls compute_dish_allergens +
-- compute_dish_dietary_tags, so drop refresh_dish_dietary first then the
-- computes.
DROP FUNCTION IF EXISTS public.refresh_dish_dietary(uuid);
DROP FUNCTION IF EXISTS public.compute_dish_allergens(uuid);
DROP FUNCTION IF EXISTS public.compute_dish_dietary_tags(uuid);

COMMIT;
