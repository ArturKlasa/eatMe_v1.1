-- 141a_app_config.sql
-- Created: 2026-05-17
--
-- Phase 1 of the dish-model rewrite (docs/plans/dish-model-rewrite-phase-1-database.md §6).
-- Stands up the app_config table that powers the mobile force-upgrade gate
-- needed by Phase 6 (destructive cutover). Building it now so the gate has
-- time to bake before Phase 6 needs it.
--
-- Single-row table — the `id boolean PRIMARY KEY DEFAULT true CHECK (id)`
-- pattern enforces exactly one row, with id=true. Insert is idempotent via
-- ON CONFLICT DO NOTHING so re-applying the migration is a no-op.
--
-- Read access is anonymous (public RLS policy) because the mobile app calls
-- the companion app-config edge function before sign-in. Write access is
-- restricted to the service_role JWT by RLS default (no write policy =
-- denied for authenticated/anon roles).
--
-- Pre-apply checklist:
--   1. Migrations 140 and 141 must be applied first (no cross-dependency,
--      but Phase 1 migrations should land in numeric order).
--   2. After applying, regenerate types:
--        supabase gen types typescript --linked > packages/database/src/types.ts
--   3. The companion app-config edge function + mobile useAppVersionGate
--      hook ship in the next two changes.

BEGIN;

CREATE TABLE IF NOT EXISTS public.app_config (
  id                            boolean     PRIMARY KEY DEFAULT true CHECK (id),
  min_supported_mobile_version  text        NOT NULL,
  latest_mobile_version         text        NOT NULL,
  update_url_ios                text        NOT NULL,
  update_url_android            text        NOT NULL,
  updated_at                    timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.app_config IS
  'Single-row table holding mobile-app version gating + store URLs. Read by '
  'the public app-config edge function on app startup. Mutated only by service-role.';
COMMENT ON COLUMN public.app_config.min_supported_mobile_version IS
  'Floor version — installs below this are force-blocked with the update modal. '
  'Bump only after analytics confirm sufficient penetration of the new build.';
COMMENT ON COLUMN public.app_config.latest_mobile_version IS
  'Most recent published mobile build. Used for the "update available" soft prompt.';

ALTER TABLE public.app_config ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS app_config_read_all ON public.app_config;
CREATE POLICY app_config_read_all ON public.app_config
  FOR SELECT
  USING (true);
-- No write policy: writes require the service-role JWT (RLS bypass).

INSERT INTO public.app_config (
  id,
  min_supported_mobile_version,
  latest_mobile_version,
  update_url_ios,
  update_url_android
) VALUES (
  true,
  '0.0.0',                                          -- floor: open until Phase 5 release
  '0.0.0',                                          -- latest: bump at each release
  'https://apps.apple.com/app/idTBD',
  'https://play.google.com/store/apps/details?id=TBD'
)
ON CONFLICT (id) DO NOTHING;

COMMIT;
