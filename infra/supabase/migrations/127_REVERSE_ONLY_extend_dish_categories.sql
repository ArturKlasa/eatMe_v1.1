-- 127_REVERSE_ONLY_extend_dish_categories.sql
-- Reverse migration for 127_extend_dish_categories.sql
--
-- WARNING: deletes the rows seeded by migration 127. Any dishes that have
-- dish_category_id pointing at a deleted row will get NULL'd out by the
-- ON DELETE behavior on dishes.dish_category_id (default is NO ACTION which
-- would FAIL the delete if any dish references the row).
--
-- If reversing in production, first re-point or NULL any dishes that
-- reference these categories. Or just leave the rows in place — they're
-- additive and harmless.

BEGIN;

DELETE FROM public.dish_categories
WHERE name IN (
  -- Latin American street food
  'Salchipapas', 'Tequeños', 'Patacones', 'Llapingachos', 'Empanadas Chilenas',
  'Picarones', 'Pastel de Choclo', 'Pastel de Papa', 'Choros a la Chalaca',
  'Rocoto Relleno', 'Carapulcra', 'Sopaipillas', 'Marraqueta', 'Cachapas',
  'Hallacas', 'Pabellón Criollo', 'Buñuelos', 'Tres Leches', 'Alfajores',
  'Pernil', 'Mofongo', 'Plantain Chips', 'Maduros con Queso',
  'Anticucho de Corazón', 'Pollo Broaster',
  -- Mexican: tacos by filling
  'Tacos Dorados', 'Tacos al Vapor', 'Tacos Árabes', 'Tacos de Cabeza',
  'Tacos de Lengua', 'Tacos de Tripa', 'Tacos de Suadero', 'Tacos de Buche',
  'Tacos de Canasta', 'Tacos de Pescado', 'Tacos de Camarón',
  -- Mexican: mole
  'Mole Poblano', 'Mole Negro', 'Mole Verde', 'Mole Amarillo',
  'Mole Coloradito', 'Mole Almendrado', 'Pollo en Mole', 'Enmoladas',
  -- Mexican: enchiladas
  'Enchiladas Verdes', 'Enchiladas Rojas', 'Enchiladas Suizas',
  'Enchiladas Mineras', 'Enchiladas Potosinas', 'Entomatadas',
  -- Mexican: soups, stews, pozoles
  'Sopa de Tortilla', 'Sopa Azteca', 'Caldo de Pollo', 'Caldo Tlalpeño',
  'Caldo de Res', 'Menudo', 'Pozole Rojo', 'Pozole Verde', 'Pozole Blanco',
  'Birria de Res', 'Birria de Chivo',
  -- Mexican: meats & antojitos
  'Tinga', 'Tinga de Pollo', 'Lengua', 'Tripas', 'Cabrito',
  'Barbacoa de Borrego', 'Asado de Puerco', 'Pollo Pibil', 'Pambazo',
  'Tlacoyo de Frijol', 'Quesadilla de Huitlacoche',
  'Quesadilla de Flor de Calabaza', 'Chiles en Nogada',
  -- Mexican: tortas
  'Torta Ahogada', 'Torta Cubana', 'Torta de Milanesa', 'Torta de Pierna',
  -- Mexican: seafood
  'Camarones a la Diabla', 'Coctel de Camarón', 'Pescado a la Veracruzana',
  'Cazuela de Mariscos', 'Pescado Zarandeado',
  -- Mexican: salsas, sides, basics
  'Pico de Gallo', 'Salsa Verde', 'Salsa Roja', 'Salsa Macha',
  'Frijoles Refritos', 'Frijoles Charros', 'Frijoles de la Olla',
  'Arroz a la Mexicana', 'Arroz Rojo', 'Arroz Verde', 'Nopales',
  -- Mexican: sweet breads & desserts
  'Conchas', 'Pan Dulce', 'Polvorones', 'Marranitos', 'Capirotada',
  'Flan Mexicano', 'Tres Leches Mexicano',
  -- Mexican: drinks
  'Agua de Jamaica', 'Agua de Tamarindo', 'Agua de Sandía', 'Pulque',
  'Cantarito', 'Mexican Hot Chocolate',
  -- Asian street food
  'Xiaolongbao', 'Jianbing', 'Roti Canai', 'Murtabak', 'Korean Corn Dog',
  'Hotteok', 'Bingsu', 'Tsukemen', 'Onigirazu', 'Yakitori', 'Yakisoba',
  'Cao Lau', 'Mì Quảng', 'Bánh Xèo', 'Chai Tow Kway', 'Char Kway Teow',
  'Hokkien Mee',
  -- Modern fast-casual
  'Loaded Fries', 'Cheese Curds', 'Chicken Sandwich', 'Crispy Chicken Sandwich',
  'Chicken Nuggets', 'Chicken Strips', 'Hush Puppies', 'Jalapeño Poppers',
  'Tater Tots', 'Cauliflower Wings', 'Smash Tacos', 'Birria Tacos',
  'Quesabirria', 'Smoked Brisket', 'Burnt Ends',
  -- Middle Eastern
  'Mansaf', 'Maqluba', 'Sabich', 'Mezze Plate', 'Sfiha', 'Lahmacun', 'Pide',
  'Adana Kebab', 'Iskender Kebab', 'Mantı', 'Kibbeh Nayyeh',
  -- Eastern European / Balkan / Caucasus
  'Ćevapi', 'Burek', 'Sarma', 'Mititei', 'Mămăligă', 'Lobio', 'Plov', 'Khash',
  'Sármale', 'Ajvar', 'Pljeskavica',
  -- African
  'Jollof Rice', 'Kelewele', 'Waakye', 'Ful Medames', 'Kushari', 'Brik',
  'Pastilla', 'Yassa Chicken',
  -- Caribbean
  'Doubles', 'Curry Goat', 'Oxtail Stew', 'Ackee and Saltfish',
  'Saltfish Fritters', 'Roti Wrap',
  -- Vegetarian / vegan
  'Buddha Bowl', 'Macro Bowl', 'Vegan Burger', 'Beyond Burger',
  'Impossible Burger', 'Jackfruit Tacos', 'Tofu Scramble', 'Tempeh Bowl',
  'Chickpea Curry', 'Vegan Bowl',
  -- Drinks: Coffee
  'Espresso', 'Doppio', 'Macchiato', 'Cortado', 'Cappuccino', 'Latte',
  'Flat White', 'Americano', 'Mocha', 'Affogato', 'Cold Brew', 'Iced Coffee',
  'Iced Latte', 'Frappé', 'Café au Lait', 'Café con Leche', 'Turkish Coffee',
  'Vietnamese Iced Coffee',
  -- Drinks: Tea
  'Black Tea', 'Green Tea', 'White Tea', 'Oolong Tea', 'Herbal Tea',
  'Chamomile Tea', 'Mint Tea', 'Chai', 'Chai Latte', 'Matcha', 'Matcha Latte',
  'Bubble Tea', 'Iced Tea', 'Thai Iced Tea', 'Yerba Mate',
  -- Drinks: Cocktails
  'Margarita', 'Mojito', 'Caipirinha', 'Pisco Sour', 'Daiquiri', 'Negroni',
  'Old Fashioned', 'Manhattan', 'Martini', 'Bloody Mary', 'Whiskey Sour',
  'Aperol Spritz', 'Sangria', 'Mai Tai', 'Piña Colada', 'Cosmopolitan',
  'Espresso Martini', 'Long Island Iced Tea', 'Moscow Mule', 'Gin and Tonic',
  'Aviation', 'Paloma', 'Michelada',
  -- Drinks: Wine
  'Red Wine', 'White Wine', 'Rosé', 'Sparkling Wine', 'Champagne', 'Prosecco',
  'Cava', 'Mulled Wine', 'Vermouth',
  -- Drinks: Beer
  'IPA', 'Lager', 'Stout', 'Pilsner', 'Wheat Beer', 'Pale Ale', 'Porter',
  'Hefeweizen', 'Sour Beer', 'Saison',
  -- Drinks: Spirits
  'Whiskey', 'Vodka', 'Gin', 'Rum', 'Tequila', 'Mezcal', 'Pisco', 'Cognac',
  'Aquavit',
  -- Drinks: Non-alcoholic
  'Lemonade', 'Horchata', 'Aguas Frescas', 'Tepache', 'Atole', 'Champurrado',
  'Kombucha', 'Soda', 'Sparkling Water', 'Fresh Juice', 'Orange Juice',
  'Apple Juice', 'Smoothie', 'Milkshake', 'Hot Chocolate', 'Mocktail'
);

COMMIT;
