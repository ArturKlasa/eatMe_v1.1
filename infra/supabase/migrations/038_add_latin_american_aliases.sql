-- Migration 038: Multi-language aliases for Latin American ingredients
--
-- UNTRANSLATABLE-TERM STRATEGY
-- ─────────────────────────────────────────────────────────────────────────────
-- Many LatAm culinary terms are loanwords adopted into English
-- (taco, tamale, mole, arepa, ceviche, empanada, caipirinhas…).
-- For these we insert BOTH an English alias AND the regional-language alias
-- pointing to the same canonical.  That way the DB lookup (Pass 1 of
-- matchIngredients) succeeds regardless of which language the menu is written in,
-- and the AI translation fallback is never invoked for these terms.
--
-- Terms that DO have a standard English translation (e.g. "grasshoppers" for
-- "chapulines") get an 'en' alias with the English word so the AI is not needed.
--
-- Covered languages:
--   'en'  – English (including loanword aliases)
--   'es'  – Spanish (Mexican, Colombian, Peruvian, Argentinian)
--   'pt'  – Portuguese (Brazilian)
-- ─────────────────────────────────────────────────────────────────────────────

DO $$
DECLARE v UUID;
BEGIN

-- ============================================================
-- ADD Milanesa de pollo to chicken (requested)
-- ============================================================
SELECT id INTO v FROM canonical_ingredients WHERE canonical_name = 'chicken';
IF v IS NOT NULL THEN
  INSERT INTO ingredient_aliases (display_name, language, canonical_ingredient_id) VALUES
    ('Milanesa de pollo',       'es', v),
    ('Chicken milanesa',        'en', v),
    ('Escalope de pollo',       'es', v),
    ('Breaded chicken cutlet',  'en', v)
  ON CONFLICT (display_name) DO NOTHING;
END IF;

-- ============================================================
-- MEXICAN CHILES
-- ============================================================
SELECT id INTO v FROM canonical_ingredients WHERE canonical_name = 'chile_serrano';
IF v IS NOT NULL THEN
  INSERT INTO ingredient_aliases (display_name, language, canonical_ingredient_id) VALUES
    ('Chile serrano',     'es', v), ('Serrano',            'es', v),
    ('Serrano pepper',    'en', v), ('Chile serrano fresco','es', v)
  ON CONFLICT (display_name) DO NOTHING;
END IF;

SELECT id INTO v FROM canonical_ingredients WHERE canonical_name = 'chile_habanero';
IF v IS NOT NULL THEN
  INSERT INTO ingredient_aliases (display_name, language, canonical_ingredient_id) VALUES
    ('Chile habanero',   'es', v), ('Habanero',           'es', v),
    ('Habanero pepper',  'en', v), ('Chile habanero fresco','es', v)
  ON CONFLICT (display_name) DO NOTHING;
END IF;

SELECT id INTO v FROM canonical_ingredients WHERE canonical_name = 'chile_chipotle';
IF v IS NOT NULL THEN
  INSERT INTO ingredient_aliases (display_name, language, canonical_ingredient_id) VALUES
    ('Chile chipotle',        'es', v), ('Chipotle',             'es', v),
    ('Chipotle pepper',       'en', v), ('Chile chipotle adobado','es', v),
    ('Chipotles en adobo',    'es', v), ('Chipotle in adobo',    'en', v)
  ON CONFLICT (display_name) DO NOTHING;
END IF;

SELECT id INTO v FROM canonical_ingredients WHERE canonical_name = 'chile_ancho';
IF v IS NOT NULL THEN
  INSERT INTO ingredient_aliases (display_name, language, canonical_ingredient_id) VALUES
    ('Chile ancho',    'es', v), ('Ancho chile',     'en', v),
    ('Ancho pepper',   'en', v), ('Chile ancho seco','es', v)
  ON CONFLICT (display_name) DO NOTHING;
END IF;

SELECT id INTO v FROM canonical_ingredients WHERE canonical_name = 'chile_guajillo';
IF v IS NOT NULL THEN
  INSERT INTO ingredient_aliases (display_name, language, canonical_ingredient_id) VALUES
    ('Chile guajillo',  'es', v), ('Guajillo chile',  'en', v),
    ('Guajillo pepper', 'en', v)
  ON CONFLICT (display_name) DO NOTHING;
END IF;

SELECT id INTO v FROM canonical_ingredients WHERE canonical_name = 'chile_mulato';
IF v IS NOT NULL THEN
  INSERT INTO ingredient_aliases (display_name, language, canonical_ingredient_id) VALUES
    ('Chile mulato', 'es', v), ('Mulato chile', 'en', v)
  ON CONFLICT (display_name) DO NOTHING;
END IF;

SELECT id INTO v FROM canonical_ingredients WHERE canonical_name = 'chile_pasilla';
IF v IS NOT NULL THEN
  INSERT INTO ingredient_aliases (display_name, language, canonical_ingredient_id) VALUES
    ('Chile pasilla',  'es', v), ('Pasilla chile',   'en', v),
    ('Chile negro',    'es', v), ('Pasilla pepper',  'en', v)
  ON CONFLICT (display_name) DO NOTHING;
END IF;

SELECT id INTO v FROM canonical_ingredients WHERE canonical_name = 'chile_de_arbol';
IF v IS NOT NULL THEN
  INSERT INTO ingredient_aliases (display_name, language, canonical_ingredient_id) VALUES
    ('Chile de árbol',       'es', v), ('Chile de arbol',     'es', v),
    ('Árbol chile',          'en', v), ('Chile de árbol seco','es', v)
  ON CONFLICT (display_name) DO NOTHING;
END IF;

SELECT id INTO v FROM canonical_ingredients WHERE canonical_name = 'chile_morita';
IF v IS NOT NULL THEN
  INSERT INTO ingredient_aliases (display_name, language, canonical_ingredient_id) VALUES
    ('Chile morita', 'es', v), ('Morita chile', 'en', v)
  ON CONFLICT (display_name) DO NOTHING;
END IF;

SELECT id INTO v FROM canonical_ingredients WHERE canonical_name = 'chile_cascabel';
IF v IS NOT NULL THEN
  INSERT INTO ingredient_aliases (display_name, language, canonical_ingredient_id) VALUES
    ('Chile cascabel', 'es', v), ('Cascabel chile', 'en', v), ('Cascabel pepper', 'en', v)
  ON CONFLICT (display_name) DO NOTHING;
END IF;

SELECT id INTO v FROM canonical_ingredients WHERE canonical_name = 'chile_poblano';
IF v IS NOT NULL THEN
  INSERT INTO ingredient_aliases (display_name, language, canonical_ingredient_id) VALUES
    ('Chile poblano',        'es', v), ('Poblano chile',      'en', v),
    ('Poblano pepper',       'en', v), ('Chile poblano fresco','es', v),
    ('Rajas de chile poblano','es',v), ('Poblano strips',     'en', v)
  ON CONFLICT (display_name) DO NOTHING;
END IF;

-- ============================================================
-- MEXICAN HERBS & SPICES
-- ============================================================
SELECT id INTO v FROM canonical_ingredients WHERE canonical_name = 'epazote';
IF v IS NOT NULL THEN
  INSERT INTO ingredient_aliases (display_name, language, canonical_ingredient_id) VALUES
    ('Epazote',             'es', v), ('Epazote',          'en', v),  -- loanword
    ('Hierba santa',        'es', v), ('Mexican tea herb', 'en', v)
  ON CONFLICT (display_name) DO NOTHING;
END IF;

SELECT id INTO v FROM canonical_ingredients WHERE canonical_name = 'hierba_santa';
IF v IS NOT NULL THEN
  INSERT INTO ingredient_aliases (display_name, language, canonical_ingredient_id) VALUES
    ('Hierba santa',  'es', v), ('Hoja santa',  'es', v),
    ('Hierba santa',  'en', v), ('Holy leaf',   'en', v)
  ON CONFLICT (display_name) DO NOTHING;
END IF;

SELECT id INTO v FROM canonical_ingredients WHERE canonical_name = 'achiote';
IF v IS NOT NULL THEN
  INSERT INTO ingredient_aliases (display_name, language, canonical_ingredient_id) VALUES
    ('Achiote',             'es', v), ('Achiote',          'en', v),
    ('Pasta de achiote',    'es', v), ('Achiote paste',    'en', v),
    ('Recado rojo',         'es', v), ('Annatto',          'en', v),
    ('Annatto paste',       'en', v)
  ON CONFLICT (display_name) DO NOTHING;
