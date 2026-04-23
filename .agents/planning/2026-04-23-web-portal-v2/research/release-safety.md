# Release Safety Runbook — EatMe Web Portal v2

Compiled: 2026-04-23. Format: **runbook**. Every command is copy-paste intended; every SQL snippet targets the live schema as documented in `frozen-surface.md` (F-S) and `prior-work-consolidation.md` (P-W).

> Scope: the coordinated deploy of v2's additive DB migrations + Edge Function patches + mobile filter patches + RLS tightening + new portal apps. Consumer-mobile must never be broken between any two adjacent phases.

---

## 1. Release overview — one page

**Phases (strict order; only mobile-patch can float within its window):**

```
Phase 0  Pre-flight audits               (read-only, gates Phase 1)
           │
           ▼
Phase 1  Additive migration pack         (DB: status columns, menu_scan_jobs ext, RLS on jobs, new fns)
           │   ── after this: consumer app identical. Drafts do not yet exist because UI can't create them.
           ▼
Phase 2  Edge Function patches           (nearby-restaurants, feed, group-recommendations; generate_candidates via migration)
           │   ── filters are defensive; all rows still = 'published', behaviour unchanged.
           ▼
Phase 3  Mobile patch deploy (floating)  (6 call-sites get .eq('status','published'))
           │   ── can ship any time between Phase 1 and Phase 4; defense-in-depth only.
           ▼
Phase 4  RLS tightening                  (USING(true) → USING(status='published') on 3 tables) — ONE-WAY DOOR
           │   ── gated by re-run of Phase 0 audit + Phase 3 mobile in production.
           ▼
Phase 5  v2 web portal + admin deploy    (apps/web-portal-v2 + apps/admin go live; v1 remains until DNS flip)
           │   ── first chance for drafts to be created. RLS already protects consumers.
           ▼
         DNS cutover (separate ticket, post-soak)
```

**Dependencies:**

- Phase 0 → 1: Phase 1 must not proceed if any draft-visible row already exists with non-`published` state.
- Phase 1 must precede Phase 2: Edge Function patches reference `status` columns that Phase 1 adds.
- Phase 2 must precede Phase 4: consumer endpoints must filter before RLS deletes rows out from under them.
- Phase 3 must precede Phase 4 **in production** (not staging): mobile explicit filters ship before RLS hides drafts, so a stale mobile build never sees a SELECT-returns-zero surprise.
- Phase 4 before Phase 5: drafts must be invisible to consumers before v2 is allowed to create them.
- `115_tighten_dish_kind_check.sql` (P-W §2.1 step 6) must be run in prod **before Phase 1**.

---

## 2. Phase 0 — Pre-flight audits

Read-only checks against **production** Supabase. All must return green before Phase 1.

### 2.1 Row-count audits

Expected: all `0`. Nonzero = STOP, investigate.

```sql
-- A. restaurants that would become hidden under v2's 'published' rule
--    Live predicate today (per generate_candidates, get_group_candidates): r.is_active = true
--    v2 predicate: status='published'
--    Expectation post-Phase-1: every row defaults to 'published' so this is 0 unless we explicitly backfill
SELECT count(*) AS would_disappear_restaurants
FROM public.restaurants
WHERE is_active = true
  AND coalesce(status, 'published') <> 'published';

-- B. menus belonging to is_active restaurants that would become hidden
SELECT count(*) AS would_disappear_menus
FROM public.menus m
JOIN public.restaurants r ON r.id = m.restaurant_id
WHERE r.is_active = true
  AND coalesce(m.status, 'published') <> 'published';

-- C. dishes that should already be 'published' per migration 114 default but aren't
SELECT count(*) AS legacy_non_published_dishes
FROM public.dishes
WHERE status <> 'published';

-- D. confirm every existing dish has a status at all (NOT NULL from mig 114, but paranoia-check)
SELECT count(*) AS dish_rows_with_null_status FROM public.dishes WHERE status IS NULL;
```

### 2.2 `is_active` / `suspended_*` inventory

`restaurants.is_active` coexists with new `status` (F-S §6). Count overlap:

```sql
SELECT
  count(*) FILTER (WHERE is_active = true)  AS active_live,
  count(*) FILTER (WHERE is_active = false) AS suspended_count,
  count(*) FILTER (WHERE suspended_at IS NOT NULL) AS ever_suspended
FROM public.restaurants;
```

### 2.3 RLS policy inventory

Current clauses from F-S §7 / `078_fix_stale_rls_policies.sql:27-29`:

```sql
CREATE POLICY "Public read restaurants" ON public.restaurants FOR SELECT USING (true);
-- identical shape for "Public read menus", "Public read dishes"
```

Owner ALL-writes live at `091_content_rls_owner_writes.sql:67,72,78,86,126` — keep as-is.

Live verification:

```sql
SELECT schemaname, tablename, policyname, cmd, qual, with_check
FROM pg_policies
WHERE schemaname = 'public'
  AND tablename IN ('restaurants', 'menus', 'dishes', 'menu_scan_jobs')
ORDER BY tablename, policyname;
```

Expected: three `USING (true)` SELECT policies + owner policies on the three tables; **zero** policies on `menu_scan_jobs` (F-S §7).

### 2.4 `menu_scan_jobs` RLS + publication state

```sql
SELECT relname, relrowsecurity, relforcerowsecurity FROM pg_class WHERE relname = 'menu_scan_jobs';

SELECT pubname, schemaname, tablename
FROM pg_publication_tables
WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'menu_scan_jobs';
```

Phase 1 makes both explicit regardless of current state.

### 2.5 Mobile release-train check

```bash
cd /home/art/Documents/eatMe_v1/apps/mobile && eas build:list --limit 5 --status in-progress
# Also: check Play / App Store review state of last-submitted build.
```

Gate: any in-flight build without the Phase 3 patch blocks **Phase 4 only**. Phases 1–3 proceed regardless.

### 2.6 Go/no-go printout

Paste into release ticket:

```
Phase 0 Pre-flight — <date> <time> UTC — run by <name>

[ ] A. would_disappear_restaurants          = ___  (must = 0)
[ ] B. would_disappear_menus                = ___  (must = 0)
[ ] C. legacy_non_published_dishes          = ___  (must = 0; mig 114 default)
[ ] D. dish_rows_with_null_status           = ___  (must = 0)
[ ] E. restaurants.is_active inventory      = active=___, suspended=___
[ ] F. Policies match expected snapshot     (paste pg_policies output)
[ ] G. menu_scan_jobs RLS state             = relrowsecurity=___  publication=___
[ ] H. Mobile in-flight build without patch = none / <build-id, ETA>

VERDICT: GO / NO-GO
```

If any check fails, **do not run Phase 1**. Failure of A/B/C = backfill or explicit decision needed; failure of F = schema drift, stop and reconcile.

---

## 3. Phase 1 — Additive migration pack (backwards-compatible)

After Phase 1 runs: no user-visible change. Consumer mobile still reads exactly the same rows.

### 3.1 Migration files (numbering continues from `115_tighten_dish_kind_check.sql`)

| # | Filename (proposed) | Purpose | Reversible? | Notes |
|---|---|---|---|---|
| 116 | `116_restaurant_menu_status.sql` | Add `status` + index to `restaurants`, `menus` | Yes (drop column) | Cheap rollback while no app code depends on it |
| 117 | `117_menu_scan_jobs_v2_columns.sql` | Add `input jsonb`, `attempts int`, `locked_until timestamptz` | Yes (drop columns) | |
| 118 | `118_menu_scan_jobs_rls.sql` | Enable RLS + owner/admin/service policies | Yes but data-risky | If we rollback after v2 writes jobs, unauthenticated reads resume briefly |
| 119 | `119_menu_scan_jobs_realtime.sql` | `ALTER PUBLICATION supabase_realtime ADD TABLE public.menu_scan_jobs` | Yes (DROP TABLE from pub) | See §10 risk re: brief subscription churn |
| 120 | `120_generate_candidates_status_filter.sql` | `CREATE OR REPLACE FUNCTION generate_candidates` adding status filter | Yes (re-run prior 114 body) | Counts as Phase 2 semantically; ships as a migration though. See §4 |
| 121 | `121_status_helper_functions.sql` | Stubs for `publish_restaurant_draft(uuid)` + `confirm_menu_scan(uuid,jsonb,text)` | Yes (DROP FUNCTION) | Stubs only; bodies land with v2 app code |

### 3.2 Column additions (migration 116)

```sql
-- migration 116_restaurant_menu_status.sql
ALTER TABLE public.restaurants
  ADD COLUMN status text NOT NULL DEFAULT 'published'
    CHECK (status IN ('draft','published','archived'));
CREATE INDEX IF NOT EXISTS idx_restaurants_status ON public.restaurants(status);

ALTER TABLE public.menus
  ADD COLUMN status text NOT NULL DEFAULT 'published'
    CHECK (status IN ('draft','published','archived'));
CREATE INDEX IF NOT EXISTS idx_menus_status ON public.menus(status);
```

**Rollback cost:** reversible via `ALTER TABLE ... DROP COLUMN status` on each table. Cheap while no app code has written non-default values. **Becomes one-way** the first time v2 writes a draft row.

**Why safe:** every existing row defaults to `'published'`. Live consumer queries do not yet filter on `status`, so behavior is identical. `dishes.status` already exists (mig 114); this equalises the three tables.

### 3.3 `menu_scan_jobs` extension (migration 117)

Per F-S §8 the table already has `created_by`, `result_json`, and image metadata. Add:

