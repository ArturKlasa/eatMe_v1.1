-- 171_retire_ingredient_triggers_reconciled.sql
-- Created: 2026-06-20
--
-- Phase B (DEBT-01) of the schema-teardown spine — RECONCILED.
--
-- This migration SUPERSEDES 151_retire_ingredient_triggers.sql per D-06
-- (the D-06 trigger/function drift). It drops the same set of inert
-- ingredient-pipeline triggers + helper functions, but is authored to be
-- safe against the live state that has shifted since 151 was written:
--
--   * Migration 156 (abandon-allergens, APPLIED) already dropped
--     public.dietary_tags, public.canonical_ingredient_dietary_tags,
--     public.allergens, and the dishes.allergens / dishes.dietary_tags
--     columns. The functions 151 drops (compute_dish_dietary_tags,
--     refresh_dish_dietary, ...) reference those now-gone objects, and
--     156's dependency-following drop may already have removed some of 151's
--     drop targets.
--     That means 151's forward DROPs are now possibly-partial no-ops, and
--     151's REVERSE is broken (it recreates functions that query 156-dropped
--     objects and would fail to apply).
--
--   * Every DROP below is IF EXISTS, so this migration is idempotent and
--     correct regardless of whether 151 already ran or whether 156's
--     dependency-following drop already removed some targets. Applying it on a
--     database where the
--     objects are already gone is a harmless no-op.
--
-- DO NOT also apply 151. This migration replaces it. Apply exactly one of
-- {151, 171}; 171 is the reconciled, current-state-safe choice.
--
-- Pre-apply checklist:
--   1. Run the LIVE-STATE PROBE first (handed off in plan 06-06) to confirm
--      which of these triggers/functions actually still exist in prod — this
--      DDL is safe either way, but the probe records the real starting state.
--   2. Confirm 151 has NOT been applied to this database (apply only one of
--      151 / 171).
--   3. This is authored + dry-run only here; application is the operator's
--      action (06-06 handoff).
--
-- Reverse: 171_REVERSE_ONLY_retire_ingredient_triggers_reconciled.sql is a
-- degenerate / marker-only reverse (152_REVERSE precedent). It intentionally
-- does NOT recreate compute_dish_dietary_tags or refresh_dish_dietary, because
-- those functions reference objects migration 156 already dropped — recreating
-- them would fail to apply. See that file's header for the full rationale.
--
-- Preserved (NOT touched by this migration — still wanted):
--   - trg_enrich_on_dish_change          (mig 135) — fires on dishes.name/description.
--   - after_dish_embedded                (mig 135) — fires on dishes.embedding.
--   - trg_enrich_on_option_group_change  (mig 135) — fires on option_groups.

BEGIN;

-- ── (1) Triggers (drop before the functions they call) ─────────────────────
DROP TRIGGER IF EXISTS dish_ingredients_refresh        ON public.dish_ingredients;
DROP TRIGGER IF EXISTS dishes_override_refresh         ON public.dishes;
DROP TRIGGER IF EXISTS trg_enrich_on_ingredient_change ON public.dish_ingredients;

-- ── (2) Trigger functions ──────────────────────────────────────────────────
DROP FUNCTION IF EXISTS public.trg_dish_ingredients_refresh();
DROP FUNCTION IF EXISTS public.trg_dishes_override_refresh();

-- ── (3) Helper functions (refresh_dish_dietary calls compute_dish_allergens +
--        compute_dish_dietary_tags, so drop it first then the computes) ──────
DROP FUNCTION IF EXISTS public.refresh_dish_dietary(uuid);
DROP FUNCTION IF EXISTS public.compute_dish_allergens(uuid);
DROP FUNCTION IF EXISTS public.compute_dish_dietary_tags(uuid);

COMMIT;
