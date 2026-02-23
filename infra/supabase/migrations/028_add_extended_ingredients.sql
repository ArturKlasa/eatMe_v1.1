-- Extended ingredient list
-- Adds new canonical ingredients and aliases from the full ingredient catalogue.
-- All inserts use ON CONFLICT DO NOTHING to be idempotent.
-- Existing canonicals are not duplicated; new display-name aliases are simply added.

-- ============================================================
-- STEP 1: NEW CANONICAL INGREDIENTS
-- (only those not already present in migrations 014/015/027)
-- ============================================================

INSERT INTO canonical_ingredients (canonical_name, is_vegetarian, is_vegan) VALUES
-- Grains & starches
('amaranth',         true,  true),
('barley',           true,  true),
('buckwheat',        true,  true),
('bulgur',           true,  true),
('farro',            true,  true),
('millet',           true,  true),
('sorghum',          true,  true),
('black_rice',       true,  true),
('arborio_rice',     true,  true),
('semolina',         true,  true),
('wheat_berries',    true,  true),
('fregola',          true,  true),
('gnocchi',          true,  true),    -- technically pasta but distinct display
('lasagna_sheets',   true,  true),
('soba_noodles',     true,  true),
('ramen_noodles',    true,  true),
('rice_noodles',     true,  true),
('egg_noodles',      true,  false),
('vermicelli',       true,  true),
('tortilla_chips',   true,  true),
('pita_bread',       true,  true),
('pizza_dough',      true,  true),
('graham_crackers',  true,  false),
('shortcrust_pastry',true,  false),

-- Legumes & beans
('adzuki_beans',     true,  true),
('mung_beans',       true,  true),
('navy_beans',       true,  true),
('split_peas',       true,  true),
('green_peas',       true,  true),
('snap_peas',        true,  true),
('snow_peas',        true,  true),
('frozen_peas',      true,  true),
('black_eyed_peas',  true,  true),

-- Vegetables (new)
('brussels_sprouts', true,  true),
('beets',            true,  true),
('chicory',          true,  true),
('eggplant',         true,  true),
('endive',           true,  true),
('green_chili',      true,  true),
('jalapeno',         true,  true),
('jicama',           true,  true),
('leek',             true,  true),
('parsnip',          true,  true),
('radicchio',        true,  true),
('spaghetti_squash', true,  true),
('spring_onion',     true,  true),
('swiss_chard',      true,  true),
('water_chestnuts',  true,  true),
('watercress',       true,  true),
('bean_sprouts',     true,  true),
('broccoli_rabe',    true,  true),
('cactus_pads',      true,  true),
('garlic_scapes',    true,  true),
('turnip_greens',    true,  true),
('banana_blossom',   true,  true),
('banana_leaves',    true,  true),

-- Fruits (new)
('blackberries',     true,  true),
('blueberries',      true,  true),
('cranberries',      true,  true),
('figs',             true,  true),
('grapefruit',       true,  true),
('grapes',           true,  true),
('guava',            true,  true),
('mango_puree',      true,  true),
('nectarines',       true,  true),
('passion_fruit',    true,  true),
('peach',            true,  true),
('pomegranate',      true,  true),
('prunes',           true,  true),
('raspberries',      true,  true),
('elderflower',      true,  true),

-- Nuts & seeds (new)
('flax_seeds',       true,  true),
('macadamia_nuts',   true,  true),
('nigella_seeds',    true,  true),
('pine_nuts',        true,  true),
('pumpkin_seeds',    true,  true),
('sunflower_seeds',  true,  true),
('chestnuts',        true,  true),
('almond_paste',     true,  true),
('almond_butter',    true,  true),

-- Dairy & dairy alternatives (new)
('buttermilk',       true,  false),
('clotted_cream',    true,  false),
('condensed_milk',   true,  false),
('cottage_cheese',   true,  false),
('custard_powder',   true,  false),
('double_cream',     true,  false),
('evaporated_milk',  true,  false),
('ghee',             true,  false),
('goat_milk',        true,  false),
('margarine',        true,  false),
('quail_eggs',       true,  false),
('skim_milk_powder', true,  false),
('egg_yolks',        true,  false),

-- Cheese varieties (canonical = 'cheese' for diet logic; new distinct canonicals only for allergen-important types)
-- Most cheese variants map to the existing 'cheese' canonical; we add a few distinct ones:
('brie',             true,  false),
('camembert',        true,  false),
('edam',             true,  false),
('emmental',         true,  false),
('fontina',          true,  false),
('gorgonzola',       true,  false),
('gouda',            true,  false),
('gruyere',          true,  false),
('halloumi',         true,  false),
('mascarpone',       true,  false),
('monterey_jack',    true,  false),
('provolone',        true,  false),
('buffalo_mozzarella',true, false),

-- Meat & poultry (new cuts / varieties)
('beef_liver',       false, false),
('beef_tongue',      false, false),
('beef_fat',         false, false),
('beef_jerky',       false, false),
('chicken_livers',   false, false),
('chicken_fat',      false, false),
('duck_fat',         false, false),
('ham',              false, false),
('lard',             false, false),
('oxtail',           false, false),
('pancetta',         false, false),
('italian_sausage',  false, false),
('pork_ribs',        false, false),

-- Seafood (new)
('calamari',         false, false),
('cod',              false, false),
('crab',             false, false),
('haddock',          false, false),
('halibut',          false, false),
('lobster',          false, false),
('mackerel',         false, false),
('mussels',          false, false),
('oysters',          false, false),
('prawns',           false, false),
('salmon',           false, false),
('scallops',         false, false),
('sea_bass',         false, false),
('squid',            false, false),
('tilapia',          false, false),
('tuna',             false, false),
('trout',            false, false),
('anchovies',        false, false),
('bonito_flakes',    false, false),

-- Spices & seasonings (new)
('asafoetida',       true,  true),
('berbere',          true,  true),
('biryani_masala',   true,  true),
('black_cardamom',   true,  true),
('cloves',           true,  true),
('coriander_seeds',  true,  true),   -- distinct from 'cilantro' (leaves)
('coriander_ground', true,  true),
('fenugreek',        true,  true),
('garam_masala',     true,  true),
('juniper_berries',  true,  true),
('marjoram',         true,  true),
('mustard_seeds',    true,  true),
('pink_peppercorns', true,  true),
('peppermint',       true,  true),

-- Oils (new)
('almond_oil',       true,  true),
('avocado_oil',      true,  true),
('coconut_oil',      true,  true),
('corn_oil',         true,  true),
('peanut_oil',       true,  true),
('sunflower_oil',    true,  true),
('walnut_oil',       true,  true),

-- Condiments & sauces (new)
('anchovy_paste',    false, false),
('agar_agar',        true,  true),
('demi_glace',       false, false),
('gelatin',          false, false),
('horseradish',      true,  true),
('hot_sauce',        true,  true),
('mango_chutney',    true,  true),
('molasses',         true,  true),
('oyster_sauce',     false, false),
('pesto',            true,  false),
('pumpkin_puree',    true,  true),
('raspberry_jam',    true,  true),
('apricot_jam',      true,  true),
('sriracha',         true,  true),
('sun_dried_tomatoes',true, true),
('tamarind',         true,  true),
('tapioca_pearls',   true,  true),
('tomato_juice',     true,  true),
('tomato_puree',     true,  true),
('walnut_oil',       true,  true),   -- already inserted above, ON CONFLICT handles it
('worcestershire',   false, false),
('alfalfa_sprouts',  true,  true),
('palm_sugar',       true,  true),

-- Sweeteners (new)
('agave_nectar',     true,  true),
('cacao_nibs',       true,  true),
('coconut_sugar',    true,  true),
('coconut_flakes',   true,  true),
('coconut_water',    true,  true),

-- Beverages & alcohol (new)
('apple_juice',      true,  true),
('bourbon',          true,  true),
('brandy',           true,  true),
('carrot_juice',     true,  true),
('coconut_water',    true,  true),   -- already above, ON CONFLICT handles
('grape_juice',      true,  true),
('irish_whiskey',    true,  true),
('orange_juice',     true,  true),
('pineapple_juice',  true,  true),
('port_wine',        true,  true),
('rum',              true,  true),
('soda_water',       true,  true),
('tomato_juice',     true,  true),   -- already above, ON CONFLICT handles
('vodka',            true,  true),

-- Baking (new)
('yeast',            true,  true),
('almond_flour',     true,  true),
('blue_cornmeal',    true,  true),

-- Other
('basil_seeds',      true,  true),
('fried_onions',     true,  true),   -- processed ingredient
('pickled_ginger',   true,  true)
ON CONFLICT (canonical_name) DO NOTHING;


-- ============================================================
-- STEP 2: ALIASES
-- Each DO block handles one group to stay readable.
-- ============================================================

