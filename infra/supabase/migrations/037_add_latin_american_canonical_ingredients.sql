-- Migration 037: Latin American canonical ingredients
-- Adds canonical_ingredients for dishes/cuts/staples from Mexico, Colombia,
-- Peru, Argentina and Brazil that are not yet in the system.
-- All inserts are ON CONFLICT DO NOTHING (idempotent).
-- ingredient_family_name is set inline so no separate UPDATE is needed.
--
-- UNTRANSLATABLE-TERM STRATEGY
-- ─────────────────────────────────────────────────────────────────────────────
-- Many LatAm culinary terms (tacos, tamales, mole, arepas, ceviche…) are
-- loanwords universally used in English menus. For these we:
--   1. Use the Spanish/Portuguese term as the canonical_name.
--   2. Add an English alias (display_name, language = 'en') that is the SAME
--      loan word — so it is found in the DB regardless of UI language.
--   3. Add regional-language aliases (es / pt) for the same term.
-- This means the AI translation fallback never needs to translate them; the
-- DB lookup in Pass 1 always succeeds for both English and Spanish menus.
-- ─────────────────────────────────────────────────────────────────────────────

-- ============================================================
-- STEP 1: NEW CANONICAL INGREDIENTS
-- ============================================================

INSERT INTO canonical_ingredients (canonical_name, is_vegetarian, is_vegan, ingredient_family_name) VALUES

-- ── MEXICAN ──────────────────────────────────────────────────
-- Chiles (fresh & dried)
('chile_serrano',      true, true,  'vegetable'),
('chile_habanero',     true, true,  'vegetable'),
('chile_chipotle',     true, true,  'vegetable'),
('chile_ancho',        true, true,  'vegetable'),
('chile_guajillo',     true, true,  'vegetable'),
('chile_mulato',       true, true,  'vegetable'),
('chile_pasilla',      true, true,  'vegetable'),
('chile_de_arbol',     true, true,  'vegetable'),
('chile_morita',       true, true,  'vegetable'),
('chile_negro',        true, true,  'vegetable'),
('chile_cascabel',     true, true,  'vegetable'),
('chile_poblano',      true, true,  'vegetable'),
('chile_jalisco',      true, true,  'vegetable'),

-- Sauces / complex preparations (untranslatable)
('mole',               true, true,  'condiment'),   -- contains chiles, chocolate, spices
('mole_negro',         true, true,  'condiment'),
('mole_rojo',          true, true,  'condiment'),
('mole_verde',         true, true,  'condiment'),
('mole_coloradito',    true, true,  'condiment'),
('pipian',             true, true,  'condiment'),
('recado_rojo',        true, true,  'condiment'),   -- Yucatecan achiote paste
('salsa_macha',        true, true,  'condiment'),
('salsa_taquera',      true, true,  'condiment'),

-- Proteins / preparations
('chapulines',         false, false, 'other'),      -- grasshoppers — regional protein
('epazote',            true,  true,  'spice_herb'),
('hierba_santa',       true,  true,  'spice_herb'),
('avocado_leaf',       true,  true,  'spice_herb'),
('achiote',            true,  true,  'spice_herb'),
('annatto',            true,  true,  'spice_herb'),
('huitlacoche',        true,  true,  'vegetable'),  -- corn fungus / corn truffle
('nopal',              true,  true,  'vegetable'),  -- cactus pads (canonical alias of cactus_pads)
('chayote',            true,  true,  'vegetable'),
('jicama_mexican',     true,  true,  'vegetable'),
('verdolaga',          true,  true,  'vegetable'),  -- purslane
('quelites',           true,  true,  'vegetable'),  -- wild greens
('flor_de_calabaza',   true,  true,  'vegetable'),  -- squash blossom
('tomatillo',          true,  true,  'vegetable'),
('xoconostle',         true,  true,  'vegetable'),  -- sour prickly pear

