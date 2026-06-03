-- 149_REVERSE_ONLY_restaurants_timezone.sql
-- Reverse of 149_restaurants_timezone.sql — drops the restaurants.timezone column.
--
-- Safe to run only after the feed Edge Function is rolled back to a build that no
-- longer selects `timezone` (it tolerates a null/absent value via the
-- country_code fallback, but dropping the column while the new feed references it
-- by name in a select would error).

BEGIN;

ALTER TABLE public.restaurants
  DROP COLUMN IF EXISTS timezone;

COMMIT;
