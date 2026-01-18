-- Add Authentication Support to Restaurant Portal
-- Created: 2026-01-10
-- Description: Add owner_id column and update RLS policies for authentication

-- ============================================================================
-- ADD OWNER_ID COLUMN TO RESTAURANTS
-- ============================================================================

DO $$ 
BEGIN
  -- Add owner_id column if it doesn't exist
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                 WHERE table_name='restaurants' AND column_name='owner_id') THEN
    ALTER TABLE restaurants ADD COLUMN owner_id UUID REFERENCES auth.users(id) ON DELETE CASCADE;
  END IF;
END $$;

-- Create index for owner lookups
CREATE INDEX IF NOT EXISTS restaurants_owner_id_idx ON restaurants(owner_id);

-- ============================================================================
-- UPDATE RLS POLICIES - RESTAURANTS
-- ============================================================================

-- Drop old public policies
DROP POLICY IF EXISTS "Public read access" ON restaurants;
DROP POLICY IF EXISTS "Public insert access" ON restaurants;
DROP POLICY IF EXISTS "Authenticated update access" ON restaurants;

-- Policy: Anyone can read restaurant data (public directory)
CREATE POLICY "Anyone can read restaurants" 
  ON restaurants 
  FOR SELECT 
  TO anon, authenticated 
  USING (true);

-- Policy: Authenticated users can insert their own restaurants
CREATE POLICY "Users can create restaurants" 
  ON restaurants 
  FOR INSERT 
  TO authenticated 
  WITH CHECK (auth.uid() = owner_id);

-- Policy: Users can only update their own restaurants
CREATE POLICY "Users can update own restaurants" 
  ON restaurants 
  FOR UPDATE 
  TO authenticated 
  USING (auth.uid() = owner_id)
  WITH CHECK (auth.uid() = owner_id);

-- Policy: Users can only delete their own restaurants
CREATE POLICY "Users can delete own restaurants" 
  ON restaurants 
  FOR DELETE 
  TO authenticated 
  USING (auth.uid() = owner_id);

-- ============================================================================
-- UPDATE RLS POLICIES - MENUS
-- ============================================================================

DROP POLICY IF EXISTS "Public read menus" ON menus;
DROP POLICY IF EXISTS "Public insert menus" ON menus;
DROP POLICY IF EXISTS "Authenticated update menus" ON menus;
DROP POLICY IF EXISTS "Authenticated delete menus" ON menus;

-- Anyone can read menus
CREATE POLICY "Anyone can read menus" 
  ON menus 
  FOR SELECT 
  TO anon, authenticated 
  USING (true);

-- Users can only insert menus for their own restaurants
CREATE POLICY "Users can create menus for own restaurants" 
  ON menus 
  FOR INSERT 
  TO authenticated 
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM restaurants 
      WHERE restaurants.id = menus.restaurant_id 
      AND restaurants.owner_id = auth.uid()
    )
  );

-- Users can only update menus of their own restaurants
CREATE POLICY "Users can update own restaurant menus" 
  ON menus 
  FOR UPDATE 
  TO authenticated 
  USING (
    EXISTS (
      SELECT 1 FROM restaurants 
      WHERE restaurants.id = menus.restaurant_id 
      AND restaurants.owner_id = auth.uid()
    )
  );

-- Users can only delete menus of their own restaurants
CREATE POLICY "Users can delete own restaurant menus" 
  ON menus 
  FOR DELETE 
  TO authenticated 
  USING (
    EXISTS (
      SELECT 1 FROM restaurants 
      WHERE restaurants.id = menus.restaurant_id 
      AND restaurants.owner_id = auth.uid()
    )
  );

-- ============================================================================
-- UPDATE RLS POLICIES - DISHES
-- ============================================================================

DROP POLICY IF EXISTS "Public read dishes" ON dishes;
DROP POLICY IF EXISTS "Public insert dishes" ON dishes;
DROP POLICY IF EXISTS "Authenticated update dishes" ON dishes;
DROP POLICY IF EXISTS "Authenticated delete dishes" ON dishes;

-- Anyone can read dishes
CREATE POLICY "Anyone can read dishes" 
  ON dishes 
  FOR SELECT 
  TO anon, authenticated 
  USING (true);

-- Users can only insert dishes for their own restaurants
CREATE POLICY "Users can create dishes for own restaurants" 
  ON dishes 
  FOR INSERT 
  TO authenticated 
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM restaurants 
      WHERE restaurants.id = dishes.restaurant_id 
      AND restaurants.owner_id = auth.uid()
    )
  );

-- Users can only update dishes of their own restaurants
CREATE POLICY "Users can update own restaurant dishes" 
  ON dishes 
  FOR UPDATE 
  TO authenticated 
  USING (
    EXISTS (
      SELECT 1 FROM restaurants 
      WHERE restaurants.id = dishes.restaurant_id 
      AND restaurants.owner_id = auth.uid()
    )
  );

-- Users can only delete dishes of their own restaurants
CREATE POLICY "Users can delete own restaurant dishes" 
  ON dishes 
  FOR DELETE 
  TO authenticated 
  USING (
    EXISTS (
      SELECT 1 FROM restaurants 
      WHERE restaurants.id = dishes.restaurant_id 
      AND restaurants.owner_id = auth.uid()
    )
  );

-- ============================================================================
-- SUCCESS MESSAGE
-- ============================================================================
DO $$ 
BEGIN
  RAISE NOTICE '========================================';
  RAISE NOTICE 'Authentication support added successfully!';
  RAISE NOTICE '========================================';
  RAISE NOTICE 'Changes made:';
  RAISE NOTICE '  ✓ Added owner_id column to restaurants';
  RAISE NOTICE '  ✓ Updated RLS policies for user ownership';
  RAISE NOTICE '  ✓ Users can only edit their own restaurants';
  RAISE NOTICE '  ✓ Menus/dishes inherit restaurant ownership';
  RAISE NOTICE '';
  RAISE NOTICE 'Next steps:';
  RAISE NOTICE '  1. Implement login/signup in web portal';
  RAISE NOTICE '  2. Link restaurants to authenticated users';
  RAISE NOTICE '  3. Show only user-owned restaurants in dashboard';
  RAISE NOTICE '========================================';
END $$;
