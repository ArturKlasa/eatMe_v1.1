-- 156_drop_dietary_allergen_columns.sql
-- Created: 2026-06-05
--
-- Part 2 of 2 in the "abandon dish-level allergens + dietary tags" rollout
-- (docs/plans/abandon-allergens-dietary.md, Phase 7). Drops the now-unreferenced
-- allergen + dietary columns and the orphaned lookup/vocabulary tables.
--
-- MUST run AFTER migration 155 (which rewrote generate_candidates,
-- get_group_candidates, and admin_confirm_menu_scan to no longer read/write
-- these columns) and AFTER the Phase 2 edge functions + Phase 3–6 app code are
-- deployed (none of them reference these columns anymore).
--
-- What this drops and why it is safe:
--   * dishes.allergens / dishes.dietary_tags — nullable text[] DEFAULT '{}'.
--     Direct-write-only since migration 151 retired the ingredient triggers;
--     the only writers (worker, admin, web-portal) were removed in Phases 2/4/5/6.
--   * options.adds_allergens / removes_dietary_tags / adds_dietary_tags
--     (text[] NOT NULL DEFAULT '{}', added in migration 140) — the worker no
--     longer emits them, the editors no longer expose them, and migration 155
--     dropped them from generate_candidates' modifier JSONB.
--   * user_preferences.allergies / diet_types / religious_restrictions /
--     preferred_dietary_tags — no edge function or app reads them anymore
--     (feed reads only spice_tolerance/favorite_cuisines; group-recommendations
--     reads only diet_preference/exclude). diet_preference + exclude are KEPT.
--   * Lookup/vocabulary tables allergens, dietary_tags, and the junction
--     canonical_ingredient_dietary_tags — fully orphaned. The ingredient
--     pipeline retirement (migration 152) dropped canonical_ingredient_allergens
--     and the ingredient tables but missed these three; nothing references them
--     now (the dish-level system that mirrored them is gone). Approved as a
--     clean-sweep finish to 152's gap.
--
-- Pre-apply checklist:
--   1. Migration 155 applied.
--   2. Phase 2 edge functions deployed; Phase 3–6 app code shipped.
--   3. After applying, regenerate types:
--        supabase gen types typescript --linked > packages/database/src/types.ts
--
-- Reverse: 156_REVERSE_ONLY_drop_dietary_allergen_columns.sql re-adds the
-- columns (with their original defaults) and recreates the three tables. Note:
-- this restores SCHEMA only — the dropped data (all empty/default in practice)
-- is not recoverable.

BEGIN;

-- ── (1) Dish-level columns ─────────────────────────────────────────────────
ALTER TABLE public.dishes
  DROP COLUMN IF EXISTS allergens,
  DROP COLUMN IF EXISTS dietary_tags;

-- ── (2) Option-level modifier columns ──────────────────────────────────────
ALTER TABLE public.options
  DROP COLUMN IF EXISTS adds_allergens,
  DROP COLUMN IF EXISTS removes_dietary_tags,
  DROP COLUMN IF EXISTS adds_dietary_tags;

-- ── (3) User-preference columns (KEEP diet_preference + exclude) ────────────
ALTER TABLE public.user_preferences
  DROP COLUMN IF EXISTS allergies,
  DROP COLUMN IF EXISTS diet_types,
  DROP COLUMN IF EXISTS religious_restrictions,
  DROP COLUMN IF EXISTS preferred_dietary_tags;

-- ── (4) Orphaned lookup/vocabulary tables ──────────────────────────────────
-- Junction first (FK → dietary_tags), then the two lookup tables. CASCADE is a
-- belt-and-suspenders guard; there should be no remaining dependents.
DROP TABLE IF EXISTS public.canonical_ingredient_dietary_tags CASCADE;
DROP TABLE IF EXISTS public.dietary_tags                      CASCADE;
DROP TABLE IF EXISTS public.allergens                         CASCADE;

COMMIT;
