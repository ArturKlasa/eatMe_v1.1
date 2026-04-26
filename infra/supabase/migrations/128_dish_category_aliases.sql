-- 128_dish_category_aliases.sql
-- Created: 2026-04-25
--
-- Fixes the cross-language and plural-mismatch problem the menu-scan worker
-- has been hitting (e.g. "Hamburguesas" or "Burgers" not matching "Burger").
-- Adds two complementary mechanisms:
--
--   1. dish_categories.aliases text[] — explicit synonym list per row.
--      Populated initially with common cross-language and plural variants
--      for high-traffic entries (Burger, Pizza, Taco, Hot Dog, Salad, Wings,
--      coffee/tea/cocktails, etc.). Admins can extend per-row over time.
--
--   2. fuzzy_match_dish_category() rewritten as PL/pgSQL with two tiers:
--        Tier 1: exact alias OR exact name match after f_unaccent(lower(…))
--                normalization. Returns score = 1.0.
--        Tier 2: trigram fuzzy fallback against name only. Threshold lowered
--                from 0.7 → 0.6 so "Burger" / "Burgers" (similarity ≈ 0.667)
--                clears it. Aliases bridge the cases fuzzy can't (cross-lang).
--
-- Reverse: 128_REVERSE_ONLY_dish_category_aliases.sql

BEGIN;

-- ── (1) aliases column ──────────────────────────────────────────────────────
ALTER TABLE public.dish_categories
  ADD COLUMN IF NOT EXISTS aliases text[] NOT NULL DEFAULT '{}';

-- ── (2) Two-tier fuzzy_match_dish_category ──────────────────────────────────
-- PL/pgSQL because we want explicit short-circuit between tiers (RETURN early
-- on tier-1 hit instead of UNION-ing both and ORDER-BY-ing).
CREATE OR REPLACE FUNCTION public.fuzzy_match_dish_category(p_query text)
RETURNS TABLE (id uuid, name text, score real)
LANGUAGE plpgsql
STABLE
PARALLEL SAFE
AS $$
DECLARE
  v_q text := public.f_unaccent(lower(p_query));
BEGIN
  -- Tier 1: exact name OR exact alias match (after normalize). Score = 1.0.
  RETURN QUERY
    SELECT dc.id, dc.name, 1.0::real AS score
    FROM public.dish_categories dc
    WHERE dc.is_active
      AND (
        public.f_unaccent(lower(dc.name)) = v_q
        OR EXISTS (
          SELECT 1 FROM unnest(dc.aliases) AS alias
          WHERE public.f_unaccent(lower(alias)) = v_q
        )
      )
    LIMIT 1;

  IF FOUND THEN RETURN; END IF;

  -- Tier 2: trigram fuzzy fallback against name. Threshold 0.6 catches
  -- inflections ("Burger"/"Burgers" ≈ 0.667) without exploding false positives.
  -- The `%` operator uses pg_trgm's default similarity_threshold (0.3) for
  -- index pruning; the explicit similarity() > 0.6 filter is the truth.
  RETURN QUERY
    SELECT
      dc.id,
      dc.name,
      similarity(public.f_unaccent(lower(dc.name)), v_q) AS score
    FROM public.dish_categories dc
    WHERE dc.is_active
      AND public.f_unaccent(lower(dc.name)) % v_q
      AND similarity(public.f_unaccent(lower(dc.name)), v_q) > 0.6
    ORDER BY score DESC
    LIMIT 1;
END;
$$;

