-- Create Master Ingredient System with Allergens and Dietary Tags
-- Created: 2026-01-27
-- Description: Normalized tables for ingredients, allergens, and dietary tags with autocomplete support

-- ============================================================================
-- ALLERGENS MASTER TABLE
-- ============================================================================

CREATE TABLE IF NOT EXISTS allergens (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  code TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  icon TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

COMMENT ON TABLE allergens IS 'Master list of allergens (FDA major allergens + common ones)';
COMMENT ON COLUMN allergens.code IS 'Unique identifier code (e.g., peanuts, dairy, gluten)';

-- ============================================================================
-- DIETARY TAGS MASTER TABLE
-- ============================================================================

CREATE TABLE IF NOT EXISTS dietary_tags (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  code TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  icon TEXT,
  category TEXT CHECK (category IN ('diet', 'religious', 'lifestyle', 'health')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

COMMENT ON TABLE dietary_tags IS 'Master list of dietary preferences and restrictions';
COMMENT ON COLUMN dietary_tags.category IS 'diet=vegan/keto, religious=halal/kosher, lifestyle=organic, health=diabetic';

-- ============================================================================
-- INGREDIENTS MASTER TABLE
-- ============================================================================

CREATE TABLE IF NOT EXISTS ingredients_master (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT UNIQUE NOT NULL,
  name_variants TEXT[] DEFAULT ARRAY[]::TEXT[],
  category TEXT CHECK (category IN ('vegetable', 'fruit', 'protein', 'grain', 'dairy', 'spice', 'herb', 'condiment', 'oil', 'sweetener', 'beverage', 'other')),
  is_vegetarian BOOLEAN DEFAULT true,
  is_vegan BOOLEAN DEFAULT false,
  search_vector TSVECTOR,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

COMMENT ON TABLE ingredients_master IS 'Master list of ingredients for autocomplete and allergen tracking';
COMMENT ON COLUMN ingredients_master.name_variants IS 'Alternative names (e.g., ["scallion", "spring onion"] for "Green Onion")';
COMMENT ON COLUMN ingredients_master.search_vector IS 'Full-text search index for autocomplete';

-- ============================================================================
-- JUNCTION TABLES (Many-to-Many Relationships)
-- ============================================================================

-- Ingredients <-> Allergens
CREATE TABLE IF NOT EXISTS ingredient_allergens (
  ingredient_id UUID REFERENCES ingredients_master(id) ON DELETE CASCADE,
  allergen_id UUID REFERENCES allergens(id) ON DELETE CASCADE,
  PRIMARY KEY (ingredient_id, allergen_id)
);

COMMENT ON TABLE ingredient_allergens IS 'Links ingredients to allergens they contain';

-- Ingredients <-> Dietary Tags
CREATE TABLE IF NOT EXISTS ingredient_dietary_tags (
  ingredient_id UUID REFERENCES ingredients_master(id) ON DELETE CASCADE,
  dietary_tag_id UUID REFERENCES dietary_tags(id) ON DELETE CASCADE,
  PRIMARY KEY (ingredient_id, dietary_tag_id)
);

COMMENT ON TABLE ingredient_dietary_tags IS 'Links ingredients to dietary classifications';

-- ============================================================================
-- INDEXES FOR PERFORMANCE
-- ============================================================================

CREATE INDEX IF NOT EXISTS ingredients_master_name_idx ON ingredients_master(name);
CREATE INDEX IF NOT EXISTS ingredients_master_name_lower_idx ON ingredients_master(LOWER(name));
CREATE INDEX IF NOT EXISTS ingredients_master_search_idx ON ingredients_master USING GIN(search_vector);
CREATE INDEX IF NOT EXISTS ingredients_master_category_idx ON ingredients_master(category);
CREATE INDEX IF NOT EXISTS ingredient_allergens_ingredient_idx ON ingredient_allergens(ingredient_id);
CREATE INDEX IF NOT EXISTS ingredient_allergens_allergen_idx ON ingredient_allergens(allergen_id);
CREATE INDEX IF NOT EXISTS ingredient_dietary_tags_ingredient_idx ON ingredient_dietary_tags(ingredient_id);
CREATE INDEX IF NOT EXISTS ingredient_dietary_tags_tag_idx ON ingredient_dietary_tags(dietary_tag_id);

-- ============================================================================
-- TRIGGERS FOR AUTO-UPDATING SEARCH VECTOR
-- ============================================================================

CREATE OR REPLACE FUNCTION update_ingredient_search_vector()
RETURNS TRIGGER AS $$
BEGIN
  NEW.search_vector := to_tsvector('english', 
    COALESCE(NEW.name, '') || ' ' || 
    COALESCE(array_to_string(NEW.name_variants, ' '), '')
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS ingredient_search_vector_update ON ingredients_master;
CREATE TRIGGER ingredient_search_vector_update
BEFORE INSERT OR UPDATE ON ingredients_master
FOR EACH ROW
EXECUTE FUNCTION update_ingredient_search_vector();

-- ============================================================================
-- TRIGGERS FOR AUTO-UPDATING TIMESTAMPS
-- ============================================================================

CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS allergens_updated_at ON allergens;
CREATE TRIGGER allergens_updated_at
BEFORE UPDATE ON allergens
FOR EACH ROW
EXECUTE FUNCTION update_updated_at();

DROP TRIGGER IF EXISTS dietary_tags_updated_at ON dietary_tags;
CREATE TRIGGER dietary_tags_updated_at
BEFORE UPDATE ON dietary_tags
FOR EACH ROW
EXECUTE FUNCTION update_updated_at();

DROP TRIGGER IF EXISTS ingredients_master_updated_at ON ingredients_master;
CREATE TRIGGER ingredients_master_updated_at
BEFORE UPDATE ON ingredients_master
FOR EACH ROW
EXECUTE FUNCTION update_updated_at();

-- ============================================================================
-- ROW LEVEL SECURITY (RLS)
-- ============================================================================

-- Enable RLS on all tables
ALTER TABLE allergens ENABLE ROW LEVEL SECURITY;
ALTER TABLE dietary_tags ENABLE ROW LEVEL SECURITY;
ALTER TABLE ingredients_master ENABLE ROW LEVEL SECURITY;
ALTER TABLE ingredient_allergens ENABLE ROW LEVEL SECURITY;
ALTER TABLE ingredient_dietary_tags ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Allow public read access to allergens" ON allergens;
DROP POLICY IF EXISTS "Allow public read access to dietary_tags" ON dietary_tags;
DROP POLICY IF EXISTS "Allow public read access to ingredients_master" ON ingredients_master;
DROP POLICY IF EXISTS "Allow public read access to ingredient_allergens" ON ingredient_allergens;
DROP POLICY IF EXISTS "Allow public read access to ingredient_dietary_tags" ON ingredient_dietary_tags;
DROP POLICY IF EXISTS "Allow admin insert on allergens" ON allergens;
DROP POLICY IF EXISTS "Allow admin update on allergens" ON allergens;
DROP POLICY IF EXISTS "Allow admin delete on allergens" ON allergens;
DROP POLICY IF EXISTS "Allow admin insert on dietary_tags" ON dietary_tags;
DROP POLICY IF EXISTS "Allow admin update on dietary_tags" ON dietary_tags;
DROP POLICY IF EXISTS "Allow admin delete on dietary_tags" ON dietary_tags;
DROP POLICY IF EXISTS "Allow admin insert on ingredients_master" ON ingredients_master;
DROP POLICY IF EXISTS "Allow admin update on ingredients_master" ON ingredients_master;
DROP POLICY IF EXISTS "Allow admin delete on ingredients_master" ON ingredients_master;
DROP POLICY IF EXISTS "Allow admin insert on ingredient_allergens" ON ingredient_allergens;
DROP POLICY IF EXISTS "Allow admin delete on ingredient_allergens" ON ingredient_allergens;
DROP POLICY IF EXISTS "Allow admin insert on ingredient_dietary_tags" ON ingredient_dietary_tags;
DROP POLICY IF EXISTS "Allow admin delete on ingredient_dietary_tags" ON ingredient_dietary_tags;

-- Public read access for all users
CREATE POLICY "Allow public read access to allergens"
ON allergens FOR SELECT
TO public
USING (true);

CREATE POLICY "Allow public read access to dietary_tags"
ON dietary_tags FOR SELECT
TO public
USING (true);

CREATE POLICY "Allow public read access to ingredients_master"
ON ingredients_master FOR SELECT
TO public
USING (true);

CREATE POLICY "Allow public read access to ingredient_allergens"
ON ingredient_allergens FOR SELECT
TO public
USING (true);

CREATE POLICY "Allow public read access to ingredient_dietary_tags"
ON ingredient_dietary_tags FOR SELECT
TO public
USING (true);

-- Admin-only write access
CREATE POLICY "Allow admin insert on allergens"
ON allergens FOR INSERT
TO authenticated
WITH CHECK (auth.jwt()->>'role' = 'admin');

CREATE POLICY "Allow admin update on allergens"
ON allergens FOR UPDATE
TO authenticated
USING (auth.jwt()->>'role' = 'admin')
WITH CHECK (auth.jwt()->>'role' = 'admin');

CREATE POLICY "Allow admin delete on allergens"
ON allergens FOR DELETE
TO authenticated
USING (auth.jwt()->>'role' = 'admin');

CREATE POLICY "Allow admin insert on dietary_tags"
ON dietary_tags FOR INSERT
TO authenticated
WITH CHECK (auth.jwt()->>'role' = 'admin');

CREATE POLICY "Allow admin update on dietary_tags"
ON dietary_tags FOR UPDATE
TO authenticated
USING (auth.jwt()->>'role' = 'admin')
WITH CHECK (auth.jwt()->>'role' = 'admin');

CREATE POLICY "Allow admin delete on dietary_tags"
ON dietary_tags FOR DELETE
TO authenticated
USING (auth.jwt()->>'role' = 'admin');

CREATE POLICY "Allow admin insert on ingredients_master"
ON ingredients_master FOR INSERT
TO authenticated
WITH CHECK (auth.jwt()->>'role' = 'admin');

CREATE POLICY "Allow admin update on ingredients_master"
ON ingredients_master FOR UPDATE
TO authenticated
USING (auth.jwt()->>'role' = 'admin')
WITH CHECK (auth.jwt()->>'role' = 'admin');

CREATE POLICY "Allow admin delete on ingredients_master"
ON ingredients_master FOR DELETE
TO authenticated
USING (auth.jwt()->>'role' = 'admin');

CREATE POLICY "Allow admin insert on ingredient_allergens"
ON ingredient_allergens FOR INSERT
TO authenticated
WITH CHECK (auth.jwt()->>'role' = 'admin');

CREATE POLICY "Allow admin delete on ingredient_allergens"
ON ingredient_allergens FOR DELETE
TO authenticated
USING (auth.jwt()->>'role' = 'admin');

CREATE POLICY "Allow admin insert on ingredient_dietary_tags"
ON ingredient_dietary_tags FOR INSERT
TO authenticated
WITH CHECK (auth.jwt()->>'role' = 'admin');

CREATE POLICY "Allow admin delete on ingredient_dietary_tags"
ON ingredient_dietary_tags FOR DELETE
TO authenticated
USING (auth.jwt()->>'role' = 'admin');

-- ============================================================================
-- SEED DATA: ALLERGENS (FDA Major + Common)
-- ============================================================================

INSERT INTO allergens (code, name, icon) VALUES
-- FDA Major Allergens (Top 9)
('milk', 'Milk & Dairy Products', '🥛'),
('eggs', 'Eggs', '🥚'),
('fish', 'Fish', '🐟'),
('shellfish', 'Shellfish', '🦐'),
('tree_nuts', 'Tree Nuts', '🌰'),
('peanuts', 'Peanuts', '🥜'),
('wheat', 'Wheat', '🌾'),
('soybeans', 'Soybeans', '🫘'),
('sesame', 'Sesame Seeds', '🌰'),
-- Common Additional Allergens
('gluten', 'Gluten', '🌾'),
('lactose', 'Lactose', '🥛'),
('sulfites', 'Sulfites', '🍷'),
('mustard', 'Mustard', '🌭'),
('celery', 'Celery', '🥬')
ON CONFLICT (code) DO NOTHING;

-- ============================================================================
-- SEED DATA: DIETARY TAGS
-- ============================================================================

INSERT INTO dietary_tags (code, name, icon, category) VALUES
-- Diet-based
('vegetarian', 'Vegetarian', '🥗', 'diet'),
('vegan', 'Vegan', '🌱', 'diet'),
('pescatarian', 'Pescatarian', '🐟', 'diet'),
('keto', 'Keto-Friendly', '🥑', 'diet'),
('paleo', 'Paleo', '🥩', 'diet'),
('low_carb', 'Low-Carb', '📉', 'diet'),
('gluten_free', 'Gluten-Free', '🌾', 'health'),
('dairy_free', 'Dairy-Free', '🚫🥛', 'health'),
-- Religious
('halal', 'Halal', '☪️', 'religious'),
('kosher', 'Kosher', '✡️', 'religious'),
('hindu', 'Hindu Vegetarian', '🕉️', 'religious'),
('jain', 'Jain', '☸️', 'religious'),
-- Health/Lifestyle
('organic', 'Organic', '🌿', 'lifestyle'),
('raw', 'Raw', '🥗', 'lifestyle'),
('diabetic_friendly', 'Diabetic-Friendly', '🩺', 'health'),
('heart_healthy', 'Heart-Healthy', '❤️', 'health')
ON CONFLICT (code) DO NOTHING;

-- ============================================================================
-- SEED DATA: COMMON INGREDIENTS (~100 items)
-- ============================================================================

INSERT INTO ingredients_master (name, name_variants, category, is_vegetarian, is_vegan) VALUES
-- Vegetables
('Tomato', ARRAY['tomatoes', 'roma tomato', 'cherry tomato'], 'vegetable', true, true),
('Onion', ARRAY['onions', 'yellow onion', 'white onion'], 'vegetable', true, true),
('Garlic', ARRAY['garlic cloves', 'fresh garlic'], 'vegetable', true, true),
('Bell Pepper', ARRAY['sweet pepper', 'capsicum', 'red pepper', 'green pepper'], 'vegetable', true, true),
('Carrot', ARRAY['carrots'], 'vegetable', true, true),
('Potato', ARRAY['potatoes', 'white potato', 'russet potato'], 'vegetable', true, true),
('Lettuce', ARRAY['green lettuce', 'iceberg lettuce', 'romaine lettuce'], 'vegetable', true, true),
('Cucumber', ARRAY['cucumbers'], 'vegetable', true, true),
('Spinach', ARRAY['fresh spinach', 'baby spinach'], 'vegetable', true, true),
('Broccoli', ARRAY['broccoli florets'], 'vegetable', true, true),
('Mushroom', ARRAY['mushrooms', 'button mushroom', 'portobello'], 'vegetable', true, true),
('Zucchini', ARRAY['zucchinis', 'courgette'], 'vegetable', true, true),
('Green Onion', ARRAY['scallion', 'spring onion', 'green onions'], 'vegetable', true, true),
('Celery', ARRAY['celery stalks'], 'vegetable', true, true),
('Cauliflower', ARRAY['cauliflower florets'], 'vegetable', true, true),
-- Proteins
('Chicken Breast', ARRAY['chicken', 'chicken breasts'], 'protein', false, false),
('Beef', ARRAY['ground beef', 'beef steak', 'sirloin'], 'protein', false, false),
('Pork', ARRAY['pork chop', 'pork loin'], 'protein', false, false),
('Salmon', ARRAY['salmon fillet', 'fresh salmon'], 'protein', false, false),
('Shrimp', ARRAY['prawns', 'jumbo shrimp'], 'protein', false, false),
('Tuna', ARRAY['tuna steak', 'canned tuna'], 'protein', false, false),
('Eggs', ARRAY['egg', 'chicken eggs', 'whole eggs'], 'protein', true, false),
('Tofu', ARRAY['bean curd', 'firm tofu', 'silken tofu'], 'protein', true, true),
('Black Beans', ARRAY['black bean', 'frijoles negros'], 'protein', true, true),
('Chickpeas', ARRAY['garbanzo beans', 'chana'], 'protein', true, true),
('Lentils', ARRAY['red lentils', 'green lentils'], 'protein', true, true),
-- Grains
('Rice', ARRAY['white rice', 'jasmine rice', 'basmati rice'], 'grain', true, true),
('Pasta', ARRAY['spaghetti', 'penne', 'noodles'], 'grain', true, true),
('Bread', ARRAY['white bread', 'whole wheat bread'], 'grain', true, false),
('Quinoa', ARRAY['white quinoa', 'red quinoa'], 'grain', true, true),
('Oats', ARRAY['rolled oats', 'oatmeal'], 'grain', true, true),
('Flour', ARRAY['all-purpose flour', 'wheat flour'], 'grain', true, true),
('Tortilla', ARRAY['flour tortilla', 'corn tortilla', 'wrap'], 'grain', true, true),
-- Dairy
('Milk', ARRAY['whole milk', 'skim milk', '2% milk'], 'dairy', true, false),
('Cheese', ARRAY['cheddar cheese', 'mozzarella', 'parmesan'], 'dairy', true, false),
('Butter', ARRAY['unsalted butter', 'salted butter'], 'dairy', true, false),
('Yogurt', ARRAY['greek yogurt', 'plain yogurt'], 'dairy', true, false),
('Cream', ARRAY['heavy cream', 'whipping cream', 'sour cream'], 'dairy', true, false),
-- Fruits
('Apple', ARRAY['apples', 'green apple', 'red apple'], 'fruit', true, true),
('Banana', ARRAY['bananas'], 'fruit', true, true),
('Lemon', ARRAY['lemons', 'lemon juice'], 'fruit', true, true),
('Lime', ARRAY['limes', 'lime juice'], 'fruit', true, true),
('Orange', ARRAY['oranges', 'orange juice'], 'fruit', true, true),
('Strawberry', ARRAY['strawberries', 'fresh strawberries'], 'fruit', true, true),
('Avocado', ARRAY['avocados', 'fresh avocado'], 'fruit', true, true),
('Mango', ARRAY['mangos', 'fresh mango'], 'fruit', true, true),
-- Spices & Herbs
('Salt', ARRAY['sea salt', 'table salt', 'kosher salt'], 'spice', true, true),
('Black Pepper', ARRAY['ground pepper', 'peppercorns'], 'spice', true, true),
('Cumin', ARRAY['ground cumin', 'cumin seeds'], 'spice', true, true),
('Paprika', ARRAY['smoked paprika', 'sweet paprika'], 'spice', true, true),
('Oregano', ARRAY['dried oregano', 'fresh oregano'], 'herb', true, true),
('Basil', ARRAY['fresh basil', 'dried basil'], 'herb', true, true),
('Cilantro', ARRAY['coriander leaves', 'fresh cilantro'], 'herb', true, true),
('Parsley', ARRAY['fresh parsley', 'dried parsley'], 'herb', true, true),
('Thyme', ARRAY['fresh thyme', 'dried thyme'], 'herb', true, true),
('Rosemary', ARRAY['fresh rosemary', 'dried rosemary'], 'herb', true, true),
('Cinnamon', ARRAY['ground cinnamon', 'cinnamon sticks'], 'spice', true, true),
('Ginger', ARRAY['fresh ginger', 'ginger root'], 'spice', true, true),
('Chili Powder', ARRAY['chilli powder', 'ground chili'], 'spice', true, true),
-- Condiments & Sauces
('Olive Oil', ARRAY['extra virgin olive oil', 'EVOO'], 'oil', true, true),
('Vegetable Oil', ARRAY['canola oil', 'cooking oil'], 'oil', true, true),
('Soy Sauce', ARRAY['shoyu', 'tamari'], 'condiment', true, true),
('Vinegar', ARRAY['white vinegar', 'apple cider vinegar', 'balsamic vinegar'], 'condiment', true, true),
('Honey', ARRAY['raw honey', 'organic honey'], 'sweetener', true, false),
('Sugar', ARRAY['white sugar', 'granulated sugar', 'cane sugar'], 'sweetener', true, true),
('Ketchup', ARRAY['tomato ketchup', 'catsup'], 'condiment', true, true),
('Mayonnaise', ARRAY['mayo'], 'condiment', true, false),
('Mustard', ARRAY['yellow mustard', 'dijon mustard'], 'condiment', true, true),
-- Nuts & Seeds
('Almonds', ARRAY['almond', 'sliced almonds'], 'protein', true, true),
('Walnuts', ARRAY['walnut'], 'protein', true, true),
('Peanuts', ARRAY['peanut', 'roasted peanuts'], 'protein', true, true),
('Cashews', ARRAY['cashew'], 'protein', true, true),
('Sesame Seeds', ARRAY['sesame', 'white sesame', 'black sesame'], 'spice', true, true),
('Chia Seeds', ARRAY['chia'], 'spice', true, true),
-- Beverages
('Water', ARRAY['drinking water', 'filtered water'], 'beverage', true, true),
('Coffee', ARRAY['ground coffee', 'espresso'], 'beverage', true, true),
('Tea', ARRAY['green tea', 'black tea'], 'beverage', true, true),
('Coconut Milk', ARRAY['coconut cream'], 'beverage', true, true),
('Almond Milk', ARRAY['unsweetened almond milk'], 'beverage', true, true)
ON CONFLICT (name) DO NOTHING;

-- ============================================================================
-- LINK INGREDIENTS TO ALLERGENS
-- ============================================================================

-- Get IDs for linking (we'll use them in the INSERT statements)
DO $$
DECLARE
  milk_allergen_id UUID;
  eggs_allergen_id UUID;
  fish_allergen_id UUID;
  shellfish_allergen_id UUID;
  tree_nuts_allergen_id UUID;
  peanuts_allergen_id UUID;
  wheat_allergen_id UUID;
  soybeans_allergen_id UUID;
  sesame_allergen_id UUID;
  gluten_allergen_id UUID;
  lactose_allergen_id UUID;
  celery_allergen_id UUID;
BEGIN
  -- Get allergen IDs
  SELECT id INTO milk_allergen_id FROM allergens WHERE code = 'milk';
  SELECT id INTO eggs_allergen_id FROM allergens WHERE code = 'eggs';
  SELECT id INTO fish_allergen_id FROM allergens WHERE code = 'fish';
  SELECT id INTO shellfish_allergen_id FROM allergens WHERE code = 'shellfish';
  SELECT id INTO tree_nuts_allergen_id FROM allergens WHERE code = 'tree_nuts';
  SELECT id INTO peanuts_allergen_id FROM allergens WHERE code = 'peanuts';
  SELECT id INTO wheat_allergen_id FROM allergens WHERE code = 'wheat';
  SELECT id INTO soybeans_allergen_id FROM allergens WHERE code = 'soybeans';
  SELECT id INTO sesame_allergen_id FROM allergens WHERE code = 'sesame';
  SELECT id INTO gluten_allergen_id FROM allergens WHERE code = 'gluten';
  SELECT id INTO lactose_allergen_id FROM allergens WHERE code = 'lactose';
  SELECT id INTO celery_allergen_id FROM allergens WHERE code = 'celery';

  -- Link dairy products to milk/lactose
  INSERT INTO ingredient_allergens (ingredient_id, allergen_id)
  SELECT id, milk_allergen_id FROM ingredients_master WHERE name IN ('Milk', 'Cheese', 'Butter', 'Yogurt', 'Cream', 'Mayonnaise')
  ON CONFLICT DO NOTHING;

  INSERT INTO ingredient_allergens (ingredient_id, allergen_id)
  SELECT id, lactose_allergen_id FROM ingredients_master WHERE name IN ('Milk', 'Yogurt', 'Cream')
  ON CONFLICT DO NOTHING;

  -- Link eggs
  INSERT INTO ingredient_allergens (ingredient_id, allergen_id)
  SELECT id, eggs_allergen_id FROM ingredients_master WHERE name IN ('Eggs', 'Mayonnaise', 'Bread')
  ON CONFLICT DO NOTHING;

  -- Link fish
  INSERT INTO ingredient_allergens (ingredient_id, allergen_id)
  SELECT id, fish_allergen_id FROM ingredients_master WHERE name IN ('Salmon', 'Tuna')
  ON CONFLICT DO NOTHING;

  -- Link shellfish
  INSERT INTO ingredient_allergens (ingredient_id, allergen_id)
  SELECT id, shellfish_allergen_id FROM ingredients_master WHERE name = 'Shrimp'
  ON CONFLICT DO NOTHING;

  -- Link tree nuts
  INSERT INTO ingredient_allergens (ingredient_id, allergen_id)
  SELECT id, tree_nuts_allergen_id FROM ingredients_master WHERE name IN ('Almonds', 'Walnuts', 'Cashews')
  ON CONFLICT DO NOTHING;

  -- Link peanuts
  INSERT INTO ingredient_allergens (ingredient_id, allergen_id)
  SELECT id, peanuts_allergen_id FROM ingredients_master WHERE name = 'Peanuts'
  ON CONFLICT DO NOTHING;

  -- Link wheat/gluten
  INSERT INTO ingredient_allergens (ingredient_id, allergen_id)
  SELECT id, wheat_allergen_id FROM ingredients_master WHERE name IN ('Bread', 'Pasta', 'Flour', 'Tortilla')
  ON CONFLICT DO NOTHING;

  INSERT INTO ingredient_allergens (ingredient_id, allergen_id)
  SELECT id, gluten_allergen_id FROM ingredients_master WHERE name IN ('Bread', 'Pasta', 'Flour', 'Tortilla')
  ON CONFLICT DO NOTHING;

  -- Link soybeans
  INSERT INTO ingredient_allergens (ingredient_id, allergen_id)
  SELECT id, soybeans_allergen_id FROM ingredients_master WHERE name IN ('Tofu', 'Soy Sauce')
  ON CONFLICT DO NOTHING;

  -- Link sesame
  INSERT INTO ingredient_allergens (ingredient_id, allergen_id)
  SELECT id, sesame_allergen_id FROM ingredients_master WHERE name = 'Sesame Seeds'
  ON CONFLICT DO NOTHING;

  -- Link celery
  INSERT INTO ingredient_allergens (ingredient_id, allergen_id)
  SELECT id, celery_allergen_id FROM ingredients_master WHERE name = 'Celery'
  ON CONFLICT DO NOTHING;
END $$;

-- ============================================================================
-- LINK INGREDIENTS TO DIETARY TAGS
-- ============================================================================

DO $$
DECLARE
  vegan_tag_id UUID;
  vegetarian_tag_id UUID;
  gluten_free_tag_id UUID;
  dairy_free_tag_id UUID;
BEGIN
  -- Get dietary tag IDs
  SELECT id INTO vegan_tag_id FROM dietary_tags WHERE code = 'vegan';
  SELECT id INTO vegetarian_tag_id FROM dietary_tags WHERE code = 'vegetarian';
  SELECT id INTO gluten_free_tag_id FROM dietary_tags WHERE code = 'gluten_free';
  SELECT id INTO dairy_free_tag_id FROM dietary_tags WHERE code = 'dairy_free';

  -- Link vegan ingredients
  INSERT INTO ingredient_dietary_tags (ingredient_id, dietary_tag_id)
  SELECT id, vegan_tag_id FROM ingredients_master WHERE is_vegan = true
  ON CONFLICT DO NOTHING;

  -- Link vegetarian ingredients
  INSERT INTO ingredient_dietary_tags (ingredient_id, dietary_tag_id)
  SELECT id, vegetarian_tag_id FROM ingredients_master WHERE is_vegetarian = true
  ON CONFLICT DO NOTHING;

  -- Link gluten-free ingredients (no wheat/gluten allergen)
  INSERT INTO ingredient_dietary_tags (ingredient_id, dietary_tag_id)
  SELECT i.id, gluten_free_tag_id
  FROM ingredients_master i
  WHERE i.id NOT IN (
    SELECT ia.ingredient_id
    FROM ingredient_allergens ia
    JOIN allergens a ON ia.allergen_id = a.id
    WHERE a.code IN ('wheat', 'gluten')
  )
  ON CONFLICT DO NOTHING;

  -- Link dairy-free ingredients (no milk allergen)
  INSERT INTO ingredient_dietary_tags (ingredient_id, dietary_tag_id)
  SELECT i.id, dairy_free_tag_id
  FROM ingredients_master i
  WHERE i.id NOT IN (
    SELECT ia.ingredient_id
    FROM ingredient_allergens ia
    JOIN allergens a ON ia.allergen_id = a.id
    WHERE a.code = 'milk'
  )
  ON CONFLICT DO NOTHING;
END $$;

-- ============================================================================
-- SUCCESS MESSAGE
-- ============================================================================

DO $$ 
BEGIN
  RAISE NOTICE '========================================';
  RAISE NOTICE 'Ingredients Master System Created!';
  RAISE NOTICE '========================================';
  RAISE NOTICE 'Tables created:';
  RAISE NOTICE '  ✓ allergens (% rows)', (SELECT COUNT(*) FROM allergens);
  RAISE NOTICE '  ✓ dietary_tags (% rows)', (SELECT COUNT(*) FROM dietary_tags);
  RAISE NOTICE '  ✓ ingredients_master (% rows)', (SELECT COUNT(*) FROM ingredients_master);
  RAISE NOTICE '  ✓ ingredient_allergens (% rows)', (SELECT COUNT(*) FROM ingredient_allergens);
  RAISE NOTICE '  ✓ ingredient_dietary_tags (% rows)', (SELECT COUNT(*) FROM ingredient_dietary_tags);
  RAISE NOTICE '========================================';
  RAISE NOTICE 'Features:';
  RAISE NOTICE '  ✓ Full-text search for autocomplete';
  RAISE NOTICE '  ✓ Allergen tracking';
  RAISE NOTICE '  ✓ Dietary tag classification';
  RAISE NOTICE '  ✓ RLS policies (public read, admin write)';
  RAISE NOTICE '  ✓ Auto-updating timestamps';
  RAISE NOTICE '========================================';
END $$;
