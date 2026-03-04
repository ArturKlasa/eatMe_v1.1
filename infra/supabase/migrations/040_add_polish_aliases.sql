-- Migration 040: Polish language aliases for all canonical ingredients
--
-- COVERAGE:
--   Part A — Polish (pl) aliases for existing core canonicals
--   Part B — Polish (pl) + English (en) aliases for new Polish canonicals (039)
--
-- UNTRANSLATABLE LOANWORDS STRATEGY:
--   Terms used as-is on English menus (pierogi, kielbasa, bigos, barszcz…)
--   receive BOTH a 'pl' alias AND an 'en' alias with the same word.
--   This means the DB lookup succeeds regardless of UI language, with no AI needed.
--
-- DIACRITICS: Polish diacritics (ą ę ó ś ź ż ć ń ł Ó etc.) are used in
--   display_name values. The canonical_name column uses ASCII snake_case only.
--
-- ON CONFLICT (display_name) DO NOTHING → idempotent.
-- ─────────────────────────────────────────────────────────────────────────────

DO $$
DECLARE v UUID;
BEGIN

-- ============================================================
-- PART A — EXISTING CANONICALS → POLISH ALIASES
-- ============================================================

-- ── DAIRY (Nabiał) ──────────────────────────────────────────

SELECT id INTO v FROM canonical_ingredients WHERE canonical_name = 'milk';
IF v IS NOT NULL THEN INSERT INTO ingredient_aliases (display_name, language, canonical_ingredient_id) VALUES
  ('Mleko',             'pl', v), ('Mleko krowie',         'pl', v),
  ('Mleko pełnotłuste', 'pl', v), ('Mleko odtłuszczone',   'pl', v),
  ('Mleko 2%',          'pl', v), ('Mleko w proszku',      'pl', v),
  ('Mleko UHT',         'pl', v)
  ON CONFLICT (display_name) DO NOTHING; END IF;

SELECT id INTO v FROM canonical_ingredients WHERE canonical_name = 'almond_milk';
IF v IS NOT NULL THEN INSERT INTO ingredient_aliases (display_name, language, canonical_ingredient_id) VALUES
  ('Mleko migdałowe', 'pl', v), ('Napój migdałowy', 'pl', v)
  ON CONFLICT (display_name) DO NOTHING; END IF;

SELECT id INTO v FROM canonical_ingredients WHERE canonical_name = 'oat_milk';
IF v IS NOT NULL THEN INSERT INTO ingredient_aliases (display_name, language, canonical_ingredient_id) VALUES
  ('Mleko owsiane', 'pl', v), ('Napój owsiany', 'pl', v)
  ON CONFLICT (display_name) DO NOTHING; END IF;

SELECT id INTO v FROM canonical_ingredients WHERE canonical_name = 'soy_milk';
IF v IS NOT NULL THEN INSERT INTO ingredient_aliases (display_name, language, canonical_ingredient_id) VALUES
  ('Mleko sojowe', 'pl', v), ('Napój sojowy', 'pl', v)
  ON CONFLICT (display_name) DO NOTHING; END IF;

SELECT id INTO v FROM canonical_ingredients WHERE canonical_name = 'coconut_milk';
IF v IS NOT NULL THEN INSERT INTO ingredient_aliases (display_name, language, canonical_ingredient_id) VALUES
  ('Mleko kokosowe', 'pl', v), ('Śmietanka kokosowa', 'pl', v)
  ON CONFLICT (display_name) DO NOTHING; END IF;

SELECT id INTO v FROM canonical_ingredients WHERE canonical_name = 'cheese';
IF v IS NOT NULL THEN INSERT INTO ingredient_aliases (display_name, language, canonical_ingredient_id) VALUES
  ('Ser',               'pl', v), ('Serek',              'pl', v),
  ('Ser żółty',         'pl', v), ('Ser biały',          'pl', v),
  ('Ser pleśniowy',     'pl', v), ('Ser twardy',         'pl', v),
  ('Ser miękki',        'pl', v), ('Ser topiony',        'pl', v),
  ('Ser krojony',       'pl', v), ('Ser gouda',          'pl', v),
  ('Ser ementaler',     'pl', v), ('Ser parmezan',       'pl', v),
  ('Parmezan',          'pl', v), ('Mozzarella',         'pl', v),
  ('Feta',              'pl', v), ('Ser brie',           'pl', v)
  ON CONFLICT (display_name) DO NOTHING; END IF;

SELECT id INTO v FROM canonical_ingredients WHERE canonical_name = 'butter';
IF v IS NOT NULL THEN INSERT INTO ingredient_aliases (display_name, language, canonical_ingredient_id) VALUES
  ('Masło',              'pl', v), ('Masło świeże',        'pl', v),
  ('Masło solone',       'pl', v), ('Masło niesolone',     'pl', v),
  ('Masło extra',        'pl', v), ('Masło 82%',           'pl', v),
  ('Masło roztopione',   'pl', v)
  ON CONFLICT (display_name) DO NOTHING; END IF;

SELECT id INTO v FROM canonical_ingredients WHERE canonical_name = 'cream';
IF v IS NOT NULL THEN INSERT INTO ingredient_aliases (display_name, language, canonical_ingredient_id) VALUES
  ('Śmietanka',          'pl', v), ('Śmietanka 30%',       'pl', v),
  ('Śmietanka 36%',      'pl', v), ('Śmietanka słodka',    'pl', v),
  ('Śmietanka do ubijania','pl',v), ('Bita śmietana',       'pl', v),
  ('Śmietana',           'pl', v), ('Śmietana 18%',        'pl', v)
  ON CONFLICT (display_name) DO NOTHING; END IF;

SELECT id INTO v FROM canonical_ingredients WHERE canonical_name = 'yogurt';
IF v IS NOT NULL THEN INSERT INTO ingredient_aliases (display_name, language, canonical_ingredient_id) VALUES
  ('Jogurt',           'pl', v), ('Jogurt naturalny',  'pl', v),
  ('Jogurt grecki',    'pl', v), ('Jogurt owocowy',    'pl', v)
  ON CONFLICT (display_name) DO NOTHING; END IF;

SELECT id INTO v FROM canonical_ingredients WHERE canonical_name = 'buttermilk';
IF v IS NOT NULL THEN INSERT INTO ingredient_aliases (display_name, language, canonical_ingredient_id) VALUES
  ('Maślanka', 'pl', v), ('Maślanka pitna', 'pl', v)
  ON CONFLICT (display_name) DO NOTHING; END IF;

SELECT id INTO v FROM canonical_ingredients WHERE canonical_name = 'ghee';
IF v IS NOT NULL THEN INSERT INTO ingredient_aliases (display_name, language, canonical_ingredient_id) VALUES
  ('Masło klarowane', 'pl', v), ('Ghee', 'pl', v)
  ON CONFLICT (display_name) DO NOTHING; END IF;

SELECT id INTO v FROM canonical_ingredients WHERE canonical_name = 'condensed_milk';
IF v IS NOT NULL THEN INSERT INTO ingredient_aliases (display_name, language, canonical_ingredient_id) VALUES
  ('Mleko skondensowane', 'pl', v), ('Mleko zagęszczone', 'pl', v),
  ('Mleko słodzone',      'pl', v)
  ON CONFLICT (display_name) DO NOTHING; END IF;

-- ── EGGS ─────────────────────────────────────────────────────

SELECT id INTO v FROM canonical_ingredients WHERE canonical_name = 'eggs';
IF v IS NOT NULL THEN INSERT INTO ingredient_aliases (display_name, language, canonical_ingredient_id) VALUES
  ('Jajko',            'pl', v), ('Jajka',             'pl', v),
  ('Jaja',             'pl', v), ('Jajko kurze',        'pl', v),
  ('Żółtko',           'pl', v), ('Białko jajka',      'pl', v),
  ('Jajko gotowane',   'pl', v), ('Jajko sadzone',     'pl', v),
  ('Jajko na twardo',  'pl', v), ('Jajka przepiórcze', 'pl', v)
  ON CONFLICT (display_name) DO NOTHING; END IF;

-- ── SEAFOOD (Ryby i owoce morza) ─────────────────────────────

SELECT id INTO v FROM canonical_ingredients WHERE canonical_name = 'salmon';
IF v IS NOT NULL THEN INSERT INTO ingredient_aliases (display_name, language, canonical_ingredient_id) VALUES
  ('Łosoś',             'pl', v), ('Filet z łososia',   'pl', v),
  ('Łosoś wędzony',     'pl', v), ('Łosoś pieczony',    'pl', v),
  ('Łosoś świeży',      'pl', v)
  ON CONFLICT (display_name) DO NOTHING; END IF;

SELECT id INTO v FROM canonical_ingredients WHERE canonical_name = 'tuna';
IF v IS NOT NULL THEN INSERT INTO ingredient_aliases (display_name, language, canonical_ingredient_id) VALUES
  ('Tuńczyk',           'pl', v), ('Tuńczyk w puszce',  'pl', v),
  ('Tuńczyk świeży',    'pl', v), ('Tuńczyk w oleju',   'pl', v),
  ('Tuńczyk w wodzie',  'pl', v)
  ON CONFLICT (display_name) DO NOTHING; END IF;

SELECT id INTO v FROM canonical_ingredients WHERE canonical_name = 'cod';
IF v IS NOT NULL THEN INSERT INTO ingredient_aliases (display_name, language, canonical_ingredient_id) VALUES
  ('Dorsz',             'pl', v), ('Filet z dorsza',    'pl', v),
  ('Dorsz świeży',      'pl', v), ('Dorsz pieczony',    'pl', v)
  ON CONFLICT (display_name) DO NOTHING; END IF;

SELECT id INTO v FROM canonical_ingredients WHERE canonical_name = 'shrimp';
IF v IS NOT NULL THEN INSERT INTO ingredient_aliases (display_name, language, canonical_ingredient_id) VALUES
  ('Krewetki',          'pl', v), ('Krewetka',          'pl', v),
  ('Krewetki obrane',   'pl', v), ('Krewetki tygrysie', 'pl', v)
  ON CONFLICT (display_name) DO NOTHING; END IF;

SELECT id INTO v FROM canonical_ingredients WHERE canonical_name = 'crab';
IF v IS NOT NULL THEN INSERT INTO ingredient_aliases (display_name, language, canonical_ingredient_id) VALUES
  ('Krab',              'pl', v), ('Mięso krabowe',     'pl', v),
  ('Krab królewski',    'pl', v)
  ON CONFLICT (display_name) DO NOTHING; END IF;

SELECT id INTO v FROM canonical_ingredients WHERE canonical_name = 'lobster';
IF v IS NOT NULL THEN INSERT INTO ingredient_aliases (display_name, language, canonical_ingredient_id) VALUES
  ('Homar',             'pl', v), ('Ogon homara',       'pl', v)
  ON CONFLICT (display_name) DO NOTHING; END IF;

SELECT id INTO v FROM canonical_ingredients WHERE canonical_name = 'octopus';
IF v IS NOT NULL THEN INSERT INTO ingredient_aliases (display_name, language, canonical_ingredient_id) VALUES
  ('Ośmiornica', 'pl', v)
  ON CONFLICT (display_name) DO NOTHING; END IF;

SELECT id INTO v FROM canonical_ingredients WHERE canonical_name = 'squid';
IF v IS NOT NULL THEN INSERT INTO ingredient_aliases (display_name, language, canonical_ingredient_id) VALUES
  ('Kałamarnica',       'pl', v), ('Kalmar',            'pl', v),
  ('Smażone kalmary',   'pl', v)
  ON CONFLICT (display_name) DO NOTHING; END IF;

SELECT id INTO v FROM canonical_ingredients WHERE canonical_name = 'mussels';
IF v IS NOT NULL THEN INSERT INTO ingredient_aliases (display_name, language, canonical_ingredient_id) VALUES
  ('Małże',             'pl', v), ('Omułki',            'pl', v),
  ('Mule',              'pl', v)
  ON CONFLICT (display_name) DO NOTHING; END IF;

SELECT id INTO v FROM canonical_ingredients WHERE canonical_name = 'scallops';
IF v IS NOT NULL THEN INSERT INTO ingredient_aliases (display_name, language, canonical_ingredient_id) VALUES
  ('Przegrzebki', 'pl', v)
  ON CONFLICT (display_name) DO NOTHING; END IF;

SELECT id INTO v FROM canonical_ingredients WHERE canonical_name = 'trout';
IF v IS NOT NULL THEN INSERT INTO ingredient_aliases (display_name, language, canonical_ingredient_id) VALUES
  ('Pstrąg',            'pl', v), ('Pstrąg tęczowy',    'pl', v),
  ('Pstrąg wędzony',    'pl', v), ('Filet z pstrąga',   'pl', v)
  ON CONFLICT (display_name) DO NOTHING; END IF;

SELECT id INTO v FROM canonical_ingredients WHERE canonical_name = 'sardines';
IF v IS NOT NULL THEN INSERT INTO ingredient_aliases (display_name, language, canonical_ingredient_id) VALUES
  ('Sardynki',          'pl', v), ('Sardynki w oleju',  'pl', v),
  ('Sardynki w pomidorach', 'pl', v)
  ON CONFLICT (display_name) DO NOTHING; END IF;

