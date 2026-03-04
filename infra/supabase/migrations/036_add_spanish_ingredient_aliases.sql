-- Spanish (es-MX) aliases for all existing canonical ingredients
-- Covers Mexican-Spanish names used on restaurant menus in Mexico.
-- Each canonical is looked up by canonical_name; if it exists, aliases are inserted.
-- ON CONFLICT ... DO NOTHING makes this safe to re-run.

DO $$
DECLARE v UUID;
BEGIN

-- ============================================================
-- DAIRY (Lácteos)
-- ============================================================
SELECT id INTO v FROM canonical_ingredients WHERE canonical_name = 'milk';
IF v IS NOT NULL THEN INSERT INTO ingredient_aliases (display_name, language, canonical_ingredient_id) VALUES
  ('Leche', 'es', v), ('Leche entera', 'es', v), ('Leche descremada', 'es', v),
  ('Leche semidescremada', 'es', v), ('Leche evaporada', 'es', v),
  ('Leche condensada', 'es', v), ('Leche en polvo', 'es', v)
  ON CONFLICT (display_name) DO NOTHING; END IF;

SELECT id INTO v FROM canonical_ingredients WHERE canonical_name = 'almond_milk';
IF v IS NOT NULL THEN INSERT INTO ingredient_aliases (display_name, language, canonical_ingredient_id) VALUES
  ('Leche de almendra', 'es', v), ('Bebida de almendra', 'es', v)
  ON CONFLICT (display_name) DO NOTHING; END IF;

SELECT id INTO v FROM canonical_ingredients WHERE canonical_name = 'oat_milk';
IF v IS NOT NULL THEN INSERT INTO ingredient_aliases (display_name, language, canonical_ingredient_id) VALUES
  ('Leche de avena', 'es', v), ('Avena líquida', 'es', v), ('Bebida de avena', 'es', v)
  ON CONFLICT (display_name) DO NOTHING; END IF;

SELECT id INTO v FROM canonical_ingredients WHERE canonical_name = 'soy_milk';
IF v IS NOT NULL THEN INSERT INTO ingredient_aliases (display_name, language, canonical_ingredient_id) VALUES
  ('Leche de soya', 'es', v), ('Leche de soja', 'es', v), ('Bebida de soya', 'es', v)
  ON CONFLICT (display_name) DO NOTHING; END IF;

SELECT id INTO v FROM canonical_ingredients WHERE canonical_name = 'coconut_milk';
IF v IS NOT NULL THEN INSERT INTO ingredient_aliases (display_name, language, canonical_ingredient_id) VALUES
  ('Leche de coco', 'es', v), ('Crema de coco', 'es', v), ('Agua de coco', 'es', v)
  ON CONFLICT (display_name) DO NOTHING; END IF;

SELECT id INTO v FROM canonical_ingredients WHERE canonical_name = 'cheese';
IF v IS NOT NULL THEN INSERT INTO ingredient_aliases (display_name, language, canonical_ingredient_id) VALUES
  ('Queso', 'es', v), ('Queso amarillo', 'es', v), ('Queso blanco', 'es', v),
  ('Queso fresco', 'es', v), ('Queso Oaxaca', 'es', v), ('Queso Cotija', 'es', v),
  ('Queso panela', 'es', v), ('Queso manchego', 'es', v), ('Queso chihuahua', 'es', v),
  ('Queso añejo', 'es', v), ('Queso asadero', 'es', v), ('Queso fundido', 'es', v),
  ('Queso crema', 'es', v), ('Queso de cabra', 'es', v), ('Requesón', 'es', v)
  ON CONFLICT (display_name) DO NOTHING; END IF;

SELECT id INTO v FROM canonical_ingredients WHERE canonical_name = 'butter';
IF v IS NOT NULL THEN INSERT INTO ingredient_aliases (display_name, language, canonical_ingredient_id) VALUES
  ('Mantequilla', 'es', v), ('Mantequilla sin sal', 'es', v), ('Mantequilla salada', 'es', v),
  ('Mantequilla derretida', 'es', v), ('Manteca de vaca', 'es', v)
  ON CONFLICT (display_name) DO NOTHING; END IF;

SELECT id INTO v FROM canonical_ingredients WHERE canonical_name = 'cream';
IF v IS NOT NULL THEN INSERT INTO ingredient_aliases (display_name, language, canonical_ingredient_id) VALUES
  ('Crema', 'es', v), ('Crema mexicana', 'es', v), ('Crema ácida', 'es', v),
  ('Crema para batir', 'es', v), ('Crema líquida', 'es', v), ('Nata', 'es', v)
  ON CONFLICT (display_name) DO NOTHING; END IF;

SELECT id INTO v FROM canonical_ingredients WHERE canonical_name = 'yogurt';
IF v IS NOT NULL THEN INSERT INTO ingredient_aliases (display_name, language, canonical_ingredient_id) VALUES
  ('Yogur', 'es', v), ('Yogurt', 'es', v), ('Yogur natural', 'es', v),
  ('Yogur griego', 'es', v), ('Yogurt griego', 'es', v)
  ON CONFLICT (display_name) DO NOTHING; END IF;

-- ============================================================
-- SEAFOOD (Mariscos / Pescados)
-- ============================================================
SELECT id INTO v FROM canonical_ingredients WHERE canonical_name = 'salmon';
IF v IS NOT NULL THEN INSERT INTO ingredient_aliases (display_name, language, canonical_ingredient_id) VALUES
  ('Salmón', 'es', v), ('Filete de salmón', 'es', v), ('Salmón ahumado', 'es', v),
  ('Salmón rosado', 'es', v)
  ON CONFLICT (display_name) DO NOTHING; END IF;

SELECT id INTO v FROM canonical_ingredients WHERE canonical_name = 'tuna';
IF v IS NOT NULL THEN INSERT INTO ingredient_aliases (display_name, language, canonical_ingredient_id) VALUES
  ('Atún', 'es', v), ('Atún en lata', 'es', v), ('Atún fresco', 'es', v),
  ('Filete de atún', 'es', v), ('Atún en agua', 'es', v), ('Atún en aceite', 'es', v)
  ON CONFLICT (display_name) DO NOTHING; END IF;

SELECT id INTO v FROM canonical_ingredients WHERE canonical_name = 'cod';
IF v IS NOT NULL THEN INSERT INTO ingredient_aliases (display_name, language, canonical_ingredient_id) VALUES
  ('Bacalao', 'es', v), ('Bacalao seco', 'es', v), ('Bacalao salado', 'es', v)
  ON CONFLICT (display_name) DO NOTHING; END IF;

SELECT id INTO v FROM canonical_ingredients WHERE canonical_name = 'shrimp';
IF v IS NOT NULL THEN INSERT INTO ingredient_aliases (display_name, language, canonical_ingredient_id) VALUES
  ('Camarón', 'es', v), ('Camarones', 'es', v), ('Gambas', 'es', v),
  ('Langostino', 'es', v), ('Camarones pelados', 'es', v), ('Camarón cocido', 'es', v),
  ('Camarón jumbo', 'es', v), ('Camarón mediano', 'es', v)
  ON CONFLICT (display_name) DO NOTHING; END IF;

SELECT id INTO v FROM canonical_ingredients WHERE canonical_name = 'prawns';
IF v IS NOT NULL THEN INSERT INTO ingredient_aliases (display_name, language, canonical_ingredient_id) VALUES
  ('Langostinos', 'es', v), ('Camarones grandes', 'es', v)
  ON CONFLICT (display_name) DO NOTHING; END IF;

SELECT id INTO v FROM canonical_ingredients WHERE canonical_name = 'crab';
IF v IS NOT NULL THEN INSERT INTO ingredient_aliases (display_name, language, canonical_ingredient_id) VALUES
  ('Cangrejo', 'es', v), ('Jaiba', 'es', v), ('Carne de cangrejo', 'es', v),
  ('Jaiba desmenuzada', 'es', v)
  ON CONFLICT (display_name) DO NOTHING; END IF;

SELECT id INTO v FROM canonical_ingredients WHERE canonical_name = 'lobster';
IF v IS NOT NULL THEN INSERT INTO ingredient_aliases (display_name, language, canonical_ingredient_id) VALUES
  ('Langosta', 'es', v), ('Cola de langosta', 'es', v)
  ON CONFLICT (display_name) DO NOTHING; END IF;

SELECT id INTO v FROM canonical_ingredients WHERE canonical_name = 'octopus';
IF v IS NOT NULL THEN INSERT INTO ingredient_aliases (display_name, language, canonical_ingredient_id) VALUES
  ('Pulpo', 'es', v), ('Pulpo al olivo', 'es', v), ('Pulpo cocido', 'es', v)
  ON CONFLICT (display_name) DO NOTHING; END IF;

SELECT id INTO v FROM canonical_ingredients WHERE canonical_name = 'squid';
IF v IS NOT NULL THEN INSERT INTO ingredient_aliases (display_name, language, canonical_ingredient_id) VALUES
  ('Calamar', 'es', v), ('Calamares', 'es', v), ('Anillos de calamar', 'es', v)
  ON CONFLICT (display_name) DO NOTHING; END IF;

SELECT id INTO v FROM canonical_ingredients WHERE canonical_name = 'calamari';
IF v IS NOT NULL THEN INSERT INTO ingredient_aliases (display_name, language, canonical_ingredient_id) VALUES
  ('Calamar frito', 'es', v)
  ON CONFLICT (display_name) DO NOTHING; END IF;

SELECT id INTO v FROM canonical_ingredients WHERE canonical_name = 'anchovies';
IF v IS NOT NULL THEN INSERT INTO ingredient_aliases (display_name, language, canonical_ingredient_id) VALUES
  ('Anchoas', 'es', v), ('Boquerones', 'es', v), ('Anchoas en aceite', 'es', v)
  ON CONFLICT (display_name) DO NOTHING; END IF;

SELECT id INTO v FROM canonical_ingredients WHERE canonical_name = 'clams';
IF v IS NOT NULL THEN INSERT INTO ingredient_aliases (display_name, language, canonical_ingredient_id) VALUES
  ('Almejas', 'es', v), ('Almeja', 'es', v), ('Callo de hacha', 'es', v)
  ON CONFLICT (display_name) DO NOTHING; END IF;

SELECT id INTO v FROM canonical_ingredients WHERE canonical_name = 'mussels';
IF v IS NOT NULL THEN INSERT INTO ingredient_aliases (display_name, language, canonical_ingredient_id) VALUES
  ('Mejillones', 'es', v), ('Mejillón', 'es', v), ('Cholgas', 'es', v)
  ON CONFLICT (display_name) DO NOTHING; END IF;