DO $$
DECLARE v UUID;
BEGIN

  -- ── GRAINS & STARCHES ──────────────────────────────────────

  SELECT id INTO v FROM canonical_ingredients WHERE canonical_name = 'amaranth';
  INSERT INTO ingredient_aliases (display_name, canonical_ingredient_id) VALUES
    ('Amaranth', v), ('Amaranth grain', v) ON CONFLICT (display_name) DO NOTHING;

  SELECT id INTO v FROM canonical_ingredients WHERE canonical_name = 'barley';
  INSERT INTO ingredient_aliases (display_name, canonical_ingredient_id) VALUES
    ('Barley', v), ('Pearl barley', v), ('Hulled barley', v) ON CONFLICT (display_name) DO NOTHING;

  SELECT id INTO v FROM canonical_ingredients WHERE canonical_name = 'buckwheat';
  INSERT INTO ingredient_aliases (display_name, canonical_ingredient_id) VALUES
    ('Buckwheat', v), ('Buckwheat groats', v), ('Buckwheat flour', v) ON CONFLICT (display_name) DO NOTHING;

  SELECT id INTO v FROM canonical_ingredients WHERE canonical_name = 'bulgur';
  INSERT INTO ingredient_aliases (display_name, canonical_ingredient_id) VALUES
    ('Bulgur wheat', v), ('Bulgur', v), ('Bulghur', v) ON CONFLICT (display_name) DO NOTHING;

  SELECT id INTO v FROM canonical_ingredients WHERE canonical_name = 'farro';
  INSERT INTO ingredient_aliases (display_name, canonical_ingredient_id) VALUES
    ('Farro', v), ('Emmer wheat', v) ON CONFLICT (display_name) DO NOTHING;

  SELECT id INTO v FROM canonical_ingredients WHERE canonical_name = 'millet';
  INSERT INTO ingredient_aliases (display_name, canonical_ingredient_id) VALUES
    ('Millet', v), ('Millet flour', v) ON CONFLICT (display_name) DO NOTHING;

  SELECT id INTO v FROM canonical_ingredients WHERE canonical_name = 'sorghum';
  INSERT INTO ingredient_aliases (display_name, canonical_ingredient_id) VALUES
    ('Sorghum', v), ('Sorghum flour', v) ON CONFLICT (display_name) DO NOTHING;

  SELECT id INTO v FROM canonical_ingredients WHERE canonical_name = 'black_rice';
  INSERT INTO ingredient_aliases (display_name, canonical_ingredient_id) VALUES
    ('Black rice', v), ('Forbidden rice', v), ('Purple rice', v) ON CONFLICT (display_name) DO NOTHING;

  SELECT id INTO v FROM canonical_ingredients WHERE canonical_name = 'arborio_rice';
  INSERT INTO ingredient_aliases (display_name, canonical_ingredient_id) VALUES
    ('Arborio rice', v), ('Risotto rice', v) ON CONFLICT (display_name) DO NOTHING;

  SELECT id INTO v FROM canonical_ingredients WHERE canonical_name = 'semolina';
  INSERT INTO ingredient_aliases (display_name, canonical_ingredient_id) VALUES
    ('Semolina', v), ('Semolina flour', v), ('Durum semolina', v) ON CONFLICT (display_name) DO NOTHING;

  SELECT id INTO v FROM canonical_ingredients WHERE canonical_name = 'wheat_berries';
  INSERT INTO ingredient_aliases (display_name, canonical_ingredient_id) VALUES
    ('Wheat berries', v), ('Whole wheat berries', v) ON CONFLICT (display_name) DO NOTHING;

  SELECT id INTO v FROM canonical_ingredients WHERE canonical_name = 'fregola';
  INSERT INTO ingredient_aliases (display_name, canonical_ingredient_id) VALUES
    ('Fregola', v), ('Fregola sarda', v) ON CONFLICT (display_name) DO NOTHING;

  SELECT id INTO v FROM canonical_ingredients WHERE canonical_name = 'gnocchi';
  INSERT INTO ingredient_aliases (display_name, canonical_ingredient_id) VALUES
    ('Gnocchi', v), ('Potato gnocchi', v), ('Ricotta gnocchi', v) ON CONFLICT (display_name) DO NOTHING;

  SELECT id INTO v FROM canonical_ingredients WHERE canonical_name = 'lasagna_sheets';
  INSERT INTO ingredient_aliases (display_name, canonical_ingredient_id) VALUES
    ('Lasagna sheets', v), ('Lasagne sheets', v), ('Lasagna noodles', v) ON CONFLICT (display_name) DO NOTHING;

  SELECT id INTO v FROM canonical_ingredients WHERE canonical_name = 'soba_noodles';
  INSERT INTO ingredient_aliases (display_name, canonical_ingredient_id) VALUES
    ('Soba noodles', v), ('Soba', v) ON CONFLICT (display_name) DO NOTHING;

  SELECT id INTO v FROM canonical_ingredients WHERE canonical_name = 'ramen_noodles';
  INSERT INTO ingredient_aliases (display_name, canonical_ingredient_id) VALUES
    ('Ramen noodles', v), ('Ramen', v), ('Fresh ramen', v) ON CONFLICT (display_name) DO NOTHING;

  SELECT id INTO v FROM canonical_ingredients WHERE canonical_name = 'rice_noodles';
  INSERT INTO ingredient_aliases (display_name, canonical_ingredient_id) VALUES
    ('Rice noodles', v), ('Pad Thai noodles', v), ('Rice vermicelli', v) ON CONFLICT (display_name) DO NOTHING;

  SELECT id INTO v FROM canonical_ingredients WHERE canonical_name = 'egg_noodles';
  INSERT INTO ingredient_aliases (display_name, canonical_ingredient_id) VALUES
    ('Egg noodles', v), ('Chinese egg noodles', v) ON CONFLICT (display_name) DO NOTHING;

  SELECT id INTO v FROM canonical_ingredients WHERE canonical_name = 'vermicelli';
  INSERT INTO ingredient_aliases (display_name, canonical_ingredient_id) VALUES
    ('Vermicelli noodles', v), ('Vermicelli', v), ('Glass noodles', v),
    ('Cellophane noodles', v) ON CONFLICT (display_name) DO NOTHING;

  SELECT id INTO v FROM canonical_ingredients WHERE canonical_name = 'tortilla_chips';
  INSERT INTO ingredient_aliases (display_name, canonical_ingredient_id) VALUES
    ('Tortilla chips', v), ('Corn chips', v), ('Nacho chips', v) ON CONFLICT (display_name) DO NOTHING;

  SELECT id INTO v FROM canonical_ingredients WHERE canonical_name = 'pita_bread';
  INSERT INTO ingredient_aliases (display_name, canonical_ingredient_id) VALUES
    ('Pita bread', v), ('Pita', v), ('Pitta bread', v) ON CONFLICT (display_name) DO NOTHING;

  SELECT id INTO v FROM canonical_ingredients WHERE canonical_name = 'pizza_dough';
  INSERT INTO ingredient_aliases (display_name, canonical_ingredient_id) VALUES
    ('Pizza dough', v), ('Pizza base', v) ON CONFLICT (display_name) DO NOTHING;

  SELECT id INTO v FROM canonical_ingredients WHERE canonical_name = 'graham_crackers';
  INSERT INTO ingredient_aliases (display_name, canonical_ingredient_id) VALUES
    ('Graham crackers', v), ('Digestive biscuits', v) ON CONFLICT (display_name) DO NOTHING;

  SELECT id INTO v FROM canonical_ingredients WHERE canonical_name = 'shortcrust_pastry';
  INSERT INTO ingredient_aliases (display_name, canonical_ingredient_id) VALUES
    ('Shortcrust pastry', v), ('Pie crust', v), ('Pastry dough', v) ON CONFLICT (display_name) DO NOTHING;

  -- Existing rice/pasta canonicals — extra aliases from the new list
  SELECT id INTO v FROM canonical_ingredients WHERE canonical_name = 'rice';
  INSERT INTO ingredient_aliases (display_name, canonical_ingredient_id) VALUES
    ('Rice basmati', v), ('Rice brown', v), ('Rice jasmine', v),
    ('Basmati rice', v), ('Brown rice', v), ('Jasmine rice', v) ON CONFLICT (display_name) DO NOTHING;

  SELECT id INTO v FROM canonical_ingredients WHERE canonical_name = 'pasta';
  INSERT INTO ingredient_aliases (display_name, canonical_ingredient_id) VALUES
    ('Pasta penne', v), ('Pasta spaghetti', v), ('Penne', v), ('Spaghetti', v),
    ('Fusilli pasta', v), ('Fusilli', v), ('Farfalle pasta', v), ('Farfalle', v),
    ('Farfale', v), ('Rigatoni pasta', v), ('Rigatoni', v),
    ('Linguine pasta', v), ('Linguine', v), ('Macaroni pasta', v),
    ('Macaroni', v) ON CONFLICT (display_name) DO NOTHING;

  SELECT id INTO v FROM canonical_ingredients WHERE canonical_name = 'oats';
  INSERT INTO ingredient_aliases (display_name, canonical_ingredient_id) VALUES
    ('Oatmeal', v), ('Rolled oats', v), ('Oats steel cut', v), ('Steel cut oats', v),
    ('Quick oats', v) ON CONFLICT (display_name) DO NOTHING;

  SELECT id INTO v FROM canonical_ingredients WHERE canonical_name = 'flour';
  INSERT INTO ingredient_aliases (display_name, canonical_ingredient_id) VALUES
    ('All-purpose flour', v), ('Flour', v), ('Wheat flour', v),
    ('Bread flour', v), ('Whole wheat flour', v), ('Wheat flour whole', v),
    ('Plain flour', v) ON CONFLICT (display_name) DO NOTHING;

  SELECT id INTO v FROM canonical_ingredients WHERE canonical_name = 'almond_flour';
  INSERT INTO ingredient_aliases (display_name, canonical_ingredient_id) VALUES
    ('Almond flour', v), ('Ground almonds', v) ON CONFLICT (display_name) DO NOTHING;

  SELECT id INTO v FROM canonical_ingredients WHERE canonical_name = 'blue_cornmeal';
  INSERT INTO ingredient_aliases (display_name, canonical_ingredient_id) VALUES
    ('Blue cornmeal', v) ON CONFLICT (display_name) DO NOTHING;

  SELECT id INTO v FROM canonical_ingredients WHERE canonical_name = 'cornmeal';
  INSERT INTO ingredient_aliases (display_name, canonical_ingredient_id) VALUES
    ('Cornmeal', v), ('Yellow cornmeal', v), ('Corn flour', v), ('Corn starch', v),
    ('Grits', v) ON CONFLICT (display_name) DO NOTHING;

  -- Bread extras
  SELECT id INTO v FROM canonical_ingredients WHERE canonical_name = 'bread';
  INSERT INTO ingredient_aliases (display_name, canonical_ingredient_id) VALUES
    ('French baguette', v), ('Bagel', v), ('Rye bread', v), ('Pita bread', v) ON CONFLICT (display_name) DO NOTHING;

  -- ── LEGUMES ────────────────────────────────────────────────

  SELECT id INTO v FROM canonical_ingredients WHERE canonical_name = 'adzuki_beans';
  INSERT INTO ingredient_aliases (display_name, canonical_ingredient_id) VALUES
    ('Adzuki beans', v), ('Azuki beans', v), ('Red beans (small)', v) ON CONFLICT (display_name) DO NOTHING;

  SELECT id INTO v FROM canonical_ingredients WHERE canonical_name = 'mung_beans';
  INSERT INTO ingredient_aliases (display_name, canonical_ingredient_id) VALUES
    ('Mung beans', v), ('Moong beans', v), ('Green gram', v) ON CONFLICT (display_name) DO NOTHING;

  SELECT id INTO v FROM canonical_ingredients WHERE canonical_name = 'navy_beans';
  INSERT INTO ingredient_aliases (display_name, canonical_ingredient_id) VALUES
    ('Navy beans', v), ('Haricot beans', v), ('Boston beans', v) ON CONFLICT (display_name) DO NOTHING;

  SELECT id INTO v FROM canonical_ingredients WHERE canonical_name = 'split_peas';
  INSERT INTO ingredient_aliases (display_name, canonical_ingredient_id) VALUES
    ('Split peas', v), ('Yellow split peas', v), ('Green split peas', v) ON CONFLICT (display_name) DO NOTHING;

  SELECT id INTO v FROM canonical_ingredients WHERE canonical_name = 'green_peas';
  INSERT INTO ingredient_aliases (display_name, canonical_ingredient_id) VALUES
    ('Green peas', v), ('Garden peas', v), ('Fresh peas', v) ON CONFLICT (display_name) DO NOTHING;

  SELECT id INTO v FROM canonical_ingredients WHERE canonical_name = 'snap_peas';
  INSERT INTO ingredient_aliases (display_name, canonical_ingredient_id) VALUES
    ('Snap peas', v), ('Sugar snap peas', v) ON CONFLICT (display_name) DO NOTHING;

  SELECT id INTO v FROM canonical_ingredients WHERE canonical_name = 'snow_peas';
  INSERT INTO ingredient_aliases (display_name, canonical_ingredient_id) VALUES
    ('Snow peas', v), ('Mangetout', v) ON CONFLICT (display_name) DO NOTHING;

  SELECT id INTO v FROM canonical_ingredients WHERE canonical_name = 'frozen_peas';
  INSERT INTO ingredient_aliases (display_name, canonical_ingredient_id) VALUES
    ('Frozen peas', v) ON CONFLICT (display_name) DO NOTHING;

  -- Existing canonical 'beans' extra aliases
  SELECT id INTO v FROM canonical_ingredients WHERE canonical_name = 'beans';
  INSERT INTO ingredient_aliases (display_name, canonical_ingredient_id) VALUES
    ('Cannellini beans', v), ('White beans', v), ('Red beans', v),
    ('Kidney beans', v), ('Pinto beans', v) ON CONFLICT (display_name) DO NOTHING;

  SELECT id INTO v FROM canonical_ingredients WHERE canonical_name = 'lentils';
  INSERT INTO ingredient_aliases (display_name, canonical_ingredient_id) VALUES
    ('Lentils red', v), ('Red lentils', v), ('Green lentils', v), ('Black lentils', v),
    ('Brown lentils', v), ('Masoor dal', v), ('French lentils', v) ON CONFLICT (display_name) DO NOTHING;

  SELECT id INTO v FROM canonical_ingredients WHERE canonical_name = 'chickpeas';
  INSERT INTO ingredient_aliases (display_name, canonical_ingredient_id) VALUES
    ('Chickpeas', v), ('Garbanzo beans', v), ('Chana', v), ('Canned chickpeas', v) ON CONFLICT (display_name) DO NOTHING;

  SELECT id INTO v FROM canonical_ingredients WHERE canonical_name = 'edamame';
  INSERT INTO ingredient_aliases (display_name, canonical_ingredient_id) VALUES
    ('Edamame', v), ('Shelled edamame', v) ON CONFLICT (display_name) DO NOTHING;

  -- ── VEGETABLES ─────────────────────────────────────────────

  SELECT id INTO v FROM canonical_ingredients WHERE canonical_name = 'brussels_sprouts';
  INSERT INTO ingredient_aliases (display_name, canonical_ingredient_id) VALUES
    ('Brussels sprouts', v), ('Brussels sprout', v) ON CONFLICT (display_name) DO NOTHING;

  SELECT id INTO v FROM canonical_ingredients WHERE canonical_name = 'beets';
  INSERT INTO ingredient_aliases (display_name, canonical_ingredient_id) VALUES
    ('Beets', v), ('Beetroot', v), ('Red beets', v), ('Golden beets', v),
    ('Roasted beets', v) ON CONFLICT (display_name) DO NOTHING;

  SELECT id INTO v FROM canonical_ingredients WHERE canonical_name = 'chicory';
  INSERT INTO ingredient_aliases (display_name, canonical_ingredient_id) VALUES
    ('Chicory', v), ('Belgian endive', v) ON CONFLICT (display_name) DO NOTHING;

  SELECT id INTO v FROM canonical_ingredients WHERE canonical_name = 'eggplant';
  INSERT INTO ingredient_aliases (display_name, canonical_ingredient_id) VALUES
    ('Eggplant', v), ('Aubergine', v), ('Japanese eggplant', v),
    ('Italian eggplant', v) ON CONFLICT (display_name) DO NOTHING;

  SELECT id INTO v FROM canonical_ingredients WHERE canonical_name = 'endive';
  INSERT INTO ingredient_aliases (display_name, canonical_ingredient_id) VALUES
    ('Endive', v), ('Curly endive', v) ON CONFLICT (display_name) DO NOTHING;

  SELECT id INTO v FROM canonical_ingredients WHERE canonical_name = 'green_chili';
  INSERT INTO ingredient_aliases (display_name, canonical_ingredient_id) VALUES
    ('Green chili', v), ('Green chilli', v), ('Serrano pepper', v),
    ('Anaheim pepper', v) ON CONFLICT (display_name) DO NOTHING;

  SELECT id INTO v FROM canonical_ingredients WHERE canonical_name = 'jalapeno';
  INSERT INTO ingredient_aliases (display_name, canonical_ingredient_id) VALUES
    ('Jalapeno', v), ('Jalapeño', v), ('Pickled jalapeno', v),
    ('Sliced jalapeno', v) ON CONFLICT (display_name) DO NOTHING;

  SELECT id INTO v FROM canonical_ingredients WHERE canonical_name = 'jicama';
  INSERT INTO ingredient_aliases (display_name, canonical_ingredient_id) VALUES
    ('Jicama', v), ('Mexican yam bean', v) ON CONFLICT (display_name) DO NOTHING;

  SELECT id INTO v FROM canonical_ingredients WHERE canonical_name = 'leek';
  INSERT INTO ingredient_aliases (display_name, canonical_ingredient_id) VALUES
    ('Leek', v), ('Leeks', v), ('Baby leeks', v) ON CONFLICT (display_name) DO NOTHING;

  SELECT id INTO v FROM canonical_ingredients WHERE canonical_name = 'parsnip';
  INSERT INTO ingredient_aliases (display_name, canonical_ingredient_id) VALUES
    ('Parsnip', v), ('Parsnips', v) ON CONFLICT (display_name) DO NOTHING;

  SELECT id INTO v FROM canonical_ingredients WHERE canonical_name = 'radicchio';
  INSERT INTO ingredient_aliases (display_name, canonical_ingredient_id) VALUES
    ('Radicchio', v), ('Radicchio lettuce', v) ON CONFLICT (display_name) DO NOTHING;

  SELECT id INTO v FROM canonical_ingredients WHERE canonical_name = 'spaghetti_squash';
  INSERT INTO ingredient_aliases (display_name, canonical_ingredient_id) VALUES
    ('Spaghetti squash', v) ON CONFLICT (display_name) DO NOTHING;

  SELECT id INTO v FROM canonical_ingredients WHERE canonical_name = 'spring_onion';
  INSERT INTO ingredient_aliases (display_name, canonical_ingredient_id) VALUES
    ('Spring onions', v), ('Spring onion', v), ('Scallions', v), ('Scallion', v),
    ('Green onion', v), ('Green onions', v) ON CONFLICT (display_name) DO NOTHING;

  SELECT id INTO v FROM canonical_ingredients WHERE canonical_name = 'swiss_chard';
  INSERT INTO ingredient_aliases (display_name, canonical_ingredient_id) VALUES
    ('Swiss chard', v), ('Rainbow chard', v), ('Chard', v) ON CONFLICT (display_name) DO NOTHING;

  SELECT id INTO v FROM canonical_ingredients WHERE canonical_name = 'water_chestnuts';
  INSERT INTO ingredient_aliases (display_name, canonical_ingredient_id) VALUES
    ('Water chestnuts', v), ('Canned water chestnuts', v) ON CONFLICT (display_name) DO NOTHING;

  SELECT id INTO v FROM canonical_ingredients WHERE canonical_name = 'watercress';
  INSERT INTO ingredient_aliases (display_name, canonical_ingredient_id) VALUES
    ('Watercress', v) ON CONFLICT (display_name) DO NOTHING;

  SELECT id INTO v FROM canonical_ingredients WHERE canonical_name = 'bean_sprouts';
  INSERT INTO ingredient_aliases (display_name, canonical_ingredient_id) VALUES
    ('Bean sprouts', v), ('Mung bean sprouts', v), ('Soybean sprouts', v) ON CONFLICT (display_name) DO NOTHING;

  SELECT id INTO v FROM canonical_ingredients WHERE canonical_name = 'broccoli_rabe';
  INSERT INTO ingredient_aliases (display_name, canonical_ingredient_id) VALUES
    ('Broccoli rabe', v), ('Rapini', v), ('Broccoli raab', v) ON CONFLICT (display_name) DO NOTHING;

  SELECT id INTO v FROM canonical_ingredients WHERE canonical_name = 'cactus_pads';
  INSERT INTO ingredient_aliases (display_name, canonical_ingredient_id) VALUES
    ('Cactus pads', v), ('Nopales', v) ON CONFLICT (display_name) DO NOTHING;

  SELECT id INTO v FROM canonical_ingredients WHERE canonical_name = 'garlic_scapes';
  INSERT INTO ingredient_aliases (display_name, canonical_ingredient_id) VALUES
    ('Garlic scapes', v) ON CONFLICT (display_name) DO NOTHING;

  SELECT id INTO v FROM canonical_ingredients WHERE canonical_name = 'turnip_greens';
  INSERT INTO ingredient_aliases (display_name, canonical_ingredient_id) VALUES
    ('Turnip greens', v) ON CONFLICT (display_name) DO NOTHING;

  SELECT id INTO v FROM canonical_ingredients WHERE canonical_name = 'banana_blossom';
  INSERT INTO ingredient_aliases (display_name, canonical_ingredient_id) VALUES
    ('Banana blossom', v), ('Banana flower', v) ON CONFLICT (display_name) DO NOTHING;

  SELECT id INTO v FROM canonical_ingredients WHERE canonical_name = 'banana_leaves';
  INSERT INTO ingredient_aliases (display_name, canonical_ingredient_id) VALUES
    ('Banana leaves', v) ON CONFLICT (display_name) DO NOTHING;

  -- Existing vegetable canonicals — extra aliases from the new list
  SELECT id INTO v FROM canonical_ingredients WHERE canonical_name = 'tomato';
  INSERT INTO ingredient_aliases (display_name, canonical_ingredient_id) VALUES
    ('Cherry tomatoes', v), ('Plum tomatoes', v), ('Tomatoes heirloom', v),
    ('Heirloom tomatoes', v), ('Green tomatoes', v), ('Sun dried tomatoes', v),
    ('Crushed tomatoes', v) ON CONFLICT (display_name) DO NOTHING;

  SELECT id INTO v FROM canonical_ingredients WHERE canonical_name = 'onion';
  INSERT INTO ingredient_aliases (display_name, canonical_ingredient_id) VALUES
    ('Onion red', v), ('Onion white', v), ('Onion yellow', v),
    ('Red onion', v), ('White onion', v), ('Yellow onion', v),
    ('Fried onions', v) ON CONFLICT (display_name) DO NOTHING;

  SELECT id INTO v FROM canonical_ingredients WHERE canonical_name = 'potato';
  INSERT INTO ingredient_aliases (display_name, canonical_ingredient_id) VALUES
    ('Potato russet', v), ('Potato red', v), ('Potato yukon gold', v),
    ('Russet potato', v), ('Red potato', v), ('Yukon gold potatoes', v) ON CONFLICT (display_name) DO NOTHING;

  SELECT id INTO v FROM canonical_ingredients WHERE canonical_name = 'sweet_potato';
  INSERT INTO ingredient_aliases (display_name, canonical_ingredient_id) VALUES
    ('Potato sweet', v), ('Sweet potato', v), ('Sweet potatoes', v),
    ('Yam', v), ('Japanese sweet potato', v) ON CONFLICT (display_name) DO NOTHING;

  SELECT id INTO v FROM canonical_ingredients WHERE canonical_name = 'pepper';
  INSERT INTO ingredient_aliases (display_name, canonical_ingredient_id) VALUES
    ('Bell pepper green', v), ('Bell pepper red', v), ('Bell pepper yellow', v),
    ('Bell pepper orange', v), ('Peppers mixed', v) ON CONFLICT (display_name) DO NOTHING;

  SELECT id INTO v FROM canonical_ingredients WHERE canonical_name = 'mushroom';
  INSERT INTO ingredient_aliases (display_name, canonical_ingredient_id) VALUES
    ('Mushroom button', v), ('Mushroom oyster', v), ('Mushroom portobello', v),
    ('Mushroom shiitake', v), ('Chanterelle mushrooms', v), ('Cremini mushrooms', v),
    ('Enoki mushrooms', v) ON CONFLICT (display_name) DO NOTHING;

  SELECT id INTO v FROM canonical_ingredients WHERE canonical_name = 'spinach';
  INSERT INTO ingredient_aliases (display_name, canonical_ingredient_id) VALUES
    ('Spinach fresh', v), ('Spinach frozen', v), ('Frozen spinach', v) ON CONFLICT (display_name) DO NOTHING;

  SELECT id INTO v FROM canonical_ingredients WHERE canonical_name = 'lettuce';
  INSERT INTO ingredient_aliases (display_name, canonical_ingredient_id) VALUES
    ('Iceberg lettuce', v), ('Lettuce butter', v), ('Lettuce romaine', v),
    ('Butter lettuce', v), ('Romaine lettuce', v) ON CONFLICT (display_name) DO NOTHING;

  SELECT id INTO v FROM canonical_ingredients WHERE canonical_name = 'cabbage';
  INSERT INTO ingredient_aliases (display_name, canonical_ingredient_id) VALUES
    ('Cabbage green', v), ('Cabbage red', v), ('Cabbage savoy', v),
    ('Napa cabbage', v) ON CONFLICT (display_name) DO NOTHING;

  SELECT id INTO v FROM canonical_ingredients WHERE canonical_name = 'pumpkin';
  INSERT INTO ingredient_aliases (display_name, canonical_ingredient_id) VALUES
    ('Acorn squash', v), ('Butternut squash', v) ON CONFLICT (display_name) DO NOTHING;

  -- ── FRUITS ─────────────────────────────────────────────────

  SELECT id INTO v FROM canonical_ingredients WHERE canonical_name = 'blackberries';
  INSERT INTO ingredient_aliases (display_name, canonical_ingredient_id) VALUES
    ('Blackberries', v), ('Fresh blackberries', v) ON CONFLICT (display_name) DO NOTHING;

  SELECT id INTO v FROM canonical_ingredients WHERE canonical_name = 'blueberries';
  INSERT INTO ingredient_aliases (display_name, canonical_ingredient_id) VALUES
    ('Blueberries', v), ('Fresh blueberries', v), ('Frozen blueberries', v) ON CONFLICT (display_name) DO NOTHING;

  SELECT id INTO v FROM canonical_ingredients WHERE canonical_name = 'cranberries';
  INSERT INTO ingredient_aliases (display_name, canonical_ingredient_id) VALUES
    ('Cranberries', v), ('Dried cranberries', v), ('Fresh cranberries', v) ON CONFLICT (display_name) DO NOTHING;

  SELECT id INTO v FROM canonical_ingredients WHERE canonical_name = 'figs';
  INSERT INTO ingredient_aliases (display_name, canonical_ingredient_id) VALUES
    ('Figs fresh', v), ('Figs dried', v), ('Figs', v), ('Fresh figs', v),
    ('Dried figs', v) ON CONFLICT (display_name) DO NOTHING;

  SELECT id INTO v FROM canonical_ingredients WHERE canonical_name = 'grapefruit';
  INSERT INTO ingredient_aliases (display_name, canonical_ingredient_id) VALUES
    ('Grapefruit', v), ('Pink grapefruit', v), ('Ruby grapefruit', v) ON CONFLICT (display_name) DO NOTHING;

  SELECT id INTO v FROM canonical_ingredients WHERE canonical_name = 'grapes';
  INSERT INTO ingredient_aliases (display_name, canonical_ingredient_id) VALUES
    ('Grapes green', v), ('Grapes red', v), ('Red grapes', v), ('Green grapes', v),
    ('Seedless grapes', v) ON CONFLICT (display_name) DO NOTHING;

  SELECT id INTO v FROM canonical_ingredients WHERE canonical_name = 'guava';
  INSERT INTO ingredient_aliases (display_name, canonical_ingredient_id) VALUES
    ('Guava', v), ('Guava paste', v) ON CONFLICT (display_name) DO NOTHING;

  SELECT id INTO v FROM canonical_ingredients WHERE canonical_name = 'mango_puree';
  INSERT INTO ingredient_aliases (display_name, canonical_ingredient_id) VALUES
    ('Mango puree', v), ('Mango pulp', v) ON CONFLICT (display_name) DO NOTHING;

  SELECT id INTO v FROM canonical_ingredients WHERE canonical_name = 'nectarines';
  INSERT INTO ingredient_aliases (display_name, canonical_ingredient_id) VALUES
    ('Nectarines', v), ('Nectarine', v) ON CONFLICT (display_name) DO NOTHING;

  SELECT id INTO v FROM canonical_ingredients WHERE canonical_name = 'passion_fruit';
  INSERT INTO ingredient_aliases (display_name, canonical_ingredient_id) VALUES
    ('Passion fruit', v), ('Passionfruit', v) ON CONFLICT (display_name) DO NOTHING;

  SELECT id INTO v FROM canonical_ingredients WHERE canonical_name = 'peach';
  INSERT INTO ingredient_aliases (display_name, canonical_ingredient_id) VALUES
    ('Peach', v), ('Peaches', v), ('Canned peaches', v) ON CONFLICT (display_name) DO NOTHING;

  SELECT id INTO v FROM canonical_ingredients WHERE canonical_name = 'pomegranate';
  INSERT INTO ingredient_aliases (display_name, canonical_ingredient_id) VALUES
    ('Pomegranate seeds', v), ('Pomegranate', v), ('Pomegranate arils', v) ON CONFLICT (display_name) DO NOTHING;

  SELECT id INTO v FROM canonical_ingredients WHERE canonical_name = 'prunes';
  INSERT INTO ingredient_aliases (display_name, canonical_ingredient_id) VALUES
    ('Prunes', v), ('Dried plums', v) ON CONFLICT (display_name) DO NOTHING;

  SELECT id INTO v FROM canonical_ingredients WHERE canonical_name = 'raspberries';
  INSERT INTO ingredient_aliases (display_name, canonical_ingredient_id) VALUES
    ('Raspberries', v), ('Fresh raspberries', v) ON CONFLICT (display_name) DO NOTHING;

  SELECT id INTO v FROM canonical_ingredients WHERE canonical_name = 'elderflower';
  INSERT INTO ingredient_aliases (display_name, canonical_ingredient_id) VALUES
    ('Elderflower syrup', v), ('Elderflower cordial', v) ON CONFLICT (display_name) DO NOTHING;

  -- Existing fruit canonicals — extra aliases
  SELECT id INTO v FROM canonical_ingredients WHERE canonical_name = 'strawberry';
  INSERT INTO ingredient_aliases (display_name, canonical_ingredient_id) VALUES
    ('Strawberries fresh', v), ('Strawberries', v), ('Fresh strawberries', v) ON CONFLICT (display_name) DO NOTHING;

  SELECT id INTO v FROM canonical_ingredients WHERE canonical_name = 'mango';
  INSERT INTO ingredient_aliases (display_name, canonical_ingredient_id) VALUES
    ('Mango chutney', v) ON CONFLICT (display_name) DO NOTHING;

  SELECT id INTO v FROM canonical_ingredients WHERE canonical_name = 'orange';
  INSERT INTO ingredient_aliases (display_name, canonical_ingredient_id) VALUES
    ('Orange juice', v), ('Orange zest', v), ('Mandarin oranges', v),
    ('Navel orange', v) ON CONFLICT (display_name) DO NOTHING;

  SELECT id INTO v FROM canonical_ingredients WHERE canonical_name = 'apple';
  INSERT INTO ingredient_aliases (display_name, canonical_ingredient_id) VALUES
    ('Apples', v), ('Granny smith apple', v), ('Honeycrisp apple', v) ON CONFLICT (display_name) DO NOTHING;

  SELECT id INTO v FROM canonical_ingredients WHERE canonical_name = 'apricot';
  INSERT INTO ingredient_aliases (display_name, canonical_ingredient_id) VALUES
    ('Apricots', v), ('Dried apricots', v), ('Fresh apricots', v) ON CONFLICT (display_name) DO NOTHING;

  -- ── NUTS & SEEDS ───────────────────────────────────────────

  SELECT id INTO v FROM canonical_ingredients WHERE canonical_name = 'flax_seeds';
  INSERT INTO ingredient_aliases (display_name, canonical_ingredient_id) VALUES
    ('Flax seeds', v), ('Flaxseeds', v), ('Linseed', v), ('Ground flaxseed', v) ON CONFLICT (display_name) DO NOTHING;

  SELECT id INTO v FROM canonical_ingredients WHERE canonical_name = 'macadamia_nuts';
  INSERT INTO ingredient_aliases (display_name, canonical_ingredient_id) VALUES
    ('Macadamia nuts', v), ('Macadamia', v), ('Roasted macadamia', v) ON CONFLICT (display_name) DO NOTHING;

  SELECT id INTO v FROM canonical_ingredients WHERE canonical_name = 'nigella_seeds';
  INSERT INTO ingredient_aliases (display_name, canonical_ingredient_id) VALUES
    ('Nigella seeds', v), ('Black seed', v), ('Kalonji', v) ON CONFLICT (display_name) DO NOTHING;

  SELECT id INTO v FROM canonical_ingredients WHERE canonical_name = 'pine_nuts';
  INSERT INTO ingredient_aliases (display_name, canonical_ingredient_id) VALUES
    ('Pine nuts', v), ('Pignoli', v), ('Toasted pine nuts', v) ON CONFLICT (display_name) DO NOTHING;

  SELECT id INTO v FROM canonical_ingredients WHERE canonical_name = 'pumpkin_seeds';
  INSERT INTO ingredient_aliases (display_name, canonical_ingredient_id) VALUES
    ('Pumpkin seeds', v), ('Pepitas', v), ('Roasted pumpkin seeds', v) ON CONFLICT (display_name) DO NOTHING;

  SELECT id INTO v FROM canonical_ingredients WHERE canonical_name = 'sunflower_seeds';
  INSERT INTO ingredient_aliases (display_name, canonical_ingredient_id) VALUES
    ('Sunflower seeds', v), ('Roasted sunflower seeds', v) ON CONFLICT (display_name) DO NOTHING;

  SELECT id INTO v FROM canonical_ingredients WHERE canonical_name = 'chestnuts';
  INSERT INTO ingredient_aliases (display_name, canonical_ingredient_id) VALUES
    ('Chestnuts', v), ('Roasted chestnuts', v), ('Chestnut puree', v) ON CONFLICT (display_name) DO NOTHING;

  SELECT id INTO v FROM canonical_ingredients WHERE canonical_name = 'almond_paste';
  INSERT INTO ingredient_aliases (display_name, canonical_ingredient_id) VALUES
    ('Almond paste', v), ('Marzipan', v) ON CONFLICT (display_name) DO NOTHING;

  SELECT id INTO v FROM canonical_ingredients WHERE canonical_name = 'almond_butter';
  INSERT INTO ingredient_aliases (display_name, canonical_ingredient_id) VALUES
    ('Almond butter', v) ON CONFLICT (display_name) DO NOTHING;

  SELECT id INTO v FROM canonical_ingredients WHERE canonical_name = 'basil_seeds';
  INSERT INTO ingredient_aliases (display_name, canonical_ingredient_id) VALUES
    ('Basil seeds', v), ('Sabja seeds', v), ('Tukmaria', v) ON CONFLICT (display_name) DO NOTHING;

  -- ── DAIRY & EGGS ───────────────────────────────────────────

  SELECT id INTO v FROM canonical_ingredients WHERE canonical_name = 'buttermilk';
  INSERT INTO ingredient_aliases (display_name, canonical_ingredient_id) VALUES
    ('Buttermilk', v), ('Low-fat buttermilk', v) ON CONFLICT (display_name) DO NOTHING;

  SELECT id INTO v FROM canonical_ingredients WHERE canonical_name = 'clotted_cream';
  INSERT INTO ingredient_aliases (display_name, canonical_ingredient_id) VALUES
    ('Clotted cream', v), ('Devonshire cream', v) ON CONFLICT (display_name) DO NOTHING;

  SELECT id INTO v FROM canonical_ingredients WHERE canonical_name = 'condensed_milk';
  INSERT INTO ingredient_aliases (display_name, canonical_ingredient_id) VALUES
    ('Condensed milk', v), ('Sweetened condensed milk', v) ON CONFLICT (display_name) DO NOTHING;

  SELECT id INTO v FROM canonical_ingredients WHERE canonical_name = 'cottage_cheese';
  INSERT INTO ingredient_aliases (display_name, canonical_ingredient_id) VALUES
    ('Cottage cheese', v), ('Low-fat cottage cheese', v) ON CONFLICT (display_name) DO NOTHING;

  SELECT id INTO v FROM canonical_ingredients WHERE canonical_name = 'custard_powder';
  INSERT INTO ingredient_aliases (display_name, canonical_ingredient_id) VALUES
    ('Custard powder', v) ON CONFLICT (display_name) DO NOTHING;

  SELECT id INTO v FROM canonical_ingredients WHERE canonical_name = 'double_cream';
  INSERT INTO ingredient_aliases (display_name, canonical_ingredient_id) VALUES
    ('Double cream', v), ('Heavy whipping cream', v), ('Cream heavy', v),
    ('Cream light', v) ON CONFLICT (display_name) DO NOTHING;

  SELECT id INTO v FROM canonical_ingredients WHERE canonical_name = 'evaporated_milk';
  INSERT INTO ingredient_aliases (display_name, canonical_ingredient_id) VALUES
    ('Evaporated milk', v) ON CONFLICT (display_name) DO NOTHING;

  SELECT id INTO v FROM canonical_ingredients WHERE canonical_name = 'ghee';
  INSERT INTO ingredient_aliases (display_name, canonical_ingredient_id) VALUES
    ('Ghee', v), ('Clarified butter', v), ('Indian ghee', v) ON CONFLICT (display_name) DO NOTHING;

  SELECT id INTO v FROM canonical_ingredients WHERE canonical_name = 'goat_milk';
  INSERT INTO ingredient_aliases (display_name, canonical_ingredient_id) VALUES
    ('Goat milk', v) ON CONFLICT (display_name) DO NOTHING;

  SELECT id INTO v FROM canonical_ingredients WHERE canonical_name = 'margarine';
  INSERT INTO ingredient_aliases (display_name, canonical_ingredient_id) VALUES
    ('Margarine', v), ('Vegan butter', v), ('Plant-based butter', v) ON CONFLICT (display_name) DO NOTHING;

  SELECT id INTO v FROM canonical_ingredients WHERE canonical_name = 'quail_eggs';
  INSERT INTO ingredient_aliases (display_name, canonical_ingredient_id) VALUES
    ('Quail eggs', v) ON CONFLICT (display_name) DO NOTHING;

  SELECT id INTO v FROM canonical_ingredients WHERE canonical_name = 'skim_milk_powder';
  INSERT INTO ingredient_aliases (display_name, canonical_ingredient_id) VALUES
    ('Skim milk powder', v), ('Dried milk', v), ('Milk powder', v) ON CONFLICT (display_name) DO NOTHING;

  SELECT id INTO v FROM canonical_ingredients WHERE canonical_name = 'egg_yolks';
  INSERT INTO ingredient_aliases (display_name, canonical_ingredient_id) VALUES
    ('Egg yolks', v), ('Egg yolk', v) ON CONFLICT (display_name) DO NOTHING;

  -- Existing dairy canonicals — extra aliases
  SELECT id INTO v FROM canonical_ingredients WHERE canonical_name = 'milk';
  INSERT INTO ingredient_aliases (display_name, canonical_ingredient_id) VALUES
    ('Milk whole', v), ('Milk skim', v), ('Milk 2 percent', v),
    ('Whole milk', v), ('Skim milk', v), ('2% milk', v), ('Low-fat milk', v) ON CONFLICT (display_name) DO NOTHING;

  SELECT id INTO v FROM canonical_ingredients WHERE canonical_name = 'cream';
  INSERT INTO ingredient_aliases (display_name, canonical_ingredient_id) VALUES
    ('Cream heavy', v), ('Cream light', v), ('Heavy cream', v),
    ('Light cream', v), ('Sour cream', v), ('Whipping cream', v),
    ('Crème fraîche', v) ON CONFLICT (display_name) DO NOTHING;

  SELECT id INTO v FROM canonical_ingredients WHERE canonical_name = 'yogurt';
  INSERT INTO ingredient_aliases (display_name, canonical_ingredient_id) VALUES
    ('Yogurt Greek', v), ('Yogurt plain', v), ('Greek yogurt', v),
    ('Plain yogurt', v) ON CONFLICT (display_name) DO NOTHING;

  -- Cheese varieties — new distinct canonicals
  SELECT id INTO v FROM canonical_ingredients WHERE canonical_name = 'brie';
  INSERT INTO ingredient_aliases (display_name, canonical_ingredient_id) VALUES
    ('Brie cheese', v), ('Brie', v) ON CONFLICT (display_name) DO NOTHING;

  SELECT id INTO v FROM canonical_ingredients WHERE canonical_name = 'camembert';
  INSERT INTO ingredient_aliases (display_name, canonical_ingredient_id) VALUES
    ('Camembert', v), ('Camembert cheese', v) ON CONFLICT (display_name) DO NOTHING;

  SELECT id INTO v FROM canonical_ingredients WHERE canonical_name = 'edam';
  INSERT INTO ingredient_aliases (display_name, canonical_ingredient_id) VALUES
    ('Edam cheese', v), ('Edam', v) ON CONFLICT (display_name) DO NOTHING;

  SELECT id INTO v FROM canonical_ingredients WHERE canonical_name = 'emmental';
  INSERT INTO ingredient_aliases (display_name, canonical_ingredient_id) VALUES
    ('Emmental cheese', v), ('Emmental', v), ('Emmentaler', v) ON CONFLICT (display_name) DO NOTHING;

  SELECT id INTO v FROM canonical_ingredients WHERE canonical_name = 'fontina';
  INSERT INTO ingredient_aliases (display_name, canonical_ingredient_id) VALUES
    ('Fontina cheese', v), ('Fontina', v) ON CONFLICT (display_name) DO NOTHING;

  SELECT id INTO v FROM canonical_ingredients WHERE canonical_name = 'gorgonzola';
  INSERT INTO ingredient_aliases (display_name, canonical_ingredient_id) VALUES
    ('Gorgonzola', v), ('Gorgonzola cheese', v), ('Gorgonzola dolce', v) ON CONFLICT (display_name) DO NOTHING;

  SELECT id INTO v FROM canonical_ingredients WHERE canonical_name = 'gouda';
  INSERT INTO ingredient_aliases (display_name, canonical_ingredient_id) VALUES
    ('Gouda cheese', v), ('Gouda', v), ('Smoked gouda', v) ON CONFLICT (display_name) DO NOTHING;

  SELECT id INTO v FROM canonical_ingredients WHERE canonical_name = 'gruyere';
  INSERT INTO ingredient_aliases (display_name, canonical_ingredient_id) VALUES
    ('Gruyere cheese', v), ('Gruyère', v), ('Gruyere', v) ON CONFLICT (display_name) DO NOTHING;

  SELECT id INTO v FROM canonical_ingredients WHERE canonical_name = 'halloumi';
  INSERT INTO ingredient_aliases (display_name, canonical_ingredient_id) VALUES
    ('Halloumi cheese', v), ('Halloumi', v), ('Grilling cheese', v) ON CONFLICT (display_name) DO NOTHING;

  SELECT id INTO v FROM canonical_ingredients WHERE canonical_name = 'mascarpone';
  INSERT INTO ingredient_aliases (display_name, canonical_ingredient_id) VALUES
    ('Mascarpone cheese', v), ('Mascarpone', v) ON CONFLICT (display_name) DO NOTHING;

  SELECT id INTO v FROM canonical_ingredients WHERE canonical_name = 'monterey_jack';
  INSERT INTO ingredient_aliases (display_name, canonical_ingredient_id) VALUES
    ('Monterey Jack cheese', v), ('Monterey Jack', v), ('Pepper jack', v) ON CONFLICT (display_name) DO NOTHING;

  SELECT id INTO v FROM canonical_ingredients WHERE canonical_name = 'provolone';
  INSERT INTO ingredient_aliases (display_name, canonical_ingredient_id) VALUES
    ('Provolone cheese', v), ('Provolone', v) ON CONFLICT (display_name) DO NOTHING;

  SELECT id INTO v FROM canonical_ingredients WHERE canonical_name = 'buffalo_mozzarella';
  INSERT INTO ingredient_aliases (display_name, canonical_ingredient_id) VALUES
    ('Buffalo mozzarella', v), ('Mozzarella fresh', v), ('Mozzarella shredded', v),
    ('Mozzarella di bufala', v) ON CONFLICT (display_name) DO NOTHING;

  -- Existing 'cheese' canonical — extra display aliases
  SELECT id INTO v FROM canonical_ingredients WHERE canonical_name = 'cheese';
  INSERT INTO ingredient_aliases (display_name, canonical_ingredient_id) VALUES
    ('Cheddar cheese mild', v), ('Cheddar cheese sharp', v), ('Cheese curds', v),
    ('Blue cheese', v), ('Swiss cheese', v), ('Parmesan grated', v) ON CONFLICT (display_name) DO NOTHING;

  -- ── MEAT & POULTRY ─────────────────────────────────────────

  SELECT id INTO v FROM canonical_ingredients WHERE canonical_name = 'beef_liver';
  INSERT INTO ingredient_aliases (display_name, canonical_ingredient_id) VALUES
    ('Beef liver', v), ('Calves liver', v) ON CONFLICT (display_name) DO NOTHING;

  SELECT id INTO v FROM canonical_ingredients WHERE canonical_name = 'beef_tongue';
  INSERT INTO ingredient_aliases (display_name, canonical_ingredient_id) VALUES
    ('Beef tongue', v), ('Ox tongue', v) ON CONFLICT (display_name) DO NOTHING;

  SELECT id INTO v FROM canonical_ingredients WHERE canonical_name = 'beef_fat';
  INSERT INTO ingredient_aliases (display_name, canonical_ingredient_id) VALUES
    ('Beef fat', v), ('Beef tallow', v), ('Suet', v) ON CONFLICT (display_name) DO NOTHING;

  SELECT id INTO v FROM canonical_ingredients WHERE canonical_name = 'beef_jerky';
  INSERT INTO ingredient_aliases (display_name, canonical_ingredient_id) VALUES
    ('Beef jerky', v) ON CONFLICT (display_name) DO NOTHING;

  SELECT id INTO v FROM canonical_ingredients WHERE canonical_name = 'chicken_livers';
  INSERT INTO ingredient_aliases (display_name, canonical_ingredient_id) VALUES
    ('Chicken livers', v), ('Chicken liver', v) ON CONFLICT (display_name) DO NOTHING;

  SELECT id INTO v FROM canonical_ingredients WHERE canonical_name = 'chicken_fat';
  INSERT INTO ingredient_aliases (display_name, canonical_ingredient_id) VALUES
    ('Chicken fat', v), ('Schmaltz', v) ON CONFLICT (display_name) DO NOTHING;

  SELECT id INTO v FROM canonical_ingredients WHERE canonical_name = 'duck_fat';
  INSERT INTO ingredient_aliases (display_name, canonical_ingredient_id) VALUES
    ('Duck fat', v) ON CONFLICT (display_name) DO NOTHING;

  SELECT id INTO v FROM canonical_ingredients WHERE canonical_name = 'ham';
  INSERT INTO ingredient_aliases (display_name, canonical_ingredient_id) VALUES
    ('Ham sliced', v), ('Ham hock', v), ('Ham', v), ('Smoked ham', v),
    ('Honey ham', v) ON CONFLICT (display_name) DO NOTHING;

  SELECT id INTO v FROM canonical_ingredients WHERE canonical_name = 'lard';
  INSERT INTO ingredient_aliases (display_name, canonical_ingredient_id) VALUES
    ('Lard', v), ('Pork fat', v), ('Manteca', v) ON CONFLICT (display_name) DO NOTHING;

  SELECT id INTO v FROM canonical_ingredients WHERE canonical_name = 'oxtail';
  INSERT INTO ingredient_aliases (display_name, canonical_ingredient_id) VALUES
    ('Oxtail', v), ('Ox tail', v) ON CONFLICT (display_name) DO NOTHING;

  SELECT id INTO v FROM canonical_ingredients WHERE canonical_name = 'pancetta';
  INSERT INTO ingredient_aliases (display_name, canonical_ingredient_id) VALUES
    ('Pancetta', v), ('Italian bacon', v) ON CONFLICT (display_name) DO NOTHING;

  SELECT id INTO v FROM canonical_ingredients WHERE canonical_name = 'italian_sausage';
  INSERT INTO ingredient_aliases (display_name, canonical_ingredient_id) VALUES
    ('Italian sausage', v), ('Pork sausage', v), ('Sausage', v),
    ('Andouille sausage', v), ('Smoked sausage', v) ON CONFLICT (display_name) DO NOTHING;

  SELECT id INTO v FROM canonical_ingredients WHERE canonical_name = 'pork_ribs';
  INSERT INTO ingredient_aliases (display_name, canonical_ingredient_id) VALUES
    ('Pork ribs', v), ('Baby back ribs', v), ('Spare ribs', v) ON CONFLICT (display_name) DO NOTHING;

  -- Existing meat canonicals — extra aliases
  SELECT id INTO v FROM canonical_ingredients WHERE canonical_name = 'beef';
  INSERT INTO ingredient_aliases (display_name, canonical_ingredient_id) VALUES
    ('Beef brisket', v), ('Beef cheeks', v), ('Beef chuck', v), ('Beef mince', v),
    ('Beef ribeye', v), ('Beef ribs', v), ('Beef shank', v), ('Beef short ribs', v),
    ('Beef sirloin', v), ('Beef tenderloin', v), ('Ground beef', v),
    ('Steak flank', v), ('Steak t bone', v), ('Flank steak', v),
    ('T-bone steak', v) ON CONFLICT (display_name) DO NOTHING;

  SELECT id INTO v FROM canonical_ingredients WHERE canonical_name = 'chicken';
  INSERT INTO ingredient_aliases (display_name, canonical_ingredient_id) VALUES
    ('Chicken breast', v), ('Chicken thighs', v), ('Chicken wings', v),
    ('Chicken drumsticks', v) ON CONFLICT (display_name) DO NOTHING;

  SELECT id INTO v FROM canonical_ingredients WHERE canonical_name = 'pork';
  INSERT INTO ingredient_aliases (display_name, canonical_ingredient_id) VALUES
    ('Pork belly', v), ('Pork chop', v), ('Pork loin', v),
    ('Bacon', v), ('Applewood smoked bacon', v) ON CONFLICT (display_name) DO NOTHING;

  SELECT id INTO v FROM canonical_ingredients WHERE canonical_name = 'lamb';
  INSERT INTO ingredient_aliases (display_name, canonical_ingredient_id) VALUES
    ('Lamb chops', v), ('Lamb leg', v), ('Lamb shank', v), ('Ground lamb', v) ON CONFLICT (display_name) DO NOTHING;

  SELECT id INTO v FROM canonical_ingredients WHERE canonical_name = 'duck';
  INSERT INTO ingredient_aliases (display_name, canonical_ingredient_id) VALUES
    ('Duck breast', v), ('Duck legs', v) ON CONFLICT (display_name) DO NOTHING;

  -- Broth / stock aliases → bone_broth canonical
  SELECT id INTO v FROM canonical_ingredients WHERE canonical_name = 'bone_broth';
  INSERT INTO ingredient_aliases (display_name, canonical_ingredient_id) VALUES
    ('Beef broth', v), ('Beef stock', v), ('Chicken broth', v), ('Chicken stock', v),
    ('Vegetable broth', v), ('Vegetable stock', v), ('Fish stock', v),
    ('Beef bones', v), ('Chicken bones', v), ('Demi-glace', v) ON CONFLICT (display_name) DO NOTHING;

  -- ── SEAFOOD ────────────────────────────────────────────────

  SELECT id INTO v FROM canonical_ingredients WHERE canonical_name = 'calamari';
  INSERT INTO ingredient_aliases (display_name, canonical_ingredient_id) VALUES
    ('Calamari', v), ('Fried calamari', v), ('Squid rings', v) ON CONFLICT (display_name) DO NOTHING;

  SELECT id INTO v FROM canonical_ingredients WHERE canonical_name = 'cod';
  INSERT INTO ingredient_aliases (display_name, canonical_ingredient_id) VALUES
    ('Cod fillet', v), ('Cod', v), ('Salt cod', v) ON CONFLICT (display_name) DO NOTHING;

  SELECT id INTO v FROM canonical_ingredients WHERE canonical_name = 'crab';
  INSERT INTO ingredient_aliases (display_name, canonical_ingredient_id) VALUES
    ('Crab meat', v), ('Crab', v), ('Dungeness crab', v), ('Snow crab', v) ON CONFLICT (display_name) DO NOTHING;

  SELECT id INTO v FROM canonical_ingredients WHERE canonical_name = 'haddock';
  INSERT INTO ingredient_aliases (display_name, canonical_ingredient_id) VALUES
    ('Haddock', v), ('Smoked haddock', v) ON CONFLICT (display_name) DO NOTHING;

  SELECT id INTO v FROM canonical_ingredients WHERE canonical_name = 'halibut';
  INSERT INTO ingredient_aliases (display_name, canonical_ingredient_id) VALUES
    ('Halibut', v), ('Halibut fillet', v) ON CONFLICT (display_name) DO NOTHING;

  SELECT id INTO v FROM canonical_ingredients WHERE canonical_name = 'lobster';
  INSERT INTO ingredient_aliases (display_name, canonical_ingredient_id) VALUES
    ('Lobster tail', v), ('Lobster', v) ON CONFLICT (display_name) DO NOTHING;

  SELECT id INTO v FROM canonical_ingredients WHERE canonical_name = 'mackerel';
  INSERT INTO ingredient_aliases (display_name, canonical_ingredient_id) VALUES
    ('Mackerel', v), ('Smoked mackerel', v) ON CONFLICT (display_name) DO NOTHING;

  SELECT id INTO v FROM canonical_ingredients WHERE canonical_name = 'mussels';
  INSERT INTO ingredient_aliases (display_name, canonical_ingredient_id) VALUES
    ('Mussels', v), ('Fresh mussels', v) ON CONFLICT (display_name) DO NOTHING;

  SELECT id INTO v FROM canonical_ingredients WHERE canonical_name = 'oysters';
  INSERT INTO ingredient_aliases (display_name, canonical_ingredient_id) VALUES
    ('Oysters', v), ('Fresh oysters', v) ON CONFLICT (display_name) DO NOTHING;

  SELECT id INTO v FROM canonical_ingredients WHERE canonical_name = 'prawns';
  INSERT INTO ingredient_aliases (display_name, canonical_ingredient_id) VALUES
    ('Prawns jumbo', v), ('Prawns', v), ('King prawns', v), ('Tiger prawns', v),
    ('Shrimp peeled', v) ON CONFLICT (display_name) DO NOTHING;

  SELECT id INTO v FROM canonical_ingredients WHERE canonical_name = 'salmon';
  INSERT INTO ingredient_aliases (display_name, canonical_ingredient_id) VALUES
    ('Salmon fillet', v), ('Salmon smoked', v), ('Smoked salmon', v),
    ('Atlantic salmon', v) ON CONFLICT (display_name) DO NOTHING;

  SELECT id INTO v FROM canonical_ingredients WHERE canonical_name = 'scallops';
  INSERT INTO ingredient_aliases (display_name, canonical_ingredient_id) VALUES
    ('Scallops', v), ('Sea scallops', v), ('Bay scallops', v) ON CONFLICT (display_name) DO NOTHING;

  SELECT id INTO v FROM canonical_ingredients WHERE canonical_name = 'sea_bass';
  INSERT INTO ingredient_aliases (display_name, canonical_ingredient_id) VALUES
    ('Sea bass', v), ('Chilean sea bass', v), ('European sea bass', v) ON CONFLICT (display_name) DO NOTHING;

  SELECT id INTO v FROM canonical_ingredients WHERE canonical_name = 'squid';
  INSERT INTO ingredient_aliases (display_name, canonical_ingredient_id) VALUES
    ('Squid', v), ('Squid ink', v) ON CONFLICT (display_name) DO NOTHING;

  SELECT id INTO v FROM canonical_ingredients WHERE canonical_name = 'tilapia';
  INSERT INTO ingredient_aliases (display_name, canonical_ingredient_id) VALUES
    ('Tilapia', v), ('Tilapia fillet', v) ON CONFLICT (display_name) DO NOTHING;

  SELECT id INTO v FROM canonical_ingredients WHERE canonical_name = 'tuna';
  INSERT INTO ingredient_aliases (display_name, canonical_ingredient_id) VALUES
    ('Tuna canned', v), ('Tuna steak', v), ('Canned tuna', v), ('Tuna', v) ON CONFLICT (display_name) DO NOTHING;

  SELECT id INTO v FROM canonical_ingredients WHERE canonical_name = 'trout';
  INSERT INTO ingredient_aliases (display_name, canonical_ingredient_id) VALUES
    ('Trout', v), ('Rainbow trout', v) ON CONFLICT (display_name) DO NOTHING;

  SELECT id INTO v FROM canonical_ingredients WHERE canonical_name = 'anchovies';
  INSERT INTO ingredient_aliases (display_name, canonical_ingredient_id) VALUES
    ('Anchovy fillets', v), ('Anchovies', v), ('Canned anchovies', v) ON CONFLICT (display_name) DO NOTHING;

  SELECT id INTO v FROM canonical_ingredients WHERE canonical_name = 'bonito_flakes';
  INSERT INTO ingredient_aliases (display_name, canonical_ingredient_id) VALUES
    ('Bonito flakes', v), ('Katsuobushi', v) ON CONFLICT (display_name) DO NOTHING;

  SELECT id INTO v FROM canonical_ingredients WHERE canonical_name = 'abalone';
  INSERT INTO ingredient_aliases (display_name, canonical_ingredient_id) VALUES
    ('Abalone', v) ON CONFLICT (display_name) DO NOTHING;

  SELECT id INTO v FROM canonical_ingredients WHERE canonical_name = 'sardines';
  INSERT INTO ingredient_aliases (display_name, canonical_ingredient_id) VALUES
    ('Sardines canned', v), ('Sardines', v) ON CONFLICT (display_name) DO NOTHING;

  SELECT id INTO v FROM canonical_ingredients WHERE canonical_name = 'octopus';
  INSERT INTO ingredient_aliases (display_name, canonical_ingredient_id) VALUES
    ('Octopus', v), ('Baby octopus', v) ON CONFLICT (display_name) DO NOTHING;

  -- ── SPICES & HERBS ─────────────────────────────────────────

  SELECT id INTO v FROM canonical_ingredients WHERE canonical_name = 'asafoetida';
  INSERT INTO ingredient_aliases (display_name, canonical_ingredient_id) VALUES
    ('Asafoetida', v), ('Hing', v) ON CONFLICT (display_name) DO NOTHING;

  SELECT id INTO v FROM canonical_ingredients WHERE canonical_name = 'berbere';
  INSERT INTO ingredient_aliases (display_name, canonical_ingredient_id) VALUES
    ('Berbere spice', v), ('Berbere', v) ON CONFLICT (display_name) DO NOTHING;

  SELECT id INTO v FROM canonical_ingredients WHERE canonical_name = 'biryani_masala';
  INSERT INTO ingredient_aliases (display_name, canonical_ingredient_id) VALUES
    ('Biryani masala', v) ON CONFLICT (display_name) DO NOTHING;

  SELECT id INTO v FROM canonical_ingredients WHERE canonical_name = 'black_cardamom';
  INSERT INTO ingredient_aliases (display_name, canonical_ingredient_id) VALUES
    ('Black cardamom', v), ('Black cardamom pods', v) ON CONFLICT (display_name) DO NOTHING;

  SELECT id INTO v FROM canonical_ingredients WHERE canonical_name = 'cloves';
  INSERT INTO ingredient_aliases (display_name, canonical_ingredient_id) VALUES
    ('Cloves whole', v), ('Cloves', v), ('Ground cloves', v) ON CONFLICT (display_name) DO NOTHING;

  SELECT id INTO v FROM canonical_ingredients WHERE canonical_name = 'coriander_seeds';
  INSERT INTO ingredient_aliases (display_name, canonical_ingredient_id) VALUES
    ('Coriander seeds', v), ('Whole coriander', v) ON CONFLICT (display_name) DO NOTHING;

  SELECT id INTO v FROM canonical_ingredients WHERE canonical_name = 'coriander_ground';
  INSERT INTO ingredient_aliases (display_name, canonical_ingredient_id) VALUES
    ('Coriander ground', v), ('Ground coriander', v) ON CONFLICT (display_name) DO NOTHING;

  SELECT id INTO v FROM canonical_ingredients WHERE canonical_name = 'fenugreek';
  INSERT INTO ingredient_aliases (display_name, canonical_ingredient_id) VALUES
    ('Fenugreek', v), ('Fenugreek seeds', v), ('Methi', v) ON CONFLICT (display_name) DO NOTHING;

  SELECT id INTO v FROM canonical_ingredients WHERE canonical_name = 'garam_masala';
  INSERT INTO ingredient_aliases (display_name, canonical_ingredient_id) VALUES
    ('Garam masala', v) ON CONFLICT (display_name) DO NOTHING;

  SELECT id INTO v FROM canonical_ingredients WHERE canonical_name = 'juniper_berries';
  INSERT INTO ingredient_aliases (display_name, canonical_ingredient_id) VALUES
    ('Juniper berries', v) ON CONFLICT (display_name) DO NOTHING;

  SELECT id INTO v FROM canonical_ingredients WHERE canonical_name = 'marjoram';
  INSERT INTO ingredient_aliases (display_name, canonical_ingredient_id) VALUES
    ('Marjoram', v), ('Fresh marjoram', v), ('Dried marjoram', v) ON CONFLICT (display_name) DO NOTHING;

  SELECT id INTO v FROM canonical_ingredients WHERE canonical_name = 'mustard_seeds';
  INSERT INTO ingredient_aliases (display_name, canonical_ingredient_id) VALUES
    ('Mustard seeds', v), ('Yellow mustard seeds', v), ('Black mustard seeds', v) ON CONFLICT (display_name) DO NOTHING;

  SELECT id INTO v FROM canonical_ingredients WHERE canonical_name = 'pink_peppercorns';
  INSERT INTO ingredient_aliases (display_name, canonical_ingredient_id) VALUES
    ('Peppercorns pink', v), ('Pink peppercorns', v) ON CONFLICT (display_name) DO NOTHING;

  SELECT id INTO v FROM canonical_ingredients WHERE canonical_name = 'peppermint';
  INSERT INTO ingredient_aliases (display_name, canonical_ingredient_id) VALUES
    ('Peppermint', v), ('Peppermint leaves', v) ON CONFLICT (display_name) DO NOTHING;

  -- Existing spice canonicals — extra aliases
  SELECT id INTO v FROM canonical_ingredients WHERE canonical_name = 'basil';
  INSERT INTO ingredient_aliases (display_name, canonical_ingredient_id) VALUES
    ('Thai basil', v), ('Fresh basil', v), ('Dried basil', v) ON CONFLICT (display_name) DO NOTHING;

  SELECT id INTO v FROM canonical_ingredients WHERE canonical_name = 'cardamom';
  INSERT INTO ingredient_aliases (display_name, canonical_ingredient_id) VALUES
    ('Cardamom green', v), ('Cardamom ground', v), ('Green cardamom', v),
    ('Ground cardamom', v) ON CONFLICT (display_name) DO NOTHING;

  SELECT id INTO v FROM canonical_ingredients WHERE canonical_name = 'salt';
  INSERT INTO ingredient_aliases (display_name, canonical_ingredient_id) VALUES
    ('Kosher salt', v), ('Sea salt flakes', v), ('Rock salt', v) ON CONFLICT (display_name) DO NOTHING;

  SELECT id INTO v FROM canonical_ingredients WHERE canonical_name = 'pepper_spice';
  INSERT INTO ingredient_aliases (display_name, canonical_ingredient_id) VALUES
    ('Black pepper ground', v), ('Black pepper whole', v) ON CONFLICT (display_name) DO NOTHING;

  SELECT id INTO v FROM canonical_ingredients WHERE canonical_name = 'ginger';
  INSERT INTO ingredient_aliases (display_name, canonical_ingredient_id) VALUES
    ('Ginger fresh', v), ('Ginger ground', v) ON CONFLICT (display_name) DO NOTHING;

  SELECT id INTO v FROM canonical_ingredients WHERE canonical_name = 'cilantro';
  INSERT INTO ingredient_aliases (display_name, canonical_ingredient_id) VALUES
    ('Cilantro', v), ('Fresh cilantro', v), ('Coriander leaves', v) ON CONFLICT (display_name) DO NOTHING;

  SELECT id INTO v FROM canonical_ingredients WHERE canonical_name = 'dill';
  INSERT INTO ingredient_aliases (display_name, canonical_ingredient_id) VALUES
    ('Dill fresh', v), ('Dill dried', v) ON CONFLICT (display_name) DO NOTHING;

  SELECT id INTO v FROM canonical_ingredients WHERE canonical_name = 'oregano';
  INSERT INTO ingredient_aliases (display_name, canonical_ingredient_id) VALUES
    ('Oregano dried', v), ('Oregano fresh', v), ('Fresh oregano', v) ON CONFLICT (display_name) DO NOTHING;

  SELECT id INTO v FROM canonical_ingredients WHERE canonical_name = 'parsley';
  INSERT INTO ingredient_aliases (display_name, canonical_ingredient_id) VALUES
    ('Parsley curly', v), ('Parsley flat leaf', v), ('Fresh parsley', v) ON CONFLICT (display_name) DO NOTHING;

  SELECT id INTO v FROM canonical_ingredients WHERE canonical_name = 'rosemary';
  INSERT INTO ingredient_aliases (display_name, canonical_ingredient_id) VALUES
    ('Rosemary fresh', v), ('Rosemary dried', v), ('Fresh rosemary', v) ON CONFLICT (display_name) DO NOTHING;

  SELECT id INTO v FROM canonical_ingredients WHERE canonical_name = 'sage';
  INSERT INTO ingredient_aliases (display_name, canonical_ingredient_id) VALUES
    ('Sage fresh', v), ('Sage dried', v) ON CONFLICT (display_name) DO NOTHING;

  SELECT id INTO v FROM canonical_ingredients WHERE canonical_name = 'tarragon';
  INSERT INTO ingredient_aliases (display_name, canonical_ingredient_id) VALUES
    ('Tarragon fresh', v), ('Tarragon dried', v) ON CONFLICT (display_name) DO NOTHING;

  SELECT id INTO v FROM canonical_ingredients WHERE canonical_name = 'thyme';
  INSERT INTO ingredient_aliases (display_name, canonical_ingredient_id) VALUES
    ('Thyme fresh', v), ('Thyme dried', v), ('Fresh thyme', v) ON CONFLICT (display_name) DO NOTHING;

  SELECT id INTO v FROM canonical_ingredients WHERE canonical_name = 'mint';
  INSERT INTO ingredient_aliases (display_name, canonical_ingredient_id) VALUES
    ('Mint leaves', v), ('Fresh mint', v) ON CONFLICT (display_name) DO NOTHING;

  SELECT id INTO v FROM canonical_ingredients WHERE canonical_name = 'turmeric';
  INSERT INTO ingredient_aliases (display_name, canonical_ingredient_id) VALUES
    ('Turmeric ground', v), ('Turmeric root', v) ON CONFLICT (display_name) DO NOTHING;

  SELECT id INTO v FROM canonical_ingredients WHERE canonical_name = 'fennel';
  INSERT INTO ingredient_aliases (display_name, canonical_ingredient_id) VALUES
    ('Fennel bulb', v), ('Fennel seeds', v) ON CONFLICT (display_name) DO NOTHING;

  -- ── OILS ───────────────────────────────────────────────────

  SELECT id INTO v FROM canonical_ingredients WHERE canonical_name = 'almond_oil';
  INSERT INTO ingredient_aliases (display_name, canonical_ingredient_id) VALUES
    ('Almond oil', v) ON CONFLICT (display_name) DO NOTHING;

  SELECT id INTO v FROM canonical_ingredients WHERE canonical_name = 'avocado_oil';
  INSERT INTO ingredient_aliases (display_name, canonical_ingredient_id) VALUES
    ('Avocado oil', v) ON CONFLICT (display_name) DO NOTHING;

  SELECT id INTO v FROM canonical_ingredients WHERE canonical_name = 'coconut_oil';
  INSERT INTO ingredient_aliases (display_name, canonical_ingredient_id) VALUES
    ('Coconut oil', v), ('Virgin coconut oil', v), ('Refined coconut oil', v) ON CONFLICT (display_name) DO NOTHING;

  SELECT id INTO v FROM canonical_ingredients WHERE canonical_name = 'corn_oil';
  INSERT INTO ingredient_aliases (display_name, canonical_ingredient_id) VALUES
    ('Corn oil', v) ON CONFLICT (display_name) DO NOTHING;

  SELECT id INTO v FROM canonical_ingredients WHERE canonical_name = 'peanut_oil';
  INSERT INTO ingredient_aliases (display_name, canonical_ingredient_id) VALUES
    ('Peanut oil', v), ('Groundnut oil', v) ON CONFLICT (display_name) DO NOTHING;

  SELECT id INTO v FROM canonical_ingredients WHERE canonical_name = 'sunflower_oil';
  INSERT INTO ingredient_aliases (display_name, canonical_ingredient_id) VALUES
    ('Sunflower oil', v) ON CONFLICT (display_name) DO NOTHING;

  SELECT id INTO v FROM canonical_ingredients WHERE canonical_name = 'walnut_oil';
  INSERT INTO ingredient_aliases (display_name, canonical_ingredient_id) VALUES
    ('Walnut oil', v) ON CONFLICT (display_name) DO NOTHING;

  SELECT id INTO v FROM canonical_ingredients WHERE canonical_name = 'olive_oil';
  INSERT INTO ingredient_aliases (display_name, canonical_ingredient_id) VALUES
    ('Extra virgin olive oil', v), ('Olive oil light', v) ON CONFLICT (display_name) DO NOTHING;

  SELECT id INTO v FROM canonical_ingredients WHERE canonical_name = 'vegetable_oil';
  INSERT INTO ingredient_aliases (display_name, canonical_ingredient_id) VALUES
    ('Canola oil', v), ('Grapeseed oil', v) ON CONFLICT (display_name) DO NOTHING;

  -- ── CONDIMENTS & SAUCES ────────────────────────────────────

  SELECT id INTO v FROM canonical_ingredients WHERE canonical_name = 'anchovy_paste';
  INSERT INTO ingredient_aliases (display_name, canonical_ingredient_id) VALUES
    ('Anchovy paste', v) ON CONFLICT (display_name) DO NOTHING;

  SELECT id INTO v FROM canonical_ingredients WHERE canonical_name = 'agar_agar';
  INSERT INTO ingredient_aliases (display_name, canonical_ingredient_id) VALUES
    ('Agar agar', v), ('Agar', v), ('Agar powder', v) ON CONFLICT (display_name) DO NOTHING;

  SELECT id INTO v FROM canonical_ingredients WHERE canonical_name = 'gelatin';
  INSERT INTO ingredient_aliases (display_name, canonical_ingredient_id) VALUES
    ('Gelatin', v), ('Gelatine', v), ('Gelatin sheets', v), ('Gelatin powder', v) ON CONFLICT (display_name) DO NOTHING;

  SELECT id INTO v FROM canonical_ingredients WHERE canonical_name = 'horseradish';
  INSERT INTO ingredient_aliases (display_name, canonical_ingredient_id) VALUES
    ('Horseradish', v), ('Horseradish sauce', v), ('Prepared horseradish', v) ON CONFLICT (display_name) DO NOTHING;

  SELECT id INTO v FROM canonical_ingredients WHERE canonical_name = 'hot_sauce';
  INSERT INTO ingredient_aliases (display_name, canonical_ingredient_id) VALUES
    ('Hot sauce', v), ('Tabasco', v), ('Frank''s hot sauce', v) ON CONFLICT (display_name) DO NOTHING;

  SELECT id INTO v FROM canonical_ingredients WHERE canonical_name = 'mango_chutney';
  INSERT INTO ingredient_aliases (display_name, canonical_ingredient_id) VALUES
    ('Mango chutney', v) ON CONFLICT (display_name) DO NOTHING;

  SELECT id INTO v FROM canonical_ingredients WHERE canonical_name = 'molasses';
  INSERT INTO ingredient_aliases (display_name, canonical_ingredient_id) VALUES
    ('Molasses', v), ('Blackstrap molasses', v), ('Treacle', v) ON CONFLICT (display_name) DO NOTHING;

  SELECT id INTO v FROM canonical_ingredients WHERE canonical_name = 'oyster_sauce';
  INSERT INTO ingredient_aliases (display_name, canonical_ingredient_id) VALUES
    ('Oyster sauce', v) ON CONFLICT (display_name) DO NOTHING;

  SELECT id INTO v FROM canonical_ingredients WHERE canonical_name = 'pesto';
  INSERT INTO ingredient_aliases (display_name, canonical_ingredient_id) VALUES
    ('Pesto sauce', v), ('Pesto', v), ('Basil pesto', v) ON CONFLICT (display_name) DO NOTHING;

  SELECT id INTO v FROM canonical_ingredients WHERE canonical_name = 'pumpkin_puree';
  INSERT INTO ingredient_aliases (display_name, canonical_ingredient_id) VALUES
    ('Pumpkin puree', v), ('Canned pumpkin', v) ON CONFLICT (display_name) DO NOTHING;

  SELECT id INTO v FROM canonical_ingredients WHERE canonical_name = 'raspberry_jam';
  INSERT INTO ingredient_aliases (display_name, canonical_ingredient_id) VALUES
    ('Raspberry jam', v) ON CONFLICT (display_name) DO NOTHING;

  SELECT id INTO v FROM canonical_ingredients WHERE canonical_name = 'apricot_jam';
  INSERT INTO ingredient_aliases (display_name, canonical_ingredient_id) VALUES
    ('Apricot jam', v), ('Apricot preserve', v) ON CONFLICT (display_name) DO NOTHING;

  SELECT id INTO v FROM canonical_ingredients WHERE canonical_name = 'sriracha';
  INSERT INTO ingredient_aliases (display_name, canonical_ingredient_id) VALUES
    ('Sriracha', v), ('Siracha sauce', v), ('Sriracha sauce', v) ON CONFLICT (display_name) DO NOTHING;

  SELECT id INTO v FROM canonical_ingredients WHERE canonical_name = 'sun_dried_tomatoes';
  INSERT INTO ingredient_aliases (display_name, canonical_ingredient_id) VALUES
    ('Sun dried tomatoes', v), ('Sun-dried tomatoes', v) ON CONFLICT (display_name) DO NOTHING;

  SELECT id INTO v FROM canonical_ingredients WHERE canonical_name = 'tamarind';
  INSERT INTO ingredient_aliases (display_name, canonical_ingredient_id) VALUES
    ('Tamarind paste', v), ('Tamarind', v), ('Tamarind concentrate', v),
    ('Tamarind pulp', v) ON CONFLICT (display_name) DO NOTHING;

  SELECT id INTO v FROM canonical_ingredients WHERE canonical_name = 'tapioca_pearls';
  INSERT INTO ingredient_aliases (display_name, canonical_ingredient_id) VALUES
    ('Tapioca pearls', v), ('Boba', v), ('Tapioca', v) ON CONFLICT (display_name) DO NOTHING;

  SELECT id INTO v FROM canonical_ingredients WHERE canonical_name = 'tomato_juice';
  INSERT INTO ingredient_aliases (display_name, canonical_ingredient_id) VALUES
    ('Tomato juice', v) ON CONFLICT (display_name) DO NOTHING;

  SELECT id INTO v FROM canonical_ingredients WHERE canonical_name = 'tomato_puree';
  INSERT INTO ingredient_aliases (display_name, canonical_ingredient_id) VALUES
    ('Tomato puree', v) ON CONFLICT (display_name) DO NOTHING;

  SELECT id INTO v FROM canonical_ingredients WHERE canonical_name = 'worcestershire';
  INSERT INTO ingredient_aliases (display_name, canonical_ingredient_id) VALUES
    ('Worcestershire sauce', v) ON CONFLICT (display_name) DO NOTHING;

  SELECT id INTO v FROM canonical_ingredients WHERE canonical_name = 'alfalfa_sprouts';
  INSERT INTO ingredient_aliases (display_name, canonical_ingredient_id) VALUES
    ('Alfalfa sprouts', v) ON CONFLICT (display_name) DO NOTHING;

  SELECT id INTO v FROM canonical_ingredients WHERE canonical_name = 'palm_sugar';
  INSERT INTO ingredient_aliases (display_name, canonical_ingredient_id) VALUES
    ('Palm sugar', v), ('Jaggery', v), ('Coconut palm sugar', v) ON CONFLICT (display_name) DO NOTHING;

  SELECT id INTO v FROM canonical_ingredients WHERE canonical_name = 'pickled_ginger';
  INSERT INTO ingredient_aliases (display_name, canonical_ingredient_id) VALUES
    ('Pickled ginger', v), ('Gari', v) ON CONFLICT (display_name) DO NOTHING;

  SELECT id INTO v FROM canonical_ingredients WHERE canonical_name = 'fried_onions';
  INSERT INTO ingredient_aliases (display_name, canonical_ingredient_id) VALUES
    ('Fried onions', v), ('Crispy fried onions', v), ('French''s fried onions', v) ON CONFLICT (display_name) DO NOTHING;

  -- Existing condiment canonicals — extra aliases
  SELECT id INTO v FROM canonical_ingredients WHERE canonical_name = 'vinegar';
  INSERT INTO ingredient_aliases (display_name, canonical_ingredient_id) VALUES
    ('Vinegar balsamic', v), ('Vinegar white', v), ('Red wine vinegar', v),
    ('Sherry vinegar', v), ('Malt vinegar', v), ('White wine vinegar', v),
    ('Rice vinegar', v) ON CONFLICT (display_name) DO NOTHING;

  SELECT id INTO v FROM canonical_ingredients WHERE canonical_name = 'mustard';
  INSERT INTO ingredient_aliases (display_name, canonical_ingredient_id) VALUES
    ('Dijon mustard', v) ON CONFLICT (display_name) DO NOTHING;

  SELECT id INTO v FROM canonical_ingredients WHERE canonical_name = 'soy_sauce';
  INSERT INTO ingredient_aliases (display_name, canonical_ingredient_id) VALUES
    ('Soy sauce dark', v), ('Soy sauce light', v), ('Dark soy sauce', v),
    ('Light soy sauce', v) ON CONFLICT (display_name) DO NOTHING;

  SELECT id INTO v FROM canonical_ingredients WHERE canonical_name = 'pickles';
  INSERT INTO ingredient_aliases (display_name, canonical_ingredient_id) VALUES
    ('Pickles dill', v), ('Gherkins', v) ON CONFLICT (display_name) DO NOTHING;

  SELECT id INTO v FROM canonical_ingredients WHERE canonical_name = 'olives';
  INSERT INTO ingredient_aliases (display_name, canonical_ingredient_id) VALUES
    ('Olives kalamata', v), ('Black olives', v), ('Green olives', v) ON CONFLICT (display_name) DO NOTHING;

  SELECT id INTO v FROM canonical_ingredients WHERE canonical_name = 'miso';
  INSERT INTO ingredient_aliases (display_name, canonical_ingredient_id) VALUES
    ('Miso paste white', v), ('Miso paste red', v) ON CONFLICT (display_name) DO NOTHING;

  -- ── SWEETENERS & BAKING ────────────────────────────────────

  SELECT id INTO v FROM canonical_ingredients WHERE canonical_name = 'agave_nectar';
  INSERT INTO ingredient_aliases (display_name, canonical_ingredient_id) VALUES
    ('Agave nectar', v), ('Agave syrup', v), ('Blue agave', v) ON CONFLICT (display_name) DO NOTHING;

  SELECT id INTO v FROM canonical_ingredients WHERE canonical_name = 'cacao_nibs';
  INSERT INTO ingredient_aliases (display_name, canonical_ingredient_id) VALUES
    ('Cacao nibs', v), ('Cocoa nibs', v) ON CONFLICT (display_name) DO NOTHING;

  SELECT id INTO v FROM canonical_ingredients WHERE canonical_name = 'coconut_sugar';
  INSERT INTO ingredient_aliases (display_name, canonical_ingredient_id) VALUES
    ('Coconut sugar', v) ON CONFLICT (display_name) DO NOTHING;

  SELECT id INTO v FROM canonical_ingredients WHERE canonical_name = 'coconut_flakes';
  INSERT INTO ingredient_aliases (display_name, canonical_ingredient_id) VALUES
    ('Coconut flakes', v), ('Desiccated coconut', v), ('Shredded coconut', v),
    ('Toasted coconut', v) ON CONFLICT (display_name) DO NOTHING;

  SELECT id INTO v FROM canonical_ingredients WHERE canonical_name = 'coconut_water';
  INSERT INTO ingredient_aliases (display_name, canonical_ingredient_id) VALUES
    ('Coconut water', v) ON CONFLICT (display_name) DO NOTHING;

  SELECT id INTO v FROM canonical_ingredients WHERE canonical_name = 'yeast';
  INSERT INTO ingredient_aliases (display_name, canonical_ingredient_id) VALUES
    ('Instant yeast', v), ('Yeast active dry', v), ('Active dry yeast', v),
    ('Fresh yeast', v), ('Dry yeast', v) ON CONFLICT (display_name) DO NOTHING;

  SELECT id INTO v FROM canonical_ingredients WHERE canonical_name = 'sugar';
  INSERT INTO ingredient_aliases (display_name, canonical_ingredient_id) VALUES
    ('Cane sugar', v), ('Granulated sugar', v) ON CONFLICT (display_name) DO NOTHING;

  SELECT id INTO v FROM canonical_ingredients WHERE canonical_name = 'chocolate';
  INSERT INTO ingredient_aliases (display_name, canonical_ingredient_id) VALUES
    ('Chocolate dark', v), ('Chocolate milk', v), ('Chocolate white', v),
    ('White chocolate', v), ('Dark chocolate', v) ON CONFLICT (display_name) DO NOTHING;

  SELECT id INTO v FROM canonical_ingredients WHERE canonical_name = 'vanilla';
  INSERT INTO ingredient_aliases (display_name, canonical_ingredient_id) VALUES
    ('Vanilla beans', v), ('Vanilla extract', v), ('Vanilla bean', v) ON CONFLICT (display_name) DO NOTHING;

  SELECT id INTO v FROM canonical_ingredients WHERE canonical_name = 'baking_soda';
  INSERT INTO ingredient_aliases (display_name, canonical_ingredient_id) VALUES
    ('Bicarbonate of soda', v), ('Baking soda', v), ('Bicarb', v) ON CONFLICT (display_name) DO NOTHING;

  SELECT id INTO v FROM canonical_ingredients WHERE canonical_name = 'sugar';
  INSERT INTO ingredient_aliases (display_name, canonical_ingredient_id) VALUES
    ('Sugar brown', v), ('Sugar powdered', v) ON CONFLICT (display_name) DO NOTHING;

  -- ── BEVERAGES & ALCOHOL ────────────────────────────────────

  SELECT id INTO v FROM canonical_ingredients WHERE canonical_name = 'apple_juice';
  INSERT INTO ingredient_aliases (display_name, canonical_ingredient_id) VALUES
    ('Apple juice', v), ('Apple cider', v) ON CONFLICT (display_name) DO NOTHING;

  SELECT id INTO v FROM canonical_ingredients WHERE canonical_name = 'bourbon';
  INSERT INTO ingredient_aliases (display_name, canonical_ingredient_id) VALUES
    ('Bourbon', v), ('Bourbon whiskey', v) ON CONFLICT (display_name) DO NOTHING;

  SELECT id INTO v FROM canonical_ingredients WHERE canonical_name = 'brandy';
  INSERT INTO ingredient_aliases (display_name, canonical_ingredient_id) VALUES
    ('Brandy', v), ('Cognac', v) ON CONFLICT (display_name) DO NOTHING;

  SELECT id INTO v FROM canonical_ingredients WHERE canonical_name = 'carrot_juice';
  INSERT INTO ingredient_aliases (display_name, canonical_ingredient_id) VALUES
    ('Carrot juice', v) ON CONFLICT (display_name) DO NOTHING;

  SELECT id INTO v FROM canonical_ingredients WHERE canonical_name = 'grape_juice';
  INSERT INTO ingredient_aliases (display_name, canonical_ingredient_id) VALUES
    ('Grape juice', v) ON CONFLICT (display_name) DO NOTHING;

  SELECT id INTO v FROM canonical_ingredients WHERE canonical_name = 'irish_whiskey';
  INSERT INTO ingredient_aliases (display_name, canonical_ingredient_id) VALUES
    ('Irish whiskey', v), ('Whiskey', v), ('Scotch whisky', v) ON CONFLICT (display_name) DO NOTHING;

  SELECT id INTO v FROM canonical_ingredients WHERE canonical_name = 'orange_juice';
  INSERT INTO ingredient_aliases (display_name, canonical_ingredient_id) VALUES
    ('Orange juice', v) ON CONFLICT (display_name) DO NOTHING;

  SELECT id INTO v FROM canonical_ingredients WHERE canonical_name = 'pineapple_juice';
  INSERT INTO ingredient_aliases (display_name, canonical_ingredient_id) VALUES
    ('Pineapple juice', v) ON CONFLICT (display_name) DO NOTHING;

  SELECT id INTO v FROM canonical_ingredients WHERE canonical_name = 'port_wine';
  INSERT INTO ingredient_aliases (display_name, canonical_ingredient_id) VALUES
    ('Port wine', v), ('Port', v), ('Tawny port', v) ON CONFLICT (display_name) DO NOTHING;

  SELECT id INTO v FROM canonical_ingredients WHERE canonical_name = 'rum';
  INSERT INTO ingredient_aliases (display_name, canonical_ingredient_id) VALUES
    ('Rum dark', v), ('Rum white', v), ('Dark rum', v), ('White rum', v),
    ('Rum', v) ON CONFLICT (display_name) DO NOTHING;

  SELECT id INTO v FROM canonical_ingredients WHERE canonical_name = 'soda_water';
  INSERT INTO ingredient_aliases (display_name, canonical_ingredient_id) VALUES
    ('Soda water', v), ('Sparkling water', v), ('Club soda', v) ON CONFLICT (display_name) DO NOTHING;

  SELECT id INTO v FROM canonical_ingredients WHERE canonical_name = 'vodka';
  INSERT INTO ingredient_aliases (display_name, canonical_ingredient_id) VALUES
    ('Vodka', v) ON CONFLICT (display_name) DO NOTHING;

  -- Existing beverages — extra aliases
  SELECT id INTO v FROM canonical_ingredients WHERE canonical_name = 'coffee';
  INSERT INTO ingredient_aliases (display_name, canonical_ingredient_id) VALUES
    ('Espresso', v), ('Coffee beans', v) ON CONFLICT (display_name) DO NOTHING;

  SELECT id INTO v FROM canonical_ingredients WHERE canonical_name = 'tea';
  INSERT INTO ingredient_aliases (display_name, canonical_ingredient_id) VALUES
    ('Tea black', v), ('Tea green', v), ('Green tea leaves', v),
    ('Black tea', v), ('Green tea', v) ON CONFLICT (display_name) DO NOTHING;

  SELECT id INTO v FROM canonical_ingredients WHERE canonical_name = 'wine';
  INSERT INTO ingredient_aliases (display_name, canonical_ingredient_id) VALUES
    ('Red wine', v), ('White wine', v) ON CONFLICT (display_name) DO NOTHING;

  SELECT id INTO v FROM canonical_ingredients WHERE canonical_name = 'coconut_milk';
  INSERT INTO ingredient_aliases (display_name, canonical_ingredient_id) VALUES
    ('Coconut cream', v) ON CONFLICT (display_name) DO NOTHING;

  SELECT id INTO v FROM canonical_ingredients WHERE canonical_name = 'acai';
  INSERT INTO ingredient_aliases (display_name, canonical_ingredient_id) VALUES
    ('Acai', v), ('Acai berry', v) ON CONFLICT (display_name) DO NOTHING;

  -- ── MISC ───────────────────────────────────────────────────

  SELECT id INTO v FROM canonical_ingredients WHERE canonical_name = 'nori';
  INSERT INTO ingredient_aliases (display_name, canonical_ingredient_id) VALUES
    ('Seaweed nori', v), ('Nori', v), ('Nori sheets', v) ON CONFLICT (display_name) DO NOTHING;

  SELECT id INTO v FROM canonical_ingredients WHERE canonical_name = 'seaweed';
  INSERT INTO ingredient_aliases (display_name, canonical_ingredient_id) VALUES
    ('Kelp', v), ('Wakame', v), ('Kombu', v) ON CONFLICT (display_name) DO NOTHING;

  RAISE NOTICE '========================================';
  RAISE NOTICE 'Extended ingredient list applied!';
  RAISE NOTICE 'Total canonical ingredients: %', (SELECT COUNT(*) FROM canonical_ingredients);
  RAISE NOTICE 'Total ingredient aliases: %', (SELECT COUNT(*) FROM ingredient_aliases);
  RAISE NOTICE 'Canonical ingredients with NO aliases: %',
    (SELECT COUNT(*) FROM canonical_ingredients ci
     WHERE NOT EXISTS (
       SELECT 1 FROM ingredient_aliases ia WHERE ia.canonical_ingredient_id = ci.id
     ));
  RAISE NOTICE '========================================';
END $$;
