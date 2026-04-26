-- 127_extend_dish_categories.sql
-- Created: 2026-04-25
--
-- Extends the seeded dish_categories taxonomy (~800 baseline rows from
-- migration 112) with categories that the menu-scan worker has been emitting
-- but couldn't fuzzy-match. Two big buckets:
--
--   1. Food gaps — Latin American street food (Salchipapas, Tequeños,
--      Patacones, Llapingachos, Picarones, etc.), Mexican depth (taco
--      variants by filling, mole varieties, enchilada styles, soups,
--      antojitos, sweet breads, salsas/sides), modern fast-casual
--      (Chicken Sandwich, Loaded Fries, Cauliflower Wings), Balkan/Caucasus
--      (Cevapi, Burek, Khash, Lobio), African (Jollof Rice, Kelewele),
--      Caribbean (Doubles, Curry Goat), and a few Asian street items
--      (Xiaolongbao, Korean Corn Dog, Hotteok, Bingsu, Yakitori).
--
--   2. Drinks — the baseline seed had no drink coverage at all, so the
--      generate_candidates RPC's `dc.is_drink = false` filter never triggered
--      for scanned drinks. This adds full drink coverage (coffee, tea,
--      cocktails, wine, beer, spirits, non-alcoholic) with is_drink=true so
--      they get correctly excluded from the food feed.
--
-- ON CONFLICT (name) DO NOTHING — safe to re-run, never overwrites an
-- admin-edited row.
--
-- Reverse: 127_REVERSE_ONLY_extend_dish_categories.sql

BEGIN;

