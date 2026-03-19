-- 052_drop_dining_occasions.sql
-- Created: 2026-03-19
--
-- Drops user_preferences.dining_occasions.
-- The column was added in migration 022 and converted to JSONB in 024,
-- but was never wired into any application code path or feed algorithm.
-- Removing it eliminates dead schema and prevents future confusion.

ALTER TABLE user_preferences DROP COLUMN IF EXISTS dining_occasions;