END IF;

SELECT id INTO v FROM canonical_ingredients WHERE canonical_name = 'annatto';
IF v IS NOT NULL THEN
  INSERT INTO ingredient_aliases (display_name, language, canonical_ingredient_id) VALUES
    ('Annatto seeds', 'en', v), ('Semillas de achiote', 'es', v)
  ON CONFLICT (display_name) DO NOTHING;
END IF;

-- ============================================================
-- MEXICAN VEGETABLES
-- ============================================================
SELECT id INTO v FROM canonical_ingredients WHERE canonical_name = 'tomatillo';
IF v IS NOT NULL THEN
  INSERT INTO ingredient_aliases (display_name, language, canonical_ingredient_id) VALUES
    ('Tomatillo',        'es', v), ('Tomatillo',          'en', v),
    ('Tomate verde',     'es', v), ('Tomatillo verde',    'es', v),
    ('Green tomatillo',  'en', v), ('Tomatillo fresco',   'es', v)
  ON CONFLICT (display_name) DO NOTHING;
END IF;

SELECT id INTO v FROM canonical_ingredients WHERE canonical_name = 'nopal';
IF v IS NOT NULL THEN
  INSERT INTO ingredient_aliases (display_name, language, canonical_ingredient_id) VALUES
    ('Nopal',             'es', v), ('Nopales',            'es', v),
    ('Nopal cactus',      'en', v), ('Cactus paddle',      'en', v),
    ('Nopalitos',         'es', v), ('Cactus strips',      'en', v)
  ON CONFLICT (display_name) DO NOTHING;
END IF;

SELECT id INTO v FROM canonical_ingredients WHERE canonical_name = 'huitlacoche';
IF v IS NOT NULL THEN
  INSERT INTO ingredient_aliases (display_name, language, canonical_ingredient_id) VALUES
    ('Huitlacoche',     'es', v), ('Huitlacoche',       'en', v),
    ('Cuitlacoche',     'es', v), ('Corn truffle',      'en', v),
    ('Corn fungus',     'en', v), ('Mexican truffle',   'en', v)
  ON CONFLICT (display_name) DO NOTHING;
END IF;

SELECT id INTO v FROM canonical_ingredients WHERE canonical_name = 'chayote';
IF v IS NOT NULL THEN
  INSERT INTO ingredient_aliases (display_name, language, canonical_ingredient_id) VALUES
    ('Chayote',         'es', v), ('Chayote',           'en', v),
    ('Güisquil',        'es', v), ('Chayote squash',    'en', v),
    ('Mirliton',        'en', v)
  ON CONFLICT (display_name) DO NOTHING;
END IF;

SELECT id INTO v FROM canonical_ingredients WHERE canonical_name = 'flor_de_calabaza';
IF v IS NOT NULL THEN
  INSERT INTO ingredient_aliases (display_name, language, canonical_ingredient_id) VALUES
    ('Flor de calabaza',   'es', v), ('Squash blossom',   'en', v),
    ('Flor de calabacita', 'es', v), ('Zucchini flower',  'en', v)
  ON CONFLICT (display_name) DO NOTHING;
END IF;

SELECT id INTO v FROM canonical_ingredients WHERE canonical_name = 'verdolaga';
IF v IS NOT NULL THEN
  INSERT INTO ingredient_aliases (display_name, language, canonical_ingredient_id) VALUES
    ('Verdolaga', 'es', v), ('Purslane', 'en', v)
  ON CONFLICT (display_name) DO NOTHING;
END IF;

SELECT id INTO v FROM canonical_ingredients WHERE canonical_name = 'quelites';
IF v IS NOT NULL THEN
  INSERT INTO ingredient_aliases (display_name, language, canonical_ingredient_id) VALUES
    ('Quelites', 'es', v), ('Wild greens', 'en', v), ('Mexican wild greens', 'en', v)
  ON CONFLICT (display_name) DO NOTHING;
END IF;

-- ============================================================
-- MEXICAN SAUCES (UNTRANSLATABLE)
-- ============================================================
SELECT id INTO v FROM canonical_ingredients WHERE canonical_name = 'mole';
IF v IS NOT NULL THEN
  INSERT INTO ingredient_aliases (display_name, language, canonical_ingredient_id) VALUES
    ('Mole',           'es', v), ('Mole',           'en', v),
    ('Salsa de mole',  'es', v), ('Mole sauce',     'en', v)
  ON CONFLICT (display_name) DO NOTHING;
END IF;

SELECT id INTO v FROM canonical_ingredients WHERE canonical_name = 'mole_negro';
IF v IS NOT NULL THEN
  INSERT INTO ingredient_aliases (display_name, language, canonical_ingredient_id) VALUES
    ('Mole negro', 'es', v), ('Mole negro',    'en', v),
    ('Black mole',  'en', v)
  ON CONFLICT (display_name) DO NOTHING;
END IF;

SELECT id INTO v FROM canonical_ingredients WHERE canonical_name = 'mole_rojo';
IF v IS NOT NULL THEN
  INSERT INTO ingredient_aliases (display_name, language, canonical_ingredient_id) VALUES
    ('Mole rojo', 'es', v), ('Red mole', 'en', v)
  ON CONFLICT (display_name) DO NOTHING;
END IF;

SELECT id INTO v FROM canonical_ingredients WHERE canonical_name = 'mole_verde';
IF v IS NOT NULL THEN
  INSERT INTO ingredient_aliases (display_name, language, canonical_ingredient_id) VALUES
    ('Mole verde', 'es', v), ('Green mole', 'en', v), ('Pipián verde', 'es', v)
  ON CONFLICT (display_name) DO NOTHING;
END IF;

SELECT id INTO v FROM canonical_ingredients WHERE canonical_name = 'pipian';
IF v IS NOT NULL THEN
  INSERT INTO ingredient_aliases (display_name, language, canonical_ingredient_id) VALUES
    ('Pipián',       'es', v), ('Pipian',        'en', v),
    ('Pipián rojo',  'es', v), ('Pepian sauce',  'en', v)
  ON CONFLICT (display_name) DO NOTHING;
END IF;

SELECT id INTO v FROM canonical_ingredients WHERE canonical_name = 'recado_rojo';
IF v IS NOT NULL THEN
  INSERT INTO ingredient_aliases (display_name, language, canonical_ingredient_id) VALUES
    ('Recado rojo',      'es', v), ('Recado rojo',      'en', v),
    ('Pasta de recado',  'es', v), ('Yucatecan achiote paste', 'en', v)
  ON CONFLICT (display_name) DO NOTHING;
END IF;

SELECT id INTO v FROM canonical_ingredients WHERE canonical_name = 'salsa_macha';
IF v IS NOT NULL THEN
  INSERT INTO ingredient_aliases (display_name, language, canonical_ingredient_id) VALUES
    ('Salsa macha', 'es', v), ('Salsa macha', 'en', v)
  ON CONFLICT (display_name) DO NOTHING;
END IF;

-- ============================================================
-- MEXICAN MASA PREPARATIONS (UNTRANSLATABLE)
-- ============================================================
SELECT id INTO v FROM canonical_ingredients WHERE canonical_name = 'masa';
IF v IS NOT NULL THEN
  INSERT INTO ingredient_aliases (display_name, language, canonical_ingredient_id) VALUES
    ('Masa',             'es', v), ('Masa',             'en', v),
    ('Masa de maíz',     'es', v), ('Masa dough',       'en', v),
    ('Masa preparada',   'es', v)
  ON CONFLICT (display_name) DO NOTHING;
END IF;

SELECT id INTO v FROM canonical_ingredients WHERE canonical_name = 'tamal';
IF v IS NOT NULL THEN
  INSERT INTO ingredient_aliases (display_name, language, canonical_ingredient_id) VALUES
    ('Tamal',      'es', v), ('Tamale',      'en', v),
    ('Tamales',    'es', v), ('Tamales',     'en', v),
    ('Tamal oaxaqueño',  'es', v), ('Tamal de rajas', 'es', v),
    ('Tamal de mole',    'es', v), ('Tamal de elote',  'es', v)
  ON CONFLICT (display_name) DO NOTHING;
END IF;

SELECT id INTO v FROM canonical_ingredients WHERE canonical_name = 'sope';
IF v IS NOT NULL THEN
  INSERT INTO ingredient_aliases (display_name, language, canonical_ingredient_id) VALUES
    ('Sope', 'es', v), ('Sope', 'en', v), ('Sopes', 'es', v)
  ON CONFLICT (display_name) DO NOTHING;
