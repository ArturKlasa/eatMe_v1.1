-- 173_drop_ingredient_tables_restrict.sql
-- Created: 2026-06-20
--
-- Phase C ingredient-pipeline TABLE teardown (DEBT-02).
--
-- SUPERSEDES 152_drop_ingredient_pipeline.sql. 152 dropped the same table set
-- using the cascade mechanism, which violates SC2: cascading silently swallows
-- any unknown dependent (a forgotten view, FK, or function). This migration uses
-- RESTRICT on every drop so an unexpected dependent makes the drop FAIL LOUDLY
-- instead of cascading into it. Apply this, not 152.
--
-- Tables are dropped child-to-parent (see RESEARCH §"Provably-safe RESTRICT
-- child→parent DROP order") so each RESTRICT succeeds without needing a cascade.
-- All drops are IF EXISTS-guarded so the migration is idempotent whether or not
-- 152 (or any partial teardown) already ran.
--
-- FK-sever carve-out (RESEARCH Pitfall 2): `options.canonical_ingredient_id`'s
-- FK points INTO `canonical_ingredients`, so the column MUST be severed before
-- the table can drop under RESTRICT. That sever is the FIRST DDL statement below.
-- The remaining dead `dishes.*_override` columns are dropped separately in 174.
--
-- Pre-apply checklist (operator):
--   1. Run the LIVE-STATE PROBE + pg_depend DEPENDENCY-AUDIT (06-RESEARCH audit
--      query) and confirm `external_fks_into_set` AND `dependent_objects` are
--      EMPTY. A non-empty result means an unknown dependent exists — resolve it
--      before applying (RESTRICT would reject the drop anyway).
--   2. Confirm migration 172 (ingredient_archive snapshot) has LANDED:
--        SELECT table_name FROM information_schema.tables WHERE table_schema = 'ingredient_archive';
--
-- Reverse: 173_REVERSE_ONLY_drop_ingredient_tables_restrict.sql restores SCHEMA
-- structure only. The dropped data is restored manually from
-- `ingredient_archive.<t>` via `INSERT ... SELECT` (never baked into the reverse).

BEGIN;

-- ── (1) FK sever — MUST precede the canonical_ingredients drop ───────────────
-- options.canonical_ingredient_id FK points into canonical_ingredients; sever it
-- so canonical_ingredients can drop under RESTRICT (carve-out, not the dead-column
-- cleanup — the dishes.*_override columns are handled in 174).
ALTER TABLE public.options DROP COLUMN IF EXISTS canonical_ingredient_id;

-- ── (2) Child-to-parent RESTRICT table drops (RESTRICT only, never cascading) ─
DROP TABLE IF EXISTS public.variant_translations              RESTRICT;
DROP TABLE IF EXISTS public.concept_translations              RESTRICT;
DROP TABLE IF EXISTS public.ingredient_aliases_v2             RESTRICT;
DROP TABLE IF EXISTS public.ingredient_variants              RESTRICT;
DROP TABLE IF EXISTS public.canonical_ingredient_dietary_tags RESTRICT;  -- if present; 156 may have dropped it
DROP TABLE IF EXISTS public.canonical_ingredient_allergens   RESTRICT;
DROP TABLE IF EXISTS public.ingredient_aliases               RESTRICT;
DROP TABLE IF EXISTS public.dish_ingredients                 RESTRICT;
DROP TABLE IF EXISTS public.ingredient_concepts              RESTRICT;
DROP TABLE IF EXISTS public.canonical_ingredients            RESTRICT;

COMMIT;
