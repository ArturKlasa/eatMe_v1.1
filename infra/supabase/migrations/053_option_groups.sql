-- 053_option_groups.sql
-- Created: 2026-03-19
--
-- Adds the option groups system to support composable menus:
--   - template dishes  (e.g. Thai main: choose protein + sauce)
--   - experience dishes (e.g. Hot Pot: choose broth + meats + vegetables)
--
-- New columns on dishes:
--   dish_kind              TEXT  'standard' | 'template' | 'experience'
--   display_price_prefix   TEXT  'exact' | 'from' | 'per_person' | 'market_price' | 'ask_server'
--
-- New tables:
--   option_groups   — groups of options attached to a dish (or a menu category)
--   options         — individual selectable items within a group
--
-- Existing standard dishes are completely unaffected (dish_kind defaults to 'standard').

-- ── New columns on dishes ─────────────────────────────────────────────────────

ALTER TABLE dishes
  ADD COLUMN dish_kind TEXT NOT NULL DEFAULT 'standard'
    CHECK (dish_kind IN ('standard', 'template', 'experience')),
  ADD COLUMN display_price_prefix TEXT NOT NULL DEFAULT 'exact'
    CHECK (display_price_prefix IN ('exact', 'from', 'per_person', 'market_price', 'ask_server'));

-- ── option_groups ─────────────────────────────────────────────────────────────

CREATE TABLE option_groups (
  id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id      UUID NOT NULL REFERENCES restaurants(id) ON DELETE CASCADE,
  -- Attach to a specific dish OR to a menu category (shared group).
  -- Exactly one must be set — enforced by the CHECK below.
  dish_id            UUID REFERENCES dishes(id) ON DELETE CASCADE,
  menu_category_id   UUID REFERENCES menu_categories(id) ON DELETE CASCADE,
  name               TEXT NOT NULL,
  description        TEXT,
  -- single: user picks exactly one option
  -- multiple: user picks zero or more (capped by max_selections)
  -- quantity: user sets a numeric amount per option
  selection_type     TEXT NOT NULL CHECK (selection_type IN ('single', 'multiple', 'quantity')),
  min_selections     INTEGER NOT NULL DEFAULT 0,
  max_selections     INTEGER,            -- NULL = unlimited
  display_order      INTEGER NOT NULL DEFAULT 0,
  is_active          BOOLEAN NOT NULL DEFAULT true,
  created_at         TIMESTAMPTZ DEFAULT now(),
  updated_at         TIMESTAMPTZ DEFAULT now(),
  CONSTRAINT option_groups_owner_check CHECK (
    (dish_id IS NOT NULL AND menu_category_id IS NULL) OR
    (dish_id IS NULL     AND menu_category_id IS NOT NULL)
  )
);

-- ── options ───────────────────────────────────────────────────────────────────

CREATE TABLE options (
  id                        UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  option_group_id           UUID NOT NULL REFERENCES option_groups(id) ON DELETE CASCADE,
  name                      TEXT NOT NULL,
  description               TEXT,
  -- Price delta relative to the base dish price (+2.00, -1.00, 0.00)
  price_delta               NUMERIC NOT NULL DEFAULT 0,
  calories_delta            INTEGER,
  -- Optional link to canonical ingredient for allergen warnings
  canonical_ingredient_id   UUID REFERENCES canonical_ingredients(id) ON DELETE SET NULL,
  is_available              BOOLEAN NOT NULL DEFAULT true,
  display_order             INTEGER NOT NULL DEFAULT 0,
  created_at                TIMESTAMPTZ DEFAULT now(),
  updated_at                TIMESTAMPTZ DEFAULT now()
);

-- ── RLS ───────────────────────────────────────────────────────────────────────

ALTER TABLE option_groups ENABLE ROW LEVEL SECURITY;
ALTER TABLE options       ENABLE ROW LEVEL SECURITY;

-- Restaurant partners can CRUD their own option_groups
CREATE POLICY option_groups_owner ON option_groups
  USING (restaurant_id IN (
    SELECT id FROM restaurants WHERE owner_id = auth.uid()
  ))
  WITH CHECK (restaurant_id IN (
    SELECT id FROM restaurants WHERE owner_id = auth.uid()
  ));

-- Consumers can read option_groups (needed for dish detail view)
CREATE POLICY option_groups_public_read ON option_groups
  FOR SELECT USING (true);

-- Options inherit ownership via their group
CREATE POLICY options_owner ON options
  USING (option_group_id IN (
    SELECT og.id FROM option_groups og
    JOIN restaurants r ON r.id = og.restaurant_id
    WHERE r.owner_id = auth.uid()
  ))
  WITH CHECK (option_group_id IN (
    SELECT og.id FROM option_groups og
    JOIN restaurants r ON r.id = og.restaurant_id
    WHERE r.owner_id = auth.uid()
  ));

-- Consumers can read options (needed for dish detail view)
CREATE POLICY options_public_read ON options
  FOR SELECT USING (true);

-- ── Indexes ───────────────────────────────────────────────────────────────────

CREATE INDEX option_groups_restaurant_id_idx  ON option_groups(restaurant_id);
CREATE INDEX option_groups_dish_id_idx        ON option_groups(dish_id);
CREATE INDEX option_groups_category_id_idx    ON option_groups(menu_category_id);
CREATE INDEX options_option_group_id_idx      ON options(option_group_id);
CREATE INDEX options_ingredient_id_idx        ON options(canonical_ingredient_id);