SELECT id INTO v FROM canonical_ingredients WHERE canonical_name = 'anchovies';
IF v IS NOT NULL THEN INSERT INTO ingredient_aliases (display_name, language, canonical_ingredient_id) VALUES
  ('Anchois',           'pl', v), ('Sardele',           'pl', v)
  ON CONFLICT (display_name) DO NOTHING; END IF;

SELECT id INTO v FROM canonical_ingredients WHERE canonical_name = 'mackerel';
IF v IS NOT NULL THEN INSERT INTO ingredient_aliases (display_name, language, canonical_ingredient_id) VALUES
  ('Makrela',           'pl', v), ('Makrela wędzona',   'pl', v),
  ('Makrela w oleju',   'pl', v)
  ON CONFLICT (display_name) DO NOTHING; END IF;

SELECT id INTO v FROM canonical_ingredients WHERE canonical_name = 'halibut';
IF v IS NOT NULL THEN INSERT INTO ingredient_aliases (display_name, language, canonical_ingredient_id) VALUES
  ('Halibut', 'pl', v), ('Filet z halibuta', 'pl', v)
  ON CONFLICT (display_name) DO NOTHING; END IF;

-- ── MEAT (Mięso) ─────────────────────────────────────────────

SELECT id INTO v FROM canonical_ingredients WHERE canonical_name = 'beef';
IF v IS NOT NULL THEN INSERT INTO ingredient_aliases (display_name, language, canonical_ingredient_id) VALUES
  ('Wołowina',          'pl', v), ('Mięso wołowe',      'pl', v),
  ('Antrykot',          'pl', v), ('Rostbef',           'pl', v),
  ('Polędwica wołowa',  'pl', v), ('Stek wołowy',       'pl', v),
  ('Gulasz wołowy',     'pl', v), ('Mięso mielone wołowe','pl',v),
  ('Wołowina duszona',  'pl', v), ('Pieczeń wołowa',    'pl', v)
  ON CONFLICT (display_name) DO NOTHING; END IF;

SELECT id INTO v FROM canonical_ingredients WHERE canonical_name = 'pork';
IF v IS NOT NULL THEN INSERT INTO ingredient_aliases (display_name, language, canonical_ingredient_id) VALUES
  ('Wieprzowina',       'pl', v), ('Mięso wieprzowe',   'pl', v),
  ('Boczek',            'pl', v), ('Żeberka wieprzowe', 'pl', v),
  ('Pieczeń wieprzowa', 'pl', v), ('Mięso mielone wieprzowe','pl',v),
  ('Polędwiczka wieprzowa','pl',v), ('Kotlet wieprzowy', 'pl', v)
  ON CONFLICT (display_name) DO NOTHING; END IF;

SELECT id INTO v FROM canonical_ingredients WHERE canonical_name = 'lamb';
IF v IS NOT NULL THEN INSERT INTO ingredient_aliases (display_name, language, canonical_ingredient_id) VALUES
  ('Jagnięcina',        'pl', v), ('Baranina',          'pl', v),
  ('Udziec jagnięcy',   'pl', v), ('Kotlet jagnięcy',   'pl', v)
  ON CONFLICT (display_name) DO NOTHING; END IF;

SELECT id INTO v FROM canonical_ingredients WHERE canonical_name = 'chicken';
IF v IS NOT NULL THEN INSERT INTO ingredient_aliases (display_name, language, canonical_ingredient_id) VALUES
  ('Kurczak',           'pl', v), ('Pierś z kurczaka',  'pl', v),
  ('Udko kurczaka',     'pl', v), ('Nóżka kurczaka',    'pl', v),
  ('Skrzydełka',        'pl', v), ('Kurczak pieczony',  'pl', v),
  ('Kurczak z rożna',   'pl', v), ('Filet z kurczaka',  'pl', v),
  ('Kurczak mielony',   'pl', v), ('Kotlet z kurczaka', 'pl', v),
  ('Kurczak duszony',   'pl', v)
  ON CONFLICT (display_name) DO NOTHING; END IF;

SELECT id INTO v FROM canonical_ingredients WHERE canonical_name = 'duck';
IF v IS NOT NULL THEN INSERT INTO ingredient_aliases (display_name, language, canonical_ingredient_id) VALUES
  ('Kaczka',            'pl', v), ('Pierś kaczki',      'pl', v),
  ('Kaczka pieczona',   'pl', v), ('Pieczona kaczka',   'pl', v),
  ('Udko kaczki',       'pl', v)
  ON CONFLICT (display_name) DO NOTHING; END IF;

SELECT id INTO v FROM canonical_ingredients WHERE canonical_name = 'turkey';
IF v IS NOT NULL THEN INSERT INTO ingredient_aliases (display_name, language, canonical_ingredient_id) VALUES
  ('Indyk',             'pl', v), ('Pierś z indyka',    'pl', v),
  ('Indyk pieczony',    'pl', v)
  ON CONFLICT (display_name) DO NOTHING; END IF;

SELECT id INTO v FROM canonical_ingredients WHERE canonical_name = 'bacon';
IF v IS NOT NULL THEN INSERT INTO ingredient_aliases (display_name, language, canonical_ingredient_id) VALUES
  ('Boczek wędzony',    'pl', v), ('Plastry boczku',    'pl', v),
  ('Boczek chrupiący',  'pl', v), ('Boczek parzony',    'pl', v)
  ON CONFLICT (display_name) DO NOTHING; END IF;

SELECT id INTO v FROM canonical_ingredients WHERE canonical_name = 'ham';
IF v IS NOT NULL THEN INSERT INTO ingredient_aliases (display_name, language, canonical_ingredient_id) VALUES
  ('Szynka',            'pl', v), ('Szynka gotowana',   'pl', v),
  ('Szynka wędzona',    'pl', v), ('Szynka konserwowa', 'pl', v),
  ('Szynka parmeńska',  'pl', v)
  ON CONFLICT (display_name) DO NOTHING; END IF;

SELECT id INTO v FROM canonical_ingredients WHERE canonical_name = 'sausage';
IF v IS NOT NULL THEN INSERT INTO ingredient_aliases (display_name, language, canonical_ingredient_id) VALUES
  ('Kiełbasa',          'pl', v), ('Parówka',           'pl', v),
  ('Parówki',           'pl', v), ('Frankfurter',       'pl', v),
  ('Kiełbasa wędzona',  'pl', v), ('Salami',            'pl', v),
  ('Mortadela',         'pl', v)
  ON CONFLICT (display_name) DO NOTHING; END IF;

SELECT id INTO v FROM canonical_ingredients WHERE canonical_name = 'pork_ribs';
IF v IS NOT NULL THEN INSERT INTO ingredient_aliases (display_name, language, canonical_ingredient_id) VALUES
  ('Żeberka',           'pl', v), ('Żeberka wieprzowe BBQ','pl',v),
  ('Żebra wieprzowe',   'pl', v)
  ON CONFLICT (display_name) DO NOTHING; END IF;

-- ── VEGETABLES (Warzywa) ─────────────────────────────────────

SELECT id INTO v FROM canonical_ingredients WHERE canonical_name = 'tomato';
IF v IS NOT NULL THEN INSERT INTO ingredient_aliases (display_name, language, canonical_ingredient_id) VALUES
  ('Pomidor',           'pl', v), ('Pomidory',          'pl', v),
  ('Pomidor cherry',    'pl', v), ('Pomidory suszone',  'pl', v),
  ('Pomidor bawole serce','pl',v), ('Passata',          'pl', v)
  ON CONFLICT (display_name) DO NOTHING; END IF;

SELECT id INTO v FROM canonical_ingredients WHERE canonical_name = 'onion';
IF v IS NOT NULL THEN INSERT INTO ingredient_aliases (display_name, language, canonical_ingredient_id) VALUES
  ('Cebula',            'pl', v), ('Cebula biała',      'pl', v),
  ('Cebula czerwona',   'pl', v), ('Cebula żółta',      'pl', v),
  ('Cebula smażona',    'pl', v), ('Cebulka',           'pl', v)
  ON CONFLICT (display_name) DO NOTHING; END IF;

SELECT id INTO v FROM canonical_ingredients WHERE canonical_name = 'garlic';
IF v IS NOT NULL THEN INSERT INTO ingredient_aliases (display_name, language, canonical_ingredient_id) VALUES
  ('Czosnek',           'pl', v), ('Ząbek czosnku',     'pl', v),
  ('Czosnek świeży',    'pl', v), ('Czosnek granulowany','pl', v),
  ('Czosnek niedźwiedzi','pl', v), ('Główka czosnku',   'pl', v)
  ON CONFLICT (display_name) DO NOTHING; END IF;

SELECT id INTO v FROM canonical_ingredients WHERE canonical_name = 'potato';
IF v IS NOT NULL THEN INSERT INTO ingredient_aliases (display_name, language, canonical_ingredient_id) VALUES
  ('Ziemniak',          'pl', v), ('Ziemniaki',         'pl', v),
  ('Kartofel',          'pl', v), ('Kartofle',          'pl', v),
  ('Ziemniaki gotowane','pl', v), ('Ziemniaki pieczone','pl', v),
  ('Puree ziemniaczane','pl', v), ('Frytki',            'pl', v),
  ('Ziemniaki smażone', 'pl', v), ('Placki',            'pl', v)
  ON CONFLICT (display_name) DO NOTHING; END IF;

SELECT id INTO v FROM canonical_ingredients WHERE canonical_name = 'sweet_potato';
IF v IS NOT NULL THEN INSERT INTO ingredient_aliases (display_name, language, canonical_ingredient_id) VALUES
  ('Słodki ziemniak',   'pl', v), ('Batat',             'pl', v),
  ('Bataty',            'pl', v)
  ON CONFLICT (display_name) DO NOTHING; END IF;

SELECT id INTO v FROM canonical_ingredients WHERE canonical_name = 'carrot';
IF v IS NOT NULL THEN INSERT INTO ingredient_aliases (display_name, language, canonical_ingredient_id) VALUES
  ('Marchew',           'pl', v), ('Marchewka',         'pl', v),
  ('Marchew gotowana',  'pl', v), ('Marchew tarta',     'pl', v),
  ('Marchewka baby',    'pl', v)
  ON CONFLICT (display_name) DO NOTHING; END IF;

SELECT id INTO v FROM canonical_ingredients WHERE canonical_name = 'cabbage';
IF v IS NOT NULL THEN INSERT INTO ingredient_aliases (display_name, language, canonical_ingredient_id) VALUES
  ('Kapusta',           'pl', v), ('Kapusta biała',     'pl', v),
  ('Kapusta czerwona',  'pl', v), ('Kapusta włoska',    'pl', v),
  ('Kapusta pekińska',  'pl', v)
  ON CONFLICT (display_name) DO NOTHING; END IF;

SELECT id INTO v FROM canonical_ingredients WHERE canonical_name = 'spinach';
IF v IS NOT NULL THEN INSERT INTO ingredient_aliases (display_name, language, canonical_ingredient_id) VALUES
  ('Szpinak',           'pl', v), ('Szpinak świeży',    'pl', v),
  ('Szpinak mrożony',   'pl', v), ('Szpinak baby',      'pl', v)
  ON CONFLICT (display_name) DO NOTHING; END IF;

SELECT id INTO v FROM canonical_ingredients WHERE canonical_name = 'broccoli';
IF v IS NOT NULL THEN INSERT INTO ingredient_aliases (display_name, language, canonical_ingredient_id) VALUES
  ('Brokuły',           'pl', v), ('Brokuł',            'pl', v),
  ('Różyczki brokułów', 'pl', v)
  ON CONFLICT (display_name) DO NOTHING; END IF;

SELECT id INTO v FROM canonical_ingredients WHERE canonical_name = 'mushroom';
IF v IS NOT NULL THEN INSERT INTO ingredient_aliases (display_name, language, canonical_ingredient_id) VALUES
  ('Pieczarka',         'pl', v), ('Pieczarki',         'pl', v),
  ('Grzyby',            'pl', v), ('Grzyb',             'pl', v),
  ('Boczniaki',         'pl', v), ('Shitake',           'pl', v)
  ON CONFLICT (display_name) DO NOTHING; END IF;

SELECT id INTO v FROM canonical_ingredients WHERE canonical_name = 'cucumber';
IF v IS NOT NULL THEN INSERT INTO ingredient_aliases (display_name, language, canonical_ingredient_id) VALUES
  ('Ogórek',            'pl', v), ('Ogórki',            'pl', v),
  ('Ogórek świeży',     'pl', v), ('Ogórek sałatkowy',  'pl', v)
  ON CONFLICT (display_name) DO NOTHING; END IF;

SELECT id INTO v FROM canonical_ingredients WHERE canonical_name = 'bell_pepper';
IF v IS NOT NULL THEN INSERT INTO ingredient_aliases (display_name, language, canonical_ingredient_id) VALUES
  ('Papryka',           'pl', v), ('Papryka czerwona',  'pl', v),
  ('Papryka zielona',   'pl', v), ('Papryka żółta',     'pl', v),
  ('Papryka słodka',    'pl', v), ('Papryka konserwowa','pl', v)
  ON CONFLICT (display_name) DO NOTHING; END IF;

