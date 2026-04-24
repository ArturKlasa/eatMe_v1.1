-- Reverse migration 116c
DROP FUNCTION IF EXISTS get_admin_restaurants(text, text, boolean, text, int, int);
DROP INDEX IF EXISTS idx_restaurants_name_trgm;
