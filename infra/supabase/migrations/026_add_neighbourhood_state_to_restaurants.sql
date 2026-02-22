-- Add neighbourhood and state columns to restaurants table
-- These are populated via reverse geocoding when a location is pinned on the map.

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'restaurants' AND column_name = 'neighbourhood'
  ) THEN
    ALTER TABLE restaurants ADD COLUMN neighbourhood TEXT;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'restaurants' AND column_name = 'state'
  ) THEN
    ALTER TABLE restaurants ADD COLUMN state TEXT;
  END IF;
END $$;