SELECT id INTO v FROM canonical_ingredients WHERE canonical_name = 'corn';
IF v IS NOT NULL THEN INSERT INTO ingredient_aliases (display_name, language, canonical_ingredient_id) VALUES
  ('Kukurydza',         'pl', v), ('Kukurydza słodka',  'pl', v),
  ('Kukurydza z puszki','pl', v), ('Kolba kukurydzy',   'pl', v)
  ON CONFLICT (display_name) DO NOTHING; END IF;

SELECT id INTO v FROM canonical_ingredients WHERE canonical_name = 'beets';
IF v IS NOT NULL THEN INSERT INTO ingredient_aliases (display_name, language, canonical_ingredient_id) VALUES
  ('Burak',             'pl', v), ('Buraki',            'pl', v),
  ('Burak ćwikłowy',    'pl', v), ('Buraki gotowane',   'pl', v),
  ('Buraki kiszone',    'pl', v)
  ON CONFLICT (display_name) DO NOTHING; END IF;

SELECT id INTO v FROM canonical_ingredients WHERE canonical_name = 'lettuce';
IF v IS NOT NULL THEN INSERT INTO ingredient_aliases (display_name, language, canonical_ingredient_id) VALUES
  ('Sałata',            'pl', v), ('Sałata lodowa',     'pl', v),
  ('Sałata masłowa',    'pl', v), ('Sałata zielona',    'pl', v),
  ('Mix sałat',         'pl', v)
  ON CONFLICT (display_name) DO NOTHING; END IF;

SELECT id INTO v FROM canonical_ingredients WHERE canonical_name = 'celery';
IF v IS NOT NULL THEN INSERT INTO ingredient_aliases (display_name, language, canonical_ingredient_id) VALUES
  ('Seler naciowy',     'pl', v), ('Łodyga selera',     'pl', v)
  ON CONFLICT (display_name) DO NOTHING; END IF;

SELECT id INTO v FROM canonical_ingredients WHERE canonical_name = 'leek';
IF v IS NOT NULL THEN INSERT INTO ingredient_aliases (display_name, language, canonical_ingredient_id) VALUES
  ('Por',               'pl', v), ('Pory',              'pl', v),
  ('Por świeży',        'pl', v)
  ON CONFLICT (display_name) DO NOTHING; END IF;

SELECT id INTO v FROM canonical_ingredients WHERE canonical_name = 'parsnip';
IF v IS NOT NULL THEN INSERT INTO ingredient_aliases (display_name, language, canonical_ingredient_id) VALUES
  ('Pasternak',         'pl', v), ('Korzeń pasternaku', 'pl', v)
  ON CONFLICT (display_name) DO NOTHING; END IF;

SELECT id INTO v FROM canonical_ingredients WHERE canonical_name = 'fennel';
IF v IS NOT NULL THEN INSERT INTO ingredient_aliases (display_name, language, canonical_ingredient_id) VALUES
  ('Koper włoski',      'pl', v), ('Fenkuł',            'pl', v)
  ON CONFLICT (display_name) DO NOTHING; END IF;

SELECT id INTO v FROM canonical_ingredients WHERE canonical_name = 'eggplant';
IF v IS NOT NULL THEN INSERT INTO ingredient_aliases (display_name, language, canonical_ingredient_id) VALUES
  ('Bakłażan',          'pl', v), ('Oberżyna',          'pl', v)
  ON CONFLICT (display_name) DO NOTHING; END IF;

SELECT id INTO v FROM canonical_ingredients WHERE canonical_name = 'zucchini';
IF v IS NOT NULL THEN INSERT INTO ingredient_aliases (display_name, language, canonical_ingredient_id) VALUES
  ('Cukinia',           'pl', v), ('Kabaczek',          'pl', v)
  ON CONFLICT (display_name) DO NOTHING; END IF;

SELECT id INTO v FROM canonical_ingredients WHERE canonical_name = 'pumpkin';
IF v IS NOT NULL THEN INSERT INTO ingredient_aliases (display_name, language, canonical_ingredient_id) VALUES
  ('Dynia',             'pl', v), ('Dynia piżmowa',     'pl', v),
  ('Miąższ dyni',       'pl', v)
  ON CONFLICT (display_name) DO NOTHING; END IF;

SELECT id INTO v FROM canonical_ingredients WHERE canonical_name = 'radish';
IF v IS NOT NULL THEN INSERT INTO ingredient_aliases (display_name, language, canonical_ingredient_id) VALUES
  ('Rzodkiewka',        'pl', v), ('Rzodkiew',          'pl', v)
  ON CONFLICT (display_name) DO NOTHING; END IF;

SELECT id INTO v FROM canonical_ingredients WHERE canonical_name = 'green_onion';
IF v IS NOT NULL THEN INSERT INTO ingredient_aliases (display_name, language, canonical_ingredient_id) VALUES
  ('Szczypiorek',       'pl', v), ('Cebulka dymka',     'pl', v),
  ('Cebulka zielona',   'pl', v)
  ON CONFLICT (display_name) DO NOTHING; END IF;

SELECT id INTO v FROM canonical_ingredients WHERE canonical_name = 'asparagus';
IF v IS NOT NULL THEN INSERT INTO ingredient_aliases (display_name, language, canonical_ingredient_id) VALUES
  ('Szparagi',          'pl', v), ('Szparag',           'pl', v),
  ('Szparagi zielone',  'pl', v), ('Szparagi białe',    'pl', v)
  ON CONFLICT (display_name) DO NOTHING; END IF;

SELECT id INTO v FROM canonical_ingredients WHERE canonical_name = 'artichoke';
IF v IS NOT NULL THEN INSERT INTO ingredient_aliases (display_name, language, canonical_ingredient_id) VALUES
  ('Karczoch',          'pl', v), ('Karczochy',         'pl', v),
  ('Serca karczochów',  'pl', v)
  ON CONFLICT (display_name) DO NOTHING; END IF;

SELECT id INTO v FROM canonical_ingredients WHERE canonical_name = 'avocado';
IF v IS NOT NULL THEN INSERT INTO ingredient_aliases (display_name, language, canonical_ingredient_id) VALUES
  ('Awokado',           'pl', v), ('Avocado',           'pl', v)
  ON CONFLICT (display_name) DO NOTHING; END IF;

SELECT id INTO v FROM canonical_ingredients WHERE canonical_name = 'kale';
IF v IS NOT NULL THEN INSERT INTO ingredient_aliases (display_name, language, canonical_ingredient_id) VALUES
  ('Jarmuż', 'pl', v)
  ON CONFLICT (display_name) DO NOTHING; END IF;

SELECT id INTO v FROM canonical_ingredients WHERE canonical_name = 'turnip';
IF v IS NOT NULL THEN INSERT INTO ingredient_aliases (display_name, language, canonical_ingredient_id) VALUES
  ('Rzepa',             'pl', v), ('Rzepa biała',       'pl', v)
  ON CONFLICT (display_name) DO NOTHING; END IF;

SELECT id INTO v FROM canonical_ingredients WHERE canonical_name = 'brussels_sprouts';
IF v IS NOT NULL THEN INSERT INTO ingredient_aliases (display_name, language, canonical_ingredient_id) VALUES
  ('Brukselka',         'pl', v), ('Brukselki',         'pl', v)
  ON CONFLICT (display_name) DO NOTHING; END IF;

SELECT id INTO v FROM canonical_ingredients WHERE canonical_name = 'arugula';
IF v IS NOT NULL THEN INSERT INTO ingredient_aliases (display_name, language, canonical_ingredient_id) VALUES
  ('Rukola',            'pl', v)
  ON CONFLICT (display_name) DO NOTHING; END IF;

-- ── HERBS & SPICES (Zioła i przyprawy) ───────────────────────

SELECT id INTO v FROM canonical_ingredients WHERE canonical_name = 'dill';
IF v IS NOT NULL THEN INSERT INTO ingredient_aliases (display_name, language, canonical_ingredient_id) VALUES
  ('Koper',             'pl', v), ('Koper świeży',      'pl', v),
  ('Koperek',           'pl', v), ('Koper ogrodowy',    'pl', v)
  ON CONFLICT (display_name) DO NOTHING; END IF;

SELECT id INTO v FROM canonical_ingredients WHERE canonical_name = 'parsley';
IF v IS NOT NULL THEN INSERT INTO ingredient_aliases (display_name, language, canonical_ingredient_id) VALUES
  ('Pietruszka',        'pl', v), ('Natka pietruszki',  'pl', v),
  ('Pietruszka świeża', 'pl', v), ('Pietruszka suszona','pl', v)
  ON CONFLICT (display_name) DO NOTHING; END IF;

SELECT id INTO v FROM canonical_ingredients WHERE canonical_name = 'marjoram';
IF v IS NOT NULL THEN INSERT INTO ingredient_aliases (display_name, language, canonical_ingredient_id) VALUES
  ('Majeranek',         'pl', v), ('Majeranek suszony', 'pl', v),
  ('Majeranek świeży',  'pl', v)
  ON CONFLICT (display_name) DO NOTHING; END IF;

SELECT id INTO v FROM canonical_ingredients WHERE canonical_name = 'caraway';
IF v IS NOT NULL THEN INSERT INTO ingredient_aliases (display_name, language, canonical_ingredient_id) VALUES
  ('Kminek',            'pl', v), ('Kminek zwyczajny',  'pl', v),
  ('Kmin',              'pl', v)
  ON CONFLICT (display_name) DO NOTHING; END IF;

SELECT id INTO v FROM canonical_ingredients WHERE canonical_name = 'bay_leaf';
IF v IS NOT NULL THEN INSERT INTO ingredient_aliases (display_name, language, canonical_ingredient_id) VALUES
  ('Liść laurowy',      'pl', v), ('Liście laurowe',    'pl', v)
  ON CONFLICT (display_name) DO NOTHING; END IF;

SELECT id INTO v FROM canonical_ingredients WHERE canonical_name = 'thyme';
IF v IS NOT NULL THEN INSERT INTO ingredient_aliases (display_name, language, canonical_ingredient_id) VALUES
  ('Tymianek',          'pl', v), ('Tymianek świeży',   'pl', v),
  ('Tymianek suszony',  'pl', v)
  ON CONFLICT (display_name) DO NOTHING; END IF;

SELECT id INTO v FROM canonical_ingredients WHERE canonical_name = 'rosemary';
IF v IS NOT NULL THEN INSERT INTO ingredient_aliases (display_name, language, canonical_ingredient_id) VALUES
  ('Rozmaryn',          'pl', v), ('Rozmaryn świeży',   'pl', v),
  ('Rozmaryn suszony',  'pl', v)
  ON CONFLICT (display_name) DO NOTHING; END IF;

SELECT id INTO v FROM canonical_ingredients WHERE canonical_name = 'oregano';
IF v IS NOT NULL THEN INSERT INTO ingredient_aliases (display_name, language, canonical_ingredient_id) VALUES
  ('Oregano',           'pl', v), ('Oregano suszone',   'pl', v)
  ON CONFLICT (display_name) DO NOTHING; END IF;

SELECT id INTO v FROM canonical_ingredients WHERE canonical_name = 'basil';
IF v IS NOT NULL THEN INSERT INTO ingredient_aliases (display_name, language, canonical_ingredient_id) VALUES
  ('Bazylia',           'pl', v), ('Bazylia świeża',    'pl', v),
  ('Bazylia suszona',   'pl', v)
  ON CONFLICT (display_name) DO NOTHING; END IF;

SELECT id INTO v FROM canonical_ingredients WHERE canonical_name = 'cilantro';
IF v IS NOT NULL THEN INSERT INTO ingredient_aliases (display_name, language, canonical_ingredient_id) VALUES
  ('Kolendra',          'pl', v), ('Kolendra świeża',   'pl', v)
  ON CONFLICT (display_name) DO NOTHING; END IF;

SELECT id INTO v FROM canonical_ingredients WHERE canonical_name = 'mint';
IF v IS NOT NULL THEN INSERT INTO ingredient_aliases (display_name, language, canonical_ingredient_id) VALUES
  ('Mięta',             'pl', v), ('Mięta pieprzowa',   'pl', v),
  ('Mięta świeża',      'pl', v)
  ON CONFLICT (display_name) DO NOTHING; END IF;

SELECT id INTO v FROM canonical_ingredients WHERE canonical_name = 'chives';
IF v IS NOT NULL THEN INSERT INTO ingredient_aliases (display_name, language, canonical_ingredient_id) VALUES
  ('Szczypiorek',       'pl', v), ('Szczypiorek świeży','pl', v)
  ON CONFLICT (display_name) DO NOTHING; END IF;

SELECT id INTO v FROM canonical_ingredients WHERE canonical_name = 'sage';
IF v IS NOT NULL THEN INSERT INTO ingredient_aliases (display_name, language, canonical_ingredient_id) VALUES
  ('Szałwia',           'pl', v), ('Szałwia świeża',    'pl', v)
  ON CONFLICT (display_name) DO NOTHING; END IF;

