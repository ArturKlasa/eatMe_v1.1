-- 148_REVERSE_ONLY_portion_unit_add_oz.sql
-- Reverses 148_portion_unit_add_oz.sql.
--
-- Restores the g | ml | pcs value-check. Fails if any dishes still use
-- portion_unit = 'oz' (those rows would violate the restored CHECK) — re-point
-- or clear them before reversing.

BEGIN;

ALTER TABLE public.dishes
  DROP CONSTRAINT dishes_portion_unit_valid,
  ADD CONSTRAINT dishes_portion_unit_valid
    CHECK (portion_unit IS NULL OR portion_unit IN ('g', 'ml', 'pcs'));

COMMENT ON COLUMN public.dishes.portion_unit IS
  'Unit for portion_amount: g | ml | pcs. NULL when not on the menu. Paired with portion_amount via CHECK constraint.';

COMMIT;
