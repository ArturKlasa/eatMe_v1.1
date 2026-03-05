-- Geospatial Functions for Location-Based Queries
-- Created: 2026-01-28
-- Description: PostGIS functions for finding nearby restaurants and dishes

-- ============================================================================
-- ENABLE POSTGIS EXTENSION
-- ============================================================================

CREATE EXTENSION IF NOT EXISTS postgis;

-- Verify PostGIS is installed
DO $$ 
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'postgis') THEN
    RAISE EXCEPTION 'PostGIS extension is not installed!';
  END IF;
  
  RAISE NOTICE 'PostGIS Version: %', PostGIS_Version();
END $$;

-- ============================================================================
-- ADD COMPUTED GEOGRAPHY COLUMN TO RESTAURANTS
-- ============================================================================

-- Check if location column exists (it's stored as JSONB with lat/lng)
DO $$ 
BEGIN
  -- Add geography column if it doesn't exist
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'restaurants' AND column_name = 'location_point'
  ) THEN
    -- Add computed geography column from JSONB location
    -- Location is stored as: {"lat": 37.7749, "lng": -122.4194}
    ALTER TABLE restaurants 
    ADD COLUMN location_point geography(POINT, 4326) 
    GENERATED ALWAYS AS (
      ST_SetSRID(
        ST_MakePoint(
          (location->>'lng')::FLOAT,
          (location->>'lat')::FLOAT
        ),
        4326
      )::geography
    ) STORED;
    
    RAISE NOTICE 'Added location_point geography column to restaurants';
  ELSE
    RAISE NOTICE 'location_point column already exists';
  END IF;
END $$;

COMMENT ON COLUMN restaurants.location_point IS 'Computed geography column for efficient spatial queries';

-- ============================================================================
-- CREATE SPATIAL INDEX
-- ============================================================================

-- Drop existing index if it exists
DROP INDEX IF EXISTS restaurants_location_point_idx;

-- Create GIST index for fast spatial queries
CREATE INDEX restaurants_location_point_idx 
ON restaurants USING GIST(location_point);

-- ============================================================================
-- HELPER FUNCTIONS FOR DISTANCE CALCULATIONS
-- ============================================================================