END IF;

SELECT id INTO v FROM canonical_ingredients WHERE canonical_name = 'huarache';
IF v IS NOT NULL THEN
  INSERT INTO ingredient_aliases (display_name, language, canonical_ingredient_id) VALUES
    ('Huarache',  'es', v), ('Huarache',   'en', v),
    ('Huaraches', 'es', v)
  ON CONFLICT (display_name) DO NOTHING;
END IF;

SELECT id INTO v FROM canonical_ingredients WHERE canonical_name = 'tlayuda';
IF v IS NOT NULL THEN
  INSERT INTO ingredient_aliases (display_name, language, canonical_ingredient_id) VALUES
    ('Tlayuda',   'es', v), ('Tlayuda',   'en', v),
    ('Clayuda',   'es', v)
  ON CONFLICT (display_name) DO NOTHING;
END IF;

SELECT id INTO v FROM canonical_ingredients WHERE canonical_name = 'gordita';
IF v IS NOT NULL THEN
  INSERT INTO ingredient_aliases (display_name, language, canonical_ingredient_id) VALUES
    ('Gordita',    'es', v), ('Gordita',   'en', v),
    ('Gorditas',   'es', v)
  ON CONFLICT (display_name) DO NOTHING;
END IF;

-- ============================================================
-- MEXICAN PROTEINS (UNTRANSLATABLE)
-- ============================================================
SELECT id INTO v FROM canonical_ingredients WHERE canonical_name = 'chapulines';
IF v IS NOT NULL THEN
  INSERT INTO ingredient_aliases (display_name, language, canonical_ingredient_id) VALUES
    ('Chapulines',    'es', v), ('Chapulines',        'en', v),
    ('Grasshoppers',  'en', v), ('Chapulines tostados','es', v)
  ON CONFLICT (display_name) DO NOTHING;
END IF;

-- ============================================================
-- MEXICAN DRINKS
-- ============================================================
SELECT id INTO v FROM canonical_ingredients WHERE canonical_name = 'mezcal';
IF v IS NOT NULL THEN
  INSERT INTO ingredient_aliases (display_name, language, canonical_ingredient_id) VALUES
    ('Mezcal', 'es', v), ('Mezcal', 'en', v), ('Mezcal artesanal', 'es', v)
  ON CONFLICT (display_name) DO NOTHING;
END IF;

SELECT id INTO v FROM canonical_ingredients WHERE canonical_name = 'tequila';
IF v IS NOT NULL THEN
  INSERT INTO ingredient_aliases (display_name, language, canonical_ingredient_id) VALUES
    ('Tequila',       'es', v), ('Tequila',       'en', v),
    ('Tequila blanco','es', v), ('Tequila reposado','es', v),
    ('Tequila añejo', 'es', v)
  ON CONFLICT (display_name) DO NOTHING;
END IF;

SELECT id INTO v FROM canonical_ingredients WHERE canonical_name = 'pulque';
IF v IS NOT NULL THEN
  INSERT INTO ingredient_aliases (display_name, language, canonical_ingredient_id) VALUES
    ('Pulque', 'es', v), ('Pulque', 'en', v)
  ON CONFLICT (display_name) DO NOTHING;
END IF;

SELECT id INTO v FROM canonical_ingredients WHERE canonical_name = 'horchata';
IF v IS NOT NULL THEN
  INSERT INTO ingredient_aliases (display_name, language, canonical_ingredient_id) VALUES
    ('Horchata',          'es', v), ('Horchata',       'en', v),
    ('Agua de horchata',  'es', v), ('Rice horchata',  'en', v)
  ON CONFLICT (display_name) DO NOTHING;
END IF;

SELECT id INTO v FROM canonical_ingredients WHERE canonical_name = 'jamaica';
IF v IS NOT NULL THEN
  INSERT INTO ingredient_aliases (display_name, language, canonical_ingredient_id) VALUES
    ('Jamaica',               'es', v), ('Hibiscus agua fresca', 'en', v),
    ('Agua de jamaica',       'es', v), ('Hibiscus water',       'en', v),
    ('Flor de jamaica',       'es', v)
  ON CONFLICT (display_name) DO NOTHING;
END IF;

SELECT id INTO v FROM canonical_ingredients WHERE canonical_name = 'atole';
IF v IS NOT NULL THEN
  INSERT INTO ingredient_aliases (display_name, language, canonical_ingredient_id) VALUES
    ('Atole',   'es', v), ('Atole',   'en', v),
    ('Atol',    'es', v)
  ON CONFLICT (display_name) DO NOTHING;
END IF;

SELECT id INTO v FROM canonical_ingredients WHERE canonical_name = 'champurrado';
IF v IS NOT NULL THEN
  INSERT INTO ingredient_aliases (display_name, language, canonical_ingredient_id) VALUES
    ('Champurrado', 'es', v), ('Champurrado', 'en', v)
  ON CONFLICT (display_name) DO NOTHING;
END IF;

-- ============================================================
-- MEXICAN SWEETS
-- ============================================================
SELECT id INTO v FROM canonical_ingredients WHERE canonical_name = 'cajeta_mx';
IF v IS NOT NULL THEN
  INSERT INTO ingredient_aliases (display_name, language, canonical_ingredient_id) VALUES
    ('Cajeta',             'es', v), ('Cajeta',            'en', v),
    ('Cajeta de cabra',    'es', v), ('Goat milk caramel', 'en', v)
  ON CONFLICT (display_name) DO NOTHING;
END IF;

SELECT id INTO v FROM canonical_ingredients WHERE canonical_name = 'mazapan';
IF v IS NOT NULL THEN
  INSERT INTO ingredient_aliases (display_name, language, canonical_ingredient_id) VALUES
    ('Mazapán',              'es', v), ('Mexican mazapan', 'en', v),
    ('Mazapán de cacahuate', 'es', v)
  ON CONFLICT (display_name) DO NOTHING;
END IF;

-- ============================================================
-- COLOMBIAN
-- ============================================================
SELECT id INTO v FROM canonical_ingredients WHERE canonical_name = 'arepa';
IF v IS NOT NULL THEN
  INSERT INTO ingredient_aliases (display_name, language, canonical_ingredient_id) VALUES
    ('Arepa',              'es', v), ('Arepa',             'en', v),
    ('Arepa blanca',       'es', v), ('Arepa amarilla',    'es', v),
    ('Arepa con queso',    'es', v), ('Arepa de choclo',   'es', v),
    ('Colombian arepa',    'en', v)
  ON CONFLICT (display_name) DO NOTHING;
END IF;

SELECT id INTO v FROM canonical_ingredients WHERE canonical_name = 'arepa_de_choclo';
IF v IS NOT NULL THEN
  INSERT INTO ingredient_aliases (display_name, language, canonical_ingredient_id) VALUES
    ('Arepa de choclo',    'es', v), ('Sweet corn arepa', 'en', v)
  ON CONFLICT (display_name) DO NOTHING;
END IF;

SELECT id INTO v FROM canonical_ingredients WHERE canonical_name = 'hogao';
IF v IS NOT NULL THEN
  INSERT INTO ingredient_aliases (display_name, language, canonical_ingredient_id) VALUES
    ('Hogao',            'es', v), ('Hogao',             'en', v),
    ('Guiso colombiano', 'es', v), ('Colombian sofrito', 'en', v),
    ('Sofrito colombiano','es', v)
  ON CONFLICT (display_name) DO NOTHING;
END IF;

SELECT id INTO v FROM canonical_ingredients WHERE canonical_name = 'aji_dulce';
IF v IS NOT NULL THEN
  INSERT INTO ingredient_aliases (display_name, language, canonical_ingredient_id) VALUES
    ('Ají dulce',  'es', v), ('Sweet aji pepper',   'en', v),
    ('Ají cachucha','es', v)
  ON CONFLICT (display_name) DO NOTHING;
END IF;

SELECT id INTO v FROM canonical_ingredients WHERE canonical_name = 'arequipe';
IF v IS NOT NULL THEN
  INSERT INTO ingredient_aliases (display_name, language, canonical_ingredient_id) VALUES
    ('Arequipe',        'es', v), ('Colombian dulce de leche', 'en', v),
    ('Dulce de leche colombiano', 'es', v)
  ON CONFLICT (display_name) DO NOTHING;
END IF;

