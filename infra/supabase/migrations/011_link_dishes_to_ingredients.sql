-- Link Dishes to Ingredients System
-- Created: 2026-01-27
-- Description: Creates junction table between dishes and ingredients, adds allergen/dietary tag columns to dishes

-- ============================================================================
-- ADD ALLERGENS AND DIETARY TAGS TO DISHES TABLE
-- ============================================================================

DO $$ 
BEGIN
  -- Add allergens column if it doesn't exist
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'dishes' AND column_name = 'allergens'
  ) THEN
    ALTER TABLE dishes ADD COLUMN allergens TEXT[] DEFAULT ARRAY[]::TEXT[];
    COMMENT ON COLUMN dishes.allergens IS 'Array of allergen codes (e.g., ["milk", "eggs", "gluten"])';
  END IF;

  -- Add dietary_tags column if it doesn't exist
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'dishes' AND column_name = 'dietary_tags'
  ) THEN
    ALTER TABLE dishes ADD COLUMN dietary_tags TEXT[] DEFAULT ARRAY[]::TEXT[];
    COMMENT ON COLUMN dishes.dietary_tags IS 'Array of dietary tag codes (e.g., ["vegan", "gluten_free", "halal"])';
  END IF;
END $$;

-- ============================================================================
-- CREATE DISH_INGREDIENTS JUNCTION TABLE
-- ============================================================================

CREATE TABLE IF NOT EXISTS dish_ingredients (
  dish_id UUID REFERENCES dishes(id) ON DELETE CASCADE,
  ingredient_id UUID REFERENCES ingredients_master(id) ON DELETE CASCADE,
  quantity TEXT, -- Optional: "2 cups", "100g", "1 tsp", etc.
  created_at TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY (dish_id, ingredient_id)
);

COMMENT ON TABLE dish_ingredients IS 'Links dishes to ingredients for allergen tracking and dietary classification';
COMMENT ON COLUMN dish_ingredients.quantity IS 'Optional quantity with unit (e.g., "2 cups", "100g", "1 tsp")';

-- ============================================================================
-- INDEXES FOR PERFORMANCE
-- ============================================================================

CREATE INDEX IF NOT EXISTS dish_ingredients_dish_idx ON dish_ingredients(dish_id);
CREATE INDEX IF NOT EXISTS dish_ingredients_ingredient_idx ON dish_ingredients(ingredient_id);
CREATE INDEX IF NOT EXISTS dishes_allergens_idx ON dishes USING GIN(allergens);
CREATE INDEX IF NOT EXISTS dishes_dietary_tags_idx ON dishes USING GIN(dietary_tags);

-- ============================================================================
-- ROW LEVEL SECURITY (RLS)
-- ============================================================================

ALTER TABLE dish_ingredients ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Allow public read access to dish_ingredients" ON dish_ingredients;
DROP POLICY IF EXISTS "Allow owners to manage dish_ingredients" ON dish_ingredients;

-- Public can read all dish ingredients
CREATE POLICY "Allow public read access to dish_ingredients"
ON dish_ingredients FOR SELECT
TO public
USING (true);

-- Restaurant owners can manage their dish ingredients
CREATE POLICY "Allow owners to manage dish_ingredients"
ON dish_ingredients FOR ALL
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM dishes d
    JOIN menus m ON d.menu_id = m.id
    JOIN restaurants r ON m.restaurant_id = r.id
    WHERE d.id = dish_ingredients.dish_id
    AND r.owner_id = auth.uid()
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM dishes d
    JOIN menus m ON d.menu_id = m.id
    JOIN restaurants r ON m.restaurant_id = r.id
    WHERE d.id = dish_ingredients.dish_id
    AND r.owner_id = auth.uid()
  )
);

-- ============================================================================
-- HELPER FUNCTION: AUTO-CALCULATE ALLERGENS FROM INGREDIENTS
-- ============================================================================

CREATE OR REPLACE FUNCTION calculate_dish_allergens(p_dish_id UUID)
RETURNS TEXT[] AS $$
DECLARE
  allergen_codes TEXT[];
BEGIN
  -- Get all unique allergen codes from dish ingredients
  SELECT array_agg(DISTINCT a.code ORDER BY a.code)
  INTO allergen_codes
  FROM dish_ingredients di
  JOIN ingredient_allergens ia ON di.ingredient_id = ia.ingredient_id
  JOIN allergens a ON ia.allergen_id = a.id
  WHERE di.dish_id = p_dish_id;
  
  RETURN COALESCE(allergen_codes, ARRAY[]::TEXT[]);