INSERT INTO public.dish_categories (name, is_drink, is_active) VALUES
  -- ── Latin American street food / regional specifics ─────────────────────
  ('Salchipapas', false, true),
  ('Tequeños', false, true),
  ('Patacones', false, true),
  ('Llapingachos', false, true),
  ('Empanadas Chilenas', false, true),
  ('Picarones', false, true),
  ('Pastel de Choclo', false, true),
  ('Pastel de Papa', false, true),
  ('Choros a la Chalaca', false, true),
  ('Rocoto Relleno', false, true),
  ('Carapulcra', false, true),
  ('Sopaipillas', false, true),
  ('Marraqueta', false, true),
  ('Cachapas', false, true),
  ('Hallacas', false, true),
  ('Pabellón Criollo', false, true),
  ('Buñuelos', false, true),
  ('Tres Leches', false, true),
  ('Alfajores', false, true),
  ('Pernil', false, true),
  ('Mofongo', false, true),
  ('Plantain Chips', false, true),
  ('Maduros con Queso', false, true),
  ('Anticucho de Corazón', false, true),
  ('Pollo Broaster', false, true),

  -- ── Mexican depth: taco variants by filling/style ───────────────────────
  ('Tacos Dorados', false, true),
  ('Tacos al Vapor', false, true),
  ('Tacos Árabes', false, true),
  ('Tacos de Cabeza', false, true),
  ('Tacos de Lengua', false, true),
  ('Tacos de Tripa', false, true),
  ('Tacos de Suadero', false, true),
  ('Tacos de Buche', false, true),
  ('Tacos de Canasta', false, true),
  ('Tacos de Pescado', false, true),
  ('Tacos de Camarón', false, true),

  -- ── Mexican depth: mole varieties ───────────────────────────────────────
  ('Mole Poblano', false, true),
  ('Mole Negro', false, true),
  ('Mole Verde', false, true),
  ('Mole Amarillo', false, true),
  ('Mole Coloradito', false, true),
  ('Mole Almendrado', false, true),
  ('Pollo en Mole', false, true),
  ('Enmoladas', false, true),

  -- ── Mexican depth: enchilada styles ─────────────────────────────────────
  ('Enchiladas Verdes', false, true),
  ('Enchiladas Rojas', false, true),
  ('Enchiladas Suizas', false, true),
  ('Enchiladas Mineras', false, true),
  ('Enchiladas Potosinas', false, true),
  ('Entomatadas', false, true),

  -- ── Mexican depth: soups, stews, pozoles ────────────────────────────────
  ('Sopa de Tortilla', false, true),
  ('Sopa Azteca', false, true),
  ('Caldo de Pollo', false, true),
  ('Caldo Tlalpeño', false, true),
  ('Caldo de Res', false, true),
  ('Menudo', false, true),
  ('Pozole Rojo', false, true),
  ('Pozole Verde', false, true),
  ('Pozole Blanco', false, true),
  ('Birria de Res', false, true),
  ('Birria de Chivo', false, true),

  -- ── Mexican depth: meats & antojitos ────────────────────────────────────
  ('Tinga', false, true),
  ('Tinga de Pollo', false, true),
  ('Lengua', false, true),
  ('Tripas', false, true),
  ('Cabrito', false, true),
  ('Barbacoa de Borrego', false, true),
  ('Asado de Puerco', false, true),
  ('Pollo Pibil', false, true),
  ('Pambazo', false, true),
  ('Tlacoyo de Frijol', false, true),
  ('Quesadilla de Huitlacoche', false, true),
  ('Quesadilla de Flor de Calabaza', false, true),
  ('Chiles en Nogada', false, true),

  -- ── Mexican depth: tortas ───────────────────────────────────────────────
  ('Torta Ahogada', false, true),
  ('Torta Cubana', false, true),
  ('Torta de Milanesa', false, true),
  ('Torta de Pierna', false, true),

  -- ── Mexican depth: seafood ──────────────────────────────────────────────
  ('Camarones a la Diabla', false, true),
  ('Coctel de Camarón', false, true),
  ('Pescado a la Veracruzana', false, true),
  ('Cazuela de Mariscos', false, true),
  ('Pescado Zarandeado', false, true),

  -- ── Mexican depth: salsas, sides, basics ────────────────────────────────
  ('Pico de Gallo', false, true),
  ('Salsa Verde', false, true),
  ('Salsa Roja', false, true),
  ('Salsa Macha', false, true),
  ('Frijoles Refritos', false, true),
  ('Frijoles Charros', false, true),
  ('Frijoles de la Olla', false, true),
  ('Arroz a la Mexicana', false, true),
  ('Arroz Rojo', false, true),
  ('Arroz Verde', false, true),
  ('Nopales', false, true),

  -- ── Mexican depth: sweet breads & desserts ──────────────────────────────
  ('Conchas', false, true),
  ('Pan Dulce', false, true),
  ('Polvorones', false, true),
  ('Marranitos', false, true),
  ('Capirotada', false, true),
  ('Flan Mexicano', false, true),
  ('Tres Leches Mexicano', false, true),

  -- ── Mexican depth: drinks (is_drink = true) ─────────────────────────────
  ('Agua de Jamaica', true, true),
  ('Agua de Tamarindo', true, true),
  ('Agua de Sandía', true, true),
  ('Pulque', true, true),
  ('Cantarito', true, true),
  ('Mexican Hot Chocolate', true, true),

  -- ── Asian street food / regional specifics ──────────────────────────────
  ('Xiaolongbao', false, true),
  ('Jianbing', false, true),
  ('Roti Canai', false, true),
  ('Murtabak', false, true),
  ('Korean Corn Dog', false, true),
  ('Hotteok', false, true),
  ('Bingsu', false, true),
  ('Tsukemen', false, true),
  ('Onigirazu', false, true),
  ('Yakitori', false, true),
  ('Yakisoba', false, true),
  ('Cao Lau', false, true),
  ('Mì Quảng', false, true),
  ('Bánh Xèo', false, true),
  ('Chai Tow Kway', false, true),
  ('Char Kway Teow', false, true),
  ('Hokkien Mee', false, true),

  -- ── Modern fast-casual / American casual ────────────────────────────────
  ('Loaded Fries', false, true),
  ('Cheese Curds', false, true),
  ('Chicken Sandwich', false, true),
  ('Crispy Chicken Sandwich', false, true),
  ('Chicken Nuggets', false, true),
  ('Chicken Strips', false, true),
  ('Hush Puppies', false, true),
  ('Jalapeño Poppers', false, true),
  ('Tater Tots', false, true),
  ('Cauliflower Wings', false, true),
  ('Smash Tacos', false, true),
  ('Birria Tacos', false, true),
  ('Quesabirria', false, true),
  ('Smoked Brisket', false, true),
  ('Burnt Ends', false, true),

  -- ── Middle Eastern depth ────────────────────────────────────────────────
  ('Mansaf', false, true),
  ('Maqluba', false, true),
  ('Sabich', false, true),
  ('Mezze Plate', false, true),
  ('Sfiha', false, true),
  ('Lahmacun', false, true),
  ('Pide', false, true),
  ('Adana Kebab', false, true),
  ('Iskender Kebab', false, true),
  ('Mantı', false, true),
  ('Kibbeh Nayyeh', false, true),

  -- ── Eastern European / Balkan / Caucasus ────────────────────────────────
  ('Ćevapi', false, true),
  ('Burek', false, true),
  ('Sarma', false, true),
  ('Mititei', false, true),
  ('Mămăligă', false, true),
  ('Lobio', false, true),
  ('Plov', false, true),
  ('Khash', false, true),
  ('Sármale', false, true),
  ('Ajvar', false, true),
  ('Pljeskavica', false, true),

  -- ── African gaps ────────────────────────────────────────────────────────
  ('Jollof Rice', false, true),
  ('Kelewele', false, true),
  ('Waakye', false, true),
  ('Ful Medames', false, true),
  ('Kushari', false, true),
  ('Brik', false, true),
  ('Pastilla', false, true),
  ('Yassa Chicken', false, true),

  -- ── Caribbean gaps ──────────────────────────────────────────────────────
  ('Doubles', false, true),
  ('Curry Goat', false, true),
  ('Oxtail Stew', false, true),
  ('Ackee and Saltfish', false, true),
  ('Saltfish Fritters', false, true),
  ('Roti Wrap', false, true),

  -- ── Vegetarian / vegan specifics ────────────────────────────────────────
  ('Buddha Bowl', false, true),
  ('Macro Bowl', false, true),
  ('Vegan Burger', false, true),
  ('Beyond Burger', false, true),
  ('Impossible Burger', false, true),
  ('Jackfruit Tacos', false, true),
  ('Tofu Scramble', false, true),
  ('Tempeh Bowl', false, true),
  ('Chickpea Curry', false, true),
  ('Vegan Bowl', false, true),

  -- ── Drinks: Coffee ──────────────────────────────────────────────────────
  ('Espresso', true, true),
  ('Doppio', true, true),
  ('Macchiato', true, true),
  ('Cortado', true, true),
  ('Cappuccino', true, true),
  ('Latte', true, true),
  ('Flat White', true, true),
  ('Americano', true, true),
  ('Mocha', true, true),
  ('Affogato', true, true),
  ('Cold Brew', true, true),
  ('Iced Coffee', true, true),
  ('Iced Latte', true, true),
  ('Frappé', true, true),
  ('Café au Lait', true, true),
  ('Café con Leche', true, true),
  ('Turkish Coffee', true, true),
  ('Vietnamese Iced Coffee', true, true),

  -- ── Drinks: Tea ─────────────────────────────────────────────────────────
  ('Black Tea', true, true),
  ('Green Tea', true, true),
  ('White Tea', true, true),
  ('Oolong Tea', true, true),
  ('Herbal Tea', true, true),
  ('Chamomile Tea', true, true),
  ('Mint Tea', true, true),
  ('Chai', true, true),
  ('Chai Latte', true, true),
  ('Matcha', true, true),
  ('Matcha Latte', true, true),
  ('Bubble Tea', true, true),
  ('Iced Tea', true, true),
  ('Thai Iced Tea', true, true),
  ('Yerba Mate', true, true),

  -- ── Drinks: Cocktails ───────────────────────────────────────────────────
  ('Margarita', true, true),
  ('Mojito', true, true),
  ('Caipirinha', true, true),
  ('Pisco Sour', true, true),
  ('Daiquiri', true, true),
  ('Negroni', true, true),
  ('Old Fashioned', true, true),
  ('Manhattan', true, true),
  ('Martini', true, true),
  ('Bloody Mary', true, true),
  ('Whiskey Sour', true, true),
  ('Aperol Spritz', true, true),
  ('Sangria', true, true),
  ('Mai Tai', true, true),
  ('Piña Colada', true, true),
  ('Cosmopolitan', true, true),
  ('Espresso Martini', true, true),
  ('Long Island Iced Tea', true, true),
  ('Moscow Mule', true, true),
  ('Gin and Tonic', true, true),
  ('Aviation', true, true),
  ('Paloma', true, true),
  ('Michelada', true, true),

  -- ── Drinks: Wine ────────────────────────────────────────────────────────
  ('Red Wine', true, true),
  ('White Wine', true, true),
  ('Rosé', true, true),
  ('Sparkling Wine', true, true),
  ('Champagne', true, true),
  ('Prosecco', true, true),
  ('Cava', true, true),
  ('Mulled Wine', true, true),
  ('Vermouth', true, true),

  -- ── Drinks: Beer ────────────────────────────────────────────────────────
  ('IPA', true, true),
  ('Lager', true, true),
  ('Stout', true, true),
  ('Pilsner', true, true),
  ('Wheat Beer', true, true),
  ('Pale Ale', true, true),
  ('Porter', true, true),
  ('Hefeweizen', true, true),
  ('Sour Beer', true, true),
  ('Saison', true, true),

  -- ── Drinks: Spirits / shots ─────────────────────────────────────────────
  ('Whiskey', true, true),
  ('Vodka', true, true),
  ('Gin', true, true),
  ('Rum', true, true),
  ('Tequila', true, true),
  ('Mezcal', true, true),
  ('Pisco', true, true),
  ('Cognac', true, true),
  ('Aquavit', true, true),

  -- ── Drinks: Non-alcoholic / soft ────────────────────────────────────────
  ('Lemonade', true, true),
  ('Horchata', true, true),
  ('Aguas Frescas', true, true),
  ('Tepache', true, true),
  ('Atole', true, true),
  ('Champurrado', true, true),
  ('Kombucha', true, true),
  ('Soda', true, true),
  ('Sparkling Water', true, true),
  ('Fresh Juice', true, true),
  ('Orange Juice', true, true),
  ('Apple Juice', true, true),
  ('Smoothie', true, true),
  ('Milkshake', true, true),
  ('Hot Chocolate', true, true),
  ('Mocktail', true, true)
ON CONFLICT (name) DO NOTHING;

COMMIT;