SELECT id INTO v FROM canonical_ingredients WHERE canonical_name = 'pandebono';
IF v IS NOT NULL THEN
  INSERT INTO ingredient_aliases (display_name, language, canonical_ingredient_id) VALUES
    ('Pandebono',     'es', v), ('Pandebono',    'en', v),
    ('Pan de bono',   'es', v), ('Colombian cheese bread', 'en', v)
  ON CONFLICT (display_name) DO NOTHING;
END IF;

SELECT id INTO v FROM canonical_ingredients WHERE canonical_name = 'bandeja_paisa';
IF v IS NOT NULL THEN
  INSERT INTO ingredient_aliases (display_name, language, canonical_ingredient_id) VALUES
    ('Bandeja paisa',   'es', v), ('Bandeja paisa',   'en', v),
    ('Bandeja',         'es', v)
  ON CONFLICT (display_name) DO NOTHING;
END IF;

SELECT id INTO v FROM canonical_ingredients WHERE canonical_name = 'sancocho';
IF v IS NOT NULL THEN
  INSERT INTO ingredient_aliases (display_name, language, canonical_ingredient_id) VALUES
    ('Sancocho',           'es', v), ('Sancocho',      'en', v),
    ('Sancocho de pollo',  'es', v), ('Sancocho de res','es', v),
    ('Sancocho trifásico', 'es', v)
  ON CONFLICT (display_name) DO NOTHING;
END IF;

SELECT id INTO v FROM canonical_ingredients WHERE canonical_name = 'mondongo';
IF v IS NOT NULL THEN
  INSERT INTO ingredient_aliases (display_name, language, canonical_ingredient_id) VALUES
    ('Mondongo', 'es', v), ('Tripe stew', 'en', v), ('Mondongo colombiano', 'es', v)
  ON CONFLICT (display_name) DO NOTHING;
END IF;

SELECT id INTO v FROM canonical_ingredients WHERE canonical_name = 'bocadillo_col';
IF v IS NOT NULL THEN
  INSERT INTO ingredient_aliases (display_name, language, canonical_ingredient_id) VALUES
    ('Bocadillo',        'es', v), ('Guava paste',      'en', v),
    ('Bocadillo de guayaba','es', v)
  ON CONFLICT (display_name) DO NOTHING;
END IF;

-- ============================================================
-- PERUVIAN
-- ============================================================
SELECT id INTO v FROM canonical_ingredients WHERE canonical_name = 'ceviche';
IF v IS NOT NULL THEN
  INSERT INTO ingredient_aliases (display_name, language, canonical_ingredient_id) VALUES
    ('Ceviche',            'es', v), ('Ceviche',            'en', v),
    ('Cebiche',            'es', v), ('Ceviche de pescado',  'es', v),
    ('Ceviche de camarón', 'es', v), ('Ceviche mixto',      'es', v)
  ON CONFLICT (display_name) DO NOTHING;
END IF;

SELECT id INTO v FROM canonical_ingredients WHERE canonical_name = 'leche_de_tigre';
IF v IS NOT NULL THEN
  INSERT INTO ingredient_aliases (display_name, language, canonical_ingredient_id) VALUES
    ('Leche de tigre',  'es', v), ('Leche de tigre',  'en', v),
    ('Tiger milk',      'en', v)
  ON CONFLICT (display_name) DO NOTHING;
END IF;

SELECT id INTO v FROM canonical_ingredients WHERE canonical_name = 'aji_amarillo';
IF v IS NOT NULL THEN
  INSERT INTO ingredient_aliases (display_name, language, canonical_ingredient_id) VALUES
    ('Ají amarillo',        'es', v), ('Aji amarillo',       'en', v),
    ('Pasta de ají amarillo','es', v), ('Yellow chili pepper','en', v),
    ('Aji amarillo paste',  'en', v)
  ON CONFLICT (display_name) DO NOTHING;
END IF;

SELECT id INTO v FROM canonical_ingredients WHERE canonical_name = 'aji_panca';
IF v IS NOT NULL THEN
  INSERT INTO ingredient_aliases (display_name, language, canonical_ingredient_id) VALUES
    ('Ají panca',          'es', v), ('Aji panca',        'en', v),
    ('Pasta de ají panca', 'es', v), ('Panca chili paste','en', v)
  ON CONFLICT (display_name) DO NOTHING;
END IF;

SELECT id INTO v FROM canonical_ingredients WHERE canonical_name = 'aji_rocoto';
IF v IS NOT NULL THEN
  INSERT INTO ingredient_aliases (display_name, language, canonical_ingredient_id) VALUES
    ('Ají rocoto',    'es', v), ('Rocoto pepper',   'en', v),
    ('Rocoto',        'es', v), ('Pasta de rocoto', 'es', v)
  ON CONFLICT (display_name) DO NOTHING;
END IF;

SELECT id INTO v FROM canonical_ingredients WHERE canonical_name = 'huacatay';
IF v IS NOT NULL THEN
  INSERT INTO ingredient_aliases (display_name, language, canonical_ingredient_id) VALUES
    ('Huacatay',         'es', v), ('Huacatay',         'en', v),
    ('Black mint',       'en', v), ('Peruvian black mint','en', v)
  ON CONFLICT (display_name) DO NOTHING;
END IF;

SELECT id INTO v FROM canonical_ingredients WHERE canonical_name = 'causa';
IF v IS NOT NULL THEN
  INSERT INTO ingredient_aliases (display_name, language, canonical_ingredient_id) VALUES
    ('Causa',              'es', v), ('Causa',              'en', v),
    ('Causa limeña',       'es', v), ('Peruvian potato terrine','en', v)
  ON CONFLICT (display_name) DO NOTHING;
END IF;

SELECT id INTO v FROM canonical_ingredients WHERE canonical_name = 'lomo_saltado';
IF v IS NOT NULL THEN
  INSERT INTO ingredient_aliases (display_name, language, canonical_ingredient_id) VALUES
    ('Lomo saltado', 'es', v), ('Lomo saltado', 'en', v)
  ON CONFLICT (display_name) DO NOTHING;
END IF;

SELECT id INTO v FROM canonical_ingredients WHERE canonical_name = 'aji_de_gallina';
IF v IS NOT NULL THEN
  INSERT INTO ingredient_aliases (display_name, language, canonical_ingredient_id) VALUES
    ('Ají de gallina',    'es', v), ('Aji de gallina',     'en', v),
    ('Creamy chicken stew','en', v)
  ON CONFLICT (display_name) DO NOTHING;
END IF;

SELECT id INTO v FROM canonical_ingredients WHERE canonical_name = 'papa_a_la_huancaina';
IF v IS NOT NULL THEN
  INSERT INTO ingredient_aliases (display_name, language, canonical_ingredient_id) VALUES
    ('Papa a la huancaína', 'es', v), ('Papa a la huancaina', 'en', v),
    ('Huancaína sauce',     'en', v)
  ON CONFLICT (display_name) DO NOTHING;
END IF;

SELECT id INTO v FROM canonical_ingredients WHERE canonical_name = 'anticucho';
IF v IS NOT NULL THEN
  INSERT INTO ingredient_aliases (display_name, language, canonical_ingredient_id) VALUES
    ('Anticucho',         'es', v), ('Anticucho',           'en', v),
    ('Anticuchos',        'es', v), ('Peruvian beef skewer','en', v),
    ('Anticucho de corazón','es', v)
  ON CONFLICT (display_name) DO NOTHING;
END IF;

SELECT id INTO v FROM canonical_ingredients WHERE canonical_name = 'tiradito';
IF v IS NOT NULL THEN
  INSERT INTO ingredient_aliases (display_name, language, canonical_ingredient_id) VALUES
    ('Tiradito', 'es', v), ('Tiradito', 'en', v)
  ON CONFLICT (display_name) DO NOTHING;
END IF;

SELECT id INTO v FROM canonical_ingredients WHERE canonical_name = 'chicha_morada';
IF v IS NOT NULL THEN
  INSERT INTO ingredient_aliases (display_name, language, canonical_ingredient_id) VALUES
    ('Chicha morada',       'es', v), ('Chicha morada',       'en', v),
    ('Purple corn drink',   'en', v)
  ON CONFLICT (display_name) DO NOTHING;
END IF;

SELECT id INTO v FROM canonical_ingredients WHERE canonical_name = 'pisco';
IF v IS NOT NULL THEN
  INSERT INTO ingredient_aliases (display_name, language, canonical_ingredient_id) VALUES
    ('Pisco',             'es', v), ('Pisco',           'en', v),
    ('Pisco sour',        'es', v), ('Pisco sour',      'en', v),
    ('Pisco peruano',     'es', v)
  ON CONFLICT (display_name) DO NOTHING;
