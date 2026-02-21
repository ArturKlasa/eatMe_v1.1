-- Add Canonical Dish Categories and Menu Type
-- Created: 2026-02-18
-- Description: Introduces dish_categories (e.g. "Pizza", "Pasta", "Cocktails") for
--              cross-restaurant grouping, and a menu_type ('food' | 'drink') on menus
--              so the mobile app can exclude drink items from food recommendations.

-- ============================================================================
-- STEP 1: Create dish_categories table
-- ============================================================================

CREATE TABLE IF NOT EXISTS dish_categories (
  id               UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
  name             TEXT        NOT NULL,
  parent_category_id UUID      REFERENCES dish_categories(id) ON DELETE SET NULL,
  is_drink         BOOLEAN     NOT NULL DEFAULT false, -- true → drink category
  is_active        BOOLEAN     NOT NULL DEFAULT true,
  created_at       TIMESTAMPTZ DEFAULT NOW(),
  updated_at       TIMESTAMPTZ DEFAULT NOW()
);

-- Remove duplicates before adding unique constraint
DELETE FROM dish_categories a
USING dish_categories b
WHERE a.id > b.id 
  AND a.name = b.name;

-- Add unique constraint if it doesn't exist
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'dish_categories_name_key'
  ) THEN
    ALTER TABLE dish_categories ADD CONSTRAINT dish_categories_name_key UNIQUE (name);
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS dish_categories_is_drink_idx     ON dish_categories(is_drink);
CREATE INDEX IF NOT EXISTS dish_categories_parent_idx       ON dish_categories(parent_category_id);

COMMENT ON TABLE dish_categories IS
  'Canonical dish categories (e.g. Pizza, Pasta, Cocktails). '
  'Used to group dishes across restaurants for mobile app browsing.';
COMMENT ON COLUMN dish_categories.is_drink IS
  'True for drink categories. Dishes in drink categories are excluded '
  'from food browsing in the mobile app.';
COMMENT ON COLUMN dish_categories.parent_category_id IS
  'Optional parent for two-level hierarchy (e.g. "IPA" → parent "Beer").';

-- ============================================================================
-- STEP 2: Add dish_category_id FK column to dishes
-- ============================================================================

ALTER TABLE dishes
  ADD COLUMN IF NOT EXISTS dish_category_id UUID
  REFERENCES dish_categories(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS dishes_dish_category_id_idx ON dishes(dish_category_id);

COMMENT ON COLUMN dishes.dish_category_id IS
  'Canonical category for this dish (e.g. Pizza, Pasta). NULL = uncategorised.';

-- ============================================================================
-- STEP 3: Add menu_type column to menus
-- ============================================================================

ALTER TABLE menus
  ADD COLUMN IF NOT EXISTS menu_type TEXT NOT NULL DEFAULT 'food'
  CHECK (menu_type IN ('food', 'drink'));

COMMENT ON COLUMN menus.menu_type IS
  'Whether this is a food menu or a drink menu. '
  'Drink menus are excluded from the mobile app food browsing.';

-- ============================================================================
-- STEP 4: RLS Policies for dish_categories
-- ============================================================================

ALTER TABLE dish_categories ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Public read dish categories" ON dish_categories;
DROP POLICY IF EXISTS "Authenticated users can manage dish categories" ON dish_categories;
DROP POLICY IF EXISTS "Admins can manage dish categories" ON dish_categories;

-- Anyone (including anonymous users browsing the app) can read active categories
CREATE POLICY "Public read dish categories"
  ON dish_categories
  FOR SELECT
  TO anon, authenticated
  USING (is_active = true);

-- TODO: Restrict to admins once user_profiles table exists
-- For now, allow any authenticated user to manage categories
CREATE POLICY "Authenticated users can manage dish categories"
  ON dish_categories
  FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- ============================================================================
-- STEP 5: updated_at trigger
-- ============================================================================

DROP TRIGGER IF EXISTS update_dish_categories_updated_at ON dish_categories;
CREATE TRIGGER update_dish_categories_updated_at
  BEFORE UPDATE ON dish_categories
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- ============================================================================
-- STEP 6: Seed default dish categories
-- ============================================================================

INSERT INTO dish_categories (name, is_drink) VALUES
  ('Appetizers', false),
  ('Antipasti', false),
  ('Arepas', false),
  ('BBQ', false),
  ('Bao', false),
  ('Bar food', false),
  ('Bento', false),
  ('Bowl', false),
  ('Breakfast', false),
  ('Breakfast sandwich', false),
  ('Brunch', false),
  ('Burger', false),
  ('Burrito', false),
  ('Burrito bowl', false),
  ('Casserole', false),
  ('Ceviche', false),
  ('Charcuterie', false),
  ('Cheesesteak', false),
  ('Chicken wings', false),
  ('Chowder', false),
  ('Combo meal', false),
  ('Comfort food', false),
  ('Crepes', false),
  ('Curry', false),
  ('Dessert', false),
  ('Dim sum', false),
  ('Donburi', false),
  ('Dumplings', false),
  ('Empanadas', false),
  ('Enchiladas', false),
  ('Falafel', false),
  ('Family meal', false),
  ('Flatbread', false),
  ('Fondue', false),
  ('Fried chicken', false),
  ('Fried noodles', false),
  ('Fried rice', false),
  ('Fritters', false),
  ('Frittata', false),
  ('Fusion dishes', false),
  ('Grill', false),
  ('Gyro', false),
  ('Hot dog', false),
  ('Hot pot', false),
  ('Kebab', false),
  ('Kids meal', false),
  ('Lasagna', false),
  ('Loaded fries', false),
  ('Lunch special', false),
  ('Mac and cheese', false),
  ('Meal box', false),
  ('Noodle soup', false),
  ('Noodles', false),
  ('Omelette', false),
  ('Paella', false),
  ('Pancakes', false),
  ('Pasta', false),
  ('Pastries', false),
  ('Pies', false),
  ('Pizza', false),
  ('Platter', false),
  ('Poke bowl', false),
  ('Pot pie', false),
  ('Quesadilla', false),
  ('Ramen', false),
  ('Rice bowl', false),
  ('Rice dish', false),
  ('Risotto', false),
  ('Roast meat', false),
  ('Rotisserie chicken', false),
  ('Salad', false),
  ('Sandwich', false),
  ('Seafood boil', false),
  ('Shawarma', false),
  ('Skewers', false),
  ('Sliders', false),
  ('Soup', false),
  ('Steak', false),
  ('Stir fry', false),
  ('Sushi', false),
  ('Tacos', false),
  ('Tapas', false),
  ('Tempura', false),
  ('Toast', false),
  ('Tortilla wrap', false),
  ('Udon', false),
  ('Waffles', false),
  ('Wrap', false),
  -- ── Drinks ──
  ('Water', true),
  ('Juice', true),
  ('Smoothie', true),
  ('Milkshake', true),
  ('Tea', true),
  ('Coffee', true),
  ('Hot chocolate', true),
  ('Milk', true),
  ('Soda', true),
  ('Soft drink', true),
  ('Lemonade', true),
  ('Mocktail', true)
ON CONFLICT (name) DO NOTHING;