SELECT id INTO v FROM canonical_ingredients WHERE canonical_name = 'scallops';
IF v IS NOT NULL THEN INSERT INTO ingredient_aliases (display_name, language, canonical_ingredient_id) VALUES
  ('Vieiras', 'es', v), ('Callos de hacha', 'es', v), ('Veneras', 'es', v)
  ON CONFLICT (display_name) DO NOTHING; END IF;

SELECT id INTO v FROM canonical_ingredients WHERE canonical_name = 'trout';
IF v IS NOT NULL THEN INSERT INTO ingredient_aliases (display_name, language, canonical_ingredient_id) VALUES
  ('Trucha', 'es', v), ('Filete de trucha', 'es', v)
  ON CONFLICT (display_name) DO NOTHING; END IF;

SELECT id INTO v FROM canonical_ingredients WHERE canonical_name = 'sardines';
IF v IS NOT NULL THEN INSERT INTO ingredient_aliases (display_name, language, canonical_ingredient_id) VALUES
  ('Sardinas', 'es', v), ('Sardinas en lata', 'es', v), ('Sardina', 'es', v)
  ON CONFLICT (display_name) DO NOTHING; END IF;

SELECT id INTO v FROM canonical_ingredients WHERE canonical_name = 'haddock';
IF v IS NOT NULL THEN INSERT INTO ingredient_aliases (display_name, language, canonical_ingredient_id) VALUES
  ('Abadejo', 'es', v), ('Eglefino', 'es', v)
  ON CONFLICT (display_name) DO NOTHING; END IF;

SELECT id INTO v FROM canonical_ingredients WHERE canonical_name = 'halibut';
IF v IS NOT NULL THEN INSERT INTO ingredient_aliases (display_name, language, canonical_ingredient_id) VALUES
  ('Hipogloso', 'es', v), ('Fletán', 'es', v)
  ON CONFLICT (display_name) DO NOTHING; END IF;

SELECT id INTO v FROM canonical_ingredients WHERE canonical_name = 'abalone';
IF v IS NOT NULL THEN INSERT INTO ingredient_aliases (display_name, language, canonical_ingredient_id) VALUES
  ('Abulón', 'es', v)
  ON CONFLICT (display_name) DO NOTHING; END IF;

SELECT id INTO v FROM canonical_ingredients WHERE canonical_name = 'crawfish';
IF v IS NOT NULL THEN INSERT INTO ingredient_aliases (display_name, language, canonical_ingredient_id) VALUES
  ('Langostino de río', 'es', v), ('Cangrejo de río', 'es', v)
  ON CONFLICT (display_name) DO NOTHING; END IF;

-- ============================================================
-- MEAT (Carnes rojas / Embutidos)
-- ============================================================
SELECT id INTO v FROM canonical_ingredients WHERE canonical_name = 'beef';
IF v IS NOT NULL THEN INSERT INTO ingredient_aliases (display_name, language, canonical_ingredient_id) VALUES
  ('Res', 'es', v), ('Carne de res', 'es', v), ('Carne molida', 'es', v),
  ('Carne molida de res', 'es', v), ('Filete de res', 'es', v),
  ('Arrachera', 'es', v), ('Falda de res', 'es', v), ('Costilla de res', 'es', v),
  ('Chamorro de res', 'es', v), ('Lomo de res', 'es', v), ('Brisket', 'es', v),
  ('Aguayón', 'es', v), ('Rib eye', 'es', v), ('T-bone', 'es', v),
  ('Bistec de res', 'es', v), ('Retazo de res', 'es', v), ('Carne asada', 'es', v),
  ('Barbacoa de res', 'es', v), ('Lengua de res', 'es', v), ('Tripa', 'es', v),
  ('Birria', 'es', v), ('Birria de res', 'es', v), ('Suadero', 'es', v),
  ('Milanesa', 'es', v), ('Milanesa de res', 'es', v)
  ON CONFLICT (display_name) DO NOTHING; END IF;

SELECT id INTO v FROM canonical_ingredients WHERE canonical_name = 'pork';
IF v IS NOT NULL THEN INSERT INTO ingredient_aliases (display_name, language, canonical_ingredient_id) VALUES
  ('Cerdo', 'es', v), ('Puerco', 'es', v), ('Carne de cerdo', 'es', v),
  ('Carnitas', 'es', v), ('Lomo de cerdo', 'es', v), ('Costilla de cerdo', 'es', v),
  ('Chuleta de cerdo', 'es', v), ('Pierna de cerdo', 'es', v),
  ('Cochinita pibil', 'es', v), ('Chicharrón', 'es', v), ('Panceta', 'es', v),
  ('Chorizo', 'es', v), ('Chorizo mexicano', 'es', v), ('Longaniza', 'es', v),
  ('Al pastor', 'es', v), ('Trompo', 'es', v), ('Manitas de cerdo', 'es', v),
  ('Cabeza de cerdo', 'es', v), ('Codillo de cerdo', 'es', v)
  ON CONFLICT (display_name) DO NOTHING; END IF;

SELECT id INTO v FROM canonical_ingredients WHERE canonical_name = 'lamb';
IF v IS NOT NULL THEN INSERT INTO ingredient_aliases (display_name, language, canonical_ingredient_id) VALUES
  ('Cordero', 'es', v), ('Borrego', 'es', v), ('Carne de cordero', 'es', v),
  ('Pierna de cordero', 'es', v), ('Costilla de cordero', 'es', v),
  ('Barbacoa de borrego', 'es', v), ('Birria de borrego', 'es', v)
  ON CONFLICT (display_name) DO NOTHING; END IF;

SELECT id INTO v FROM canonical_ingredients WHERE canonical_name = 'bacon';
IF v IS NOT NULL THEN INSERT INTO ingredient_aliases (display_name, language, canonical_ingredient_id) VALUES
  ('Tocino', 'es', v), ('Tocineta', 'es', v), ('Tocino ahumado', 'es', v)
  ON CONFLICT (display_name) DO NOTHING; END IF;

SELECT id INTO v FROM canonical_ingredients WHERE canonical_name = 'ham';
IF v IS NOT NULL THEN INSERT INTO ingredient_aliases (display_name, language, canonical_ingredient_id) VALUES
  ('Jamón', 'es', v), ('Jamón cocido', 'es', v), ('Jamón serrano', 'es', v),
  ('Jamón de pierna', 'es', v), ('Jamón ahumado', 'es', v)
  ON CONFLICT (display_name) DO NOTHING; END IF;

SELECT id INTO v FROM canonical_ingredients WHERE canonical_name = 'duck';
IF v IS NOT NULL THEN INSERT INTO ingredient_aliases (display_name, language, canonical_ingredient_id) VALUES
  ('Pato', 'es', v), ('Pechuga de pato', 'es', v), ('Confit de pato', 'es', v),
  ('Pierna de pato', 'es', v)
  ON CONFLICT (display_name) DO NOTHING; END IF;

SELECT id INTO v FROM canonical_ingredients WHERE canonical_name = 'oxtail';
IF v IS NOT NULL THEN INSERT INTO ingredient_aliases (display_name, language, canonical_ingredient_id) VALUES
  ('Cola de res', 'es', v), ('Rabo de toro', 'es', v), ('Cola de buey', 'es', v)
  ON CONFLICT (display_name) DO NOTHING; END IF;

SELECT id INTO v FROM canonical_ingredients WHERE canonical_name = 'prosciutto';
IF v IS NOT NULL THEN INSERT INTO ingredient_aliases (display_name, language, canonical_ingredient_id) VALUES
  ('Jamón prosciutto', 'es', v), ('Jamón crudo', 'es', v)
  ON CONFLICT (display_name) DO NOTHING; END IF;

SELECT id INTO v FROM canonical_ingredients WHERE canonical_name = 'sausage';
IF v IS NOT NULL THEN INSERT INTO ingredient_aliases (display_name, language, canonical_ingredient_id) VALUES
  ('Salchicha', 'es', v), ('Salchichón', 'es', v), ('Salchicha Frankfurt', 'es', v),
  ('Salchicha ahumada', 'es', v), ('Mortadela', 'es', v), ('Embutido', 'es', v)
  ON CONFLICT (display_name) DO NOTHING; END IF;

SELECT id INTO v FROM canonical_ingredients WHERE canonical_name = 'pepperoni';
IF v IS NOT NULL THEN INSERT INTO ingredient_aliases (display_name, language, canonical_ingredient_id) VALUES
  ('Pepperoni', 'es', v), ('Salami picante', 'es', v)
  ON CONFLICT (display_name) DO NOTHING; END IF;

-- ============================================================
-- POULTRY / EGGS (Aves / Huevos)
-- ============================================================
SELECT id INTO v FROM canonical_ingredients WHERE canonical_name = 'chicken';
IF v IS NOT NULL THEN INSERT INTO ingredient_aliases (display_name, language, canonical_ingredient_id) VALUES
  ('Pollo', 'es', v), ('Pechuga de pollo', 'es', v), ('Muslo de pollo', 'es', v),
  ('Pierna de pollo', 'es', v), ('Ala de pollo', 'es', v),
  ('Pollo asado', 'es', v), ('Pollo rostizado', 'es', v), ('Pollo deshebrado', 'es', v),
  ('Caldo de pollo', 'es', v), ('Pollo molido', 'es', v), ('Filete de pollo', 'es', v),
  ('Pollo empanizado', 'es', v), ('Pollo a la plancha', 'es', v),
  ('Milanesa de pollo', 'es', v), ('Escalope de pollo', 'es', v)
  ON CONFLICT (display_name) DO NOTHING; END IF;

SELECT id INTO v FROM canonical_ingredients WHERE canonical_name = 'eggs';
IF v IS NOT NULL THEN INSERT INTO ingredient_aliases (display_name, language, canonical_ingredient_id) VALUES
  ('Huevo', 'es', v), ('Huevos', 'es', v), ('Huevo entero', 'es', v),
  ('Yema de huevo', 'es', v), ('Clara de huevo', 'es', v),
  ('Huevo batido', 'es', v), ('Huevo cocido', 'es', v), ('Huevo estrellado', 'es', v)
  ON CONFLICT (display_name) DO NOTHING; END IF;