```sql
-- migration 117_menu_scan_jobs_v2_columns.sql
ALTER TABLE public.menu_scan_jobs
  ADD COLUMN input        jsonb,
  ADD COLUMN attempts     integer NOT NULL DEFAULT 0,
  ADD COLUMN locked_until timestamptz;

CREATE INDEX IF NOT EXISTS idx_menu_scan_jobs_status
  ON public.menu_scan_jobs(status);
CREATE INDEX IF NOT EXISTS idx_menu_scan_jobs_locked_until
  ON public.menu_scan_jobs(locked_until)
  WHERE status IN ('processing','needs_review');
```

**`created_by` → `owner_id` decision:** **do not rename.** FK `ON DELETE SET NULL` from mig 087 + v1 handlers (`apps/web-portal/app/api/menu-scan/route.ts`, `apps/web-portal/app/admin/menu-scan/hooks/useJobQueue.ts`) reference it. v2 adopts `created_by` as the canonical owner reference. Document in `agent_docs/database.md`.

**`result_json` stays** as the canonical result column. No rename. v2 reads `result_json` directly.

**Rollback:** `DROP COLUMN`. One-way once v2 confirm-RPC writes `input`/`attempts`.

### 3.4 `menu_scan_jobs` RLS (migration 118)

RLS is currently dashboard-toggled (F-S §7). Make it explicit:

```sql
-- migration 118_menu_scan_jobs_rls.sql
ALTER TABLE public.menu_scan_jobs ENABLE ROW LEVEL SECURITY;

-- Owner of the job (created_by) sees their own jobs
CREATE POLICY "Owner reads own menu_scan_jobs"
  ON public.menu_scan_jobs
  FOR SELECT
  USING (
    created_by = auth.uid()
    OR public.is_admin()
    OR EXISTS (
      SELECT 1 FROM public.restaurants r
      WHERE r.id = menu_scan_jobs.restaurant_id
        AND r.owner_id = auth.uid()
    )
  );

CREATE POLICY "Owner inserts own menu_scan_jobs"
  ON public.menu_scan_jobs
  FOR INSERT
  WITH CHECK (
    created_by = auth.uid()
    OR public.is_admin()
    OR EXISTS (
      SELECT 1 FROM public.restaurants r
      WHERE r.id = menu_scan_jobs.restaurant_id
        AND r.owner_id = auth.uid()
    )
  );

CREATE POLICY "Owner updates own menu_scan_jobs"
  ON public.menu_scan_jobs
  FOR UPDATE
  USING (
    created_by = auth.uid()
    OR public.is_admin()
    OR EXISTS (
      SELECT 1 FROM public.restaurants r
      WHERE r.id = menu_scan_jobs.restaurant_id
        AND r.owner_id = auth.uid()
    )
  );
-- Service role bypasses RLS implicitly; no policy needed for worker.
```

**Rollback cost:** reversible via `DISABLE ROW LEVEL SECURITY` + `DROP POLICY`. **Operational risk on rollback:** if RLS was previously disabled, un-enabling restores the prior anon-readable state which may not be what you want. Before enabling, ensure no long-lived anon client depends on reading `menu_scan_jobs`. F-S confirms mobile does not touch this table.

### 3.5 Realtime publication (migration 119)

```sql
-- migration 119_menu_scan_jobs_realtime.sql
ALTER PUBLICATION supabase_realtime ADD TABLE public.menu_scan_jobs;
```

**Rollback cost:** `ALTER PUBLICATION supabase_realtime DROP TABLE public.menu_scan_jobs;`. Risk: active Realtime subscribers see a brief re-init when publication changes — see §10 risk 3.

### 3.6 Stub functions (migration 121)

```sql
-- migration 121_status_helper_functions.sql
CREATE OR REPLACE FUNCTION public.publish_restaurant_draft(p_restaurant_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- STUB: full body lands with v2 app code (design phase).
  -- Will atomically flip restaurants + menus + dishes from 'draft' → 'published'
  -- gated on owner_id = auth.uid() OR is_admin().
  RAISE EXCEPTION 'publish_restaurant_draft not yet implemented';
END;
$$;

CREATE OR REPLACE FUNCTION public.confirm_menu_scan(
  p_job_id uuid,
  p_payload jsonb,
  p_idempotency_key text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- STUB: full body lands with v2 app code (design phase).
  -- Will dedup on idempotency_key, bulk-insert dishes, update job.status.
  RAISE EXCEPTION 'confirm_menu_scan not yet implemented';
END;
$$;

REVOKE ALL ON FUNCTION public.publish_restaurant_draft(uuid) FROM public;
REVOKE ALL ON FUNCTION public.confirm_menu_scan(uuid, jsonb, text) FROM public;
GRANT EXECUTE ON FUNCTION public.publish_restaurant_draft(uuid)      TO authenticated;
GRANT EXECUTE ON FUNCTION public.confirm_menu_scan(uuid, jsonb, text) TO authenticated;
```

**Rollback cost:** `DROP FUNCTION`. Cheap while stubbed. **One-way** once v2 app invokes them with real payloads.

### 3.7 One-way-door flags (Phase 1)