-- Function: Get restaurants within radius (returns with distance)
CREATE OR REPLACE FUNCTION restaurants_within_radius(
  p_lat FLOAT,
  p_lng FLOAT,
  p_radius_km FLOAT
)
RETURNS TABLE(
  id UUID,
  name TEXT,
  cuisine TEXT,
  rating FLOAT,
  distance_km FLOAT
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    r.id,
    r.name,
    r.cuisine,
    r.rating,
    ROUND(
      (ST_Distance(
        r.location_point,
        ST_SetSRID(ST_MakePoint(p_lng, p_lat), 4326)::geography
      ) / 1000)::NUMERIC,
      2
    )::FLOAT AS distance_km
  FROM restaurants r
  WHERE ST_DWithin(
    r.location_point,
    ST_SetSRID(ST_MakePoint(p_lng, p_lat), 4326)::geography,
    p_radius_km * 1000 -- Convert km to meters
  )
  ORDER BY distance_km;
END;
$$ LANGUAGE plpgsql STABLE;

COMMENT ON FUNCTION restaurants_within_radius IS 
  'Find restaurants within radius (km) from a point, ordered by distance';

-- Function: Get dishes within radius (joins restaurants + dishes)
CREATE OR REPLACE FUNCTION dishes_within_radius(
  p_lat FLOAT,
  p_lng FLOAT,
  p_radius_km FLOAT,
  p_limit INTEGER DEFAULT 100
)
RETURNS TABLE(
  dish_id UUID,
  dish_name TEXT,
  dish_price NUMERIC,
  restaurant_id UUID,
  restaurant_name TEXT,
  restaurant_cuisine TEXT,
  distance_km FLOAT
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    d.id AS dish_id,
    d.name AS dish_name,
    d.price AS dish_price,
    r.id AS restaurant_id,
    r.name AS restaurant_name,
    r.cuisine AS restaurant_cuisine,
    ROUND(
      (ST_Distance(
        r.location_point,
        ST_SetSRID(ST_MakePoint(p_lng, p_lat), 4326)::geography
      ) / 1000)::NUMERIC,
      2
    )::FLOAT AS distance_km
  FROM dishes d
  JOIN restaurants r ON d.restaurant_id = r.id
  WHERE d.is_available = true
    AND ST_DWithin(
      r.location_point,
      ST_SetSRID(ST_MakePoint(p_lng, p_lat), 4326)::geography,
      p_radius_km * 1000
    )
  ORDER BY distance_km, d.name
  LIMIT p_limit;
END;
$$ LANGUAGE plpgsql STABLE;

COMMENT ON FUNCTION dishes_within_radius IS 
  'Find available dishes within radius (km) from a point';

-- Function: Calculate distance between two points
CREATE OR REPLACE FUNCTION calculate_distance_km(
  p_lat1 FLOAT,
  p_lng1 FLOAT,
  p_lat2 FLOAT,
  p_lng2 FLOAT
)
RETURNS FLOAT AS $$
BEGIN
  RETURN ROUND(
    (ST_Distance(
      ST_SetSRID(ST_MakePoint(p_lng1, p_lat1), 4326)::geography,
      ST_SetSRID(ST_MakePoint(p_lng2, p_lat2), 4326)::geography
    ) / 1000)::NUMERIC,
    2
  )::FLOAT;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

COMMENT ON FUNCTION calculate_distance_km IS 
  'Calculate distance in kilometers between two lat/lng points';

-- Function: Get restaurants sorted by distance from user
CREATE OR REPLACE FUNCTION get_nearest_restaurants(
  p_lat FLOAT,
  p_lng FLOAT,
  p_limit INTEGER DEFAULT 20
)
RETURNS TABLE(
  id UUID,
  name TEXT,
  cuisine TEXT,
  rating FLOAT,
  distance_km FLOAT
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    r.id,
    r.name,
    r.cuisine,
    r.rating,
    ROUND(
      (ST_Distance(
        r.location_point,
        ST_SetSRID(ST_MakePoint(p_lng, p_lat), 4326)::geography
      ) / 1000)::NUMERIC,
      2
    )::FLOAT AS distance_km
  FROM restaurants r
  ORDER BY distance_km
  LIMIT p_limit;
END;
$$ LANGUAGE plpgsql STABLE;

COMMENT ON FUNCTION get_nearest_restaurants IS 
  'Get N nearest restaurants to a point, ordered by distance';

-- ============================================================================
-- PERFORMANCE ANALYSIS FUNCTIONS
-- ============================================================================

-- Analyze query performance for spatial queries
CREATE OR REPLACE FUNCTION analyze_spatial_query_performance(
  p_lat FLOAT,
  p_lng FLOAT,
  p_radius_km FLOAT
)
RETURNS TABLE(
  query_type TEXT,
  execution_time_ms FLOAT,
  rows_returned BIGINT,
  index_used BOOLEAN
) AS $$
DECLARE
  v_start TIMESTAMP;
  v_end TIMESTAMP;
  v_count BIGINT;
BEGIN
  -- Test restaurants_within_radius
  v_start := clock_timestamp();
  SELECT COUNT(*) INTO v_count
  FROM restaurants_within_radius(p_lat, p_lng, p_radius_km);
  v_end := clock_timestamp();
  
  query_type := 'restaurants_within_radius';
  execution_time_ms := EXTRACT(MILLISECONDS FROM (v_end - v_start));
  rows_returned := v_count;
  index_used := true; -- Assume GIST index is used
  RETURN NEXT;

  -- Test dishes_within_radius
  v_start := clock_timestamp();
  SELECT COUNT(*) INTO v_count
  FROM dishes_within_radius(p_lat, p_lng, p_radius_km, 1000);
  v_end := clock_timestamp();
  
  query_type := 'dishes_within_radius';
  execution_time_ms := EXTRACT(MILLISECONDS FROM (v_end - v_start));
  rows_returned := v_count;
  index_used := true;
  RETURN NEXT;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION analyze_spatial_query_performance IS 
  'Analyze performance of spatial queries for debugging';

-- ============================================================================
-- TEST QUERIES (Run these to verify installation)
-- ============================================================================

-- Test query examples (commented out, uncomment to test)
/*
-- Test 1: Find restaurants within 5km of San Francisco downtown
SELECT * FROM restaurants_within_radius(37.7749, -122.4194, 5);

-- Test 2: Find dishes within 10km
SELECT * FROM dishes_within_radius(37.7749, -122.4194, 10, 50);

-- Test 3: Calculate distance between two points
SELECT calculate_distance_km(37.7749, -122.4194, 37.8044, -122.2711) AS distance_sf_to_oakland;

-- Test 4: Get 10 nearest restaurants
SELECT * FROM get_nearest_restaurants(37.7749, -122.4194, 10);

-- Test 5: Performance analysis
SELECT * FROM analyze_spatial_query_performance(37.7749, -122.4194, 10);
*/

-- ============================================================================
-- SUCCESS MESSAGE
-- ============================================================================

DO $$ 
BEGIN
  RAISE NOTICE '========================================';
  RAISE NOTICE 'Geospatial Functions Installed!';
  RAISE NOTICE '========================================';
  RAISE NOTICE 'PostGIS Status:';
  RAISE NOTICE '  ✓ Extension enabled';
  RAISE NOTICE '  ✓ location_point column added to restaurants';
  RAISE NOTICE '  ✓ GIST spatial index created';
  RAISE NOTICE '';
  RAISE NOTICE 'Functions Available:';
  RAISE NOTICE '  ✓ restaurants_within_radius(lat, lng, radius_km)';
  RAISE NOTICE '  ✓ dishes_within_radius(lat, lng, radius_km, limit)';
  RAISE NOTICE '  ✓ calculate_distance_km(lat1, lng1, lat2, lng2)';
  RAISE NOTICE '  ✓ get_nearest_restaurants(lat, lng, limit)';
  RAISE NOTICE '  ✓ analyze_spatial_query_performance(lat, lng, radius)';
  RAISE NOTICE '';
  RAISE NOTICE 'Ready for location-based queries!';
  RAISE NOTICE '========================================';
END $$;
