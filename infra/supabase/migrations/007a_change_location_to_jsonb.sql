-- Change location column from PostGIS geometry to JSONB
-- Created: 2026-01-20
-- Description: Convert location storage from PostGIS binary to JSON for better mobile app compatibility

-- ============================================================================
-- CONVERT LOCATION COLUMN TO JSONB
-- ============================================================================

-- Step 1: Add new location_json column
ALTER TABLE restaurants ADD COLUMN IF NOT EXISTS location_json JSONB;

-- Step 2: Migrate existing data from geometry to JSON
-- Extract coordinates from PostGIS POINT and store as {lat, lng}
UPDATE restaurants
SET location_json = jsonb_build_object(
  'lat', ST_Y(location::geometry),
  'lng', ST_X(location::geometry)
)
WHERE location IS NOT NULL AND location_json IS NULL;

-- Step 3: Drop old geometry column and rename
ALTER TABLE restaurants DROP COLUMN IF EXISTS location CASCADE;
ALTER TABLE restaurants RENAME COLUMN location_json TO location;

-- Step 4: Add NOT NULL constraint
ALTER TABLE restaurants ALTER COLUMN location SET NOT NULL;

-- Step 5: Create index on location for faster queries
CREATE INDEX IF NOT EXISTS restaurants_location_idx ON restaurants USING GIN (location);

-- ============================================================================
-- SUCCESS MESSAGE
-- ============================================================================
DO $$ 
BEGIN
  RAISE NOTICE '========================================';
  RAISE NOTICE 'Location column converted to JSONB!';
  RAISE NOTICE '========================================';
  RAISE NOTICE 'Changes made:';
  RAISE NOTICE '  ✓ Converted location from geometry to JSONB';
  RAISE NOTICE '  ✓ Format: {lat: number, lng: number}';
  RAISE NOTICE '  ✓ Created GIN index for faster queries';
  RAISE NOTICE '  ✓ All existing data migrated';
  RAISE NOTICE '========================================';
END $$;