-- ============================================================
-- VEGETABLES (Verduras / Vegetales)
-- ============================================================
SELECT id INTO v FROM canonical_ingredients WHERE canonical_name = 'tomato';
IF v IS NOT NULL THEN INSERT INTO ingredient_aliases (display_name, language, canonical_ingredient_id) VALUES
  ('Jitomate', 'es', v), ('Tomate', 'es', v), ('Tomate rojo', 'es', v),
  ('Jitomate bola', 'es', v), ('Jitomate guaje', 'es', v), ('Jitomate saladette', 'es', v),
  ('Tomate cherry', 'es', v), ('Tomate saladet', 'es', v)
  ON CONFLICT (display_name) DO NOTHING; END IF;

SELECT id INTO v FROM canonical_ingredients WHERE canonical_name = 'onion';
IF v IS NOT NULL THEN INSERT INTO ingredient_aliases (display_name, language, canonical_ingredient_id) VALUES
  ('Cebolla', 'es', v), ('Cebolla blanca', 'es', v), ('Cebolla amarilla', 'es', v),
  ('Cebolla morada', 'es', v), ('Cebolla roja', 'es', v), ('Cebolla picada', 'es', v)
  ON CONFLICT (display_name) DO NOTHING; END IF;

SELECT id INTO v FROM canonical_ingredients WHERE canonical_name = 'garlic';
IF v IS NOT NULL THEN INSERT INTO ingredient_aliases (display_name, language, canonical_ingredient_id) VALUES
  ('Ajo', 'es', v), ('Dientes de ajo', 'es', v), ('Ajo fresco', 'es', v),
  ('Cabeza de ajo', 'es', v), ('Ajo negro', 'es', v), ('Ajo rostizado', 'es', v),
  ('Ajo molido', 'es', v), ('Ajo en polvo', 'es', v)
  ON CONFLICT (display_name) DO NOTHING; END IF;

SELECT id INTO v FROM canonical_ingredients WHERE canonical_name = 'bell_pepper';
IF v IS NOT NULL THEN INSERT INTO ingredient_aliases (display_name, language, canonical_ingredient_id) VALUES
  ('Pimiento', 'es', v), ('Chile morrón', 'es', v), ('Pimiento morrón', 'es', v),
  ('Pimiento rojo', 'es', v), ('Pimiento verde', 'es', v), ('Pimiento amarillo', 'es', v),
  ('Chile dulce', 'es', v), ('Pimentón fresco', 'es', v)
  ON CONFLICT (display_name) DO NOTHING; END IF;

SELECT id INTO v FROM canonical_ingredients WHERE canonical_name = 'potato';
IF v IS NOT NULL THEN INSERT INTO ingredient_aliases (display_name, language, canonical_ingredient_id) VALUES
  ('Papa', 'es', v), ('Patata', 'es', v), ('Papa blanca', 'es', v),
  ('Papa amarilla', 'es', v), ('Papas', 'es', v), ('Papa cambray', 'es', v),
  ('Papa cocida', 'es', v), ('Papa frita', 'es', v)
  ON CONFLICT (display_name) DO NOTHING; END IF;

SELECT id INTO v FROM canonical_ingredients WHERE canonical_name = 'sweet_potato';
IF v IS NOT NULL THEN INSERT INTO ingredient_aliases (display_name, language, canonical_ingredient_id) VALUES
  ('Camote', 'es', v), ('Papa dulce', 'es', v), ('Batata', 'es', v),
  ('Boniato', 'es', v), ('Camote naranja', 'es', v), ('Camote morado', 'es', v)
  ON CONFLICT (display_name) DO NOTHING; END IF;

SELECT id INTO v FROM canonical_ingredients WHERE canonical_name = 'corn';
IF v IS NOT NULL THEN INSERT INTO ingredient_aliases (display_name, language, canonical_ingredient_id) VALUES
  ('Maíz', 'es', v), ('Elote', 'es', v), ('Mazorca', 'es', v),
  ('Granos de elote', 'es', v), ('Maíz cocido', 'es', v), ('Maíz en grano', 'es', v),
  ('Elote desgranado', 'es', v), ('Esquite', 'es', v)
  ON CONFLICT (display_name) DO NOTHING; END IF;

SELECT id INTO v FROM canonical_ingredients WHERE canonical_name = 'lettuce';
IF v IS NOT NULL THEN INSERT INTO ingredient_aliases (display_name, language, canonical_ingredient_id) VALUES
  ('Lechuga', 'es', v), ('Lechuga romana', 'es', v), ('Lechuga orejona', 'es', v),
  ('Lechuga italiana', 'es', v), ('Lechuga sangría', 'es', v),
  ('Mezcla de lechugas', 'es', v), ('Lechuga mixta', 'es', v)
  ON CONFLICT (display_name) DO NOTHING; END IF;

SELECT id INTO v FROM canonical_ingredients WHERE canonical_name = 'spinach';
IF v IS NOT NULL THEN INSERT INTO ingredient_aliases (display_name, language, canonical_ingredient_id) VALUES
  ('Espinaca', 'es', v), ('Espinacas', 'es', v), ('Espinaca baby', 'es', v)
  ON CONFLICT (display_name) DO NOTHING; END IF;

SELECT id INTO v FROM canonical_ingredients WHERE canonical_name = 'broccoli';
IF v IS NOT NULL THEN INSERT INTO ingredient_aliases (display_name, language, canonical_ingredient_id) VALUES
  ('Brócoli', 'es', v), ('Brócoli al vapor', 'es', v), ('Floretes de brócoli', 'es', v)
  ON CONFLICT (display_name) DO NOTHING; END IF;

SELECT id INTO v FROM canonical_ingredients WHERE canonical_name = 'cabbage';
IF v IS NOT NULL THEN INSERT INTO ingredient_aliases (display_name, language, canonical_ingredient_id) VALUES
  ('Repollo', 'es', v), ('Col', 'es', v), ('Col blanca', 'es', v),
  ('Col morada', 'es', v), ('Col rizada', 'es', v), ('Repollo morado', 'es', v)
  ON CONFLICT (display_name) DO NOTHING; END IF;

SELECT id INTO v FROM canonical_ingredients WHERE canonical_name = 'zucchini';
IF v IS NOT NULL THEN INSERT INTO ingredient_aliases (display_name, language, canonical_ingredient_id) VALUES
  ('Calabacita', 'es', v), ('Calabacín', 'es', v), ('Calabaza italiana', 'es', v)
  ON CONFLICT (display_name) DO NOTHING; END IF;

SELECT id INTO v FROM canonical_ingredients WHERE canonical_name = 'pumpkin';
IF v IS NOT NULL THEN INSERT INTO ingredient_aliases (display_name, language, canonical_ingredient_id) VALUES
  ('Calabaza', 'es', v), ('Calabaza de castilla', 'es', v), ('Calabaza naranja', 'es', v),
  ('Pulpa de calabaza', 'es', v)
  ON CONFLICT (display_name) DO NOTHING; END IF;

SELECT id INTO v FROM canonical_ingredients WHERE canonical_name = 'carrot';
IF v IS NOT NULL THEN INSERT INTO ingredient_aliases (display_name, language, canonical_ingredient_id) VALUES
  ('Zanahoria', 'es', v), ('Zanahorias', 'es', v), ('Zanahoria rallada', 'es', v),
  ('Zanahoria baby', 'es', v)
  ON CONFLICT (display_name) DO NOTHING; END IF;

SELECT id INTO v FROM canonical_ingredients WHERE canonical_name = 'celery';
IF v IS NOT NULL THEN INSERT INTO ingredient_aliases (display_name, language, canonical_ingredient_id) VALUES
  ('Apio', 'es', v), ('Tallo de apio', 'es', v), ('Apio picado', 'es', v)
  ON CONFLICT (display_name) DO NOTHING; END IF;

SELECT id INTO v FROM canonical_ingredients WHERE canonical_name = 'asparagus';
IF v IS NOT NULL THEN INSERT INTO ingredient_aliases (display_name, language, canonical_ingredient_id) VALUES
  ('Espárrago', 'es', v), ('Espárragos', 'es', v), ('Espárragos verdes', 'es', v)
  ON CONFLICT (display_name) DO NOTHING; END IF;

SELECT id INTO v FROM canonical_ingredients WHERE canonical_name = 'artichoke';
IF v IS NOT NULL THEN INSERT INTO ingredient_aliases (display_name, language, canonical_ingredient_id) VALUES
  ('Alcachofa', 'es', v), ('Alcachofas', 'es', v), ('Corazón de alcachofa', 'es', v)
  ON CONFLICT (display_name) DO NOTHING; END IF;

SELECT id INTO v FROM canonical_ingredients WHERE canonical_name = 'mushroom';
IF v IS NOT NULL THEN INSERT INTO ingredient_aliases (display_name, language, canonical_ingredient_id) VALUES
  ('Champiñón', 'es', v), ('Champiñones', 'es', v), ('Hongo', 'es', v),
  ('Hongos', 'es', v), ('Seta', 'es', v), ('Setas', 'es', v),
  ('Hongo portobello', 'es', v), ('Hongo shiitake', 'es', v)
  ON CONFLICT (display_name) DO NOTHING; END IF;

SELECT id INTO v FROM canonical_ingredients WHERE canonical_name = 'avocado';
IF v IS NOT NULL THEN INSERT INTO ingredient_aliases (display_name, language, canonical_ingredient_id) VALUES
  ('Aguacate', 'es', v), ('Palta', 'es', v), ('Aguacate Hass', 'es', v),
  ('Aguacate en rebanadas', 'es', v), ('Aguacate maduro', 'es', v)
  ON CONFLICT (display_name) DO NOTHING; END IF;

SELECT id INTO v FROM canonical_ingredients WHERE canonical_name = 'plantain';
IF v IS NOT NULL THEN INSERT INTO ingredient_aliases (display_name, language, canonical_ingredient_id) VALUES
  ('Plátano', 'es', v), ('Plátano macho', 'es', v), ('Plátano verde', 'es', v),
  ('Plátano maduro', 'es', v), ('Tostones', 'es', v), ('Platanito', 'es', v)
  ON CONFLICT (display_name) DO NOTHING; END IF;

SELECT id INTO v FROM canonical_ingredients WHERE canonical_name = 'radish';
IF v IS NOT NULL THEN INSERT INTO ingredient_aliases (display_name, language, canonical_ingredient_id) VALUES
  ('Rábano', 'es', v), ('Rábanos', 'es', v), ('Rábano rojo', 'es', v)
  ON CONFLICT (display_name) DO NOTHING; END IF;

