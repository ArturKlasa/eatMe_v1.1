-- Migration 039: Polish canonical ingredients
-- Adds canonical_ingredients for Polish-specific ingredients not yet in the system:
-- sausages, pork cuts, dairy, preserved vegetables, fish, wild mushrooms,
-- herbs/pantry staples, fruits, and beverages.
-- Dishes (bigos, pierogi, etc.) belong in the dishes table, NOT here.
-- ON CONFLICT (canonical_name) DO NOTHING → idempotent / safe to re-run.

INSERT INTO canonical_ingredients (canonical_name, is_vegetarian, is_vegan, ingredient_family_name) VALUES

-- ── POLISH SAUSAGES & CHARCUTERIE ────────────────────────────
('kielbasa',            false, false, 'meat'),     -- Polish smoked pork sausage
('kabanos',             false, false, 'meat'),     -- thin dried smoked sausage sticks
('kaszanka',            false, false, 'meat'),     -- blood & buckwheat sausage
('biala_kielbasa',      false, false, 'meat'),     -- raw white pork sausage
('pasztet',             false, false, 'meat'),     -- Polish baked pâté / forcemeat loaf
('smalec',              false, false, 'oil_fat'),  -- rendered pork lard spread with onion

-- ── POLISH PORK CUTS ─────────────────────────────────────────
('golonka',             false, false, 'meat'),     -- pork knuckle / hock
('karkowka',            false, false, 'meat'),     -- pork neck
('schab',               false, false, 'meat'),     -- pork loin (as a specific cut)

-- ── POLISH DAIRY ─────────────────────────────────────────────
('oscypek',             true,  false, 'dairy'),    -- smoked Tatra mountain sheep cheese
('twarog',              true,  false, 'dairy'),    -- Polish fresh curd / quark cheese

-- ── POLISH PRESERVED VEGETABLES ──────────────────────────────
('kapusta_kiszona',     true,  true,  'vegetable'),-- fermented sauerkraut
('ogorek_kiszony',      true,  true,  'vegetable'),-- Polish sour fermented cucumber
('cwikla',              true,  true,  'condiment'),-- beet & horseradish relish

-- ── POLISH FRESHWATER & REGIONAL FISH ────────────────────────
('sledz',               false, false, 'other'),    -- Atlantic herring (śledź)
('karp',                false, false, 'other'),    -- carp
('szczupak',            false, false, 'other'),    -- pike
('okon',                false, false, 'other'),    -- freshwater perch (okoń)
('weggorz',             false, false, 'other'),    -- eel (węgorz)
('szprot',              false, false, 'other'),    -- sprat (szprot/szprotki)

-- ── POLISH ROOT VEGETABLES ───────────────────────────────────
('korzen_pietruszki',   true,  true,  'vegetable'),-- parsley root (distinct from parsley leaf)
('seler_korzeniowy',    true,  true,  'vegetable'),-- celeriac (distinct from celery stalk)

-- ── POLISH WILD MUSHROOMS ────────────────────────────────────
('borowik',             true,  true,  'vegetable'),-- porcini / cep (borowik szlachetny)
('kurka',               true,  true,  'vegetable'),-- chanterelle (kurka / pieprznik jadalny)
('grzyby_lesne',        true,  true,  'vegetable'),-- mixed wild forest mushrooms
('suszone_grzyby',      true,  true,  'vegetable'),-- dried forest mushrooms (key soup base)

-- ── POLISH HERBS & SPICES ────────────────────────────────────
('lubczyk',             true,  true,  'spice_herb'),-- lovage (lubczyk), classic in rosół
('allspice',            true,  true,  'spice_herb'),-- allspice (ziele angielskie)

-- ── POLISH PANTRY ─────────────────────────────────────────────
('mak',                 true,  true,  'nut_seed'), -- poppy seeds (mak)
('kasza',               true,  true,  'grain'),    -- generic Polish groats
('potato_starch',       true,  true,  'grain'),    -- potato starch (skrobia ziemniaczana)
('beer',                true,  true,  'alcohol'),  -- beer / piwo

-- ── POLISH FRUITS ─────────────────────────────────────────────
('wisnia',              true,  true,  'fruit'),    -- sour/morello cherry (wiśnia)
('cherry',              true,  true,  'fruit'),    -- sweet cherry (czereśnia)
('czarna_porzeczka',    true,  true,  'fruit'),    -- blackcurrant
('czerwona_porzeczka',  true,  true,  'fruit'),    -- redcurrant
('agrest',              true,  true,  'fruit'),    -- gooseberry (agrest)
('dzika_roza',          true,  true,  'fruit'),    -- rose hip (dzika róża)

-- ── POLISH DRINKS ─────────────────────────────────────────────
('kompot',              true,  true,  'beverage'), -- stewed fruit drink
('kwas_chlebowy',       true,  true,  'beverage'), -- Polish bread kvass
('nalewka',             true,  false, 'alcohol'),  -- Polish macerated fruit liqueur
('zubrowka',            true,  true,  'alcohol'),  -- bison grass vodka (Żubrówka)
('spirytus',            true,  true,  'alcohol')   -- Polish neutral grain spirit

ON CONFLICT (canonical_name) DO NOTHING;