SELECT id INTO v FROM canonical_ingredients WHERE canonical_name = 'tarragon';
IF v IS NOT NULL THEN INSERT INTO ingredient_aliases (display_name, language, canonical_ingredient_id) VALUES
  ('Estragon',          'pl', v), ('Estragon świeży',   'pl', v)
  ON CONFLICT (display_name) DO NOTHING; END IF;

SELECT id INTO v FROM canonical_ingredients WHERE canonical_name = 'salt';
IF v IS NOT NULL THEN INSERT INTO ingredient_aliases (display_name, language, canonical_ingredient_id) VALUES
  ('Sól',               'pl', v), ('Sól morska',        'pl', v),
  ('Sól kamienna',      'pl', v), ('Sól himalajska',    'pl', v)
  ON CONFLICT (display_name) DO NOTHING; END IF;

SELECT id INTO v FROM canonical_ingredients WHERE canonical_name = 'black_pepper';
IF v IS NOT NULL THEN INSERT INTO ingredient_aliases (display_name, language, canonical_ingredient_id) VALUES
  ('Pieprz',            'pl', v), ('Pieprz czarny',     'pl', v),
  ('Pieprz mielony',    'pl', v), ('Ziarna pieprzu',    'pl', v),
  ('Pieprz kolorowy',   'pl', v)
  ON CONFLICT (display_name) DO NOTHING; END IF;

SELECT id INTO v FROM canonical_ingredients WHERE canonical_name = 'white_pepper';
IF v IS NOT NULL THEN INSERT INTO ingredient_aliases (display_name, language, canonical_ingredient_id) VALUES
  ('Pieprz biały',      'pl', v), ('Pieprz biały mielony','pl', v)
  ON CONFLICT (display_name) DO NOTHING; END IF;

SELECT id INTO v FROM canonical_ingredients WHERE canonical_name = 'paprika';
IF v IS NOT NULL THEN INSERT INTO ingredient_aliases (display_name, language, canonical_ingredient_id) VALUES
  ('Papryka w proszku', 'pl', v), ('Papryka słodka mielona','pl',v),
  ('Papryka ostra',     'pl', v), ('Papryka wędzona',   'pl', v)
  ON CONFLICT (display_name) DO NOTHING; END IF;

SELECT id INTO v FROM canonical_ingredients WHERE canonical_name = 'cumin';
IF v IS NOT NULL THEN INSERT INTO ingredient_aliases (display_name, language, canonical_ingredient_id) VALUES
  ('Kumin',             'pl', v), ('Kmin rzymski',      'pl', v),
  ('Kminek rzymski',    'pl', v)
  ON CONFLICT (display_name) DO NOTHING; END IF;

SELECT id INTO v FROM canonical_ingredients WHERE canonical_name = 'cinnamon';
IF v IS NOT NULL THEN INSERT INTO ingredient_aliases (display_name, language, canonical_ingredient_id) VALUES
  ('Cynamon',           'pl', v), ('Laska cynamonu',    'pl', v),
  ('Cynamon mielony',   'pl', v)
  ON CONFLICT (display_name) DO NOTHING; END IF;

SELECT id INTO v FROM canonical_ingredients WHERE canonical_name = 'nutmeg';
IF v IS NOT NULL THEN INSERT INTO ingredient_aliases (display_name, language, canonical_ingredient_id) VALUES
  ('Gałka muszkatołowa','pl', v), ('Gałka muszkatołowa mielona','pl', v)
  ON CONFLICT (display_name) DO NOTHING; END IF;

SELECT id INTO v FROM canonical_ingredients WHERE canonical_name = 'ginger';
IF v IS NOT NULL THEN INSERT INTO ingredient_aliases (display_name, language, canonical_ingredient_id) VALUES
  ('Imbir',             'pl', v), ('Imbir świeży',      'pl', v),
  ('Imbir mielony',     'pl', v), ('Korzeń imbiru',     'pl', v)
  ON CONFLICT (display_name) DO NOTHING; END IF;

SELECT id INTO v FROM canonical_ingredients WHERE canonical_name = 'cloves';
IF v IS NOT NULL THEN INSERT INTO ingredient_aliases (display_name, language, canonical_ingredient_id) VALUES
  ('Goździki',          'pl', v), ('Goździk',           'pl', v)
  ON CONFLICT (display_name) DO NOTHING; END IF;

SELECT id INTO v FROM canonical_ingredients WHERE canonical_name = 'cardamom';
IF v IS NOT NULL THEN INSERT INTO ingredient_aliases (display_name, language, canonical_ingredient_id) VALUES
  ('Kardamon',          'pl', v)
  ON CONFLICT (display_name) DO NOTHING; END IF;

SELECT id INTO v FROM canonical_ingredients WHERE canonical_name = 'star_anise';
IF v IS NOT NULL THEN INSERT INTO ingredient_aliases (display_name, language, canonical_ingredient_id) VALUES
  ('Anyż gwiazdkowy',   'pl', v), ('Badian',            'pl', v)
  ON CONFLICT (display_name) DO NOTHING; END IF;

SELECT id INTO v FROM canonical_ingredients WHERE canonical_name = 'anise';
IF v IS NOT NULL THEN INSERT INTO ingredient_aliases (display_name, language, canonical_ingredient_id) VALUES
  ('Anyż',              'pl', v), ('Anyżek',            'pl', v)
  ON CONFLICT (display_name) DO NOTHING; END IF;

SELECT id INTO v FROM canonical_ingredients WHERE canonical_name = 'turmeric';
IF v IS NOT NULL THEN INSERT INTO ingredient_aliases (display_name, language, canonical_ingredient_id) VALUES
  ('Kurkuma',           'pl', v)
  ON CONFLICT (display_name) DO NOTHING; END IF;

SELECT id INTO v FROM canonical_ingredients WHERE canonical_name = 'saffron';
IF v IS NOT NULL THEN INSERT INTO ingredient_aliases (display_name, language, canonical_ingredient_id) VALUES
  ('Szafran',           'pl', v)
  ON CONFLICT (display_name) DO NOTHING; END IF;

SELECT id INTO v FROM canonical_ingredients WHERE canonical_name = 'vanilla';
IF v IS NOT NULL THEN INSERT INTO ingredient_aliases (display_name, language, canonical_ingredient_id) VALUES
  ('Wanilia',           'pl', v), ('Laska wanilii',     'pl', v),
  ('Ekstrakt waniliowy','pl', v), ('Cukier waniliowy',  'pl', v)
  ON CONFLICT (display_name) DO NOTHING; END IF;

SELECT id INTO v FROM canonical_ingredients WHERE canonical_name = 'garlic_powder';
IF v IS NOT NULL THEN INSERT INTO ingredient_aliases (display_name, language, canonical_ingredient_id) VALUES
  ('Czosnek w proszku', 'pl', v), ('Czosnek granulowany', 'pl', v)
  ON CONFLICT (display_name) DO NOTHING; END IF;

SELECT id INTO v FROM canonical_ingredients WHERE canonical_name = 'horseradish';
IF v IS NOT NULL THEN INSERT INTO ingredient_aliases (display_name, language, canonical_ingredient_id) VALUES
  ('Chrzan',            'pl', v), ('Chrzan tarty',      'pl', v),
  ('Chrzan świeży',     'pl', v), ('Korzeń chrzanu',    'pl', v)
  ON CONFLICT (display_name) DO NOTHING; END IF;

-- ── FRUITS (Owoce) ───────────────────────────────────────────

SELECT id INTO v FROM canonical_ingredients WHERE canonical_name = 'apple';
IF v IS NOT NULL THEN INSERT INTO ingredient_aliases (display_name, language, canonical_ingredient_id) VALUES
  ('Jabłko',            'pl', v), ('Jabłka',            'pl', v),
  ('Jabłko słodkie',    'pl', v), ('Jabłko kwaśne',     'pl', v),
  ('Mus jabłkowy',      'pl', v)
  ON CONFLICT (display_name) DO NOTHING; END IF;

SELECT id INTO v FROM canonical_ingredients WHERE canonical_name = 'pear';
IF v IS NOT NULL THEN INSERT INTO ingredient_aliases (display_name, language, canonical_ingredient_id) VALUES
  ('Gruszka',           'pl', v), ('Gruszki',           'pl', v)
  ON CONFLICT (display_name) DO NOTHING; END IF;

SELECT id INTO v FROM canonical_ingredients WHERE canonical_name = 'plum';
IF v IS NOT NULL THEN INSERT INTO ingredient_aliases (display_name, language, canonical_ingredient_id) VALUES
  ('Śliwka',            'pl', v), ('Śliwki',            'pl', v),
  ('Śliwka węgierka',   'pl', v), ('Śliwka suszona',    'pl', v)
  ON CONFLICT (display_name) DO NOTHING; END IF;

SELECT id INTO v FROM canonical_ingredients WHERE canonical_name = 'strawberry';
IF v IS NOT NULL THEN INSERT INTO ingredient_aliases (display_name, language, canonical_ingredient_id) VALUES
  ('Truskawka',         'pl', v), ('Truskawki',         'pl', v),
  ('Truskawki świeże',  'pl', v), ('Truskawki mrożone', 'pl', v)
  ON CONFLICT (display_name) DO NOTHING; END IF;

SELECT id INTO v FROM canonical_ingredients WHERE canonical_name = 'raspberry';
IF v IS NOT NULL THEN INSERT INTO ingredient_aliases (display_name, language, canonical_ingredient_id) VALUES
  ('Malina',            'pl', v), ('Maliny',            'pl', v),
  ('Maliny świeże',     'pl', v), ('Maliny mrożone',    'pl', v)
  ON CONFLICT (display_name) DO NOTHING; END IF;

SELECT id INTO v FROM canonical_ingredients WHERE canonical_name = 'blueberry';
IF v IS NOT NULL THEN INSERT INTO ingredient_aliases (display_name, language, canonical_ingredient_id) VALUES
  ('Borówka',           'pl', v), ('Jagoda',            'pl', v),
  ('Borówki',           'pl', v), ('Czarna jagoda',     'pl', v),
  ('Borówka amerykańska','pl', v)
  ON CONFLICT (display_name) DO NOTHING; END IF;

SELECT id INTO v FROM canonical_ingredients WHERE canonical_name = 'blackberry';
IF v IS NOT NULL THEN INSERT INTO ingredient_aliases (display_name, language, canonical_ingredient_id) VALUES
  ('Jeżyna',            'pl', v), ('Jeżyny',            'pl', v)
  ON CONFLICT (display_name) DO NOTHING; END IF;

SELECT id INTO v FROM canonical_ingredients WHERE canonical_name = 'cranberries';
IF v IS NOT NULL THEN INSERT INTO ingredient_aliases (display_name, language, canonical_ingredient_id) VALUES
  ('Żurawina',          'pl', v), ('Żurawina suszona',  'pl', v),
  ('Żurawina mrożona',  'pl', v)
  ON CONFLICT (display_name) DO NOTHING; END IF;

SELECT id INTO v FROM canonical_ingredients WHERE canonical_name = 'lemon';
IF v IS NOT NULL THEN INSERT INTO ingredient_aliases (display_name, language, canonical_ingredient_id) VALUES
  ('Cytryna',           'pl', v), ('Sok z cytryny',     'pl', v),
  ('Skórka cytryny',    'pl', v)
  ON CONFLICT (display_name) DO NOTHING; END IF;

SELECT id INTO v FROM canonical_ingredients WHERE canonical_name = 'lime';
IF v IS NOT NULL THEN INSERT INTO ingredient_aliases (display_name, language, canonical_ingredient_id) VALUES
  ('Limonka',           'pl', v), ('Sok z limonki',     'pl', v)
  ON CONFLICT (display_name) DO NOTHING; END IF;

SELECT id INTO v FROM canonical_ingredients WHERE canonical_name = 'orange';
IF v IS NOT NULL THEN INSERT INTO ingredient_aliases (display_name, language, canonical_ingredient_id) VALUES
  ('Pomarańcza',        'pl', v), ('Pomarańcze',        'pl', v),
  ('Sok pomarańczowy',  'pl', v)
  ON CONFLICT (display_name) DO NOTHING; END IF;

SELECT id INTO v FROM canonical_ingredients WHERE canonical_name = 'banana';
IF v IS NOT NULL THEN INSERT INTO ingredient_aliases (display_name, language, canonical_ingredient_id) VALUES
  ('Banan',             'pl', v), ('Banany',            'pl', v)
  ON CONFLICT (display_name) DO NOTHING; END IF;

SELECT id INTO v FROM canonical_ingredients WHERE canonical_name = 'mango';
IF v IS NOT NULL THEN INSERT INTO ingredient_aliases (display_name, language, canonical_ingredient_id) VALUES
  ('Mango',             'pl', v), ('Mango dojrzałe',    'pl', v)
  ON CONFLICT (display_name) DO NOTHING; END IF;

SELECT id INTO v FROM canonical_ingredients WHERE canonical_name = 'pineapple';
IF v IS NOT NULL THEN INSERT INTO ingredient_aliases (display_name, language, canonical_ingredient_id) VALUES
  ('Ananas',            'pl', v), ('Ananas świeży',     'pl', v),
  ('Ananas z puszki',   'pl', v)
  ON CONFLICT (display_name) DO NOTHING; END IF;

