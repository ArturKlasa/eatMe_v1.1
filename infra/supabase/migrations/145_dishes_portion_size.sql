-- 145_dishes_portion_size.sql
-- Created: 2026-05-24
--
-- Add portion_amount + portion_unit columns to dishes.
--
-- Many menus already encode portion sizes in free text on dish names or
-- descriptions ("Beef Burger 250g", "Pilsner 0.5L", "Pierogi 6 szt.").
-- Lifting that into structured columns lets:
--   * the menu-scan AI extract it during the scan (migration 146 + worker prompt),
--   * the admin operator edit it in the dish row,
--   * the mobile app render it inline with the price (e.g. "250g · $12.00").
--
-- Unit enum: 'g' | 'ml' | 'pcs' (kilograms and litres get normalized to
-- their base unit by the extractor; pieces cover "X szt." / "X uds." too).
-- Both columns must be set together or both null — enforced by CHECK to
-- prevent half-filled rows reaching the consumer.
--
-- No index — we do not filter or sort by portion on either app surface.
-- If that changes, add a partial index `WHERE portion_amount IS NOT NULL`.
--
-- Existing dishes stay (null, null); no backfill — the original menu text
-- has usually been edited away by now, and re-extraction is the path
-- forward when a restaurant re-scans their menu.
--
-- Reverse: 145_REVERSE_ONLY_dishes_portion_size.sql.
-- Migration 146 re-creates admin_confirm_menu_scan to persist these
-- columns; landing 145 without 146 leaves the columns unwritten (safe).

BEGIN;

ALTER TABLE public.dishes
  ADD COLUMN IF NOT EXISTS portion_amount integer NULL,
  ADD COLUMN IF NOT EXISTS portion_unit   text    NULL;

ALTER TABLE public.dishes
  ADD CONSTRAINT dishes_portion_unit_valid
    CHECK (portion_unit IS NULL OR portion_unit IN ('g', 'ml', 'pcs')),
  ADD CONSTRAINT dishes_portion_both_or_neither
    CHECK (
      (portion_amount IS NULL AND portion_unit IS NULL)
      OR (portion_amount IS NOT NULL AND portion_unit IS NOT NULL AND portion_amount > 0)
    );

COMMENT ON COLUMN public.dishes.portion_amount IS
  'Portion size value, in base units (grams or millilitres) or piece count. NULL when not on the menu. Paired with portion_unit via CHECK constraint.';
COMMENT ON COLUMN public.dishes.portion_unit IS
  'Unit for portion_amount: g | ml | pcs. NULL when not on the menu. Paired with portion_amount via CHECK constraint.';

COMMIT;