SELECT id INTO v FROM canonical_ingredients WHERE canonical_name = 'green_onion';
IF v IS NOT NULL THEN INSERT INTO ingredient_aliases (display_name, language, canonical_ingredient_id) VALUES
  ('Cebollín', 'es', v), ('Cebollita de cambray', 'es', v), ('Cebollita china', 'es', v),
  ('Cebollín verde', 'es', v), ('Cebollin', 'es', v)
  ON CONFLICT (display_name) DO NOTHING; END IF;

SELECT id INTO v FROM canonical_ingredients WHERE canonical_name = 'shallot';
IF v IS NOT NULL THEN INSERT INTO ingredient_aliases (display_name, language, canonical_ingredient_id) VALUES
  ('Chalote', 'es', v), ('Echalote', 'es', v), ('Cebolla chalote', 'es', v)
  ON CONFLICT (display_name) DO NOTHING; END IF;

SELECT id INTO v FROM canonical_ingredients WHERE canonical_name = 'fennel';
IF v IS NOT NULL THEN INSERT INTO ingredient_aliases (display_name, language, canonical_ingredient_id) VALUES
  ('Hinojo', 'es', v), ('Bulbo de hinojo', 'es', v)
  ON CONFLICT (display_name) DO NOTHING; END IF;

SELECT id INTO v FROM canonical_ingredients WHERE canonical_name = 'turnip';
IF v IS NOT NULL THEN INSERT INTO ingredient_aliases (display_name, language, canonical_ingredient_id) VALUES
  ('Nabo', 'es', v), ('Nabos', 'es', v)
  ON CONFLICT (display_name) DO NOTHING; END IF;

SELECT id INTO v FROM canonical_ingredients WHERE canonical_name = 'arugula';
IF v IS NOT NULL THEN INSERT INTO ingredient_aliases (display_name, language, canonical_ingredient_id) VALUES
  ('Arúgula', 'es', v), ('Rúcula', 'es', v)
  ON CONFLICT (display_name) DO NOTHING; END IF;

SELECT id INTO v FROM canonical_ingredients WHERE canonical_name = 'kale';
IF v IS NOT NULL THEN INSERT INTO ingredient_aliases (display_name, language, canonical_ingredient_id) VALUES
  ('Col rizada', 'es', v), ('Berza', 'es', v), ('Kale', 'es', v)
  ON CONFLICT (display_name) DO NOTHING; END IF;

SELECT id INTO v FROM canonical_ingredients WHERE canonical_name = 'green_beans';
IF v IS NOT NULL THEN INSERT INTO ingredient_aliases (display_name, language, canonical_ingredient_id) VALUES
  ('Ejotes', 'es', v), ('Ejote', 'es', v), ('Judías verdes', 'es', v),
  ('Vainitas', 'es', v), ('Habichuelas verdes', 'es', v)
  ON CONFLICT (display_name) DO NOTHING; END IF;

SELECT id INTO v FROM canonical_ingredients WHERE canonical_name = 'cassava';
IF v IS NOT NULL THEN INSERT INTO ingredient_aliases (display_name, language, canonical_ingredient_id) VALUES
  ('Yuca', 'es', v), ('Mandioca', 'es', v), ('Tapioca', 'es', v)
  ON CONFLICT (display_name) DO NOTHING; END IF;

SELECT id INTO v FROM canonical_ingredients WHERE canonical_name = 'bok_choy';
IF v IS NOT NULL THEN INSERT INTO ingredient_aliases (display_name, language, canonical_ingredient_id) VALUES
  ('Pak choi', 'es', v), ('Col china', 'es', v)
  ON CONFLICT (display_name) DO NOTHING; END IF;

SELECT id INTO v FROM canonical_ingredients WHERE canonical_name = 'collard_greens';
IF v IS NOT NULL THEN INSERT INTO ingredient_aliases (display_name, language, canonical_ingredient_id) VALUES
  ('Berza', 'es', v), ('Col verde', 'es', v)
  ON CONFLICT (display_name) DO NOTHING; END IF;

SELECT id INTO v FROM canonical_ingredients WHERE canonical_name = 'bamboo_shoots';
IF v IS NOT NULL THEN INSERT INTO ingredient_aliases (display_name, language, canonical_ingredient_id) VALUES
  ('Brotes de bambú', 'es', v), ('Bambú', 'es', v)
  ON CONFLICT (display_name) DO NOTHING; END IF;

-- ============================================================
-- FRUITS (Frutas)
-- ============================================================
SELECT id INTO v FROM canonical_ingredients WHERE canonical_name = 'lemon';
IF v IS NOT NULL THEN INSERT INTO ingredient_aliases (display_name, language, canonical_ingredient_id) VALUES
  ('Limón amarillo', 'es', v), ('Limón europeo', 'es', v), ('Jugo de limón amarillo', 'es', v)
  ON CONFLICT (display_name) DO NOTHING; END IF;

SELECT id INTO v FROM canonical_ingredients WHERE canonical_name = 'lime';
IF v IS NOT NULL THEN INSERT INTO ingredient_aliases (display_name, language, canonical_ingredient_id) VALUES
  ('Limón', 'es', v), ('Limón verde', 'es', v), ('Lima', 'es', v),
  ('Jugo de limón', 'es', v), ('Ralladura de limón', 'es', v)
  ON CONFLICT (display_name) DO NOTHING; END IF;

SELECT id INTO v FROM canonical_ingredients WHERE canonical_name = 'mango';
IF v IS NOT NULL THEN INSERT INTO ingredient_aliases (display_name, language, canonical_ingredient_id) VALUES
  ('Mango', 'es', v), ('Mango manila', 'es', v), ('Mango ataulfo', 'es', v),
  ('Mango maduro', 'es', v), ('Pulpa de mango', 'es', v)
  ON CONFLICT (display_name) DO NOTHING; END IF;

SELECT id INTO v FROM canonical_ingredients WHERE canonical_name = 'orange';
IF v IS NOT NULL THEN INSERT INTO ingredient_aliases (display_name, language, canonical_ingredient_id) VALUES
  ('Naranja', 'es', v), ('Jugo de naranja', 'es', v), ('Naranja dulce', 'es', v),
  ('Ralladura de naranja', 'es', v)
  ON CONFLICT (display_name) DO NOTHING; END IF;

SELECT id INTO v FROM canonical_ingredients WHERE canonical_name = 'pineapple';
IF v IS NOT NULL THEN INSERT INTO ingredient_aliases (display_name, language, canonical_ingredient_id) VALUES
  ('Piña', 'es', v), ('Piña natural', 'es', v), ('Piña en trozos', 'es', v),
  ('Jugo de piña', 'es', v)
  ON CONFLICT (display_name) DO NOTHING; END IF;

SELECT id INTO v FROM canonical_ingredients WHERE canonical_name = 'apple';
IF v IS NOT NULL THEN INSERT INTO ingredient_aliases (display_name, language, canonical_ingredient_id) VALUES
  ('Manzana', 'es', v), ('Manzana roja', 'es', v), ('Manzana verde', 'es', v),
  ('Jugo de manzana', 'es', v)
  ON CONFLICT (display_name) DO NOTHING; END IF;

SELECT id INTO v FROM canonical_ingredients WHERE canonical_name = 'pear';
IF v IS NOT NULL THEN INSERT INTO ingredient_aliases (display_name, language, canonical_ingredient_id) VALUES
  ('Pera', 'es', v), ('Pera madura', 'es', v)
  ON CONFLICT (display_name) DO NOTHING; END IF;

SELECT id INTO v FROM canonical_ingredients WHERE canonical_name = 'papaya';
IF v IS NOT NULL THEN INSERT INTO ingredient_aliases (display_name, language, canonical_ingredient_id) VALUES
  ('Papaya', 'es', v), ('Lechosa', 'es', v), ('Papaya madura', 'es', v)
  ON CONFLICT (display_name) DO NOTHING; END IF;

SELECT id INTO v FROM canonical_ingredients WHERE canonical_name = 'dates';
IF v IS NOT NULL THEN INSERT INTO ingredient_aliases (display_name, language, canonical_ingredient_id) VALUES
  ('Dátiles', 'es', v), ('Dátil', 'es', v)
  ON CONFLICT (display_name) DO NOTHING; END IF;

SELECT id INTO v FROM canonical_ingredients WHERE canonical_name = 'apricot';
IF v IS NOT NULL THEN INSERT INTO ingredient_aliases (display_name, language, canonical_ingredient_id) VALUES
  ('Chabacano', 'es', v), ('Albaricoque', 'es', v), ('Durazno', 'es', v),
  ('Durazno amarillo', 'es', v)
  ON CONFLICT (display_name) DO NOTHING; END IF;

SELECT id INTO v FROM canonical_ingredients WHERE canonical_name = 'plum';
IF v IS NOT NULL THEN INSERT INTO ingredient_aliases (display_name, language, canonical_ingredient_id) VALUES
  ('Ciruela', 'es', v), ('Ciruelas', 'es', v), ('Ciruela pasa', 'es', v)
  ON CONFLICT (display_name) DO NOTHING; END IF;

SELECT id INTO v FROM canonical_ingredients WHERE canonical_name = 'tangerine';
IF v IS NOT NULL THEN INSERT INTO ingredient_aliases (display_name, language, canonical_ingredient_id) VALUES
  ('Mandarina', 'es', v), ('Tangerina', 'es', v)
  ON CONFLICT (display_name) DO NOTHING; END IF;

SELECT id INTO v FROM canonical_ingredients WHERE canonical_name = 'lemongrass';
IF v IS NOT NULL THEN INSERT INTO ingredient_aliases (display_name, language, canonical_ingredient_id) VALUES
  ('Hierba limón', 'es', v), ('Zacate limón', 'es', v), ('Té limón', 'es', v)
  ON CONFLICT (display_name) DO NOTHING; END IF;

-- ============================================================
-- GRAINS (Cereales / Harinas)
-- ============================================================
SELECT id INTO v FROM canonical_ingredients WHERE canonical_name = 'rice';
IF v IS NOT NULL THEN INSERT INTO ingredient_aliases (display_name, language, canonical_ingredient_id) VALUES
  ('Arroz', 'es', v), ('Arroz blanco', 'es', v), ('Arroz integral', 'es', v),
  ('Arroz cocido', 'es', v), ('Arroz a la mexicana', 'es', v), ('Arroz rojo', 'es', v),
  ('Arroz con leche', 'es', v)
  ON CONFLICT (display_name) DO NOTHING; END IF;

