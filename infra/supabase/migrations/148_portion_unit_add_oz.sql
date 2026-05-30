-- 148_portion_unit_add_oz.sql
-- Created: 2026-05-30
--
-- Add 'oz' (ounces) to the allowed dishes.portion_unit values.
--
-- US/UK menus state portions in ounces ("8 oz steak", "12oz draft"). Unlike
-- kg/L (which the extractor normalizes to g/ml), ounces are stored as-is so the
-- mobile app can render "8 oz" verbatim — there's no metric base unit to fold
-- them into without losing the imperial label.
--
-- Only the value-check changes; column types and the both-or-neither pairing
-- constraint (dishes_portion_both_or_neither, from migration 145) are untouched.
--
-- Reverse: 148_REVERSE_ONLY_portion_unit_add_oz.sql (rejects if any 'oz' rows
-- still exist).

BEGIN;

ALTER TABLE public.dishes
  DROP CONSTRAINT dishes_portion_unit_valid,
  ADD CONSTRAINT dishes_portion_unit_valid
    CHECK (portion_unit IS NULL OR portion_unit IN ('g', 'ml', 'pcs', 'oz'));

COMMENT ON COLUMN public.dishes.portion_unit IS
  'Unit for portion_amount: g | ml | pcs | oz. NULL when not on the menu. Paired with portion_amount via CHECK constraint.';

COMMIT;