-- Starches / masa
('masa',               true, true,  'grain'),
('tamal',              true, true,  'grain'),        -- untranslatable; en alias = "tamale"
('sope',               true, true,  'grain'),
('huarache',           true, true,  'grain'),
('tlayuda',            true, true,  'grain'),
('tlacoyo',            true, true,  'grain'),
('memela',             true, true,  'grain'),
('gordita',            true, true,  'grain'),
('tetela',             true, true,  'grain'),
('quesadilla_masa',    true, false, 'grain'),
('tostada_mx',         true, true,  'grain'),

-- Drinks / liquids
('mezcal',             true, true,  'alcohol'),
('tequila',            true, true,  'alcohol'),
('pulque',             true, true,  'alcohol'),
('tepache',            true, true,  'beverage'),
('agua_fresca',        true, true,  'beverage'),
('horchata',           true, false, 'beverage'),
('jamaica',            true, true,  'beverage'),    -- hibiscus agua fresca
('atole',              true, false, 'beverage'),
('champurrado',        true, false, 'beverage'),
('pozol',              true, true,  'beverage'),

-- Sweets
('cajeta_mx',          true, false, 'condiment'),   -- goat-milk caramel
('ate',                true, true,  'other'),        -- fruit paste
('tamarindo_candy',    true, true,  'other'),
('mazapan',            true, true,  'other'),        -- peanut mazapan
('alegria',            true, true,  'other'),        -- amaranth candy
('cocada',             true, false, 'other'),

-- ── COLOMBIAN ────────────────────────────────────────────────
('arepa',              true,  true,  'grain'),
('arepa_de_choclo',    true,  false, 'grain'),
('bandeja_paisa',      false, false, 'other'),      -- platter dish
('chicharron_col',     false, false, 'meat'),        -- pork rind (Colombian)
('hogao',              true,  true,  'condiment'),   -- tomato-onion sofrito
('aji_amarillo_col',   true,  true,  'vegetable'),   -- yellow hot pepper
('aji_dulce',          true,  true,  'vegetable'),
('changua',            true,  false, 'other'),       -- milk & egg soup
('mondongo',           false, false, 'meat'),        -- tripe stew
('sancocho',           false, false, 'other'),       -- hearty stew
('arepuela',           true,  true,  'grain'),
('pandebono',          true,  false, 'grain'),       -- cheese bread
('buñuelo_col',        true,  false, 'grain'),
('obleas',             true,  false, 'other'),
('arequipe',           true,  false, 'condiment'),   -- Colombian dulce de leche
('bocadillo_col',      true,  true,  'other'),       -- guava paste block
('natilla_col',        true,  false, 'other'),

-- ── PERUVIAN ─────────────────────────────────────────────────
('ceviche',            false, false, 'other'),
('leche_de_tigre',     false, false, 'condiment'),   -- ceviche marinade
('aji_amarillo',       true,  true,  'vegetable'),
('aji_panca',          true,  true,  'vegetable'),
('aji_rocoto',         true,  true,  'vegetable'),
('aji_mirasol',        true,  true,  'vegetable'),
('limo_chile',         true,  true,  'vegetable'),
('huacatay',           true,  true,  'spice_herb'),  -- black mint
('culantro_peruano',   true,  true,  'spice_herb'),
('causa',              true,  true,  'other'),       -- potato terrine
('lomo_saltado',       false, false, 'other'),
('aji_de_gallina',     false, false, 'other'),
('papa_a_la_huancaina',true,  false, 'other'),
('anticucho',          false, false, 'other'),       -- grilled skewer
('tiradito',           false, false, 'other'),
('cau_cau',            false, false, 'other'),
('rocoto_relleno',     false, false, 'other'),
('chupe_de_camarones', false, false, 'other'),
('mazamorra_morada',   true,  true,  'other'),
('suspiro_limeño',     true,  false, 'other'),
('chicha_morada',      true,  true,  'beverage'),
('chicha_de_jora',     true,  true,  'alcohol'),
('pisco',              true,  true,  'alcohol'),
('papa_amarilla',      true,  true,  'vegetable'),
('papa_morada',        true,  true,  'vegetable'),
('yuca_peruana',       true,  true,  'vegetable'),
('cancha',             true,  true,  'grain'),       -- toasted corn
('choclo',             true,  true,  'vegetable'),   -- large-kernel Andean corn
('quinoa_negra',       true,  true,  'grain'),
('kiwicha',            true,  true,  'grain'),       -- Andean amaranth
('lucuma',             true,  true,  'fruit'),
('maracuya',           true,  true,  'fruit'),
('tumbo',              true,  true,  'fruit'),
('cherimoya',          true,  true,  'fruit'),
('tamarillo',          true,  true,  'fruit'),