END IF;

SELECT id INTO v FROM canonical_ingredients WHERE canonical_name = 'choclo';
IF v IS NOT NULL THEN
  INSERT INTO ingredient_aliases (display_name, language, canonical_ingredient_id) VALUES
    ('Choclo',                 'es', v), ('Choclo',              'en', v),
    ('Maíz choclo',            'es', v), ('Andean corn',         'en', v),
    ('Giant corn',             'en', v)
  ON CONFLICT (display_name) DO NOTHING;
END IF;

SELECT id INTO v FROM canonical_ingredients WHERE canonical_name = 'cancha';
IF v IS NOT NULL THEN
  INSERT INTO ingredient_aliases (display_name, language, canonical_ingredient_id) VALUES
    ('Cancha',           'es', v), ('Cancha',              'en', v),
    ('Maíz tostado',     'es', v), ('Toasted corn',        'en', v),
    ('Canchita',         'es', v)
  ON CONFLICT (display_name) DO NOTHING;
END IF;

SELECT id INTO v FROM canonical_ingredients WHERE canonical_name = 'lucuma';
IF v IS NOT NULL THEN
  INSERT INTO ingredient_aliases (display_name, language, canonical_ingredient_id) VALUES
    ('Lúcuma',        'es', v), ('Lucuma',     'en', v),
    ('Lucuma fruit',  'en', v)
  ON CONFLICT (display_name) DO NOTHING;
END IF;

SELECT id INTO v FROM canonical_ingredients WHERE canonical_name = 'maracuya';
IF v IS NOT NULL THEN
  INSERT INTO ingredient_aliases (display_name, language, canonical_ingredient_id) VALUES
    ('Maracuyá',       'es', v), ('Maracuya',        'en', v),
    ('Passion fruit',  'en', v), ('Maracuyá natural','es', v)
  ON CONFLICT (display_name) DO NOTHING;
END IF;

SELECT id INTO v FROM canonical_ingredients WHERE canonical_name = 'cherimoya';
IF v IS NOT NULL THEN
  INSERT INTO ingredient_aliases (display_name, language, canonical_ingredient_id) VALUES
    ('Chirimoya',  'es', v), ('Cherimoya',  'en', v),
    ('Anona',      'es', v)
  ON CONFLICT (display_name) DO NOTHING;
END IF;

SELECT id INTO v FROM canonical_ingredients WHERE canonical_name = 'kiwicha';
IF v IS NOT NULL THEN
  INSERT INTO ingredient_aliases (display_name, language, canonical_ingredient_id) VALUES
    ('Kiwicha',          'es', v), ('Kiwicha',          'en', v),
    ('Andean amaranth',  'en', v), ('Amaranto andino',   'es', v)
  ON CONFLICT (display_name) DO NOTHING;
END IF;

-- ============================================================
-- ARGENTINIAN
-- ============================================================
SELECT id INTO v FROM canonical_ingredients WHERE canonical_name = 'asado';
IF v IS NOT NULL THEN
  INSERT INTO ingredient_aliases (display_name, language, canonical_ingredient_id) VALUES
    ('Asado',               'es', v), ('Asado',              'en', v),
    ('Argentine BBQ',       'en', v), ('Parrillada',          'es', v),
    ('Parrillada argentina','es', v)
  ON CONFLICT (display_name) DO NOTHING;
END IF;

SELECT id INTO v FROM canonical_ingredients WHERE canonical_name = 'asado_de_tira';
IF v IS NOT NULL THEN
  INSERT INTO ingredient_aliases (display_name, language, canonical_ingredient_id) VALUES
    ('Asado de tira',  'es', v), ('Short ribs',   'en', v),
    ('Tira de asado',  'es', v), ('Beef short ribs','en', v)
  ON CONFLICT (display_name) DO NOTHING;
END IF;

SELECT id INTO v FROM canonical_ingredients WHERE canonical_name = 'vacio';
IF v IS NOT NULL THEN
  INSERT INTO ingredient_aliases (display_name, language, canonical_ingredient_id) VALUES
    ('Vacío',       'es', v), ('Flank steak',   'en', v),
    ('Vacio',       'es', v), ('Bavette',        'en', v)
  ON CONFLICT (display_name) DO NOTHING;
END IF;

SELECT id INTO v FROM canonical_ingredients WHERE canonical_name = 'entraña';
IF v IS NOT NULL THEN
  INSERT INTO ingredient_aliases (display_name, language, canonical_ingredient_id) VALUES
    ('Entraña',       'es', v), ('Skirt steak',   'en', v),
    ('Entraña fina',  'es', v)
  ON CONFLICT (display_name) DO NOTHING;
END IF;

SELECT id INTO v FROM canonical_ingredients WHERE canonical_name = 'mollejas';
IF v IS NOT NULL THEN
  INSERT INTO ingredient_aliases (display_name, language, canonical_ingredient_id) VALUES
    ('Mollejas',       'es', v), ('Sweetbreads',   'en', v),
    ('Mollejas a la parrilla', 'es', v)
  ON CONFLICT (display_name) DO NOTHING;
END IF;

SELECT id INTO v FROM canonical_ingredients WHERE canonical_name = 'morcilla';
IF v IS NOT NULL THEN
  INSERT INTO ingredient_aliases (display_name, language, canonical_ingredient_id) VALUES
    ('Morcilla',         'es', v), ('Blood sausage',   'en', v),
    ('Morcilla argentina','es', v), ('Black pudding',  'en', v)
  ON CONFLICT (display_name) DO NOTHING;
END IF;

SELECT id INTO v FROM canonical_ingredients WHERE canonical_name = 'chorizo_argentino';
IF v IS NOT NULL THEN
  INSERT INTO ingredient_aliases (display_name, language, canonical_ingredient_id) VALUES
    ('Chorizo argentino',  'es', v), ('Argentine chorizo', 'en', v),
    ('Choripán',           'es', v), ('Choripan',          'en', v)
  ON CONFLICT (display_name) DO NOTHING;
END IF;

SELECT id INTO v FROM canonical_ingredients WHERE canonical_name = 'provoleta';
IF v IS NOT NULL THEN
  INSERT INTO ingredient_aliases (display_name, language, canonical_ingredient_id) VALUES
    ('Provoleta',      'es', v), ('Provoleta',         'en', v),
    ('Grilled provolone', 'en', v)
  ON CONFLICT (display_name) DO NOTHING;
END IF;

SELECT id INTO v FROM canonical_ingredients WHERE canonical_name = 'chimichurri';
IF v IS NOT NULL THEN
  INSERT INTO ingredient_aliases (display_name, language, canonical_ingredient_id) VALUES
    ('Chimichurri',       'es', v), ('Chimichurri',     'en', v),
    ('Chimichurri verde', 'es', v), ('Chimichurri rojo','es', v),
    ('Chimichurri sauce', 'en', v)
  ON CONFLICT (display_name) DO NOTHING;
END IF;

SELECT id INTO v FROM canonical_ingredients WHERE canonical_name = 'salsa_criolla';
IF v IS NOT NULL THEN
  INSERT INTO ingredient_aliases (display_name, language, canonical_ingredient_id) VALUES
    ('Salsa criolla',        'es', v), ('Criolla sauce',    'en', v),
    ('Salsa criolla argentina','es', v)
  ON CONFLICT (display_name) DO NOTHING;
END IF;

SELECT id INTO v FROM canonical_ingredients WHERE canonical_name = 'empanada';
IF v IS NOT NULL THEN
  INSERT INTO ingredient_aliases (display_name, language, canonical_ingredient_id) VALUES
    ('Empanada',             'es', v), ('Empanada',             'en', v),
    ('Empanadas',            'es', v), ('Empanada de carne',    'es', v),
    ('Empanada de jamón',    'es', v), ('Empanada de verdura',  'es', v),
    ('Empanada de queso',    'es', v), ('Empanada frita',       'es', v),
    ('Empanada al horno',    'es', v), ('Baked empanada',       'en', v),
    ('Fried empanada',       'en', v)
  ON CONFLICT (display_name) DO NOTHING;
END IF;

