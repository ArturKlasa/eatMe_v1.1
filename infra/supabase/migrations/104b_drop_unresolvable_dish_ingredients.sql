-- 104b_drop_unresolvable_dish_ingredients.sql
-- Created: 2026-04-19
-- Phase 6A — companion to migration 104.
--
-- Migration 104 backfilled concept_id for every dish_ingredients row whose
-- legacy canonical_id has a matching ingredient_concepts row. A small
-- number of rows remained unresolvable: their canonical points at an
-- entry that was deleted from ingredient_concepts by migration 101
-- (dish-contamination cleanup — "consommé", etc.) but whose legacy
-- canonical_ingredients row still exists. Those rows represent a non-
-- ingredient (a composed dish) and are stale from the legacy matcher.
--
-- This migration drops them so the subsequent concept_id NOT NULL
-- constraint in migration 106 can land without exceptions.
--
-- Impact: each affected dish loses one ingredient link and the allergen
-- trigger recomputes dishes.allergens / dietary_tags accordingly.
-- Since the underlying canonical was a dish name (not a real
-- ingredient), removing the link corrects misinformation rather than
-- losing it.
--
-- Idempotent: safe to re-run; matches no rows on a clean state.

BEGIN;

DELETE FROM public.dish_ingredients
WHERE concept_id IS NULL;

COMMIT;
