-- Add comprehensive list of ingredients to canonical system
-- This adds ~400+ ingredients with proper canonical mapping

DO $$
DECLARE
  v_canonical_id UUID;
  v_canonical_name TEXT;
  v_display_name TEXT;
BEGIN
  -- Helper function to create or get canonical ingredient
  CREATE TEMP TABLE IF NOT EXISTS temp_ingredients (
    display_name TEXT,
    canonical_name TEXT,
    is_vegetarian BOOLEAN,
    is_vegan BOOLEAN
  );

  -- Insert all ingredients with their properties
  INSERT INTO temp_ingredients (display_name, canonical_name, is_vegetarian, is_vegan) VALUES
  -- Dairy products
  ('2% milk', 'milk', true, false),
  ('Milk (skim)', 'milk', true, false),
  ('Milk (whole)', 'milk', true, false),
  ('Almond milk', 'almond_milk', true, true),
  ('Almond milk (unsweetened)', 'almond_milk', true, true),
  ('Oat milk', 'oat_milk', true, true),
  ('Soy milk', 'soy_milk', true, true),
  ('Coconut milk', 'coconut_milk', true, true),
  ('Coconut cream', 'coconut_milk', true, true),
  
  -- Cheese
  ('Blue cheese', 'cheese', true, false),
  ('Cheddar cheese', 'cheese', true, false),
  ('Cheese curds', 'cheese', true, false),
  ('Cream cheese', 'cheese', true, false),
  ('Feta cheese', 'cheese', true, false),
  ('Goat cheese', 'cheese', true, false),
  ('Mozzarella', 'cheese', true, false),
  ('Mozzarella cheese', 'cheese', true, false),
  ('Parmesan', 'cheese', true, false),
  ('Parmesan cheese', 'cheese', true, false),
  ('Ricotta cheese', 'cheese', true, false),
  ('Swiss cheese', 'cheese', true, false),
  
  -- Butter and cream
  ('Butter (salted)', 'butter', true, false),
  ('Butter (unsalted)', 'butter', true, false),
  ('Unsalted butter', 'butter', true, false),
  ('Cream (heavy)', 'cream', true, false),
  ('Cream (sour)', 'cream', true, false),
  ('Cream (whipping)', 'cream', true, false),
  ('Heavy cream', 'cream', true, false),
  ('Sour cream', 'cream', true, false),
  ('Whipping cream', 'cream', true, false),
  
  -- Yogurt
  ('Greek yogurt', 'yogurt', true, false),
  ('Plain yogurt', 'yogurt', true, false),
  
  -- Seafood
  ('Abalone', 'abalone', false, false),
  ('Anchovies', 'anchovies', false, false),
  ('Clams', 'clams', false, false),
  ('Cod', 'cod', false, false),
  ('Crab', 'crab', false, false),
  ('Crawfish', 'crawfish', false, false),
  ('Haddock', 'haddock', false, false),
  ('Halibut', 'halibut', false, false),
  ('Lobster', 'lobster', false, false),
  ('Octopus', 'octopus', false, false),
  ('Salmon fillet', 'salmon', false, false),
  ('Sardines', 'sardines', false, false),
  ('Scallops', 'scallops', false, false),
  ('Trout', 'trout', false, false),
  ('Tuna (canned)', 'tuna', false, false),
  ('Tuna steak', 'tuna', false, false),
  
  -- Meats
  ('Beef brisket', 'beef', false, false),
  ('Beef ribs', 'beef', false, false),
  ('Beef sirloin', 'beef', false, false),
  ('Beef steak', 'beef', false, false),
  ('Ground beef', 'beef', false, false),
  ('Sirloin', 'beef', false, false),
  ('Bacon', 'bacon', false, false),
  ('Duck', 'duck', false, false),
  ('Ham', 'ham', false, false),
  ('Lamb', 'lamb', false, false),
  ('Oxtail', 'oxtail', false, false),
  ('Pork belly', 'pork', false, false),
  ('Pork chop', 'pork', false, false),
  ('Pork loin', 'pork', false, false),
  ('Prosciutto', 'prosciutto', false, false),
  
  -- Chicken
  ('Chicken breasts', 'chicken', false, false),
  ('Chicken thighs', 'chicken', false, false),
  ('Chicken wings', 'chicken', false, false),
  ('Chicken eggs', 'eggs', true, false),
  ('Egg', 'eggs', true, false),
  ('Eggs (whole)', 'eggs', true, false),
  ('Whole eggs', 'eggs', true, false),
  
  -- Sausages
  ('Andouille sausage', 'sausage', false, false),
  ('Pepperoni', 'pepperoni', false, false),
  ('Sausage', 'sausage', false, false),
  ('Smoked sausage', 'sausage', false, false),
  
  -- Vegetables
  ('Artichoke', 'artichoke', true, true),
  ('Arugula', 'arugula', true, true),
  ('Asparagus', 'asparagus', true, true),
  ('Baby spinach', 'spinach', true, true),
  ('Bamboo shoots', 'bamboo_shoots', true, true),
  ('Bell peppers (green)', 'bell_pepper', true, true),
  ('Bell peppers (red)', 'bell_pepper', true, true),
  ('Bok choy', 'bok_choy', true, true),
  ('Broccoli florets', 'broccoli', true, true),
  ('Cabbage', 'cabbage', true, true),
  ('Cassava', 'cassava', true, true),
  ('Celery stalks', 'celery', true, true),
  ('Collard greens', 'collard_greens', true, true),
  ('Corn', 'corn', true, true),
  ('Edamame', 'edamame', true, true),
  ('Fennel', 'fennel', true, true),
  ('Green beans', 'green_beans', true, true),
  ('Green lettuce', 'lettuce', true, true),
  ('Green pepper', 'bell_pepper', true, true),
  ('Iceberg lettuce', 'lettuce', true, true),
  ('Kale', 'kale', true, true),
  ('Napa cabbage', 'cabbage', true, true),
  ('Onions (white)', 'onion', true, true),
  ('Onions (yellow)', 'onion', true, true),
  ('Plantains', 'plantain', true, true),
  ('Potatoes (russet)', 'potato', true, true),
  ('Potatoes (white)', 'potato', true, true),
  ('Pumpkin', 'pumpkin', true, true),
  ('Radish', 'radish', true, true),
  ('Red cabbage', 'cabbage', true, true),
  ('Red onion', 'onion', true, true),
  ('Roma tomato', 'tomato', true, true),
  ('Salad greens', 'lettuce', true, true),
  ('Scallions', 'green_onion', true, true),
  ('Shallots', 'shallot', true, true),
  ('Spinach (baby)', 'spinach', true, true),
  ('Spring onion', 'green_onion', true, true),
  ('Spring onions', 'green_onion', true, true),
  ('Sweet potatoes', 'sweet_potato', true, true),
  ('Tomatoes (cherry)', 'tomato', true, true),
  ('Tomatoes (roma)', 'tomato', true, true),
  ('Turnips', 'turnip', true, true),
  ('Zucchinis', 'zucchini', true, true),
  
  -- Fruits
  ('Acai', 'acai', true, true),
  ('Apples (green)', 'apple', true, true),
  ('Apples (red)', 'apple', true, true),
  ('Apricot', 'apricot', true, true),
  ('Avocados (fresh)', 'avocado', true, true),
  ('Cherry tomato', 'tomato', true, true),
  ('Dates', 'dates', true, true),
  ('Green apple', 'apple', true, true),
  ('Lemon juice', 'lemon', true, true),
  ('Lemon zest', 'lemon', true, true),
  ('Lemongrass', 'lemongrass', true, true),
  ('Lime juice', 'lime', true, true),
  ('Mangos', 'mango', true, true),
  ('Orange juice', 'orange', true, true),
  ('Papaya', 'papaya', true, true),
  ('Pears', 'pear', true, true),
  ('Pineapple', 'pineapple', true, true),
  ('Plum', 'plum', true, true),
  ('Red apple', 'apple', true, true),
  ('Tangerine', 'tangerine', true, true),
  
  -- Grains and Flours
  ('All-purpose flour', 'flour', true, true),
  ('Almond flour', 'almond_flour', true, true),
  ('Bread crumbs', 'bread_crumbs', true, false),
  ('Brioche bun', 'bread', true, false),
  ('Brown rice', 'rice', true, true),
  ('Corn tortillas', 'tortilla', true, true),
  ('Cornmeal', 'cornmeal', true, true),
  ('Cornstarch', 'cornstarch', true, true),
  ('Couscous', 'couscous', true, true),
  ('Flour tortilla', 'tortilla', true, true),
  ('Flour tortillas', 'tortilla', true, true),
  ('Jasmine rice', 'rice', true, true),
  ('Macaroni', 'pasta', true, true),
  ('Noodles', 'noodles', true, true),
  ('Oatmeal', 'oats', true, true),
  ('Pasta (penne)', 'pasta', true, true),
  ('Pasta (spaghetti)', 'pasta', true, true),
  ('Polenta', 'polenta', true, true),
  ('Quinoa (red)', 'quinoa', true, true),
  ('Quinoa (white)', 'quinoa', true, true),
  ('Red quinoa', 'quinoa', true, true),
  ('Rice noodles', 'noodles', true, true),
  ('Rolled oats', 'oats', true, true),
  ('Rye bread', 'bread', true, false),
  ('Spaghetti', 'pasta', true, true),
  ('Tortilla wrap', 'tortilla', true, true),
  ('Tortillas', 'tortilla', true, true),
  ('Wheat bread', 'bread', true, false),
  ('Wheat flour', 'flour', true, true),
  ('White bread', 'bread', true, false),
  ('White quinoa', 'quinoa', true, true),
  ('White rice', 'rice', true, true),
  ('Whole wheat bread', 'bread', true, false),
  ('Wrap', 'tortilla', true, true),
  
  -- Beans and Legumes
  ('Black bean', 'black_beans', true, true),
  ('Black lentils', 'lentils', true, true),
  ('Chana', 'chickpeas', true, true),
  ('Frijoles negros', 'black_beans', true, true),
  ('Green lentils', 'lentils', true, true),
  ('Kidney beans', 'kidney_beans', true, true),
  ('Pinto beans', 'pinto_beans', true, true),
  ('Red beans', 'red_beans', true, true),
  ('Red lentils', 'lentils', true, true),
  ('White beans', 'white_beans', true, true),
  
  -- Tofu and Tempeh
  ('Firm tofu', 'tofu', true, true),
  ('Silken tofu', 'tofu', true, true),
  ('Tempeh', 'tempeh', true, true),
  
  -- Nuts and Seeds
  ('Almonds (sliced)', 'almonds', true, true),
  ('Cashew', 'cashews', true, true),
  ('Chia', 'chia_seeds', true, true),
  ('Hazelnuts', 'hazelnuts', true, true),
  ('Peanut', 'peanuts', true, true),
  ('Peanut butter', 'peanut_butter', true, true),
  ('Peanuts (roasted)', 'peanuts', true, true),
  ('Pecans', 'pecans', true, true),
  ('Pistachios', 'pistachios', true, true),
  ('Raisins', 'raisins', true, true),
  ('Sesame', 'sesame_seeds', true, true),
  ('Sesame seeds (black)', 'sesame_seeds', true, true),
  ('Sesame seeds (white)', 'sesame_seeds', true, true),
  ('Walnuts', 'walnuts', true, true),
  ('Black sesame', 'sesame_seeds', true, true),
  ('Black sesame seeds', 'sesame_seeds', true, true),
  ('White sesame', 'sesame_seeds', true, true),
  
  -- Spices and Seasonings
  ('Adobo seasoning', 'adobo', true, true),
  ('Anise', 'anise', true, true),
  ('Basil (dried)', 'basil', true, true),
  ('Basil (fresh)', 'basil', true, true),
  ('Bay leaf', 'bay_leaf', true, true),
  ('Black pepper (ground)', 'black_pepper', true, true),
  ('Black peppercorns', 'black_pepper', true, true),
  ('Cajun seasoning', 'cajun_seasoning', true, true),
  ('Caraway seeds', 'caraway', true, true),
  ('Cardamom', 'cardamom', true, true),
  ('Cayenne pepper', 'cayenne', true, true),
  ('Chili flakes', 'chili_flakes', true, true),
  ('Chilli powder', 'chili_powder', true, true),
  ('Chives', 'chives', true, true),
  ('Cinnamon (ground)', 'cinnamon', true, true),
  ('Cinnamon sticks', 'cinnamon', true, true),
  ('Cumin (ground)', 'cumin', true, true),
  ('Cumin seeds', 'cumin', true, true),
  ('Curry leaves', 'curry_leaves', true, true),
  ('Curry paste', 'curry_paste', true, true),
  ('Curry powder', 'curry_powder', true, true),
  ('Dill', 'dill', true, true),
  ('Fresh basil', 'basil', true, true),
  ('Fresh cilantro', 'cilantro', true, true),
  ('Fresh garlic', 'garlic', true, true),
  ('Fresh ginger', 'ginger', true, true),
  ('Fresh parsley', 'parsley', true, true),
  ('Fresh rosemary', 'rosemary', true, true),
  ('Garlic cloves', 'garlic', true, true),
  ('Garlic powder', 'garlic_powder', true, true),
  ('Ginger root', 'ginger', true, true),
  ('Ground chili', 'chili_powder', true, true),
  ('Ground cinnamon', 'cinnamon', true, true),
  ('Ground cumin', 'cumin', true, true),
  ('Ground pepper', 'black_pepper', true, true),
  ('Kosher salt', 'salt', true, true),
  ('Mint', 'mint', true, true),
  ('Nutmeg', 'nutmeg', true, true),
  ('Onion powder', 'onion_powder', true, true),
  ('Oregano (dried)', 'oregano', true, true),
  ('Oregano (fresh)', 'oregano', true, true),
  ('Paprika (smoked)', 'paprika', true, true),
  ('Paprika (sweet)', 'paprika', true, true),
  ('Parsley (dried)', 'parsley', true, true),
  ('Parsley (fresh)', 'parsley', true, true),
  ('Peppercorns', 'black_pepper', true, true),
  ('Rosemary (dried)', 'rosemary', true, true),
  ('Rosemary (fresh)', 'rosemary', true, true),
  ('Saffron', 'saffron', true, true),
  ('Sage', 'sage', true, true),
  ('Sea salt', 'salt', true, true),
  ('Smoked paprika', 'paprika', true, true),
  ('Star anise', 'star_anise', true, true),
  ('Sweet paprika', 'paprika', true, true),
  ('Table salt', 'salt', true, true),
  ('Tarragon', 'tarragon', true, true),
  ('Thyme (dried)', 'thyme', true, true),
  ('Thyme (fresh)', 'thyme', true, true),
  ('Turmeric', 'turmeric', true, true),
  ('Vanilla', 'vanilla', true, true),
  ('White pepper', 'white_pepper', true, true),
  
  -- Oils and Fats
  ('Canola oil', 'vegetable_oil', true, true),
  ('Cooking oil', 'vegetable_oil', true, true),
  ('Extra virgin olive oil', 'olive_oil', true, true),
  ('EVOO', 'olive_oil', true, true),
  ('Sesame oil', 'sesame_oil', true, true),
  
  -- Condiments and Sauces
  ('Aioli', 'aioli', true, false),
  ('Apple cider vinegar', 'vinegar', true, true),
  ('Capers', 'capers', true, true),
  ('Caramel', 'caramel', true, false),
  ('Chili oil', 'chili_oil', true, true),
  ('Chili paste', 'chili_paste', true, true),
  ('Date syrup', 'date_syrup', true, true),
  ('Fish sauce', 'fish_sauce', false, false),
  ('Gochujang', 'gochujang', true, true),
  ('Harissa', 'harissa', true, true),
  ('Hummus', 'hummus', true, true),
  ('Kimchi', 'kimchi', true, true),
  ('Maple syrup', 'maple_syrup', true, true),
  ('Marinara sauce', 'marinara', true, true),
  ('Mayo', 'mayonnaise', true, false),
  ('Miso', 'miso', true, true),
  ('Mustard (dijon)', 'mustard', true, true),
  ('Mustard (yellow)', 'mustard', true, true),
  ('Pickles', 'pickles', true, true),
  ('Salsa', 'salsa', true, true),
  ('Tahini', 'tahini', true, true),
  ('Tamari', 'tamari', true, true),
  ('Tomato ketchup', 'ketchup', true, true),
  ('Tomato paste', 'tomato_paste', true, true),
  ('Tomato sauce', 'tomato_sauce', true, true),
  ('Vinegar (apple cider)', 'vinegar', true, true),
  ('Vinegar (balsamic)', 'vinegar', true, true),
  ('Vinegar (white)', 'vinegar', true, true),
  ('Yellow mustard', 'mustard', true, true),
  
  -- Sweeteners
  ('Baking powder', 'baking_powder', true, true),
  ('Baking soda', 'baking_soda', true, true),
  ('Brown sugar', 'sugar', true, true),
  ('Granulated sugar', 'sugar', true, true),
  ('Organic honey', 'honey', true, false),
  ('Raw honey', 'honey', true, false),
  ('Sugar (cane)', 'sugar', true, true),
  ('Sugar (granulated)', 'sugar', true, true),
  
  -- Beverages
  ('Black tea', 'tea', true, true),
  ('Bone broth', 'broth', false, false),
  ('Coffee', 'coffee', true, true),
  ('Drinking water', 'water', true, true),
  ('Espresso', 'coffee', true, true),
  ('Filtered water', 'water', true, true),
  ('Green tea', 'tea', true, true),
  ('Ground coffee', 'coffee', true, true),
  ('Red wine', 'wine', true, true),
  ('Tea (black)', 'tea', true, true),
  ('Tea (green)', 'tea', true, true),
  ('Water (filtered)', 'water', true, true),
  ('White wine', 'wine', true, true),
  
  -- Other
  ('Black garlic', 'garlic', true, true),
  ('Chocolate', 'chocolate', true, false),
  ('Nori', 'nori', true, true),
  ('Seaweed', 'seaweed', true, true);

  -- Process each ingredient
  FOR v_display_name, v_canonical_name IN 
    SELECT DISTINCT display_name, canonical_name FROM temp_ingredients
  LOOP
    -- Check if canonical ingredient exists, create if not
    SELECT id INTO v_canonical_id 
    FROM canonical_ingredients 
    WHERE canonical_name = v_canonical_name;
    
    IF v_canonical_id IS NULL THEN
      -- Create canonical ingredient
      INSERT INTO canonical_ingredients (
        canonical_name, 
        is_vegetarian, 
        is_vegan
      )
      SELECT 
        canonical_name,
        is_vegetarian,
        is_vegan
      FROM temp_ingredients
      WHERE canonical_name = v_canonical_name
      LIMIT 1
      RETURNING id INTO v_canonical_id;
    END IF;
    
    -- Create alias (display name) if it doesn't exist
    INSERT INTO ingredient_aliases (display_name, canonical_ingredient_id)
    VALUES (v_display_name, v_canonical_id)
    ON CONFLICT (display_name) DO NOTHING;
  END LOOP;
  
  DROP TABLE temp_ingredients;
  
  RAISE NOTICE '========================================';
  RAISE NOTICE 'Added comprehensive ingredients list!';
  RAISE NOTICE '========================================';
  RAISE NOTICE 'Total canonical ingredients: %', (SELECT COUNT(*) FROM canonical_ingredients);
  RAISE NOTICE 'Total ingredient aliases: %', (SELECT COUNT(*) FROM ingredient_aliases);
  RAISE NOTICE '========================================';
END $$;