SELECT id INTO v FROM canonical_ingredients WHERE canonical_name = 'tortilla';
IF v IS NOT NULL THEN INSERT INTO ingredient_aliases (display_name, language, canonical_ingredient_id) VALUES
  ('Tortilla', 'es', v), ('Tortilla de maíz', 'es', v), ('Tortilla de harina', 'es', v),
  ('Tortilla de trigo', 'es', v), ('Tortilla integral', 'es', v),
  ('Tostada', 'es', v), ('Tortilla tostada', 'es', v)
  ON CONFLICT (display_name) DO NOTHING; END IF;

SELECT id INTO v FROM canonical_ingredients WHERE canonical_name = 'bread';
IF v IS NOT NULL THEN INSERT INTO ingredient_aliases (display_name, language, canonical_ingredient_id) VALUES
  ('Pan', 'es', v), ('Pan blanco', 'es', v), ('Pan integral', 'es', v),
  ('Pan de caja', 'es', v), ('Bolillo', 'es', v), ('Telera', 'es', v),
  ('Pan dulce', 'es', v), ('Pan de centeno', 'es', v), ('Baguette', 'es', v),
  ('Pan tostado', 'es', v)
  ON CONFLICT (display_name) DO NOTHING; END IF;

SELECT id INTO v FROM canonical_ingredients WHERE canonical_name = 'flour';
IF v IS NOT NULL THEN INSERT INTO ingredient_aliases (display_name, language, canonical_ingredient_id) VALUES
  ('Harina', 'es', v), ('Harina de trigo', 'es', v), ('Harina sin cernir', 'es', v),
  ('Harina para todo uso', 'es', v), ('Harina preparada', 'es', v)
  ON CONFLICT (display_name) DO NOTHING; END IF;

SELECT id INTO v FROM canonical_ingredients WHERE canonical_name = 'cornmeal';
IF v IS NOT NULL THEN INSERT INTO ingredient_aliases (display_name, language, canonical_ingredient_id) VALUES
  ('Harina de maíz', 'es', v), ('Masa de maíz', 'es', v), ('Masa para tamales', 'es', v),
  ('Harina Maseca', 'es', v), ('Masa harina', 'es', v), ('Nixtatmal', 'es', v)
  ON CONFLICT (display_name) DO NOTHING; END IF;

SELECT id INTO v FROM canonical_ingredients WHERE canonical_name = 'cornstarch';
IF v IS NOT NULL THEN INSERT INTO ingredient_aliases (display_name, language, canonical_ingredient_id) VALUES
  ('Fécula de maíz', 'es', v), ('Maicena', 'es', v), ('Almidón de maíz', 'es', v)
  ON CONFLICT (display_name) DO NOTHING; END IF;

SELECT id INTO v FROM canonical_ingredients WHERE canonical_name = 'pasta';
IF v IS NOT NULL THEN INSERT INTO ingredient_aliases (display_name, language, canonical_ingredient_id) VALUES
  ('Pasta', 'es', v), ('Fideos', 'es', v), ('Espagueti', 'es', v),
  ('Tallarín', 'es', v), ('Macarrones', 'es', v), ('Fettuccine', 'es', v),
  ('Pasta corta', 'es', v), ('Coditos', 'es', v)
  ON CONFLICT (display_name) DO NOTHING; END IF;

SELECT id INTO v FROM canonical_ingredients WHERE canonical_name = 'oats';
IF v IS NOT NULL THEN INSERT INTO ingredient_aliases (display_name, language, canonical_ingredient_id) VALUES
  ('Avena', 'es', v), ('Avena en hojuelas', 'es', v), ('Avena molida', 'es', v),
  ('Avena integral', 'es', v)
  ON CONFLICT (display_name) DO NOTHING; END IF;

SELECT id INTO v FROM canonical_ingredients WHERE canonical_name = 'quinoa';
IF v IS NOT NULL THEN INSERT INTO ingredient_aliases (display_name, language, canonical_ingredient_id) VALUES
  ('Quinoa', 'es', v), ('Quinua', 'es', v), ('Quinoa blanca', 'es', v),
  ('Quinoa roja', 'es', v)
  ON CONFLICT (display_name) DO NOTHING; END IF;

SELECT id INTO v FROM canonical_ingredients WHERE canonical_name = 'noodles';
IF v IS NOT NULL THEN INSERT INTO ingredient_aliases (display_name, language, canonical_ingredient_id) VALUES
  ('Fideos', 'es', v), ('Tallarines', 'es', v), ('Fideo', 'es', v),
  ('Fideos de arroz', 'es', v)
  ON CONFLICT (display_name) DO NOTHING; END IF;

SELECT id INTO v FROM canonical_ingredients WHERE canonical_name = 'couscous';
IF v IS NOT NULL THEN INSERT INTO ingredient_aliases (display_name, language, canonical_ingredient_id) VALUES
  ('Cuscús', 'es', v), ('Cous cous', 'es', v)
  ON CONFLICT (display_name) DO NOTHING; END IF;

SELECT id INTO v FROM canonical_ingredients WHERE canonical_name = 'bread_crumbs';
IF v IS NOT NULL THEN INSERT INTO ingredient_aliases (display_name, language, canonical_ingredient_id) VALUES
  ('Pan molido', 'es', v), ('Pan rallado', 'es', v), ('Migas de pan', 'es', v)
  ON CONFLICT (display_name) DO NOTHING; END IF;

-- ============================================================
-- BEANS / LEGUMES (Frijoles / Leguminosas)
-- ============================================================
SELECT id INTO v FROM canonical_ingredients WHERE canonical_name = 'black_beans';
IF v IS NOT NULL THEN INSERT INTO ingredient_aliases (display_name, language, canonical_ingredient_id) VALUES
  ('Frijoles negros', 'es', v), ('Frijol negro', 'es', v),
  ('Frijoles de olla', 'es', v), ('Frijoles refritos', 'es', v),
  ('Frijoles refritos negros', 'es', v), ('Frijoles charros', 'es', v)
  ON CONFLICT (display_name) DO NOTHING; END IF;

SELECT id INTO v FROM canonical_ingredients WHERE canonical_name = 'pinto_beans';
IF v IS NOT NULL THEN INSERT INTO ingredient_aliases (display_name, language, canonical_ingredient_id) VALUES
  ('Frijoles pintos', 'es', v), ('Frijol pinto', 'es', v), ('Frijol bayo', 'es', v),
  ('Frijoles bayos', 'es', v), ('Frijoles refritos pintos', 'es', v)
  ON CONFLICT (display_name) DO NOTHING; END IF;

SELECT id INTO v FROM canonical_ingredients WHERE canonical_name = 'kidney_beans';
IF v IS NOT NULL THEN INSERT INTO ingredient_aliases (display_name, language, canonical_ingredient_id) VALUES
  ('Frijoles rojos', 'es', v), ('Frijol rojo', 'es', v), ('Judías rojas', 'es', v),
  ('Alubias rojas', 'es', v)
  ON CONFLICT (display_name) DO NOTHING; END IF;

SELECT id INTO v FROM canonical_ingredients WHERE canonical_name = 'white_beans';
IF v IS NOT NULL THEN INSERT INTO ingredient_aliases (display_name, language, canonical_ingredient_id) VALUES
  ('Frijoles blancos', 'es', v), ('Alubias blancas', 'es', v), ('Judías blancas', 'es', v)
  ON CONFLICT (display_name) DO NOTHING; END IF;

SELECT id INTO v FROM canonical_ingredients WHERE canonical_name = 'red_beans';
IF v IS NOT NULL THEN INSERT INTO ingredient_aliases (display_name, language, canonical_ingredient_id) VALUES
  ('Frijoles colorados', 'es', v), ('Frijol colorado', 'es', v)
  ON CONFLICT (display_name) DO NOTHING; END IF;

SELECT id INTO v FROM canonical_ingredients WHERE canonical_name = 'lentils';
IF v IS NOT NULL THEN INSERT INTO ingredient_aliases (display_name, language, canonical_ingredient_id) VALUES
  ('Lentejas', 'es', v), ('Lenteja', 'es', v), ('Lentejas verdes', 'es', v),
  ('Lentejas rojas', 'es', v)
  ON CONFLICT (display_name) DO NOTHING; END IF;

SELECT id INTO v FROM canonical_ingredients WHERE canonical_name = 'chickpeas';
IF v IS NOT NULL THEN INSERT INTO ingredient_aliases (display_name, language, canonical_ingredient_id) VALUES
  ('Garbanzo', 'es', v), ('Garbanzos', 'es', v), ('Garbanzos cocidos', 'es', v)
  ON CONFLICT (display_name) DO NOTHING; END IF;

SELECT id INTO v FROM canonical_ingredients WHERE canonical_name = 'edamame';
IF v IS NOT NULL THEN INSERT INTO ingredient_aliases (display_name, language, canonical_ingredient_id) VALUES
  ('Edamame', 'es', v), ('Soya verde', 'es', v)
  ON CONFLICT (display_name) DO NOTHING; END IF;

-- ============================================================
-- NUTS / SEEDS (Nueces / Semillas)
-- ============================================================
SELECT id INTO v FROM canonical_ingredients WHERE canonical_name = 'peanuts';
IF v IS NOT NULL THEN INSERT INTO ingredient_aliases (display_name, language, canonical_ingredient_id) VALUES
  ('Cacahuate', 'es', v), ('Cacahuates', 'es', v), ('Maní', 'es', v),
  ('Cacahuete', 'es', v), ('Cacahuates tostados', 'es', v)
  ON CONFLICT (display_name) DO NOTHING; END IF;

SELECT id INTO v FROM canonical_ingredients WHERE canonical_name = 'peanut_butter';
IF v IS NOT NULL THEN INSERT INTO ingredient_aliases (display_name, language, canonical_ingredient_id) VALUES
  ('Mantequilla de cacahuate', 'es', v), ('Crema de cacahuate', 'es', v),
  ('Mantequilla de maní', 'es', v)
  ON CONFLICT (display_name) DO NOTHING; END IF;

SELECT id INTO v FROM canonical_ingredients WHERE canonical_name = 'almonds';
IF v IS NOT NULL THEN INSERT INTO ingredient_aliases (display_name, language, canonical_ingredient_id) VALUES
  ('Almendras', 'es', v), ('Almendra', 'es', v), ('Almendras fileteadas', 'es', v),
  ('Almendras tostadas', 'es', v)
  ON CONFLICT (display_name) DO NOTHING; END IF;

