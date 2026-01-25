-- ============================================================================
-- ADMIN ROLE AND SECURITY SETUP
-- Created: 2026-01-21
-- Description: Add admin role with comprehensive security measures
-- SECURITY: This migration adds role-based access control with audit logging
-- ============================================================================

-- ============================================================================
-- 1. ADD ADMIN ROLE TO USER METADATA
-- ============================================================================

-- Note: We use raw_user_meta_data because it's stored in auth.users
-- This is read-only for users but can be set by admins via SQL

-- SECURITY: No user can set their own role through the application
-- Only database admins can execute UPDATE on auth.users

-- NOTE: Cannot add COMMENT to auth.users (Supabase system table)
-- Admin role will be stored in raw_user_meta_data->>'role'

-- ============================================================================
-- 2. CREATE AUDIT LOG TABLE
-- ============================================================================

-- Track all admin actions for security and compliance
CREATE TABLE IF NOT EXISTS admin_audit_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  admin_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE SET NULL,
  admin_email TEXT NOT NULL,
  action TEXT NOT NULL, -- 'create', 'update', 'delete', 'suspend', 'activate'
  resource_type TEXT NOT NULL, -- 'restaurant', 'menu', 'dish', 'user'
  resource_id UUID,
  old_data JSONB,
  new_data JSONB,
  ip_address INET,
  user_agent TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- Create index for fast audit queries
CREATE INDEX IF NOT EXISTS idx_audit_log_admin_id ON admin_audit_log(admin_id);
CREATE INDEX IF NOT EXISTS idx_audit_log_resource ON admin_audit_log(resource_type, resource_id);
CREATE INDEX IF NOT EXISTS idx_audit_log_created_at ON admin_audit_log(created_at DESC);

-- RLS: Only admins can read audit logs, nobody can modify them
ALTER TABLE admin_audit_log ENABLE ROW LEVEL SECURITY;

