-- 091_content_rls_owner_writes.sql
-- Restores the "public read, owner writes" RLS pattern across the full
-- restaurant → menu → category → dish → ingredient/option_group → option chain.
--
-- Migration 078 cleaned up stale SELECT policies but left:
--   - No write policies on restaurants/menus/dishes (writes relied on service-role keys)
--   - No RLS at all on menu_categories, dish_ingredients, option_groups, options
--
-- Ownership chain (all gated with OR public.is_admin() so users with
-- app_metadata.role='admin' can manage any restaurant's content):
--   restaurants.owner_id = auth.uid()
--   menus            → restaurants.owner_id
--   menu_categories  → menus → restaurants.owner_id
--   dishes           → restaurants.owner_id
--   dish_ingredients → dishes → restaurants.owner_id
--   option_groups    → restaurants.owner_id (restaurant_id NOT NULL)
--   options          → option_groups → restaurants.owner_id
--
-- Server API routes using the service_role key bypass RLS entirely and are
-- unaffected by these policies.

-- ---------------------------------------------------------------------------
-- Helper: true when caller has admin role in JWT app_metadata.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.is_admin() RETURNS boolean
  LANGUAGE sql STABLE SECURITY INVOKER
  AS $$
    SELECT coalesce(
      (auth.jwt() -> 'app_metadata' ->> 'role') = 'admin',
      false
    );
  $$;

GRANT EXECUTE ON FUNCTION public.is_admin() TO authenticated, anon;

-- ---------------------------------------------------------------------------
-- Enable RLS on all content tables (idempotent)
-- ---------------------------------------------------------------------------
ALTER TABLE public.restaurants       ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.menus             ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.menu_categories   ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.dishes            ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.dish_ingredients  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.option_groups     ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.options           ENABLE ROW LEVEL SECURITY;

-- ---------------------------------------------------------------------------
-- Public read policies for tables that had no RLS before.
-- restaurants/menus/dishes already have "Public read …" from migration 078.
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS "Public read menu_categories"  ON public.menu_categories;
CREATE POLICY "Public read menu_categories"  ON public.menu_categories  FOR SELECT USING (true);

DROP POLICY IF EXISTS "Public read dish_ingredients" ON public.dish_ingredients;
CREATE POLICY "Public read dish_ingredients" ON public.dish_ingredients FOR SELECT USING (true);

DROP POLICY IF EXISTS "Public read option_groups"    ON public.option_groups;
CREATE POLICY "Public read option_groups"    ON public.option_groups    FOR SELECT USING (true);

DROP POLICY IF EXISTS "Public read options"          ON public.options;
CREATE POLICY "Public read options"          ON public.options          FOR SELECT USING (true);

-- ---------------------------------------------------------------------------
-- Restaurants
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS "Owners can insert own restaurants" ON public.restaurants;
CREATE POLICY "Owners can insert own restaurants"
  ON public.restaurants FOR INSERT TO authenticated
  WITH CHECK (owner_id = auth.uid() OR public.is_admin());

DROP POLICY IF EXISTS "Owners can update own restaurants" ON public.restaurants;
CREATE POLICY "Owners can update own restaurants"
  ON public.restaurants FOR UPDATE TO authenticated
  USING      (owner_id = auth.uid() OR public.is_admin())
  WITH CHECK (owner_id = auth.uid() OR public.is_admin());

DROP POLICY IF EXISTS "Owners can delete own restaurants" ON public.restaurants;
CREATE POLICY "Owners can delete own restaurants"
  ON public.restaurants FOR DELETE TO authenticated
  USING (owner_id = auth.uid() OR public.is_admin());

-- ---------------------------------------------------------------------------
-- Menus
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS "Owners can write own menus" ON public.menus;
CREATE POLICY "Owners can write own menus"
  ON public.menus FOR ALL TO authenticated
  USING (
    public.is_admin() OR EXISTS (
      SELECT 1 FROM public.restaurants r
      WHERE r.id = menus.restaurant_id AND r.owner_id = auth.uid()
    )
  )
  WITH CHECK (
    public.is_admin() OR EXISTS (
      SELECT 1 FROM public.restaurants r
      WHERE r.id = menus.restaurant_id AND r.owner_id = auth.uid()
    )
  );

-- ---------------------------------------------------------------------------
-- Menu categories
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS "Owners can write own menu_categories" ON public.menu_categories;
CREATE POLICY "Owners can write own menu_categories"
  ON public.menu_categories FOR ALL TO authenticated
  USING (
    public.is_admin() OR EXISTS (
      SELECT 1 FROM public.menus m
      JOIN public.restaurants r ON r.id = m.restaurant_id
      WHERE m.id = menu_categories.menu_id AND r.owner_id = auth.uid()
    )
  )
  WITH CHECK (
    public.is_admin() OR EXISTS (
      SELECT 1 FROM public.menus m
      JOIN public.restaurants r ON r.id = m.restaurant_id
      WHERE m.id = menu_categories.menu_id AND r.owner_id = auth.uid()
    )
  );

-- ---------------------------------------------------------------------------
-- Dishes
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS "Owners can write own dishes" ON public.dishes;
CREATE POLICY "Owners can write own dishes"
  ON public.dishes FOR ALL TO authenticated
  USING (
    public.is_admin() OR EXISTS (
      SELECT 1 FROM public.restaurants r
      WHERE r.id = dishes.restaurant_id AND r.owner_id = auth.uid()
    )
  )
  WITH CHECK (
    public.is_admin() OR EXISTS (
      SELECT 1 FROM public.restaurants r
      WHERE r.id = dishes.restaurant_id AND r.owner_id = auth.uid()
    )
  );

-- ---------------------------------------------------------------------------
-- Dish ingredients
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS "Owners can write own dish_ingredients" ON public.dish_ingredients;
CREATE POLICY "Owners can write own dish_ingredients"
  ON public.dish_ingredients FOR ALL TO authenticated
  USING (
    public.is_admin() OR EXISTS (
      SELECT 1 FROM public.dishes d
      JOIN public.restaurants r ON r.id = d.restaurant_id
      WHERE d.id = dish_ingredients.dish_id AND r.owner_id = auth.uid()
    )
  )
  WITH CHECK (
    public.is_admin() OR EXISTS (
      SELECT 1 FROM public.dishes d
      JOIN public.restaurants r ON r.id = d.restaurant_id
      WHERE d.id = dish_ingredients.dish_id AND r.owner_id = auth.uid()
    )
  );

-- ---------------------------------------------------------------------------
-- Option groups — keyed on restaurant_id (NOT NULL on every row)
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS "Owners can write own option_groups" ON public.option_groups;
CREATE POLICY "Owners can write own option_groups"
  ON public.option_groups FOR ALL TO authenticated
  USING (
    public.is_admin() OR EXISTS (
      SELECT 1 FROM public.restaurants r
      WHERE r.id = option_groups.restaurant_id AND r.owner_id = auth.uid()
    )
  )
  WITH CHECK (
    public.is_admin() OR EXISTS (
      SELECT 1 FROM public.restaurants r
      WHERE r.id = option_groups.restaurant_id AND r.owner_id = auth.uid()
    )
  );

-- ---------------------------------------------------------------------------
-- Options
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS "Owners can write own options" ON public.options;
CREATE POLICY "Owners can write own options"
  ON public.options FOR ALL TO authenticated
  USING (
    public.is_admin() OR EXISTS (
      SELECT 1 FROM public.option_groups og
      JOIN public.restaurants r ON r.id = og.restaurant_id
      WHERE og.id = options.option_group_id AND r.owner_id = auth.uid()
    )
  )
  WITH CHECK (
    public.is_admin() OR EXISTS (
      SELECT 1 FROM public.option_groups og
      JOIN public.restaurants r ON r.id = og.restaurant_id
      WHERE og.id = options.option_group_id AND r.owner_id = auth.uid()
    )
  );
