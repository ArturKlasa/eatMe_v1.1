-- 124_canonical_menu_categories.sql
-- Created: 2026-04-25
--
-- Adds canonical menu-category support so the admin menu-scan flow can
-- (a) classify common sections (Appetizers / Wings / Pizza / etc.) against a
-- shared seeded taxonomy, and (b) carry per-language translations for those
-- sections + custom (restaurant-specific) sections.
--
-- Ships:
--   (a) canonical_menu_categories            — reference table, ~223 seeded rows,
--                                              names jsonb keyed by language code
--   (b) menu_categories.canonical_category_id (nullable FK)
--   (c) menu_categories.source_language_code  (nullable text — usually derived
--                                              from restaurants.country_code)
--   (d) menu_categories.name_translations     (jsonb, custom-category translations)
--   (e) Two partial unique indexes on menu_categories to prevent duplicates:
--         - one canonical link per (restaurant, canonical_category)
--         - one custom name per (restaurant, lower(name)) when no canonical link
--
-- The display contract for the mobile app becomes:
--   COALESCE(
--     menu_categories.name_translations->>$user_locale,
--     canonical.names->>$user_locale,
--     menu_categories.name
--   )
--
-- dish_categories (the global filtering/recommendation taxonomy) is intentionally
-- untouched — it serves a different purpose (consumer-invisible classification)
-- and stays as-is.
--
-- Reverse: 124_REVERSE_ONLY_canonical_menu_categories.sql

BEGIN;

-- ── (a) canonical_menu_categories ────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.canonical_menu_categories (
  id          uuid        NOT NULL DEFAULT gen_random_uuid(),
  slug        text        NOT NULL,
  sort_order  integer     NOT NULL DEFAULT 0,
  names       jsonb       NOT NULL DEFAULT '{}'::jsonb,
  is_active   boolean     NOT NULL DEFAULT true,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT canonical_menu_categories_pkey PRIMARY KEY (id),
  CONSTRAINT canonical_menu_categories_slug_unique UNIQUE (slug)
);

ALTER TABLE public.canonical_menu_categories ENABLE ROW LEVEL SECURITY;

-- Public read for active rows (mobile + admin both need this)
CREATE POLICY "canonical_menu_categories: public read"
  ON public.canonical_menu_categories
  FOR SELECT
  USING (is_active = true);

-- ── (b/c/d) Extend menu_categories ───────────────────────────────────────────
ALTER TABLE public.menu_categories
  ADD COLUMN IF NOT EXISTS canonical_category_id uuid
    REFERENCES public.canonical_menu_categories(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS source_language_code  text,
  ADD COLUMN IF NOT EXISTS name_translations     jsonb NOT NULL DEFAULT '{}'::jsonb;

-- ── (e0) Pre-cleanup — dedupe existing menu_categories rows that would ──────
-- violate the new partial unique indexes. For each duplicate group keyed by
-- (restaurant_id, menu_id, lower(name)), keep the earliest-created row;
-- re-attach any dishes / option_groups pointing at the losers to the keeper;
-- then delete the losers.
--
-- Idempotent: produces no changes when there are no duplicates. Runs against
-- WHERE canonical_category_id IS NULL because the ALTER above just added the
-- column with default NULL, so all pre-existing rows match.
WITH ranked AS (
  SELECT id,
         FIRST_VALUE(id) OVER (
           PARTITION BY restaurant_id, menu_id, lower(name)
           ORDER BY created_at NULLS LAST, id
         ) AS keeper_id,
         ROW_NUMBER() OVER (
           PARTITION BY restaurant_id, menu_id, lower(name)
           ORDER BY created_at NULLS LAST, id
         ) AS rn
  FROM public.menu_categories
  WHERE canonical_category_id IS NULL
),
losers AS (
  SELECT id AS loser_id, keeper_id FROM ranked WHERE rn > 1
)
UPDATE public.dishes
SET menu_category_id = losers.keeper_id
FROM losers
WHERE dishes.menu_category_id = losers.loser_id;

-- option_groups.menu_category_id may or may not exist on a given environment
-- (the column is optional and absent on some deployments). Conditional via
-- information_schema so the migration runs cleanly in either case.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'option_groups'
      AND column_name = 'menu_category_id'
  ) THEN
    WITH ranked AS (
      SELECT id,
             FIRST_VALUE(id) OVER (
               PARTITION BY restaurant_id, menu_id, lower(name)
               ORDER BY created_at NULLS LAST, id
             ) AS keeper_id,
             ROW_NUMBER() OVER (
               PARTITION BY restaurant_id, menu_id, lower(name)
               ORDER BY created_at NULLS LAST, id
             ) AS rn
      FROM public.menu_categories
      WHERE canonical_category_id IS NULL
    ),
    losers AS (
      SELECT id AS loser_id, keeper_id FROM ranked WHERE rn > 1
    )
    UPDATE public.option_groups
    SET menu_category_id = losers.keeper_id
    FROM losers
    WHERE option_groups.menu_category_id = losers.loser_id;
  END IF;
