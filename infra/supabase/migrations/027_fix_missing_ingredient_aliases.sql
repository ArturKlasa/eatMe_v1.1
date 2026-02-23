-- Fix missing ingredient aliases
-- Many canonical ingredients were created in 015 but never got display-name aliases,
-- making them invisible in autocomplete (which queries ingredient_aliases, not canonical_ingredients).
-- This migration ensures every canonical ingredient has at least one human-readable alias.

DO $$
DECLARE
  v_id UUID;
BEGIN

  -- ============================================================
  -- ANIMAL PROTEINS
  -- ============================================================

  SELECT id INTO v_id FROM canonical_ingredients WHERE canonical_name = 'lamb';
  IF v_id IS NOT NULL THEN
    INSERT INTO ingredient_aliases (display_name, canonical_ingredient_id) VALUES
    ('Lamb', v_id), ('Lamb chop', v_id), ('Lamb shank', v_id), ('Lamb shoulder', v_id),
    ('Ground lamb', v_id), ('Rack of lamb', v_id)
    ON CONFLICT (display_name) DO NOTHING;
  END IF;

  SELECT id INTO v_id FROM canonical_ingredients WHERE canonical_name = 'duck';
  IF v_id IS NOT NULL THEN
    INSERT INTO ingredient_aliases (display_name, canonical_ingredient_id) VALUES
    ('Duck', v_id), ('Duck breast', v_id), ('Duck leg', v_id), ('Duck confit', v_id)
    ON CONFLICT (display_name) DO NOTHING;
  END IF;

  SELECT id INTO v_id FROM canonical_ingredients WHERE canonical_name = 'pepperoni';
  IF v_id IS NOT NULL THEN
    INSERT INTO ingredient_aliases (display_name, canonical_ingredient_id) VALUES
    ('Pepperoni', v_id)
    ON CONFLICT (display_name) DO NOTHING;
  END IF;

  SELECT id INTO v_id FROM canonical_ingredients WHERE canonical_name = 'prosciutto';
  IF v_id IS NOT NULL THEN
    INSERT INTO ingredient_aliases (display_name, canonical_ingredient_id) VALUES
    ('Prosciutto', v_id), ('Prosciutto di Parma', v_id), ('Cured ham', v_id),
    ('Prosciutto crudo', v_id)
    ON CONFLICT (display_name) DO NOTHING;
  END IF;

  -- Seafood specifics
  SELECT id INTO v_id FROM canonical_ingredients WHERE canonical_name = 'sardines';
  IF v_id IS NOT NULL THEN
    INSERT INTO ingredient_aliases (display_name, canonical_ingredient_id) VALUES
    ('Sardines', v_id), ('Canned sardines', v_id)
    ON CONFLICT (display_name) DO NOTHING;
  END IF;

  SELECT id INTO v_id FROM canonical_ingredients WHERE canonical_name = 'octopus';
  IF v_id IS NOT NULL THEN
    INSERT INTO ingredient_aliases (display_name, canonical_ingredient_id) VALUES
    ('Octopus', v_id), ('Grilled octopus', v_id), ('Baby octopus', v_id)
    ON CONFLICT (display_name) DO NOTHING;
  END IF;

  -- ============================================================
  -- PLANT PROTEINS
  -- ============================================================

  SELECT id INTO v_id FROM canonical_ingredients WHERE canonical_name = 'tempeh';
  IF v_id IS NOT NULL THEN
    INSERT INTO ingredient_aliases (display_name, canonical_ingredient_id) VALUES
    ('Tempeh', v_id), ('Smoked tempeh', v_id)
    ON CONFLICT (display_name) DO NOTHING;
  END IF;

  SELECT id INTO v_id FROM canonical_ingredients WHERE canonical_name = 'beans';
  IF v_id IS NOT NULL THEN
    INSERT INTO ingredient_aliases (display_name, canonical_ingredient_id) VALUES
    ('Beans', v_id), ('Black beans', v_id), ('Black bean', v_id),
    ('Kidney beans', v_id), ('Pinto beans', v_id), ('Red beans', v_id),
    ('White beans', v_id), ('Cannellini beans', v_id), ('Navy beans', v_id),
    ('Frijoles negros', v_id)
    ON CONFLICT (display_name) DO NOTHING;
  END IF;

  SELECT id INTO v_id FROM canonical_ingredients WHERE canonical_name = 'lentils';
  IF v_id IS NOT NULL THEN
    INSERT INTO ingredient_aliases (display_name, canonical_ingredient_id) VALUES
    ('Lentils', v_id), ('Red lentils', v_id), ('Green lentils', v_id),
    ('Black lentils', v_id), ('French lentils', v_id), ('Beluga lentils', v_id)
    ON CONFLICT (display_name) DO NOTHING;
  END IF;

  SELECT id INTO v_id FROM canonical_ingredients WHERE canonical_name = 'chickpeas';
  IF v_id IS NOT NULL THEN
    INSERT INTO ingredient_aliases (display_name, canonical_ingredient_id) VALUES
    ('Chickpeas', v_id), ('Garbanzo beans', v_id), ('Chana', v_id),
    ('Canned chickpeas', v_id)
    ON CONFLICT (display_name) DO NOTHING;
  END IF;

  -- ============================================================
  -- DAIRY
  -- ============================================================

  SELECT id INTO v_id FROM canonical_ingredients WHERE canonical_name = 'cream';
  IF v_id IS NOT NULL THEN
    INSERT INTO ingredient_aliases (display_name, canonical_ingredient_id) VALUES
    ('Cream', v_id), ('Heavy cream', v_id), ('Whipping cream', v_id),
    ('Sour cream', v_id), ('Half and half', v_id), ('Double cream', v_id),
    ('Crème fraîche', v_id)
    ON CONFLICT (display_name) DO NOTHING;
  END IF;

  SELECT id INTO v_id FROM canonical_ingredients WHERE canonical_name = 'yogurt';
  IF v_id IS NOT NULL THEN
    INSERT INTO ingredient_aliases (display_name, canonical_ingredient_id) VALUES
    ('Yogurt', v_id), ('Greek yogurt', v_id), ('Plain yogurt', v_id),
    ('Low-fat yogurt', v_id)
    ON CONFLICT (display_name) DO NOTHING;
  END IF;

  -- ============================================================
  -- VEGETABLES
  -- ============================================================

  SELECT id INTO v_id FROM canonical_ingredients WHERE canonical_name = 'pepper';
  IF v_id IS NOT NULL THEN
    INSERT INTO ingredient_aliases (display_name, canonical_ingredient_id) VALUES
    ('Bell pepper', v_id), ('Red bell pepper', v_id), ('Yellow bell pepper', v_id),
    ('Orange bell pepper', v_id), ('Green bell pepper', v_id), ('Capsicum', v_id),
    ('Sweet pepper', v_id)
    ON CONFLICT (display_name) DO NOTHING;
  END IF;

  SELECT id INTO v_id FROM canonical_ingredients WHERE canonical_name = 'carrot';
  IF v_id IS NOT NULL THEN
    INSERT INTO ingredient_aliases (display_name, canonical_ingredient_id) VALUES
    ('Carrot', v_id), ('Carrots', v_id), ('Baby carrots', v_id), ('Shredded carrot', v_id)
    ON CONFLICT (display_name) DO NOTHING;
  END IF;

  SELECT id INTO v_id FROM canonical_ingredients WHERE canonical_name = 'potato';
  IF v_id IS NOT NULL THEN
    INSERT INTO ingredient_aliases (display_name, canonical_ingredient_id) VALUES
    ('Potato', v_id), ('Potatoes', v_id), ('Russet potato', v_id),
    ('Yukon gold potato', v_id), ('New potatoes', v_id), ('Baby potatoes', v_id)
    ON CONFLICT (display_name) DO NOTHING;
  END IF;

  SELECT id INTO v_id FROM canonical_ingredients WHERE canonical_name = 'lettuce';
  IF v_id IS NOT NULL THEN
    INSERT INTO ingredient_aliases (display_name, canonical_ingredient_id) VALUES
    ('Lettuce', v_id), ('Romaine lettuce', v_id), ('Iceberg lettuce', v_id),
    ('Butter lettuce', v_id), ('Mixed greens', v_id), ('Salad greens', v_id),
    ('Green lettuce', v_id)
    ON CONFLICT (display_name) DO NOTHING;
  END IF;

  SELECT id INTO v_id FROM canonical_ingredients WHERE canonical_name = 'cucumber';
  IF v_id IS NOT NULL THEN
    INSERT INTO ingredient_aliases (display_name, canonical_ingredient_id) VALUES
    ('Cucumber', v_id), ('Cucumbers', v_id), ('English cucumber', v_id),
    ('Persian cucumber', v_id)
    ON CONFLICT (display_name) DO NOTHING;
  END IF;

  SELECT id INTO v_id FROM canonical_ingredients WHERE canonical_name = 'broccoli';
  IF v_id IS NOT NULL THEN
    INSERT INTO ingredient_aliases (display_name, canonical_ingredient_id) VALUES
    ('Broccoli', v_id), ('Broccoli florets', v_id), ('Broccolini', v_id)
    ON CONFLICT (display_name) DO NOTHING;
  END IF;

  SELECT id INTO v_id FROM canonical_ingredients WHERE canonical_name = 'mushroom';
  IF v_id IS NOT NULL THEN
    INSERT INTO ingredient_aliases (display_name, canonical_ingredient_id) VALUES
    ('Mushroom', v_id), ('Mushrooms', v_id), ('Button mushroom', v_id),
    ('Portobello mushroom', v_id), ('Shiitake mushroom', v_id),
    ('Cremini mushroom', v_id), ('Oyster mushroom', v_id), ('Porcini mushroom', v_id)
    ON CONFLICT (display_name) DO NOTHING;
  END IF;

  SELECT id INTO v_id FROM canonical_ingredients WHERE canonical_name = 'zucchini';
  IF v_id IS NOT NULL THEN
    INSERT INTO ingredient_aliases (display_name, canonical_ingredient_id) VALUES
    ('Zucchini', v_id), ('Zucchinis', v_id), ('Courgette', v_id)
    ON CONFLICT (display_name) DO NOTHING;
  END IF;

  SELECT id INTO v_id FROM canonical_ingredients WHERE canonical_name = 'celery';
  IF v_id IS NOT NULL THEN
    INSERT INTO ingredient_aliases (display_name, canonical_ingredient_id) VALUES
    ('Celery', v_id), ('Celery stalks', v_id), ('Celery root', v_id)
    ON CONFLICT (display_name) DO NOTHING;
  END IF;

  SELECT id INTO v_id FROM canonical_ingredients WHERE canonical_name = 'cabbage';
  IF v_id IS NOT NULL THEN
    INSERT INTO ingredient_aliases (display_name, canonical_ingredient_id) VALUES
    ('Cabbage', v_id), ('Red cabbage', v_id), ('Napa cabbage', v_id),
    ('Green cabbage', v_id), ('Savoy cabbage', v_id)
    ON CONFLICT (display_name) DO NOTHING;
  END IF;

  SELECT id INTO v_id FROM canonical_ingredients WHERE canonical_name = 'kale';
  IF v_id IS NOT NULL THEN
    INSERT INTO ingredient_aliases (display_name, canonical_ingredient_id) VALUES
    ('Kale', v_id), ('Baby kale', v_id), ('Curly kale', v_id), ('Lacinato kale', v_id)
    ON CONFLICT (display_name) DO NOTHING;
  END IF;

  SELECT id INTO v_id FROM canonical_ingredients WHERE canonical_name = 'asparagus';
  IF v_id IS NOT NULL THEN
    INSERT INTO ingredient_aliases (display_name, canonical_ingredient_id) VALUES
    ('Asparagus', v_id), ('Asparagus spears', v_id), ('Green asparagus', v_id)
    ON CONFLICT (display_name) DO NOTHING;
  END IF;

  SELECT id INTO v_id FROM canonical_ingredients WHERE canonical_name = 'corn';
  IF v_id IS NOT NULL THEN
    INSERT INTO ingredient_aliases (display_name, canonical_ingredient_id) VALUES
    ('Corn', v_id), ('Sweet corn', v_id), ('Corn on the cob', v_id),
    ('Canned corn', v_id), ('Corn kernels', v_id)
    ON CONFLICT (display_name) DO NOTHING;
  END IF;

  SELECT id INTO v_id FROM canonical_ingredients WHERE canonical_name = 'pumpkin';
  IF v_id IS NOT NULL THEN
    INSERT INTO ingredient_aliases (display_name, canonical_ingredient_id) VALUES
    ('Pumpkin', v_id), ('Butternut squash', v_id), ('Acorn squash', v_id),
    ('Delicata squash', v_id), ('Kabocha squash', v_id)
    ON CONFLICT (display_name) DO NOTHING;
  END IF;

  SELECT id INTO v_id FROM canonical_ingredients WHERE canonical_name = 'bok_choy';
  IF v_id IS NOT NULL THEN
    INSERT INTO ingredient_aliases (display_name, canonical_ingredient_id) VALUES
    ('Bok choy', v_id), ('Baby bok choy', v_id), ('Pak choi', v_id)
    ON CONFLICT (display_name) DO NOTHING;
  END IF;

  SELECT id INTO v_id FROM canonical_ingredients WHERE canonical_name = 'collard_greens';
  IF v_id IS NOT NULL THEN
    INSERT INTO ingredient_aliases (display_name, canonical_ingredient_id) VALUES
    ('Collard greens', v_id), ('Collards', v_id)
    ON CONFLICT (display_name) DO NOTHING;
  END IF;

  SELECT id INTO v_id FROM canonical_ingredients WHERE canonical_name = 'edamame';
  IF v_id IS NOT NULL THEN
    INSERT INTO ingredient_aliases (display_name, canonical_ingredient_id) VALUES
    ('Edamame', v_id), ('Shelled edamame', v_id)
    ON CONFLICT (display_name) DO NOTHING;
  END IF;

  SELECT id INTO v_id FROM canonical_ingredients WHERE canonical_name = 'fennel';
  IF v_id IS NOT NULL THEN
    INSERT INTO ingredient_aliases (display_name, canonical_ingredient_id) VALUES
    ('Fennel', v_id), ('Fennel bulb', v_id), ('Fennel fronds', v_id)
    ON CONFLICT (display_name) DO NOTHING;
  END IF;

  SELECT id INTO v_id FROM canonical_ingredients WHERE canonical_name = 'green_beans';
  IF v_id IS NOT NULL THEN
    INSERT INTO ingredient_aliases (display_name, canonical_ingredient_id) VALUES
    ('Green beans', v_id), ('French beans', v_id), ('String beans', v_id),
    ('Haricots verts', v_id), ('Snap beans', v_id)
    ON CONFLICT (display_name) DO NOTHING;
  END IF;

  SELECT id INTO v_id FROM canonical_ingredients WHERE canonical_name = 'radish';
  IF v_id IS NOT NULL THEN
    INSERT INTO ingredient_aliases (display_name, canonical_ingredient_id) VALUES
    ('Radish', v_id), ('Radishes', v_id), ('Daikon', v_id), ('Daikon radish', v_id)
    ON CONFLICT (display_name) DO NOTHING;
  END IF;

  SELECT id INTO v_id FROM canonical_ingredients WHERE canonical_name = 'shallot';
  IF v_id IS NOT NULL THEN
    INSERT INTO ingredient_aliases (display_name, canonical_ingredient_id) VALUES
    ('Shallot', v_id), ('Shallots', v_id), ('French shallot', v_id)
    ON CONFLICT (display_name) DO NOTHING;
  END IF;

  SELECT id INTO v_id FROM canonical_ingredients WHERE canonical_name = 'sweet_potato';
  IF v_id IS NOT NULL THEN
    INSERT INTO ingredient_aliases (display_name, canonical_ingredient_id) VALUES
    ('Sweet potato', v_id), ('Sweet potatoes', v_id), ('Yam', v_id),
    ('Japanese sweet potato', v_id)
    ON CONFLICT (display_name) DO NOTHING;
  END IF;

  SELECT id INTO v_id FROM canonical_ingredients WHERE canonical_name = 'turnip';
  IF v_id IS NOT NULL THEN
    INSERT INTO ingredient_aliases (display_name, canonical_ingredient_id) VALUES
    ('Turnip', v_id), ('Turnips', v_id), ('White turnip', v_id)
    ON CONFLICT (display_name) DO NOTHING;
  END IF;

  SELECT id INTO v_id FROM canonical_ingredients WHERE canonical_name = 'cassava';
  IF v_id IS NOT NULL THEN
    INSERT INTO ingredient_aliases (display_name, canonical_ingredient_id) VALUES
    ('Cassava', v_id), ('Yuca', v_id), ('Tapioca', v_id), ('Manioc', v_id)
    ON CONFLICT (display_name) DO NOTHING;
  END IF;

  -- ============================================================
  -- FRUITS
  -- ============================================================

  SELECT id INTO v_id FROM canonical_ingredients WHERE canonical_name = 'pineapple';
  IF v_id IS NOT NULL THEN
    INSERT INTO ingredient_aliases (display_name, canonical_ingredient_id) VALUES
    ('Pineapple', v_id), ('Fresh pineapple', v_id), ('Pineapple chunks', v_id),
    ('Canned pineapple', v_id)
    ON CONFLICT (display_name) DO NOTHING;
  END IF;

  SELECT id INTO v_id FROM canonical_ingredients WHERE canonical_name = 'dates';
  IF v_id IS NOT NULL THEN
    INSERT INTO ingredient_aliases (display_name, canonical_ingredient_id) VALUES
    ('Dates', v_id), ('Medjool dates', v_id), ('Dried dates', v_id)
    ON CONFLICT (display_name) DO NOTHING;
  END IF;

  SELECT id INTO v_id FROM canonical_ingredients WHERE canonical_name = 'pear';
  IF v_id IS NOT NULL THEN
    INSERT INTO ingredient_aliases (display_name, canonical_ingredient_id) VALUES
    ('Pear', v_id), ('Pears', v_id), ('Bosc pear', v_id), ('Asian pear', v_id)
    ON CONFLICT (display_name) DO NOTHING;
  END IF;

  SELECT id INTO v_id FROM canonical_ingredients WHERE canonical_name = 'plum';
  IF v_id IS NOT NULL THEN
    INSERT INTO ingredient_aliases (display_name, canonical_ingredient_id) VALUES
    ('Plum', v_id), ('Plums', v_id), ('Italian plum', v_id)
    ON CONFLICT (display_name) DO NOTHING;
  END IF;

  SELECT id INTO v_id FROM canonical_ingredients WHERE canonical_name = 'papaya';
  IF v_id IS NOT NULL THEN
    INSERT INTO ingredient_aliases (display_name, canonical_ingredient_id) VALUES
    ('Papaya', v_id), ('Green papaya', v_id)
    ON CONFLICT (display_name) DO NOTHING;
  END IF;

  SELECT id INTO v_id FROM canonical_ingredients WHERE canonical_name = 'tangerine';
  IF v_id IS NOT NULL THEN
    INSERT INTO ingredient_aliases (display_name, canonical_ingredient_id) VALUES
    ('Tangerine', v_id), ('Mandarin', v_id), ('Clementine', v_id), ('Mandarin orange', v_id)
    ON CONFLICT (display_name) DO NOTHING;
  END IF;

  -- ============================================================
  -- GRAINS & STARCHES
  -- ============================================================

  SELECT id INTO v_id FROM canonical_ingredients WHERE canonical_name = 'flour';
  IF v_id IS NOT NULL THEN
    INSERT INTO ingredient_aliases (display_name, canonical_ingredient_id) VALUES
    ('Flour', v_id), ('Bread flour', v_id), ('Cake flour', v_id),
    ('Self-raising flour', v_id), ('Whole wheat flour', v_id)
    ON CONFLICT (display_name) DO NOTHING;
  END IF;

  SELECT id INTO v_id FROM canonical_ingredients WHERE canonical_name = 'cornmeal';
  IF v_id IS NOT NULL THEN
    INSERT INTO ingredient_aliases (display_name, canonical_ingredient_id) VALUES
    ('Cornmeal', v_id), ('Yellow cornmeal', v_id), ('Grits', v_id)
    ON CONFLICT (display_name) DO NOTHING;
  END IF;

  SELECT id INTO v_id FROM canonical_ingredients WHERE canonical_name = 'polenta';
  IF v_id IS NOT NULL THEN
    INSERT INTO ingredient_aliases (display_name, canonical_ingredient_id) VALUES
    ('Polenta', v_id), ('Instant polenta', v_id), ('Cooked polenta', v_id)
    ON CONFLICT (display_name) DO NOTHING;
  END IF;

  SELECT id INTO v_id FROM canonical_ingredients WHERE canonical_name = 'cornstarch';
  IF v_id IS NOT NULL THEN
    INSERT INTO ingredient_aliases (display_name, canonical_ingredient_id) VALUES
    ('Cornstarch', v_id), ('Corn flour', v_id), ('Cornflour', v_id)
    ON CONFLICT (display_name) DO NOTHING;
  END IF;

  SELECT id INTO v_id FROM canonical_ingredients WHERE canonical_name = 'couscous';
  IF v_id IS NOT NULL THEN
    INSERT INTO ingredient_aliases (display_name, canonical_ingredient_id) VALUES
    ('Couscous', v_id), ('Whole wheat couscous', v_id), ('Pearl couscous', v_id)
    ON CONFLICT (display_name) DO NOTHING;
  END IF;

  SELECT id INTO v_id FROM canonical_ingredients WHERE canonical_name = 'bread_crumbs';
  IF v_id IS NOT NULL THEN
    INSERT INTO ingredient_aliases (display_name, canonical_ingredient_id) VALUES
    ('Bread crumbs', v_id), ('Breadcrumbs', v_id), ('Panko', v_id),
    ('Panko breadcrumbs', v_id), ('Italian breadcrumbs', v_id)
    ON CONFLICT (display_name) DO NOTHING;
  END IF;

  -- ============================================================
  -- NUTS & SEEDS
  -- ============================================================

  SELECT id INTO v_id FROM canonical_ingredients WHERE canonical_name = 'almonds';
  IF v_id IS NOT NULL THEN
    INSERT INTO ingredient_aliases (display_name, canonical_ingredient_id) VALUES
    ('Almonds', v_id), ('Sliced almonds', v_id), ('Blanched almonds', v_id),
    ('Whole almonds', v_id), ('Toasted almonds', v_id)
    ON CONFLICT (display_name) DO NOTHING;
  END IF;

  SELECT id INTO v_id FROM canonical_ingredients WHERE canonical_name = 'walnuts';
  IF v_id IS NOT NULL THEN
    INSERT INTO ingredient_aliases (display_name, canonical_ingredient_id) VALUES
    ('Walnuts', v_id), ('Walnut', v_id), ('Chopped walnuts', v_id),
    ('Toasted walnuts', v_id)
    ON CONFLICT (display_name) DO NOTHING;
  END IF;

  SELECT id INTO v_id FROM canonical_ingredients WHERE canonical_name = 'peanuts';
  IF v_id IS NOT NULL THEN
    INSERT INTO ingredient_aliases (display_name, canonical_ingredient_id) VALUES
    ('Peanuts', v_id), ('Peanut', v_id), ('Roasted peanuts', v_id),
    ('Dry-roasted peanuts', v_id)
    ON CONFLICT (display_name) DO NOTHING;
  END IF;

  SELECT id INTO v_id FROM canonical_ingredients WHERE canonical_name = 'cashews';
  IF v_id IS NOT NULL THEN
    INSERT INTO ingredient_aliases (display_name, canonical_ingredient_id) VALUES
    ('Cashews', v_id), ('Cashew', v_id), ('Roasted cashews', v_id),
    ('Raw cashews', v_id)
    ON CONFLICT (display_name) DO NOTHING;
  END IF;

  SELECT id INTO v_id FROM canonical_ingredients WHERE canonical_name = 'sesame';
  IF v_id IS NOT NULL THEN
    INSERT INTO ingredient_aliases (display_name, canonical_ingredient_id) VALUES
    ('Sesame seeds', v_id), ('White sesame seeds', v_id), ('Black sesame seeds', v_id),
    ('Toasted sesame seeds', v_id)
    ON CONFLICT (display_name) DO NOTHING;
  END IF;

  SELECT id INTO v_id FROM canonical_ingredients WHERE canonical_name = 'chia';
  IF v_id IS NOT NULL THEN
    INSERT INTO ingredient_aliases (display_name, canonical_ingredient_id) VALUES
    ('Chia seeds', v_id), ('Chia', v_id), ('Black chia seeds', v_id)
    ON CONFLICT (display_name) DO NOTHING;
  END IF;

  SELECT id INTO v_id FROM canonical_ingredients WHERE canonical_name = 'hazelnuts';
  IF v_id IS NOT NULL THEN
    INSERT INTO ingredient_aliases (display_name, canonical_ingredient_id) VALUES
    ('Hazelnuts', v_id), ('Hazelnut', v_id), ('Toasted hazelnuts', v_id)
    ON CONFLICT (display_name) DO NOTHING;
  END IF;

  SELECT id INTO v_id FROM canonical_ingredients WHERE canonical_name = 'pecans';
  IF v_id IS NOT NULL THEN
    INSERT INTO ingredient_aliases (display_name, canonical_ingredient_id) VALUES
    ('Pecans', v_id), ('Pecan', v_id), ('Candied pecans', v_id)
    ON CONFLICT (display_name) DO NOTHING;
  END IF;

  SELECT id INTO v_id FROM canonical_ingredients WHERE canonical_name = 'pistachios';
  IF v_id IS NOT NULL THEN
    INSERT INTO ingredient_aliases (display_name, canonical_ingredient_id) VALUES
    ('Pistachios', v_id), ('Pistachio', v_id), ('Shelled pistachios', v_id)
    ON CONFLICT (display_name) DO NOTHING;
  END IF;

  SELECT id INTO v_id FROM canonical_ingredients WHERE canonical_name = 'raisins';
  IF v_id IS NOT NULL THEN
    INSERT INTO ingredient_aliases (display_name, canonical_ingredient_id) VALUES
    ('Raisins', v_id), ('Sultanas', v_id), ('Currants', v_id), ('Golden raisins', v_id)
    ON CONFLICT (display_name) DO NOTHING;
  END IF;

  SELECT id INTO v_id FROM canonical_ingredients WHERE canonical_name = 'peanut_butter';
  IF v_id IS NOT NULL THEN
    INSERT INTO ingredient_aliases (display_name, canonical_ingredient_id) VALUES
    ('Peanut butter', v_id), ('Natural peanut butter', v_id),
    ('Crunchy peanut butter', v_id), ('Smooth peanut butter', v_id)
    ON CONFLICT (display_name) DO NOTHING;
  END IF;

  -- ============================================================
  -- SPICES & HERBS
  -- ============================================================

  SELECT id INTO v_id FROM canonical_ingredients WHERE canonical_name = 'cumin';
  IF v_id IS NOT NULL THEN
    INSERT INTO ingredient_aliases (display_name, canonical_ingredient_id) VALUES
    ('Cumin', v_id), ('Ground cumin', v_id), ('Cumin seeds', v_id), ('Whole cumin', v_id)
    ON CONFLICT (display_name) DO NOTHING;
  END IF;

  SELECT id INTO v_id FROM canonical_ingredients WHERE canonical_name = 'paprika';
  IF v_id IS NOT NULL THEN
    INSERT INTO ingredient_aliases (display_name, canonical_ingredient_id) VALUES
    ('Paprika', v_id), ('Smoked paprika', v_id), ('Sweet paprika', v_id),
    ('Hot paprika', v_id)
    ON CONFLICT (display_name) DO NOTHING;
  END IF;

  SELECT id INTO v_id FROM canonical_ingredients WHERE canonical_name = 'oregano';
  IF v_id IS NOT NULL THEN
    INSERT INTO ingredient_aliases (display_name, canonical_ingredient_id) VALUES
    ('Oregano', v_id), ('Dried oregano', v_id), ('Fresh oregano', v_id),
    ('Greek oregano', v_id)
    ON CONFLICT (display_name) DO NOTHING;
  END IF;

  SELECT id INTO v_id FROM canonical_ingredients WHERE canonical_name = 'cilantro';
  IF v_id IS NOT NULL THEN
    INSERT INTO ingredient_aliases (display_name, canonical_ingredient_id) VALUES
    ('Cilantro', v_id), ('Fresh cilantro', v_id), ('Coriander leaves', v_id),
    ('Coriander', v_id), ('Chinese parsley', v_id)
    ON CONFLICT (display_name) DO NOTHING;
  END IF;

  SELECT id INTO v_id FROM canonical_ingredients WHERE canonical_name = 'parsley';
  IF v_id IS NOT NULL THEN
    INSERT INTO ingredient_aliases (display_name, canonical_ingredient_id) VALUES
    ('Parsley', v_id), ('Fresh parsley', v_id), ('Dried parsley', v_id),
    ('Flat-leaf parsley', v_id), ('Italian parsley', v_id), ('Curly parsley', v_id)
    ON CONFLICT (display_name) DO NOTHING;
  END IF;

  SELECT id INTO v_id FROM canonical_ingredients WHERE canonical_name = 'thyme';
  IF v_id IS NOT NULL THEN
    INSERT INTO ingredient_aliases (display_name, canonical_ingredient_id) VALUES
    ('Thyme', v_id), ('Fresh thyme', v_id), ('Dried thyme', v_id), ('Lemon thyme', v_id)
    ON CONFLICT (display_name) DO NOTHING;
  END IF;

  SELECT id INTO v_id FROM canonical_ingredients WHERE canonical_name = 'rosemary';
  IF v_id IS NOT NULL THEN
    INSERT INTO ingredient_aliases (display_name, canonical_ingredient_id) VALUES
    ('Rosemary', v_id), ('Fresh rosemary', v_id), ('Dried rosemary', v_id),
    ('Rosemary sprig', v_id)
    ON CONFLICT (display_name) DO NOTHING;
  END IF;

  SELECT id INTO v_id FROM canonical_ingredients WHERE canonical_name = 'cinnamon';
  IF v_id IS NOT NULL THEN
    INSERT INTO ingredient_aliases (display_name, canonical_ingredient_id) VALUES
    ('Cinnamon', v_id), ('Ground cinnamon', v_id), ('Cinnamon sticks', v_id),
    ('Ceylon cinnamon', v_id)
    ON CONFLICT (display_name) DO NOTHING;
  END IF;

  SELECT id INTO v_id FROM canonical_ingredients WHERE canonical_name = 'ginger';
  IF v_id IS NOT NULL THEN
    INSERT INTO ingredient_aliases (display_name, canonical_ingredient_id) VALUES
    ('Ginger', v_id), ('Fresh ginger', v_id), ('Ginger root', v_id),
    ('Ground ginger', v_id), ('Minced ginger', v_id), ('Pickled ginger', v_id)
    ON CONFLICT (display_name) DO NOTHING;
  END IF;

  SELECT id INTO v_id FROM canonical_ingredients WHERE canonical_name = 'anise';
  IF v_id IS NOT NULL THEN
    INSERT INTO ingredient_aliases (display_name, canonical_ingredient_id) VALUES
    ('Anise', v_id), ('Aniseed', v_id)
    ON CONFLICT (display_name) DO NOTHING;
  END IF;

  SELECT id INTO v_id FROM canonical_ingredients WHERE canonical_name = 'bay_leaf';
  IF v_id IS NOT NULL THEN
    INSERT INTO ingredient_aliases (display_name, canonical_ingredient_id) VALUES
    ('Bay leaf', v_id), ('Bay leaves', v_id), ('Dried bay leaf', v_id)
    ON CONFLICT (display_name) DO NOTHING;
  END IF;

  SELECT id INTO v_id FROM canonical_ingredients WHERE canonical_name = 'cardamom';
  IF v_id IS NOT NULL THEN
    INSERT INTO ingredient_aliases (display_name, canonical_ingredient_id) VALUES
    ('Cardamom', v_id), ('Ground cardamom', v_id), ('Cardamom pods', v_id)
    ON CONFLICT (display_name) DO NOTHING;
  END IF;

  SELECT id INTO v_id FROM canonical_ingredients WHERE canonical_name = 'caraway';
  IF v_id IS NOT NULL THEN
    INSERT INTO ingredient_aliases (display_name, canonical_ingredient_id) VALUES
    ('Caraway seeds', v_id), ('Caraway', v_id)
    ON CONFLICT (display_name) DO NOTHING;
  END IF;

  SELECT id INTO v_id FROM canonical_ingredients WHERE canonical_name = 'cayenne';
  IF v_id IS NOT NULL THEN
    INSERT INTO ingredient_aliases (display_name, canonical_ingredient_id) VALUES
    ('Cayenne pepper', v_id), ('Cayenne', v_id), ('Ground cayenne', v_id),
    ('Red chili pepper', v_id)
    ON CONFLICT (display_name) DO NOTHING;
  END IF;

  SELECT id INTO v_id FROM canonical_ingredients WHERE canonical_name = 'chili_flakes';
  IF v_id IS NOT NULL THEN
    INSERT INTO ingredient_aliases (display_name, canonical_ingredient_id) VALUES
    ('Chili flakes', v_id), ('Red pepper flakes', v_id), ('Crushed red pepper', v_id),
    ('Chilli flakes', v_id)
    ON CONFLICT (display_name) DO NOTHING;
  END IF;

  SELECT id INTO v_id FROM canonical_ingredients WHERE canonical_name = 'chives';
  IF v_id IS NOT NULL THEN
    INSERT INTO ingredient_aliases (display_name, canonical_ingredient_id) VALUES
    ('Chives', v_id), ('Fresh chives', v_id), ('Dried chives', v_id)
    ON CONFLICT (display_name) DO NOTHING;
  END IF;

  SELECT id INTO v_id FROM canonical_ingredients WHERE canonical_name = 'curry_powder';
  IF v_id IS NOT NULL THEN
    INSERT INTO ingredient_aliases (display_name, canonical_ingredient_id) VALUES
    ('Curry powder', v_id), ('Madras curry powder', v_id)
    ON CONFLICT (display_name) DO NOTHING;
  END IF;

  SELECT id INTO v_id FROM canonical_ingredients WHERE canonical_name = 'curry_paste';
  IF v_id IS NOT NULL THEN
    INSERT INTO ingredient_aliases (display_name, canonical_ingredient_id) VALUES
    ('Curry paste', v_id), ('Red curry paste', v_id), ('Green curry paste', v_id),
    ('Yellow curry paste', v_id), ('Thai curry paste', v_id)
    ON CONFLICT (display_name) DO NOTHING;
  END IF;

  SELECT id INTO v_id FROM canonical_ingredients WHERE canonical_name = 'curry_leaves';
  IF v_id IS NOT NULL THEN
    INSERT INTO ingredient_aliases (display_name, canonical_ingredient_id) VALUES
    ('Curry leaves', v_id), ('Fresh curry leaves', v_id)
    ON CONFLICT (display_name) DO NOTHING;
  END IF;

  SELECT id INTO v_id FROM canonical_ingredients WHERE canonical_name = 'dill';
  IF v_id IS NOT NULL THEN
    INSERT INTO ingredient_aliases (display_name, canonical_ingredient_id) VALUES
    ('Dill', v_id), ('Fresh dill', v_id), ('Dried dill', v_id), ('Dill weed', v_id)
    ON CONFLICT (display_name) DO NOTHING;
  END IF;

  SELECT id INTO v_id FROM canonical_ingredients WHERE canonical_name = 'garlic_powder';
  IF v_id IS NOT NULL THEN
    INSERT INTO ingredient_aliases (display_name, canonical_ingredient_id) VALUES
    ('Garlic powder', v_id), ('Garlic granules', v_id)
    ON CONFLICT (display_name) DO NOTHING;
  END IF;

  SELECT id INTO v_id FROM canonical_ingredients WHERE canonical_name = 'lemongrass';
  IF v_id IS NOT NULL THEN
    INSERT INTO ingredient_aliases (display_name, canonical_ingredient_id) VALUES
    ('Lemongrass', v_id), ('Lemon grass', v_id), ('Lemongrass stalk', v_id)
    ON CONFLICT (display_name) DO NOTHING;
  END IF;

  SELECT id INTO v_id FROM canonical_ingredients WHERE canonical_name = 'mint';
  IF v_id IS NOT NULL THEN
    INSERT INTO ingredient_aliases (display_name, canonical_ingredient_id) VALUES
    ('Mint', v_id), ('Fresh mint', v_id), ('Peppermint', v_id),
    ('Spearmint', v_id), ('Dried mint', v_id)
    ON CONFLICT (display_name) DO NOTHING;
  END IF;

  SELECT id INTO v_id FROM canonical_ingredients WHERE canonical_name = 'nutmeg';
  IF v_id IS NOT NULL THEN
    INSERT INTO ingredient_aliases (display_name, canonical_ingredient_id) VALUES
    ('Nutmeg', v_id), ('Ground nutmeg', v_id), ('Whole nutmeg', v_id)
    ON CONFLICT (display_name) DO NOTHING;
  END IF;

  SELECT id INTO v_id FROM canonical_ingredients WHERE canonical_name = 'onion_powder';
  IF v_id IS NOT NULL THEN
    INSERT INTO ingredient_aliases (display_name, canonical_ingredient_id) VALUES
    ('Onion powder', v_id), ('Onion granules', v_id)
    ON CONFLICT (display_name) DO NOTHING;
  END IF;

  SELECT id INTO v_id FROM canonical_ingredients WHERE canonical_name = 'saffron';
  IF v_id IS NOT NULL THEN
    INSERT INTO ingredient_aliases (display_name, canonical_ingredient_id) VALUES
    ('Saffron', v_id), ('Saffron threads', v_id)
    ON CONFLICT (display_name) DO NOTHING;
  END IF;

  SELECT id INTO v_id FROM canonical_ingredients WHERE canonical_name = 'sage';
  IF v_id IS NOT NULL THEN
    INSERT INTO ingredient_aliases (display_name, canonical_ingredient_id) VALUES
    ('Sage', v_id), ('Fresh sage', v_id), ('Dried sage', v_id), ('Ground sage', v_id)
    ON CONFLICT (display_name) DO NOTHING;
  END IF;

  SELECT id INTO v_id FROM canonical_ingredients WHERE canonical_name = 'star_anise';
  IF v_id IS NOT NULL THEN
    INSERT INTO ingredient_aliases (display_name, canonical_ingredient_id) VALUES
    ('Star anise', v_id), ('Whole star anise', v_id)
    ON CONFLICT (display_name) DO NOTHING;
  END IF;

  SELECT id INTO v_id FROM canonical_ingredients WHERE canonical_name = 'tarragon';
  IF v_id IS NOT NULL THEN
    INSERT INTO ingredient_aliases (display_name, canonical_ingredient_id) VALUES
    ('Tarragon', v_id), ('Fresh tarragon', v_id), ('Dried tarragon', v_id),
    ('French tarragon', v_id)
    ON CONFLICT (display_name) DO NOTHING;
  END IF;

  SELECT id INTO v_id FROM canonical_ingredients WHERE canonical_name = 'turmeric';
  IF v_id IS NOT NULL THEN
    INSERT INTO ingredient_aliases (display_name, canonical_ingredient_id) VALUES
    ('Turmeric', v_id), ('Ground turmeric', v_id), ('Fresh turmeric', v_id),
    ('Turmeric powder', v_id)
    ON CONFLICT (display_name) DO NOTHING;
  END IF;

  SELECT id INTO v_id FROM canonical_ingredients WHERE canonical_name = 'white_pepper';
  IF v_id IS NOT NULL THEN
    INSERT INTO ingredient_aliases (display_name, canonical_ingredient_id) VALUES
    ('White pepper', v_id), ('Ground white pepper', v_id), ('White peppercorns', v_id)
    ON CONFLICT (display_name) DO NOTHING;
  END IF;

  SELECT id INTO v_id FROM canonical_ingredients WHERE canonical_name = 'cajun_seasoning';
  IF v_id IS NOT NULL THEN
    INSERT INTO ingredient_aliases (display_name, canonical_ingredient_id) VALUES
    ('Cajun seasoning', v_id), ('Cajun spice', v_id)
    ON CONFLICT (display_name) DO NOTHING;
  END IF;

  -- ============================================================
  -- OILS
  -- ============================================================

  SELECT id INTO v_id FROM canonical_ingredients WHERE canonical_name = 'vegetable_oil';
  IF v_id IS NOT NULL THEN
    INSERT INTO ingredient_aliases (display_name, canonical_ingredient_id) VALUES
    ('Vegetable oil', v_id), ('Canola oil', v_id), ('Sunflower oil', v_id),
    ('Cooking oil', v_id), ('Grapeseed oil', v_id), ('Corn oil', v_id)
    ON CONFLICT (display_name) DO NOTHING;
  END IF;

  SELECT id INTO v_id FROM canonical_ingredients WHERE canonical_name = 'sesame_oil';
  IF v_id IS NOT NULL THEN
    INSERT INTO ingredient_aliases (display_name, canonical_ingredient_id) VALUES
    ('Sesame oil', v_id), ('Toasted sesame oil', v_id), ('Dark sesame oil', v_id)
    ON CONFLICT (display_name) DO NOTHING;
  END IF;

  -- ============================================================
  -- CONDIMENTS & SAUCES
  -- ============================================================

  SELECT id INTO v_id FROM canonical_ingredients WHERE canonical_name = 'soy_sauce';
  IF v_id IS NOT NULL THEN
    INSERT INTO ingredient_aliases (display_name, canonical_ingredient_id) VALUES
    ('Soy sauce', v_id), ('Shoyu', v_id), ('Low-sodium soy sauce', v_id),
    ('Light soy sauce', v_id), ('Dark soy sauce', v_id)
    ON CONFLICT (display_name) DO NOTHING;
  END IF;

  SELECT id INTO v_id FROM canonical_ingredients WHERE canonical_name = 'vinegar';
  IF v_id IS NOT NULL THEN
    INSERT INTO ingredient_aliases (display_name, canonical_ingredient_id) VALUES
    ('Vinegar', v_id), ('White vinegar', v_id), ('Balsamic vinegar', v_id),
    ('Apple cider vinegar', v_id), ('Red wine vinegar', v_id),
    ('Rice vinegar', v_id), ('Sherry vinegar', v_id)
    ON CONFLICT (display_name) DO NOTHING;
  END IF;

  SELECT id INTO v_id FROM canonical_ingredients WHERE canonical_name = 'honey';
  IF v_id IS NOT NULL THEN
    INSERT INTO ingredient_aliases (display_name, canonical_ingredient_id) VALUES
    ('Honey', v_id), ('Raw honey', v_id), ('Organic honey', v_id),
    ('Manuka honey', v_id)
    ON CONFLICT (display_name) DO NOTHING;
  END IF;

  SELECT id INTO v_id FROM canonical_ingredients WHERE canonical_name = 'sugar';
  IF v_id IS NOT NULL THEN
    INSERT INTO ingredient_aliases (display_name, canonical_ingredient_id) VALUES
    ('Sugar', v_id), ('White sugar', v_id), ('Granulated sugar', v_id),
    ('Cane sugar', v_id), ('Brown sugar', v_id), ('Light brown sugar', v_id),
    ('Dark brown sugar', v_id), ('Raw sugar', v_id), ('Turbinado sugar', v_id),
    ('Icing sugar', v_id), ('Powdered sugar', v_id), ('Confectioners sugar', v_id)
    ON CONFLICT (display_name) DO NOTHING;
  END IF;

  SELECT id INTO v_id FROM canonical_ingredients WHERE canonical_name = 'ketchup';
  IF v_id IS NOT NULL THEN
    INSERT INTO ingredient_aliases (display_name, canonical_ingredient_id) VALUES
    ('Ketchup', v_id), ('Tomato ketchup', v_id), ('Catsup', v_id)
    ON CONFLICT (display_name) DO NOTHING;
  END IF;

  SELECT id INTO v_id FROM canonical_ingredients WHERE canonical_name = 'mayonnaise';
  IF v_id IS NOT NULL THEN
    INSERT INTO ingredient_aliases (display_name, canonical_ingredient_id) VALUES
    ('Mayonnaise', v_id), ('Mayo', v_id), ('Japanese mayo', v_id), ('Kewpie mayo', v_id)
    ON CONFLICT (display_name) DO NOTHING;
  END IF;

  SELECT id INTO v_id FROM canonical_ingredients WHERE canonical_name = 'mustard';
  IF v_id IS NOT NULL THEN
    INSERT INTO ingredient_aliases (display_name, canonical_ingredient_id) VALUES
    ('Mustard', v_id), ('Yellow mustard', v_id), ('Dijon mustard', v_id),
    ('Whole grain mustard', v_id), ('English mustard', v_id), ('Stone ground mustard', v_id)
    ON CONFLICT (display_name) DO NOTHING;
  END IF;

  SELECT id INTO v_id FROM canonical_ingredients WHERE canonical_name = 'capers';
  IF v_id IS NOT NULL THEN
    INSERT INTO ingredient_aliases (display_name, canonical_ingredient_id) VALUES
    ('Capers', v_id), ('Caper berries', v_id)
    ON CONFLICT (display_name) DO NOTHING;
  END IF;

  SELECT id INTO v_id FROM canonical_ingredients WHERE canonical_name = 'caramel';
  IF v_id IS NOT NULL THEN
    INSERT INTO ingredient_aliases (display_name, canonical_ingredient_id) VALUES
    ('Caramel', v_id), ('Caramel sauce', v_id), ('Dulce de leche', v_id)
    ON CONFLICT (display_name) DO NOTHING;
  END IF;

  SELECT id INTO v_id FROM canonical_ingredients WHERE canonical_name = 'chili_oil';
  IF v_id IS NOT NULL THEN
    INSERT INTO ingredient_aliases (display_name, canonical_ingredient_id) VALUES
    ('Chili oil', v_id), ('Chilli oil', v_id)
    ON CONFLICT (display_name) DO NOTHING;
  END IF;

  SELECT id INTO v_id FROM canonical_ingredients WHERE canonical_name = 'chili_paste';
  IF v_id IS NOT NULL THEN
    INSERT INTO ingredient_aliases (display_name, canonical_ingredient_id) VALUES
    ('Chili paste', v_id), ('Sambal oelek', v_id), ('Chilli paste', v_id)
    ON CONFLICT (display_name) DO NOTHING;
  END IF;

  SELECT id INTO v_id FROM canonical_ingredients WHERE canonical_name = 'fish_sauce';
  IF v_id IS NOT NULL THEN
    INSERT INTO ingredient_aliases (display_name, canonical_ingredient_id) VALUES
    ('Fish sauce', v_id), ('Nam pla', v_id), ('Nuoc mam', v_id)
    ON CONFLICT (display_name) DO NOTHING;
  END IF;

  SELECT id INTO v_id FROM canonical_ingredients WHERE canonical_name = 'gochujang';
  IF v_id IS NOT NULL THEN
    INSERT INTO ingredient_aliases (display_name, canonical_ingredient_id) VALUES
    ('Gochujang', v_id), ('Korean chili paste', v_id), ('Korean red pepper paste', v_id)
    ON CONFLICT (display_name) DO NOTHING;
  END IF;

  SELECT id INTO v_id FROM canonical_ingredients WHERE canonical_name = 'harissa';
  IF v_id IS NOT NULL THEN
    INSERT INTO ingredient_aliases (display_name, canonical_ingredient_id) VALUES
    ('Harissa', v_id), ('Harissa paste', v_id)
    ON CONFLICT (display_name) DO NOTHING;
  END IF;

  SELECT id INTO v_id FROM canonical_ingredients WHERE canonical_name = 'hummus';
  IF v_id IS NOT NULL THEN
    INSERT INTO ingredient_aliases (display_name, canonical_ingredient_id) VALUES
    ('Hummus', v_id), ('Homemade hummus', v_id)
    ON CONFLICT (display_name) DO NOTHING;
  END IF;

  SELECT id INTO v_id FROM canonical_ingredients WHERE canonical_name = 'kimchi';
  IF v_id IS NOT NULL THEN
    INSERT INTO ingredient_aliases (display_name, canonical_ingredient_id) VALUES
    ('Kimchi', v_id), ('Baechu kimchi', v_id)
    ON CONFLICT (display_name) DO NOTHING;
  END IF;

  SELECT id INTO v_id FROM canonical_ingredients WHERE canonical_name = 'miso';
  IF v_id IS NOT NULL THEN
    INSERT INTO ingredient_aliases (display_name, canonical_ingredient_id) VALUES
    ('Miso', v_id), ('Miso paste', v_id), ('White miso', v_id),
    ('Red miso', v_id), ('Yellow miso', v_id)
    ON CONFLICT (display_name) DO NOTHING;
  END IF;

  SELECT id INTO v_id FROM canonical_ingredients WHERE canonical_name = 'marinara';
  IF v_id IS NOT NULL THEN
    INSERT INTO ingredient_aliases (display_name, canonical_ingredient_id) VALUES
    ('Marinara sauce', v_id), ('Marinara', v_id), ('Tomato marinara', v_id)
    ON CONFLICT (display_name) DO NOTHING;
  END IF;

  SELECT id INTO v_id FROM canonical_ingredients WHERE canonical_name = 'salsa';
  IF v_id IS NOT NULL THEN
    INSERT INTO ingredient_aliases (display_name, canonical_ingredient_id) VALUES
    ('Salsa', v_id), ('Fresh salsa', v_id), ('Pico de gallo', v_id),
    ('Tomatillo salsa', v_id)
    ON CONFLICT (display_name) DO NOTHING;
  END IF;

  SELECT id INTO v_id FROM canonical_ingredients WHERE canonical_name = 'tahini';
  IF v_id IS NOT NULL THEN
    INSERT INTO ingredient_aliases (display_name, canonical_ingredient_id) VALUES
    ('Tahini', v_id), ('Sesame paste', v_id)
    ON CONFLICT (display_name) DO NOTHING;
  END IF;

  SELECT id INTO v_id FROM canonical_ingredients WHERE canonical_name = 'tamari';
  IF v_id IS NOT NULL THEN
    INSERT INTO ingredient_aliases (display_name, canonical_ingredient_id) VALUES
    ('Tamari', v_id), ('Tamari sauce', v_id), ('Gluten-free soy sauce', v_id)
    ON CONFLICT (display_name) DO NOTHING;
  END IF;

  SELECT id INTO v_id FROM canonical_ingredients WHERE canonical_name = 'tomato_paste';
  IF v_id IS NOT NULL THEN
    INSERT INTO ingredient_aliases (display_name, canonical_ingredient_id) VALUES
    ('Tomato paste', v_id), ('Double concentrate tomato paste', v_id),
    ('Tomato concentrate', v_id)
    ON CONFLICT (display_name) DO NOTHING;
  END IF;

  SELECT id INTO v_id FROM canonical_ingredients WHERE canonical_name = 'tomato_sauce';
  IF v_id IS NOT NULL THEN
    INSERT INTO ingredient_aliases (display_name, canonical_ingredient_id) VALUES
    ('Tomato sauce', v_id), ('Passata', v_id), ('Crushed tomatoes', v_id),
    ('Strained tomatoes', v_id)
    ON CONFLICT (display_name) DO NOTHING;
  END IF;

  SELECT id INTO v_id FROM canonical_ingredients WHERE canonical_name = 'maple_syrup';
  IF v_id IS NOT NULL THEN
    INSERT INTO ingredient_aliases (display_name, canonical_ingredient_id) VALUES
    ('Maple syrup', v_id), ('Pure maple syrup', v_id), ('Grade A maple syrup', v_id)
    ON CONFLICT (display_name) DO NOTHING;
  END IF;

  SELECT id INTO v_id FROM canonical_ingredients WHERE canonical_name = 'date_syrup';
  IF v_id IS NOT NULL THEN
    INSERT INTO ingredient_aliases (display_name, canonical_ingredient_id) VALUES
    ('Date syrup', v_id), ('Date molasses', v_id)
    ON CONFLICT (display_name) DO NOTHING;
  END IF;

  SELECT id INTO v_id FROM canonical_ingredients WHERE canonical_name = 'olives';
  IF v_id IS NOT NULL THEN
    INSERT INTO ingredient_aliases (display_name, canonical_ingredient_id) VALUES
    ('Olives', v_id), ('Black olives', v_id), ('Green olives', v_id),
    ('Kalamata olives', v_id), ('Castelvetrano olives', v_id)
    ON CONFLICT (display_name) DO NOTHING;
  END IF;

  SELECT id INTO v_id FROM canonical_ingredients WHERE canonical_name = 'pickles';
  IF v_id IS NOT NULL THEN
    INSERT INTO ingredient_aliases (display_name, canonical_ingredient_id) VALUES
    ('Pickles', v_id), ('Dill pickles', v_id), ('Gherkins', v_id),
    ('Pickled cucumbers', v_id), ('Bread and butter pickles', v_id)
    ON CONFLICT (display_name) DO NOTHING;
  END IF;

  -- ============================================================
  -- BAKING
  -- ============================================================

  SELECT id INTO v_id FROM canonical_ingredients WHERE canonical_name = 'vanilla';
  IF v_id IS NOT NULL THEN
    INSERT INTO ingredient_aliases (display_name, canonical_ingredient_id) VALUES
    ('Vanilla', v_id), ('Vanilla extract', v_id), ('Vanilla bean', v_id),
    ('Vanilla paste', v_id), ('Vanilla pod', v_id)
    ON CONFLICT (display_name) DO NOTHING;
  END IF;

  SELECT id INTO v_id FROM canonical_ingredients WHERE canonical_name = 'chocolate';
  IF v_id IS NOT NULL THEN
    INSERT INTO ingredient_aliases (display_name, canonical_ingredient_id) VALUES
    ('Chocolate', v_id), ('Dark chocolate', v_id), ('Milk chocolate', v_id),
    ('White chocolate', v_id), ('Chocolate chips', v_id), ('Cocoa powder', v_id),
    ('Unsweetened cocoa', v_id), ('Semi-sweet chocolate', v_id),
    ('Bittersweet chocolate', v_id)
    ON CONFLICT (display_name) DO NOTHING;
  END IF;

  SELECT id INTO v_id FROM canonical_ingredients WHERE canonical_name = 'brown_sugar';
  IF v_id IS NOT NULL THEN
    INSERT INTO ingredient_aliases (display_name, canonical_ingredient_id) VALUES
    ('Brown sugar', v_id), ('Light brown sugar', v_id), ('Dark brown sugar', v_id),
    ('Demerara sugar', v_id)
    ON CONFLICT (display_name) DO NOTHING;
  END IF;

  -- ============================================================
  -- BEVERAGES & BROTH
  -- ============================================================

  SELECT id INTO v_id FROM canonical_ingredients WHERE canonical_name = 'bone_broth';
  IF v_id IS NOT NULL THEN
    INSERT INTO ingredient_aliases (display_name, canonical_ingredient_id) VALUES
    ('Bone broth', v_id), ('Beef broth', v_id), ('Chicken broth', v_id),
    ('Vegetable broth', v_id), ('Stock', v_id), ('Beef stock', v_id),
    ('Chicken stock', v_id), ('Vegetable stock', v_id), ('Fish stock', v_id)
    ON CONFLICT (display_name) DO NOTHING;
  END IF;

  -- ============================================================
  -- ASIAN PANTRY
  -- ============================================================

  SELECT id INTO v_id FROM canonical_ingredients WHERE canonical_name = 'nori';
  IF v_id IS NOT NULL THEN
    INSERT INTO ingredient_aliases (display_name, canonical_ingredient_id) VALUES
    ('Nori', v_id), ('Nori sheets', v_id), ('Roasted nori', v_id)
    ON CONFLICT (display_name) DO NOTHING;
  END IF;

  SELECT id INTO v_id FROM canonical_ingredients WHERE canonical_name = 'seaweed';
  IF v_id IS NOT NULL THEN
    INSERT INTO ingredient_aliases (display_name, canonical_ingredient_id) VALUES
    ('Seaweed', v_id), ('Wakame', v_id), ('Kombu', v_id), ('Kelp', v_id)
    ON CONFLICT (display_name) DO NOTHING;
  END IF;

  RAISE NOTICE '========================================';
  RAISE NOTICE 'Fixed missing ingredient aliases!';
  RAISE NOTICE '========================================';
  RAISE NOTICE 'Total canonical ingredients: %',
    (SELECT COUNT(*) FROM canonical_ingredients);
  RAISE NOTICE 'Total ingredient aliases: %',
    (SELECT COUNT(*) FROM ingredient_aliases);
  RAISE NOTICE 'Canonical ingredients with NO aliases: %',
    (SELECT COUNT(*) FROM canonical_ingredients ci
     WHERE NOT EXISTS (
       SELECT 1 FROM ingredient_aliases ia
       WHERE ia.canonical_ingredient_id = ci.id
     ));
  RAISE NOTICE '========================================';
END $$;