SELECT id INTO v FROM canonical_ingredients WHERE canonical_name = 'grapes';
IF v IS NOT NULL THEN INSERT INTO ingredient_aliases (display_name, language, canonical_ingredient_id) VALUES
  ('Winogrona',         'pl', v), ('Winogrono',         'pl', v),
  ('Winogrona zielone', 'pl', v), ('Winogrona czerwone','pl', v)
  ON CONFLICT (display_name) DO NOTHING; END IF;

SELECT id INTO v FROM canonical_ingredients WHERE canonical_name = 'apricot';
IF v IS NOT NULL THEN INSERT INTO ingredient_aliases (display_name, language, canonical_ingredient_id) VALUES
  ('Morela',            'pl', v), ('Morele',            'pl', v),
  ('Morele suszone',    'pl', v)
  ON CONFLICT (display_name) DO NOTHING; END IF;

SELECT id INTO v FROM canonical_ingredients WHERE canonical_name = 'peach';
IF v IS NOT NULL THEN INSERT INTO ingredient_aliases (display_name, language, canonical_ingredient_id) VALUES
  ('Brzoskwinia',       'pl', v), ('Brzoskwinie',       'pl', v),
  ('Nektaryna',         'pl', v)
  ON CONFLICT (display_name) DO NOTHING; END IF;

SELECT id INTO v FROM canonical_ingredients WHERE canonical_name = 'raisins';
IF v IS NOT NULL THEN INSERT INTO ingredient_aliases (display_name, language, canonical_ingredient_id) VALUES
  ('Rodzynki',          'pl', v), ('Rodzynka',          'pl', v),
  ('Rodzynki golden',   'pl', v)
  ON CONFLICT (display_name) DO NOTHING; END IF;

SELECT id INTO v FROM canonical_ingredients WHERE canonical_name = 'dates';
IF v IS NOT NULL THEN INSERT INTO ingredient_aliases (display_name, language, canonical_ingredient_id) VALUES
  ('Daktyle',           'pl', v), ('Daktyl',            'pl', v)
  ON CONFLICT (display_name) DO NOTHING; END IF;

-- ── GRAINS (Zboża i kasze) ───────────────────────────────────

SELECT id INTO v FROM canonical_ingredients WHERE canonical_name = 'rice';
IF v IS NOT NULL THEN INSERT INTO ingredient_aliases (display_name, language, canonical_ingredient_id) VALUES
  ('Ryż',               'pl', v), ('Ryż biały',         'pl', v),
  ('Ryż brązowy',       'pl', v), ('Ryż jaśminowy',     'pl', v),
  ('Ryż basmati',       'pl', v), ('Ryż parboiled',     'pl', v),
  ('Ryż do risotto',    'pl', v)
  ON CONFLICT (display_name) DO NOTHING; END IF;

SELECT id INTO v FROM canonical_ingredients WHERE canonical_name = 'pasta';
IF v IS NOT NULL THEN INSERT INTO ingredient_aliases (display_name, language, canonical_ingredient_id) VALUES
  ('Makaron',           'pl', v), ('Makaron spaghetti', 'pl', v),
  ('Makaron penne',     'pl', v), ('Makaron świeży',    'pl', v),
  ('Makaron pszenny',   'pl', v), ('Makaron razowy',    'pl', v),
  ('Makaron jajeczny',  'pl', v)
  ON CONFLICT (display_name) DO NOTHING; END IF;

SELECT id INTO v FROM canonical_ingredients WHERE canonical_name = 'bread';
IF v IS NOT NULL THEN INSERT INTO ingredient_aliases (display_name, language, canonical_ingredient_id) VALUES
  ('Chleb',             'pl', v), ('Bochenek chleba',   'pl', v),
  ('Chleb żytni',       'pl', v), ('Chleb pszenny',     'pl', v),
  ('Chleb na zakwasie', 'pl', v), ('Chleb razowy',      'pl', v),
  ('Bułka',             'pl', v), ('Bułka pszenna',     'pl', v),
  ('Bułka tarta',       'pl', v), ('Grzanka',           'pl', v),
  ('Tosty',             'pl', v)
  ON CONFLICT (display_name) DO NOTHING; END IF;

SELECT id INTO v FROM canonical_ingredients WHERE canonical_name = 'flour';
IF v IS NOT NULL THEN INSERT INTO ingredient_aliases (display_name, language, canonical_ingredient_id) VALUES
  ('Mąka',              'pl', v), ('Mąka pszenna',      'pl', v),
  ('Mąka żytnia',       'pl', v), ('Mąka razowa',       'pl', v),
  ('Mąka tortowa',      'pl', v), ('Mąka typ 500',      'pl', v)
  ON CONFLICT (display_name) DO NOTHING; END IF;

SELECT id INTO v FROM canonical_ingredients WHERE canonical_name = 'buckwheat';
IF v IS NOT NULL THEN INSERT INTO ingredient_aliases (display_name, language, canonical_ingredient_id) VALUES
  ('Kasza gryczana',    'pl', v), ('Gryka',             'pl', v),
  ('Kasza gryczana prażona','pl',v), ('Buckwheat groats','en', v)
  ON CONFLICT (display_name) DO NOTHING; END IF;

SELECT id INTO v FROM canonical_ingredients WHERE canonical_name = 'barley';
IF v IS NOT NULL THEN INSERT INTO ingredient_aliases (display_name, language, canonical_ingredient_id) VALUES
  ('Kasza jęczmienna',  'pl', v), ('Pęczak',            'pl', v),
  ('Kasza perłowa',     'pl', v), ('Kasza pęczak',      'pl', v)
  ON CONFLICT (display_name) DO NOTHING; END IF;

SELECT id INTO v FROM canonical_ingredients WHERE canonical_name = 'millet';
IF v IS NOT NULL THEN INSERT INTO ingredient_aliases (display_name, language, canonical_ingredient_id) VALUES
  ('Kasza jaglana',     'pl', v), ('Proso',             'pl', v)
  ON CONFLICT (display_name) DO NOTHING; END IF;

SELECT id INTO v FROM canonical_ingredients WHERE canonical_name = 'oats';
IF v IS NOT NULL THEN INSERT INTO ingredient_aliases (display_name, language, canonical_ingredient_id) VALUES
  ('Płatki owsiane',    'pl', v), ('Owsianka',          'pl', v),
  ('Owies',             'pl', v), ('Płatki owsiane górskie','pl', v)
  ON CONFLICT (display_name) DO NOTHING; END IF;

SELECT id INTO v FROM canonical_ingredients WHERE canonical_name = 'semolina';
IF v IS NOT NULL THEN INSERT INTO ingredient_aliases (display_name, language, canonical_ingredient_id) VALUES
  ('Kasza manna',       'pl', v), ('Semolina',          'pl', v)
  ON CONFLICT (display_name) DO NOTHING; END IF;

SELECT id INTO v FROM canonical_ingredients WHERE canonical_name = 'quinoa';
IF v IS NOT NULL THEN INSERT INTO ingredient_aliases (display_name, language, canonical_ingredient_id) VALUES
  ('Komosa ryżowa',     'pl', v), ('Quinoa',            'pl', v)
  ON CONFLICT (display_name) DO NOTHING; END IF;

SELECT id INTO v FROM canonical_ingredients WHERE canonical_name = 'couscous';
IF v IS NOT NULL THEN INSERT INTO ingredient_aliases (display_name, language, canonical_ingredient_id) VALUES
  ('Kuskus',            'pl', v)
  ON CONFLICT (display_name) DO NOTHING; END IF;

SELECT id INTO v FROM canonical_ingredients WHERE canonical_name = 'cornstarch';
IF v IS NOT NULL THEN INSERT INTO ingredient_aliases (display_name, language, canonical_ingredient_id) VALUES
  ('Skrobia kukurydziana','pl', v), ('Mąka kukurydziana','pl', v),
  ('Maizena',            'pl', v)
  ON CONFLICT (display_name) DO NOTHING; END IF;

-- ── LEGUMES (Rośliny strączkowe) ─────────────────────────────

SELECT id INTO v FROM canonical_ingredients WHERE canonical_name = 'beans';
IF v IS NOT NULL THEN INSERT INTO ingredient_aliases (display_name, language, canonical_ingredient_id) VALUES
  ('Fasola',            'pl', v), ('Fasolka',           'pl', v),
  ('Fasola biała',      'pl', v), ('Fasola czerwona',   'pl', v),
  ('Fasola szparagowa', 'pl', v)
  ON CONFLICT (display_name) DO NOTHING; END IF;

SELECT id INTO v FROM canonical_ingredients WHERE canonical_name = 'lentils';
IF v IS NOT NULL THEN INSERT INTO ingredient_aliases (display_name, language, canonical_ingredient_id) VALUES
  ('Soczewica',         'pl', v), ('Soczewica czerwona','pl', v),
  ('Soczewica zielona', 'pl', v), ('Soczewica brązowa', 'pl', v)
  ON CONFLICT (display_name) DO NOTHING; END IF;

SELECT id INTO v FROM canonical_ingredients WHERE canonical_name = 'chickpeas';
IF v IS NOT NULL THEN INSERT INTO ingredient_aliases (display_name, language, canonical_ingredient_id) VALUES
  ('Ciecierzyca',       'pl', v), ('Cieciorka',         'pl', v)
  ON CONFLICT (display_name) DO NOTHING; END IF;

SELECT id INTO v FROM canonical_ingredients WHERE canonical_name = 'green_peas';
IF v IS NOT NULL THEN INSERT INTO ingredient_aliases (display_name, language, canonical_ingredient_id) VALUES
  ('Groszek',           'pl', v), ('Groch',             'pl', v),
  ('Groszek zielony',   'pl', v), ('Groszek mrożony',   'pl', v),
  ('Groszek konserwowy','pl', v)
  ON CONFLICT (display_name) DO NOTHING; END IF;

SELECT id INTO v FROM canonical_ingredients WHERE canonical_name = 'split_peas';
IF v IS NOT NULL THEN INSERT INTO ingredient_aliases (display_name, language, canonical_ingredient_id) VALUES
  ('Groch łuskany',     'pl', v), ('Groch żółty',       'pl', v)
  ON CONFLICT (display_name) DO NOTHING; END IF;

SELECT id INTO v FROM canonical_ingredients WHERE canonical_name = 'fava_beans';
IF v IS NOT NULL THEN INSERT INTO ingredient_aliases (display_name, language, canonical_ingredient_id) VALUES
  ('Bób',               'pl', v), ('Bób świeży',        'pl', v)
  ON CONFLICT (display_name) DO NOTHING; END IF;

-- ── NUTS & SEEDS (Orzechy i nasiona) ─────────────────────────

SELECT id INTO v FROM canonical_ingredients WHERE canonical_name = 'walnuts';
IF v IS NOT NULL THEN INSERT INTO ingredient_aliases (display_name, language, canonical_ingredient_id) VALUES
  ('Orzechy włoskie',   'pl', v), ('Orzech włoski',     'pl', v)
  ON CONFLICT (display_name) DO NOTHING; END IF;

SELECT id INTO v FROM canonical_ingredients WHERE canonical_name = 'almonds';
IF v IS NOT NULL THEN INSERT INTO ingredient_aliases (display_name, language, canonical_ingredient_id) VALUES
  ('Migdały',           'pl', v), ('Migdał',            'pl', v),
  ('Migdały płatkowane','pl', v), ('Migdały blanszowane','pl', v)
  ON CONFLICT (display_name) DO NOTHING; END IF;

SELECT id INTO v FROM canonical_ingredients WHERE canonical_name = 'hazelnuts';
IF v IS NOT NULL THEN INSERT INTO ingredient_aliases (display_name, language, canonical_ingredient_id) VALUES
  ('Orzechy laskowe',   'pl', v), ('Orzech laskowy',    'pl', v)
  ON CONFLICT (display_name) DO NOTHING; END IF;

SELECT id INTO v FROM canonical_ingredients WHERE canonical_name = 'peanuts';
IF v IS NOT NULL THEN INSERT INTO ingredient_aliases (display_name, language, canonical_ingredient_id) VALUES
  ('Orzeszki ziemne',   'pl', v), ('Orzech ziemny',     'pl', v),
  ('Orzeszki',          'pl', v)
  ON CONFLICT (display_name) DO NOTHING; END IF;

SELECT id INTO v FROM canonical_ingredients WHERE canonical_name = 'cashews';
IF v IS NOT NULL THEN INSERT INTO ingredient_aliases (display_name, language, canonical_ingredient_id) VALUES
  ('Nerkowce',          'pl', v), ('Orzechy nerkowca',  'pl', v)
  ON CONFLICT (display_name) DO NOTHING; END IF;

SELECT id INTO v FROM canonical_ingredients WHERE canonical_name = 'pistachios';
IF v IS NOT NULL THEN INSERT INTO ingredient_aliases (display_name, language, canonical_ingredient_id) VALUES
  ('Pistacje',          'pl', v)
  ON CONFLICT (display_name) DO NOTHING; END IF;