END;
$$ LANGUAGE plpgsql STABLE;

COMMENT ON FUNCTION calculate_dish_allergens IS 'Calculates allergens for a dish based on its ingredients';

-- ============================================================================
-- HELPER FUNCTION: AUTO-CALCULATE DIETARY TAGS FROM INGREDIENTS
-- ============================================================================

CREATE OR REPLACE FUNCTION calculate_dish_dietary_tags(p_dish_id UUID)
RETURNS TEXT[] AS $$
DECLARE
  dietary_tag_codes TEXT[];
  total_ingredients INTEGER;
  ingredient_count INTEGER;
BEGIN
  -- Count total ingredients in the dish
  SELECT COUNT(*) INTO total_ingredients
  FROM dish_ingredients
  WHERE dish_id = p_dish_id;
  
  -- If no ingredients, return empty array
  IF total_ingredients = 0 THEN
    RETURN ARRAY[]::TEXT[];
  END IF;
  
  -- Get dietary tags where ALL ingredients have the tag
  SELECT array_agg(DISTINCT dt.code ORDER BY dt.code)
  INTO dietary_tag_codes
  FROM dietary_tags dt
  WHERE dt.id IN (
    -- For each dietary tag, check if ALL dish ingredients have it
    SELECT idt.dietary_tag_id
    FROM ingredient_dietary_tags idt
    WHERE idt.ingredient_id IN (
      SELECT di.ingredient_id
      FROM dish_ingredients di
      WHERE di.dish_id = p_dish_id
    )
    GROUP BY idt.dietary_tag_id
    HAVING COUNT(DISTINCT idt.ingredient_id) = total_ingredients
  );
  
  RETURN COALESCE(dietary_tag_codes, ARRAY[]::TEXT[]);
END;
$$ LANGUAGE plpgsql STABLE;

COMMENT ON FUNCTION calculate_dish_dietary_tags IS 'Calculates dietary tags for a dish - only includes tags where ALL ingredients qualify';

-- ============================================================================
-- TRIGGER: AUTO-UPDATE DISH ALLERGENS AND DIETARY TAGS
-- ============================================================================

CREATE OR REPLACE FUNCTION update_dish_attributes()
RETURNS TRIGGER AS $$
BEGIN
  -- Update allergens and dietary tags for the affected dish
  UPDATE dishes
  SET 
    allergens = calculate_dish_allergens(COALESCE(NEW.dish_id, OLD.dish_id)),
    dietary_tags = calculate_dish_dietary_tags(COALESCE(NEW.dish_id, OLD.dish_id))
  WHERE id = COALESCE(NEW.dish_id, OLD.dish_id);
  
  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS dish_ingredients_update_attributes ON dish_ingredients;
CREATE TRIGGER dish_ingredients_update_attributes
AFTER INSERT OR UPDATE OR DELETE ON dish_ingredients
FOR EACH ROW
EXECUTE FUNCTION update_dish_attributes();

COMMENT ON TRIGGER dish_ingredients_update_attributes ON dish_ingredients IS 'Automatically updates dish allergens and dietary tags when ingredients change';

-- ============================================================================
-- SUCCESS MESSAGE
-- ============================================================================

DO $$ 
BEGIN
  RAISE NOTICE '========================================';
  RAISE NOTICE 'Dish-Ingredient Integration Complete!';
  RAISE NOTICE '========================================';
  RAISE NOTICE 'Changes:';
  RAISE NOTICE '  ✓ Added allergens column to dishes table';
  RAISE NOTICE '  ✓ Added dietary_tags column to dishes table';
  RAISE NOTICE '  ✓ Created dish_ingredients junction table';
  RAISE NOTICE '  ✓ Added RLS policies for dish_ingredients';
  RAISE NOTICE '  ✓ Created helper functions for auto-calculation';
  RAISE NOTICE '  ✓ Added trigger for auto-updating dish attributes';
  RAISE NOTICE '========================================';
  RAISE NOTICE 'Usage:';
  RAISE NOTICE '  - Add ingredients to dish via dish_ingredients table';
  RAISE NOTICE '  - Allergens and dietary tags auto-calculate';
  RAISE NOTICE '  - Use calculate_dish_allergens(dish_id) manually if needed';
  RAISE NOTICE '========================================';
END $$;
