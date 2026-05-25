-- 147_REVERSE_ONLY_restaurants_currency_code.sql
-- Reverses 147_restaurants_currency_code.sql.
--
-- WARNING: Drops the currency_code column. Restaurant prices revert to the
-- pre-147 status quo (mobile renders with hard-coded '$' from device locale).

BEGIN;

ALTER TABLE public.restaurants DROP CONSTRAINT IF EXISTS restaurants_currency_code_valid;
ALTER TABLE public.restaurants DROP COLUMN IF EXISTS currency_code;

COMMIT;