SELECT id INTO v FROM canonical_ingredients WHERE canonical_name = 'medialunas';
IF v IS NOT NULL THEN
  INSERT INTO ingredient_aliases (display_name, language, canonical_ingredient_id) VALUES
    ('Medialunas',      'es', v), ('Medialuna',         'es', v),
    ('Argentine croissant','en', v), ('Medialuna de manteca','es', v)
  ON CONFLICT (display_name) DO NOTHING;
END IF;

SELECT id INTO v FROM canonical_ingredients WHERE canonical_name = 'dulce_de_leche';
IF v IS NOT NULL THEN
  INSERT INTO ingredient_aliases (display_name, language, canonical_ingredient_id) VALUES
    ('Dulce de leche',         'es', v), ('Dulce de leche',       'en', v),
    ('Dulce de leche argentino','es', v), ('Milk caramel',         'en', v)
  ON CONFLICT (display_name) DO NOTHING;
END IF;

SELECT id INTO v FROM canonical_ingredients WHERE canonical_name = 'alfajor';
IF v IS NOT NULL THEN
  INSERT INTO ingredient_aliases (display_name, language, canonical_ingredient_id) VALUES
    ('Alfajor',          'es', v), ('Alfajor',          'en', v),
    ('Alfajores',        'es', v), ('Argentine cookie sandwich', 'en', v)
  ON CONFLICT (display_name) DO NOTHING;
END IF;

SELECT id INTO v FROM canonical_ingredients WHERE canonical_name = 'mate';
IF v IS NOT NULL THEN
  INSERT INTO ingredient_aliases (display_name, language, canonical_ingredient_id) VALUES
    ('Mate',           'es', v), ('Mate',          'en', v),
    ('Yerba mate',     'es', v), ('Mate cocido',   'es', v)
  ON CONFLICT (display_name) DO NOTHING;
END IF;

SELECT id INTO v FROM canonical_ingredients WHERE canonical_name = 'milanesa_argentina';
IF v IS NOT NULL THEN
  INSERT INTO ingredient_aliases (display_name, language, canonical_ingredient_id) VALUES
    ('Milanesa',             'es', v), ('Milanesa',             'en', v),
    ('Milanesa argentina',   'es', v), ('Argentine milanesa',   'en', v),
    ('Breaded beef cutlet',  'en', v)
  ON CONFLICT (display_name) DO NOTHING;
END IF;

SELECT id INTO v FROM canonical_ingredients WHERE canonical_name = 'milanesa_napolitana';
IF v IS NOT NULL THEN
  INSERT INTO ingredient_aliases (display_name, language, canonical_ingredient_id) VALUES
    ('Milanesa napolitana',    'es', v), ('Milanesa a la napolitana', 'es', v),
    ('Napolitana milanesa',    'en', v)
  ON CONFLICT (display_name) DO NOTHING;
END IF;

SELECT id INTO v FROM canonical_ingredients WHERE canonical_name = 'locro';
IF v IS NOT NULL THEN
  INSERT INTO ingredient_aliases (display_name, language, canonical_ingredient_id) VALUES
    ('Locro',                 'es', v), ('Locro',          'en', v),
    ('Locro argentino',       'es', v), ('Argentine stew', 'en', v)
  ON CONFLICT (display_name) DO NOTHING;
END IF;

SELECT id INTO v FROM canonical_ingredients WHERE canonical_name = 'humita';
IF v IS NOT NULL THEN
  INSERT INTO ingredient_aliases (display_name, language, canonical_ingredient_id) VALUES
    ('Humita',            'es', v), ('Humita',          'en', v),
    ('Humita en chala',   'es', v), ('Corn humita',     'en', v)
  ON CONFLICT (display_name) DO NOTHING;
END IF;

-- ============================================================
-- BRAZILIAN
-- ============================================================
SELECT id INTO v FROM canonical_ingredients WHERE canonical_name = 'feijoada';
IF v IS NOT NULL THEN
  INSERT INTO ingredient_aliases (display_name, language, canonical_ingredient_id) VALUES
    ('Feijoada',       'pt', v), ('Feijoada',       'en', v),
    ('Feijoada completa','pt', v), ('Brazilian black bean stew', 'en', v)
  ON CONFLICT (display_name) DO NOTHING;
END IF;

SELECT id INTO v FROM canonical_ingredients WHERE canonical_name = 'farofa';
IF v IS NOT NULL THEN
  INSERT INTO ingredient_aliases (display_name, language, canonical_ingredient_id) VALUES
    ('Farofa',            'pt', v), ('Farofa',              'en', v),
    ('Farofa de bacon',   'pt', v), ('Toasted cassava flour','en', v)
  ON CONFLICT (display_name) DO NOTHING;
END IF;

SELECT id INTO v FROM canonical_ingredients WHERE canonical_name = 'pao_de_queijo';
IF v IS NOT NULL THEN
  INSERT INTO ingredient_aliases (display_name, language, canonical_ingredient_id) VALUES
    ('Pão de queijo',     'pt', v), ('Pao de queijo',    'en', v),
    ('Brazilian cheese bread','en', v), ('Cheese bread', 'en', v)
  ON CONFLICT (display_name) DO NOTHING;
END IF;

SELECT id INTO v FROM canonical_ingredients WHERE canonical_name = 'coxinha';
IF v IS NOT NULL THEN
  INSERT INTO ingredient_aliases (display_name, language, canonical_ingredient_id) VALUES
    ('Coxinha',           'pt', v), ('Coxinha',          'en', v),
    ('Chicken croquette', 'en', v)
  ON CONFLICT (display_name) DO NOTHING;
END IF;

SELECT id INTO v FROM canonical_ingredients WHERE canonical_name = 'brigadeiro';
IF v IS NOT NULL THEN
  INSERT INTO ingredient_aliases (display_name, language, canonical_ingredient_id) VALUES
    ('Brigadeiro',           'pt', v), ('Brigadeiro',         'en', v),
    ('Brazilian chocolate truffle','en', v)
  ON CONFLICT (display_name) DO NOTHING;
END IF;

SELECT id INTO v FROM canonical_ingredients WHERE canonical_name = 'caipirinha';
IF v IS NOT NULL THEN
  INSERT INTO ingredient_aliases (display_name, language, canonical_ingredient_id) VALUES
    ('Caipirinha',   'pt', v), ('Caipirinha',   'en', v),
    ('Caipivodka',   'pt', v), ('Caipisake',    'pt', v)
  ON CONFLICT (display_name) DO NOTHING;
END IF;

SELECT id INTO v FROM canonical_ingredients WHERE canonical_name = 'cachaca';
IF v IS NOT NULL THEN
  INSERT INTO ingredient_aliases (display_name, language, canonical_ingredient_id) VALUES
    ('Cachaça',       'pt', v), ('Cachaca',     'en', v),
    ('Aguardente',    'pt', v), ('Brazilian rum', 'en', v)
  ON CONFLICT (display_name) DO NOTHING;
END IF;

SELECT id INTO v FROM canonical_ingredients WHERE canonical_name = 'moqueca';
IF v IS NOT NULL THEN
  INSERT INTO ingredient_aliases (display_name, language, canonical_ingredient_id) VALUES
    ('Moqueca',              'pt', v), ('Moqueca',           'en', v),
    ('Moqueca de peixe',     'pt', v), ('Moqueca de camarão','pt', v),
    ('Brazilian fish stew',  'en', v), ('Moqueca baiana',    'pt', v)
  ON CONFLICT (display_name) DO NOTHING;
END IF;

SELECT id INTO v FROM canonical_ingredients WHERE canonical_name = 'acaraje';
IF v IS NOT NULL THEN
  INSERT INTO ingredient_aliases (display_name, language, canonical_ingredient_id) VALUES
    ('Acarajé',    'pt', v), ('Acaraje',   'en', v),
    ('Black-eyed pea fritter', 'en', v)
  ON CONFLICT (display_name) DO NOTHING;
END IF;

SELECT id INTO v FROM canonical_ingredients WHERE canonical_name = 'carne_seca';
IF v IS NOT NULL THEN
  INSERT INTO ingredient_aliases (display_name, language, canonical_ingredient_id) VALUES
    ('Carne seca',      'pt', v), ('Carne seca',     'en', v),
    ('Dried beef',      'en', v), ('Jerked beef',    'en', v),
    ('Carne de sol',    'pt', v), ('Carne de vento', 'pt', v)
  ON CONFLICT (display_name) DO NOTHING;
END IF;

