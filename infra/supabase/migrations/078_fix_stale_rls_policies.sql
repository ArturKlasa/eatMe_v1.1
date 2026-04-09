-- Migration 078: Drop stale permissive RLS policies from migration 005
-- These policies were not correctly dropped by migration 008a (wrong names used),
-- causing them to OR-merge with stricter 008a/067 policies and grant excess permissions.

-- Drop stale 005 policies on restaurants
DROP POLICY IF EXISTS "Anyone can read restaurants" ON restaurants;
DROP POLICY IF EXISTS "Users can create restaurants" ON restaurants;
DROP POLICY IF EXISTS "Users can update own restaurants" ON restaurants;
DROP POLICY IF EXISTS "Users can delete own restaurants" ON restaurants;

-- Drop stale 005 policies on menus
DROP POLICY IF EXISTS "Anyone can read menus" ON menus;
DROP POLICY IF EXISTS "Users can create menus for own restaurants" ON menus;
DROP POLICY IF EXISTS "Users can update own restaurant menus" ON menus;
DROP POLICY IF EXISTS "Users can delete own restaurant menus" ON menus;

-- Drop stale 005 policies on dishes
DROP POLICY IF EXISTS "Anyone can read dishes" ON dishes;
DROP POLICY IF EXISTS "Users can create dishes for own restaurants" ON dishes;
DROP POLICY IF EXISTS "Users can update own restaurant dishes" ON dishes;
DROP POLICY IF EXISTS "Users can delete own restaurant dishes" ON dishes;

-- Re-create public read policies so consumer-facing reads continue to work
DROP POLICY IF EXISTS "Public read restaurants" ON restaurants;
DROP POLICY IF EXISTS "Public read menus" ON menus;
DROP POLICY IF EXISTS "Public read dishes" ON dishes;
CREATE POLICY "Public read restaurants" ON restaurants FOR SELECT USING (true);
CREATE POLICY "Public read menus" ON menus FOR SELECT USING (true);
CREATE POLICY "Public read dishes" ON dishes FOR SELECT USING (true);
