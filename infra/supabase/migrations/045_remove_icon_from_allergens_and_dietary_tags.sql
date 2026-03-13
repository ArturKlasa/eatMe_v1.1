-- 041_remove_icon_from_allergens_and_dietary_tags.sql
-- Created: 2026-03-13
-- Description: Remove the `icon` column from the allergens and dietary_tags tables.
--              Icons are a display-layer concern and must be defined in each client
--              app (mobile constants, web portal constants) — not stored in the DB.
--              See apps/mobile/src/constants/icons.ts and
--                  apps/web-portal/lib/icons.ts for the authoritative icon maps.

ALTER TABLE allergens     DROP COLUMN IF EXISTS icon;
ALTER TABLE dietary_tags  DROP COLUMN IF EXISTS icon;
