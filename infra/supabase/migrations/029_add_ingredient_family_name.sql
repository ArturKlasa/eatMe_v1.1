-- Add ingredient family classification to canonical ingredients
-- Used to group variants like fresh/smoked salmon under the fish family.

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'canonical_ingredients'
      AND column_name = 'ingredient_family_name'
  ) THEN
    ALTER TABLE public.canonical_ingredients
      ADD COLUMN ingredient_family_name TEXT;
  END IF;
END $$;

-- Set a safe default for existing rows
UPDATE public.canonical_ingredients
SET ingredient_family_name = COALESCE(ingredient_family_name, 'other');

ALTER TABLE public.canonical_ingredients
  ALTER COLUMN ingredient_family_name SET DEFAULT 'other';

-- Backfill families (idempotent; runs safely even if some canonicals don't exist)

-- Seafood
UPDATE public.canonical_ingredients
SET ingredient_family_name = 'fish'
WHERE canonical_name IN (
  'fish',
  'salmon', 'tuna', 'cod', 'haddock', 'halibut', 'sea_bass', 'mackerel', 'tilapia', 'trout',
  'anchovies', 'sardines', 'bonito_flakes'
);

UPDATE public.canonical_ingredients
SET ingredient_family_name = 'shellfish'
WHERE canonical_name IN (
  'shellfish',
  'abalone',
  'prawns', 'crab', 'lobster', 'mussels', 'oysters', 'scallops',
  'octopus', 'squid', 'calamari'
);

-- Meat & poultry
UPDATE public.canonical_ingredients
SET ingredient_family_name = 'meat'
WHERE canonical_name IN (
  'beef', 'pork', 'lamb', 'pepperoni', 'prosciutto',
  'ham', 'lard', 'pancetta', 'italian_sausage', 'pork_ribs',
  'beef_liver', 'beef_tongue', 'beef_fat', 'beef_jerky', 'oxtail'
);

UPDATE public.canonical_ingredients
SET ingredient_family_name = 'poultry'
WHERE canonical_name IN (
  'chicken', 'duck',
  'chicken_livers', 'chicken_fat', 'duck_fat'
);

-- Dairy & eggs
UPDATE public.canonical_ingredients
SET ingredient_family_name = 'dairy'
WHERE canonical_name IN (
  'milk', 'cheese', 'butter', 'cream', 'yogurt',
  'buttermilk', 'clotted_cream', 'condensed_milk', 'evaporated_milk',
  'cottage_cheese', 'double_cream', 'ghee', 'goat_milk', 'margarine',
  'brie', 'camembert', 'edam', 'emmental', 'fontina', 'gorgonzola', 'gouda',
  'gruyere', 'halloumi', 'mascarpone', 'monterey_jack', 'provolone',
  'buffalo_mozzarella'
);

UPDATE public.canonical_ingredients
SET ingredient_family_name = 'eggs'
WHERE canonical_name IN ('eggs', 'quail_eggs', 'egg_yolks');

-- Plant milks
UPDATE public.canonical_ingredients
SET ingredient_family_name = 'plant_milk'
WHERE canonical_name IN ('almond_milk', 'soy_milk', 'oat_milk', 'coconut_milk');

-- Plants
UPDATE public.canonical_ingredients
SET ingredient_family_name = 'vegetable'
WHERE canonical_name IN (
  'tomato','onion','garlic','pepper','carrot','potato','sweet_potato','lettuce','cucumber','spinach',
  'broccoli','mushroom','zucchini','celery','cabbage','kale','asparagus','corn','pumpkin',
  'arugula','artichoke','bamboo_shoots','bok_choy','collard_greens','edamame','fennel','green_beans',
  'radish','shallot','turnip','cassava',
  'brussels_sprouts','beets','chicory','eggplant','endive','green_chili','jalapeno','jicama','leek',
  'parsnip','radicchio','spaghetti_squash','spring_onion','swiss_chard','water_chestnuts','watercress',
  'bean_sprouts','broccoli_rabe','cactus_pads','garlic_scapes','turnip_greens','banana_blossom','banana_leaves'
);

UPDATE public.canonical_ingredients
SET ingredient_family_name = 'fruit'
WHERE canonical_name IN (
  'apple','banana','lemon','lime','orange','strawberry','avocado','mango','pineapple',
  'acai','apricot','dates','pear','plum','papaya','tangerine',
  'blackberries','blueberries','cranberries','figs','grapefruit','grapes','guava',
  'mango_puree','nectarines','passion_fruit','peach','pomegranate','prunes','raspberries','elderflower'
);

-- Grains & starches
UPDATE public.canonical_ingredients
SET ingredient_family_name = 'grain'
WHERE canonical_name IN (
  'rice','pasta','bread','flour','oats','quinoa','tortilla',
  'amaranth','barley','buckwheat','bulgur','farro','millet','sorghum','black_rice','arborio_rice',
  'semolina','wheat_berries','fregola','gnocchi','lasagna_sheets',
  'soba_noodles','ramen_noodles','rice_noodles','egg_noodles','vermicelli',
  'cornmeal','cornstarch','couscous','polenta','bread_crumbs','tortilla_chips','pita_bread','pizza_dough',
  'graham_crackers','shortcrust_pastry'
);

-- Legumes & plant proteins
UPDATE public.canonical_ingredients
SET ingredient_family_name = 'plant_protein'
WHERE canonical_name IN (
  'tofu','tempeh','beans','lentils','chickpeas',
  'adzuki_beans','mung_beans','navy_beans','split_peas','green_peas','snap_peas','snow_peas','frozen_peas','black_eyed_peas'
);

-- Nuts & seeds
UPDATE public.canonical_ingredients
SET ingredient_family_name = 'nut_seed'
WHERE canonical_name IN (
  'almonds','walnuts','peanuts','cashews','sesame','chia','hazelnuts','pecans','pistachios','raisins','peanut_butter',
  'flax_seeds','macadamia_nuts','nigella_seeds','pine_nuts','pumpkin_seeds','sunflower_seeds','chestnuts',
  'almond_paste','almond_butter'
);

-- Spices & herbs
UPDATE public.canonical_ingredients
SET ingredient_family_name = 'spice_herb'
WHERE canonical_name IN (
  'salt','pepper_spice','cumin','paprika','oregano','basil','cilantro','parsley','thyme','rosemary','cinnamon','ginger',
  'anise','bay_leaf','cardamom','caraway','cayenne','chili_flakes','chives','curry_powder','curry_paste','curry_leaves',
  'dill','garlic_powder','lemongrass','mint','nutmeg','onion_powder','saffron','sage','star_anise','tarragon','turmeric',
  'white_pepper','cajun_seasoning','adobo',
  'asafoetida','berbere','biryani_masala','black_cardamom','cloves','coriander_seeds','coriander_ground',
  'fenugreek','garam_masala','juniper_berries','marjoram','mustard_seeds','pink_peppercorns','peppermint'
);

-- Oils & fats
UPDATE public.canonical_ingredients
SET ingredient_family_name = 'oil_fat'
WHERE canonical_name IN (
  'olive_oil','vegetable_oil','sesame_oil','almond_oil','avocado_oil','coconut_oil','corn_oil','peanut_oil','sunflower_oil','walnut_oil'
);

-- Condiments & sauces
UPDATE public.canonical_ingredients
SET ingredient_family_name = 'condiment'
WHERE canonical_name IN (
  'soy_sauce','vinegar','ketchup','mayonnaise','mustard','aioli','capers','caramel',
  'chili_oil','chili_paste','fish_sauce','gochujang','harissa','hummus','kimchi','miso','marinara','salsa','tahini','tamari',
  'tomato_paste','tomato_sauce','date_syrup','maple_syrup','olives','pickles',
  'anchovy_paste','demi_glace','horseradish','hot_sauce','mango_chutney','oyster_sauce','pesto','pumpkin_puree','raspberry_jam',
  'apricot_jam','sriracha','sun_dried_tomatoes','tamarind','tapioca_pearls','tomato_juice','tomato_puree','worcestershire',
  'alfalfa_sprouts','palm_sugar','pickled_ginger','fried_onions'
);

-- Sweeteners
UPDATE public.canonical_ingredients
SET ingredient_family_name = 'sweetener'
WHERE canonical_name IN ('honey','sugar','brown_sugar','agave_nectar','molasses','coconut_sugar','cacao_nibs');

-- Beverages & alcohol
UPDATE public.canonical_ingredients
SET ingredient_family_name = 'beverage'
WHERE canonical_name IN ('water','coffee','tea','apple_juice','carrot_juice','grape_juice','orange_juice','pineapple_juice','soda_water','coconut_water');

UPDATE public.canonical_ingredients
SET ingredient_family_name = 'alcohol'
WHERE canonical_name IN ('wine','bourbon','brandy','irish_whiskey','port_wine','rum','vodka');

-- Baking
UPDATE public.canonical_ingredients
SET ingredient_family_name = 'baking'
WHERE canonical_name IN ('baking_powder','baking_soda','vanilla','chocolate','custard_powder','yeast','skim_milk_powder','agar_agar','gelatin');

-- Finally enforce non-null (everything has at least 'other')
UPDATE public.canonical_ingredients
SET ingredient_family_name = 'other'
WHERE ingredient_family_name IS NULL;

ALTER TABLE public.canonical_ingredients
  ALTER COLUMN ingredient_family_name SET NOT NULL;
