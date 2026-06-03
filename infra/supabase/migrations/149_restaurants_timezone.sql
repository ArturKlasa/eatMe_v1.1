-- 149_restaurants_timezone.sql
-- Created: 2026-06-02
--
-- Add a per-restaurant IANA timezone so "open now" can be evaluated in the
-- restaurant's own local time.
--
-- Why: the feed Edge Function hard-filters map dishes to restaurants open NOW
-- (feed/index.ts isOpenNow + dishPool). That check read the clock with bare
-- `new Date()`, which on the Edge runtime is UTC — but open_hours are stored in
-- the restaurant's LOCAL time. In CDMX (UTC-6) the UTC clock rolls past midnight
-- every evening, so isOpenNow marked every restaurant closed and the map showed
-- zero dishes after ~16:00 local. The fix evaluates open_hours in this column's
-- zone via Intl.DateTimeFormat.
--
-- Nullable (no NOT NULL): we can't always derive a zone, and the feed falls back
-- to country_code -> zone at runtime, then treats has-hours-but-no-zone as open.
-- No CHECK: IANA ids vary too much (one vs two slashes, "UTC") for a safe regex.
--
-- Backfill: derive from country_code via the CASE below — exact for single-zone
-- countries and for all current data (every row is CDMX -> America/Mexico_City).
-- New imports set a lat/lng-precise zone in apps/admin .../imports/actions/
-- places.ts (handles multi-zone countries). The COUNTRY_TO_TZ map is mirrored
-- inline in feed/index.ts — keep the two in lockstep. Representative zone per
-- multi-zone country (US/BR/AU/CA…); lat/lng precision overrides at import.
--
-- Reverse: 149_REVERSE_ONLY_restaurants_timezone.sql.

BEGIN;

ALTER TABLE public.restaurants
  ADD COLUMN IF NOT EXISTS timezone text;

UPDATE public.restaurants SET timezone = CASE UPPER(country_code)
  WHEN 'MX' THEN 'America/Mexico_City'
  WHEN 'US' THEN 'America/New_York'
  WHEN 'CA' THEN 'America/Toronto'
  WHEN 'BR' THEN 'America/Sao_Paulo'
  WHEN 'CO' THEN 'America/Bogota'
  WHEN 'AR' THEN 'America/Argentina/Buenos_Aires'
  WHEN 'CL' THEN 'America/Santiago'
  WHEN 'EC' THEN 'America/Guayaquil'
  WHEN 'SV' THEN 'America/El_Salvador'
  WHEN 'PA' THEN 'America/Panama'
  WHEN 'GB' THEN 'Europe/London'
  WHEN 'IE' THEN 'Europe/Dublin'
  WHEN 'PT' THEN 'Europe/Lisbon'
  WHEN 'ES' THEN 'Europe/Madrid'
  WHEN 'FR' THEN 'Europe/Paris'
  WHEN 'DE' THEN 'Europe/Berlin'
  WHEN 'IT' THEN 'Europe/Rome'
  WHEN 'NL' THEN 'Europe/Amsterdam'
  WHEN 'BE' THEN 'Europe/Brussels'
  WHEN 'AT' THEN 'Europe/Vienna'
  WHEN 'GR' THEN 'Europe/Athens'
  WHEN 'FI' THEN 'Europe/Helsinki'
  WHEN 'PL' THEN 'Europe/Warsaw'
  WHEN 'AU' THEN 'Australia/Sydney'
  WHEN 'JP' THEN 'Asia/Tokyo'
  ELSE NULL
END
WHERE timezone IS NULL;

COMMENT ON COLUMN public.restaurants.timezone IS
  'IANA timezone id (e.g. America/Mexico_City). Nullable. The feed Edge Function evaluates open_hours (stored in local time) against THIS zone via Intl. Backfilled from country_code (migration 149); new imports derive it lat/lng-precise. COUNTRY_TO_TZ is mirrored in feed/index.ts.';

COMMIT;