END $$;

DELETE FROM public.menu_categories mc
USING (
  SELECT id FROM (
    SELECT id,
           ROW_NUMBER() OVER (
             PARTITION BY restaurant_id, menu_id, lower(name)
             ORDER BY created_at NULLS LAST, id
           ) AS rn
    FROM public.menu_categories
    WHERE canonical_category_id IS NULL
  ) t WHERE t.rn > 1
) losers
WHERE mc.id = losers.id;

-- ── (e) Partial unique indexes — prevent duplicate categories per (restaurant, menu) ─
-- The constraint is keyed on (restaurant_id, menu_id, ...) rather than just
-- restaurant_id so that a restaurant with multiple menus (e.g. Food + Drink, or
-- Lunch + Dinner) can legitimately have the same section name in each.
--
-- Postgres treats NULL menu_ids as distinct in unique indexes, so legacy rows
-- with menu_id IS NULL aren't fully protected — that's accepted because new
-- rows created via the admin scan flow always populate menu_id.

-- Canonical-linked: same (restaurant, menu) cannot link the same canonical category twice.
CREATE UNIQUE INDEX IF NOT EXISTS menu_categories_canonical_unique
  ON public.menu_categories (restaurant_id, menu_id, canonical_category_id)
  WHERE canonical_category_id IS NOT NULL;

-- Custom (no canonical link): same (restaurant, menu) cannot have two custom
-- categories with the same case-insensitive name. Application layer also dedupes
-- within a single scan; this index protects against concurrent scans / replays.
CREATE UNIQUE INDEX IF NOT EXISTS menu_categories_custom_name_unique
  ON public.menu_categories (restaurant_id, menu_id, lower(name))
  WHERE canonical_category_id IS NULL;

-- ── Seed canonical categories (~223 rows) ───────────────────────────────────
-- ON CONFLICT (slug) DO NOTHING so re-running this migration is safe.
-- Translations: en (English), es (Spanish), pl (Polish). Loan words (Pizza,
-- Sushi, Tapas, etc.) intentionally kept identical across languages.
-- sort_order increments by 10 within each section to allow future insertions.

