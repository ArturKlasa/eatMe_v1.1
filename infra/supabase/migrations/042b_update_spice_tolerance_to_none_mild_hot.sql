-- Migration 042: Update user_preferences.spice_tolerance from yes/no to none/mild/hot
--
-- New semantics (aligns with dish spice_level 0/1/3):
--   'none' = doesn't like spice     (was 'no')
--   'mild' = tolerates mild spice   (was 'yes' - conservative mapping)
--   'hot'  = loves very spicy food  (new option)

-- Step 1: Normalise existing data
UPDATE user_preferences SET spice_tolerance = 'none' WHERE spice_tolerance = 'no';
UPDATE user_preferences SET spice_tolerance = 'mild' WHERE spice_tolerance = 'yes';
-- Any other stale values become 'none'
UPDATE user_preferences
  SET spice_tolerance = 'none'
  WHERE spice_tolerance NOT IN ('none', 'mild', 'hot');

-- Step 2: Drop the old constraint
DO $$
DECLARE
  r RECORD;
BEGIN
  FOR r IN (
    SELECT conname
    FROM pg_constraint
    WHERE conrelid = 'user_preferences'::regclass
      AND conname LIKE '%spice%'
  ) LOOP
    EXECUTE 'ALTER TABLE user_preferences DROP CONSTRAINT IF EXISTS ' || quote_ident(r.conname);
  END LOOP;
END $$;

-- Step 3: Update default and add new constraint
ALTER TABLE user_preferences
  ALTER COLUMN spice_tolerance SET DEFAULT 'none';

ALTER TABLE user_preferences
  ADD CONSTRAINT user_preferences_spice_tolerance_check
  CHECK (spice_tolerance IN ('none', 'mild', 'hot'));