- 118 RLS-enable on `menu_scan_jobs` is practically one-way because re-opening anon reads is a security regression you would not want to roll back to.
- 116/117 additions become one-way at first v2 write of a non-default value.

---

## 4. Phase 2 — Edge Function patches (backwards-compatible)

All filters added here match the post-Phase-1 state where every row = `'published'`, so the filter is a no-op until v2 starts creating drafts. This is why Phase 2 is safe to ship before Phase 5.

### 4.1 `supabase/functions/nearby-restaurants/index.ts`

**Current query shape** (F-S §5.1, lines 180–201):

```ts
let query = supabase
  .from('restaurants')
  .select(`
    *,
    menus (
      id, name, is_active,
      dishes (id, name, price, dietary_tags, allergens, spice_level, is_available)
    )
  `)
  .order('created_at', { ascending: false });
```

**New query shape:**

```ts
let query = supabase
  .from('restaurants')
  .select(`
    *,
    menus!inner (
      id, name, is_active, status,
      dishes!inner (
        id, name, price, dietary_tags, allergens, spice_level, is_available, status
      )
    )
  `)
  .eq('status', 'published')
  .eq('menus.status', 'published')
  .eq('menus.dishes.status', 'published')
  .order('created_at', { ascending: false });
```

**Why this doesn't break live mobile:** after Phase 1, every row has `status='published'`, so the `.eq(...)` filters are tautological. The only behavioral change is that draft rows (which don't yet exist) are hidden once v2 starts creating them.

**Rollback:** revert the function to the prior shape via `supabase functions deploy nearby-restaurants` with the old source. No data change.

### 4.2 `supabase/functions/feed/index.ts`

Two surfaces:

**(a) `rpc('generate_candidates')` call** (F-S §5.2 line 582): **no Edge-Function change**. Patch is delivered via migration 120 (§4.4 below) to `generate_candidates` SQL.

**(b) Auxiliary direct query** (F-S §5.2 line 694):

```ts
// Current
.from('restaurants').select('id, open_hours').in('id', allRids)

// New
.from('restaurants').select('id, open_hours, status').eq('status', 'published').in('id', allRids)
```

**Why safe:** `allRids` already came from `generate_candidates` which will (post-migration-120) only return published rows. Double-filter is defense-in-depth and cheap.

**Rollback:** revert function.

### 4.3 `supabase/functions/group-recommendations/index.ts`

The function itself calls `rpc('get_group_candidates')` (F-S §5.3 lines 326, 337) via **service-role client** — RLS does not save us here. Patch lives in a SQL migration (§4.4) that rewrites `get_group_candidates`.

**No Edge Function code change** for this one. Out-of-scope note: `get_group_candidates` also lacks `d.is_template = false` today (F-S §5.3) — pre-existing template-leakage bug, flagged per §10.

### 4.4 Migration 120 — `generate_candidates` + `get_group_candidates` status filter

Single migration updating both RPCs with identical shape. Use `CREATE OR REPLACE FUNCTION` preserving the full signature from `114_ingestion_rework.sql:200-422` and `088_group_candidates_open_now.sql:58-170`.

For `generate_candidates` — existing WHERE clause (quoted from `114:305-316`):

```sql
WHERE
  r.is_active = true
  AND ST_DWithin(r.location_point, ST_SetSRID(ST_MakePoint(p_lng, p_lat), 4326)::geography, p_radius_m)
  AND d.is_available = true
  AND d.is_parent = false
  AND d.is_template = false
  AND (dc.id IS NULL OR dc.is_drink = false)
  AND (m.id IS NULL OR m.menu_type = 'food')
  AND (dc.id IS NULL OR lower(dc.name) <> 'dessert')
  ...
```

Add three AND clauses:

```sql
  AND r.status = 'published'
  AND (m.id IS NULL OR m.status = 'published')
  AND d.status = 'published'
```

For `get_group_candidates` (`088:106-142`): similarly add `AND r.status='published' AND m.status='published' AND d.status='published'`. Optionally also add the missing `AND d.is_template = false` — but that's a separate decision (see §10 risk 2).

**Why safe:** all rows default `status='published'` after Phase 1. Zero behaviour change until drafts exist.

**Rollback:** re-run the prior definition from migration 114 / 088 via a reverse migration. Keep `120_revert_generate_candidates.sql` pre-written and tagged "REVERSE ONLY IF PHASE 4 FAILS".

### 4.5 Phase 2 summary table

| File / Object | Change | Rollback |
|---|---|---|
| `nearby-restaurants/index.ts` | Top-level `.eq('status','published')` + nested `!inner` with status filter | Redeploy prior version |
| `feed/index.ts` (aux query line 694) | Add `.eq('status','published')` | Redeploy prior version |
| `feed/index.ts` (main RPC) | No code change; delivered by migration 120 | See 120 rollback |
| `group-recommendations/index.ts` | No code change; delivered by migration 120 | See 120 rollback |
| migration 120 | `CREATE OR REPLACE` both RPCs with status filter | Reverse migration (pre-written) |

