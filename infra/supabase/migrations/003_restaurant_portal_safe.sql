-- EatMe Restaurant Portal Schema - Migration v2
-- Created: 2025-12-23
-- Description: Restaurant information table for web portal submission
-- This version handles existing tables by adding missing columns

-- Enable required extensions (safe to run multiple times)
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "postgis";

-- ============================================================================
-- DROP EXISTING TABLE (if you want a clean start)
-- ============================================================================
-- Uncomment the line below if you want to completely recreate the table
-- WARNING: This will delete all existing restaurant data!
-- DROP TABLE IF EXISTS restaurants CASCADE;

-- ============================================================================
-- CREATE OR ALTER RESTAURANTS TABLE
-- ============================================================================

-- Create table if it doesn't exist
CREATE TABLE IF NOT EXISTS restaurants (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  location GEOGRAPHY(POINT, 4326) NOT NULL,
  address TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Add columns if they don't exist (safe to run multiple times)
DO $$ 
BEGIN
  -- Basic Information
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                 WHERE table_name='restaurants' AND column_name='restaurant_type') THEN
    ALTER TABLE restaurants ADD COLUMN restaurant_type TEXT;
  END IF;

  -- Location metadata
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                 WHERE table_name='restaurants' AND column_name='country_code') THEN
    ALTER TABLE restaurants ADD COLUMN country_code TEXT;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                 WHERE table_name='restaurants' AND column_name='city') THEN
    ALTER TABLE restaurants ADD COLUMN city TEXT;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                 WHERE table_name='restaurants' AND column_name='postal_code') THEN
    ALTER TABLE restaurants ADD COLUMN postal_code TEXT;
  END IF;

  -- Contact Information
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                 WHERE table_name='restaurants' AND column_name='phone') THEN
    ALTER TABLE restaurants ADD COLUMN phone TEXT;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                 WHERE table_name='restaurants' AND column_name='website') THEN
    ALTER TABLE restaurants ADD COLUMN website TEXT;
  END IF;

  -- Cuisine Classification
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                 WHERE table_name='restaurants' AND column_name='cuisine_types') THEN
    ALTER TABLE restaurants ADD COLUMN cuisine_types TEXT[] DEFAULT ARRAY[]::TEXT[];
  END IF;

  -- Operating Hours
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                 WHERE table_name='restaurants' AND column_name='open_hours') THEN
    ALTER TABLE restaurants ADD COLUMN open_hours JSONB DEFAULT '{}'::jsonb;
  END IF;

  -- Service Options
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                 WHERE table_name='restaurants' AND column_name='delivery_available') THEN
    ALTER TABLE restaurants ADD COLUMN delivery_available BOOLEAN DEFAULT true;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                 WHERE table_name='restaurants' AND column_name='takeout_available') THEN
    ALTER TABLE restaurants ADD COLUMN takeout_available BOOLEAN DEFAULT true;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                 WHERE table_name='restaurants' AND column_name='dine_in_available') THEN
    ALTER TABLE restaurants ADD COLUMN dine_in_available BOOLEAN DEFAULT true;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                 WHERE table_name='restaurants' AND column_name='accepts_reservations') THEN
    ALTER TABLE restaurants ADD COLUMN accepts_reservations BOOLEAN DEFAULT false;
  END IF;

  -- Service Speed
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                 WHERE table_name='restaurants' AND column_name='service_speed') THEN
    ALTER TABLE restaurants ADD COLUMN service_speed TEXT CHECK (service_speed IN ('fast-food', 'regular'));
  END IF;

  -- Future fields
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                 WHERE table_name='restaurants' AND column_name='rating') THEN
    ALTER TABLE restaurants ADD COLUMN rating NUMERIC(3, 2) DEFAULT 0.00;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                 WHERE table_name='restaurants' AND column_name='image_url') THEN
    ALTER TABLE restaurants ADD COLUMN image_url TEXT;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                 WHERE table_name='restaurants' AND column_name='description') THEN
    ALTER TABLE restaurants ADD COLUMN description TEXT;
  END IF;
END $$;

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

-- Drop existing policies if they exist (to avoid conflicts)
DROP POLICY IF EXISTS "Public read access" ON restaurants;
DROP POLICY IF EXISTS "Public insert access" ON restaurants;
DROP POLICY IF EXISTS "Authenticated update access" ON restaurants;

-- Policy: Anyone can read restaurant data (public access)
CREATE POLICY "Public read access" 
  ON restaurants 
  FOR SELECT 
  TO anon, authenticated 
  USING (true);

-- Policy: Anyone can insert restaurant data (for portal submissions)
CREATE POLICY "Public insert access" 
  ON restaurants 
  FOR INSERT 
  TO anon, authenticated 
  WITH CHECK (true);

-- Policy: Authenticated users can update restaurants
CREATE POLICY "Authenticated update access" 
  ON restaurants 
  FOR UPDATE 
  TO authenticated 
  USING (true)
  WITH CHECK (true);

-- ============================================================================
-- TRIGGERS
-- ============================================================================

-- Create or replace the update function
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Drop existing trigger if it exists
DROP TRIGGER IF EXISTS update_restaurants_updated_at ON restaurants;

-- Create trigger
CREATE TRIGGER update_restaurants_updated_at 
  BEFORE UPDATE ON restaurants
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- ============================================================================
-- SUCCESS MESSAGE
-- ============================================================================
DO $$ 
BEGIN
  RAISE NOTICE 'Restaurant portal schema migration completed successfully!';
  RAISE NOTICE 'Table: restaurants';
  RAISE NOTICE 'All columns added/verified';
  RAISE NOTICE 'Indexes created';
  RAISE NOTICE 'RLS policies configured';
END $$;
