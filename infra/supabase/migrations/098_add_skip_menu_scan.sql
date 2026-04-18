-- Migration 098: Skip Menu Scan flag
-- Created: 2026-04-17
-- Description:
--   Adds a boolean flag to restaurants so admins can mark a restaurant as
--   not needing a menu scan. Such restaurants are filtered out of the
--   "Restaurants needing menus" list in the admin menu-scan tool.
--
--   This is purely an admin workflow flag — it does not affect whether the
--   restaurant is shown to consumers. For consumer-facing suspension use
--   is_active / suspended_at.

ALTER TABLE public.restaurants
  ADD COLUMN skip_menu_scan boolean NOT NULL DEFAULT false;

CREATE INDEX idx_restaurants_skip_menu_scan
  ON public.restaurants (skip_menu_scan)
  WHERE skip_menu_scan = true;

DO $$
BEGIN
  RAISE NOTICE '========================================';
  RAISE NOTICE 'Migration 098: skip_menu_scan column added to restaurants';
  RAISE NOTICE '========================================';
END $$;