---

## 5. Phase 3 — Mobile patch deploy

Per F-S §1 the rough-idea under-counts. The full patch list is **6 queries across 3 files** (not just `restaurantStore.ts`).

### 5.1 Exact call-sites

| File:line | Table(s) | Change | Effect |
|---|---|---|---|
| `apps/mobile/src/stores/restaurantStore.ts:126` | `restaurants` (+ nested `menus`, `dishes`) | Add `.eq('status', 'published')` + use `!inner` on nested to cascade | List/browse path |
| `apps/mobile/src/stores/restaurantStore.ts:159` | `dishes` | Add `.eq('status', 'published')` (also `.eq('is_template', false)` is a bonus — but scope-of-v2 is just `status`) | Nearby dishes fetch |
| `apps/mobile/src/stores/restaurantStore.ts:269` | `restaurants` (+ nested `menus`) | `.eq('status','published')` on top-level + nested `!inner ... status='published'` | Single-restaurant detail |
| `apps/mobile/src/stores/restaurantStore.ts:312` | `menu_categories` (+ nested `dishes`) | `.eq('dishes.status','published')` nested filter | Category detail |
| `apps/mobile/src/hooks/useDish.ts:41` | `dishes` | `.eq('status','published')` on the single-row fetch | Dish detail; RLS will also catch after Phase 4 |
| `apps/mobile/src/screens/BasicMapScreen.tsx:491` | `dishes` (with `menu_categories!inner(restaurant_id)`) | `.eq('status','published')` on the dish select | Post-rating recent-viewed flow |

### 5.2 Release notes

> **Changelog line:** "Defense-in-depth: explicit `status='published'` filters on direct Supabase queries. No user-visible change. Prepares mobile for upcoming web-portal v2 draft-state feature."

### 5.3 Timing

- Can ship anytime after Phase 1 has run in production.
- **Must** ship in production (via EAS + app-store review completion) before Phase 4 runs. A stale mobile build would still work thanks to RLS catching the drafts, but the explicit-filter-first posture is what the rough-idea promises ("defense in depth").
- Not gated by v2 web portal launch. Can front-run v2 by weeks.

---

## 6. Phase 4 — RLS tightening (the one-way door)

This is the scariest phase. If any unaccounted row has `status != 'published'`, it disappears from the consumer app the instant the migration commits.

### 6.1 Pre-flight gate

Re-run every check in §2.1 within 15 minutes of executing Phase 4. All must be 0 except the admin-suspension inventory (which v2 explicitly tolerates). If any row has `status <> 'published'` unexpectedly, **abort**.

```sql
-- Aggregate gate — all three must be 0
SELECT
  (SELECT count(*) FROM public.restaurants WHERE status <> 'published') AS restaurants_non_published,
  (SELECT count(*) FROM public.menus       WHERE status <> 'published') AS menus_non_published,
  (SELECT count(*) FROM public.dishes      WHERE status <> 'published') AS dishes_non_published;
```

