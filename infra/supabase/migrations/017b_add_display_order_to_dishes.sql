-- Add display_order column to dishes table
-- This allows manual sorting of dishes within a menu category

DO $$
BEGIN
  -- Add display_order column if it doesn't exist
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name='dishes' AND column_name='display_order'
  ) THEN
    ALTER TABLE dishes ADD COLUMN display_order INTEGER DEFAULT 0;
    
    COMMENT ON COLUMN dishes.display_order IS 'Display order within menu category (lower numbers appear first)';
    
    -- Create index for sorting
    CREATE INDEX IF NOT EXISTS dishes_display_order_idx ON dishes(display_order);
    
    RAISE NOTICE 'Added display_order column to dishes table';
  ELSE
    RAISE NOTICE 'display_order column already exists on dishes table';
  END IF;
END $$;