SELECT id INTO v FROM canonical_ingredients WHERE canonical_name = 'walnuts';
IF v IS NOT NULL THEN INSERT INTO ingredient_aliases (display_name, language, canonical_ingredient_id) VALUES
  ('Nuez', 'es', v), ('Nueces', 'es', v), ('Nuez de Castilla', 'es', v),
  ('Nueces picadas', 'es', v)
  ON CONFLICT (display_name) DO NOTHING; END IF;

SELECT id INTO v FROM canonical_ingredients WHERE canonical_name = 'cashews';
IF v IS NOT NULL THEN INSERT INTO ingredient_aliases (display_name, language, canonical_ingredient_id) VALUES
  ('Nuez de la India', 'es', v), ('Anacardo', 'es', v), ('Marañón', 'es', v),
  ('Cajú', 'es', v)
  ON CONFLICT (display_name) DO NOTHING; END IF;

SELECT id INTO v FROM canonical_ingredients WHERE canonical_name = 'pecans';
IF v IS NOT NULL THEN INSERT INTO ingredient_aliases (display_name, language, canonical_ingredient_id) VALUES
  ('Nuez pecana', 'es', v), ('Pacana', 'es', v), ('Nuez moscada pecana', 'es', v)
  ON CONFLICT (display_name) DO NOTHING; END IF;

SELECT id INTO v FROM canonical_ingredients WHERE canonical_name = 'pistachios';
IF v IS NOT NULL THEN INSERT INTO ingredient_aliases (display_name, language, canonical_ingredient_id) VALUES
  ('Pistache', 'es', v), ('Pistachos', 'es', v), ('Pistaches', 'es', v)
  ON CONFLICT (display_name) DO NOTHING; END IF;

SELECT id INTO v FROM canonical_ingredients WHERE canonical_name = 'hazelnuts';
IF v IS NOT NULL THEN INSERT INTO ingredient_aliases (display_name, language, canonical_ingredient_id) VALUES
  ('Avellana', 'es', v), ('Avellanas', 'es', v)
  ON CONFLICT (display_name) DO NOTHING; END IF;

SELECT id INTO v FROM canonical_ingredients WHERE canonical_name = 'sesame_seeds';
IF v IS NOT NULL THEN INSERT INTO ingredient_aliases (display_name, language, canonical_ingredient_id) VALUES
  ('Ajonjolí', 'es', v), ('Sésamo', 'es', v), ('Semillas de ajonjolí', 'es', v),
  ('Ajonjolí negro', 'es', v), ('Ajonjolí blanco', 'es', v)
  ON CONFLICT (display_name) DO NOTHING; END IF;

SELECT id INTO v FROM canonical_ingredients WHERE canonical_name = 'chia_seeds';
IF v IS NOT NULL THEN INSERT INTO ingredient_aliases (display_name, language, canonical_ingredient_id) VALUES
  ('Chía', 'es', v), ('Semillas de chía', 'es', v)
  ON CONFLICT (display_name) DO NOTHING; END IF;

SELECT id INTO v FROM canonical_ingredients WHERE canonical_name = 'raisins';
IF v IS NOT NULL THEN INSERT INTO ingredient_aliases (display_name, language, canonical_ingredient_id) VALUES
  ('Pasas', 'es', v), ('Uvas pasas', 'es', v), ('Pasitas', 'es', v)
  ON CONFLICT (display_name) DO NOTHING; END IF;

-- ============================================================
-- HERBS / SPICES (Hierbas / Especias)
-- ============================================================
SELECT id INTO v FROM canonical_ingredients WHERE canonical_name = 'cilantro';
IF v IS NOT NULL THEN INSERT INTO ingredient_aliases (display_name, language, canonical_ingredient_id) VALUES
  ('Cilantro fresco', 'es', v), ('Culantro', 'es', v), ('Coriandro', 'es', v)
  ON CONFLICT (display_name) DO NOTHING; END IF;

SELECT id INTO v FROM canonical_ingredients WHERE canonical_name = 'cumin';
IF v IS NOT NULL THEN INSERT INTO ingredient_aliases (display_name, language, canonical_ingredient_id) VALUES
  ('Comino', 'es', v), ('Comino molido', 'es', v), ('Semillas de comino', 'es', v)
  ON CONFLICT (display_name) DO NOTHING; END IF;

SELECT id INTO v FROM canonical_ingredients WHERE canonical_name = 'cinnamon';
IF v IS NOT NULL THEN INSERT INTO ingredient_aliases (display_name, language, canonical_ingredient_id) VALUES
  ('Canela', 'es', v), ('Rama de canela', 'es', v), ('Canela molida', 'es', v),
  ('Canela en polvo', 'es', v), ('Raja de canela', 'es', v)
  ON CONFLICT (display_name) DO NOTHING; END IF;

SELECT id INTO v FROM canonical_ingredients WHERE canonical_name = 'oregano';
IF v IS NOT NULL THEN INSERT INTO ingredient_aliases (display_name, language, canonical_ingredient_id) VALUES
  ('Orégano', 'es', v), ('Orégano seco', 'es', v), ('Orégano mexicano', 'es', v),
  ('Orégano fresco', 'es', v)
  ON CONFLICT (display_name) DO NOTHING; END IF;

SELECT id INTO v FROM canonical_ingredients WHERE canonical_name = 'basil';
IF v IS NOT NULL THEN INSERT INTO ingredient_aliases (display_name, language, canonical_ingredient_id) VALUES
  ('Albahaca', 'es', v), ('Albahaca fresca', 'es', v), ('Albahaca seca', 'es', v)
  ON CONFLICT (display_name) DO NOTHING; END IF;

SELECT id INTO v FROM canonical_ingredients WHERE canonical_name = 'thyme';
IF v IS NOT NULL THEN INSERT INTO ingredient_aliases (display_name, language, canonical_ingredient_id) VALUES
  ('Tomillo', 'es', v), ('Tomillo fresco', 'es', v), ('Tomillo seco', 'es', v)
  ON CONFLICT (display_name) DO NOTHING; END IF;

SELECT id INTO v FROM canonical_ingredients WHERE canonical_name = 'rosemary';
IF v IS NOT NULL THEN INSERT INTO ingredient_aliases (display_name, language, canonical_ingredient_id) VALUES
  ('Romero', 'es', v), ('Romero fresco', 'es', v), ('Romero seco', 'es', v)
  ON CONFLICT (display_name) DO NOTHING; END IF;

SELECT id INTO v FROM canonical_ingredients WHERE canonical_name = 'parsley';
IF v IS NOT NULL THEN INSERT INTO ingredient_aliases (display_name, language, canonical_ingredient_id) VALUES
  ('Perejil', 'es', v), ('Perejil fresco', 'es', v), ('Perejil seco', 'es', v),
  ('Perejil picado', 'es', v)
  ON CONFLICT (display_name) DO NOTHING; END IF;

SELECT id INTO v FROM canonical_ingredients WHERE canonical_name = 'mint';
IF v IS NOT NULL THEN INSERT INTO ingredient_aliases (display_name, language, canonical_ingredient_id) VALUES
  ('Menta', 'es', v), ('Hierbabuena', 'es', v), ('Yerbabuena', 'es', v),
  ('Hojas de menta', 'es', v)
  ON CONFLICT (display_name) DO NOTHING; END IF;

SELECT id INTO v FROM canonical_ingredients WHERE canonical_name = 'bay_leaf';
IF v IS NOT NULL THEN INSERT INTO ingredient_aliases (display_name, language, canonical_ingredient_id) VALUES
  ('Laurel', 'es', v), ('Hoja de laurel', 'es', v), ('Hojas de laurel', 'es', v)
  ON CONFLICT (display_name) DO NOTHING; END IF;

SELECT id INTO v FROM canonical_ingredients WHERE canonical_name = 'black_pepper';
IF v IS NOT NULL THEN INSERT INTO ingredient_aliases (display_name, language, canonical_ingredient_id) VALUES
  ('Pimienta negra', 'es', v), ('Pimienta', 'es', v), ('Granos de pimienta', 'es', v),
  ('Pimienta molida', 'es', v)
  ON CONFLICT (display_name) DO NOTHING; END IF;

SELECT id INTO v FROM canonical_ingredients WHERE canonical_name = 'white_pepper';
IF v IS NOT NULL THEN INSERT INTO ingredient_aliases (display_name, language, canonical_ingredient_id) VALUES
  ('Pimienta blanca', 'es', v), ('Pimienta blanca molida', 'es', v)
  ON CONFLICT (display_name) DO NOTHING; END IF;

SELECT id INTO v FROM canonical_ingredients WHERE canonical_name = 'salt';
IF v IS NOT NULL THEN INSERT INTO ingredient_aliases (display_name, language, canonical_ingredient_id) VALUES
  ('Sal', 'es', v), ('Sal de mesa', 'es', v), ('Sal marina', 'es', v),
  ('Sal kosher', 'es', v), ('Sal de grano', 'es', v), ('Sal rosa', 'es', v)
  ON CONFLICT (display_name) DO NOTHING; END IF;

SELECT id INTO v FROM canonical_ingredients WHERE canonical_name = 'chili_powder';
IF v IS NOT NULL THEN INSERT INTO ingredient_aliases (display_name, language, canonical_ingredient_id) VALUES
  ('Chile en polvo', 'es', v), ('Polvo de chile', 'es', v), ('Chili en polvo', 'es', v)
  ON CONFLICT (display_name) DO NOTHING; END IF;

SELECT id INTO v FROM canonical_ingredients WHERE canonical_name = 'chili_flakes';
IF v IS NOT NULL THEN INSERT INTO ingredient_aliases (display_name, language, canonical_ingredient_id) VALUES
  ('Hojuelas de chile', 'es', v), ('Chile seco molido', 'es', v),
  ('Chile rojo picado', 'es', v), ('Pimiento rojo molido', 'es', v)
  ON CONFLICT (display_name) DO NOTHING; END IF;

SELECT id INTO v FROM canonical_ingredients WHERE canonical_name = 'cayenne';
IF v IS NOT NULL THEN INSERT INTO ingredient_aliases (display_name, language, canonical_ingredient_id) VALUES
  ('Cayena', 'es', v), ('Chile de árbol en polvo', 'es', v), ('Pimiento cayena', 'es', v)
  ON CONFLICT (display_name) DO NOTHING; END IF;

