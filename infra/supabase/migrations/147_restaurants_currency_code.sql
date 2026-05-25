-- 147_restaurants_currency_code.sql
-- Created: 2026-05-25
--
-- Add currency_code column to restaurants.
--
-- Until now, every price in the app was rendered with a hard-coded '$' prefix
-- on the mobile side, sourced from device locale rather than the restaurant.
-- A Polish restaurant uploading a "25 zł" menu would show up as "$25.00" to a
-- US tourist's phone — wrong symbol AND wrong amount.
--
-- This column makes currency a per-restaurant fact (standard for food apps),
-- formatted via Intl.NumberFormat in the consuming code. Both the admin
-- review screen and the mobile feed read this single value.
--
-- NOT NULL DEFAULT 'USD' so every row always has a usable value — mobile
-- never needs a null branch. CHECK regex enforces ISO 4217 shape (three
-- uppercase letters); enum is intentionally NOT used so adding a 13th
-- currency later requires no migration, only an app-layer code change.
--
-- Backfill: for each row, derive currency from country_code via the same
-- map that lives in TypeScript (packages/shared/src/logic/currency.ts).
-- The 25-country list MUST stay in lockstep with COUNTRY_TO_CURRENCY in
-- the shared module — divergence would mean a backend-derived currency
-- disagreeing with the frontend's idea of "what country implies what
-- currency". Unmapped country codes fall through to the DEFAULT 'USD'.
--
-- No index — currency_code is read with every restaurant fetch (always
-- on the hot path via primary-key lookup) but never filtered/sorted on.
--
-- Reverse: 147_REVERSE_ONLY_restaurants_currency_code.sql.

BEGIN;

ALTER TABLE public.restaurants
  ADD COLUMN IF NOT EXISTS currency_code text NOT NULL DEFAULT 'USD';

ALTER TABLE public.restaurants
  ADD CONSTRAINT restaurants_currency_code_valid
    CHECK (currency_code ~ '^[A-Z]{3}$');

-- Backfill from country_code for the 25 mapped countries.
-- Must match COUNTRY_TO_CURRENCY in packages/shared/src/logic/currency.ts.
UPDATE public.restaurants SET currency_code = CASE
  WHEN UPPER(country_code) IN ('US','EC','SV','PA') THEN 'USD'
  WHEN UPPER(country_code) IN ('DE','ES','FR','IT','PT','NL','BE','AT','GR','IE','FI') THEN 'EUR'
  WHEN UPPER(country_code) = 'PL' THEN 'PLN'
  WHEN UPPER(country_code) = 'GB' THEN 'GBP'
  WHEN UPPER(country_code) = 'MX' THEN 'MXN'
  WHEN UPPER(country_code) = 'CA' THEN 'CAD'
  WHEN UPPER(country_code) = 'AU' THEN 'AUD'
  WHEN UPPER(country_code) = 'BR' THEN 'BRL'
  WHEN UPPER(country_code) = 'JP' THEN 'JPY'
  WHEN UPPER(country_code) = 'CO' THEN 'COP'
  WHEN UPPER(country_code) = 'AR' THEN 'ARS'
  WHEN UPPER(country_code) = 'CL' THEN 'CLP'
  ELSE 'USD'
END;

COMMENT ON COLUMN public.restaurants.currency_code IS
  'ISO 4217 currency code (e.g. USD, EUR, PLN). NOT NULL, defaults to USD. Source of truth for how this restaurant''s dish prices are formatted in admin + mobile. Supported set lives in packages/shared/src/logic/currency.ts.';

COMMIT;