SELECT id INTO v FROM canonical_ingredients WHERE canonical_name = 'sesame_seeds';
IF v IS NOT NULL THEN INSERT INTO ingredient_aliases (display_name, language, canonical_ingredient_id) VALUES
  ('Sezam',             'pl', v), ('Nasiona sezamu',    'pl', v),
  ('Ziarna sezamu',     'pl', v)
  ON CONFLICT (display_name) DO NOTHING; END IF;

SELECT id INTO v FROM canonical_ingredients WHERE canonical_name = 'pumpkin_seeds';
IF v IS NOT NULL THEN INSERT INTO ingredient_aliases (display_name, language, canonical_ingredient_id) VALUES
  ('Pestki dyni',       'pl', v), ('Ziarna dyni',       'pl', v)
  ON CONFLICT (display_name) DO NOTHING; END IF;

SELECT id INTO v FROM canonical_ingredients WHERE canonical_name = 'sunflower_seeds';
IF v IS NOT NULL THEN INSERT INTO ingredient_aliases (display_name, language, canonical_ingredient_id) VALUES
  ('Słonecznik',        'pl', v), ('Ziarna słonecznika','pl', v),
  ('Nasiona słonecznika','pl', v)
  ON CONFLICT (display_name) DO NOTHING; END IF;

SELECT id INTO v FROM canonical_ingredients WHERE canonical_name = 'flax_seeds';
IF v IS NOT NULL THEN INSERT INTO ingredient_aliases (display_name, language, canonical_ingredient_id) VALUES
  ('Siemię lniane',     'pl', v), ('Len',               'pl', v),
  ('Nasiona lnu',       'pl', v)
  ON CONFLICT (display_name) DO NOTHING; END IF;

SELECT id INTO v FROM canonical_ingredients WHERE canonical_name = 'pine_nuts';
IF v IS NOT NULL THEN INSERT INTO ingredient_aliases (display_name, language, canonical_ingredient_id) VALUES
  ('Orzeszki piniowe',  'pl', v), ('Pinole',            'pl', v)
  ON CONFLICT (display_name) DO NOTHING; END IF;

SELECT id INTO v FROM canonical_ingredients WHERE canonical_name = 'chestnuts';
IF v IS NOT NULL THEN INSERT INTO ingredient_aliases (display_name, language, canonical_ingredient_id) VALUES
  ('Kasztany',          'pl', v), ('Kasztany jadalne',  'pl', v)
  ON CONFLICT (display_name) DO NOTHING; END IF;

SELECT id INTO v FROM canonical_ingredients WHERE canonical_name = 'peanut_butter';
IF v IS NOT NULL THEN INSERT INTO ingredient_aliases (display_name, language, canonical_ingredient_id) VALUES
  ('Masło orzechowe',   'pl', v)
  ON CONFLICT (display_name) DO NOTHING; END IF;

-- ── OILS & FATS (Oleje i tłuszcze) ───────────────────────────

SELECT id INTO v FROM canonical_ingredients WHERE canonical_name = 'olive_oil';
IF v IS NOT NULL THEN INSERT INTO ingredient_aliases (display_name, language, canonical_ingredient_id) VALUES
  ('Oliwa z oliwek',    'pl', v), ('Oliwa',             'pl', v),
  ('Oliwa extra virgin','pl', v)
  ON CONFLICT (display_name) DO NOTHING; END IF;

SELECT id INTO v FROM canonical_ingredients WHERE canonical_name = 'vegetable_oil';
IF v IS NOT NULL THEN INSERT INTO ingredient_aliases (display_name, language, canonical_ingredient_id) VALUES
  ('Olej',              'pl', v), ('Olej roślinny',     'pl', v),
  ('Olej rzepakowy',    'pl', v), ('Olej słonecznikowy','pl', v),
  ('Olej kukurydziany', 'pl', v)
  ON CONFLICT (display_name) DO NOTHING; END IF;

SELECT id INTO v FROM canonical_ingredients WHERE canonical_name = 'sesame_oil';
IF v IS NOT NULL THEN INSERT INTO ingredient_aliases (display_name, language, canonical_ingredient_id) VALUES
  ('Olej sezamowy',     'pl', v)
  ON CONFLICT (display_name) DO NOTHING; END IF;

SELECT id INTO v FROM canonical_ingredients WHERE canonical_name = 'lard';
IF v IS NOT NULL THEN INSERT INTO ingredient_aliases (display_name, language, canonical_ingredient_id) VALUES
  ('Smalec',            'pl', v), ('Słonina',           'pl', v)
  ON CONFLICT (display_name) DO NOTHING; END IF;

-- ── CONDIMENTS & SAUCES (Sosy i przyprawy) ───────────────────

SELECT id INTO v FROM canonical_ingredients WHERE canonical_name = 'vinegar';
IF v IS NOT NULL THEN INSERT INTO ingredient_aliases (display_name, language, canonical_ingredient_id) VALUES
  ('Ocet',              'pl', v), ('Ocet spirytusowy',  'pl', v),
  ('Ocet jabłkowy',     'pl', v), ('Ocet balsamiczny',  'pl', v),
  ('Ocet winny',        'pl', v)
  ON CONFLICT (display_name) DO NOTHING; END IF;

SELECT id INTO v FROM canonical_ingredients WHERE canonical_name = 'mustard';
IF v IS NOT NULL THEN INSERT INTO ingredient_aliases (display_name, language, canonical_ingredient_id) VALUES
  ('Musztarda',         'pl', v), ('Musztarda polska',  'pl', v),
  ('Musztarda Sarepska','pl', v), ('Musztarda Dijon',   'pl', v),
  ('Musztarda ziarnista','pl', v)
  ON CONFLICT (display_name) DO NOTHING; END IF;

SELECT id INTO v FROM canonical_ingredients WHERE canonical_name = 'ketchup';
IF v IS NOT NULL THEN INSERT INTO ingredient_aliases (display_name, language, canonical_ingredient_id) VALUES
  ('Ketchup',           'pl', v), ('Ketchup łagodny',   'pl', v),
  ('Ketchup pikantny',  'pl', v)
  ON CONFLICT (display_name) DO NOTHING; END IF;

SELECT id INTO v FROM canonical_ingredients WHERE canonical_name = 'mayonnaise';
IF v IS NOT NULL THEN INSERT INTO ingredient_aliases (display_name, language, canonical_ingredient_id) VALUES
  ('Majonez',           'pl', v), ('Majonez kielecki',  'pl', v),
  ('Sos majonezowy',    'pl', v)
  ON CONFLICT (display_name) DO NOTHING; END IF;

SELECT id INTO v FROM canonical_ingredients WHERE canonical_name = 'soy_sauce';
IF v IS NOT NULL THEN INSERT INTO ingredient_aliases (display_name, language, canonical_ingredient_id) VALUES
  ('Sos sojowy',        'pl', v)
  ON CONFLICT (display_name) DO NOTHING; END IF;

SELECT id INTO v FROM canonical_ingredients WHERE canonical_name = 'tomato_paste';
IF v IS NOT NULL THEN INSERT INTO ingredient_aliases (display_name, language, canonical_ingredient_id) VALUES
  ('Koncentrat pomidorowy','pl', v), ('Pasta pomidorowa','pl', v),
  ('Przecier pomidorowy', 'pl', v)
  ON CONFLICT (display_name) DO NOTHING; END IF;

SELECT id INTO v FROM canonical_ingredients WHERE canonical_name = 'tomato_sauce';
IF v IS NOT NULL THEN INSERT INTO ingredient_aliases (display_name, language, canonical_ingredient_id) VALUES
  ('Sos pomidorowy',    'pl', v), ('Sos do makaronu',   'pl', v),
  ('Passata pomidorowa','pl', v)
  ON CONFLICT (display_name) DO NOTHING; END IF;

SELECT id INTO v FROM canonical_ingredients WHERE canonical_name = 'pickles';
IF v IS NOT NULL THEN INSERT INTO ingredient_aliases (display_name, language, canonical_ingredient_id) VALUES
  ('Ogórki kiszone',    'pl', v), ('Ogórki konserwowe', 'pl', v),
  ('Ogórki małosolne',  'pl', v)
  ON CONFLICT (display_name) DO NOTHING; END IF;

-- ── SWEETENERS (Słodziki / cukier) ───────────────────────────

SELECT id INTO v FROM canonical_ingredients WHERE canonical_name = 'sugar';
IF v IS NOT NULL THEN INSERT INTO ingredient_aliases (display_name, language, canonical_ingredient_id) VALUES
  ('Cukier',            'pl', v), ('Cukier biały',      'pl', v),
  ('Cukier kryształ',   'pl', v), ('Cukier puder',      'pl', v),
  ('Cukier brązowy',    'pl', v), ('Cukier trzcinowy',  'pl', v)
  ON CONFLICT (display_name) DO NOTHING; END IF;

SELECT id INTO v FROM canonical_ingredients WHERE canonical_name = 'honey';
IF v IS NOT NULL THEN INSERT INTO ingredient_aliases (display_name, language, canonical_ingredient_id) VALUES
  ('Miód',              'pl', v), ('Miód pszczeli',     'pl', v),
  ('Miód wielokwiatowy','pl', v), ('Miód lipowy',       'pl', v),
  ('Miód akacjowy',     'pl', v)
  ON CONFLICT (display_name) DO NOTHING; END IF;

SELECT id INTO v FROM canonical_ingredients WHERE canonical_name = 'maple_syrup';
IF v IS NOT NULL THEN INSERT INTO ingredient_aliases (display_name, language, canonical_ingredient_id) VALUES
  ('Syrop klonowy',     'pl', v)
  ON CONFLICT (display_name) DO NOTHING; END IF;

SELECT id INTO v FROM canonical_ingredients WHERE canonical_name = 'chocolate';
IF v IS NOT NULL THEN INSERT INTO ingredient_aliases (display_name, language, canonical_ingredient_id) VALUES
  ('Czekolada',         'pl', v), ('Czekolada gorzka',  'pl', v),
  ('Czekolada mleczna', 'pl', v), ('Czekolada biała',   'pl', v),
  ('Kakao',             'pl', v)
  ON CONFLICT (display_name) DO NOTHING; END IF;

SELECT id INTO v FROM canonical_ingredients WHERE canonical_name = 'baking_powder';
IF v IS NOT NULL THEN INSERT INTO ingredient_aliases (display_name, language, canonical_ingredient_id) VALUES
  ('Proszek do pieczenia','pl', v)
  ON CONFLICT (display_name) DO NOTHING; END IF;

SELECT id INTO v FROM canonical_ingredients WHERE canonical_name = 'yeast';
IF v IS NOT NULL THEN INSERT INTO ingredient_aliases (display_name, language, canonical_ingredient_id) VALUES
  ('Drożdże',           'pl', v), ('Drożdże świeże',    'pl', v),
  ('Drożdże suche',     'pl', v), ('Drożdże instant',   'pl', v)
  ON CONFLICT (display_name) DO NOTHING; END IF;

-- ── BEVERAGES & ALCOHOL (Napoje i alkohol) ───────────────────

SELECT id INTO v FROM canonical_ingredients WHERE canonical_name = 'water';
IF v IS NOT NULL THEN INSERT INTO ingredient_aliases (display_name, language, canonical_ingredient_id) VALUES
  ('Woda',              'pl', v), ('Woda mineralna',    'pl', v),
  ('Woda niegazowana',  'pl', v), ('Woda gazowana',     'pl', v)
  ON CONFLICT (display_name) DO NOTHING; END IF;

SELECT id INTO v FROM canonical_ingredients WHERE canonical_name = 'coffee';
IF v IS NOT NULL THEN INSERT INTO ingredient_aliases (display_name, language, canonical_ingredient_id) VALUES
  ('Kawa',              'pl', v), ('Kawa czarna',       'pl', v),
  ('Kawa z mlekiem',    'pl', v), ('Kawa mielona',      'pl', v),
  ('Espresso',          'pl', v)
  ON CONFLICT (display_name) DO NOTHING; END IF;

SELECT id INTO v FROM canonical_ingredients WHERE canonical_name = 'tea';
IF v IS NOT NULL THEN INSERT INTO ingredient_aliases (display_name, language, canonical_ingredient_id) VALUES
  ('Herbata',           'pl', v), ('Herbata czarna',    'pl', v),
  ('Herbata zielona',   'pl', v), ('Herbata owocowa',   'pl', v),
  ('Herbata z cytryną', 'pl', v)
  ON CONFLICT (display_name) DO NOTHING; END IF;

SELECT id INTO v FROM canonical_ingredients WHERE canonical_name = 'wine';
IF v IS NOT NULL THEN INSERT INTO ingredient_aliases (display_name, language, canonical_ingredient_id) VALUES
  ('Wino',              'pl', v), ('Wino czerwone',     'pl', v),
  ('Wino białe',        'pl', v), ('Wino różowe',       'pl', v)
  ON CONFLICT (display_name) DO NOTHING; END IF;