SELECT id INTO v FROM canonical_ingredients WHERE canonical_name = 'linguica';
IF v IS NOT NULL THEN
  INSERT INTO ingredient_aliases (display_name, language, canonical_ingredient_id) VALUES
    ('Linguiça',          'pt', v), ('Linguica',    'en', v),
    ('Linguiça defumada', 'pt', v), ('Smoked pork sausage', 'en', v)
  ON CONFLICT (display_name) DO NOTHING;
END IF;

SELECT id INTO v FROM canonical_ingredients WHERE canonical_name = 'frango';
IF v IS NOT NULL THEN
  INSERT INTO ingredient_aliases (display_name, language, canonical_ingredient_id) VALUES
    ('Frango',             'pt', v), ('Chicken',      'en', v),
    ('Frango grelhado',    'pt', v), ('Frango assado','pt', v),
    ('Frango desfiado',    'pt', v)
  ON CONFLICT (display_name) DO NOTHING;
END IF;

SELECT id INTO v FROM canonical_ingredients WHERE canonical_name = 'requeijao';
IF v IS NOT NULL THEN
  INSERT INTO ingredient_aliases (display_name, language, canonical_ingredient_id) VALUES
    ('Requeijão',          'pt', v), ('Requeijao',           'en', v),
    ('Brazilian cream cheese','en', v), ('Requeijão cremoso', 'pt', v)
  ON CONFLICT (display_name) DO NOTHING;
END IF;

SELECT id INTO v FROM canonical_ingredients WHERE canonical_name = 'vatapa';
IF v IS NOT NULL THEN
  INSERT INTO ingredient_aliases (display_name, language, canonical_ingredient_id) VALUES
    ('Vatapá',          'pt', v), ('Vatapa',           'en', v),
    ('Brazilian shrimp paste', 'en', v)
  ON CONFLICT (display_name) DO NOTHING;
END IF;

SELECT id INTO v FROM canonical_ingredients WHERE canonical_name = 'tapioca_br';
IF v IS NOT NULL THEN
  INSERT INTO ingredient_aliases (display_name, language, canonical_ingredient_id) VALUES
    ('Tapioca',             'pt', v), ('Tapioca crepe',   'en', v),
    ('Tapioca brasileira',  'pt', v), ('Beiju',           'pt', v)
  ON CONFLICT (display_name) DO NOTHING;
END IF;

SELECT id INTO v FROM canonical_ingredients WHERE canonical_name = 'guarana';
IF v IS NOT NULL THEN
  INSERT INTO ingredient_aliases (display_name, language, canonical_ingredient_id) VALUES
    ('Guaraná',           'pt', v), ('Guarana',      'en', v),
    ('Guaraná Antarctica','pt', v)
  ON CONFLICT (display_name) DO NOTHING;
END IF;

SELECT id INTO v FROM canonical_ingredients WHERE canonical_name = 'acai_bowl';
IF v IS NOT NULL THEN
  INSERT INTO ingredient_aliases (display_name, language, canonical_ingredient_id) VALUES
    ('Açaí',             'pt', v), ('Acai bowl',        'en', v),
    ('Açaí na tigela',   'pt', v), ('Açaí bowl',        'pt', v)
  ON CONFLICT (display_name) DO NOTHING;
END IF;

SELECT id INTO v FROM canonical_ingredients WHERE canonical_name = 'tucupi';
IF v IS NOT NULL THEN
  INSERT INTO ingredient_aliases (display_name, language, canonical_ingredient_id) VALUES
    ('Tucupi',           'pt', v), ('Tucupi',                   'en', v),
    ('Fermented manioc broth', 'en', v)
  ON CONFLICT (display_name) DO NOTHING;
END IF;

SELECT id INTO v FROM canonical_ingredients WHERE canonical_name = 'jabuticaba';
IF v IS NOT NULL THEN
  INSERT INTO ingredient_aliases (display_name, language, canonical_ingredient_id) VALUES
    ('Jabuticaba',    'pt', v), ('Jabuticaba',       'en', v),
    ('Jaboticaba',    'en', v), ('Brazilian grape tree fruit', 'en', v)
  ON CONFLICT (display_name) DO NOTHING;
END IF;

SELECT id INTO v FROM canonical_ingredients WHERE canonical_name = 'pudim_de_leite';
IF v IS NOT NULL THEN
  INSERT INTO ingredient_aliases (display_name, language, canonical_ingredient_id) VALUES
    ('Pudim de leite',        'pt', v), ('Brazilian flan', 'en', v),
    ('Pudim de leite condensado','pt', v), ('Flan brasileiro','pt', v)
  ON CONFLICT (display_name) DO NOTHING;
END IF;

SELECT id INTO v FROM canonical_ingredients WHERE canonical_name = 'quindim';
IF v IS NOT NULL THEN
  INSERT INTO ingredient_aliases (display_name, language, canonical_ingredient_id) VALUES
    ('Quindim',            'pt', v), ('Quindim',           'en', v),
    ('Brazilian coconut flan','en', v)
  ON CONFLICT (display_name) DO NOTHING;
END IF;

SELECT id INTO v FROM canonical_ingredients WHERE canonical_name = 'brigadeiro';
IF v IS NOT NULL THEN
  INSERT INTO ingredient_aliases (display_name, language, canonical_ingredient_id) VALUES
    ('Brigadeiro',                  'pt', v),
    ('Brazilian chocolate truffle', 'en', v)
  ON CONFLICT (display_name) DO NOTHING;
END IF;

-- ============================================================
-- CROSS-REGIONAL: common terms used in all LatAm countries
-- (map to existing canonicals already in the DB)
-- ============================================================

-- Cilantro is called 'Cilantro' in all LatAm except Brazil where it's 'Coentro'
SELECT id INTO v FROM canonical_ingredients WHERE canonical_name = 'cilantro';
IF v IS NOT NULL THEN
  INSERT INTO ingredient_aliases (display_name, language, canonical_ingredient_id) VALUES
    ('Cilantro',   'es', v), ('Cilantro',   'en', v),
    ('Coentro',    'pt', v), ('Coentro fresco', 'pt', v)
  ON CONFLICT (display_name) DO NOTHING;
END IF;

-- Lime: 'Limão' in Brazil, 'Limón' already in 036
SELECT id INTO v FROM canonical_ingredients WHERE canonical_name = 'lime';
IF v IS NOT NULL THEN
  INSERT INTO ingredient_aliases (display_name, language, canonical_ingredient_id) VALUES
    ('Limão',          'pt', v), ('Limão taiti',  'pt', v),
    ('Suco de limão',  'pt', v)
  ON CONFLICT (display_name) DO NOTHING;
END IF;

-- Avocado: 'Abacate' in Brazil
SELECT id INTO v FROM canonical_ingredients WHERE canonical_name = 'avocado';
IF v IS NOT NULL THEN
  INSERT INTO ingredient_aliases (display_name, language, canonical_ingredient_id) VALUES
    ('Abacate',          'pt', v), ('Abacate maduro', 'pt', v)
  ON CONFLICT (display_name) DO NOTHING;
END IF;

-- Pineapple: 'Abacaxi' in Brazil (different word)
SELECT id INTO v FROM canonical_ingredients WHERE canonical_name = 'pineapple';
IF v IS NOT NULL THEN
  INSERT INTO ingredient_aliases (display_name, language, canonical_ingredient_id) VALUES
    ('Abacaxi',           'pt', v), ('Suco de abacaxi', 'pt', v)
  ON CONFLICT (display_name) DO NOTHING;
END IF;

-- Corn: 'Milho' in Brazil
SELECT id INTO v FROM canonical_ingredients WHERE canonical_name = 'corn';
IF v IS NOT NULL THEN
  INSERT INTO ingredient_aliases (display_name, language, canonical_ingredient_id) VALUES
    ('Milho',              'pt', v), ('Milho verde',  'pt', v),
    ('Espiga de milho',    'pt', v), ('Milho cozido', 'pt', v)
  ON CONFLICT (display_name) DO NOTHING;
END IF;

-- Cassava: 'Mandioca' / 'Macaxeira' in Brazil, 'Yuca' already in 036
SELECT id INTO v FROM canonical_ingredients WHERE canonical_name = 'cassava';
IF v IS NOT NULL THEN
  INSERT INTO ingredient_aliases (display_name, language, canonical_ingredient_id) VALUES
    ('Mandioca',          'pt', v), ('Macaxeira',       'pt', v),
    ('Aipim',             'pt', v), ('Mandioca cozida', 'pt', v),
    ('Mandioca frita',    'pt', v)
  ON CONFLICT (display_name) DO NOTHING;
