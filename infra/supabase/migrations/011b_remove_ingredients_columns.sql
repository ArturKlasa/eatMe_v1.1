-- Remove unused columns from ingredients_master table
-- Removes: category and name_variants

-- Drop the category column
ALTER TABLE ingredients_master 
DROP COLUMN IF EXISTS category;

-- Drop the name_variants column
ALTER TABLE ingredients_master 
DROP COLUMN IF EXISTS name_variants;

-- Update the search vector trigger to only use the name field
CREATE OR REPLACE FUNCTION update_ingredient_search_vector()
RETURNS TRIGGER AS $$
BEGIN
  NEW.search_vector := to_tsvector('english', COALESCE(NEW.name, ''));
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

COMMENT ON TABLE ingredients_master IS 'Master list of ingredients for autocomplete and allergen tracking (simplified)';

-- Success message
DO $$ 
BEGIN
  RAISE NOTICE '========================================';
  RAISE NOTICE 'Ingredients Master Table Updated!';
  RAISE NOTICE '========================================';
  RAISE NOTICE '✓ Removed category column';
  RAISE NOTICE '✓ Removed name_variants column';
  RAISE NOTICE '✓ Updated search vector function';
  RAISE NOTICE '========================================';
END $$;