SELECT id INTO v FROM canonical_ingredients WHERE canonical_name = 'vodka';
IF v IS NOT NULL THEN INSERT INTO ingredient_aliases (display_name, language, canonical_ingredient_id) VALUES
  ('Wódka',             'pl', v), ('Wódka czysta',      'pl', v)
  ON CONFLICT (display_name) DO NOTHING; END IF;

SELECT id INTO v FROM canonical_ingredients WHERE canonical_name = 'broth';
IF v IS NOT NULL THEN INSERT INTO ingredient_aliases (display_name, language, canonical_ingredient_id) VALUES
  ('Bulion',            'pl', v), ('Rosół',             'pl', v),
  ('Wywar',             'pl', v), ('Bulion warzywny',   'pl', v),
  ('Bulion drobiowy',   'pl', v), ('Bulion wołowy',     'pl', v)
  ON CONFLICT (display_name) DO NOTHING; END IF;

-- ============================================================
-- PART B — NEW POLISH CANONICALS (from migration 039)
--          Polish (pl) + English (en) aliases
-- ============================================================

-- ── SAUSAGES & CHARCUTERIE ───────────────────────────────────

SELECT id INTO v FROM canonical_ingredients WHERE canonical_name = 'kielbasa';
IF v IS NOT NULL THEN INSERT INTO ingredient_aliases (display_name, language, canonical_ingredient_id) VALUES
  ('Kiełbasa',                'pl', v), ('Kielbasa',            'en', v),
  ('Kiełbasa wędzona',        'pl', v), ('Kiełbasa krakowska',  'pl', v),
  ('Kiełbasa śląska',         'pl', v), ('Kiełbasa biała',      'pl', v),
  ('Kiełbasa lisiecka',       'pl', v), ('Polish sausage',      'en', v),
  ('Krakowska',               'pl', v), ('Krakowska sausage',   'en', v),
  ('Polska kiełbasa',         'pl', v)
  ON CONFLICT (display_name) DO NOTHING; END IF;

SELECT id INTO v FROM canonical_ingredients WHERE canonical_name = 'kabanos';
IF v IS NOT NULL THEN INSERT INTO ingredient_aliases (display_name, language, canonical_ingredient_id) VALUES
  ('Kabanos',                 'pl', v), ('Kabanos',             'en', v),
  ('Kabanossy',               'pl', v), ('Cabanossi',           'en', v),
  ('Thin dried sausage',      'en', v)
  ON CONFLICT (display_name) DO NOTHING; END IF;

SELECT id INTO v FROM canonical_ingredients WHERE canonical_name = 'kaszanka';
IF v IS NOT NULL THEN INSERT INTO ingredient_aliases (display_name, language, canonical_ingredient_id) VALUES
  ('Kaszanka',                'pl', v), ('Kaszanka',            'en', v),
  ('Czarna kiszka',           'pl', v), ('Kiszka',              'pl', v),
  ('Blood sausage',           'en', v), ('Black pudding',       'en', v)
  ON CONFLICT (display_name) DO NOTHING; END IF;

SELECT id INTO v FROM canonical_ingredients WHERE canonical_name = 'biala_kielbasa';
IF v IS NOT NULL THEN INSERT INTO ingredient_aliases (display_name, language, canonical_ingredient_id) VALUES
  ('Biała kiełbasa',          'pl', v), ('Biała kiełbasa',      'en', v),
  ('White sausage',           'en', v), ('Raw Polish sausage',  'en', v),
  ('Kiełbasa surowa',         'pl', v), ('Kiełbasa wielkanocna','pl', v)
  ON CONFLICT (display_name) DO NOTHING; END IF;

SELECT id INTO v FROM canonical_ingredients WHERE canonical_name = 'pasztet';
IF v IS NOT NULL THEN INSERT INTO ingredient_aliases (display_name, language, canonical_ingredient_id) VALUES
  ('Pasztet',                 'pl', v), ('Pasztet',             'en', v),
  ('Pasztet wieprzowy',       'pl', v), ('Pasztet drobiowy',    'pl', v),
  ('Pasztet z warzywami',     'pl', v), ('Polish pâté',         'en', v),
  ('Polish pate',             'en', v)
  ON CONFLICT (display_name) DO NOTHING; END IF;

SELECT id INTO v FROM canonical_ingredients WHERE canonical_name = 'smalec';
IF v IS NOT NULL THEN INSERT INTO ingredient_aliases (display_name, language, canonical_ingredient_id) VALUES
  ('Smalec z cebulką',        'pl', v), ('Smalec domowy',       'pl', v),
  ('Smalec',                  'en', v), ('Polish lard spread',  'en', v),
  ('Rendered pork fat spread','en', v)
  ON CONFLICT (display_name) DO NOTHING; END IF;

-- ── PORK CUTS ─────────────────────────────────────────────────

SELECT id INTO v FROM canonical_ingredients WHERE canonical_name = 'golonka';
IF v IS NOT NULL THEN INSERT INTO ingredient_aliases (display_name, language, canonical_ingredient_id) VALUES
  ('Golonka',                 'pl', v), ('Golonka',             'en', v),
  ('Golonka wieprzowa',       'pl', v), ('Golonka pieczona',    'pl', v),
  ('Golonka duszona',         'pl', v), ('Pork knuckle',        'en', v),
  ('Pork hock',               'en', v), ('Ham hock',            'en', v)
  ON CONFLICT (display_name) DO NOTHING; END IF;

SELECT id INTO v FROM canonical_ingredients WHERE canonical_name = 'karkowka';
IF v IS NOT NULL THEN INSERT INTO ingredient_aliases (display_name, language, canonical_ingredient_id) VALUES
  ('Karkówka',                'pl', v), ('Karkowka',            'en', v),
  ('Karkówka wieprzowa',      'pl', v), ('Karkówka z grilla',   'pl', v),
  ('Pork neck',               'en', v), ('Pork collar',         'en', v)
  ON CONFLICT (display_name) DO NOTHING; END IF;

SELECT id INTO v FROM canonical_ingredients WHERE canonical_name = 'schab';
IF v IS NOT NULL THEN INSERT INTO ingredient_aliases (display_name, language, canonical_ingredient_id) VALUES
  ('Schab',                   'pl', v), ('Schab',               'en', v),
  ('Schab pieczony',          'pl', v), ('Schab wieprzowy',     'pl', v),
  ('Schab z kością',          'pl', v), ('Pork loin',           'en', v)
  ON CONFLICT (display_name) DO NOTHING; END IF;

-- ── DAIRY ─────────────────────────────────────────────────────

SELECT id INTO v FROM canonical_ingredients WHERE canonical_name = 'oscypek';
IF v IS NOT NULL THEN INSERT INTO ingredient_aliases (display_name, language, canonical_ingredient_id) VALUES
  ('Oscypek',                 'pl', v), ('Oscypek',             'en', v),
  ('Oscypek wędzony',         'pl', v), ('Smoked sheep cheese', 'en', v),
  ('Tatra sheep cheese',      'en', v)
  ON CONFLICT (display_name) DO NOTHING; END IF;

SELECT id INTO v FROM canonical_ingredients WHERE canonical_name = 'twarog';
IF v IS NOT NULL THEN INSERT INTO ingredient_aliases (display_name, language, canonical_ingredient_id) VALUES
  ('Twaróg',                  'pl', v), ('Twarożek',            'pl', v),
  ('Twaróg półtłusty',        'pl', v), ('Twaróg chudy',        'pl', v),
  ('Twaróg tłusty',           'pl', v), ('Ser twarogowy',       'pl', v),
  ('Quark',                   'en', v), ('Polish fresh curd cheese','en', v),
  ('Farmer cheese',           'en', v), ('Twarog',              'en', v)
  ON CONFLICT (display_name) DO NOTHING; END IF;

-- ── PRESERVED VEGETABLES ─────────────────────────────────────

SELECT id INTO v FROM canonical_ingredients WHERE canonical_name = 'kapusta_kiszona';
IF v IS NOT NULL THEN INSERT INTO ingredient_aliases (display_name, language, canonical_ingredient_id) VALUES
  ('Kapusta kiszona',         'pl', v), ('Kiszona kapusta',     'pl', v),
  ('Kapusta kwaszona',        'pl', v), ('Sauerkraut',          'en', v),
  ('Fermented cabbage',       'en', v)
  ON CONFLICT (display_name) DO NOTHING; END IF;

SELECT id INTO v FROM canonical_ingredients WHERE canonical_name = 'ogorek_kiszony';
IF v IS NOT NULL THEN INSERT INTO ingredient_aliases (display_name, language, canonical_ingredient_id) VALUES
  ('Ogórek kiszony',          'pl', v), ('Kiszone ogórki',      'pl', v),
  ('Ogórki kiszone',          'pl', v), ('Ogórek kwaszony',     'pl', v),
  ('Polish pickle',           'en', v), ('Sour cucumber',       'en', v),
  ('Fermented cucumber',      'en', v), ('Ogorek kiszony',      'en', v)
  ON CONFLICT (display_name) DO NOTHING; END IF;

SELECT id INTO v FROM canonical_ingredients WHERE canonical_name = 'cwikla';
IF v IS NOT NULL THEN INSERT INTO ingredient_aliases (display_name, language, canonical_ingredient_id) VALUES
  ('Ćwikła',                  'pl', v), ('Ćwikła z chrzanem',   'pl', v),
  ('Cwikla',                  'en', v), ('Beetroot relish',     'en', v),
  ('Beet horseradish relish', 'en', v)
  ON CONFLICT (display_name) DO NOTHING; END IF;

-- ── FISH ──────────────────────────────────────────────────────

SELECT id INTO v FROM canonical_ingredients WHERE canonical_name = 'sledz';
IF v IS NOT NULL THEN INSERT INTO ingredient_aliases (display_name, language, canonical_ingredient_id) VALUES
  ('Śledź',                   'pl', v), ('Sledz',               'en', v),
  ('Śledź w oleju',           'pl', v), ('Śledź w śmietanie',   'pl', v),
  ('Śledź marynowany',        'pl', v), ('Śledź z cebulką',     'pl', v),
  ('Rollmops',                'pl', v), ('Herring',             'en', v),
  ('Pickled herring',         'en', v), ('Atlantic herring',    'en', v)
  ON CONFLICT (display_name) DO NOTHING; END IF;

SELECT id INTO v FROM canonical_ingredients WHERE canonical_name = 'karp';
IF v IS NOT NULL THEN INSERT INTO ingredient_aliases (display_name, language, canonical_ingredient_id) VALUES
  ('Karp',                    'pl', v), ('Karp',                'en', v),
  ('Karp smażony',            'pl', v), ('Karp w galarecie',    'pl', v),
  ('Karp pieczony',           'pl', v), ('Carp',               'en', v),
  ('Fried carp',              'en', v)
  ON CONFLICT (display_name) DO NOTHING; END IF;

SELECT id INTO v FROM canonical_ingredients WHERE canonical_name = 'szczupak';
IF v IS NOT NULL THEN INSERT INTO ingredient_aliases (display_name, language, canonical_ingredient_id) VALUES
  ('Szczupak',                'pl', v), ('Szczupak',            'en', v),
  ('Filet ze szczupaka',      'pl', v), ('Pike',               'en', v)
  ON CONFLICT (display_name) DO NOTHING; END IF;

SELECT id INTO v FROM canonical_ingredients WHERE canonical_name = 'okon';
IF v IS NOT NULL THEN INSERT INTO ingredient_aliases (display_name, language, canonical_ingredient_id) VALUES
  ('Okoń',                    'pl', v), ('Okon',                'en', v),
  ('Perch',                   'en', v), ('River perch',         'en', v)
  ON CONFLICT (display_name) DO NOTHING; END IF;

SELECT id INTO v FROM canonical_ingredients WHERE canonical_name = 'weggorz';
IF v IS NOT NULL THEN INSERT INTO ingredient_aliases (display_name, language, canonical_ingredient_id) VALUES
  ('Węgorz',                  'pl', v), ('Weggorz',             'en', v),
  ('Węgorz wędzony',          'pl', v), ('Eel',                'en', v),
  ('Smoked eel',              'en', v)
  ON CONFLICT (display_name) DO NOTHING; END IF;

SELECT id INTO v FROM canonical_ingredients WHERE canonical_name = 'szprot';
IF v IS NOT NULL THEN INSERT INTO ingredient_aliases (display_name, language, canonical_ingredient_id) VALUES
  ('Szprot',                  'pl', v), ('Szprotki',            'pl', v),
  ('Szproty bałtyckie',       'pl', v), ('Sprat',              'en', v),
  ('Baltic sprats',           'en', v)
  ON CONFLICT (display_name) DO NOTHING; END IF;

-- ── ROOT VEGETABLES ───────────────────────────────────────────

SELECT id INTO v FROM canonical_ingredients WHERE canonical_name = 'korzen_pietruszki';
IF v IS NOT NULL THEN INSERT INTO ingredient_aliases (display_name, language, canonical_ingredient_id) VALUES
  ('Korzeń pietruszki',       'pl', v), ('Pietruszka korzeń',  'pl', v),
  ('Korzeń pietruchy',        'pl', v), ('Parsley root',        'en', v),
  ('Root parsley',            'en', v)
  ON CONFLICT (display_name) DO NOTHING; END IF;