END IF;

-- Plantain: 'Banana-da-terra' in Brazil, 'Plátano' already in 036
SELECT id INTO v FROM canonical_ingredients WHERE canonical_name = 'plantain';
IF v IS NOT NULL THEN
  INSERT INTO ingredient_aliases (display_name, language, canonical_ingredient_id) VALUES
    ('Banana-da-terra',   'pt', v), ('Banana da terra',   'pt', v),
    ('Banana madura',     'pt', v)
  ON CONFLICT (display_name) DO NOTHING;
END IF;

-- Black beans: 'Feijão preto' in Brazil
SELECT id INTO v FROM canonical_ingredients WHERE canonical_name = 'black_beans';
IF v IS NOT NULL THEN
  INSERT INTO ingredient_aliases (display_name, language, canonical_ingredient_id) VALUES
    ('Feijão preto',       'pt', v), ('Feijao preto',    'pt', v),
    ('Feijão',             'pt', v), ('Feijão de corda', 'pt', v)
  ON CONFLICT (display_name) DO NOTHING;
END IF;

-- Rice: 'Arroz' same but Portuguese spelling same; adding PT row just in case
SELECT id INTO v FROM canonical_ingredients WHERE canonical_name = 'rice';
IF v IS NOT NULL THEN
  INSERT INTO ingredient_aliases (display_name, language, canonical_ingredient_id) VALUES
    ('Arroz branco', 'pt', v), ('Arroz cozido', 'pt', v)
  ON CONFLICT (display_name) DO NOTHING;
END IF;

-- Cheese: common Brazilian cheeses
SELECT id INTO v FROM canonical_ingredients WHERE canonical_name = 'cheese';
IF v IS NOT NULL THEN
  INSERT INTO ingredient_aliases (display_name, language, canonical_ingredient_id) VALUES
    ('Queijo',            'pt', v), ('Queijo minas',      'pt', v),
    ('Queijo coalho',     'pt', v), ('Queijo prato',      'pt', v),
    ('Queijo muçarela',   'pt', v), ('Queijo parmesão',   'pt', v)
  ON CONFLICT (display_name) DO NOTHING;
END IF;

-- Chicken: 'Frango' already added above as its own canonical; add 'pt' alias on 'chicken' too
SELECT id INTO v FROM canonical_ingredients WHERE canonical_name = 'chicken';
IF v IS NOT NULL THEN
  INSERT INTO ingredient_aliases (display_name, language, canonical_ingredient_id) VALUES
    ('Frango grelhado',   'pt', v), ('Peito de frango',   'pt', v),
    ('Sobrecoxa',         'pt', v), ('Coxinha de frango', 'pt', v)
  ON CONFLICT (display_name) DO NOTHING;
END IF;

-- Beef: Portuguese terms
SELECT id INTO v FROM canonical_ingredients WHERE canonical_name = 'beef';
IF v IS NOT NULL THEN
  INSERT INTO ingredient_aliases (display_name, language, canonical_ingredient_id) VALUES
    ('Carne bovina',     'pt', v), ('Picanha',            'pt', v),
    ('Contrafilé',       'pt', v), ('Alcatra',            'pt', v),
    ('Fraldinha',        'pt', v), ('Maminha',            'pt', v),
    ('Cupim',            'pt', v), ('Músculo',            'pt', v),
    ('Bife',             'pt', v), ('Bife de carne',      'pt', v),
    ('Filé mignon',      'pt', v), ('Carne moída',        'pt', v),
    ('Filé de carne',    'pt', v),
    -- Also en alias for the Brazilian BBQ cut that appears on English menus
    ('Picanha',          'en', v)
  ON CONFLICT (display_name) DO NOTHING;
END IF;

-- Pork: Portuguese terms
SELECT id INTO v FROM canonical_ingredients WHERE canonical_name = 'pork';
IF v IS NOT NULL THEN
  INSERT INTO ingredient_aliases (display_name, language, canonical_ingredient_id) VALUES
    ('Carne de porco',   'pt', v), ('Costelinha de porco','pt', v),
    ('Lombo de porco',   'pt', v), ('Pernil',             'pt', v),
    ('Barriga de porco', 'pt', v), ('Torresmo',           'pt', v)
  ON CONFLICT (display_name) DO NOTHING;
END IF;

-- Shrimp: 'Camarão' in Brazilian Portuguese
SELECT id INTO v FROM canonical_ingredients WHERE canonical_name = 'shrimp';
IF v IS NOT NULL THEN
  INSERT INTO ingredient_aliases (display_name, language, canonical_ingredient_id) VALUES
    ('Camarão',           'pt', v), ('Camarões',       'pt', v),
    ('Camarão médio',     'pt', v), ('Camarão grande', 'pt', v)
  ON CONFLICT (display_name) DO NOTHING;
END IF;

-- Onion: 'Cebola' in Brazilian Portuguese
SELECT id INTO v FROM canonical_ingredients WHERE canonical_name = 'onion';
IF v IS NOT NULL THEN
  INSERT INTO ingredient_aliases (display_name, language, canonical_ingredient_id) VALUES
    ('Cebola',            'pt', v), ('Cebola branca',  'pt', v),
    ('Cebola roxa',       'pt', v), ('Cebola picada',  'pt', v)
  ON CONFLICT (display_name) DO NOTHING;
END IF;

-- Garlic: 'Alho' in Brazilian Portuguese
SELECT id INTO v FROM canonical_ingredients WHERE canonical_name = 'garlic';
IF v IS NOT NULL THEN
  INSERT INTO ingredient_aliases (display_name, language, canonical_ingredient_id) VALUES
    ('Alho',              'pt', v), ('Dentes de alho',  'pt', v),
    ('Alho picado',       'pt', v), ('Alho em pó',      'pt', v)
  ON CONFLICT (display_name) DO NOTHING;
END IF;

-- Tomato: 'Tomate' same word in PT; add for completeness
SELECT id INTO v FROM canonical_ingredients WHERE canonical_name = 'tomato';
IF v IS NOT NULL THEN
  INSERT INTO ingredient_aliases (display_name, language, canonical_ingredient_id) VALUES
    ('Tomate',          'pt', v), ('Tomate cereja',   'pt', v),
    ('Tomate italiano', 'pt', v), ('Tomate pelado',   'pt', v)
  ON CONFLICT (display_name) DO NOTHING;
END IF;

-- Butter: 'Manteiga' in PT
SELECT id INTO v FROM canonical_ingredients WHERE canonical_name = 'butter';
IF v IS NOT NULL THEN
  INSERT INTO ingredient_aliases (display_name, language, canonical_ingredient_id) VALUES
    ('Manteiga',          'pt', v), ('Manteiga sem sal', 'pt', v),
    ('Manteiga derretida','pt', v)
  ON CONFLICT (display_name) DO NOTHING;
END IF;

-- Salt: 'Sal' same; add PT
SELECT id INTO v FROM canonical_ingredients WHERE canonical_name = 'salt';
IF v IS NOT NULL THEN
  INSERT INTO ingredient_aliases (display_name, language, canonical_ingredient_id) VALUES
    ('Sal grosso',   'pt', v), ('Sal marinho', 'pt', v)
  ON CONFLICT (display_name) DO NOTHING;
END IF;

-- Sugar: 'Açúcar' in PT
SELECT id INTO v FROM canonical_ingredients WHERE canonical_name = 'sugar';
IF v IS NOT NULL THEN
  INSERT INTO ingredient_aliases (display_name, language, canonical_ingredient_id) VALUES
    ('Açúcar',            'pt', v), ('Açúcar refinado',  'pt', v),
    ('Açúcar mascavo',    'pt', v), ('Açúcar de coco',   'pt', v)
  ON CONFLICT (display_name) DO NOTHING;
END IF;

RAISE NOTICE '========================================';
RAISE NOTICE 'Latin American aliases migration complete!';
RAISE NOTICE 'Total ingredient aliases: %',    (SELECT COUNT(*)                            FROM ingredient_aliases);
RAISE NOTICE 'English aliases:  %',            (SELECT COUNT(*) FROM ingredient_aliases WHERE language = 'en');
RAISE NOTICE 'Spanish aliases:  %',            (SELECT COUNT(*) FROM ingredient_aliases WHERE language = 'es');
RAISE NOTICE 'Portuguese aliases: %',          (SELECT COUNT(*) FROM ingredient_aliases WHERE language = 'pt');
RAISE NOTICE '========================================';

END $$;
