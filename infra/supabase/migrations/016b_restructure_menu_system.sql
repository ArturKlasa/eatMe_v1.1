-- Restructure Menu System: Add Menu and Menu Categories
-- Created: 2026-02-08
-- Description: Separates "Menu" (Breakfast/Lunch/Dinner) from "Menu Category" (Appetizers/Entrees/etc.)
--
-- NEW STRUCTURE:
-- Restaurant → Menu (Breakfast, Lunch, Dinner, Christmas) 
--           → Menu Category (Appetizers, Entrees, Soups, Drinks)
--           → Dishes

-- ============================================================================
-- STEP 1: Create new menus table (the time-of-day/occasion menus)
-- ============================================================================

CREATE TABLE IF NOT EXISTS menus_new (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  restaurant_id UUID NOT NULL REFERENCES restaurants(id) ON DELETE CASCADE,
  name TEXT NOT NULL, -- e.g., "Breakfast", "Lunch", "Dinner", "Christmas Special"
  description TEXT,
  display_order INTEGER DEFAULT 0,
  is_active BOOLEAN DEFAULT true,
  -- Time availability (optional)
  available_start_time TIME, -- e.g., "06:00" for breakfast
  available_end_time TIME,   -- e.g., "11:00" for breakfast
  -- Day availability (optional)
  available_days TEXT[], -- e.g., ['monday', 'tuesday', 'wednesday']
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

COMMENT ON TABLE menus_new IS 'Menus represent meal periods or special occasions (Breakfast, Lunch, Dinner, Brunch, Christmas, etc.)';
COMMENT ON COLUMN menus_new.available_start_time IS 'Time when this menu becomes available (e.g., 06:00 for breakfast)';
COMMENT ON COLUMN menus_new.available_end_time IS 'Time when this menu stops being available (e.g., 11:00 for breakfast)';
COMMENT ON COLUMN menus_new.available_days IS 'Days of week when menu is available (null = all days)';

-- ============================================================================
-- STEP 2: Rename current menus table to menu_categories
-- ============================================================================

ALTER TABLE menus RENAME TO menu_categories;

COMMENT ON TABLE menu_categories IS 'Menu categories organize dishes within a menu (Appetizers, Entrees, Soups, Drinks, Desserts)';

-- ============================================================================
-- STEP 3: Add menu_id to menu_categories
-- ============================================================================

ALTER TABLE menu_categories ADD COLUMN menu_id UUID REFERENCES menus_new(id) ON DELETE CASCADE;

COMMENT ON COLUMN menu_categories.menu_id IS 'FK to menus table - which menu (Breakfast/Lunch/Dinner) this category belongs to';

-- ============================================================================
-- STEP 4: Rename menu_categories.category to name (for consistency)
-- ============================================================================

-- The 'category' column was actually the category name like "Appetizers", "Entrees"
-- Rename it to 'name' for clarity
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns 
             WHERE table_name='menu_categories' AND column_name='category') THEN
    ALTER TABLE menu_categories RENAME COLUMN category TO type;
  END IF;
END $$;

COMMENT ON COLUMN menu_categories.type IS 'Type of category: appetizers, entrees, soups, salads, mains, sides, desserts, drinks, etc.';

-- ============================================================================
-- STEP 5: Update dishes table - rename menu_id to menu_category_id
-- ============================================================================

ALTER TABLE dishes RENAME COLUMN menu_id TO menu_category_id;

COMMENT ON COLUMN dishes.menu_category_id IS 'FK to menu_categories - which category (Appetizers/Entrees) this dish belongs to';

-- ============================================================================
-- STEP 6: Rename menus_new to menus
-- ============================================================================

ALTER TABLE menus_new RENAME TO menus;

-- ============================================================================
-- STEP 7: Create indexes
-- ============================================================================

CREATE INDEX IF NOT EXISTS menus_restaurant_id_idx ON menus(restaurant_id);
CREATE INDEX IF NOT EXISTS menus_display_order_idx ON menus(display_order);
CREATE INDEX IF NOT EXISTS menus_is_active_idx ON menus(is_active) WHERE is_active = true;

