-- ============================================================================
-- ADD DIETARY BOOLEAN COLUMNS TO DISHES
-- Created: 2026-01-24
-- Description: Add convenience boolean columns for common dietary restrictions
-- ============================================================================

-- Add boolean columns for dietary restrictions
DO $$ 
BEGIN
  -- Add is_vegetarian column
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                 WHERE table_name='dishes' AND column_name='is_vegetarian') THEN
    ALTER TABLE dishes ADD COLUMN is_vegetarian BOOLEAN DEFAULT false;
  END IF;

  -- Add is_vegan column
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                 WHERE table_name='dishes' AND column_name='is_vegan') THEN
    ALTER TABLE dishes ADD COLUMN is_vegan BOOLEAN DEFAULT false;
  END IF;

  -- Add is_gluten_free column
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                 WHERE table_name='dishes' AND column_name='is_gluten_free') THEN
    ALTER TABLE dishes ADD COLUMN is_gluten_free BOOLEAN DEFAULT false;
  END IF;
END $$;

COMMENT ON COLUMN dishes.is_vegetarian IS 'Indicates if the dish is suitable for vegetarians';
COMMENT ON COLUMN dishes.is_vegan IS 'Indicates if the dish is suitable for vegans';
COMMENT ON COLUMN dishes.is_gluten_free IS 'Indicates if the dish is gluten-free';

-- ============================================================================
-- SUCCESS MESSAGE
-- ============================================================================

DO $$ 
BEGIN
  RAISE NOTICE '========================================';
  RAISE NOTICE 'DIETARY COLUMNS ADDED TO DISHES!';
  RAISE NOTICE '========================================';
  RAISE NOTICE 'Added columns:';
  RAISE NOTICE '  ✓ is_vegetarian (boolean)';
  RAISE NOTICE '  ✓ is_vegan (boolean)';
  RAISE NOTICE '  ✓ is_gluten_free (boolean)';
  RAISE NOTICE '';
  RAISE NOTICE 'These columns complement the existing dietary_tags array';
  RAISE NOTICE '========================================';
END $$;
