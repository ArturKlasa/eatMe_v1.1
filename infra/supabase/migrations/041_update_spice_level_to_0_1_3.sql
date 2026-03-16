-- Migration 041: Update dish spice_level constraint from 0–4 to 0/1/3
--
-- New semantics:
--   0 = no spice    (no chilli icon)
--   1 = spicy       (one chilli  🌶️)
--   3 = very spicy  (three chilli 🌶️🌶️🌶️)
--
-- Old values 2 and 4 are normalised before the constraint is changed.

-- Step 1: Normalise any existing data
--   Old "2 (medium)" → 1 (one chilli)
--   Old "4 (extra hot)" → 3 (three chilli)
UPDATE dishes SET spice_level = 1 WHERE spice_level = 2;
UPDATE dishes SET spice_level = 3 WHERE spice_level = 4;

-- Step 2: Drop the old range constraint
DO $$
DECLARE
  r RECORD;
BEGIN
  FOR r IN (
    SELECT conname
    FROM pg_constraint
    WHERE conrelid = 'dishes'::regclass
      AND conname LIKE '%spice%'
  ) LOOP
    EXECUTE 'ALTER TABLE dishes DROP CONSTRAINT IF EXISTS ' || quote_ident(r.conname);
  END LOOP;
END $$;

-- Step 3: Add the new enumerated constraint
ALTER TABLE dishes
  ADD CONSTRAINT dishes_spice_level_check
  CHECK (spice_level IS NULL OR spice_level IN (0, 1, 3));
