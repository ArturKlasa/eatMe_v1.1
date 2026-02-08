-- Fix canonical ingredient mapping - consolidate to proper canonical concepts
-- Problem: Previous migration created too many canonical ingredients
-- Solution: Map many display names to fewer canonical IDs

-- First, let's clean up and start fresh with proper canonical mapping
TRUNCATE TABLE canonical_ingredient_allergens CASCADE;
TRUNCATE TABLE canonical_ingredient_dietary_tags CASCADE;
TRUNCATE TABLE ingredient_aliases CASCADE;
TRUNCATE TABLE canonical_ingredients CASCADE;

-- Create ONLY the true canonical ingredients (basic concepts)
INSERT INTO canonical_ingredients (canonical_name, is_vegetarian, is_vegan) VALUES
-- Basic proteins
('beef', false, false),
('pork', false, false),
('chicken', false, false),
('lamb', false, false),
('duck', false, false),
('fish', false, false),
('shellfish', false, false),
('eggs', true, false),

-- Plant proteins
('tofu', true, true),
('tempeh', true, true),
('beans', true, true),
('lentils', true, true),
('chickpeas', true, true),

-- Dairy
('milk', true, false),
('cheese', true, false),
('butter', true, false),
('cream', true, false),
('yogurt', true, false),

-- Plant milks (different canonical from dairy milk due to allergens)
('almond_milk', true, true),
('soy_milk', true, true),
('oat_milk', true, true),
('coconut_milk', true, true),

-- Vegetables
('tomato', true, true),
('onion', true, true),
('garlic', true, true),
('pepper', true, true),
('carrot', true, true),
('potato', true, true),
('lettuce', true, true),
('cucumber', true, true),
('spinach', true, true),
('broccoli', true, true),
('mushroom', true, true),
('zucchini', true, true),
('celery', true, true),
('cabbage', true, true),
('kale', true, true),
('asparagus', true, true),
('corn', true, true),
('pumpkin', true, true),

-- Fruits
('apple', true, true),
('banana', true, true),
('lemon', true, true),
('lime', true, true),
('orange', true, true),
('strawberry', true, true),
('avocado', true, true),
('mango', true, true),
('pineapple', true, true),

-- Grains
('rice', true, true),
('pasta', true, true),
('bread', true, false),
('flour', true, true),
('oats', true, true),
('quinoa', true, true),
('tortilla', true, true),

-- Nuts and seeds
('almonds', true, true),
('walnuts', true, true),
('peanuts', true, true),
('cashews', true, true),
('sesame', true, true),
('chia', true, true),

-- Spices and herbs
('salt', true, true),
('pepper_spice', true, true),
('cumin', true, true),
('paprika', true, true),
('oregano', true, true),
('basil', true, true),
('cilantro', true, true),
('parsley', true, true),
('thyme', true, true),
('rosemary', true, true),
('cinnamon', true, true),
('ginger', true, true),

-- Oils
('olive_oil', true, true),
('vegetable_oil', true, true),
('sesame_oil', true, true),

-- Condiments
('soy_sauce', true, true),
('vinegar', true, true),
('honey', true, false),
('sugar', true, true),
('ketchup', true, true),
('mayonnaise', true, false),
('mustard', true, true),

-- Beverages
('water', true, true),
('coffee', true, true),
('tea', true, true),
('wine', true, true)
ON CONFLICT (canonical_name) DO NOTHING;

-- Now create ALL the aliases mapping to these canonical ingredients
DO $$
DECLARE
  v_canonical_id UUID;