INSERT INTO public.canonical_menu_categories (slug, sort_order, names) VALUES
  -- ── Meal periods (10–60) ──────────────────────────────────────────────────
  ('breakfast',          10, '{"en":"Breakfast","es":"Desayuno","pl":"Śniadanie"}'::jsonb),
  ('brunch',             20, '{"en":"Brunch","es":"Brunch","pl":"Brunch"}'::jsonb),
  ('lunch',              30, '{"en":"Lunch","es":"Almuerzo","pl":"Lunch"}'::jsonb),
  ('dinner',             40, '{"en":"Dinner","es":"Cena","pl":"Kolacja"}'::jsonb),
  ('all_day',            50, '{"en":"All-Day","es":"Todo el día","pl":"Cały dzień"}'::jsonb),
  ('late_night',         60, '{"en":"Late Night","es":"Madrugada","pl":"Późny wieczór"}'::jsonb),

  -- ── Course structure (100–230) ────────────────────────────────────────────
  ('appetizers',        100, '{"en":"Appetizers","es":"Entrantes","pl":"Przystawki"}'::jsonb),
  ('mains',             110, '{"en":"Mains","es":"Platos principales","pl":"Dania główne"}'::jsonb),
  ('sides',             120, '{"en":"Sides","es":"Guarniciones","pl":"Dodatki"}'::jsonb),
  ('desserts',          130, '{"en":"Desserts","es":"Postres","pl":"Desery"}'::jsonb),
  ('soups',             140, '{"en":"Soups","es":"Sopas","pl":"Zupy"}'::jsonb),
  ('salads',            150, '{"en":"Salads","es":"Ensaladas","pl":"Sałatki"}'::jsonb),
  ('snacks',            160, '{"en":"Snacks","es":"Aperitivos","pl":"Przekąski"}'::jsonb),
  ('sharing_platters',  170, '{"en":"Sharing Platters","es":"Para compartir","pl":"Do dzielenia"}'::jsonb),
  ('tapas',             180, '{"en":"Tapas","es":"Tapas","pl":"Tapas"}'::jsonb),
  ('specials',          190, '{"en":"Specials","es":"Especiales","pl":"Specjalności"}'::jsonb),
  ('chefs_selection',   200, '{"en":"Chef''s Selection","es":"Selección del chef","pl":"Wybór szefa kuchni"}'::jsonb),
  ('seasonal',          210, '{"en":"Seasonal","es":"De temporada","pl":"Sezonowe"}'::jsonb),
  ('set_menus',         220, '{"en":"Set Menus","es":"Menús fijos","pl":"Zestawy"}'::jsonb),

  -- ── Sandwich-like (300–390) ───────────────────────────────────────────────
  ('sandwiches',        300, '{"en":"Sandwiches","es":"Sándwiches","pl":"Kanapki"}'::jsonb),
  ('wraps',             310, '{"en":"Wraps","es":"Wraps","pl":"Wrapy"}'::jsonb),
  ('burgers',           320, '{"en":"Burgers","es":"Hamburguesas","pl":"Burgery"}'::jsonb),
  ('hot_dogs',          330, '{"en":"Hot Dogs","es":"Hot Dogs","pl":"Hot dogi"}'::jsonb),
  ('toasts',            340, '{"en":"Toasts","es":"Tostadas","pl":"Tosty"}'::jsonb),
  ('paninis',           350, '{"en":"Paninis","es":"Paninis","pl":"Paniny"}'::jsonb),
  ('pita_gyros',        360, '{"en":"Pita / Gyros","es":"Pita / Gyros","pl":"Pita / Gyros"}'::jsonb),
  ('bagels',            370, '{"en":"Bagels","es":"Bagels","pl":"Bajgle"}'::jsonb),
  ('tartines',          380, '{"en":"Tartines","es":"Tartines","pl":"Tartines"}'::jsonb),

  -- ── Bowls & combos (400–460) ──────────────────────────────────────────────
  ('bowls',             400, '{"en":"Bowls","es":"Bowls","pl":"Miski"}'::jsonb),
  ('poke_bowls',        410, '{"en":"Poke Bowls","es":"Poke Bowls","pl":"Poke Bowls"}'::jsonb),
  ('smoothie_bowls',    420, '{"en":"Smoothie Bowls","es":"Smoothie Bowls","pl":"Miski smoothie"}'::jsonb),
  ('combos',            430, '{"en":"Combos","es":"Combos","pl":"Combo"}'::jsonb),
  ('kids_menu',         440, '{"en":"Kids Menu","es":"Menú infantil","pl":"Menu dla dzieci"}'::jsonb),
  ('family_meals',      450, '{"en":"Family Meals","es":"Para la familia","pl":"Dania rodzinne"}'::jsonb),

  -- ── Italian / Mediterranean (500–590) ─────────────────────────────────────
  ('pizza',             500, '{"en":"Pizza","es":"Pizza","pl":"Pizza"}'::jsonb),
  ('pasta',             510, '{"en":"Pasta","es":"Pasta","pl":"Makarony"}'::jsonb),
  ('gnocchi',           520, '{"en":"Gnocchi","es":"Ñoquis","pl":"Gnocchi"}'::jsonb),
  ('risotto',           530, '{"en":"Risotto","es":"Risotto","pl":"Risotto"}'::jsonb),
  ('lasagna',           540, '{"en":"Lasagna","es":"Lasaña","pl":"Lasagne"}'::jsonb),
  ('calzones',          550, '{"en":"Calzones","es":"Calzones","pl":"Calzony"}'::jsonb),
  ('antipasti',         560, '{"en":"Antipasti","es":"Antipasti","pl":"Antipasti"}'::jsonb),
  ('bread_bakery',      570, '{"en":"Bread & Bakery","es":"Pan y panadería","pl":"Pieczywo"}'::jsonb),
  ('focaccia',          580, '{"en":"Focaccia","es":"Focaccia","pl":"Focaccia"}'::jsonb),
  ('polenta',           590, '{"en":"Polenta","es":"Polenta","pl":"Polenta"}'::jsonb),

  -- ── Bakery / pastry (600–650) ─────────────────────────────────────────────
  ('croissants',        600, '{"en":"Croissants","es":"Croissants","pl":"Croissanty"}'::jsonb),
  ('pastries',          610, '{"en":"Pastries","es":"Pastelería","pl":"Wypieki"}'::jsonb),
  ('muffins_scones',    620, '{"en":"Muffins & Scones","es":"Muffins y Scones","pl":"Muffiny i scones"}'::jsonb),
  ('donuts',            630, '{"en":"Donuts","es":"Donas","pl":"Pączki"}'::jsonb),
  ('pretzels',          640, '{"en":"Pretzels","es":"Pretzels","pl":"Precle"}'::jsonb),
  ('pies_savory',       650, '{"en":"Savory Pies","es":"Pasteles salados","pl":"Wytrawne pieczone"}'::jsonb),

  -- ── Japanese (700–760) ────────────────────────────────────────────────────
  ('sushi',             700, '{"en":"Sushi","es":"Sushi","pl":"Sushi"}'::jsonb),
  ('sashimi',           710, '{"en":"Sashimi","es":"Sashimi","pl":"Sashimi"}'::jsonb),
  ('sushi_rolls',       720, '{"en":"Sushi Rolls","es":"Rollos de sushi","pl":"Rolki sushi"}'::jsonb),
  ('nigiri',            730, '{"en":"Nigiri","es":"Nigiri","pl":"Nigiri"}'::jsonb),
  ('tempura',           740, '{"en":"Tempura","es":"Tempura","pl":"Tempura"}'::jsonb),
  ('teriyaki',          750, '{"en":"Teriyaki","es":"Teriyaki","pl":"Teriyaki"}'::jsonb),
  ('bento',             760, '{"en":"Bento","es":"Bento","pl":"Bento"}'::jsonb),

  -- ── Pan-Asian (800–910) ───────────────────────────────────────────────────
  ('noodles',           800, '{"en":"Noodles","es":"Fideos","pl":"Makarony azjatyckie"}'::jsonb),
  ('ramen',             810, '{"en":"Ramen","es":"Ramen","pl":"Ramen"}'::jsonb),
  ('pho',               820, '{"en":"Pho","es":"Pho","pl":"Pho"}'::jsonb),
  ('stir_fry',          830, '{"en":"Stir-Fry","es":"Salteados","pl":"Dania z woka"}'::jsonb),
  ('rice_dishes',       840, '{"en":"Rice Dishes","es":"Arroces","pl":"Dania z ryżem"}'::jsonb),
  ('fried_rice',        850, '{"en":"Fried Rice","es":"Arroz frito","pl":"Smażony ryż"}'::jsonb),
  ('curries',           860, '{"en":"Curries","es":"Currys","pl":"Curry"}'::jsonb),
  ('dim_sum',           870, '{"en":"Dim Sum","es":"Dim Sum","pl":"Dim Sum"}'::jsonb),
  ('bao',               880, '{"en":"Bao","es":"Bao","pl":"Bao"}'::jsonb),
  ('dumplings',         890, '{"en":"Dumplings","es":"Dumplings","pl":"Pierożki azjatyckie"}'::jsonb),
  ('hot_pot',           900, '{"en":"Hot Pot","es":"Hot Pot","pl":"Hot Pot"}'::jsonb),

  -- ── Korean (1000–1090) ────────────────────────────────────────────────────
  ('korean_bbq',       1000, '{"en":"Korean BBQ","es":"Barbacoa Coreana","pl":"Koreańskie BBQ"}'::jsonb),
  ('bulgogi',          1010, '{"en":"Bulgogi","es":"Bulgogi","pl":"Bulgogi"}'::jsonb),
  ('galbi',            1020, '{"en":"Galbi","es":"Galbi","pl":"Galbi"}'::jsonb),
  ('korean_fried_chicken', 1030, '{"en":"Korean Fried Chicken","es":"Pollo frito coreano","pl":"Koreański smażony kurczak"}'::jsonb),
  ('tteokbokki',       1040, '{"en":"Tteokbokki","es":"Tteokbokki","pl":"Tteokbokki"}'::jsonb),
  ('korean_stews',     1050, '{"en":"Korean Stews","es":"Guisos coreanos","pl":"Koreańskie gulasze"}'::jsonb),
  ('banchan',          1060, '{"en":"Banchan","es":"Banchan","pl":"Banchan"}'::jsonb),
  ('kimbap',           1070, '{"en":"Kimbap","es":"Kimbap","pl":"Kimbap"}'::jsonb),
  ('mandu',            1080, '{"en":"Mandu","es":"Mandu","pl":"Mandu"}'::jsonb),
  ('japchae',          1090, '{"en":"Japchae","es":"Japchae","pl":"Japchae"}'::jsonb),

  -- ── Thai (1100–1130) ──────────────────────────────────────────────────────
  ('tom_yum',          1100, '{"en":"Tom Yum","es":"Tom Yum","pl":"Tom Yum"}'::jsonb),
  ('thai_curries',     1110, '{"en":"Thai Curries","es":"Currys Tailandeses","pl":"Tajskie curry"}'::jsonb),
  ('som_tam',          1120, '{"en":"Som Tam","es":"Som Tam","pl":"Som Tam"}'::jsonb),
  ('pad_see_ew',       1130, '{"en":"Pad See Ew","es":"Pad See Ew","pl":"Pad See Ew"}'::jsonb),

  -- ── Vietnamese (1200–1230) ────────────────────────────────────────────────
  ('banh_mi',          1200, '{"en":"Banh Mi","es":"Banh Mi","pl":"Banh Mi"}'::jsonb),
  ('vietnamese_spring_rolls', 1210, '{"en":"Vietnamese Spring Rolls","es":"Rollitos vietnamitas","pl":"Wietnamskie sajgonki"}'::jsonb),
  ('vermicelli_bowls', 1220, '{"en":"Vermicelli Bowls","es":"Bowls de fideos","pl":"Miski z makaronem ryżowym"}'::jsonb),
  ('bun_cha',          1230, '{"en":"Bun Cha","es":"Bun Cha","pl":"Bun Cha"}'::jsonb),

  -- ── Chinese (1300–1340) ───────────────────────────────────────────────────
  ('peking_duck',      1300, '{"en":"Peking Duck","es":"Pato Pekín","pl":"Kaczka po pekińsku"}'::jsonb),
  ('sweet_and_sour',   1310, '{"en":"Sweet & Sour","es":"Agridulce","pl":"Słodko-kwaśne"}'::jsonb),
  ('char_siu',         1320, '{"en":"Char Siu","es":"Char Siu","pl":"Char Siu"}'::jsonb),
  ('mapo_tofu',        1330, '{"en":"Mapo Tofu","es":"Mapo Tofu","pl":"Mapo Tofu"}'::jsonb),
  ('wonton_soup',      1340, '{"en":"Wonton Soup","es":"Sopa wonton","pl":"Zupa wonton"}'::jsonb),

  -- ── Filipino (1400–1420) ──────────────────────────────────────────────────
  ('adobo',            1400, '{"en":"Adobo","es":"Adobo","pl":"Adobo"}'::jsonb),
  ('lumpia',           1410, '{"en":"Lumpia","es":"Lumpia","pl":"Lumpia"}'::jsonb),
  ('sinigang',         1420, '{"en":"Sinigang","es":"Sinigang","pl":"Sinigang"}'::jsonb),

  -- ── Mexican (1500–1630) ───────────────────────────────────────────────────
  ('tacos',            1500, '{"en":"Tacos","es":"Tacos","pl":"Tacos"}'::jsonb),
  ('burritos',         1510, '{"en":"Burritos","es":"Burritos","pl":"Burritos"}'::jsonb),
  ('quesadillas',      1520, '{"en":"Quesadillas","es":"Quesadillas","pl":"Quesadille"}'::jsonb),
  ('nachos',           1530, '{"en":"Nachos","es":"Nachos","pl":"Nachos"}'::jsonb),
  ('enchiladas',       1540, '{"en":"Enchiladas","es":"Enchiladas","pl":"Enchiladas"}'::jsonb),
  ('fajitas',          1550, '{"en":"Fajitas","es":"Fajitas","pl":"Fajitas"}'::jsonb),
  ('tamales',          1560, '{"en":"Tamales","es":"Tamales","pl":"Tamale"}'::jsonb),
  ('empanadas',        1570, '{"en":"Empanadas","es":"Empanadas","pl":"Empanady"}'::jsonb),
  ('tortas',           1580, '{"en":"Tortas","es":"Tortas","pl":"Tortas"}'::jsonb),
  ('tostadas',         1590, '{"en":"Tostadas","es":"Tostadas","pl":"Tostadas"}'::jsonb),
  ('chimichangas',     1600, '{"en":"Chimichangas","es":"Chimichangas","pl":"Chimichangas"}'::jsonb),
  ('chilaquiles',      1610, '{"en":"Chilaquiles","es":"Chilaquiles","pl":"Chilaquiles"}'::jsonb),
  ('sopes',            1620, '{"en":"Sopes","es":"Sopes","pl":"Sopes"}'::jsonb),
  ('flautas',          1630, '{"en":"Flautas","es":"Flautas","pl":"Flautas"}'::jsonb),

  -- ── Latin American (1700–1790) ────────────────────────────────────────────
  ('ceviche',          1700, '{"en":"Ceviche","es":"Ceviche","pl":"Ceviche"}'::jsonb),
  ('arepas',           1710, '{"en":"Arepas","es":"Arepas","pl":"Arepas"}'::jsonb),
  ('asado',            1720, '{"en":"Asado","es":"Asado","pl":"Asado"}'::jsonb),
  ('milanesa',         1730, '{"en":"Milanesa","es":"Milanesa","pl":"Milanesa"}'::jsonb),
  ('feijoada',         1740, '{"en":"Feijoada","es":"Feijoada","pl":"Feijoada"}'::jsonb),
  ('pao_de_queijo',    1750, '{"en":"Pão de Queijo","es":"Pão de Queijo","pl":"Pão de Queijo"}'::jsonb),
  ('lomo_saltado',     1760, '{"en":"Lomo Saltado","es":"Lomo Saltado","pl":"Lomo Saltado"}'::jsonb),
  ('anticuchos',       1770, '{"en":"Anticuchos","es":"Anticuchos","pl":"Anticuchos"}'::jsonb),
  ('cuban_sandwiches', 1780, '{"en":"Cuban Sandwiches","es":"Sándwiches Cubanos","pl":"Kanapki kubańskie"}'::jsonb),
  ('paella',           1790, '{"en":"Paella","es":"Paella","pl":"Paella"}'::jsonb),

  -- ── Indian (1800–1920) ────────────────────────────────────────────────────
  ('tandoori',         1800, '{"en":"Tandoori","es":"Tandoori","pl":"Tandoori"}'::jsonb),
  ('biryani',          1810, '{"en":"Biryani","es":"Biryani","pl":"Biryani"}'::jsonb),
  ('naan',             1820, '{"en":"Naan","es":"Naan","pl":"Naan"}'::jsonb),
  ('dosas',            1830, '{"en":"Dosas","es":"Dosas","pl":"Dosa"}'::jsonb),
  ('tikka_dishes',     1840, '{"en":"Tikka Dishes","es":"Platos Tikka","pl":"Dania tikka"}'::jsonb),
  ('dal_lentils',      1850, '{"en":"Dal & Lentils","es":"Dal y Lentejas","pl":"Dal i soczewica"}'::jsonb),
  ('indian_breads',    1860, '{"en":"Indian Breads","es":"Panes Indios","pl":"Indyjskie pieczywo"}'::jsonb),
  ('samosas',          1870, '{"en":"Samosas","es":"Samosas","pl":"Samosy"}'::jsonb),
  ('pakoras',          1880, '{"en":"Pakoras","es":"Pakoras","pl":"Pakory"}'::jsonb),
  ('chaat',            1890, '{"en":"Chaat","es":"Chaat","pl":"Chaat"}'::jsonb),
  ('thali',            1900, '{"en":"Thali","es":"Thali","pl":"Thali"}'::jsonb),
  ('paneer_dishes',    1910, '{"en":"Paneer Dishes","es":"Platos con Paneer","pl":"Dania z paneer"}'::jsonb),
  ('indian_sweets',    1920, '{"en":"Indian Sweets","es":"Dulces Indios","pl":"Indyjskie słodycze"}'::jsonb),

  -- ── Middle Eastern (2000–2120) ────────────────────────────────────────────
  ('kebabs',           2000, '{"en":"Kebabs","es":"Kebabs","pl":"Kebaby"}'::jsonb),
  ('shawarma',         2010, '{"en":"Shawarma","es":"Shawarma","pl":"Shawarma"}'::jsonb),
  ('falafel',          2020, '{"en":"Falafel","es":"Falafel","pl":"Falafel"}'::jsonb),
  ('hummus_dips',      2030, '{"en":"Hummus & Dips","es":"Hummus y Dips","pl":"Hummus i dipy"}'::jsonb),
  ('mezze',            2040, '{"en":"Mezze","es":"Mezze","pl":"Mezze"}'::jsonb),
  ('tagines',          2050, '{"en":"Tagines","es":"Tajines","pl":"Tagine"}'::jsonb),
  ('couscous',         2060, '{"en":"Couscous","es":"Cuscús","pl":"Kuskus"}'::jsonb),
  ('manakish',         2070, '{"en":"Manakish","es":"Manakish","pl":"Manakish"}'::jsonb),
  ('shakshuka',        2080, '{"en":"Shakshuka","es":"Shakshuka","pl":"Szakszuka"}'::jsonb),
  ('kofta',            2090, '{"en":"Kofta","es":"Kofta","pl":"Kofta"}'::jsonb),
  ('halloumi',         2100, '{"en":"Halloumi","es":"Halloumi","pl":"Halloumi"}'::jsonb),
  ('stuffed_grape_leaves', 2110, '{"en":"Stuffed Grape Leaves","es":"Hojas de parra rellenas","pl":"Faszerowane liście winogron"}'::jsonb),
  ('manti',            2120, '{"en":"Manti","es":"Manti","pl":"Manti"}'::jsonb),

  -- ── Greek (2200–2230) ─────────────────────────────────────────────────────
  ('souvlaki',         2200, '{"en":"Souvlaki","es":"Souvlaki","pl":"Souvlaki"}'::jsonb),
  ('moussaka',         2210, '{"en":"Moussaka","es":"Musaca","pl":"Musaka"}'::jsonb),
  ('spanakopita',      2220, '{"en":"Spanakopita","es":"Spanakopita","pl":"Spanakopita"}'::jsonb),
  ('greek_plates',     2230, '{"en":"Greek Plates","es":"Platos griegos","pl":"Dania greckie"}'::jsonb),

  -- ── European / Central European (2300–2420) ───────────────────────────────
  ('schnitzel',        2300, '{"en":"Schnitzel","es":"Escalope","pl":"Sznycel"}'::jsonb),
  ('pierogi',          2310, '{"en":"Pierogi","es":"Pierogi","pl":"Pierogi"}'::jsonb),
  ('goulash',          2320, '{"en":"Goulash","es":"Gulash","pl":"Gulasz"}'::jsonb),
  ('spaetzle',         2330, '{"en":"Spätzle","es":"Spätzle","pl":"Spätzle"}'::jsonb),
  ('cabbage_rolls',    2340, '{"en":"Cabbage Rolls","es":"Rollos de col","pl":"Gołąbki"}'::jsonb),
  ('stews_casseroles', 2350, '{"en":"Stews & Casseroles","es":"Estofados y guisos","pl":"Gulasze i potrawki"}'::jsonb),
  ('polish_classics',  2360, '{"en":"Polish Classics","es":"Clásicos polacos","pl":"Klasyki kuchni polskiej"}'::jsonb),
  ('quiches_tarts',    2370, '{"en":"Quiches & Tarts","es":"Quiches y Tartas","pl":"Quiche i tarty"}'::jsonb),
  ('galettes',         2380, '{"en":"Galettes","es":"Galettes","pl":"Galette"}'::jsonb),
  ('game_dishes',      2390, '{"en":"Game Dishes","es":"Caza","pl":"Dania z dziczyzny"}'::jsonb),
  ('potato_dishes',    2400, '{"en":"Potato Dishes","es":"Platos de patata","pl":"Dania ziemniaczane"}'::jsonb),
  ('bigos',            2410, '{"en":"Bigos","es":"Bigos","pl":"Bigos"}'::jsonb),
  ('crepes',           2420, '{"en":"Crepes","es":"Crepes","pl":"Naleśniki"}'::jsonb),

  -- ── Caribbean / African (2500–2540) ───────────────────────────────────────
  ('jerk_chicken',     2500, '{"en":"Jerk Chicken","es":"Pollo Jerk","pl":"Jerk Chicken"}'::jsonb),
  ('caribbean_plates', 2510, '{"en":"Caribbean Plates","es":"Platos caribeños","pl":"Dania karaibskie"}'::jsonb),
  ('patties',          2520, '{"en":"Patties","es":"Empanadas caribeñas","pl":"Patties karaibskie"}'::jsonb),
  ('jollof_rice',      2530, '{"en":"Jollof Rice","es":"Arroz Jollof","pl":"Ryż Jollof"}'::jsonb),
  ('injera_stews',     2540, '{"en":"Injera & Stews","es":"Injera y Guisos","pl":"Injera i gulasze"}'::jsonb),

  -- ── Protein-focused (2600–2690) ───────────────────────────────────────────
  ('wings',            2600, '{"en":"Wings","es":"Alitas","pl":"Skrzydełka"}'::jsonb),
  ('skewers',          2610, '{"en":"Skewers","es":"Brochetas","pl":"Szaszłyki"}'::jsonb),
  ('steaks',           2620, '{"en":"Steaks","es":"Filetes","pl":"Steki"}'::jsonb),
  ('ribs',             2630, '{"en":"Ribs","es":"Costillas","pl":"Żeberka"}'::jsonb),
  ('lamb',             2640, '{"en":"Lamb","es":"Cordero","pl":"Jagnięcina"}'::jsonb),
  ('duck',             2650, '{"en":"Duck","es":"Pato","pl":"Kaczka"}'::jsonb),
  ('bbq_grill',        2660, '{"en":"BBQ / Grill","es":"BBQ / Parrilla","pl":"BBQ / Grill"}'::jsonb),
  ('rotisserie',       2670, '{"en":"Rotisserie","es":"Rostizado","pl":"Mięsa z rożna"}'::jsonb),
  ('sausages',         2680, '{"en":"Sausages","es":"Salchichas","pl":"Kiełbasy"}'::jsonb),
  ('meatballs',        2690, '{"en":"Meatballs","es":"Albóndigas","pl":"Klopsiki"}'::jsonb),

  -- ── Seafood (2700–2760) ───────────────────────────────────────────────────
  ('seafood',          2700, '{"en":"Seafood","es":"Mariscos","pl":"Owoce morza"}'::jsonb),
  ('fish_and_chips',   2710, '{"en":"Fish & Chips","es":"Fish & Chips","pl":"Fish & Chips"}'::jsonb),
  ('shellfish',        2720, '{"en":"Shellfish","es":"Marisco","pl":"Skorupiaki"}'::jsonb),
  ('oysters',          2730, '{"en":"Oysters","es":"Ostras","pl":"Ostrygi"}'::jsonb),
  ('tartare_carpaccio', 2740, '{"en":"Tartare / Carpaccio","es":"Tartar / Carpaccio","pl":"Tatar / Carpaccio"}'::jsonb),
  ('mussels',          2750, '{"en":"Mussels","es":"Mejillones","pl":"Małże"}'::jsonb),
  ('lobster',          2760, '{"en":"Lobster","es":"Langosta","pl":"Homar"}'::jsonb),

  -- ── Breakfast staples (2800–2890) ─────────────────────────────────────────
  ('eggs',             2800, '{"en":"Eggs","es":"Huevos","pl":"Jajka"}'::jsonb),
  ('omelettes',        2810, '{"en":"Omelettes","es":"Tortillas","pl":"Omlety"}'::jsonb),
  ('pancakes',         2820, '{"en":"Pancakes","es":"Tortitas","pl":"Pancakes"}'::jsonb),
  ('waffles',          2830, '{"en":"Waffles","es":"Gofres","pl":"Gofry"}'::jsonb),
  ('french_toast',     2840, '{"en":"French Toast","es":"Tostadas Francesas","pl":"Tosty francuskie"}'::jsonb),
  ('cereals_granola',  2850, '{"en":"Cereals & Granola","es":"Cereales y Granola","pl":"Płatki i granola"}'::jsonb),
  ('yogurts_parfaits', 2860, '{"en":"Yogurts & Parfaits","es":"Yogures y Parfaits","pl":"Jogurty i parfaity"}'::jsonb),
  ('hash_browns',      2870, '{"en":"Hash Browns","es":"Hash Browns","pl":"Placki ziemniaczane"}'::jsonb),
  ('oatmeal_porridge', 2880, '{"en":"Oatmeal & Porridge","es":"Avena","pl":"Owsianka"}'::jsonb),
  ('breakfast_sandwiches', 2890, '{"en":"Breakfast Sandwiches","es":"Sándwiches de desayuno","pl":"Kanapki śniadaniowe"}'::jsonb),

  -- ── Diet-focused (2900–2920) ──────────────────────────────────────────────
  ('vegetarian',       2900, '{"en":"Vegetarian","es":"Vegetariano","pl":"Wegetariańskie"}'::jsonb),
  ('vegan',            2910, '{"en":"Vegan","es":"Vegano","pl":"Wegańskie"}'::jsonb),
  ('gluten_free',      2920, '{"en":"Gluten-Free","es":"Sin gluten","pl":"Bezglutenowe"}'::jsonb),

  -- ── Sweets (3000–3060) ────────────────────────────────────────────────────
  ('ice_cream',        3000, '{"en":"Ice Cream","es":"Helados","pl":"Lody"}'::jsonb),
  ('gelato',           3010, '{"en":"Gelato","es":"Gelato","pl":"Gelato"}'::jsonb),
  ('cakes',            3020, '{"en":"Cakes","es":"Pasteles","pl":"Ciasta"}'::jsonb),
  ('pies_sweet',       3030, '{"en":"Sweet Pies","es":"Tartas dulces","pl":"Słodkie placki"}'::jsonb),
  ('cookies',          3040, '{"en":"Cookies","es":"Galletas","pl":"Ciastka"}'::jsonb),
  ('mochi',            3050, '{"en":"Mochi","es":"Mochi","pl":"Mochi"}'::jsonb),
  ('macarons',         3060, '{"en":"Macarons","es":"Macarons","pl":"Makaroniki"}'::jsonb),

  -- ── Cheese / charcuterie / dips (3100–3120) ───────────────────────────────
  ('cheese',           3100, '{"en":"Cheese","es":"Quesos","pl":"Sery"}'::jsonb),
  ('charcuterie',      3110, '{"en":"Charcuterie","es":"Embutidos","pl":"Wędliny i deski"}'::jsonb),
  ('sauces_dips',      3120, '{"en":"Sauces & Dips","es":"Salsas y Dips","pl":"Sosy i dipy"}'::jsonb),

  -- ── Drinks (3200–3360) ────────────────────────────────────────────────────
  ('drinks',           3200, '{"en":"Drinks","es":"Bebidas","pl":"Napoje"}'::jsonb),
  ('soft_drinks',      3210, '{"en":"Soft Drinks","es":"Refrescos","pl":"Napoje gazowane"}'::jsonb),
  ('juices',           3220, '{"en":"Juices","es":"Zumos","pl":"Soki"}'::jsonb),
  ('smoothies',        3230, '{"en":"Smoothies","es":"Smoothies","pl":"Smoothie"}'::jsonb),
  ('milkshakes',       3240, '{"en":"Milkshakes","es":"Batidos","pl":"Koktajle mleczne"}'::jsonb),
  ('lemonades',        3250, '{"en":"Lemonades","es":"Limonadas","pl":"Lemoniady"}'::jsonb),
  ('kombucha',         3260, '{"en":"Kombucha","es":"Kombucha","pl":"Kombucha"}'::jsonb),
  ('coffee',           3270, '{"en":"Coffee","es":"Café","pl":"Kawa"}'::jsonb),
  ('espresso_drinks',  3280, '{"en":"Espresso Drinks","es":"Cafés espresso","pl":"Kawy espresso"}'::jsonb),
  ('tea',              3290, '{"en":"Tea","es":"Té","pl":"Herbata"}'::jsonb),
  ('iced_tea',         3300, '{"en":"Iced Tea","es":"Té helado","pl":"Mrożona herbata"}'::jsonb),
  ('hot_chocolate',    3310, '{"en":"Hot Chocolate","es":"Chocolate caliente","pl":"Gorąca czekolada"}'::jsonb),
  ('cocktails',        3320, '{"en":"Cocktails","es":"Cócteles","pl":"Koktajle"}'::jsonb),
  ('mocktails',        3330, '{"en":"Mocktails","es":"Mocktails","pl":"Drinki bezalkoholowe"}'::jsonb),
  ('wine',             3340, '{"en":"Wine","es":"Vino","pl":"Wino"}'::jsonb),
  ('beer',             3350, '{"en":"Beer","es":"Cerveza","pl":"Piwo"}'::jsonb),
  ('spirits',          3360, '{"en":"Spirits","es":"Licores","pl":"Alkohole"}'::jsonb)
ON CONFLICT (slug) DO NOTHING;

COMMIT;