REVOKE ALL ON FUNCTION public.fuzzy_match_dish_category(text) FROM public;
GRANT EXECUTE ON FUNCTION public.fuzzy_match_dish_category(text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.fuzzy_match_dish_category(text) TO service_role;

-- ── (3) Seed common aliases for high-traffic categories ─────────────────────
-- Idempotent: appends and dedupes, so re-running the migration won't strip
-- admin-added aliases or create duplicates.
UPDATE public.dish_categories dc
SET aliases = ARRAY(
  SELECT DISTINCT a
  FROM unnest(dc.aliases || v.aliases) AS a
)
FROM (VALUES
  -- Sandwiches & handhelds
  ('Burger', ARRAY['Burgers', 'Hamburger', 'Hamburgers', 'Hamburguesa', 'Hamburguesas']),
  ('Cheeseburger', ARRAY['Cheeseburgers', 'Hamburguesa con Queso', 'Hamburguesas con Queso']),
  ('Hot Dog', ARRAY['Hot Dogs', 'Hotdog', 'Hotdogs', 'Salchicha', 'Salchichas', 'Frankfurt', 'Frankfurters']),
  ('Sandwich', ARRAY['Sandwiches', 'Sándwich', 'Sándwiches', 'Sanduiche', 'Kanapka', 'Kanapki']),
  ('Club Sandwich', ARRAY['Club Sándwich', 'Club Sandwiches']),
  ('Chicken Sandwich', ARRAY['Chicken Sandwiches', 'Sándwich de Pollo', 'Sandwich de Pollo']),
  ('Crispy Chicken Sandwich', ARRAY['Crispy Chicken Sandwiches']),
  ('Wrap', ARRAY['Wraps', 'Wrapy']),
  ('Bagel', ARRAY['Bagels', 'Bajgiel', 'Bajgle']),
  ('Croissant', ARRAY['Croissants', 'Cruasán', 'Cruasanes']),
  ('Panini', ARRAY['Paninis', 'Panino']),

  -- Mexican / Latin (most categories already in source language;
  -- aliases mostly cover English plurals and common spellings)
  ('Taco', ARRAY['Tacos']),
  ('Burrito', ARRAY['Burritos']),
  ('Quesadilla', ARRAY['Quesadillas']),
  ('Enchilada', ARRAY['Enchiladas']),
  ('Tostada', ARRAY['Tostadas']),
  ('Sope', ARRAY['Sopes']),
  ('Flauta', ARRAY['Flautas']),
  ('Tamale', ARRAY['Tamales', 'Tamal']),
  ('Empanada', ARRAY['Empanadas']),
  ('Arepa', ARRAY['Arepas']),
  ('Pupusa', ARRAY['Pupusas']),
  ('Mole', ARRAY['Moles', 'Mole Sauce']),
  ('Pozole', ARRAY['Pozoles', 'Posole', 'Pozolé']),
  ('Birria', ARRAY['Birrias']),
  ('Ceviche', ARRAY['Cebiche', 'Ceviches', 'Cebiches', 'Sebiche']),
  ('Salchipapas', ARRAY['Salchipapa', 'Salchi-Papas', 'Salchichas con Papas', 'Hot Dog con Papas']),
  ('Plantains', ARRAY['Plátanos', 'Plátano', 'Plantain', 'Banano Frito', 'Bananas Fritas']),
  ('Maduros', ARRAY['Plátanos Maduros', 'Sweet Plantains']),
  ('Tostones', ARRAY['Patacones']),

  -- Sides
  ('Fries', ARRAY['French Fries', 'Papas Fritas', 'Papas a la Francesa', 'Frytki']),
  ('Sweet Potato Fries', ARRAY['Papas Camote Fritas', 'Boniato Frito']),
  ('Loaded Fries', ARRAY['Loaded French Fries']),
  ('Onion Rings', ARRAY['Aros de Cebolla']),
  ('Mozzarella Sticks', ARRAY['Palitos de Mozzarella', 'Mozzarella']),
  ('Nopales', ARRAY['Nopalitos']),

  -- Salads & soups & bowls
  ('Salad', ARRAY['Salads', 'Ensalada', 'Ensaladas', 'Sałatka', 'Sałatki']),
  ('Caesar Salad', ARRAY['Caesar Salads', 'Ensalada César', 'Ensalada Cesar']),
  ('Greek Salad', ARRAY['Ensalada Griega']),
  ('Soup', ARRAY['Soups', 'Sopa', 'Sopas', 'Zupa', 'Zupy']),
  ('Bowl', ARRAY['Bowls', 'Bol', 'Boles', 'Tazón', 'Miska', 'Miski']),
  ('Poke Bowl', ARRAY['Poke Bowls', 'Poke']),

  -- Wings & chicken
  ('Wings', ARRAY['Wing', 'Alitas', 'Alas', 'Alitas de Pollo', 'Skrzydełka', 'Skrzydła']),
  ('Chicken Wings', ARRAY['Wings de Pollo']),
  ('Chicken Tenders', ARRAY['Chicken Strips', 'Tiras de Pollo', 'Tiras Pollo', 'Pollo en Tiras', 'Strips de Pollo']),
  ('Chicken Nuggets', ARRAY['Nuggets de Pollo', 'Nuggets']),
  ('Fried Chicken', ARRAY['Pollo Frito', 'Smażony Kurczak']),
  ('Roast Chicken', ARRAY['Pollo Rostizado', 'Pieczony Kurczak']),
  ('Pollo a la Brasa', ARRAY['Pollo Asado a la Leña', 'Pollo Rotisserie']),

  -- Beef
  ('Steak', ARRAY['Steaks', 'Filete', 'Bistec', 'Bistek', 'Stek']),
  ('Carne Asada', ARRAY['Carne Asada Plate']),
  ('Ribeye Steak', ARRAY['Ribeye']),

  -- Italian
  ('Pizza', ARRAY['Pizzas']),
  ('Pasta', ARRAY['Pastas', 'Macarrones', 'Makaron']),
  ('Lasagna', ARRAY['Lasagnas', 'Lasaña', 'Lasagne']),
  ('Risotto', ARRAY['Risottos']),
  ('Gnocchi', ARRAY['Ñoquis', 'Nokis']),
  ('Calzone', ARRAY['Calzones']),

  -- Asian
  ('Sushi Roll', ARRAY['Sushi Rolls', 'Maki']),
  ('Ramen', ARRAY['Ramens']),
  ('Pho', ARRAY['Phở']),
  ('Curry', ARRAY['Curries']),
  ('Pad Thai', ARRAY['Padthai']),
  ('Spring Roll', ARRAY['Spring Rolls', 'Egg Roll', 'Egg Rolls']),
  ('Dumpling', ARRAY['Dumplings', 'Pierogi Azjatyckie']),

  -- Eastern European
  ('Pierogi', ARRAY['Pierogis', 'Pieróg', 'Pierożek']),
  ('Schnitzel', ARRAY['Schnitzels', 'Sznycel']),
  ('Goulash', ARRAY['Gulasz']),

  -- Breakfast
  ('Pancake', ARRAY['Pancakes', 'Hotcake', 'Hotcakes', 'Tortita', 'Tortitas']),
  ('Waffle', ARRAY['Waffles', 'Gofre', 'Gofres', 'Gofr', 'Gofry']),
  ('Crepe', ARRAY['Crepes', 'Crêpe', 'Crêpes', 'Naleśnik', 'Naleśniki']),
  ('Omelette', ARRAY['Omelet', 'Omelettes', 'Omelets', 'Omlet', 'Omlety']),
  ('French Toast', ARRAY['Tostadas Francesas', 'Pan Tostado Francés', 'Tosty Francuskie']),
  ('Eggs Benedict', ARRAY['Huevos Benedictinos', 'Jajka po Benedyktyńsku']),

  -- Sweets
  ('Donut', ARRAY['Donuts', 'Doughnut', 'Doughnuts', 'Dona', 'Donas', 'Pączek', 'Pączki']),
  ('Cake', ARRAY['Cakes', 'Pastel', 'Pasteles', 'Ciasto', 'Ciasta']),
  ('Cheesecake', ARRAY['Cheesecakes', 'Pastel de Queso', 'Sernik']),
  ('Ice Cream', ARRAY['Helado', 'Helados', 'Lody']),
  ('Tres Leches', ARRAY['Pastel Tres Leches', 'Torta Tres Leches']),

  -- ── Drinks ──
  ('Coffee', ARRAY['Coffees', 'Café', 'Cafe', 'Cafés', 'Kawa']),
  ('Espresso', ARRAY['Expresso', 'Expressos', 'Café Espresso', 'Espressos']),
  ('Americano', ARRAY['Café Americano']),
  ('Latte', ARRAY['Lattes', 'Café Latte', 'Caffè Latte']),
  ('Cappuccino', ARRAY['Cappuccinos', 'Capuchino', 'Capuchinos', 'Cappucino', 'Kapucyno']),
  ('Mocha', ARRAY['Mochas', 'Mocachino', 'Mocaccino']),
  ('Cortado', ARRAY['Cortados']),
  ('Macchiato', ARRAY['Macchiatos']),
  ('Flat White', ARRAY['Flat Whites']),
  ('Hot Chocolate', ARRAY['Chocolate Caliente', 'Gorąca Czekolada']),

  ('Tea', ARRAY['Teas', 'Té', 'Té Caliente', 'Herbata', 'Herbaty']),
  ('Iced Tea', ARRAY['Iced Teas', 'Té Helado', 'Mrożona Herbata']),
  ('Chai', ARRAY['Chai Tea']),
  ('Bubble Tea', ARRAY['Boba', 'Boba Tea', 'Pearl Milk Tea']),

  ('Beer', ARRAY['Beers', 'Cerveza', 'Cervezas', 'Piwo', 'Piwa']),
  ('Wine', ARRAY['Wines', 'Vino', 'Vinos', 'Wino', 'Wina']),
  ('Red Wine', ARRAY['Vino Tinto', 'Wino Czerwone']),
  ('White Wine', ARRAY['Vino Blanco', 'Wino Białe']),
  ('Sangria', ARRAY['Sangrias']),
  ('Champagne', ARRAY['Champán', 'Szampan']),

  ('Margarita', ARRAY['Margaritas']),
  ('Mojito', ARRAY['Mojitos']),
  ('Cocktail', ARRAY['Cocktails', 'Coctel', 'Cócteles', 'Cocteles', 'Koktajl', 'Koktajle']),
  ('Mocktail', ARRAY['Mocktails']),

  ('Lemonade', ARRAY['Lemonades', 'Limonada', 'Limonadas', 'Lemoniada', 'Lemoniady']),
  ('Smoothie', ARRAY['Smoothies', 'Batido', 'Batidos']),
  ('Milkshake', ARRAY['Milkshakes', 'Malteada', 'Malteadas', 'Koktajl Mleczny']),
  ('Fresh Juice', ARRAY['Jugo', 'Jugos', 'Sok', 'Soki', 'Zumo', 'Zumos']),
  ('Orange Juice', ARRAY['Jugo de Naranja', 'Naranjada', 'Sok Pomarańczowy', 'Zumo de Naranja']),
  ('Soda', ARRAY['Sodas', 'Refresco', 'Refrescos', 'Napój Gazowany']),
  ('Sparkling Water', ARRAY['Agua Mineral', 'Woda Gazowana']),
  ('Kombucha', ARRAY['Kombuchy'])
) AS v(name, aliases)
WHERE lower(dc.name) = lower(v.name);

COMMIT;
