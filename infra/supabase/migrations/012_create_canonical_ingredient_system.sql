-- Create Canonical Ingredient System
-- Description: Implements a canonical ingredient system where multiple display names
--              (aliases) map to single canonical ingredients for diet logic, allergens, etc.

-- ============================================================================
-- CANONICAL INGREDIENTS TABLE
-- ============================================================================
-- This table stores the "true" ingredients used for all logic
-- Example: "tomato" is canonical, "roma tomato" and "cherry tomato" are aliases

CREATE TABLE IF NOT EXISTS canonical_ingredients (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  canonical_name TEXT UNIQUE NOT NULL,
  is_vegetarian BOOLEAN DEFAULT true,
  is_vegan BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

COMMENT ON TABLE canonical_ingredients IS 'Master list of canonical ingredients. All diet logic, allergens, and recommendations use these IDs.';
COMMENT ON COLUMN canonical_ingredients.canonical_name IS 'Stable, never-changing identifier (e.g., "tomato", "onion", "chicken")';

-- ============================================================================
-- INGREDIENT ALIASES TABLE
-- ============================================================================
-- Maps user-visible display names to canonical ingredients (many-to-one)
-- Example: "Roma Tomato" → canonical "tomato", "Cherry Tomato" → canonical "tomato"

CREATE TABLE IF NOT EXISTS ingredient_aliases (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  display_name TEXT UNIQUE NOT NULL,
  canonical_ingredient_id UUID NOT NULL REFERENCES canonical_ingredients(id) ON DELETE CASCADE,
  search_vector TSVECTOR,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

COMMENT ON TABLE ingredient_aliases IS 'User-visible ingredient names that map to canonical ingredients';
COMMENT ON COLUMN ingredient_aliases.display_name IS 'What users see in the UI (e.g., "Roma Tomato", "Scallions")';
COMMENT ON COLUMN ingredient_aliases.canonical_ingredient_id IS 'FK to canonical_ingredients - multiple aliases can point to same canonical';

-- ============================================================================
-- JUNCTION TABLES (Updated to use canonical ingredients)
-- ============================================================================

-- Canonical Ingredients <-> Allergens
CREATE TABLE IF NOT EXISTS canonical_ingredient_allergens (
  canonical_ingredient_id UUID REFERENCES canonical_ingredients(id) ON DELETE CASCADE,
  allergen_id UUID REFERENCES allergens(id) ON DELETE CASCADE,
  PRIMARY KEY (canonical_ingredient_id, allergen_id)
);

COMMENT ON TABLE canonical_ingredient_allergens IS 'Links canonical ingredients to allergens';

-- Canonical Ingredients <-> Dietary Tags
CREATE TABLE IF NOT EXISTS canonical_ingredient_dietary_tags (
  canonical_ingredient_id UUID REFERENCES canonical_ingredients(id) ON DELETE CASCADE,
  dietary_tag_id UUID REFERENCES dietary_tags(id) ON DELETE CASCADE,
  PRIMARY KEY (canonical_ingredient_id, dietary_tag_id)
);

COMMENT ON TABLE canonical_ingredient_dietary_tags IS 'Links canonical ingredients to dietary classifications';

-- ============================================================================
-- INDEXES
-- ============================================================================

CREATE INDEX IF NOT EXISTS canonical_ingredients_name_idx ON canonical_ingredients(canonical_name);
CREATE INDEX IF NOT EXISTS canonical_ingredients_name_lower_idx ON canonical_ingredients(LOWER(canonical_name));

CREATE INDEX IF NOT EXISTS ingredient_aliases_display_name_idx ON ingredient_aliases(display_name);
CREATE INDEX IF NOT EXISTS ingredient_aliases_display_name_lower_idx ON ingredient_aliases(LOWER(display_name));
CREATE INDEX IF NOT EXISTS ingredient_aliases_canonical_idx ON ingredient_aliases(canonical_ingredient_id);
CREATE INDEX IF NOT EXISTS ingredient_aliases_search_idx ON ingredient_aliases USING GIN(search_vector);

CREATE INDEX IF NOT EXISTS canonical_ingredient_allergens_canonical_idx ON canonical_ingredient_allergens(canonical_ingredient_id);
CREATE INDEX IF NOT EXISTS canonical_ingredient_allergens_allergen_idx ON canonical_ingredient_allergens(allergen_id);

CREATE INDEX IF NOT EXISTS canonical_ingredient_dietary_tags_canonical_idx ON canonical_ingredient_dietary_tags(canonical_ingredient_id);
CREATE INDEX IF NOT EXISTS canonical_ingredient_dietary_tags_tag_idx ON canonical_ingredient_dietary_tags(dietary_tag_id);

-- ============================================================================
-- TRIGGERS
-- ============================================================================

-- Update search vector for aliases
CREATE OR REPLACE FUNCTION update_alias_search_vector()
RETURNS TRIGGER AS $$
BEGIN
  NEW.search_vector := to_tsvector('english', COALESCE(NEW.display_name, ''));
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS alias_search_vector_update ON ingredient_aliases;
CREATE TRIGGER alias_search_vector_update
BEFORE INSERT OR UPDATE ON ingredient_aliases
FOR EACH ROW
EXECUTE FUNCTION update_alias_search_vector();

-- Auto-update timestamps
DROP TRIGGER IF EXISTS canonical_ingredients_updated_at ON canonical_ingredients;
CREATE TRIGGER canonical_ingredients_updated_at
BEFORE UPDATE ON canonical_ingredients
FOR EACH ROW
EXECUTE FUNCTION update_updated_at();

DROP TRIGGER IF EXISTS ingredient_aliases_updated_at ON ingredient_aliases;
CREATE TRIGGER ingredient_aliases_updated_at
BEFORE UPDATE ON ingredient_aliases
FOR EACH ROW
EXECUTE FUNCTION update_updated_at();

-- ============================================================================
-- ROW LEVEL SECURITY
-- ============================================================================

ALTER TABLE canonical_ingredients ENABLE ROW LEVEL SECURITY;
ALTER TABLE ingredient_aliases ENABLE ROW LEVEL SECURITY;
ALTER TABLE canonical_ingredient_allergens ENABLE ROW LEVEL SECURITY;
ALTER TABLE canonical_ingredient_dietary_tags ENABLE ROW LEVEL SECURITY;

-- Public read access
CREATE POLICY "Allow public read access to canonical_ingredients"
ON canonical_ingredients FOR SELECT TO public USING (true);

CREATE POLICY "Allow public read access to ingredient_aliases"
ON ingredient_aliases FOR SELECT TO public USING (true);

CREATE POLICY "Allow public read access to canonical_ingredient_allergens"
ON canonical_ingredient_allergens FOR SELECT TO public USING (true);

CREATE POLICY "Allow public read access to canonical_ingredient_dietary_tags"
ON canonical_ingredient_dietary_tags FOR SELECT TO public USING (true);

-- Admin write access
CREATE POLICY "Allow admin write on canonical_ingredients"
ON canonical_ingredients FOR ALL TO authenticated
USING (auth.jwt()->>'role' = 'admin')
WITH CHECK (auth.jwt()->>'role' = 'admin');

CREATE POLICY "Allow admin write on ingredient_aliases"
ON ingredient_aliases FOR ALL TO authenticated
USING (auth.jwt()->>'role' = 'admin')
WITH CHECK (auth.jwt()->>'role' = 'admin');

CREATE POLICY "Allow admin write on canonical_ingredient_allergens"
ON canonical_ingredient_allergens FOR ALL TO authenticated
USING (auth.jwt()->>'role' = 'admin')
WITH CHECK (auth.jwt()->>'role' = 'admin');

CREATE POLICY "Allow admin write on canonical_ingredient_dietary_tags"
ON canonical_ingredient_dietary_tags FOR ALL TO authenticated
USING (auth.jwt()->>'role' = 'admin')
WITH CHECK (auth.jwt()->>'role' = 'admin');

-- ============================================================================
-- MIGRATE DATA FROM OLD SYSTEM
-- ============================================================================

DO $$
DECLARE
  ingredient_record RECORD;
  canonical_id UUID;
BEGIN
  -- Migrate each ingredient from ingredients_master to canonical system
  FOR ingredient_record IN SELECT * FROM ingredients_master LOOP
    -- Create canonical ingredient
    INSERT INTO canonical_ingredients (canonical_name, is_vegetarian, is_vegan)
    VALUES (LOWER(REPLACE(ingredient_record.name, ' ', '_')), ingredient_record.is_vegetarian, ingredient_record.is_vegan)
    RETURNING id INTO canonical_id;
    
    -- Create alias with original display name
    INSERT INTO ingredient_aliases (display_name, canonical_ingredient_id)
    VALUES (ingredient_record.name, canonical_id);
    
    -- Migrate allergen relationships
    INSERT INTO canonical_ingredient_allergens (canonical_ingredient_id, allergen_id)
    SELECT canonical_id, ia.allergen_id
    FROM ingredient_allergens ia
    WHERE ia.ingredient_id = ingredient_record.id;
    
    -- Migrate dietary tag relationships
    INSERT INTO canonical_ingredient_dietary_tags (canonical_ingredient_id, dietary_tag_id)
    SELECT canonical_id, idt.dietary_tag_id
    FROM ingredient_dietary_tags idt
    WHERE idt.ingredient_id = ingredient_record.id;
  END LOOP;
  
  RAISE NOTICE 'Migrated % ingredients from old system', (SELECT COUNT(*) FROM ingredients_master);
END $$;

-- ============================================================================
-- SEED ADDITIONAL ALIASES (Examples)
-- ============================================================================

-- Add common aliases for existing ingredients
DO $$
DECLARE
  tomato_id UUID;
  onion_id UUID;
  chicken_id UUID;
BEGIN
  -- Get canonical IDs
  SELECT id INTO tomato_id FROM canonical_ingredients WHERE canonical_name = 'tomato';
  SELECT id INTO onion_id FROM canonical_ingredients WHERE canonical_name = 'onion';
  SELECT id INTO chicken_id FROM canonical_ingredients WHERE canonical_name = 'chicken_breast';
  
  -- Add tomato aliases
  IF tomato_id IS NOT NULL THEN
    INSERT INTO ingredient_aliases (display_name, canonical_ingredient_id) VALUES
    ('Roma Tomato', tomato_id),
    ('Cherry Tomato', tomato_id),
    ('Grape Tomato', tomato_id),
    ('Heirloom Tomato', tomato_id),
    ('Tomatoes', tomato_id),
    ('Fresh Tomato', tomato_id)
    ON CONFLICT (display_name) DO NOTHING;
  END IF;
  
  -- Add onion aliases
  IF onion_id IS NOT NULL THEN
    INSERT INTO ingredient_aliases (display_name, canonical_ingredient_id) VALUES
    ('Yellow Onion', onion_id),
    ('White Onion', onion_id),
    ('Red Onion', onion_id),
    ('Sweet Onion', onion_id),
    ('Onions', onion_id),
    ('Fresh Onion', onion_id)
    ON CONFLICT (display_name) DO NOTHING;
  END IF;
  
  -- Add chicken aliases
  IF chicken_id IS NOT NULL THEN
    INSERT INTO ingredient_aliases (display_name, canonical_ingredient_id) VALUES
    ('Chicken', chicken_id),
    ('Chicken Breasts', chicken_id),
    ('Boneless Chicken Breast', chicken_id),
    ('Skinless Chicken Breast', chicken_id)
    ON CONFLICT (display_name) DO NOTHING;
  END IF;
END $$;

-- ============================================================================
-- SUCCESS MESSAGE
-- ============================================================================

DO $$ 
BEGIN
  RAISE NOTICE '========================================';
  RAISE NOTICE 'Canonical Ingredient System Created!';
  RAISE NOTICE '========================================';
  RAISE NOTICE 'Tables created:';
  RAISE NOTICE '  ✓ canonical_ingredients (% rows)', (SELECT COUNT(*) FROM canonical_ingredients);
  RAISE NOTICE '  ✓ ingredient_aliases (% rows)', (SELECT COUNT(*) FROM ingredient_aliases);
  RAISE NOTICE '  ✓ canonical_ingredient_allergens (% rows)', (SELECT COUNT(*) FROM canonical_ingredient_allergens);
  RAISE NOTICE '  ✓ canonical_ingredient_dietary_tags (% rows)', (SELECT COUNT(*) FROM canonical_ingredient_dietary_tags);
  RAISE NOTICE '========================================';
  RAISE NOTICE 'Design:';
  RAISE NOTICE '  ✓ Many aliases → One canonical ingredient';
  RAISE NOTICE '  ✓ All logic uses canonical IDs';
  RAISE NOTICE '  ✓ Stable canonical names (never change)';
  RAISE NOTICE '  ✓ Migrated from ingredients_master';
  RAISE NOTICE '========================================';
  RAISE NOTICE 'Old tables (ingredients_master, ingredient_allergens, ingredient_dietary_tags)';
  RAISE NOTICE 'can be dropped after verification.';
  RAISE NOTICE '========================================';
END $$;
