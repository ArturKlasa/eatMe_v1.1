-- 145_REVERSE_ONLY_dishes_portion_size.sql
-- Reverses 145_dishes_portion_size.sql.
--
-- WARNING: Drops the portion columns and any data persisted in them.
-- Run AFTER reverse-applying 146 (`146_REVERSE_ONLY_admin_confirm_menu_scan_portion_size.sql`)
-- so the function definition doesn't reference columns that no longer exist.

BEGIN;

ALTER TABLE public.dishes DROP CONSTRAINT IF EXISTS dishes_portion_both_or_neither;
ALTER TABLE public.dishes DROP CONSTRAINT IF EXISTS dishes_portion_unit_valid;

ALTER TABLE public.dishes DROP COLUMN IF EXISTS portion_unit;
ALTER TABLE public.dishes DROP COLUMN IF EXISTS portion_amount;

COMMIT;
