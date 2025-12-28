-- EatMe Restaurant Portal Schema - Complete Migration
-- Created: 2025-12-28
-- Description: Full schema including restaurants, menus, and dishes
-- This version includes all tables for complete portal functionality

-- Enable required extensions (safe to run multiple times)
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "postgis";

-- ============================================================================
-- RESTAURANTS TABLE
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
-- MENUS TABLE
-- ============================================================================

CREATE TABLE IF NOT EXISTS menus (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  restaurant_id UUID NOT NULL REFERENCES restaurants(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  category TEXT, -- breakfast, lunch, dinner, drinks, desserts, etc.
  display_order INTEGER DEFAULT 0,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ============================================================================
-- DISHES TABLE
-- ============================================================================

CREATE TABLE IF NOT EXISTS dishes (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  restaurant_id UUID NOT NULL REFERENCES restaurants(id) ON DELETE CASCADE,
  menu_id UUID REFERENCES menus(id) ON DELETE SET NULL,
  
  -- Basic Information
  name TEXT NOT NULL,
  description TEXT,
  
  -- Pricing
  price NUMERIC(10, 2) NOT NULL,
  
  -- Dietary Information
  dietary_tags TEXT[] DEFAULT ARRAY[]::TEXT[], -- vegan, vegetarian, gluten_free, etc.
  allergens TEXT[] DEFAULT ARRAY[]::TEXT[], -- nuts, dairy, eggs, etc.
  ingredients TEXT[] DEFAULT ARRAY[]::TEXT[],
  
  -- Nutrition & Taste
  calories INTEGER,
  spice_level SMALLINT CHECK (spice_level BETWEEN 0 AND 4), -- 0=none, 4=very spicy
  
  -- Media & Availability
  image_url TEXT,
  is_available BOOLEAN DEFAULT true,
  
  -- Metadata
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ============================================================================
-- INDEXES - RESTAURANTS
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
-- INDEXES - MENUS
-- ============================================================================

CREATE INDEX IF NOT EXISTS menus_restaurant_id_idx 
  ON menus(restaurant_id);

CREATE INDEX IF NOT EXISTS menus_category_idx 
  ON menus(category);

CREATE INDEX IF NOT EXISTS menus_display_order_idx 
  ON menus(display_order);

-- ============================================================================
-- INDEXES - DISHES
-- ============================================================================

CREATE INDEX IF NOT EXISTS dishes_restaurant_id_idx 
  ON dishes(restaurant_id);

CREATE INDEX IF NOT EXISTS dishes_menu_id_idx 
  ON dishes(menu_id);

CREATE INDEX IF NOT EXISTS dishes_dietary_tags_idx 
  ON dishes USING GIN(dietary_tags);

CREATE INDEX IF NOT EXISTS dishes_allergens_idx 
  ON dishes USING GIN(allergens);

CREATE INDEX IF NOT EXISTS dishes_spice_level_idx 
  ON dishes(spice_level);

CREATE INDEX IF NOT EXISTS dishes_price_idx 
  ON dishes(price);

CREATE INDEX IF NOT EXISTS dishes_available_idx 
  ON dishes(is_available) 
  WHERE is_available = true;

-- ============================================================================
-- ROW LEVEL SECURITY (RLS) - RESTAURANTS
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
-- ROW LEVEL SECURITY (RLS) - MENUS
-- ============================================================================

ALTER TABLE menus ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Public read menus" ON menus;
DROP POLICY IF EXISTS "Public insert menus" ON menus;
DROP POLICY IF EXISTS "Authenticated update menus" ON menus;
DROP POLICY IF EXISTS "Authenticated delete menus" ON menus;

CREATE POLICY "Public read menus" 
  ON menus 
  FOR SELECT 
  TO anon, authenticated 
  USING (true);

CREATE POLICY "Public insert menus" 
  ON menus 
  FOR INSERT 
  TO anon, authenticated 
  WITH CHECK (true);

CREATE POLICY "Authenticated update menus" 
  ON menus 
  FOR UPDATE 
  TO authenticated 
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Authenticated delete menus" 
  ON menus 
  FOR DELETE 
  TO authenticated 
  USING (true);

-- ============================================================================
-- ROW LEVEL SECURITY (RLS) - DISHES
-- ============================================================================

ALTER TABLE dishes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Public read dishes" ON dishes;
DROP POLICY IF EXISTS "Public insert dishes" ON dishes;
DROP POLICY IF EXISTS "Authenticated update dishes" ON dishes;
DROP POLICY IF EXISTS "Authenticated delete dishes" ON dishes;

CREATE POLICY "Public read dishes" 
  ON dishes 
  FOR SELECT 
  TO anon, authenticated 
  USING (true);

CREATE POLICY "Public insert dishes" 
  ON dishes 
  FOR INSERT 
  TO anon, authenticated 
  WITH CHECK (true);

CREATE POLICY "Authenticated update dishes" 
  ON dishes 
  FOR UPDATE 
  TO authenticated 
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Authenticated delete dishes" 
  ON dishes 
  FOR DELETE 
  TO authenticated 
  USING (true);

-- ============================================================================
-- TRIGGERS - AUTO UPDATE TIMESTAMPS
-- ============================================================================

-- Create or replace the update function
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Restaurants trigger
DROP TRIGGER IF EXISTS update_restaurants_updated_at ON restaurants;
CREATE TRIGGER update_restaurants_updated_at 
  BEFORE UPDATE ON restaurants
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Menus trigger
DROP TRIGGER IF EXISTS update_menus_updated_at ON menus;
CREATE TRIGGER update_menus_updated_at 
  BEFORE UPDATE ON menus
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Dishes trigger
DROP TRIGGER IF EXISTS update_dishes_updated_at ON dishes;
CREATE TRIGGER update_dishes_updated_at 
  BEFORE UPDATE ON dishes
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- ============================================================================
-- SUCCESS MESSAGE
-- ============================================================================
DO $$ 
BEGIN
  RAISE NOTICE '========================================';
  RAISE NOTICE 'Restaurant portal COMPLETE schema migration finished!';
  RAISE NOTICE '========================================';
  RAISE NOTICE 'Tables created/updated:';
  RAISE NOTICE '  ✓ restaurants (with all portal fields)';
  RAISE NOTICE '  ✓ menus (linked to restaurants)';
  RAISE NOTICE '  ✓ dishes (linked to restaurants and menus)';
  RAISE NOTICE '';
  RAISE NOTICE 'Features enabled:';
  RAISE NOTICE '  ✓ PostGIS for geospatial queries';
  RAISE NOTICE '  ✓ Row Level Security on all tables';
  RAISE NOTICE '  ✓ Indexes for performance';
  RAISE NOTICE '  ✓ Auto-update timestamps';
  RAISE NOTICE '  ✓ Cascade deletes (delete restaurant → deletes menus & dishes)';
  RAISE NOTICE '========================================';
END $$;
