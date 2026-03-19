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

-- Step 1: Drop default and any existing CHECK constraint on the column
--         (the SMALLINT version was an anonymous constraint auto-named
--          dishes_spice_level_check by Postgres; drop idempotently).
ALTER TABLE dishes ALTER COLUMN spice_level DROP DEFAULT;
ALTER TABLE dishes DROP CONSTRAINT IF EXISTS dishes_spice_level_check;

-- Step 2: Change column type.
--   Cast via ::text so the CASE branches work whether the column is still
--   SMALLINT (Postgres casts 0→'0', 1→'1', 3→'3') OR already TEXT (if
--   a prior partial run converted it).  NULL::text = NULL, so NULLs pass
--   through the CASE untouched and are preserved as NULL.
ALTER TABLE dishes
  ALTER COLUMN spice_level TYPE TEXT
    USING CASE spice_level::text
      WHEN '0'    THEN 'none'
      WHEN '1'    THEN 'mild'
      WHEN '3'    THEN 'hot'
      WHEN 'none' THEN 'none'   -- idempotent: already migrated
      WHEN 'mild' THEN 'mild'
      WHEN 'hot'  THEN 'hot'
      ELSE NULL                 -- unknown value → NULL (safe default)
    END;

-- Step 3: Re-apply default and add the new CHECK constraint.
ALTER TABLE dishes
  ALTER COLUMN spice_level SET DEFAULT 'none',
  ADD CONSTRAINT dishes_spice_level_check
    CHECK (spice_level IS NULL OR spice_level IN ('none', 'mild', 'hot'));