-- ── ARGENTINIAN ──────────────────────────────────────────────
('asado',              false, false, 'meat'),        -- Argentine BBQ concept
('asado_de_tira',      false, false, 'meat'),        -- short ribs cut
('vacio',              false, false, 'meat'),        -- flank/bavette cut
('entraña',            false, false, 'meat'),        -- skirt steak
('mollejas',           false, false, 'meat'),        -- sweetbreads
('morcilla',           false, false, 'meat'),        -- blood sausage
('chorizo_argentino',  false, false, 'meat'),
('provoleta',          true,  false, 'dairy'),       -- grilled provolone
('chimichurri',        true,  true,  'condiment'),
('salsa_criolla',      true,  true,  'condiment'),
('empanada',           true,  false, 'grain'),       -- pastry dough; filling varies
('empanada_de_carne',  false, false, 'other'),
('empanada_de_jamon',  false, false, 'other'),
('facturas',           true,  false, 'grain'),       -- Argentine pastries
('medialunas',         true,  false, 'grain'),       -- croissant-like
('dulce_de_leche',     true,  false, 'condiment'),
('alfajor',            true,  false, 'other'),
('mate',               true,  true,  'beverage'),
('yerba_mate',         true,  true,  'beverage'),
('fernet',             true,  true,  'alcohol'),
('locro',              false, false, 'other'),       -- hearty stew
('humita',             true,  true,  'grain'),       -- corn tamal variant
('milanesa_argentina', false, false, 'meat'),        -- breaded schnitzel (beef)
('milanesa_napolitana',false, false, 'meat'),
('lomo_argentino',     false, false, 'meat'),        -- tenderloin

-- ── BRAZILIAN ────────────────────────────────────────────────
('feijoada',           false, false, 'other'),
('farofa',             true,  true,  'grain'),       -- toasted cassava flour
('pao_de_queijo',      true,  false, 'grain'),       -- cheese bread (GF)
('coxinha',            false, false, 'other'),       -- chicken croquette
('brigadeiro',         true,  false, 'other'),       -- chocolate truffle
('caipirinha',         true,  true,  'alcohol'),
('cachaca',            true,  true,  'alcohol'),
('guarana',            true,  true,  'beverage'),
('acai_bowl',          true,  true,  'other'),
('vatapa',             false, false, 'other'),
('moqueca',            false, false, 'other'),       -- fish/shrimp stew
('acaraje',            false, false, 'other'),       -- black-eyed pea fritters
('pao_frances',        true,  true,  'grain'),       -- French bread roll
('carne_seca',         false, false, 'meat'),        -- jerked beef / sun-dried beef
('linguica',           false, false, 'meat'),        -- smoked pork sausage
('frango',             false, false, 'poultry'),     -- Portuguese/BR for chicken
('requeijao',          true,  false, 'dairy'),       -- Brazilian cream cheese
('creme_de_leite',     true,  false, 'dairy'),       -- Brazilian table cream
('doce_de_leite_br',   true,  false, 'condiment'),
('tucupi',             true,  true,  'condiment'),   -- fermented manioc broth (Pará)
('jambu',              true,  true,  'vegetable'),   -- tingling herb (Amazonian)
('cupuacu',            true,  true,  'fruit'),
('bacuri',             true,  true,  'fruit'),
('buriti',             true,  true,  'fruit'),
('pitanga',            true,  true,  'fruit'),
('jabuticaba',         true,  true,  'fruit'),
('tapioca_br',         true,  true,  'grain'),       -- BR tapioca crepe
('pamonha',            true,  false, 'grain'),
('curau',              true,  false, 'other'),
('canjica',            true,  false, 'other'),
('quindim',            true,  false, 'other'),
('pudim_de_leite',     true,  false, 'other')

ON CONFLICT (canonical_name) DO NOTHING;
