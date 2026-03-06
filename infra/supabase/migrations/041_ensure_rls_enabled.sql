-- ============================================================================
-- Migration 041: Ensure RLS is enabled on all application tables
-- ============================================================================
-- Purpose: Idempotent safety net — enabling RLS on a table that already has it
-- enabled is a no-op. This migration audits every known application table and
-- guarantees none were accidentally created without RLS.
--
-- Background: The parallel migration numbering in 006–017 made it impossible to
-- verify RLS coverage by reading migration files alone (S4 from security audit,
-- March 2026).
--
-- Tables deliberately excluded:
--   - spatial_ref_sys   : PostGIS system table, not an application table
--   - security_documentation : read-only reference data, no user rows
-- ============================================================================

-- ── User-facing data tables ──────────────────────────────────────────────────
ALTER TABLE public.users                             ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_preferences                  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_sessions                     ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_swipes                       ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_visits                       ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_points                       ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_behavior_profiles            ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_dish_interactions            ENABLE ROW LEVEL SECURITY;

-- ── Restaurant & menu tables ─────────────────────────────────────────────────
ALTER TABLE public.restaurants                       ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.menus                             ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.menu_categories                   ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.dishes                            ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.dish_categories                   ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.dish_analytics                    ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.dish_photos                       ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.dish_opinions                     ENABLE ROW LEVEL SECURITY;

-- ── Ingredient & allergen reference tables ───────────────────────────────────
-- These are shared reference data; RLS policies allow public SELECT but
-- restrict INSERT/UPDATE/DELETE to service role (admin) only.
ALTER TABLE public.ingredients_master                ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ingredient_aliases                ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ingredient_allergens              ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ingredient_dietary_tags           ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.canonical_ingredients             ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.canonical_ingredient_allergens    ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.canonical_ingredient_dietary_tags ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.allergens                         ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.dietary_tags                      ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.dish_ingredients                  ENABLE ROW LEVEL SECURITY;

-- ── Social & session tables ──────────────────────────────────────────────────
ALTER TABLE public.session_views                     ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.eat_together_sessions             ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.eat_together_members              ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.eat_together_votes                ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.eat_together_recommendations      ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.restaurant_experience_responses   ENABLE ROW LEVEL SECURITY;

-- ── Admin / system tables ────────────────────────────────────────────────────
ALTER TABLE public.admin_audit_log                   ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.menu_scan_jobs                    ENABLE ROW LEVEL SECURITY;

-- ── Favorites (created by 040 or earlier) ────────────────────────────────────
-- favorites table may not exist in all environments; skip gracefully.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'favorites'
  ) THEN
    EXECUTE 'ALTER TABLE public.favorites ENABLE ROW LEVEL SECURITY';
  END IF;
END $$;

-- ── Verification query (run manually to confirm) ─────────────────────────────
-- SELECT tablename, rowsecurity
-- FROM   pg_tables
-- WHERE  schemaname = 'public'
-- ORDER  BY tablename;
-- All application tables should show rowsecurity = true.