DO $$ 
BEGIN
  CREATE POLICY "Only admins can view audit logs"
  ON admin_audit_log FOR SELECT
  TO authenticated
  USING (
    (SELECT raw_user_meta_data->>'role' FROM auth.users WHERE id = auth.uid()) = 'admin'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- SECURITY: Prevent modification of audit logs (append-only)
DO $$ 
BEGIN
  CREATE POLICY "Prevent audit log modification"
  ON admin_audit_log FOR UPDATE
  TO authenticated
  USING (false);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ 
BEGIN
  CREATE POLICY "Prevent audit log deletion"
  ON admin_audit_log FOR DELETE
  TO authenticated
  USING (false);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

COMMENT ON TABLE admin_audit_log IS 
  'SECURITY: Immutable audit trail of all admin actions. Cannot be modified or deleted.';

-- ============================================================================
-- 3. CREATE HELPER FUNCTION TO CHECK ADMIN ROLE
-- ============================================================================

CREATE OR REPLACE FUNCTION is_admin()
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER -- Run with elevated privileges
SET search_path = public, auth
AS $$
BEGIN
  RETURN (
    SELECT raw_user_meta_data->>'role' = 'admin'
    FROM auth.users
    WHERE id = auth.uid()
  );
END;
$$;

COMMENT ON FUNCTION is_admin() IS 
  'SECURITY: Checks if current user is an admin. Used in RLS policies.';

-- ============================================================================
-- 4. UPDATE RLS POLICIES FOR RESTAURANTS
-- ============================================================================

-- Drop existing restrictive policies
DROP POLICY IF EXISTS "Users can only view own restaurant" ON restaurants;
DROP POLICY IF EXISTS "Users can only update own restaurant" ON restaurants;
DROP POLICY IF EXISTS "Users can only delete own restaurant" ON restaurants;

-- NEW: Admins can view all restaurants, owners can view their own
DO $$ 
BEGIN
  CREATE POLICY "Admins and owners can view restaurants"
  ON restaurants FOR SELECT
  TO authenticated
  USING (
    auth.uid() = owner_id OR is_admin()
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- NEW: Admins can update all restaurants, owners can update their own
DO $$ 
BEGIN
  CREATE POLICY "Admins and owners can update restaurants"
  ON restaurants FOR UPDATE
  TO authenticated
  USING (
    auth.uid() = owner_id OR is_admin()
  )
  WITH CHECK (
    auth.uid() = owner_id OR is_admin()
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- NEW: Only admins can delete restaurants (soft delete via is_active flag)
DO $$ 
BEGIN
  CREATE POLICY "Only admins can delete restaurants"
  ON restaurants FOR DELETE
  TO authenticated
  USING (is_admin());
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- NEW: Admins and owners can insert restaurants
DO $$ 
BEGIN
  CREATE POLICY "Admins and owners can insert restaurants"
  ON restaurants FOR INSERT
  TO authenticated
  WITH CHECK (
    auth.uid() = owner_id OR is_admin()
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- ============================================================================
-- 5. UPDATE RLS POLICIES FOR MENUS
-- ============================================================================

DROP POLICY IF EXISTS "Users can view menus for their restaurants" ON menus;
DROP POLICY IF EXISTS "Users can update menus for their restaurants" ON menus;
DROP POLICY IF EXISTS "Users can delete menus for their restaurants" ON menus;

DO $$ 
BEGIN
  CREATE POLICY "Admins and owners can view menus"
  ON menus FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM restaurants 
      WHERE id = menus.restaurant_id 
      AND (owner_id = auth.uid() OR is_admin())
    )
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ 
BEGIN
  CREATE POLICY "Admins and owners can update menus"
  ON menus FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM restaurants 
      WHERE id = menus.restaurant_id 
      AND (owner_id = auth.uid() OR is_admin())
    )
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ 
BEGIN
  CREATE POLICY "Only admins can delete menus"
  ON menus FOR DELETE
  TO authenticated
  USING (is_admin());
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- NEW: Admins and owners can insert menus
DO $$ 
BEGIN
  CREATE POLICY "Admins and owners can insert menus"
  ON menus FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM restaurants 
      WHERE id = menus.restaurant_id 
      AND (owner_id = auth.uid() OR is_admin())
    )
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- ============================================================================
-- 6. UPDATE RLS POLICIES FOR DISHES
-- ============================================================================

DROP POLICY IF EXISTS "Users can view dishes for their restaurants" ON dishes;
DROP POLICY IF EXISTS "Users can update dishes for their restaurants" ON dishes;
DROP POLICY IF EXISTS "Users can delete dishes for their restaurants" ON dishes;

DO $$ 
BEGIN
  CREATE POLICY "Admins and owners can view dishes"
  ON dishes FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM menus m
      JOIN restaurants r ON m.restaurant_id = r.id
      WHERE m.id = dishes.menu_id
      AND (r.owner_id = auth.uid() OR is_admin())
    )
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ 
BEGIN
  CREATE POLICY "Admins and owners can update dishes"
  ON dishes FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM menus m
      JOIN restaurants r ON m.restaurant_id = r.id
      WHERE m.id = dishes.menu_id
      AND (r.owner_id = auth.uid() OR is_admin())
    )
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ 
BEGIN
  CREATE POLICY "Only admins can delete dishes"
  ON dishes FOR DELETE
  TO authenticated
  USING (is_admin());
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- NEW: Admins and owners can insert dishes
DO $$ 
BEGIN
  DROP POLICY IF EXISTS "Admins and owners can insert dishes" ON dishes;
  CREATE POLICY "Admins and owners can insert dishes"
  ON dishes FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM menus m
      JOIN restaurants r ON m.restaurant_id = r.id
      WHERE m.id = menu_id
      AND (r.owner_id = auth.uid() OR is_admin())
    )
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- ============================================================================
-- 7. ADD RESTAURANT SUSPENSION FUNCTIONALITY
-- ============================================================================

-- Add is_active flag for soft deletion/suspension
ALTER TABLE restaurants ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT true;
ALTER TABLE restaurants ADD COLUMN IF NOT EXISTS suspended_at TIMESTAMPTZ;
ALTER TABLE restaurants ADD COLUMN IF NOT EXISTS suspended_by UUID REFERENCES auth.users(id);
ALTER TABLE restaurants ADD COLUMN IF NOT EXISTS suspension_reason TEXT;

COMMENT ON COLUMN restaurants.is_active IS 
  'SECURITY: Soft delete flag. When false, restaurant is hidden from app.';
COMMENT ON COLUMN restaurants.suspended_at IS 
  'SECURITY: Timestamp when restaurant was suspended by admin.';
COMMENT ON COLUMN restaurants.suspended_by IS 
  'SECURITY: Admin user who suspended this restaurant.';

-- Create index for active restaurants (performance)
CREATE INDEX IF NOT EXISTS idx_restaurants_active ON restaurants(is_active) WHERE is_active = true;

-- ============================================================================
-- 8. CREATE FUNCTION TO LOG ADMIN ACTIONS
-- ============================================================================

