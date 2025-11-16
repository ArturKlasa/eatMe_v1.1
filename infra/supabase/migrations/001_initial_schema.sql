-- EatMe Database Schema - Initial Migration
-- Created: 2025-11-09
-- Description: Core tables for users, restaurants, dishes, reviews, and favorites

-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "postgis";

-- ============================================================================
-- USERS AND PROFILES
-- ============================================================================

-- User profiles with preferences
-- Note: user_id references auth.users (managed by Supabase Auth)
profiles {
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE UNIQUE,
  display_name TEXT,
  avatar_url TEXT,
  permanent_filters JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ============================================================================
-- RESTAURANTS
-- ============================================================================

CREATE TABLE IF NOT EXISTS restaurants (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  
  -- Geospatial location using PostGIS
  location GEOGRAPHY(POINT, 4326) NOT NULL,
  address TEXT NOT NULL,
  
  -- Location metadata
  country_code TEXT,
  city TEXT,
  postal_code TEXT,
  
  -- Restaurant classification
  cuisine_types TEXT[] DEFAULT ARRAY[]::TEXT[],
  
  -- Pricing and rating
  price_level SMALLINT CHECK (price_level BETWEEN 1 AND 4),
  rating NUMERIC(3, 2) DEFAULT 0.00,
  
  -- Operating hours (JSON format: {day: {open: "HH:MM", close: "HH:MM"}})
  open_hours JSONB DEFAULT '{}'::jsonb,
  
  -- Additional features
  dietary_certifications TEXT[] DEFAULT ARRAY[]::TEXT[],
  is_local_cuisine BOOLEAN DEFAULT false,
  tourist_friendly BOOLEAN DEFAULT false,
  
  -- Metadata
  phone TEXT,
  website TEXT,
  image_url TEXT,
  description TEXT,
  
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create spatial index for location queries
CREATE INDEX IF NOT EXISTS restaurants_location_idx ON restaurants USING GIST(location);

-- Create indexes for common queries
CREATE INDEX IF NOT EXISTS restaurants_cuisine_types_idx ON restaurants USING GIN(cuisine_types);
CREATE INDEX IF NOT EXISTS restaurants_price_level_idx ON restaurants(price_level);
CREATE INDEX IF NOT EXISTS restaurants_rating_idx ON restaurants(rating DESC);
CREATE INDEX IF NOT EXISTS restaurants_city_idx ON restaurants(city);

-- ============================================================================
-- DISHES
-- ============================================================================

CREATE TABLE IF NOT EXISTS dishes (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  restaurant_id UUID REFERENCES restaurants(id) ON DELETE CASCADE NOT NULL,
  
  name TEXT NOT NULL,
  description TEXT,
  local_name TEXT,
  
  -- Pricing and nutrition
  price NUMERIC(10, 2) NOT NULL,
  calories INTEGER,
  
  -- Ingredients and dietary info
  ingredients TEXT[] DEFAULT ARRAY[]::TEXT[],
  allergens TEXT[] DEFAULT ARRAY[]::TEXT[],
  dietary_tags TEXT[] DEFAULT ARRAY[]::TEXT[],
  
  -- Taste
  spice_level SMALLINT CHECK (spice_level BETWEEN 0 AND 4),
  tags TEXT[] DEFAULT ARRAY[]::TEXT[],
  
  -- Popularity and ratings
  popularity_score NUMERIC(5, 2) DEFAULT 0.00,
  
  -- Media
  image_url TEXT,
  
  -- Availability
  is_available BOOLEAN DEFAULT true,
  
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for dishes
CREATE INDEX IF NOT EXISTS dishes_restaurant_id_idx ON dishes(restaurant_id);
CREATE INDEX IF NOT EXISTS dishes_dietary_tags_idx ON dishes USING GIN(dietary_tags);
CREATE INDEX IF NOT EXISTS dishes_allergens_idx ON dishes USING GIN(allergens);
CREATE INDEX IF NOT EXISTS dishes_spice_level_idx ON dishes(spice_level);
CREATE INDEX IF NOT EXISTS dishes_price_idx ON dishes(price);
CREATE INDEX IF NOT EXISTS dishes_popularity_idx ON dishes(popularity_score DESC);

-- ============================================================================
-- REVIEWS
-- ============================================================================

-- Create enum for review subject types
CREATE TYPE subject_type AS ENUM ('dish', 'restaurant');

CREATE TABLE IF NOT EXISTS reviews (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  
  -- Polymorphic relationship
  subject_type subject_type NOT NULL,
  subject_id UUID NOT NULL,
  
  rating SMALLINT CHECK (rating BETWEEN 1 AND 5) NOT NULL,
  text TEXT,
  
  -- Media attachments
  image_urls TEXT[] DEFAULT ARRAY[]::TEXT[],
  
  -- Review metadata
  helpful_count INTEGER DEFAULT 0,
  verified_visit BOOLEAN DEFAULT false,
  
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for reviews
CREATE INDEX IF NOT EXISTS reviews_user_id_idx ON reviews(user_id);
CREATE INDEX IF NOT EXISTS reviews_subject_idx ON reviews(subject_type, subject_id);
CREATE INDEX IF NOT EXISTS reviews_rating_idx ON reviews(rating);
CREATE INDEX IF NOT EXISTS reviews_created_at_idx ON reviews(created_at DESC);

-- Ensure user can only review each item once
CREATE UNIQUE INDEX IF NOT EXISTS reviews_unique_user_subject_idx 
  ON reviews(user_id, subject_type, subject_id);

-- ============================================================================
-- FAVORITES
-- ============================================================================

CREATE TABLE IF NOT EXISTS favorites (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  
  -- Polymorphic relationship
  subject_type subject_type NOT NULL,
  subject_id UUID NOT NULL,
  
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for favorites
CREATE INDEX IF NOT EXISTS favorites_user_id_idx ON favorites(user_id);
CREATE INDEX IF NOT EXISTS favorites_subject_idx ON favorites(subject_type, subject_id);

-- Ensure user can only favorite each item once
CREATE UNIQUE INDEX IF NOT EXISTS favorites_unique_user_subject_idx 
  ON favorites(user_id, subject_type, subject_id);

-- ============================================================================
-- MASTER DATA TABLES
-- ============================================================================

-- Cuisines master data
CREATE TABLE IF NOT EXISTS cuisines_master (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT UNIQUE NOT NULL,
  region TEXT,
  description TEXT,
  popular_dishes TEXT[] DEFAULT ARRAY[]::TEXT[],
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Allergens master data
CREATE TABLE IF NOT EXISTS allergens_master (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT UNIQUE NOT NULL,
  severity_levels TEXT[] DEFAULT ARRAY[]::TEXT[],
  common_sources TEXT[] DEFAULT ARRAY[]::TEXT[],
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Dietary tags master data
CREATE TABLE IF NOT EXISTS dietary_tags_master (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT UNIQUE NOT NULL,
  category TEXT, -- e.g., 'diet', 'religious', 'lifestyle'
  description TEXT,
  excluded_ingredients TEXT[] DEFAULT ARRAY[]::TEXT[],
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Ingredients master data
CREATE TABLE IF NOT EXISTS ingredients_master (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT UNIQUE NOT NULL,
  dietary_flags TEXT[] DEFAULT ARRAY[]::TEXT[],
  nutritional_category TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Junction table: Ingredients to Allergens (many-to-many)
CREATE TABLE IF NOT EXISTS ingredient_allergens (
  ingredient_id UUID REFERENCES ingredients_master(id) ON DELETE CASCADE,
  allergen_id UUID REFERENCES allergens_master(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  PRIMARY KEY (ingredient_id, allergen_id)
);

-- Create indexes for ingredient_allergens
CREATE INDEX IF NOT EXISTS ingredient_allergens_ingredient_idx ON ingredient_allergens(ingredient_id);
CREATE INDEX IF NOT EXISTS ingredient_allergens_allergen_idx ON ingredient_allergens(allergen_id);

-- ============================================================================
-- TRIGGERS FOR UPDATED_AT
-- ============================================================================

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply trigger to tables with updated_at
CREATE TRIGGER update_profiles_updated_at BEFORE UPDATE ON profiles
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_restaurants_updated_at BEFORE UPDATE ON restaurants
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_dishes_updated_at BEFORE UPDATE ON dishes
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_reviews_updated_at BEFORE UPDATE ON reviews
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================================================
-- ROW LEVEL SECURITY (RLS) POLICIES
-- ============================================================================

-- Enable RLS on all tables
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE restaurants ENABLE ROW LEVEL SECURITY;
ALTER TABLE dishes ENABLE ROW LEVEL SECURITY;
ALTER TABLE reviews ENABLE ROW LEVEL SECURITY;
ALTER TABLE favorites ENABLE ROW LEVEL SECURITY;

-- Profiles: Users can read all, but only update their own
CREATE POLICY "Profiles are viewable by everyone" ON profiles
  FOR SELECT USING (true);

CREATE POLICY "Users can update their own profile" ON profiles
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own profile" ON profiles
  FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Restaurants: Public read, admin write (will add admin role later)
CREATE POLICY "Restaurants are viewable by everyone" ON restaurants
  FOR SELECT USING (true);

-- Dishes: Public read, restaurant owners can manage their dishes
CREATE POLICY "Dishes are viewable by everyone" ON dishes
  FOR SELECT USING (true);

-- Reviews: Users can read all, create their own, update/delete only their own
CREATE POLICY "Reviews are viewable by everyone" ON reviews
  FOR SELECT USING (true);

CREATE POLICY "Authenticated users can create reviews" ON reviews
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own reviews" ON reviews
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own reviews" ON reviews
  FOR DELETE USING (auth.uid() = user_id);

-- Favorites: Users can only see and manage their own favorites
CREATE POLICY "Users can view their own favorites" ON favorites
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own favorites" ON favorites
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete their own favorites" ON favorites
  FOR DELETE USING (auth.uid() = user_id);

-- ============================================================================
-- HELPER FUNCTIONS
-- ============================================================================

-- Function to calculate distance between two points in kilometers
CREATE OR REPLACE FUNCTION calculate_distance(
  lat1 DOUBLE PRECISION,
  lon1 DOUBLE PRECISION,
  lat2 DOUBLE PRECISION,
  lon2 DOUBLE PRECISION
)
RETURNS DOUBLE PRECISION AS $$
BEGIN
  RETURN ST_Distance(
    ST_MakePoint(lon1, lat1)::geography,
    ST_MakePoint(lon2, lat2)::geography
  ) / 1000; -- Convert meters to kilometers
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- Function to get nearby restaurants
CREATE OR REPLACE FUNCTION get_nearby_restaurants(
  user_lat DOUBLE PRECISION,
  user_lon DOUBLE PRECISION,
  radius_km DOUBLE PRECISION DEFAULT 5.0,
  max_results INTEGER DEFAULT 50
)
RETURNS TABLE (
  id UUID,
  name TEXT,
  distance_km DOUBLE PRECISION,
  location GEOGRAPHY,
  cuisine_types TEXT[],
  price_level SMALLINT,
  rating NUMERIC
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    r.id,
    r.name,
    ST_Distance(
      r.location,
      ST_MakePoint(user_lon, user_lat)::geography
    ) / 1000 AS distance_km,
    r.location,
    r.cuisine_types,
    r.price_level,
    r.rating
  FROM restaurants r
  WHERE ST_DWithin(
    r.location,
    ST_MakePoint(user_lon, user_lat)::geography,
    radius_km * 1000 -- Convert km to meters
  )
  ORDER BY distance_km
  LIMIT max_results;
END;
$$ LANGUAGE plpgsql STABLE;

-- Function to get all allergens for a dish based on its ingredients
CREATE OR REPLACE FUNCTION get_dish_allergens(dish_id_param UUID)
RETURNS TEXT[] AS $$
DECLARE
  allergen_names TEXT[];
BEGIN
  SELECT ARRAY_AGG(DISTINCT am.name)
  INTO allergen_names
  FROM dishes d
  CROSS JOIN LATERAL unnest(d.ingredients) AS ingredient_name
  JOIN ingredients_master im ON im.name = ingredient_name
  JOIN ingredient_allergens ia ON ia.ingredient_id = im.id
  JOIN allergens_master am ON am.id = ia.allergen_id
  WHERE d.id = dish_id_param;
  
  RETURN COALESCE(allergen_names, ARRAY[]::TEXT[]);
END;
$$ LANGUAGE plpgsql STABLE;

-- Function to update dish allergens from ingredients (can be called manually or via trigger)
CREATE OR REPLACE FUNCTION update_dish_allergens_from_ingredients()
RETURNS TRIGGER AS $$
BEGIN
  -- Update the allergens array based on ingredients
  NEW.allergens := (
    SELECT ARRAY_AGG(DISTINCT am.name)
    FROM unnest(NEW.ingredients) AS ingredient_name
    JOIN ingredients_master im ON im.name = ingredient_name
    JOIN ingredient_allergens ia ON ia.ingredient_id = im.id
    JOIN allergens_master am ON am.id = ia.allergen_id
  );
  
  -- If no allergens found, set to empty array
  NEW.allergens := COALESCE(NEW.allergens, ARRAY[]::TEXT[]);
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to auto-update dish allergens when ingredients change
CREATE TRIGGER update_dish_allergens_trigger
  BEFORE INSERT OR UPDATE OF ingredients ON dishes
  FOR EACH ROW
  EXECUTE FUNCTION update_dish_allergens_from_ingredients();