SELECT id INTO v FROM canonical_ingredients WHERE canonical_name = 'seler_korzeniowy';
IF v IS NOT NULL THEN INSERT INTO ingredient_aliases (display_name, language, canonical_ingredient_id) VALUES
  ('Seler korzeniowy',        'pl', v), ('Seler biały',         'pl', v),
  ('Celeriac',                'en', v), ('Celery root',         'en', v),
  ('Bulb celeriac',           'en', v)
  ON CONFLICT (display_name) DO NOTHING; END IF;

-- ── WILD MUSHROOMS ────────────────────────────────────────────

SELECT id INTO v FROM canonical_ingredients WHERE canonical_name = 'borowik';
IF v IS NOT NULL THEN INSERT INTO ingredient_aliases (display_name, language, canonical_ingredient_id) VALUES
  ('Borowik',                 'pl', v), ('Borowik szlachetny',  'pl', v),
  ('Prawdziwek',              'pl', v), ('Porcini',             'en', v),
  ('Cep',                     'en', v), ('Porcini mushroom',    'en', v)
  ON CONFLICT (display_name) DO NOTHING; END IF;

SELECT id INTO v FROM canonical_ingredients WHERE canonical_name = 'kurka';
IF v IS NOT NULL THEN INSERT INTO ingredient_aliases (display_name, language, canonical_ingredient_id) VALUES
  ('Kurka',                   'pl', v), ('Kurki',               'pl', v),
  ('Pieprznik jadalny',       'pl', v), ('Chanterelle',         'en', v),
  ('Chanterelle mushroom',    'en', v), ('Girolle',             'en', v)
  ON CONFLICT (display_name) DO NOTHING; END IF;

SELECT id INTO v FROM canonical_ingredients WHERE canonical_name = 'grzyby_lesne';
IF v IS NOT NULL THEN INSERT INTO ingredient_aliases (display_name, language, canonical_ingredient_id) VALUES
  ('Grzyby leśne',            'pl', v), ('Grzyby leśne mix',    'pl', v),
  ('Grzyby polskie',          'pl', v), ('Wild mushrooms',      'en', v),
  ('Forest mushrooms',        'en', v), ('Polish wild mushrooms','en', v)
  ON CONFLICT (display_name) DO NOTHING; END IF;

SELECT id INTO v FROM canonical_ingredients WHERE canonical_name = 'suszone_grzyby';
IF v IS NOT NULL THEN INSERT INTO ingredient_aliases (display_name, language, canonical_ingredient_id) VALUES
  ('Suszone grzyby',          'pl', v), ('Grzyby suszone',      'pl', v),
  ('Grzyby namoczone',        'pl', v), ('Dried mushrooms',     'en', v),
  ('Dried forest mushrooms',  'en', v), ('Dried porcini',       'en', v)
  ON CONFLICT (display_name) DO NOTHING; END IF;

-- ── HERBS & SPICES ────────────────────────────────────────────

SELECT id INTO v FROM canonical_ingredients WHERE canonical_name = 'lubczyk';
IF v IS NOT NULL THEN INSERT INTO ingredient_aliases (display_name, language, canonical_ingredient_id) VALUES
  ('Lubczyk',                 'pl', v), ('Lubczyk świeży',      'pl', v),
  ('Lovage',                  'en', v), ('Love parsley',        'en', v)
  ON CONFLICT (display_name) DO NOTHING; END IF;

SELECT id INTO v FROM canonical_ingredients WHERE canonical_name = 'allspice';
IF v IS NOT NULL THEN INSERT INTO ingredient_aliases (display_name, language, canonical_ingredient_id) VALUES
  ('Ziele angielskie',        'pl', v), ('Allspice',            'en', v),
  ('Allspice berries',        'en', v), ('Pimento',             'en', v),
  ('Kulki ziela angielskiego','pl', v)
  ON CONFLICT (display_name) DO NOTHING; END IF;

-- ── PANTRY ────────────────────────────────────────────────────

SELECT id INTO v FROM canonical_ingredients WHERE canonical_name = 'mak';
IF v IS NOT NULL THEN INSERT INTO ingredient_aliases (display_name, language, canonical_ingredient_id) VALUES
  ('Mak',                     'pl', v), ('Nasiona maku',        'pl', v),
  ('Mak niebieski',           'pl', v), ('Poppy seeds',         'en', v),
  ('Blue poppy seeds',        'en', v)
  ON CONFLICT (display_name) DO NOTHING; END IF;

SELECT id INTO v FROM canonical_ingredients WHERE canonical_name = 'kasza';
IF v IS NOT NULL THEN INSERT INTO ingredient_aliases (display_name, language, canonical_ingredient_id) VALUES
  ('Kasza',                   'pl', v), ('Kasza',               'en', v),
  ('Kasze',                   'pl', v), ('Polish groats',       'en', v),
  ('Groats',                  'en', v)
  ON CONFLICT (display_name) DO NOTHING; END IF;

SELECT id INTO v FROM canonical_ingredients WHERE canonical_name = 'potato_starch';
IF v IS NOT NULL THEN INSERT INTO ingredient_aliases (display_name, language, canonical_ingredient_id) VALUES
  ('Skrobia ziemniaczana',    'pl', v), ('Mąka ziemniaczana',   'pl', v),
  ('Skrobia',                 'pl', v), ('Potato starch',       'en', v),
  ('Potato flour',            'en', v)
  ON CONFLICT (display_name) DO NOTHING; END IF;

SELECT id INTO v FROM canonical_ingredients WHERE canonical_name = 'beer';
IF v IS NOT NULL THEN INSERT INTO ingredient_aliases (display_name, language, canonical_ingredient_id) VALUES
  ('Piwo',                    'pl', v), ('Piwo jasne',          'pl', v),
  ('Piwo ciemne',             'pl', v), ('Piwo kraftowe',       'pl', v),
  ('Beer',                    'en', v), ('Lager',               'en', v),
  ('Polish beer',             'en', v)
  ON CONFLICT (display_name) DO NOTHING; END IF;

-- ── FRUITS ────────────────────────────────────────────────────

SELECT id INTO v FROM canonical_ingredients WHERE canonical_name = 'wisnia';
IF v IS NOT NULL THEN INSERT INTO ingredient_aliases (display_name, language, canonical_ingredient_id) VALUES
  ('Wiśnia',                  'pl', v), ('Wiśnie',              'pl', v),
  ('Wiśnia kwaśna',           'pl', v), ('Wiśnie mrożone',      'pl', v),
  ('Sour cherry',             'en', v), ('Morello cherry',      'en', v),
  ('Tart cherry',             'en', v)
  ON CONFLICT (display_name) DO NOTHING; END IF;

SELECT id INTO v FROM canonical_ingredients WHERE canonical_name = 'cherry';
IF v IS NOT NULL THEN INSERT INTO ingredient_aliases (display_name, language, canonical_ingredient_id) VALUES
  ('Czereśnia',               'pl', v), ('Czereśnie',           'pl', v),
  ('Cherry',                  'en', v), ('Sweet cherry',        'en', v),
  ('Cherries',                'en', v)
  ON CONFLICT (display_name) DO NOTHING; END IF;

SELECT id INTO v FROM canonical_ingredients WHERE canonical_name = 'czarna_porzeczka';
IF v IS NOT NULL THEN INSERT INTO ingredient_aliases (display_name, language, canonical_ingredient_id) VALUES
  ('Czarna porzeczka',        'pl', v), ('Porzeczka czarna',    'pl', v),
  ('Blackcurrant',            'en', v), ('Black currant',       'en', v),
  ('Blackcurrants',           'en', v)
  ON CONFLICT (display_name) DO NOTHING; END IF;

SELECT id INTO v FROM canonical_ingredients WHERE canonical_name = 'czerwona_porzeczka';
IF v IS NOT NULL THEN INSERT INTO ingredient_aliases (display_name, language, canonical_ingredient_id) VALUES
  ('Czerwona porzeczka',      'pl', v), ('Porzeczka czerwona',  'pl', v),
  ('Redcurrant',              'en', v), ('Red currant',         'en', v),
  ('Redcurrants',             'en', v)
  ON CONFLICT (display_name) DO NOTHING; END IF;

SELECT id INTO v FROM canonical_ingredients WHERE canonical_name = 'agrest';
IF v IS NOT NULL THEN INSERT INTO ingredient_aliases (display_name, language, canonical_ingredient_id) VALUES
  ('Agrest',                  'pl', v), ('Agresty',             'pl', v),
  ('Gooseberry',              'en', v), ('Gooseberries',        'en', v)
  ON CONFLICT (display_name) DO NOTHING; END IF;

SELECT id INTO v FROM canonical_ingredients WHERE canonical_name = 'dzika_roza';
IF v IS NOT NULL THEN INSERT INTO ingredient_aliases (display_name, language, canonical_ingredient_id) VALUES
  ('Dzika róża',              'pl', v), ('Owoce dzikiej róży',  'pl', v),
  ('Dzika różą',              'pl', v), ('Rose hip',            'en', v),
  ('Rosehip',                 'en', v), ('Rose hips',           'en', v)
  ON CONFLICT (display_name) DO NOTHING; END IF;

-- ── DRINKS ────────────────────────────────────────────────────

SELECT id INTO v FROM canonical_ingredients WHERE canonical_name = 'kompot';
IF v IS NOT NULL THEN INSERT INTO ingredient_aliases (display_name, language, canonical_ingredient_id) VALUES
  ('Kompot',                  'pl', v), ('Kompot',              'en', v),
  ('Kompot z wiśni',          'pl', v), ('Kompot z owoców',     'pl', v),
  ('Stewed fruit drink',      'en', v), ('Fruit compote',       'en', v)
  ON CONFLICT (display_name) DO NOTHING; END IF;

SELECT id INTO v FROM canonical_ingredients WHERE canonical_name = 'kwas_chlebowy';
IF v IS NOT NULL THEN INSERT INTO ingredient_aliases (display_name, language, canonical_ingredient_id) VALUES
  ('Kwas chlebowy',           'pl', v), ('Kwas',                'pl', v),
  ('Bread kvass',             'en', v), ('Kvass',               'en', v),
  ('Fermented bread drink',   'en', v)
  ON CONFLICT (display_name) DO NOTHING; END IF;

SELECT id INTO v FROM canonical_ingredients WHERE canonical_name = 'nalewka';
IF v IS NOT NULL THEN INSERT INTO ingredient_aliases (display_name, language, canonical_ingredient_id) VALUES
  ('Nalewka',                 'pl', v), ('Nalewka',             'en', v),
  ('Nalewka wiśniowa',        'pl', v), ('Nalewka śliwkowa',    'pl', v),
  ('Nalewka ziołowa',         'pl', v), ('Polish fruit liqueur','en', v),
  ('Polish nalewka',          'en', v)
  ON CONFLICT (display_name) DO NOTHING; END IF;

SELECT id INTO v FROM canonical_ingredients WHERE canonical_name = 'zubrowka';
IF v IS NOT NULL THEN INSERT INTO ingredient_aliases (display_name, language, canonical_ingredient_id) VALUES
  ('Żubrówka',                'pl', v), ('Zubrówka',            'pl', v),
  ('Bison grass vodka',       'en', v), ('Zubrowka',            'en', v),
  ('Żubrówka wódka',          'pl', v)
  ON CONFLICT (display_name) DO NOTHING; END IF;

SELECT id INTO v FROM canonical_ingredients WHERE canonical_name = 'spirytus';
IF v IS NOT NULL THEN INSERT INTO ingredient_aliases (display_name, language, canonical_ingredient_id) VALUES
  ('Spirytus',                'pl', v), ('Spirytus',            'en', v),
  ('Polish grain spirit',     'en', v), ('Rectified spirit',    'en', v)
  ON CONFLICT (display_name) DO NOTHING; END IF;

END $$;

-- Summary counts (separate block to avoid subquery-in-RAISE-NOTICE syntax error)
DO $$
DECLARE
  v_total BIGINT; v_en BIGINT; v_es BIGINT; v_pt BIGINT; v_pl BIGINT;
BEGIN
  SELECT COUNT(*)                                 INTO v_total FROM ingredient_aliases;
  SELECT COUNT(*) FILTER (WHERE language = 'en') INTO v_en    FROM ingredient_aliases;
  SELECT COUNT(*) FILTER (WHERE language = 'es') INTO v_es    FROM ingredient_aliases;
  SELECT COUNT(*) FILTER (WHERE language = 'pt') INTO v_pt    FROM ingredient_aliases;
  SELECT COUNT(*) FILTER (WHERE language = 'pl') INTO v_pl    FROM ingredient_aliases;
  RAISE NOTICE '========================================';
  RAISE NOTICE 'Polish aliases migration complete!';
  RAISE NOTICE 'Total aliases:   %', v_total;
  RAISE NOTICE 'English (en):    %', v_en;
  RAISE NOTICE 'Spanish (es):    %', v_es;
  RAISE NOTICE 'Portuguese (pt): %', v_pt;
  RAISE NOTICE 'Polish (pl):     %', v_pl;
  RAISE NOTICE '========================================';
END $$;