If the v2 app has been soft-launched in staging against prod DB (it shouldn't be), drafts may legitimately exist. Review with the owner before proceeding.

### 6.2 Migration text — one migration, three policies

```sql
-- migration 122_tighten_public_read_rls.sql

-- Preserve owner/admin access by creating a SECOND SELECT policy before dropping the old one.
-- Postgres policies combine with OR, so owner/admin keep full access via the new owner-SELECT policies.

-- --- restaurants ---
DROP POLICY IF EXISTS "Public read restaurants" ON public.restaurants;

CREATE POLICY "Public read published restaurants"
  ON public.restaurants
  FOR SELECT
  USING (status = 'published');

CREATE POLICY "Owners and admins read own restaurants"
  ON public.restaurants
  FOR SELECT
  USING (owner_id = auth.uid() OR public.is_admin());

-- --- menus ---
DROP POLICY IF EXISTS "Public read menus" ON public.menus;

CREATE POLICY "Public read published menus"
  ON public.menus
  FOR SELECT
  USING (
    status = 'published'
    AND EXISTS (
      SELECT 1 FROM public.restaurants r
      WHERE r.id = menus.restaurant_id
        AND r.status = 'published'
    )
  );

CREATE POLICY "Owners and admins read own menus"
  ON public.menus
  FOR SELECT
  USING (
    public.is_admin()
    OR EXISTS (
      SELECT 1 FROM public.restaurants r
      WHERE r.id = menus.restaurant_id
        AND r.owner_id = auth.uid()
    )
  );

-- --- dishes ---
DROP POLICY IF EXISTS "Public read dishes" ON public.dishes;

CREATE POLICY "Public read published dishes"
  ON public.dishes
  FOR SELECT
  USING (
    status = 'published'
    AND EXISTS (
      SELECT 1 FROM public.restaurants r
      WHERE r.id = dishes.restaurant_id
        AND r.status = 'published'
    )
  );

CREATE POLICY "Owners and admins read own dishes"
  ON public.dishes
  FOR SELECT
  USING (
    public.is_admin()
    OR EXISTS (
      SELECT 1 FROM public.restaurants r
      WHERE r.id = dishes.restaurant_id
        AND r.owner_id = auth.uid()
    )
  );
```

### 6.3 Observability

Before-deploy: take a 30-minute baseline of:
- `nearby-restaurants` p95 latency + error rate (Supabase logs dashboard)
- `feed` p95 + error rate
- `group-recommendations` p95 + error rate
- Mobile Sentry / crash rate from the latest released build
- Row-returns count from `nearby-restaurants` (mean per request)

After-deploy: watch the same metrics for the next 60 minutes. Triggers for rollback:
- Any consumer Edge Function error-rate spike >2× baseline.
- `nearby-restaurants` average row count drops >5% (shouldn't — everything is `'published'`).
- Mobile crash rate spike.

### 6.4 Rollback — pre-written reverse migration

Keep `122_REVERSE_ONLY_restore_public_read.sql` in the repo, uncommitted-to-prod, but ready. Tag it clearly:

```sql
-- REVERSE ONLY IF PHASE 4 FAILS.
-- Do NOT merge/run in ordinary sequence.
DROP POLICY IF EXISTS "Public read published restaurants" ON public.restaurants;
DROP POLICY IF EXISTS "Owners and admins read own restaurants" ON public.restaurants;
CREATE POLICY "Public read restaurants" ON public.restaurants FOR SELECT USING (true);

DROP POLICY IF EXISTS "Public read published menus" ON public.menus;
DROP POLICY IF EXISTS "Owners and admins read own menus" ON public.menus;
CREATE POLICY "Public read menus" ON public.menus FOR SELECT USING (true);

DROP POLICY IF EXISTS "Public read published dishes" ON public.dishes;
DROP POLICY IF EXISTS "Owners and admins read own dishes" ON public.dishes;
CREATE POLICY "Public read dishes" ON public.dishes FOR SELECT USING (true);
```

Time-to-rollback: **sub-60-seconds** via `supabase db execute`. Data loss risk: **zero** (policies are metadata; no row touched).

### 6.5 One-way-ness

Technically reversible via §6.4, but once v2 app is **live and creating drafts**, reverting RLS would expose those drafts to anon SELECT. In that state, rollback requires either (a) flipping all drafts to `archived` first, or (b) accepting temporary draft-leakage. **Treat Phase 4 + Phase 5 together as the irreversible door.**

---

## 7. Phase 5 — v2 web portal + admin deploy

### 7.1 What ships

- `apps/web-portal-v2/` built + deployed to a **staging Vercel project** first (e.g., `web-portal-v2-staging.vercel.app`), then to a **separate production Vercel project** with a canary domain (`v2.portal.eatme.app` or similar).
- `apps/admin/` deployed to its own Vercel project with middleware-gated `app_metadata.role='admin'` matcher (P-W §4 item 7).
- `apps/web-portal/` (v1) **stays deployed and live** at its current production URL.

### 7.2 Domain / cutover plan

Two options, pick one per stakeholder decision:

**Option A — Subdomain canary:** v2 lives on `v2.portal.eatme.app`; v1 stays on `portal.eatme.app`. Direct owners to v2 via email + signed-in banner on v1. DNS flip (v1 URL → v2 origin) happens as a separate ticket after ≥7 day soak with zero P1 regressions.

**Option B — Path-based split behind a feature flag:** single domain, Vercel rewrite rule sends `/v2/*` to v2, everything else to v1. Simpler DNS but couples deploys. Less clean for rollback.

**Recommendation:** Option A. Cleaner rollback (swap DNS back), cleaner analytics (separate hosts), no risk of v1-v2 cookie/session collisions.

### 7.3 Rollback

If v2 breaks post-launch: flip DNS back to v1. Supabase data remains (drafts stay as drafts, invisible to consumers). Any partially-onboarded owners lose their v2 session but the DB rows persist (see rough-idea line 143 — "DB is the source of truth").

---

## 8. Per-phase rollback matrix

| Phase | Rollback mechanism | Time-to-rollback | Data-loss risk | User-facing impact during rollback |
|---|---|---|---|---|
| 0 | N/A (read-only audit) | — | none | none |
| 1 / mig 116 | `ALTER TABLE ... DROP COLUMN status` | <2 min | none (column is new) | none until v2 writes a draft |
| 1 / mig 117 | `ALTER TABLE menu_scan_jobs DROP COLUMN input, attempts, locked_until` | <2 min | none until v2 writes to them | none |
| 1 / mig 118 | `DISABLE ROW LEVEL SECURITY; DROP POLICY ...` | <1 min | re-exposes table to anon, security regression | none for mobile (doesn't read), bad for portal |
| 1 / mig 119 | `ALTER PUBLICATION supabase_realtime DROP TABLE public.menu_scan_jobs` | <1 min | Realtime subscribers disconnect once | v2 admin/scan UI loses live updates |
| 1 / mig 121 | `DROP FUNCTION publish_restaurant_draft; DROP FUNCTION confirm_menu_scan` | <1 min | none (stubs) | none |
| 2 / Edge functions | `supabase functions deploy <fn>` with prior source | 2–5 min | none | none (filter is tautological pre-drafts) |
| 2 / mig 120 | Re-run prior-version `CREATE OR REPLACE FUNCTION` (pre-written) | <1 min | none | none |
| 3 / mobile | Revert commit, new EAS build + store re-submission | **hours-to-days** (app-store review) | none | users on new build keep seeing published-only (safe); users on old build see what RLS lets them see |
| 4 / mig 122 | Pre-written REVERSE migration (§6.4) | <1 min | none immediately; post-Phase-5 would expose drafts to anon | none if rolled back immediately; bad if v2 drafts already exist |
| 5 / v2 apps | DNS flip back to v1 domain | 5–30 min (DNS TTL) | none (v2 drafts persist as DB rows, still hidden from consumer by Phase 4 RLS) | owners routed back to v1; any in-progress v2 onboarding is preserved in DB but not accessible via v1 UI |

**Hardest rollback:** Phase 3 (mobile). Everything else is fast. Plan accordingly — Phase 3 **must** be in production before Phase 4.

---

## 9. Automated verification tests

### 9.1 Shape of tests

**Test A — "Drafts are never visible to consumers"** (rough-idea line 224).

- Location: `apps/web-portal-v2/tests/e2e/draft-invisibility.spec.ts` (Playwright against staging) or `apps/web-portal-v2/tests/integration/consumer-endpoints-hide-drafts.test.ts` (Vitest + Supabase service-role setup).
- Setup: service-role client creates a restaurant with `status='draft'`, a menu with `status='draft'`, and a dish with `status='draft'` under it.
- Assertion suite (must all pass):
  1. Anon `.from('restaurants').select().eq('id', draftId).maybeSingle()` returns `null`.
  2. Anon `supabase.functions.invoke('nearby-restaurants', { body: { latitude, longitude, radiusKm: 50 } })` — draft restaurant not in response.
  3. Anon `supabase.functions.invoke('feed', ...)` — draft dish not in response.
  4. Anon `supabase.functions.invoke('group-recommendations', ...)` — draft not in response.
  5. Mobile-shape query: `supabase.from('dishes').select('*, menu_category:menu_categories(restaurant:restaurants(*))').eq('id', draftDishId).maybeSingle()` returns `null`.
  6. Negative: after flipping the restaurant to `status='published'`, all five queries return the row. (Confirms the test isn't vacuously passing.)

**Test B — "Published data still renders identically."**

- Location: `apps/web-portal-v2/tests/integration/consumer-endpoints-published-parity.test.ts`.
- Snapshot approach: pre-Phase-4 snapshot of `nearby-restaurants` / `feed` / `group-recommendations` response shapes for a fixed fixture restaurant. Post-Phase-4, re-run and diff. Diff must be empty (ignoring non-deterministic fields like `distance_m` if applicable).

**Test C — Mobile regression suite.**

- Location: `apps/mobile/e2e/` (Detox or Maestro — v1 has zero E2E per rough-idea line 222).
- Against staging post-Phase-4. Covers: nearby list, map pins, dish detail, group recommendations, eat-together session.
- Manual smoke acceptable for v2 launch if Detox scaffold isn't ready; document as follow-up.

**Test D — CI-gated auth-wrapper check.**

- Location: `apps/web-portal-v2/scripts/check-auth-wrappers.ts` (TS script) + wired into `turbo lint`.
- Walks every `app/api/*/route.ts` and Server Action file; fails CI if any export is not wrapped in `withAuth` / `withAdminAuth` / `withPublic`. Per rough-idea line 153 + P-W §4 item 2.

**Test E — Mobile staging smoke against live Phase-4 RLS.**

- Manual or scripted Maestro flow: launch staging mobile build → open map → open a restaurant → open a dish → verify no crashes. Required gate for Phase 4 sign-off.

### 9.2 Don't write them yet

These are **test-shapes** only. Bodies are deferred to the test-writing phase. The location tree is:

```
apps/web-portal-v2/
  tests/
    e2e/
      draft-invisibility.spec.ts          (A)
      onboarding-happy-path.spec.ts       (Playwright; rough-idea line 222)
      menu-scan-happy-path.spec.ts
    integration/
      consumer-endpoints-hide-drafts.test.ts       (A)
      consumer-endpoints-published-parity.test.ts  (B)
  scripts/
    check-auth-wrappers.ts                (D)
apps/mobile/
  e2e/
    nearby-map-smoke.spec.ts              (C)
    dish-detail-smoke.spec.ts             (C)
```

---

## 10. Risks and mitigations

### Risk 1 — `is_active` vs `status` coexistence

`restaurants.is_active` (admin suspension) and `restaurants.status` (owner draft/publish lifecycle) are **two orthogonal axes** (F-S §6 "Surprise"). Their combination:

| is_active | status | Consumer visibility | Owner visibility |
|---|---|---|---|
| true | published | visible | editable |
| true | draft | invisible | editable |
| true | archived | invisible | read-only archive |
| false | published | invisible (suspended) | editable by owner; admin-flagged |
| false | draft | invisible (both axes hide) | editable |
| false | archived | invisible | read-only |

**Design constraint for v2 owner UI:** surface **both** flags separately. A "suspended but published" restaurant is invisible to consumers but the owner needs to see *why* (suspended_at + reason). A "draft" restaurant is also invisible but for a different reason (not yet published). Confusing these breaks owner trust. Call out this constraint in the v2 UI spec.

**Mitigation:** owner dashboard displays a status badge per restaurant with 4 possible states: `Draft`, `Live`, `Suspended (by admin)`, `Archived`. A single `isDiscoverable(r)` helper in `@eatme/shared` encapsulates the `is_active && status === 'published'` rule for both apps.

### Risk 2 — `get_group_candidates()` template leakage (pre-existing)

F-S §5.3: `get_group_candidates` does not filter `d.is_template = false`. **Out of v2 scope** per the task brief, but flag it in the release ticket. Templates are not currently visible via this path only because the content + discoverability pipeline has not yet produced template-marked rows under published restaurants; once v2 starts allowing `configurable + is_template=true` shells, this becomes a user-visible bug.

**Recommendation:** open a follow-up ticket `fix(rpc): add is_template=false filter to get_group_candidates` scheduled within two weeks of v2 launch. Low-risk `CREATE OR REPLACE FUNCTION`.

### Risk 3 — Realtime publication add for `menu_scan_jobs`

F-S §9: no migrations currently touch `supabase_realtime`. Adding a table does **not** require downtime — the replication slot absorbs the new publication member without dropping existing subscriptions. However:

- Subscribers reading `menu_scan_jobs` via dashboard-toggled publication (state uncertain per §2.4) may see a brief re-init.
- Table is owner×scan-session sized (≪10K rows) so the catch-up snapshot is trivial.

**Mitigation:** run migration 119 in a low-traffic window; subscribers with a "stream gap" resubscribe and replay `updated_at > last_seen`.

### Risk 4 (NEW) — `menus!inner` cascade in `nearby-restaurants` patch drops zero-menu restaurants

§4.1's patch changes `menus (...)` → `menus!inner (..., status)`. `!inner` is an INNER JOIN: restaurants with zero menus disappear from the consumer feed the moment the patch deploys — **before** RLS would have hidden them.

**Add to §2.1 pre-flight:**

```sql
SELECT count(*) AS active_restaurants_no_menus
FROM public.restaurants r
WHERE r.is_active = true
  AND NOT EXISTS (SELECT 1 FROM public.menus m WHERE m.restaurant_id = r.id);
```

If > 0, **do not `!inner`** the `menus` embed; filter only at the top-level `restaurants` and let Phase 4 RLS enforce nested status. Document the chosen approach in the Phase 2 design commit.

Not mentioned in rough-idea or P-W — this is the genuine new gotcha. Zero-menu restaurants are a normal mid-onboarding state in v1 and will be even more common in v2 (first-time draft creation).

---

## Appendix — Phase checklist summary

- [ ] Phase 0: audits A/B/C/D/E/F/G/H (§2.6). VERDICT=GO.
- [ ] Phase 0 addendum: Risk-4 zero-menus check (§10 Risk 4).
- [ ] Phase 0: 115_tighten_dish_kind_check.sql confirmed run in prod (P-W §2.1 step 6).
- [ ] Phase 1: migrations 116–121 deployed in order.
- [ ] Phase 1 verify: `pg_policies` shows owner policies intact + new `menu_scan_jobs` policies exist.
- [ ] Phase 2: Edge Function redeploys (`nearby-restaurants`, `feed`). Migration 120 for RPCs.
- [ ] Phase 2 verify: smoke query via anon key returns same row count as pre-Phase-2.
- [ ] Phase 3: mobile patch merged + EAS build + store submitted + **published** (not just submitted).
- [ ] Phase 3 verify: new build ID noted; old build deprecation schedule set.
- [ ] Phase 4 gate: re-run §2.1 queries; all zero.
- [ ] Phase 4: migration 122 deployed. 60-min observability window green.
- [ ] Phase 4 verify: test A/B pass; manual mobile-staging smoke passes.
- [ ] Phase 5: v2 portal + admin deployed to separate domains.
- [ ] Phase 5 verify: signup → onboard → scan → publish → re-edit Playwright green.
- [ ] Post-launch: schedule follow-up ticket for Risk 2 (`get_group_candidates` template filter).

_End runbook._
