-- EatMe Restaurant Portal Schema - Simplified Migration
-- Created: 2025-12-08
-- Description: Restaurant information table for web portal submission
-- Note: This is a simplified version focusing on restaurant data only (no menus/dishes yet)

-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "postgis";

-- ============================================================================
-- RESTAURANTS TABLE
-- ============================================================================

CREATE TABLE IF NOT EXISTS restaurants (
  -- Primary key
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  
  -- Basic Information
  name TEXT NOT NULL,
  restaurant_type TEXT, -- cafe, restaurant, fine_dining, food_truck, etc.
  
  -- Location (PostGIS for geospatial queries)
  location GEOGRAPHY(POINT, 4326) NOT NULL,
  address TEXT NOT NULL,
  country_code TEXT, -- US, CA, MX, PL
  city TEXT,
  postal_code TEXT,
  
  -- Contact Information
  phone TEXT,
  website TEXT,
  
  -- Cuisine Classification
  cuisine_types TEXT[] DEFAULT ARRAY[]::TEXT[], -- Italian, Mexican, Japanese, etc.
  
  -- Operating Hours (JSONB format: {monday: {open: "09:00", close: "21:00"}, ...})
  open_hours JSONB DEFAULT '{}'::jsonb,
  
  -- Service Options
  delivery_available BOOLEAN DEFAULT true,
  takeout_available BOOLEAN DEFAULT true,
  dine_in_available BOOLEAN DEFAULT true,
  accepts_reservations BOOLEAN DEFAULT false,
  
  -- Service Speed
  average_prep_time_minutes INTEGER DEFAULT 30, -- 15=fast food, 30=regular
  
  -- Future fields (for mobile app integration)
  price_level SMALLINT CHECK (price_level BETWEEN 1 AND 4), -- $, $$, $$$, $$$$
  rating NUMERIC(3, 2) DEFAULT 0.00,
  image_url TEXT,
  description TEXT,
  
  -- Metadata
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ============================================================================
-- INDEXES
-- ============================================================================

-- Spatial index for location-based queries (most important!)
CREATE INDEX IF NOT EXISTS restaurants_location_idx 
  ON restaurants USING GIST(location);

-- Performance indexes for common queries
CREATE INDEX IF NOT EXISTS restaurants_cuisine_types_idx 
  ON restaurants USING GIN(cuisine_types);

CREATE INDEX IF NOT EXISTS restaurants_country_code_idx 
  ON restaurants(country_code);

CREATE INDEX IF NOT EXISTS restaurants_city_idx 
  ON restaurants(city);

CREATE INDEX IF NOT EXISTS restaurants_restaurant_type_idx 
  ON restaurants(restaurant_type);

CREATE INDEX IF NOT EXISTS restaurants_delivery_idx 
  ON restaurants(delivery_available) 
  WHERE delivery_available = true;

CREATE INDEX IF NOT EXISTS restaurants_rating_idx 
  ON restaurants(rating DESC);

-- ============================================================================
-- ROW LEVEL SECURITY (RLS)
-- ============================================================================

-- Enable RLS on restaurants table
ALTER TABLE restaurants ENABLE ROW LEVEL SECURITY;

-- Policy: Anyone can read restaurant data (public access)
CREATE POLICY "Public read access" 
  ON restaurants 
  FOR SELECT 
  TO anon, authenticated 
  USING (true);

-- Policy: Anyone can insert restaurant data (for portal submissions)
-- Note: In production, you may want to restrict this to authenticated users
CREATE POLICY "Public insert access" 
  ON restaurants 
  FOR INSERT 
  TO anon, authenticated 
  WITH CHECK (true);

-- Policy: Only authenticated users can update their own restaurants
-- Note: Will need to add owner_id column in future for this to work properly
CREATE POLICY "Authenticated update access" 
  ON restaurants 
  FOR UPDATE 
  TO authenticated 
  USING (true) -- For now, allow all authenticated users
  WITH CHECK (true);

-- ============================================================================
-- TRIGGERS
-- ============================================================================

-- Automatically update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_restaurants_updated_at 
  BEFORE UPDATE ON restaurants
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- ============================================================================
-- SAMPLE DATA (Optional - for testing)
-- ============================================================================

-- Uncomment to insert sample restaurant
/*
INSERT INTO restaurants (
  name,
  restaurant_type,
  location,
  address,
  country_code,
  city,
  cuisine_types,
  phone,
  website,
  open_hours,
  delivery_available,
  takeout_available,
  dine_in_available,
  average_prep_time_minutes
) VALUES (
  'Sample Italian Restaurant',
  'restaurant',
  ST_GeogFromText('POINT(-74.0060 40.7128)'), -- NYC coordinates (lng, lat)
  '123 Main St, New York, NY 10001',
  'US',
  'New York',
  ARRAY['Italian', 'Pizza'],
  '+1 (555) 123-4567',
  'example.com',
  '{"monday": {"open": "11:00", "close": "22:00"}, "tuesday": {"open": "11:00", "close": "22:00"}}'::jsonb,
  true,
  true,
  true,
  30
);
*/

-- ============================================================================
-- NOTES
-- ============================================================================

-- PostGIS Geography Type:
-- - Stores lat/lng as POINT(longitude, latitude)
-- - Note the order: LONGITUDE first, then LATITUDE
-- - Example: New York = POINT(-74.0060 40.7128)
-- 
-- Querying nearby restaurants:
-- SELECT * FROM restaurants 
-- WHERE ST_DWithin(
--   location, 
--   ST_GeogFromText('POINT(-74.0060 40.7128)'), 
--   5000  -- 5000 meters = 5km radius
-- );

-- Operating Hours Format:
-- {
--   "monday": {"open": "09:00", "close": "21:00"},
--   "tuesday": {"open": "09:00", "close": "21:00"},
--   ...
-- }
-- Days without entries are considered closed

-- Cuisine Types:
-- Array of strings matching CUISINES constant in web portal
-- Examples: ["Italian", "Pizza"], ["Mexican", "Tex-Mex"], ["Japanese", "Sushi"]