CREATE INDEX IF NOT EXISTS menu_categories_menu_id_idx ON menu_categories(menu_id);
CREATE INDEX IF NOT EXISTS menu_categories_restaurant_id_idx ON menu_categories(restaurant_id);
CREATE INDEX IF NOT EXISTS menu_categories_display_order_idx ON menu_categories(display_order);

CREATE INDEX IF NOT EXISTS dishes_menu_category_id_idx ON dishes(menu_category_id);

-- ============================================================================
-- STEP 8: Update RLS Policies
-- ============================================================================

-- Menus policies
ALTER TABLE menus ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public read menus" 
  ON menus 
  FOR SELECT 
  TO anon, authenticated 
  USING (true);

CREATE POLICY "Restaurant owners can manage their menus"
  ON menus
  FOR ALL
  TO authenticated
  USING (
    restaurant_id IN (
      SELECT id FROM restaurants WHERE owner_id = auth.uid()
    )
  )
  WITH CHECK (
    restaurant_id IN (
      SELECT id FROM restaurants WHERE owner_id = auth.uid()
    )
  );

-- Menu categories policies (update existing ones)
DROP POLICY IF EXISTS "Public read menus" ON menu_categories;
DROP POLICY IF EXISTS "Public insert menus" ON menu_categories;
DROP POLICY IF EXISTS "Authenticated update menus" ON menu_categories;
DROP POLICY IF EXISTS "Authenticated delete menus" ON menu_categories;

CREATE POLICY "Public read menu_categories" 
  ON menu_categories 
  FOR SELECT 
  TO anon, authenticated 
  USING (true);

CREATE POLICY "Restaurant owners can manage their menu categories"
  ON menu_categories
  FOR ALL
  TO authenticated
  USING (
    restaurant_id IN (
      SELECT id FROM restaurants WHERE owner_id = auth.uid()
    )
  )
  WITH CHECK (
    restaurant_id IN (
      SELECT id FROM restaurants WHERE owner_id = auth.uid()
    )
  );

-- ============================================================================
-- STEP 9: Update triggers
-- ============================================================================

-- Menus trigger
DROP TRIGGER IF EXISTS update_menus_updated_at ON menus;
CREATE TRIGGER update_menus_updated_at 
  BEFORE UPDATE ON menus
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Menu categories trigger
DROP TRIGGER IF EXISTS update_menus_updated_at ON menu_categories;
CREATE TRIGGER update_menu_categories_updated_at 
  BEFORE UPDATE ON menu_categories
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- ============================================================================
-- STEP 10: Data Migration Helper
-- ============================================================================
-- This helps migrate existing data if needed

DO $$
DECLARE
  restaurant_record RECORD;
  default_menu_id UUID;
BEGIN
  -- For each restaurant, create a default "All Day" menu if they have menu_categories
  FOR restaurant_record IN SELECT DISTINCT restaurant_id FROM menu_categories WHERE menu_id IS NULL
  LOOP
    -- Create default menu
    INSERT INTO menus (restaurant_id, name, description, display_order, is_active)
    VALUES (restaurant_record.restaurant_id, 'All Day Menu', 'Available all day', 0, true)
    RETURNING id INTO default_menu_id;
    
    -- Link existing categories to this menu
    UPDATE menu_categories 
    SET menu_id = default_menu_id 
    WHERE restaurant_id = restaurant_record.restaurant_id AND menu_id IS NULL;
  END LOOP;
  
  RAISE NOTICE 'Created default menus for existing restaurants';
END $$;

-- ============================================================================
-- SUCCESS MESSAGE
-- ============================================================================

DO $$ 
BEGIN
  RAISE NOTICE '========================================';
  RAISE NOTICE 'Menu System Restructured Successfully!';
  RAISE NOTICE '========================================';
  RAISE NOTICE 'New structure:';
  RAISE NOTICE '  Restaurant → Menu (Breakfast/Lunch/Dinner)';
  RAISE NOTICE '             → Menu Category (Appetizers/Entrees)';
  RAISE NOTICE '             → Dishes';
  RAISE NOTICE '';
  RAISE NOTICE 'Tables:';
  RAISE NOTICE '  ✓ menus (new - meal periods)';
  RAISE NOTICE '  ✓ menu_categories (renamed from menus)';
  RAISE NOTICE '  ✓ dishes (menu_id → menu_category_id)';
  RAISE NOTICE '========================================';
END $$;
