-- 049_spice_level_to_text_enum.sql
-- Created: 2026-03-18
--
-- Migrates dishes.spice_level from SMALLINT (0, 1, 3) to a TEXT enum
-- ('none', 'mild', 'hot'). This aligns the DB column type with the mobile
-- filterStore enum and removes the need for numeric→string mapping in code.
--
-- Mapping:
--   0         → 'none'
--   1         → 'mild'
--   3         → 'hot'
--   NULL      → NULL (preserved)
--   any other → 'none' (defensive fallback)

ALTER TABLE dishes
  ALTER COLUMN spice_level DROP DEFAULT,
  ALTER COLUMN spice_level TYPE TEXT
    USING CASE
      WHEN spice_level = 0 THEN 'none'
      WHEN spice_level = 1 THEN 'mild'
      WHEN spice_level = 3 THEN 'hot'
      ELSE 'none'
    END;

ALTER TABLE dishes
  ALTER COLUMN spice_level SET DEFAULT 'none',
  ADD CONSTRAINT dishes_spice_level_check
    CHECK (spice_level IN ('none', 'mild', 'hot'));
