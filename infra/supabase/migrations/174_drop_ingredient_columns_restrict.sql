-- 174_drop_ingredient_columns_restrict.sql
-- Created: 2026-06-20
--
-- Phase C ingredient-pipeline dead-COLUMN teardown (DEBT-02).
--
-- Drops the two dead ingredient-pipeline override columns on `dishes`:
--   * dishes.allergens_override
--   * dishes.dietary_tags_override
-- The trigger that maintained them (`dishes_override_refresh`) is dropped by
-- migration 171 (reconciled Phase B). Since then both columns have been
-- direct-default-only and empty — nothing reads or writes them.
--
-- NOTE: the options FK column into canonical_ingredients is NOT dropped here. It
-- was severed as the FIRST statement of migration 173 because that FK blocks the
-- `canonical_ingredients` table drop under RESTRICT (the documented carve-out,
-- RESEARCH Pitfall 2). This migration only handles the dead dishes.*_override
-- columns.
--
-- Both drops are IF EXISTS-guarded (idempotent). No cascading dependents exist.
--
-- Pre-apply checklist: apply AFTER migration 173.
--
-- Reverse: 174_REVERSE_ONLY_drop_ingredient_columns_restrict.sql re-adds both
-- columns with their original text[] defaults (SCHEMA only — the columns were
-- always empty/default, so no data restore is meaningful).

BEGIN;

ALTER TABLE public.dishes
  DROP COLUMN IF EXISTS allergens_override,
  DROP COLUMN IF EXISTS dietary_tags_override;

COMMIT;
