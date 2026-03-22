-- 067_fix_dishes_rls_policies.sql
-- Created: 2026-03-22
--
-- CRITICAL FIX: All dish RLS policies in migration 008a used `dishes.menu_id`,
-- a column that does not exist on the dishes table (the actual column is
-- `menu_category_id`). This meant every policy silently evaluated to false:
--
--   - UPDATE: always 0 rows affected → dietary_tags, allergens, etc. never saved
--   - INSERT: only worked via service_role (menu-scan uses service_role)
--   - SELECT: only worked via a public/anon policy from an earlier migration
--
-- Fix: use dishes.restaurant_id directly (dishes has this column), joining
-- to restaurants to check owner_id. Much simpler and correct.

-- ── DROP all existing policies (both old broken names and new names) ─────────
DROP POLICY IF EXISTS "Admins and owners can view dishes"   ON dishes;
DROP POLICY IF EXISTS "Admins and owners can update dishes" ON dishes;
DROP POLICY IF EXISTS "Admins and owners can insert dishes" ON dishes;
DROP POLICY IF EXISTS "Only admins can delete dishes"       ON dishes;
-- Also drop new names in case migration was partially run before
DROP POLICY IF EXISTS "Owners and admins can view dishes"   ON dishes;
DROP POLICY IF EXISTS "Owners and admins can update dishes" ON dishes;
DROP POLICY IF EXISTS "Owners and admins can insert dishes" ON dishes;

-- ── Re-create with correct logic ─────────────────────────────────────────────

-- SELECT: owners can view their own dishes (consumers see dishes via public/anon policy)
CREATE POLICY "Owners and admins can view dishes"
  ON dishes FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM restaurants r
      WHERE r.id = dishes.restaurant_id
        AND (r.owner_id = auth.uid() OR is_admin())
    )
  );

-- UPDATE: owners can update their own dishes
CREATE POLICY "Owners and admins can update dishes"
  ON dishes FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM restaurants r
      WHERE r.id = dishes.restaurant_id
        AND (r.owner_id = auth.uid() OR is_admin())
    )
  );

-- INSERT: owners can insert dishes for their restaurants
CREATE POLICY "Owners and admins can insert dishes"
  ON dishes FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM restaurants r
      WHERE r.id = dishes.restaurant_id
        AND (r.owner_id = auth.uid() OR is_admin())
    )
  );

-- DELETE: only admins can delete dishes
CREATE POLICY "Only admins can delete dishes"
  ON dishes FOR DELETE
  TO authenticated
  USING (is_admin());
