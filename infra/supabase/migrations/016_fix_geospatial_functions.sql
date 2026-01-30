-- Fix Geospatial Functions - Column Name Correction
-- Created: 2026-01-29
-- Description: Fix cuisine column name (should be cuisine_types array, not cuisine text)

-- ============================================================================
-- DROP OLD FUNCTIONS (required when changing return types)
-- ============================================================================

DROP FUNCTION IF EXISTS restaurants_within_radius(FLOAT, FLOAT, FLOAT);
DROP FUNCTION IF EXISTS dishes_within_radius(FLOAT, FLOAT, FLOAT, INTEGER);
DROP FUNCTION IF EXISTS get_nearest_restaurants(FLOAT, FLOAT, INTEGER);

-- ============================================================================
-- FIX: restaurants_within_radius function
-- ============================================================================

CREATE FUNCTION restaurants_within_radius(
  p_lat FLOAT,
  p_lng FLOAT,
  p_radius_km FLOAT
)
RETURNS TABLE(
  id UUID,
  name TEXT,
  cuisine_types TEXT[], -- Fixed: changed from cuisine TEXT to cuisine_types TEXT[]
  rating NUMERIC, -- Fixed: changed from FLOAT to match database column type
  distance_km FLOAT
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    r.id,
    r.name,
    r.cuisine_types, -- Fixed: changed from r.cuisine
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
    p_radius_km * 1000
  )
  ORDER BY distance_km;
END;
$$ LANGUAGE plpgsql STABLE;

-- ============================================================================
-- FIX: dishes_within_radius function
-- ============================================================================

CREATE FUNCTION dishes_within_radius(
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
  restaurant_cuisine_types TEXT[], -- Fixed: changed from restaurant_cuisine
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
    r.cuisine_types AS restaurant_cuisine_types, -- Fixed: changed from r.cuisine
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

-- ============================================================================
-- FIX: get_nearest_restaurants function
-- ============================================================================

CREATE FUNCTION get_nearest_restaurants(
  p_lat FLOAT,
  p_lng FLOAT,
  p_limit INTEGER DEFAULT 20
)
RETURNS TABLE(
  id UUID,
  name TEXT,
  cuisine_types TEXT[], -- Fixed: changed from cuisine TEXT
  rating NUMERIC, -- Fixed: changed from FLOAT to match database column type
  distance_km FLOAT
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    r.id,
    r.name,
    r.cuisine_types, -- Fixed: changed from r.cuisine
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

-- ============================================================================
-- SUCCESS MESSAGE
-- ============================================================================

DO $$ 
BEGIN
  RAISE NOTICE '========================================';
  RAISE NOTICE 'Geospatial Functions Fixed!';
  RAISE NOTICE '========================================';
  RAISE NOTICE 'Changes:';
  RAISE NOTICE '  ✓ Fixed restaurants_within_radius (cuisine → cuisine_types)';
  RAISE NOTICE '  ✓ Fixed dishes_within_radius (cuisine → cuisine_types)';
  RAISE NOTICE '  ✓ Fixed get_nearest_restaurants (cuisine → cuisine_types)';
  RAISE NOTICE '========================================';
END $$;