SELECT id INTO v FROM canonical_ingredients WHERE canonical_name = 'paprika';
IF v IS NOT NULL THEN INSERT INTO ingredient_aliases (display_name, language, canonical_ingredient_id) VALUES
  ('Pimentón', 'es', v), ('Páprika', 'es', v), ('Pimentón ahumado', 'es', v),
  ('Pimentón dulce', 'es', v), ('Paprika ahumada', 'es', v)
  ON CONFLICT (display_name) DO NOTHING; END IF;

SELECT id INTO v FROM canonical_ingredients WHERE canonical_name = 'turmeric';
IF v IS NOT NULL THEN INSERT INTO ingredient_aliases (display_name, language, canonical_ingredient_id) VALUES
  ('Cúrcuma', 'es', v), ('Tumérico', 'es', v), ('Cúrcuma en polvo', 'es', v)
  ON CONFLICT (display_name) DO NOTHING; END IF;

SELECT id INTO v FROM canonical_ingredients WHERE canonical_name = 'ginger';
IF v IS NOT NULL THEN INSERT INTO ingredient_aliases (display_name, language, canonical_ingredient_id) VALUES
  ('Jengibre', 'es', v), ('Jengibre fresco', 'es', v), ('Jengibre rallado', 'es', v),
  ('Jengibre en polvo', 'es', v)
  ON CONFLICT (display_name) DO NOTHING; END IF;

SELECT id INTO v FROM canonical_ingredients WHERE canonical_name = 'vanilla';
IF v IS NOT NULL THEN INSERT INTO ingredient_aliases (display_name, language, canonical_ingredient_id) VALUES
  ('Vainilla', 'es', v), ('Extracto de vainilla', 'es', v), ('Vaina de vainilla', 'es', v)
  ON CONFLICT (display_name) DO NOTHING; END IF;

SELECT id INTO v FROM canonical_ingredients WHERE canonical_name = 'anise';
IF v IS NOT NULL THEN INSERT INTO ingredient_aliases (display_name, language, canonical_ingredient_id) VALUES
  ('Anís', 'es', v), ('Semillas de anís', 'es', v)
  ON CONFLICT (display_name) DO NOTHING; END IF;

SELECT id INTO v FROM canonical_ingredients WHERE canonical_name = 'star_anise';
IF v IS NOT NULL THEN INSERT INTO ingredient_aliases (display_name, language, canonical_ingredient_id) VALUES
  ('Anís estrella', 'es', v), ('Badián', 'es', v)
  ON CONFLICT (display_name) DO NOTHING; END IF;

SELECT id INTO v FROM canonical_ingredients WHERE canonical_name = 'cardamom';
IF v IS NOT NULL THEN INSERT INTO ingredient_aliases (display_name, language, canonical_ingredient_id) VALUES
  ('Cardamomo', 'es', v), ('Cardamomo en polvo', 'es', v)
  ON CONFLICT (display_name) DO NOTHING; END IF;

SELECT id INTO v FROM canonical_ingredients WHERE canonical_name = 'nutmeg';
IF v IS NOT NULL THEN INSERT INTO ingredient_aliases (display_name, language, canonical_ingredient_id) VALUES
  ('Nuez moscada', 'es', v), ('Nuez moscada rallada', 'es', v)
  ON CONFLICT (display_name) DO NOTHING; END IF;

SELECT id INTO v FROM canonical_ingredients WHERE canonical_name = 'saffron';
IF v IS NOT NULL THEN INSERT INTO ingredient_aliases (display_name, language, canonical_ingredient_id) VALUES
  ('Azafrán', 'es', v), ('Azafrán español', 'es', v)
  ON CONFLICT (display_name) DO NOTHING; END IF;

SELECT id INTO v FROM canonical_ingredients WHERE canonical_name = 'dill';
IF v IS NOT NULL THEN INSERT INTO ingredient_aliases (display_name, language, canonical_ingredient_id) VALUES
  ('Eneldo', 'es', v), ('Eneldo fresco', 'es', v)
  ON CONFLICT (display_name) DO NOTHING; END IF;

SELECT id INTO v FROM canonical_ingredients WHERE canonical_name = 'sage';
IF v IS NOT NULL THEN INSERT INTO ingredient_aliases (display_name, language, canonical_ingredient_id) VALUES
  ('Salvia', 'es', v), ('Salvia fresca', 'es', v)
  ON CONFLICT (display_name) DO NOTHING; END IF;

SELECT id INTO v FROM canonical_ingredients WHERE canonical_name = 'tarragon';
IF v IS NOT NULL THEN INSERT INTO ingredient_aliases (display_name, language, canonical_ingredient_id) VALUES
  ('Estragón', 'es', v), ('Estragón fresco', 'es', v)
  ON CONFLICT (display_name) DO NOTHING; END IF;

SELECT id INTO v FROM canonical_ingredients WHERE canonical_name = 'chives';
IF v IS NOT NULL THEN INSERT INTO ingredient_aliases (display_name, language, canonical_ingredient_id) VALUES
  ('Cebollino', 'es', v), ('Ciboulette', 'es', v)
  ON CONFLICT (display_name) DO NOTHING; END IF;

SELECT id INTO v FROM canonical_ingredients WHERE canonical_name = 'garlic_powder';
IF v IS NOT NULL THEN INSERT INTO ingredient_aliases (display_name, language, canonical_ingredient_id) VALUES
  ('Ajo en polvo', 'es', v), ('Polvo de ajo', 'es', v), ('Ajo granulado', 'es', v)
  ON CONFLICT (display_name) DO NOTHING; END IF;

SELECT id INTO v FROM canonical_ingredients WHERE canonical_name = 'onion_powder';
IF v IS NOT NULL THEN INSERT INTO ingredient_aliases (display_name, language, canonical_ingredient_id) VALUES
  ('Cebolla en polvo', 'es', v), ('Polvo de cebolla', 'es', v)
  ON CONFLICT (display_name) DO NOTHING; END IF;

SELECT id INTO v FROM canonical_ingredients WHERE canonical_name = 'adobo';
IF v IS NOT NULL THEN INSERT INTO ingredient_aliases (display_name, language, canonical_ingredient_id) VALUES
  ('Adobo', 'es', v), ('Condimento adobo', 'es', v)
  ON CONFLICT (display_name) DO NOTHING; END IF;

-- ============================================================
-- OILS (Aceites)
-- ============================================================
SELECT id INTO v FROM canonical_ingredients WHERE canonical_name = 'olive_oil';
IF v IS NOT NULL THEN INSERT INTO ingredient_aliases (display_name, language, canonical_ingredient_id) VALUES
  ('Aceite de oliva', 'es', v), ('Aceite de oliva virgen extra', 'es', v),
  ('AOVE', 'es', v), ('Aceite de oliva extra virgen', 'es', v)
  ON CONFLICT (display_name) DO NOTHING; END IF;

SELECT id INTO v FROM canonical_ingredients WHERE canonical_name = 'vegetable_oil';
IF v IS NOT NULL THEN INSERT INTO ingredient_aliases (display_name, language, canonical_ingredient_id) VALUES
  ('Aceite vegetal', 'es', v), ('Aceite de maíz', 'es', v),
  ('Aceite de girasol', 'es', v), ('Aceite de canola', 'es', v),
  ('Aceite de cocina', 'es', v)
  ON CONFLICT (display_name) DO NOTHING; END IF;

SELECT id INTO v FROM canonical_ingredients WHERE canonical_name = 'sesame_oil';
IF v IS NOT NULL THEN INSERT INTO ingredient_aliases (display_name, language, canonical_ingredient_id) VALUES
  ('Aceite de ajonjolí', 'es', v), ('Aceite de sésamo', 'es', v)
  ON CONFLICT (display_name) DO NOTHING; END IF;

-- ============================================================
-- CONDIMENTS / SAUCES (Condimentos / Salsas)
-- ============================================================
SELECT id INTO v FROM canonical_ingredients WHERE canonical_name = 'salsa';
IF v IS NOT NULL THEN INSERT INTO ingredient_aliases (display_name, language, canonical_ingredient_id) VALUES
  ('Salsa', 'es', v), ('Salsa verde', 'es', v), ('Salsa roja', 'es', v),
  ('Salsa mexicana', 'es', v), ('Salsa tatemada', 'es', v), ('Salsa macha', 'es', v),
  ('Salsa habanero', 'es', v), ('Salsa de chile', 'es', v)
  ON CONFLICT (display_name) DO NOTHING; END IF;

SELECT id INTO v FROM canonical_ingredients WHERE canonical_name = 'mayonnaise';
IF v IS NOT NULL THEN INSERT INTO ingredient_aliases (display_name, language, canonical_ingredient_id) VALUES
  ('Mayonesa', 'es', v), ('Mayonesa casera', 'es', v)
  ON CONFLICT (display_name) DO NOTHING; END IF;

SELECT id INTO v FROM canonical_ingredients WHERE canonical_name = 'mustard';
IF v IS NOT NULL THEN INSERT INTO ingredient_aliases (display_name, language, canonical_ingredient_id) VALUES
  ('Mostaza', 'es', v), ('Mostaza Dijon', 'es', v), ('Mostaza amarilla', 'es', v)
  ON CONFLICT (display_name) DO NOTHING; END IF;

SELECT id INTO v FROM canonical_ingredients WHERE canonical_name = 'ketchup';
IF v IS NOT NULL THEN INSERT INTO ingredient_aliases (display_name, language, canonical_ingredient_id) VALUES
  ('Catsup', 'es', v), ('Kétchup', 'es', v), ('Salsa de tomate dulce', 'es', v)
  ON CONFLICT (display_name) DO NOTHING; END IF;

SELECT id INTO v FROM canonical_ingredients WHERE canonical_name = 'tomato_paste';
IF v IS NOT NULL THEN INSERT INTO ingredient_aliases (display_name, language, canonical_ingredient_id) VALUES
  ('Concentrado de tomate', 'es', v), ('Pasta de tomate', 'es', v),
  ('Puré de tomate concentrado', 'es', v)
  ON CONFLICT (display_name) DO NOTHING; END IF;

SELECT id INTO v FROM canonical_ingredients WHERE canonical_name = 'tomato_sauce';
IF v IS NOT NULL THEN INSERT INTO ingredient_aliases (display_name, language, canonical_ingredient_id) VALUES
  ('Salsa de tomate', 'es', v), ('Puré de tomate', 'es', v),
  ('Salsa de jitomate', 'es', v)
  ON CONFLICT (display_name) DO NOTHING; END IF;