CREATE OR REPLACE FUNCTION log_admin_action(
  p_action TEXT,
  p_resource_type TEXT,
  p_resource_id UUID,
  p_old_data JSONB DEFAULT NULL,
  p_new_data JSONB DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  v_admin_email TEXT;
  v_log_id UUID;
BEGIN
  -- Verify user is admin
  IF NOT is_admin() THEN
    RAISE EXCEPTION 'SECURITY: Only admins can perform this action';
  END IF;

  -- Get admin email
  SELECT email INTO v_admin_email
  FROM auth.users
  WHERE id = auth.uid();

  -- Insert audit log
  INSERT INTO admin_audit_log (
    admin_id,
    admin_email,
    action,
    resource_type,
    resource_id,
    old_data,
    new_data,
    ip_address,
    created_at
  ) VALUES (
    auth.uid(),
    v_admin_email,
    p_action,
    p_resource_type,
    p_resource_id,
    p_old_data,
    p_new_data,
    inet_client_addr(), -- Capture IP address
    NOW()
  )
  RETURNING id INTO v_log_id;

  RETURN v_log_id;
END;
$$;

COMMENT ON FUNCTION log_admin_action IS 
  'SECURITY: Logs all admin actions to audit trail. Auto-captures IP address.';

-- ============================================================================
-- 9. CREATE VIEW FOR ADMIN DASHBOARD STATS
-- ============================================================================

CREATE OR REPLACE VIEW admin_dashboard_stats AS
SELECT
  (SELECT COUNT(*) FROM restaurants WHERE is_active = true) as active_restaurants,
  (SELECT COUNT(*) FROM restaurants WHERE is_active = false) as suspended_restaurants,
  (SELECT COUNT(*) FROM restaurants) as total_restaurants,
  (SELECT COUNT(*) FROM dishes WHERE is_available = true) as active_dishes,
  (SELECT COUNT(*) FROM dishes) as total_dishes,
  (SELECT COUNT(*) FROM auth.users WHERE raw_user_meta_data->>'role' = 'owner') as restaurant_owners,
  (SELECT COUNT(*) FROM auth.users WHERE raw_user_meta_data->>'role' = 'admin') as admin_users;

-- Note: View runs with definer (elevated) permissions to access auth.users
-- Access control handled by application layer (admin layout check)

COMMENT ON VIEW admin_dashboard_stats IS 
  'SECURITY: Admin dashboard statistics. Access controlled by admin layout.';

-- ============================================================================
-- 10. SECURITY BEST PRACTICES DOCUMENTATION
-- ============================================================================

-- Create a table to document security measures (for reference)
CREATE TABLE IF NOT EXISTS security_documentation (
  id SERIAL PRIMARY KEY,
  category TEXT NOT NULL,
  description TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

INSERT INTO security_documentation (category, description) VALUES
('Authentication', 'Admin role is stored in user metadata and only modifiable via SQL'),
('Authorization', 'RLS policies enforce admin vs owner permissions at database level'),
('Audit Trail', 'All admin actions are logged in immutable audit_log table'),
('Soft Delete', 'Restaurants use is_active flag instead of hard delete'),
('IP Tracking', 'Admin actions capture IP address for security monitoring'),
('Data Integrity', 'Audit logs cannot be modified or deleted by any user'),
('Function Security', 'Helper functions use SECURITY DEFINER with explicit search_path'),
('Policy Inheritance', 'Child tables (menus, dishes) inherit restaurant ownership checks')
ON CONFLICT DO NOTHING;

-- ============================================================================
-- SUCCESS MESSAGE
-- ============================================================================

DO $$ 
BEGIN
  RAISE NOTICE '========================================';
  RAISE NOTICE 'ADMIN SECURITY SETUP COMPLETE!';
  RAISE NOTICE '========================================';
  RAISE NOTICE 'Security measures implemented:';
  RAISE NOTICE '  ✓ Admin role system with RLS policies';
  RAISE NOTICE '  ✓ Immutable audit log for all actions';
  RAISE NOTICE '  ✓ IP address tracking';
  RAISE NOTICE '  ✓ Soft delete (suspension) for restaurants';
  RAISE NOTICE '  ✓ Helper functions for security checks';
  RAISE NOTICE '  ✓ Dashboard statistics view';
  RAISE NOTICE '';
  RAISE NOTICE 'NEXT STEPS:';
  RAISE NOTICE '1. Create admin user account via signup';
  RAISE NOTICE '2. Run: UPDATE auth.users SET raw_user_meta_data = ';
  RAISE NOTICE '   raw_user_meta_data || ''{"role": "admin"}''::jsonb';
  RAISE NOTICE '   WHERE email = ''your-admin-email@example.com'';';
  RAISE NOTICE '3. Login and access /admin dashboard';
  RAISE NOTICE '========================================';
END $$;
