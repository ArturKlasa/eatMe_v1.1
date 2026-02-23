-- Add dish description and ingredient visibility controls
-- Restaurants can decide where/whether description and ingredients are shown in the mobile app:
--   description_visibility: 'menu' (shown in menu list view) | 'detail' (shown only in dish photo/detail view)
--   ingredients_visibility: 'menu' (shown in menu list) | 'detail' (shown in dish detail) | 'none' (hidden)

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'dishes' AND column_name = 'description_visibility'
  ) THEN
    ALTER TABLE dishes
      ADD COLUMN description_visibility TEXT NOT NULL DEFAULT 'menu'
        CHECK (description_visibility IN ('menu', 'detail'));
    COMMENT ON COLUMN dishes.description_visibility IS
      'Where the dish description is shown in the mobile app: menu = menu list row, detail = dish photo/detail view only';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'dishes' AND column_name = 'ingredients_visibility'
  ) THEN
    ALTER TABLE dishes
      ADD COLUMN ingredients_visibility TEXT NOT NULL DEFAULT 'detail'
        CHECK (ingredients_visibility IN ('menu', 'detail', 'none'));
    COMMENT ON COLUMN dishes.ingredients_visibility IS
      'Where ingredients are shown in the mobile app: menu = menu list row, detail = dish detail view, none = hidden';
  END IF;
END $$;