SELECT id INTO v FROM canonical_ingredients WHERE canonical_name = 'vinegar';
IF v IS NOT NULL THEN INSERT INTO ingredient_aliases (display_name, language, canonical_ingredient_id) VALUES
  ('Vinagre', 'es', v), ('Vinagre blanco', 'es', v), ('Vinagre de manzana', 'es', v),
  ('Vinagre balsámico', 'es', v), ('Vinagre de vino tinto', 'es', v)
  ON CONFLICT (display_name) DO NOTHING; END IF;

SELECT id INTO v FROM canonical_ingredients WHERE canonical_name = 'fish_sauce';
IF v IS NOT NULL THEN INSERT INTO ingredient_aliases (display_name, language, canonical_ingredient_id) VALUES
  ('Salsa de pescado', 'es', v), ('Salsa de ostión', 'es', v)
  ON CONFLICT (display_name) DO NOTHING; END IF;

SELECT id INTO v FROM canonical_ingredients WHERE canonical_name = 'capers';
IF v IS NOT NULL THEN INSERT INTO ingredient_aliases (display_name, language, canonical_ingredient_id) VALUES
  ('Alcaparras', 'es', v), ('Alcaparra', 'es', v)
  ON CONFLICT (display_name) DO NOTHING; END IF;

SELECT id INTO v FROM canonical_ingredients WHERE canonical_name = 'pickles';
IF v IS NOT NULL THEN INSERT INTO ingredient_aliases (display_name, language, canonical_ingredient_id) VALUES
  ('Encurtidos', 'es', v), ('Pepinillos', 'es', v), ('Chiles en vinagre', 'es', v),
  ('Jalapeños encurtidos', 'es', v), ('Verduras encurtidas', 'es', v)
  ON CONFLICT (display_name) DO NOTHING; END IF;

SELECT id INTO v FROM canonical_ingredients WHERE canonical_name = 'caramel';
IF v IS NOT NULL THEN INSERT INTO ingredient_aliases (display_name, language, canonical_ingredient_id) VALUES
  ('Caramelo', 'es', v), ('Cajeta', 'es', v), ('Dulce de leche', 'es', v)
  ON CONFLICT (display_name) DO NOTHING; END IF;

SELECT id INTO v FROM canonical_ingredients WHERE canonical_name = 'chili_oil';
IF v IS NOT NULL THEN INSERT INTO ingredient_aliases (display_name, language, canonical_ingredient_id) VALUES
  ('Aceite de chile', 'es', v), ('Aceite picante', 'es', v)
  ON CONFLICT (display_name) DO NOTHING; END IF;

SELECT id INTO v FROM canonical_ingredients WHERE canonical_name = 'chili_paste';
IF v IS NOT NULL THEN INSERT INTO ingredient_aliases (display_name, language, canonical_ingredient_id) VALUES
  ('Pasta de chile', 'es', v), ('Pasta de chipotle', 'es', v)
  ON CONFLICT (display_name) DO NOTHING; END IF;

SELECT id INTO v FROM canonical_ingredients WHERE canonical_name = 'hummus';
IF v IS NOT NULL THEN INSERT INTO ingredient_aliases (display_name, language, canonical_ingredient_id) VALUES
  ('Hummus de garbanzo', 'es', v)
  ON CONFLICT (display_name) DO NOTHING; END IF;

SELECT id INTO v FROM canonical_ingredients WHERE canonical_name = 'aioli';
IF v IS NOT NULL THEN INSERT INTO ingredient_aliases (display_name, language, canonical_ingredient_id) VALUES
  ('Alioli', 'es', v), ('Alioli de ajo', 'es', v)
  ON CONFLICT (display_name) DO NOTHING; END IF;

SELECT id INTO v FROM canonical_ingredients WHERE canonical_name = 'maple_syrup';
IF v IS NOT NULL THEN INSERT INTO ingredient_aliases (display_name, language, canonical_ingredient_id) VALUES
  ('Jarabe de maple', 'es', v), ('Miel de maple', 'es', v), ('Sirope de arce', 'es', v)
  ON CONFLICT (display_name) DO NOTHING; END IF;

-- ============================================================
-- SWEETENERS (Endulzantes)
-- ============================================================
SELECT id INTO v FROM canonical_ingredients WHERE canonical_name = 'sugar';
IF v IS NOT NULL THEN INSERT INTO ingredient_aliases (display_name, language, canonical_ingredient_id) VALUES
  ('Azúcar', 'es', v), ('Azúcar blanca', 'es', v), ('Azúcar morena', 'es', v),
  ('Azúcar mascabado', 'es', v), ('Piloncillo', 'es', v), ('Panela', 'es', v),
  ('Azúcar glass', 'es', v), ('Azúcar refinada', 'es', v)
  ON CONFLICT (display_name) DO NOTHING; END IF;

SELECT id INTO v FROM canonical_ingredients WHERE canonical_name = 'honey';
IF v IS NOT NULL THEN INSERT INTO ingredient_aliases (display_name, language, canonical_ingredient_id) VALUES
  ('Miel', 'es', v), ('Miel de abeja', 'es', v), ('Miel orgánica', 'es', v)
  ON CONFLICT (display_name) DO NOTHING; END IF;

SELECT id INTO v FROM canonical_ingredients WHERE canonical_name = 'baking_powder';
IF v IS NOT NULL THEN INSERT INTO ingredient_aliases (display_name, language, canonical_ingredient_id) VALUES
  ('Polvo para hornear', 'es', v), ('Royal', 'es', v), ('Levadura en polvo', 'es', v)
  ON CONFLICT (display_name) DO NOTHING; END IF;

SELECT id INTO v FROM canonical_ingredients WHERE canonical_name = 'baking_soda';
IF v IS NOT NULL THEN INSERT INTO ingredient_aliases (display_name, language, canonical_ingredient_id) VALUES
  ('Bicarbonato', 'es', v), ('Bicarbonato de sodio', 'es', v)
  ON CONFLICT (display_name) DO NOTHING; END IF;

-- ============================================================
-- BEVERAGES (Bebidas)
-- ============================================================
SELECT id INTO v FROM canonical_ingredients WHERE canonical_name = 'coffee';
IF v IS NOT NULL THEN INSERT INTO ingredient_aliases (display_name, language, canonical_ingredient_id) VALUES
  ('Café', 'es', v), ('Café negro', 'es', v), ('Café de olla', 'es', v),
  ('Café americano', 'es', v), ('Café molido', 'es', v), ('Café soluble', 'es', v),
  ('Espresso', 'es', v)
  ON CONFLICT (display_name) DO NOTHING; END IF;

SELECT id INTO v FROM canonical_ingredients WHERE canonical_name = 'tea';
IF v IS NOT NULL THEN INSERT INTO ingredient_aliases (display_name, language, canonical_ingredient_id) VALUES
  ('Té', 'es', v), ('Té negro', 'es', v), ('Té verde', 'es', v),
  ('Infusión', 'es', v), ('Tisana', 'es', v)
  ON CONFLICT (display_name) DO NOTHING; END IF;

SELECT id INTO v FROM canonical_ingredients WHERE canonical_name = 'water';
IF v IS NOT NULL THEN INSERT INTO ingredient_aliases (display_name, language, canonical_ingredient_id) VALUES
  ('Agua', 'es', v), ('Agua purificada', 'es', v), ('Agua mineral', 'es', v),
  ('Agua de sabor', 'es', v)
  ON CONFLICT (display_name) DO NOTHING; END IF;

SELECT id INTO v FROM canonical_ingredients WHERE canonical_name = 'wine';
IF v IS NOT NULL THEN INSERT INTO ingredient_aliases (display_name, language, canonical_ingredient_id) VALUES
  ('Vino', 'es', v), ('Vino tinto', 'es', v), ('Vino blanco', 'es', v),
  ('Vino rosado', 'es', v), ('Vino de cocina', 'es', v)
  ON CONFLICT (display_name) DO NOTHING; END IF;

SELECT id INTO v FROM canonical_ingredients WHERE canonical_name = 'broth';
IF v IS NOT NULL THEN INSERT INTO ingredient_aliases (display_name, language, canonical_ingredient_id) VALUES
  ('Caldo', 'es', v), ('Caldo de pollo', 'es', v), ('Caldo de res', 'es', v),
  ('Caldo de verduras', 'es', v), ('Consomé', 'es', v), ('Consomé de pollo', 'es', v)
  ON CONFLICT (display_name) DO NOTHING; END IF;

-- ============================================================
-- OTHER
-- ============================================================
SELECT id INTO v FROM canonical_ingredients WHERE canonical_name = 'chocolate';
IF v IS NOT NULL THEN INSERT INTO ingredient_aliases (display_name, language, canonical_ingredient_id) VALUES
  ('Chocolate', 'es', v), ('Chocolate oscuro', 'es', v), ('Chocolate amargo', 'es', v),
  ('Cacao', 'es', v), ('Polvo de cacao', 'es', v), ('Cocoa', 'es', v),
  ('Chocolate de mesa', 'es', v), ('Chocolate Abuelita', 'es', v)
  ON CONFLICT (display_name) DO NOTHING; END IF;

SELECT id INTO v FROM canonical_ingredients WHERE canonical_name = 'seaweed';
IF v IS NOT NULL THEN INSERT INTO ingredient_aliases (display_name, language, canonical_ingredient_id) VALUES
  ('Alga', 'es', v), ('Alga marina', 'es', v), ('Algas', 'es', v)
  ON CONFLICT (display_name) DO NOTHING; END IF;

SELECT id INTO v FROM canonical_ingredients WHERE canonical_name = 'tofu';
IF v IS NOT NULL THEN INSERT INTO ingredient_aliases (display_name, language, canonical_ingredient_id) VALUES
  ('Tofu firme', 'es', v), ('Tofu sedoso', 'es', v), ('Queso de soya', 'es', v)
  ON CONFLICT (display_name) DO NOTHING; END IF;

SELECT id INTO v FROM canonical_ingredients WHERE canonical_name = 'tempeh';
IF v IS NOT NULL THEN INSERT INTO ingredient_aliases (display_name, language, canonical_ingredient_id) VALUES
  ('Tempeh de soya', 'es', v)
  ON CONFLICT (display_name) DO NOTHING; END IF;

RAISE NOTICE '========================================';
RAISE NOTICE 'Spanish aliases migration complete!';
RAISE NOTICE 'Total ingredient aliases: %', (SELECT COUNT(*) FROM ingredient_aliases);
RAISE NOTICE 'Spanish aliases: %', (SELECT COUNT(*) FROM ingredient_aliases WHERE language = 'es');
RAISE NOTICE '========================================';

END $$;