BEGIN
  -- BEEF aliases
  SELECT id INTO v_canonical_id FROM canonical_ingredients WHERE canonical_name = 'beef';
  INSERT INTO ingredient_aliases (display_name, canonical_ingredient_id) VALUES
  ('Beef', v_canonical_id),
  ('Beef brisket', v_canonical_id),
  ('Beef ribs', v_canonical_id),
  ('Beef sirloin', v_canonical_id),
  ('Beef steak', v_canonical_id),
  ('Ground beef', v_canonical_id),
  ('Sirloin', v_canonical_id)
  ON CONFLICT (display_name) DO NOTHING;

  -- CHICKEN aliases
  SELECT id INTO v_canonical_id FROM canonical_ingredients WHERE canonical_name = 'chicken';
  INSERT INTO ingredient_aliases (display_name, canonical_ingredient_id) VALUES
  ('Chicken', v_canonical_id),
  ('Chicken breast', v_canonical_id),
  ('Chicken breasts', v_canonical_id),
  ('Chicken thighs', v_canonical_id),
  ('Chicken wings', v_canonical_id)
  ON CONFLICT (display_name) DO NOTHING;

  -- PORK aliases
  SELECT id INTO v_canonical_id FROM canonical_ingredients WHERE canonical_name = 'pork';
  INSERT INTO ingredient_aliases (display_name, canonical_ingredient_id) VALUES
  ('Pork', v_canonical_id),
  ('Pork belly', v_canonical_id),
  ('Pork chop', v_canonical_id),
  ('Pork loin', v_canonical_id),
  ('Bacon', v_canonical_id),
  ('Ham', v_canonical_id),
  ('Sausage', v_canonical_id),
  ('Andouille sausage', v_canonical_id),
  ('Smoked sausage', v_canonical_id)
  ON CONFLICT (display_name) DO NOTHING;

  -- FISH aliases
  SELECT id INTO v_canonical_id FROM canonical_ingredients WHERE canonical_name = 'fish';
  INSERT INTO ingredient_aliases (display_name, canonical_ingredient_id) VALUES
  ('Fish', v_canonical_id),
  ('Salmon', v_canonical_id),
  ('Salmon fillet', v_canonical_id),
  ('Tuna', v_canonical_id),
  ('Tuna steak', v_canonical_id),
  ('Tuna (canned)', v_canonical_id),
  ('Cod', v_canonical_id),
  ('Trout', v_canonical_id),
  ('Haddock', v_canonical_id),
  ('Halibut', v_canonical_id)
  ON CONFLICT (display_name) DO NOTHING;

  -- SHELLFISH aliases
  SELECT id INTO v_canonical_id FROM canonical_ingredients WHERE canonical_name = 'shellfish';
  INSERT INTO ingredient_aliases (display_name, canonical_ingredient_id) VALUES
  ('Shellfish', v_canonical_id),
  ('Shrimp', v_canonical_id),
  ('Prawns', v_canonical_id),
  ('Jumbo shrimp', v_canonical_id),
  ('Crab', v_canonical_id),
  ('Lobster', v_canonical_id),
  ('Scallops', v_canonical_id),
  ('Clams', v_canonical_id),
  ('Crawfish', v_canonical_id),
  ('Oysters', v_canonical_id)
  ON CONFLICT (display_name) DO NOTHING;

  -- MILK aliases
  SELECT id INTO v_canonical_id FROM canonical_ingredients WHERE canonical_name = 'milk';
  INSERT INTO ingredient_aliases (display_name, canonical_ingredient_id) VALUES
  ('Milk', v_canonical_id),
  ('Whole milk', v_canonical_id),
  ('2% milk', v_canonical_id),
  ('Skim milk', v_canonical_id),
  ('Milk (whole)', v_canonical_id),
  ('Milk (skim)', v_canonical_id)
  ON CONFLICT (display_name) DO NOTHING;

  -- CHEESE aliases
  SELECT id INTO v_canonical_id FROM canonical_ingredients WHERE canonical_name = 'cheese';
  INSERT INTO ingredient_aliases (display_name, canonical_ingredient_id) VALUES
  ('Cheese', v_canonical_id),
  ('Cheddar cheese', v_canonical_id),
  ('Mozzarella', v_canonical_id),
  ('Mozzarella cheese', v_canonical_id),
  ('Parmesan', v_canonical_id),
  ('Parmesan cheese', v_canonical_id),
  ('Feta cheese', v_canonical_id),
  ('Goat cheese', v_canonical_id),
  ('Blue cheese', v_canonical_id),
  ('Swiss cheese', v_canonical_id),
  ('Cream cheese', v_canonical_id),
  ('Ricotta cheese', v_canonical_id)
  ON CONFLICT (display_name) DO NOTHING;

  -- BUTTER aliases
  SELECT id INTO v_canonical_id FROM canonical_ingredients WHERE canonical_name = 'butter';
  INSERT INTO ingredient_aliases (display_name, canonical_ingredient_id) VALUES
  ('Butter', v_canonical_id),
  ('Butter (salted)', v_canonical_id),
  ('Butter (unsalted)', v_canonical_id),
  ('Unsalted butter', v_canonical_id),
  ('Salted butter', v_canonical_id)
  ON CONFLICT (display_name) DO NOTHING;

  -- TOMATO aliases
  SELECT id INTO v_canonical_id FROM canonical_ingredients WHERE canonical_name = 'tomato';
  INSERT INTO ingredient_aliases (display_name, canonical_ingredient_id) VALUES
  ('Tomato', v_canonical_id),
  ('Tomatoes', v_canonical_id),
  ('Roma tomato', v_canonical_id),
  ('Cherry tomato', v_canonical_id),
  ('Grape tomato', v_canonical_id),
  ('Heirloom tomato', v_canonical_id),
  ('Fresh tomato', v_canonical_id),
  ('Tomatoes (roma)', v_canonical_id),
  ('Tomatoes (cherry)', v_canonical_id)
  ON CONFLICT (display_name) DO NOTHING;

  -- ONION aliases
  SELECT id INTO v_canonical_id FROM canonical_ingredients WHERE canonical_name = 'onion';
  INSERT INTO ingredient_aliases (display_name, canonical_ingredient_id) VALUES
  ('Onion', v_canonical_id),
  ('Onions', v_canonical_id),
  ('Yellow onion', v_canonical_id),
  ('White onion', v_canonical_id),
  ('Red onion', v_canonical_id),
  ('Sweet onion', v_canonical_id),
  ('Fresh onion', v_canonical_id),
  ('Onions (yellow)', v_canonical_id),
  ('Onions (white)', v_canonical_id),
  ('Green onion', v_canonical_id),
  ('Green onions', v_canonical_id),
  ('Spring onion', v_canonical_id),
  ('Spring onions', v_canonical_id),
  ('Scallions', v_canonical_id),
  ('Scallion', v_canonical_id)
  ON CONFLICT (display_name) DO NOTHING;

  -- EGGS aliases
  SELECT id INTO v_canonical_id FROM canonical_ingredients WHERE canonical_name = 'eggs';
  INSERT INTO ingredient_aliases (display_name, canonical_ingredient_id) VALUES
  ('Eggs', v_canonical_id),
  ('Egg', v_canonical_id),
  ('Chicken eggs', v_canonical_id),
  ('Whole eggs', v_canonical_id),
  ('Eggs (whole)', v_canonical_id)
  ON CONFLICT (display_name) DO NOTHING;

  -- TOFU aliases
  SELECT id INTO v_canonical_id FROM canonical_ingredients WHERE canonical_name = 'tofu';
  INSERT INTO ingredient_aliases (display_name, canonical_ingredient_id) VALUES
  ('Tofu', v_canonical_id),
  ('Firm tofu', v_canonical_id),
  ('Silken tofu', v_canonical_id),
  ('Bean curd', v_canonical_id)
  ON CONFLICT (display_name) DO NOTHING;

  -- RICE aliases
  SELECT id INTO v_canonical_id FROM canonical_ingredients WHERE canonical_name = 'rice';
  INSERT INTO ingredient_aliases (display_name, canonical_ingredient_id) VALUES
  ('Rice', v_canonical_id),
  ('White rice', v_canonical_id),
  ('Brown rice', v_canonical_id),
  ('Jasmine rice', v_canonical_id),
  ('Basmati rice', v_canonical_id)
  ON CONFLICT (display_name) DO NOTHING;

  -- PASTA aliases  
  SELECT id INTO v_canonical_id FROM canonical_ingredients WHERE canonical_name = 'pasta';
  INSERT INTO ingredient_aliases (display_name, canonical_ingredient_id) VALUES
  ('Pasta', v_canonical_id),
  ('Spaghetti', v_canonical_id),
  ('Penne', v_canonical_id),
  ('Noodles', v_canonical_id),
  ('Pasta (spaghetti)', v_canonical_id),
  ('Pasta (penne)', v_canonical_id),
  ('Macaroni', v_canonical_id)
  ON CONFLICT (display_name) DO NOTHING;

  -- OLIVE OIL aliases
  SELECT id INTO v_canonical_id FROM canonical_ingredients WHERE canonical_name = 'olive_oil';
  INSERT INTO ingredient_aliases (display_name, canonical_ingredient_id) VALUES
  ('Olive oil', v_canonical_id),
  ('Extra virgin olive oil', v_canonical_id),
  ('EVOO', v_canonical_id)
  ON CONFLICT (display_name) DO NOTHING;

  -- WINE aliases
  SELECT id INTO v_canonical_id FROM canonical_ingredients WHERE canonical_name = 'wine';
  INSERT INTO ingredient_aliases (display_name, canonical_ingredient_id) VALUES
  ('Wine', v_canonical_id),
  ('Red wine', v_canonical_id),
  ('White wine', v_canonical_id)
  ON CONFLICT (display_name) DO NOTHING;

  RAISE NOTICE '========================================';
  RAISE NOTICE 'Fixed Canonical Ingredient Mapping!';
  RAISE NOTICE '========================================';
  RAISE NOTICE 'Canonical ingredients: %', (SELECT COUNT(*) FROM canonical_ingredients);
  RAISE NOTICE 'Display name aliases: %', (SELECT COUNT(*) FROM ingredient_aliases);
  RAISE NOTICE '========================================';
  RAISE NOTICE 'Example mappings:';
  RAISE NOTICE '  "Roma tomato" → tomato';
  RAISE NOTICE '  "Ground beef" → beef';
  RAISE NOTICE '  "2%% milk" → milk';
  RAISE NOTICE '  "EVOO" → olive_oil';
  RAISE NOTICE '========================================';
END $$;
