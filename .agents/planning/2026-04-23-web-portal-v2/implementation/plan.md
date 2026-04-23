# EatMe Web Portal v2 — Implementation Plan

- [x] Step 1: Scaffold `apps/web-portal-v2/` and `apps/admin/` Next.js 16 projects + `@eatme/ui` shared package
- [x] Step 2: Auth wrappers, DAL, `no-unwrapped-action` ESLint rule, `@eatme/database/web` factories
- [x] Step 3: Shared Zod schemas, types, and helpers in `@eatme/shared` for v2
- [x] Step 4: Per-app `proxy.ts` via `createAuthProxy` factory, Supabase client helpers, Providers shell
- [x] Step 5: Migration 116a — storage buckets + policies (`menu-scan-uploads`, `restaurant-photos`, `dish-photos`)
- [x] Step 6: Migrations 116+117 — `status` columns on `restaurants` and `menus` + indexes
- [x] Step 7: Migrations 118+119 — extend `menu_scan_jobs`, enable RLS, add to Realtime publication
- [x] Step 8: Migration 120 — `publish_restaurant_draft` Postgres function
- [x] Step 9: Migration 121 — `menu_scan_confirmations` side-table + `confirm_menu_scan` + worker helpers
- [x] Step 10: Migration 122 — `generate_candidates` + `get_group_candidates` status filters
- [x] Step 11: Patch `nearby-restaurants` + `feed` Edge Functions with `status='published'` filters
- [x] Step 12: Release-safety CI tests — drafts-never-visible + pre/post-Phase-4 parity
- [ ] Step 13: Mobile defense-in-depth `.eq('status','published')` patches (6 sites, 3 files)
- [ ] Step 14: Owner app auth pages, sign-in/sign-up, DAL wire-up, `/onboard` skeleton
- [ ] Step 15: Restaurant draft CRUD Server Actions + `/restaurant/[id]` basic-info form
- [ ] Step 16: Onboarding stepper overlay + Location + Hours + Cuisines + Photos steps
- [ ] Step 17: Menu + category + dish CRUD (5-kind dish form, discriminated-union validation)
- [ ] Step 18: Publish flow — `publish_restaurant_draft` call + Realtime broadcast + unpublish/archive
- [ ] Step 19: `menu-scan-worker` Edge Function + `pg_cron` schedule + OpenAI integration
- [ ] Step 20: Owner menu-scan upload UI — `browser-image-compression` + direct Storage upload + job insert
- [ ] Step 21: Owner menu-scan review + confirm — Realtime subscription + category assignment + `confirm_menu_scan`
- [ ] Step 22: Admin app auth shell, proxy, restaurant browse + search
- [ ] Step 23: Admin restaurant edit (admin-only fields: `is_active`, suspension) + audit log writes
- [ ] Step 24: Admin menu-scan power tool — batch upload, raw prompt/response inspector, replay
- [ ] Step 25: Admin bulk import — CSV + Google Places + `admin_audit_log` viewer
- [ ] Step 26: Playwright gold paths — signup/onboard, menu-scan, publish Realtime, admin CSV
- [ ] Step 27: Migration 123 — RLS tightening (the one-way door)
- [ ] Step 28: Canary deploy to `v2.portal.eatme.app` + admin subdomain + 7-day soak + DNS cutover ticket

---

## Intro

This plan sequences the v2 rebuild into 28 demoable, test-gated steps. **It is not a replacement for the spec** — `design/detailed-design.md` is authoritative; this plan references sections by number (§1.1, §5.2, etc.) rather than re-specifying content. The six-phase runbook in `research/release-safety.md` defines strict ordering between DB migrations, Edge Function patches, mobile patches, RLS tightening, and app deploy; steps here are slotted into those phases.

The plan is organised into eight phase groupings:

- **A. Foundation** (Steps 1–4) — monorepo scaffold, auth wrappers, DAL, shared Zod, per-app proxy
- **B. Migrations — additive** (Steps 5–10) — Phase 1 of the runbook: storage buckets, status columns, jobs table extension + RLS + publication, new Postgres functions, candidate-RPC patches
- **C. Edge Function patches** (Steps 11–12) — Phase 2 of the runbook + CI release-safety tests
- **D. Mobile patches** (Step 13) — Phase 3 of the runbook
- **E. Owner app** (Steps 14–18) — draft CRUD, onboarding, menus, dishes, publish; core end-to-end lands at Step 18
- **F. Menu scan end-to-end** (Steps 19–21) — worker + cron, owner upload, owner review/confirm
- **G. Admin app** (Steps 22–25) — auth shell, restaurants, scan power tool, bulk imports
- **H. E2E + release** (Steps 26–28) — Playwright, Phase 4 (the one-way door), Phase 5 canary

Every step includes its own tests (unit, integration, or E2E scaffold) in the same commit — no deferred "add tests later" steps.

---

## A. Foundation

## Step 1: Scaffold `apps/web-portal-v2/` and `apps/admin/` Next.js 16 projects + `@eatme/ui` shared package

### Objective

Stand up two empty Next.js 16 apps and a new shared UI package inside the existing pnpm + Turborepo monorepo, with Tailwind v4, TypeScript, and shadcn wiring pointed at the shared package.

### Implementation guidance

- Create `apps/web-portal-v2/` and `apps/admin/` using `create-next-app` with `--app --ts --tailwind --no-eslint` (we apply the shared ESLint config in Step 2). App Router only. See design §4.1 tree for the owner app and §4.2 for the admin app.
- Create `packages/ui/` per design §4.3 (components.json, `src/styles/globals.css`, `src/components/ui/`, `src/components/compose/`). Do not port any concrete shadcn components in this step — just the scaffolding plus a single `Button` as a smoke-test component.
- Each app's `next.config.ts` lists `@eatme/shared`, `@eatme/database`, `@eatme/tokens`, `@eatme/ui` in `transpilePackages` and sets `images.remotePatterns` to `*.supabase.co` per design §4.3 + research `nextjs-foundation §7`.
- Each app's `app/globals.css` imports `@eatme/ui/styles/globals.css` (which in turn imports `tailwindcss` and `@eatme/tokens/tokens.css`). No per-app `tailwind.config.*` file — Tailwind v4 is CSS-driven.
- Root `package.json` workspaces already include `apps/*` and `packages/*` — no change required. Root `turbo.json` gets `web-portal-v2` and `admin` pipelines for `dev`, `build`, `lint`, `check-types`, `test`.
- Add a placeholder `app/page.tsx`, `app/layout.tsx`, `app/loading.tsx`, `app/error.tsx` (client), `app/not-found.tsx` per Next 16 conventions in both apps. Each `error.tsx` carries the `'use client'` directive.
- Each app's `tsconfig.json` extends `tsconfig.base.json` and sets path alias `@/*` → `src/*`. `@eatme/ui` uses `components.json` paths `@eatme/ui/components/ui/*`.
- Pin engines in root `package.json`: Node `>=20.9`, pnpm `>=10.x`, TypeScript `>=5.1` per `nextjs-foundation §1`.
- Do **not** introduce Cache Components, React Compiler, or Turbopack filesystem cache — all deferred per design §2.6.

### Test requirements

- `turbo build` succeeds for both new apps (empty page renders without type errors).
- `turbo check-types` passes across the whole repo (mobile + web-portal v1 unaffected).
- `packages/ui/` exports a `Button` component importable by both apps; a Vitest smoke test imports it without runtime error.
- `turbo dev --filter web-portal-v2` serves `http://localhost:3000/` and returns HTTP 200 with the placeholder text.
- CI job additions: `turbo build --filter web-portal-v2 --filter admin --filter @eatme/ui` is green.

### Integration

First foundation step; nothing depends on prior v2 work. Mobile + v1 web-portal remain untouched. After this step, every subsequent step can `import` from `@eatme/ui` and place files under `apps/web-portal-v2/src/...` or `apps/admin/src/...`.

### Demo

Running `pnpm --filter web-portal-v2 dev` serves a blank "EatMe v2" landing page styled with the shared `Button` component at `http://localhost:3000/`. Same for `pnpm --filter admin dev` on port 3001.

### Commit convention

`feat(v2): scaffold web-portal-v2 + admin Next.js 16 apps and @eatme/ui package (plan step 1)`

---

## Step 2: Auth wrappers, DAL, `no-unwrapped-action` ESLint rule, `@eatme/database/web` factories

### Objective

Ship the load-bearing auth abstractions — typed Server Action / Route Handler wrappers, a DAL for RSC auth, a CI-enforced ESLint rule that rejects unwrapped handlers — plus the new web-only Supabase client factories in `@eatme/database/web`.

### Implementation guidance

- In `packages/database/src/web.ts` add the three factories (`createBrowserClient`, `createServerClient`, `createServerActionClient`) per design §4.3 and `nextjs-foundation §5`. Expose via a new `exports` entry `./web` in `packages/database/package.json`. Mobile's `getMobileClient` is **not touched** (frozen-for-shape per design §2.4).
- In `apps/web-portal-v2/src/lib/supabase/server.ts` and `browser.ts`, thin wrappers that close over `cookies()` / `process.env.NEXT_PUBLIC_*` (design §4.3 end of block explains why env reads must be app-local). Mirror in `apps/admin/src/lib/supabase/`.
- In `apps/web-portal-v2/src/lib/auth/wrappers.ts` ship `withAuth`, `withAdminAuth`, `withPublic` returning `ActionResult<T>` per `nextjs-foundation §3` and design §4.1. `route-wrappers.ts` ships `withAuthRoute`/`withAdminAuthRoute`/`withPublicRoute`. Mirror in admin app (admin app mostly uses `withAdminAuth`).
- Admin checks read **only** `user.app_metadata.role === 'admin'` via `isAdmin()` from `@eatme/shared` (added in Step 3). Never `user_metadata`. `nextjs-foundation §3` + `prior-work-consolidation §4` item 2.
- `src/lib/auth/dal.ts` ships `verifySession` (owner app) and `verifyAdminSession` (admin app), each wrapped in React `cache()`, calling `supabase.auth.getClaims()` for the fast path and redirecting on failure. Wrappers use `getUser()` for the authoritative remote check.
- In `packages/eslint-config-eatme/` add a new rule `no-unwrapped-action`: any non-type export from `app/**/actions/*.ts` or `app/**/route.ts` must be a `CallExpression` whose callee identifier is one of the approved wrappers. Ship a rule tester (`packages/eslint-config-eatme/rules/no-unwrapped-action.test.ts`) covering positive + negative fixtures.
- Also ship `scripts/check-auth-wrappers.ts` in both apps (`apps/web-portal-v2/scripts/check-auth-wrappers.ts` + `apps/admin/scripts/check-auth-wrappers.ts`). It walks `app/**/actions/*.ts` and `app/**/route.ts`, extracts every non-type export, and determines whether the export's RHS is a call expression with an approved wrapper callee. Output: a markdown table to stdout with columns `File | Export | Wrapper | Status` (Status ∈ `OK`, `MISSING`, `WRONG_TYPE`). Non-zero exit only when `--strict` is passed (useful for ad-hoc ops checks); default runs are informational.
- Hook the script into a new `turbo audit` task (not `turbo lint`) as a non-gating step — ESLint remains the CI gate. Each app's `package.json` gets `"audit:auth": "tsx scripts/check-auth-wrappers.ts"`, and the root `turbo.json` adds an `audit` pipeline. CI posts the table as a PR comment on pushes to main; local devs run `turbo audit` when triaging wrapper drift.
- Add the new rule to both apps' ESLint configs via preset extension. CI fails on violations.

### Test requirements

- Vitest unit tests for `withAuth`/`withAdminAuth` happy / unauthenticated / forbidden paths; mock `supabase.auth.getUser()` at module scope. Assert `ActionResult` shape for each branch.
- Vitest unit tests for `verifySession`/`verifyAdminSession`: happy path (user + admin role), redirect path (no user), admin-redirect path (authed non-admin).
- ESLint rule tests: valid fixtures (wrapped export) pass; invalid fixtures (bare `export async function POST`, `export const saveFoo = async (...) => ...`) fail with the documented message. Run via `pnpm --filter @eatme/eslint-config-eatme test`.
- `turbo lint` fails in CI if a test fixture file with an unwrapped handler is placed in either app.
- `packages/database/src/web.ts` has a smoke test that both `createServerClient` and `createServerActionClient` return objects with `.auth`, `.from`, `.rpc`, `.storage`, `.channel` present. No live Supabase call.

### Integration

Builds on Step 1's app scaffolding. Wrappers and DAL are imported by **every** subsequent owner-app and admin-app step — nothing is orphaned. The ESLint rule gates all later handler additions.

### Demo

Adding an unwrapped `export async function POST()` in `apps/web-portal-v2/app/api/demo/route.ts` and running `turbo lint` fails with `no-unwrapped-action: route handler POST must be wrapped in withAuthRoute / withAdminAuthRoute / withPublicRoute`. Wrapping it turns the error off.

### Commit convention

`feat(v2): auth wrappers + DAL + no-unwrapped-action lint rule + database/web factories (plan step 2)`

---

## Step 3: Shared Zod schemas, types, and helpers in `@eatme/shared` for v2

### Objective

Add v2-specific types, Zod schemas, and helpers to `@eatme/shared` — additively — so both apps and future Postgres-facing code import them from a single source.

### Implementation guidance

- Add to `packages/shared/src/types/restaurant.ts`: `RestaurantStatus`, `MenuStatus`, `MenuScanJobStatus` per design §5.5. `DishStatus` already exists from v1 — keep as is.
- New file `packages/shared/src/logic/discoverability.ts` — `isDiscoverable(r)` per design §5.5. Unit-tested pure helper.
- New file `packages/shared/src/logic/role.ts` — `isAdmin(user)` reading only `app_metadata.role`.
- New file `packages/shared/src/validation/publish.ts` — `publishPayloadSchema` (design §5.5).
- New file `packages/shared/src/validation/menuScan.ts` — `menuScanJobInputSchema` and `confirmMenuScanPayloadSchema` (design §5.5). `dish_kind` enum already lives in shared via `DISH_KIND_META`; reference it, do not redefine.
- New file `packages/shared/src/validation/dish.ts` — discriminated union per `nextjs-foundation §4` and design §4.1 form pattern. Branches on `dish_kind` for the five kinds. `allergens`/`dietary_tags` default `[]` per `small-memos G2` + design §2.7.
- Extend `packages/shared/src/validation/restaurant.ts` — add `restaurantDraftSchema` for draft-state CRUD (subset of existing `restaurantDataSchema` allowing partials on some fields while NOT relaxing required-for-publish fields). Name `restaurantPublishableSchema` for the stricter "ready to publish" shape.
- New file `packages/shared/src/auth/proxy.ts` — `createAuthProxy` factory per `nextjs-foundation §7` and design §3.1. Imported by each app's `proxy.ts` in Step 4.
- Re-export all new symbols via `packages/shared/src/index.ts`. **No renames, no removals** — mobile's three frozen imports (`POPULAR_CUISINES`, `ALL_CUISINES`, `PRIMARY_PROTEINS`) keep their shape per design §2.4 and `frozen-surface §2`.

### Test requirements

- Vitest: `isDiscoverable` — all four `(is_active, status)` combinations match design §10 Risk 1 table.
- Vitest: `isAdmin` — `app_metadata.role === 'admin'` returns true; `user_metadata.role === 'admin'` returns false; missing metadata returns false.
- Vitest: each new Zod schema has positive + negative fixtures. `confirmMenuScanPayloadSchema` tests include dish-kind enum validation (only 5 values accepted; `'template'`, `'combo'`, `'experience'` all rejected).
- Vitest: `dishSchema` discriminated union narrows correctly — `parsed.data.dish_kind === 'configurable'` TypeScript-narrows to include `slots` property; `'buffet'` does not.
- `turbo check-types` passes; mobile's import of `PRIMARY_PROTEINS` still resolves.

### Integration

Depends on Step 1 (package exists). Consumed by Step 2's wrappers (`isAdmin`), Step 4's proxies (`createAuthProxy`), Steps 8/9/15/17/18/21 (validation schemas), and the release-safety tests in Step 12.

### Demo

In a Node REPL: `import { confirmMenuScanPayloadSchema } from '@eatme/shared'; confirmMenuScanPayloadSchema.parse({ job_id: crypto.randomUUID(), idempotency_key: 'abcdefghij', dishes: [...] })` returns a typed object. Parsing with `dish_kind: 'template'` throws with a field-scoped Zod error.

### Commit convention

`feat(v2): add RestaurantStatus/MenuStatus/MenuScanJobStatus types, isDiscoverable, isAdmin, publish + menuScan Zod schemas (plan step 3)`

---

## Step 4: Per-app `proxy.ts` via `createAuthProxy` factory, Supabase client helpers, Providers shell

### Objective

Wire each new app's root `proxy.ts` to the shared factory, add the TanStack Query provider shell, and finalise `src/lib/supabase/server.ts` + `browser.ts` so later steps can read/write the DB.

### Implementation guidance

- `apps/web-portal-v2/proxy.ts` imports `createAuthProxy` from `@eatme/shared` (Step 3). Matcher excludes `_next/static`, `_next/image`, `favicon.ico`, and static assets per design §3.1. `appRoutes: ['/onboard', '/restaurant', '/profile']`, `authRoutes: ['/signin', '/signup']`. No admin paths in owner app.
- `apps/admin/proxy.ts` uses the factory with `appRoutes: ['/restaurants', '/menu-scan', '/imports', '/audit']`, `authRoutes: ['/signin']`, `adminOnly: ['/']` — the matcher covers everything except `_next/*` and `/signin`. Non-admins are redirected to `/signin?forbidden=1` (design §2.2 last paragraph). The proxy is a UX affordance only; `withAdminAuth` + DAL + RLS remain the gates.
- `src/lib/query/client.ts` in owner app (and admin app) — the `isServer`-aware singleton from `nextjs-foundation §6`. Shared default `staleTime: 60_000`.
- `src/components/Providers.tsx` — `'use client'`, wraps children in `QueryClientProvider`. Owner app's root `layout.tsx` renders `<Providers>{children}</Providers>`.
- Owner app's `(app)/layout.tsx` calls `verifySession()` and renders the signed-in shell (sidebar + topbar placeholder). Unauthed callers get redirected by the DAL; the proxy has already filtered most non-auth traffic.
- Admin app's `(admin)/layout.tsx` calls `verifyAdminSession()`.
- Both apps add `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY` to `.env.local.example` with the staging values committed as placeholders. Real values are set in Vercel.

### Test requirements

- Playwright smoke (owner): hitting `/onboard` unauthenticated redirects to `/signin?redirect=%2Fonboard`. Uses a dev server + an anon Supabase client.
- Playwright smoke (admin): hitting `/` as unauthenticated gets `/signin?forbidden=1`. Signing in as a non-admin user (via seeded fixture) lands on `/signin?forbidden=1`.
- Vitest: `createAuthProxy` unit tests — URL rewrite + cookie-set behaviour for `appRoutes` / `authRoutes` / `adminOnly`, via mocked `NextRequest`.
- `turbo build` succeeds; no `use client` boundaries leak into RSC pages.

### Integration

Closes the Foundation phase. Builds on Steps 1–3. After this step, every future owner-app page can be an RSC that calls `verifySession()` and every future admin page `verifyAdminSession()` — no extra boilerplate.

### Demo

Running `pnpm --filter web-portal-v2 dev`, opening `/onboard` in a private tab, the user is redirected to `/signin?redirect=%2Fonboard`. After signing in with a staging test user, they land back on `/onboard` with a placeholder shell rendered.

### Commit convention

`feat(v2): wire per-app proxy.ts, TanStack Query providers, RSC-side DAL layout guards (plan step 4)`

---

## B. Migrations — additive (Phase 1 of runbook)

## Step 5: Migration 116a — storage buckets + policies (`menu-scan-uploads`, `restaurant-photos`, `dish-photos`)

### Objective

Add the three Storage buckets v2 depends on, with owner-scoped RLS policies, via the first migration in the v2 pack. Buckets were dashboard-toggled historically and are not migration-tracked; this closes that gap before any app code writes to them.

### Implementation guidance

- File: `supabase/migrations/116a_storage_buckets.sql`. Number `116a` reserves the `116` slot for the restaurants status migration (Step 6) — see design §8.2 reconciliation note ("use the design's 116–123 sequence, add `116a` for storage buckets").
- `INSERT INTO storage.buckets (id, name, public) VALUES ('menu-scan-uploads','menu-scan-uploads', false), ('restaurant-photos','restaurant-photos', true), ('dish-photos','dish-photos', true) ON CONFLICT DO NOTHING;` Public flag chosen per design §4.1 photo rendering (photos load via `next/image` + `images.remotePatterns: *.supabase.co`); scan uploads stay private.
- Policies — for each bucket add an `INSERT` policy (authenticated `WITH CHECK (auth.uid() IS NOT NULL AND owner path prefix)`), an authenticated-`SELECT` policy restricted to owner (or admin), and for `restaurant-photos` / `dish-photos` an anon-`SELECT` policy `USING (true)` because they render in the consumer mobile app.
- Owner-path prefix convention: `<restaurant_id>/...` — policy verifies the first path segment matches a restaurant the caller owns via an `EXISTS (SELECT 1 FROM public.restaurants WHERE id = ... AND owner_id = auth.uid())` subquery.
- Ship the reverse migration `116a_REVERSE_ONLY_storage_buckets.sql` per `release-safety §3` convention: drops policies + attempts `DELETE FROM storage.buckets` (only if empty).
- Document in `agent_docs/database.md` that buckets are now migration-tracked.

### Test requirements

- Integration test (`supabase/tests/migrations/116a.sql.test.ts` or `.bats` — whatever convention the repo uses): spin up a scratch Supabase via `supabase start`, apply migrations 001→116a, assert `storage.buckets` has three rows and `pg_policies` has the expected policies on `storage.objects`.
- CI round-trip test: apply 116a forward, run the reverse migration, apply forward again — schema snapshot identical. Per design §7 "Migration safety."
- Integration test: as user A (fixture), upload to `menu-scan-uploads/<restaurantA>/foo.jpg` succeeds; upload to `menu-scan-uploads/<restaurantB>/foo.jpg` fails with a 403. Same pattern for `dish-photos`.

### Integration

First migration in the v2 pack. Prerequisite for Steps 20 (owner upload), 21 (worker download), and later admin-photo features. Runs under Phase 1 per `release-safety §3`. Depends only on the existing `is_admin()` function and the existing `restaurants.owner_id` column — both pre-v2.

### Demo

Running `supabase db push` on a scratch DB, followed by `supabase storage ls menu-scan-uploads`, confirms the bucket exists. A Storage upload via `supabase-js` from a signed-in test user to `<their restaurant id>/test.jpg` succeeds; same upload to a stranger's restaurant path returns 403.

### Commit convention

`feat(v2): migration 116a — add menu-scan-uploads / restaurant-photos / dish-photos buckets + policies (plan step 5)`

---

## Step 6: Migrations 116+117 — `status` columns on `restaurants` and `menus` + indexes

### Objective

Add the `status text NOT NULL DEFAULT 'published' CHECK (status IN ('draft','published','archived'))` column to `restaurants` and `menus`, plus a `(status)` btree index on each. The column already exists on `dishes` from migration 114.

### Implementation guidance

- Two files merged into one logical step but kept separate on disk for replay safety: `supabase/migrations/116_add_status_to_restaurants.sql` and `117_add_status_to_menus.sql`. See design §5.1 table rows 116 and 117.
- `DEFAULT 'published'` is critical — every existing row becomes `'published'` transparently, so pre-Phase-4 consumer behaviour is unchanged per `release-safety §3.2`.
- Add `idx_restaurants_status` and `idx_menus_status` btree indexes (design §5.1).
- Paired reverse migrations (`116_REVERSE_ONLY_*.sql`, `117_REVERSE_ONLY_*.sql`) drop the column + index. Cheap while no app writes drafts; becomes one-way at first draft write.
- Regenerate `packages/database/src/types.ts` via `supabase gen types typescript --local > packages/database/src/types.ts` after migration applies. Both `Tables<'restaurants'>` and `Tables<'menus'>` now expose `status: 'draft'|'published'|'archived'`.
- Pre-flight audit in Phase 0: re-run `release-safety §2.1` queries on staging before deploy — must all return 0.

### Test requirements

- Integration test per migration: apply to scratch DB; `SELECT status, count(*) FROM public.restaurants GROUP BY status` shows all rows = `'published'`. Same for menus. Attempting `INSERT (status) VALUES ('bogus')` raises the CHECK violation.
- Integration test: generated types reflect the new column — `const r: Tables<'restaurants'> = { ..., status: 'draft' }` compiles.
- Round-trip test per `release-safety` runbook: forward → reverse → forward leaves pg_catalog identical.

### Integration

Depends on Step 5 (we ship migrations in order). Enables Steps 8, 10, 11, 13, 15, 18, 27 which reference `restaurants.status` / `menus.status`. After this step, the three content tables share one lifecycle vocabulary.

### Demo

On a scratch DB with v1 seed data, `SELECT count(*) FROM restaurants WHERE status = 'published'` equals the total row count; `SELECT count(*) FROM restaurants WHERE status = 'draft'` returns 0. A hand-rolled `UPDATE restaurants SET status='draft' WHERE id=...` succeeds (the check-constraint passes for the literal `'draft'`).

### Commit convention

`feat(v2): migrations 116+117 — add status columns + indexes to restaurants and menus (plan step 6)`

---

## Step 7: Migrations 118+119 — extend `menu_scan_jobs`, enable RLS, add to Realtime publication

### Objective

Land two tightly-coupled migrations on `menu_scan_jobs`: (118) add `input jsonb`, `attempts int`, `locked_until timestamptz` + extend the status CHECK to include `'pending'` + flip the default to `'pending'`; (119) enable RLS with owner-scoped SELECT/INSERT/UPDATE policies and add the table to the `supabase_realtime` publication.

### Implementation guidance

- `supabase/migrations/118_extend_menu_scan_jobs.sql` (design §5.1 row 118): additive column adds, then `ALTER TABLE ... DROP CONSTRAINT <status_check> ; ADD CONSTRAINT <new_check> CHECK (status IN ('pending','processing','needs_review','completed','failed'))`. Flip `DEFAULT` from `'processing'` to `'pending'`. Indexes: `idx_menu_scan_jobs_status (status)` + partial `idx_menu_scan_jobs_locked_until (locked_until) WHERE status IN ('processing','pending')`.
- `supabase/migrations/119_menu_scan_jobs_rls.sql` (design §5.1 row 119 + `release-safety §3.4`): `ENABLE ROW LEVEL SECURITY`; create three policies keyed on `created_by = auth.uid() OR public.is_admin() OR owner-of-restaurant`. Service role bypasses RLS — no policy needed. `ALTER PUBLICATION supabase_realtime ADD TABLE public.menu_scan_jobs;`.
- `created_by` stays as the canonical owner reference per design §5.1 ("No rename of `created_by`; keep `result_json`"). Document this in `agent_docs/database.md`.
- Reverse migrations pre-written. Note `119_REVERSE_ONLY_*.sql` re-opens the table to anon SELECT — marked as security-risky in the file header.
- Regenerate `packages/database/src/types.ts`. `Tables<'menu_scan_jobs'>` now exposes `input: Json | null`, `attempts: number`, `locked_until: string | null`.

### Test requirements

- Integration test (scratch DB): verify `ALTER ... DROP CONSTRAINT` + add new CHECK succeeds; inserting `status='pending'` succeeds; inserting `status='bogus'` fails.
- Integration test: as user A, insert `menu_scan_jobs` with `restaurant_id` owned by A and `created_by=A` — succeeds. Same insert with `restaurant_id` owned by B fails per RLS. Select as user C (no ownership) returns empty. Select as admin returns everything.
- Integration test: subscribe via `supabase.channel('test').on('postgres_changes', {table:'menu_scan_jobs'}, ...)` and assert an UPDATE via service role triggers the subscriber within 2 s.
- Round-trip test for both migrations.

### Integration

Depends on Step 6 (migrations land in order). Enables Step 9 (`confirm_menu_scan` writes to this table), Step 19 (worker reads via the RLS-aware RPC + service role), Step 20 (owner insert), Step 21 (owner Realtime + confirm). Without RLS + publication membership in place, Steps 20–21 cannot work end-to-end.

### Demo

From `psql` against a scratch DB: `INSERT INTO menu_scan_jobs (restaurant_id, created_by, status, input) VALUES ('<rid>', '<uid>', 'pending', '{"images":[]}')` succeeds and triggers a notification on the Realtime publication (tailed via a tiny Node script).

### Commit convention

`feat(v2): migrations 118+119 — extend menu_scan_jobs (input/attempts/locked_until/pending), enable RLS, add to Realtime (plan step 7)`

---

## Step 8: Migration 120 — `publish_restaurant_draft` Postgres function

### Objective

Ship the single-RPC atomic publish transition — flips `restaurants.status`, all child `menus.status`, all grandchild `dishes.status` in one transaction, gated on owner or admin.

### Implementation guidance

- File: `supabase/migrations/120_publish_restaurant_draft.sql`. Body verbatim from design §5.2 (`publish_restaurant_draft(p_restaurant_id uuid)`).
- `SECURITY DEFINER`, `SET search_path = public`. `REVOKE ALL FROM public`, `GRANT EXECUTE TO authenticated`.
- Authorization check uses `owner_id = auth.uid() OR public.is_admin()` — `public.is_admin()` is pre-existing. Raises `insufficient_privilege` on fail, `NO_DATA_FOUND` if restaurant id missing — both mapped by the Server Action wrapper in Step 18.
- Only flips menus/dishes currently in `'draft'` state (design §5.2) so a partial-publish retry is idempotent.
- Reverse migration drops the function. Cheap while no app depends; becomes one-way at first v2 app invocation in Step 18.

### Test requirements

- Integration test (Supabase CLI scratch DB with test seed): insert `(restaurant, 2 menus, 5 dishes)` all with `status='draft'`, owned by user A. As A, `SELECT publish_restaurant_draft(rid)`. Assert all 8 rows now `status='published'`. Assert a second invocation is a no-op (nothing is in `'draft'` anymore).
- Integration test: as user B, same call raises `insufficient_privilege`.
- Integration test: inject a CHECK violation on one dish (e.g., temporarily invalid `dish_kind`) and assert the whole transaction rolls back — no restaurant status change.
- Integration test: non-existent restaurant id raises `NO_DATA_FOUND`.

### Integration

Depends on Steps 6 + 7 (`restaurants.status` / `menus.status` exist). Consumed by Step 18's `publishRestaurant` Server Action, by Step 26's Playwright publish gold path, and by Step 27's pre-flight.

### Demo

`psql` on scratch DB: seed a draft restaurant with dishes, run `SELECT publish_restaurant_draft(rid)` as the owner role (via JWT claim impersonation), `SELECT status FROM dishes WHERE restaurant_id=rid` shows every row `'published'`.

### Commit convention

`feat(v2): migration 120 — publish_restaurant_draft RPC (transactional draft→published) (plan step 8)`

---

## Step 9: Migration 121 — `menu_scan_confirmations` side-table + `confirm_menu_scan` + worker helpers

### Objective

Ship the idempotent bulk-insert RPC for menu-scan confirmation, backed by a side-table for idempotency records, plus the three worker helper functions (`claim_menu_scan_job`, `complete_menu_scan_job`, `fail_menu_scan_job`).

### Implementation guidance

- File: `supabase/migrations/121_confirm_menu_scan.sql`. Order inside the file: (a) create `menu_scan_confirmations` table per design §5.1 row 121 (PK on `(job_id, idempotency_key)`, FK to `menu_scan_jobs` with ON DELETE CASCADE, RLS enabled with owner-only SELECT policy). (b) Create `confirm_menu_scan(p_job_id uuid, p_payload jsonb, p_idempotency_key text)` per design §5.2 body. (c) Create worker helpers `claim_menu_scan_job`, `complete_menu_scan_job`, `fail_menu_scan_job` per `small-memos B1 §2–§4`.
- `confirm_menu_scan` writes dishes with `status='draft'`, `allergens: []`, `dietary_tags: []` per `small-memos G2` + design §2.7. It also updates the job row to `status='completed'` and populates `saved_dish_ids`.
- `SECURITY DEFINER` on all four functions. `REVOKE ALL FROM public`; `GRANT EXECUTE TO authenticated` for `confirm_menu_scan` only. Worker helpers stay `EXECUTE` to `service_role` only (the worker Edge Function uses the service role).
- The `menu_scan_confirmations` side-table's RLS has a single owner-SELECT policy keyed on the referenced job's `created_by = auth.uid() OR public.is_admin()`. The function writes via SECURITY DEFINER so the policy is debugging-only.
- Reverse migration drops all four functions and the side-table. One-way once v2 app issues first confirm (Step 21).

### Test requirements

- Integration test (`confirm_menu_scan` idempotency): call with `(job_id, payload, keyA)` — returns `{confirmed: true, inserted_dish_ids: [...]}`. Call again with same `(job_id, keyA)` — returns the **exact same** response, no new rows inserted. Call with same `(job_id, keyB)` — inserts fresh set.
- Integration test (authorization): as user B (not owner of the referenced job's restaurant), call raises `insufficient_privilege`.
- Integration test (`claim_menu_scan_job`): insert two `pending` jobs. Run two concurrent `SELECT claim_menu_scan_job(180)` calls — each returns a different job (SKIP LOCKED works), both now `processing`, `locked_until ≈ now()+180s`, `attempts=1`.
- Integration test (`fail_menu_scan_job`): after 2 failures, status returns to `'pending'`; after 3rd failure, status flips to `'failed'`.
- Integration test (`complete_menu_scan_job`): writes `result` and `needs_review` status correctly.
- Vitest unit test for the Zod `confirmMenuScanPayloadSchema` (Step 3) matching the RPC's accepted shape — parity test.

### Integration

Depends on Step 7 (`menu_scan_jobs` has the `attempts` + `locked_until` columns) and Step 3 (`confirmMenuScanPayloadSchema`). Consumed by Step 19 (worker calls claim/complete/fail), Step 21 (confirm), Step 24 (admin replay).

### Demo

On a scratch DB with a `needs_review` job seeded: `SELECT confirm_menu_scan('<job>', '{"dishes":[{...}]}'::jsonb, 'abc123')` returns a JSON with `inserted_dish_ids`. Second call with same key returns identical JSON; `SELECT count(*) FROM dishes WHERE id = ANY(ids)` shows no duplicates.

### Commit convention

`feat(v2): migration 121 — menu_scan_confirmations side-table, confirm_menu_scan + claim/complete/fail helpers (plan step 9)`

---

## Step 10: Migration 122 — `generate_candidates` + `get_group_candidates` status filters

### Objective

Add `r.status='published' AND (m.id IS NULL OR m.status='published') AND d.status='published'` to the WHERE clauses of both candidate-producing RPCs. No signature change — `CREATE OR REPLACE FUNCTION` with the full signature from migrations 114 and 088.

### Implementation guidance

- File: `supabase/migrations/122_candidates_status_filter.sql`. Body follows design §2.3 "Modified functions" + `release-safety §4.4`.
- Preserve all existing filters verbatim (`r.is_active = true`, `d.is_available = true`, `d.is_parent = false`, `d.is_template = false` for `generate_candidates`, `is_restaurant_open_now(r.open_hours)` for `get_group_candidates`). Only **add** the three status clauses.
- `get_group_candidates` does **not** get the `d.is_template = false` fix here — flagged for follow-up per design §8.2 ("flagged as a pre-existing bug, out of v2 scope"). Comment the TODO inline.
- Reverse migration re-runs the prior definitions verbatim from migrations 114 + 088 bodies. Keep `122_REVERSE_ONLY_*.sql` untagged to prod.

### Test requirements

- Integration test (scratch DB): seed one published restaurant + one draft restaurant, each with matching menus/dishes. Call `generate_candidates(...)` with coords covering both. Assert only the published restaurant's dishes come back.
- Integration test: seed a published restaurant with one draft menu and one published menu (same restaurant). Assert dishes from the draft menu are filtered out.
- Integration test: parity with v1 — on a DB with every row `'published'` (the live-state baseline), `generate_candidates(...)` return set is identical to pre-migration-122. Use snapshot comparison on `id` + `distance_m` (see §7 "Testing strategy" parity approach).
- Same three assertions for `get_group_candidates`.

### Integration

Depends on Step 6 (`restaurants.status`, `menus.status`). Consumed by the `feed` and `group-recommendations` Edge Functions — no code change in those functions (they invoke the RPC); Step 11 only patches `nearby-restaurants` + `feed`'s aux query.

### Demo

`psql`: seed a draft + a published restaurant within the same 5km radius; run `SELECT count(*) FROM generate_candidates('now', ...)` — returns N-1 (draft hidden). Flip the draft to `'published'` and rerun — returns N.

### Commit convention

`feat(v2): migration 122 — add status='published' filters to generate_candidates + get_group_candidates (plan step 10)`

---

## C. Edge Function patches (Phase 2 of runbook)

## Step 11: Patch `nearby-restaurants` + `feed` Edge Functions with `status='published'` filters

### Objective

Patch `supabase/functions/nearby-restaurants/index.ts` to filter restaurants by `status='published'` at the top level (with nested `menus`/`dishes` falling through to RLS for enforcement, decision locked below) and `supabase/functions/feed/index.ts`'s auxiliary query at line 694 to filter `restaurants.status='published'`.

### Implementation guidance

- **Lock the `menus!inner` decision locked by design §8.2 + brief instruction: keep the nested `menus`/`dishes` selects as LEFT embeds, add `.eq('status','published')` only at the top-level `restaurants`. Rely on Phase 4 RLS for nested status enforcement.** Rationale: zero-menu mid-onboarding restaurants must not silently disappear (`release-safety §10 Risk 4`). Document this choice in the PR description.
- `supabase/functions/nearby-restaurants/index.ts:180–201`: add `.eq('status','published')` after `.select(...)`. No `!inner` changes.
- `supabase/functions/feed/index.ts:694`: change the aux query to `.from('restaurants').select('id, open_hours').eq('status','published').in('id', allRids)`. The main RPC path is covered by Step 10.
- `group-recommendations` gets no code change (SQL patch in Step 10 covers it).
- Update each function's `CHANGELOG.md` with a one-line entry pointing at this plan step.
- Redeploy via `supabase functions deploy nearby-restaurants` and `supabase functions deploy feed`.

### Test requirements

- Deno integration test per function (`supabase/functions/nearby-restaurants/test.ts`): invoke against a scratch DB seeded with a draft restaurant + a published restaurant both in range. Assert only the published row is returned.
- Curl smoke against staging post-deploy: `curl -X POST ${URL}/functions/v1/nearby-restaurants -d '{"latitude":..., "longitude":..., "radiusKm":50}' -H "Authorization: Bearer <anon>"` returns the same row count as pre-deploy (everything still `'published'` in staging).
- Regression: the zero-menu restaurant audit (`release-safety §10 Risk 4`) on staging returns the same count before and after this step — no restaurants disappear.

### Integration

Depends on Step 6 (`restaurants.status` exists). Consumed by all mobile consumers — their behaviour is identical pre-Phase-4 because every row is still `'published'`. Gates Step 12's release-safety CI tests.

### Demo

`curl` against staging `nearby-restaurants` before the patch and after — same row count. Seed a `status='draft'` restaurant via service role; re-curl — the draft is absent. Flip to `'published'`; curl again — it appears.

### Commit convention

`feat(v2): edge fn patches — nearby-restaurants + feed filter status='published' (plan step 11)`

---

## Step 12: Release-safety CI tests — drafts-never-visible + pre/post-Phase-4 parity

### Objective

Write the two CI-gated release-safety tests before Phase 4 runs: "drafts are never visible to the consumer app" and "published-data parity across all consumer endpoints." Both are blocking for the Phase 4 migration deploy.

### Implementation guidance

- `apps/web-portal-v2/tests/integration/consumer-endpoints-hide-drafts.test.ts` — per `release-safety §9.1 Test A` + design §7. Setup: service-role client creates a draft restaurant + draft menu + draft dish; asserts absence from `nearby-restaurants`, `feed`, `group-recommendations` + mobile-shape direct queries (`restaurants`, `dishes` nested); positive control flips to `'published'` and asserts presence.
- `apps/web-portal-v2/tests/integration/consumer-endpoints-published-parity.test.ts` — per `release-safety §9.1 Test B`. Snapshots `nearby-restaurants`, `feed`, `group-recommendations` responses against a fixed fixture restaurant pre-Phase-4 + re-run post-Phase-4, diff must be empty modulo non-deterministic fields (`distance_m` rounded, equidistant-row ordering).
- Both tests target the staging DB set by `SUPABASE_STAGING_URL` / `SUPABASE_STAGING_SERVICE_KEY` env vars in CI. They are **not** blocking PR merge — they are blocking the Phase 4 migration deploy (Step 27). Mark them in a separate `turbo` task `turbo release-safety`.
- Test-D (auth wrapper coverage) already landed via the ESLint rule in Step 2; the standalone `scripts/check-auth-wrappers.ts` is the human-readable counterpart — hooked up as a `turbo audit` task.

### Test requirements

- Both suites green locally against a scratch Supabase (with all migrations 116a–122 applied and the Edge Function patches from Step 11 deployed).
- Each suite includes its own negative-control assertion to prevent vacuous passes — flipping to `'published'` must make the row reappear.
- The parity test stores its pre-Phase-4 snapshots in `apps/web-portal-v2/tests/integration/fixtures/parity-baseline.json`, committed.

### Integration

Depends on Steps 10 + 11 (candidate RPCs + Edge Function patches in place). Gates Step 27 (Phase 4) — the migration deploy runbook lists `turbo release-safety` green as a pre-flight requirement.

### Demo

Running `turbo release-safety --filter web-portal-v2` against staging returns `2 suites, N tests, 0 failures`. Temporarily flipping a seed restaurant to `status='draft'` and re-running causes the drafts-test to pass (draft hidden) and the parity test to fail (row missing from baseline) — proof both tests have signal.

### Commit convention

`test(v2): release-safety CI — drafts-never-visible + published-parity suites (plan step 12)`

---

## D. Mobile patches (Phase 3 of runbook)

## Step 13: Mobile defense-in-depth `.eq('status','published')` patches (6 sites, 3 files)

### Objective

Add explicit `.eq('status','published')` filters to six mobile Supabase query sites across three files. No UX changes, no feature work — mechanical only.

### Implementation guidance

- Exact sites per design §4.5 + `frozen-surface §1`:
  - `apps/mobile/src/stores/restaurantStore.ts:126` — top-level `.eq('status','published')` on the restaurants+nested-select query
  - `apps/mobile/src/stores/restaurantStore.ts:159` — `.eq('status','published')` on the nearby-dishes fetch
  - `apps/mobile/src/stores/restaurantStore.ts:269` — `.eq('status','published')` on single-restaurant detail
  - `apps/mobile/src/stores/restaurantStore.ts:312` — nested `.eq('dishes.status','published')` inside the menu_categories query
  - `apps/mobile/src/hooks/useDish.ts:41` — `.eq('status','published')` on single-dish fetch
  - `apps/mobile/src/screens/BasicMapScreen.tsx:491` — `.eq('status','published')` on the recently-viewed-dishes query
- Do **not** add `.eq('is_template', false)` — out of v2 scope per brief (flagged follow-up). Same for any nested-inner-join changes.
- No shared-package type imports change — `DishStatus` already exists in `@eatme/shared` from v1.
- Changelog line (per design §4.5): "Defense-in-depth: explicit `status='published'` filters on direct Supabase queries. No user-visible change."
- Trigger an EAS build (staging channel) and submit to TestFlight + Play internal track.

### Test requirements

- Jest unit tests in `apps/mobile/src/stores/__tests__/restaurantStore.test.ts`: mock the `.from(...).select(...).eq(...)` chain and assert the `.eq('status','published')` call is issued at each of the four sites. Same pattern for `useDish` and `BasicMapScreen`.
- Manual smoke against staging: launch staging mobile build post-migration-116 deploy; open map, open restaurant, open dish — no crashes, row counts unchanged.
- Contract test: snapshot of the `.from('restaurants').select(...).eq(...)` chain keys against a fixture — fails if a future edit drops the `status` filter.

### Integration

Depends on Step 6 (`restaurants.status` exists in prod; otherwise the filter raises a column-not-found at runtime). Parallelizable with Step 11 (both are Phase 2/3 adjuncts). Required in production ≥ 48 h before Step 27 per `release-safety §5.3`.

### Demo

Run the staging mobile build; Charles Proxy (or RN debugger) on the outgoing Supabase request shows `status=eq.published` in the URL query string for all six call sites. Row counts on the map are identical to pre-patch.

### Commit convention

`feat(mobile): defense-in-depth status='published' filters on 6 direct queries (plan step 13)`

---

## E. Owner app

## Step 14: Owner app auth pages, sign-in/sign-up, DAL wire-up, `/onboard` skeleton

### Objective

Build the owner app's sign-in and sign-up pages (email/password + Google + Facebook OAuth), wire the DAL into `(app)/layout.tsx`, and render an empty `/onboard` page for authenticated users that redirects to `/restaurant/[id]` if they already have a restaurant.

### Implementation guidance

- `app/(auth)/signin/page.tsx` and `app/(auth)/signup/page.tsx` per design §4.1. Client-form leaves (`SignInForm`, `SignUpForm`) use react-hook-form + Zod. Sign-in form reads `?redirect=` from `searchParams` and passes it to the Server Action so deep links resume post-auth (addresses `prior-work-consolidation §4` item 5).
- Server Actions `signInWithPassword`, `signUpWithPassword`, and the two OAuth redirect initiators live in `app/(auth)/actions.ts`, each wrapped in `withPublic` (Step 2). `withPublic` still surfaces the supabase client so the action can call `supabase.auth.signInWithPassword()`.
- Email confirmation optional per design §2.1. `signUpWithPassword` inspects the Supabase response shape — if `data.session` is present, redirect to `/onboard`; else show the "check email" affordance. Prevents the v1 "always shows check email" bug (`prior-work-consolidation §4` item 8).
- `app/(app)/layout.tsx` calls `await verifySession()` and renders the signed-in shell (sidebar + topbar composed from `@eatme/ui`).
- `app/(app)/onboard/page.tsx` — RSC reads the user's restaurants via the DAL-provided supabase client; if zero, renders the empty stepper placeholder (filled in Step 16); if ≥ 1, `redirect(`/restaurant/${rid}`)`.
- `app/(app)/profile/page.tsx` — minimal form for email/display name/preferred language. Password change + OAuth link management. Server Actions colocated.

### Test requirements

- Playwright (`apps/web-portal-v2/tests/e2e/auth.spec.ts`): fresh user visits `/onboard` → redirected to `/signin?redirect=%2Fonboard` → signs up → session cookie set → redirected back to `/onboard`. OAuth paths are stubbed at the provider (`supabase.auth.signInWithOAuth` mocked) since we can't round-trip Google in CI.
- Playwright: sign-in form's redirect param is honoured for a deep link (`/restaurant/foo`).
- Vitest: sign-up Server Action returns `{ok:true, data:{needsEmailConfirmation:false}}` when Supabase returns a session, `{ok:true, data:{needsEmailConfirmation:true}}` when it doesn't.
- Playwright: signed-in user visiting `/signin` is bounced to `/onboard` by the proxy (Step 4).

### Integration

Depends on Steps 2 + 3 + 4 (wrappers, Zod, proxy). First observable owner app surface. Enables Step 15 (needs an authenticated user for draft CRUD).

### Demo

Running `pnpm --filter web-portal-v2 dev`, a brand-new email signs up at `/signup`, is redirected to `/onboard`, and sees the empty "let's get started" shell.

### Commit convention

`feat(v2): owner auth pages + DAL-wired app shell + /onboard skeleton (plan step 14)`

---

## Step 15: Restaurant draft CRUD Server Actions + `/restaurant/[id]` basic-info form

### Objective

Ship the five owner-side Server Actions for restaurant drafts (create, read, update, archive, unpublish) plus the `/restaurant/[id]` basic-info edit page. Creating a restaurant writes to the DB immediately with `status='draft'` — localStorage is never used.

### Implementation guidance

- `app/(app)/restaurant/[id]/actions/restaurant.ts` exports `createRestaurantDraft`, `updateRestaurantBasics`, `archiveRestaurant`, `unpublishRestaurant`. All wrapped in `withAuth` (Step 2). Fifth action, `readRestaurant`, lives in a DAL helper called from the RSC page — not exported as a Server Action.
- `createRestaurantDraft` inserts a row with `status='draft', owner_id=ctx.userId`, returns `{ ok: true, data: { id } }`, calls `revalidatePath('/onboard')`.
- `updateRestaurantBasics` validates via `basicInfoSchema` (extended in Step 3 to allow draft-partial shape), upserts, calls `revalidatePath('/restaurant/[id]', 'page')`.
- `archiveRestaurant` updates `status='archived'` (and cascades menus/dishes — decision: do not cascade at this step; only restaurant row. Cascade behaviour is a product question beyond v2 scope — archived restaurant is invisible regardless of menu status).
- `unpublishRestaurant` reverses publish — flips `status='draft'` on the restaurant row only; menus and dishes keep their status, so re-publishing via Step 18's `publish_restaurant_draft` is idempotent.
- `app/(app)/restaurant/[id]/page.tsx` — RSC. `await params`, calls DAL-scoped read. If `owner_id !== userId`, `notFound()`. Renders `<BasicInfoForm initial={restaurant} />` client component.
- `BasicInfoForm` uses react-hook-form + `basicInfoSchema` + the action. Save-on-blur autosave per design §2.1 ("Every save writes to the DB immediately as `status='draft'`"). A small status chip near the top displays `Draft / Live / Suspended / Archived` per `release-safety §10 Risk 1`.

### Test requirements

- Vitest for each action: unauthenticated caller returns `{ok:false, formError:'UNAUTHENTICATED'}`. Authenticated caller on foreign restaurant returns `{ok:false, formError:'FORBIDDEN'}` (DB-level — supabase-js returns empty on RLS, mapped to NOT_FOUND by the wrapper per design §6).
- Vitest: Zod validation errors flatten to `fieldErrors` shape.
- Playwright (`tests/e2e/onboarding-happy-path.spec.ts` scaffolded here, filled later): fresh user signs up → lands on `/onboard` → clicks "Create your restaurant" → types name "Test Cafe" → form autosaves → closes the tab → reopens `/onboard` → redirected to `/restaurant/<id>` with "Test Cafe" prefilled.
- Vitest: `archiveRestaurant` flips status; `unpublishRestaurant` flips status without touching menus/dishes.

### Integration

Depends on Steps 2 + 3 + 6 + 14. Consumed by Steps 16 (stepper invokes these actions) + 17 (menus belong to a restaurant) + 18 (publish flow). First real DB writes from the v2 app.

### Demo

Signed-in fresh user clicks "Create restaurant", types "Test Cafe", tabs away — a toast says "Draft saved." Closing the browser and reopening `/onboard` redirects straight to `/restaurant/<id>` with the data intact. The chip shows `Draft`.

### Commit convention

`feat(v2): restaurant draft CRUD Server Actions + basic-info form with autosave (plan step 15)`

---

## Step 16: Onboarding stepper overlay + Location + Hours + Cuisines + Photos steps

### Objective

Wrap the basic-info form from Step 15 in an onboarding stepper overlay covering Basic info → Location → Operating hours → Cuisines & service options → Photos. The stepper is the same codebase as `/restaurant/[id]` — different shell, same form.

### Implementation guidance

- `app/(app)/onboard/layout.tsx` — RSC stepper overlay. Reads the user's restaurant via DAL; if none, calls `createRestaurantDraft` (redirects silently to `/onboard` with the new id), if one, redirects to `/restaurant/[id]` unless the URL explicitly requests stepper mode via `?onboarding=1`.
- Reuse the same form sections from Step 15. Factor each section into a colocated client component: `BasicInfoSection.tsx`, `LocationSection.tsx`, `HoursSection.tsx`, `CuisinesSection.tsx`, `PhotosSection.tsx`. Import from both `app/(app)/restaurant/[id]/page.tsx` and `app/(app)/onboard/page.tsx`.
- `LocationSection` renders a Mapbox search + pin picker. `HoursSection` exposes the 7-day editor from v1 (port visual shell; state is react-hook-form).
- `PhotosSection` uses `uploadRestaurantPhoto` from `apps/web-portal-v2/src/lib/upload.ts` (new in this step) — `browser-image-compression` to 2048 px JPEG q0.85, direct upload to `restaurant-photos/<rid>/hero.jpg` via `supabase.storage`.
- Stepper UI component from `@eatme/ui/compose/OnboardingStepper`. Each step has a "Next" button; disabled until the current step's Zod validation passes. "Back" navigates without losing state (persisted in DB + revalidated).
- Per design §2.1 the "first menu" step is optional — defer it to Steps 17/20 where menus + scan land.

### Test requirements

- Playwright scaffold (tests/e2e/onboarding-happy-path.spec.ts, now filled): full walk through the five steps with autosave verified on each. Close tab after step 3, reopen, assert resumed at step 3 with the first three sections pre-filled.
- Vitest: `uploadRestaurantPhoto` compresses to ≤ 2 MB and uploads to the expected path. Mock `supabase.storage.from().upload()`.
- Vitest: each section renders correctly both inside the stepper (`mode='onboarding'`) and inside `/restaurant/[id]` (`mode='edit'`). Same form fields, different chrome.
- Accessibility check via axe-core on the stepper page: no critical violations.

### Integration

Depends on Steps 5 (storage buckets), 14, 15. Consumed by Steps 17–18. First step at which the "close-tab-resume" invariant from rough-idea §Done is observable.

### Demo

Fresh user signs up → stepper appears on `/onboard` → types name + picks a map pin + toggles cuisines + drops a hero photo. Closes tab. Reopens `/onboard` 3 days later → lands on step 5 (Photos) with the photo in place.

### Commit convention

`feat(v2): onboarding stepper + Location/Hours/Cuisines/Photos sections with DB-sourced draft resume (plan step 16)`

---

## Step 17: Menu + category + dish CRUD (5-kind dish form, discriminated-union validation)

### Objective

Build `/restaurant/[id]/menu` with create/edit/archive for menus + categories + dishes. The dish form surfaces the 5-kind discriminated union (`standard`, `bundle`, `configurable`, `course_menu`, `buffet`) with `primary_protein` as the only classification field. `allergens`/`dietary_tags` hidden (empty arrays written) per design §2.7.

### Implementation guidance

- `app/(app)/restaurant/[id]/menu/page.tsx` — RSC list of menus with nested categories/dishes, each rendered via `@eatme/ui/compose/PageGroupedList`. Reads via DAL.
- `actions/menu.ts`: `createMenu`, `updateMenu`, `archiveMenu`. `actions/category.ts`: `createCategory`, `updateCategory`, `deleteCategory`. `actions/dish.ts`: `createDish`, `updateDish`, `archiveDish`, `unpublishDish`. All wrapped in `withAuth`, all validate against the Zod schemas from Step 3.
- `DishForm` client component — discriminated-union form per `nextjs-foundation §4`. Switching `dish_kind` mounts/unmounts slot-specific sections (`BundleItemsSection`, `ConfigurableSlotsSection`, `CourseEditorSection`). `is_template` is a sibling checkbox, only shown when `dish_kind === 'configurable'` per design §2.1.
- Write `allergens: []` and `dietary_tags: []` explicitly on insert per design §2.7 + `small-memos G2`.
- Port visual components selectively from `2026-04-22-ingestion-improvements` per `prior-work-consolidation §5`: `DishEditPanelV2`, `KindSelectorV2`, `CourseEditor`, `PageGroupedList` — rewire their state to react-hook-form + Server Actions (drop Zustand per brief).
- Do **not** surface the ingredient picker or allergen editor (design §2.6 explicit out-of-scope).
- **Dish photos.** `DishForm` embeds an image input bound to a new helper `uploadDishPhoto(dishId, file)` in `apps/web-portal-v2/src/lib/upload.ts`, modeled on `uploadRestaurantPhoto` from Step 16: `browser-image-compression` to 2048 px JPEG q0.85, direct upload to `dish-photos/<dish_id>/hero.jpg` via `supabase.storage.from('dish-photos').upload(...)`. On successful upload, `updateDish` stores the Storage path on the dish row. Reuses the same compression utility introduced in Step 16; no new library. For the menu-scan confirm path (Step 21), dish photos are not captured — scan results rely on the menu image for provenance only.

### Test requirements

- Vitest for each action: `createDish` rejects `dish_kind='template'` (removed post-mig-115); accepts all 5 valid kinds; `allergens`/`dietary_tags` default to `[]` when omitted.
- Vitest (typing): `dishSchema` narrows `parsed.data.dish_kind === 'configurable'` to include `slots`; `parsed.data.dish_kind === 'buffet'` excludes `slots`.
- Playwright: create menu "Lunch" → create category "Mains" → create dish "Chicken Sandwich" (`standard`, `primary_protein: 'poultry'`). Edit the dish to `dish_kind: 'configurable', is_template: true, slots: [...]` and save; asserts the form validates and the row persists.
- Vitest: `archiveDish` / `unpublishDish` flip status correctly.
- Vitest: `uploadDishPhoto` compresses to ≤ 2 MB and uploads to `dish-photos/<dishId>/hero.jpg`. Mock `supabase.storage.from().upload()`. Owner-scope RLS from Step 5 means the same fixtures as the restaurant-photo test apply.

### Integration

Depends on Steps 2 + 3 + 6 + 7 + 14 + 15. Consumed by Steps 18 (publish), 21 (menu-scan writes dishes into these categories), 26 (gold paths), 27 (Phase 4 re-run asserts draft dishes hidden).

### Demo

On `/restaurant/<id>/menu`, the owner creates a Lunch menu, a Mains category, and a standard Chicken Sandwich dish (primary_protein=poultry). Switches the kind to `course_menu` and adds two courses — the form updates live, saves, reloads with the correct shape.

### Commit convention

`feat(v2): menu + category + dish CRUD with 5-kind discriminated-union dish form (plan step 17)`

---

## Step 18: Publish flow — `publish_restaurant_draft` call + Realtime broadcast + unpublish/archive

### Objective

Wire the publish button on `/restaurant/[id]` to `publish_restaurant_draft` via a Server Action, broadcast Realtime updates to any other open tab for the same user, and finalise the unpublish + archive flows. **This step closes the core end-to-end loop — a signed-in owner can go from signup to published restaurant visible on the consumer feed.**

### Implementation guidance

- `actions/restaurant.ts` (extend): `publishRestaurant` wrapped in `withAuth`, validates `publishPayloadSchema`, calls `ctx.supabase.rpc('publish_restaurant_draft', {p_restaurant_id: id})`. On success, `updateTag(`restaurant-${id}`)` + `updateTag('restaurant-list')` per design §3.3.
- Map Postgres errors per design §6: `insufficient_privilege` → `FORBIDDEN`, `NO_DATA_FOUND` → `NOT_FOUND`, CHECK violations → `VALIDATION`, everything else → `UNKNOWN_ERROR` with server-side logging (no leak to client).
- Add a `PublishButton` client component to `/restaurant/[id]` — disabled until required fields are filled (checked client-side via `restaurantPublishableSchema` from Step 3 + a server validation re-check inside the action).
- Subscribe the owner's `(app)/layout.tsx` shell to a Realtime channel `user-${userId}` — upsert from Server Actions (via the supabase client in ctx) broadcasts a `restaurant.published` event; the layout's client boundary calls `router.refresh()` on receipt. Provides cross-tab / cross-device consistency per design §3.3.
- Unpublish and Archive buttons live in `/restaurant/[id]/settings` (new sub-page). Confirm dialog via `@eatme/ui/compose/ConfirmDialog`.

### Test requirements

- Playwright (`tests/e2e/publish-happy-path.spec.ts`): sign up → onboard → create menu with one dish → click Publish → assertion: `/restaurant/[id]` chip flips from `Draft` to `Live`. Check the consumer-facing query (anon Supabase client from Playwright) returns the restaurant within 2 s.
- Playwright (multi-tab): two browser contexts signed in as the same user. Context A publishes; Context B receives the Realtime event and re-renders with `Live` chip without a manual refresh. Matches `release-safety §9 Test B`.
- Vitest: `publishRestaurant` error mapping — mock RPC raises `insufficient_privilege` → action returns `{ok:false, formError:'FORBIDDEN'}`.
- Playwright: Publish is disabled until the server-side `restaurantPublishableSchema` passes (simulate by removing the restaurant's name).
- Vitest: `unpublishRestaurant` and `archiveRestaurant` flip status, Realtime event fires.

### Integration

Depends on Steps 7 (Realtime publication), 8 (`publish_restaurant_draft`), 15 (draft CRUD), 17 (menus + dishes exist to flip). **Milestone: closes the core end-to-end draft → publish flow. Consumer-facing Edge Functions (Step 11) correctly return the newly-published restaurant.** Step 26's Playwright bundle builds on this.

### Demo

Signed-in owner completes onboarding, adds a Lunch menu with one dish, clicks Publish. The chip flips to `Live`. In a second browser tab (same user), the `/restaurant/[id]` page chip flips automatically without a refresh. From an anonymous terminal `curl`ing `/functions/v1/nearby-restaurants` at the seeded coords, the restaurant appears in the response.

### Commit convention

`feat(v2): publish Server Action + publish_restaurant_draft + Realtime cross-tab broadcast (plan step 18)`

---

## F. Menu scan end-to-end

## Step 19: `menu-scan-worker` Edge Function + `pg_cron` schedule + OpenAI integration

### Objective

Ship the new `menu-scan-worker` Supabase Edge Function that the cron ticks into every minute; it claims a job, downloads images from Storage, calls OpenAI GPT-4o with Vision + Structured Outputs, and writes the result back.

### Implementation guidance

- `supabase/functions/menu-scan-worker/index.ts` per design §4.4 + `small-memos B1 §5`. `MAX_PER_TICK = 3`, `p_lock_seconds = 180`. Service-role Supabase client + `openai@npm:^4` SDK.
- GPT **integration pattern** ported from v1 per `small-memos C1` (model, `zodResponseFormat`, `strict: true`, temperature 0.1, image `detail: 'high'`, multi-page merge). Pin `gpt-4o-2024-11-20`; fallback to `gpt-4o-mini` on 429 or `attempts >= 2`.
- **Rewrite the prompt text and the `MenuExtractionSchema`** for v2 per design §4.4 (not a copy of v1's). Specifically: (a) drop allergen / dietary / ingredient fields (v2 UI hides them; `confirm_menu_scan` writes `[]`); (b) pin `dish_kind` output to the 5-value enum (`standard | bundle | configurable | course_menu | buffet`) and `primary_protein` to the 11-value list from `packages/shared/src/logic/protein.ts` — any legacy value must fail the schema; (c) add a per-dish `suggested_category_name` string so the review UI can one-click "create category + assign" (closes the category-assignment gap §2.1 and Step 21); (d) keep `source_image_index` + per-field confidence; (e) omit `is_template` (owner decision) and `calories` (v1-optional, dropped).
- Store the v2 `MenuExtractionSchema` in `packages/shared/src/validation/menuScan.ts` (extend from Step 3) and import into the Edge Function via the Deno-compatible JSR path or bundle locally. This matches design §4.4 "Zod schema via `zodResponseFormat(MenuExtractionSchema)`".
- `supabase/migrations/116b_menu_scan_cron.sql` (numbering: slot between 116a and 116 is unused; keep `116b` as a separate slot for the cron-schedule-only migration so we can tear it down independently during rollback): `CREATE EXTENSION IF NOT EXISTS pg_cron; CREATE EXTENSION IF NOT EXISTS pg_net;` (no-op if already enabled) + the `cron.schedule` SQL from `small-memos B1 §4`. Vault secrets `project_url` + `service_role_key` must be set via the Supabase dashboard before this migration runs (document in the PR description).
- Observability: Supabase Dashboard → Edge Functions → Logs. `cron.job_run_details` + `net._http_response` queries documented in `agent_docs/database.md`.
- Error handling: `BadRequestError` from OpenAI fast-fails to `failed` (design §6). `RateLimitError` backs off and bumps `attempts`. Network errors use the SDK's built-in 2 retries plus the table's up-to-3-attempts pattern.

### Test requirements

- Deno integration test (`supabase/functions/menu-scan-worker/test.ts`): fixture image fed into the handler with OpenAI SDK stubbed to return a canned Structured Output; assert the `menu_scan_jobs` row transitions `pending → processing → needs_review` and `result_json` has the canned payload.
- Concurrency integration test: insert 5 pending jobs, invoke the handler twice in parallel — each invocation claims different rows, no double-claims, `attempts` increments correctly.
- Retry integration test: stub OpenAI to raise `RateLimitError` three times; assert job ends in `status='failed'` with `attempts=3`.
- Integration test: cron schedule inserts a `net.http_post` request in `net._http_response` when invoked manually via `SELECT cron.schedule(...); SELECT cron.schedule_in_database(...)` on a scratch DB.
- Staging smoke: submit a real 2-page menu image via the staging DB; watch the worker complete within 90 s (design §2.5).
- **Schema rewrite regression tests (Vitest on `MenuExtractionSchema`):** (a) a v2 fixture payload with the 5-value `dish_kind` + 11-value `primary_protein` + `suggested_category_name` parses cleanly; (b) a v1-era fixture payload emitting `dish_kind='combo'` is **rejected** (forces the worker to treat the response as a schema failure, not silently accept legacy values); (c) a payload including `allergens` or `dietary_tags` from an overly-helpful model is either rejected outright or stripped by the schema so `confirm_menu_scan` still receives only the v2 fields; (d) `suggested_category_name` tolerates missing (optional) per fixture and is a plain string when present.

### Integration

Depends on Steps 5 (storage buckets), 7 (RLS + Realtime on `menu_scan_jobs`), 9 (worker helper RPCs). Consumed by Steps 20 (owner insert fires a job) and 21 (Realtime delivery + confirm). Enables `OPENAI_API_KEY` secret to be set in the Supabase dashboard.

### Demo

On a scratch DB with the cron running: hand-insert a `pending` job with a fixture image path → wait ≤ 60 s → `SELECT status, result_json FROM menu_scan_jobs WHERE id = '<id>'` shows `needs_review` with extracted dishes JSON.

### Commit convention

`feat(v2): menu-scan-worker Edge Function + pg_cron schedule + OpenAI GPT-4o integration (plan step 19)`

---

## Step 20: Owner menu-scan upload UI — `browser-image-compression` + direct Storage upload + job insert

### Objective

Ship `/restaurant/[id]/menu-scan` — owner uploads one or more menu images (or a PDF broken into pages), the browser compresses each to ≤ 2 MB, uploads directly to `menu-scan-uploads` Storage, and inserts a `menu_scan_jobs` row with `status='pending'`.

### Implementation guidance

- `app/(app)/restaurant/[id]/menu-scan/page.tsx` — RSC list of jobs for the restaurant (via DAL). "Upload new scan" button drops into a client-side `<MenuScanUploadForm />`.
- `MenuScanUploadForm` uses `browser-image-compression` with `{maxSizeMB: 2, maxWidthOrHeight: 2048, useWebWorker: true, fileType: 'image/jpeg', initialQuality: 0.85}` per `small-memos G1`.
- Upload path: `<restaurant_id>/<crypto.randomUUID()>.jpg`. PDF support via `pdfjs-dist` dynamic import, rasterising each page to JPEG client-side — but defer PDF support to the admin app in Step 24 (owner app does images only to keep the 250 KB bundle). Owner form accepts JPEG / PNG / HEIC (`browser-image-compression` handles HEIC via its canvas path).
- After upload succeeds, call `createMenuScanJob` Server Action (new, wrapped in `withAuth`) which validates `menuScanJobInputSchema` (Step 3) and inserts the `menu_scan_jobs` row. Returns `{ok:true, data:{jobId}}`.
- After insert, `router.push(`/restaurant/[id]/menu-scan/${jobId}`)` — the review page (Step 21) is the next stop.
- Bundle discipline: dynamic-import `browser-image-compression` inside the form component so it's only pulled when the user opens the upload UI (≈ +12 KB gzip).

### Test requirements

- Playwright (`tests/e2e/menu-scan-happy-path.spec.ts`, scaffolded here): fresh user with a draft restaurant → uploads two fixture JPEGs → asserts the `menu_scan_jobs` row exists via service-role client, `status='pending'`, `input.images.length === 2`.
- Vitest: `uploadMenuPage` unit test — compresses a fixture 5 MB PNG to ≤ 2 MB JPEG, uploads to the expected path, returns `{bucket, path, page}`.
- Vitest: `createMenuScanJob` Server Action — rejects inputs with 0 images or > 20 images (Zod bound from Step 3); foreign-restaurant caller hits RLS and returns `FORBIDDEN`.
- Accessibility: the drag-and-drop uploader is keyboard-navigable.

### Integration

Depends on Steps 5 (bucket), 7 (`menu_scan_jobs` RLS), 19 (worker is picking up pending jobs). Consumed by Step 21 (review + confirm).

### Demo

On `/restaurant/<id>/menu-scan`, the owner drops two phone-photo JPEGs. Within ~60 s (one cron tick), the page shows a new job transitioning `Pending → Processing → Needs review` (Realtime in Step 21 is what drives the progression UI).

### Commit convention

`feat(v2): menu-scan upload UI — browser-image-compression + direct Storage + job insert (plan step 20)`

---

## Step 21: Owner menu-scan review + confirm — Realtime subscription + category assignment + `confirm_menu_scan`

### Objective

Ship `/restaurant/[id]/menu-scan/[jobId]` — owner watches the job progress via Realtime, then reviews and edits the extracted dishes, assigns each to a menu category (or creates a category inline), and confirms. Confirm calls `confirm_menu_scan` with a fresh idempotency key.

### Implementation guidance

- RSC page reads the current job row; renders `<ScanReviewShell jobId={id} initial={job} />` client component. The shell subscribes to `postgres_changes` on `menu_scan_jobs` filtered by `id=eq.${jobId}` and feeds updates into TanStack Query's `setQueryData` per `nextjs-foundation §6`.
- UI states:
  - `pending` / `processing` → spinner + "Scanning…" with the page images thumbnailed.
  - `needs_review` → `<DishReviewTable />` with one row per extracted dish. Confidence badges, sort-low-first, "Accept all above 80%" bulk action (ported from `prior-work-consolidation §5` + design §2.1).
  - `completed` → dish list link to `/restaurant/[id]/menu`.
  - `failed` → error panel with a Retry button that calls `retryMenuScan(jobId)` (new Server Action that resets `attempts=0, status='pending'`).
- Category assignment: each row shows a combobox sourced from the restaurant's existing categories; typing a new name creates a fresh `menu_categories` row on confirm via the Server Action.
- `confirmMenuScan` Server Action (wrapped in `withAuth`, validates `confirmMenuScanPayloadSchema`): generates `crypto.randomUUID()` as the idempotency key on form submit (stored in form state so retries on network failure reuse the same key) and calls `rpc('confirm_menu_scan', {p_job_id, p_payload, p_idempotency_key})`.
- After success, `updateTag('restaurant-${id}')` + `router.push('/restaurant/[id]/menu')`.

### Test requirements

- Playwright (`tests/e2e/menu-scan-happy-path.spec.ts`, filled): upload 2 pages → wait for `needs_review` (via Realtime, or a timeout fallback) → review the table → assign categories → click Confirm → lands on `/restaurant/[id]/menu` with the new dishes visible.
- Playwright (idempotency): intercept the `confirmMenuScan` action's return and retry the same invocation with the same idempotency key; assert exactly one set of dishes is inserted.
- Vitest: `retryMenuScan` resets `attempts` and `status` and clears `last_error`.
- Vitest: the Zod schema rejects payloads whose dishes reference a `menu_category_id` not owned by the caller (server re-check catches this even if client passes).

### Integration

Depends on Steps 3 (Zod), 7 (Realtime + RLS), 9 (`confirm_menu_scan`), 19 (worker delivers results), 20 (upload creates jobs). Closes the F-phase menu-scan end-to-end.

### Demo

Signed-in owner uploads a 2-page menu on `/restaurant/<id>/menu-scan` → within 60 s the UI advances to `Needs review` with 12 extracted dishes → owner assigns each to a category → clicks Confirm → lands on `/restaurant/<id>/menu` with the 12 dishes under their chosen categories, all `status='draft'`, ready to publish.

### Commit convention

`feat(v2): menu-scan review + confirm UI — Realtime + category assignment + confirm_menu_scan (plan step 21)`

---

## G. Admin app

## Step 22: Admin app auth shell, proxy, restaurant browse + search

### Objective

Wire the admin app's proxy matcher for `app_metadata.role === 'admin'`, render the signed-in admin shell, and ship a browse + search page over all restaurants with < 3 s search latency.

### Implementation guidance

- Admin proxy (Step 4) already redirects non-admins; here we wire the `app_metadata.role` read inside `verifyAdminSession` (Step 2) and render the `(admin)/layout.tsx` shell.
- `app/(admin)/restaurants/page.tsx` — RSC DataTable (port from `2026-04-10-web-portal-redesign` per `prior-work-consolidation §5`). Columns: name, city, status, `is_active`, owner email, created_at. Search-by-name uses `restaurants` full-text-search on `name` (index may need to be added as part of this step — verify via `release-safety §2` audit).
- Filter UI: status (`draft|published|archived`), admin suspension (`is_active=false`), city/country. URL-synced state via TanStack Query + `usePagination` / `useFilters` hooks ported from redesign.
- `SearchFilterBar` from `@eatme/ui/compose/`. Dynamic import for any heavy filter widgets to stay under the admin app's (non-strict) budget.
- If a search-friendly index doesn't already exist on `restaurants.name`, add a migration `supabase/migrations/116c_restaurants_name_trgm.sql` enabling `pg_trgm` + a GIN index. Pre-flight audit in Phase 0 confirms the index doesn't yet exist.

### Test requirements

- Playwright (`apps/admin/tests/e2e/browse.spec.ts`): admin user signs in → lands on `/restaurants` → sees paginated DataTable → searches for "Cafe" → < 1 s response time on a 1000-row staging dataset.
- Vitest: the `isAdmin(user)` helper gate works — signing in a non-admin at `/signin` and being redirected to `/signin?forbidden=1` is covered (also see Step 4 Playwright).
- Integration test: `EXPLAIN ANALYZE` of the `restaurants.name` search uses the new index.
- Accessibility: DataTable rows are keyboard-focusable; filter dropdowns ARIA-labelled.

### Integration

Depends on Steps 2 + 4 + 6. First admin-side surface. Consumed by Step 23 (edit view) + Step 25 (bulk-import output visible here).

### Demo

Admin user (`app_metadata.role = 'admin'` set via service-role script) signs in, lands on `/restaurants`, sees 50 rows per page, searches "Test Cafe" — filter completes in < 300 ms against staging.

### Commit convention

`feat(v2): admin app — restaurant browse + search + DataTable (plan step 22)`

---

## Step 23: Admin restaurant edit (admin-only fields: `is_active`, suspension) + audit log writes

### Objective

Build `/restaurants/[id]` admin edit view. Exposes every owner field plus admin-only fields (`is_active` toggle with required suspension reason, `suspended_at` / `suspended_by` audit trail, raw-DB inspector panel). Every admin mutation writes to `admin_audit_log`.

### Implementation guidance

- `app/(admin)/restaurants/[id]/page.tsx` — RSC, loads the restaurant via service-role client inside a `withAdminAuth`-wrapped read helper (admin bypasses owner RLS).
- Reuse the section components from Step 16 (`BasicInfoSection`, `LocationSection`, …) but hosted in an admin-shell wrapper that adds the admin-only fields as a separate `<AdminSuspensionSection />`.
- `suspendRestaurant` Server Action wrapped in `withAdminAuth`: validates a Zod schema `{is_active: boolean, reason?: string}` (reason required when `is_active=false`), updates `restaurants.is_active` + `suspended_at` + `suspended_by` + `suspension_reason`, inserts an `admin_audit_log` row with `action='suspend_restaurant' | 'unsuspend_restaurant'`, the changed fields, and the actor id.
- Raw-DB inspector panel: JSON view of the full row. Read-only. Dynamic-imported.
- Every other admin edit path (basic info, hours, etc.) writes an `admin_audit_log` row. Factor into a tiny helper `logAdminAction(ctx, action, target)` in `apps/admin/src/lib/audit.ts`.

### Test requirements

- Vitest: `suspendRestaurant` requires a `reason` when `is_active=false`; optional otherwise.
- Vitest: every admin Server Action writes an `admin_audit_log` row with the correct actor id and action name. Mock the audit helper and assert the call.
- Playwright: admin suspends a restaurant with reason "spam listings" → row flips to `is_active=false` → the owner's `(app)/restaurant/[id]` page chip shows `Suspended` per design §10 Risk 1.
- Playwright: non-admin user calling the action directly (via DevTools) returns `{ok:false, formError:'FORBIDDEN'}` — the wrapper catches them.

### Integration

Depends on Step 22 (browse). Consumed by Step 25's audit log viewer.

### Demo

Admin opens a restaurant, toggles `is_active=false`, types "spam listings" as reason, saves. Visits `/audit` (placeholder until Step 25) or queries `admin_audit_log` directly — a new row is present.

### Commit convention

`feat(v2): admin restaurant edit + is_active suspension + admin_audit_log writes (plan step 23)`

---

## Step 24: Admin menu-scan power tool — batch upload, raw prompt/response inspector, replay

### Objective

Ship the admin-side menu-scan tool that is more powerful than the owner version: batch upload (multiple menus in one session), raw prompt/response JSON inspector, per-dish confidence + flag toggle, "replay with different model" action.

### Implementation guidance

- `app/(admin)/menu-scan/page.tsx` — RSC queue view of all `menu_scan_jobs`. Admin-only filter to show all owners' jobs.
- `app/(admin)/menu-scan/[jobId]/page.tsx` — RSC with a client shell. Same Realtime subscription as Step 21 plus extra admin-only panels: raw prompt (extracted from `extraction_model` + `input`), raw OpenAI response (`result_json` with no summarisation), confidence per dish.
- Batch upload: dynamic-imported `pdfjs-dist` rasterises multi-page PDFs client-side; each page becomes a separate upload + `menu_scan_jobs` row, optionally linked to different restaurants via a picker.
- Replay action: `replayMenuScan(jobId, {model: 'gpt-4o-mini'|'gpt-4o'})` wrapped in `withAdminAuth` — duplicates the job's `input` into a fresh row with the chosen model, kicks off the worker (fires a direct `POST /functions/v1/menu-scan-worker` to avoid waiting for cron, with service-role bearer in the Server Action's context).
- Admin can manually flip a job from `needs_review` to `failed` or vice versa for debugging; every such change writes to `admin_audit_log`.
- Bundle: all admin-only libs (`pdfjs-dist` for PDF rasterisation) dynamic-imported inside `/menu-scan` route tree only.

### Test requirements

- Playwright: admin uploads a 3-page PDF → three jobs appear in the queue → one completes → admin clicks "Replay with gpt-4o-mini" → a fourth job appears with the mini result.
- Vitest: `replayMenuScan` requires `app_metadata.role === 'admin'` (happy path) and returns `FORBIDDEN` for owners.
- Vitest: the raw-response inspector renders `result_json` without mangling (JSON.stringify identity).
- Integration test: the direct `POST /functions/v1/menu-scan-worker` call from `replayMenuScan` returns 200 and the worker processes the new job.

### Integration

Depends on Steps 19 + 20 + 21 (the whole menu-scan pipeline) + Step 22 (admin shell). Inherits design §2.2 spec.

### Demo

Admin drops a 3-page PDF in `/menu-scan`, assigns each page to a different restaurant. Within 90 s all three jobs land in `needs_review`. Admin opens one, sees the raw OpenAI response, clicks Replay with mini — a fourth job appears and finishes in 30 s with a different result.

### Commit convention

`feat(v2): admin menu-scan power tool — batch PDF + raw inspector + replay (plan step 24)`

---

## Step 25: Admin bulk import — CSV + Google Places + `admin_audit_log` viewer

### Objective

Ship `/imports` (CSV + Google Places Nearby Search) and `/audit` (read-only `admin_audit_log` viewer). Bulk imports insert with `possible_duplicate` flags at query time per `prior-work-consolidation §7`.

### Implementation guidance

- `app/(admin)/imports/page.tsx` — RSC; renders two client tabs, CSV and Places. Dynamic-import `papaparse` inside the CSV tab.
- CSV Server Action `importCsv` wrapped in `withAdminAuthRoute` (accepts a large file body → use a Route Handler, not a Server Action, to get POST body streaming per `nextjs-foundation §2`). Route at `app/api/admin/import-csv/route.ts`. Validates each row via a Zod schema, dedups on `google_place_id`, inserts with warning flags computed at query time.
- Google Places flow: admin enters coords + radius → `fetchGooglePlaces` Server Action hits the Nearby Search (New) API with a FieldMask header per `prior-work-consolidation §7`, writes rows into `restaurant_import_jobs` and `restaurants`, dedup via existing `google_place_id` unique index.
- Both flows insert restaurants with `status='draft'` (not `'published'`) so admin can curate before exposing — decision consistent with v2's draft lifecycle. Document this explicitly; admins can bulk-publish from the DataTable later.
- `/audit/page.tsx` — RSC DataTable over `admin_audit_log`. Filters: actor, date range, action. Read-only. Reuses DataTable from Step 22.

### Test requirements

- Vitest: `importCsv` rejects malformed rows with a per-row error list; duplicates (matching `google_place_id`) are silently skipped; fuzzy duplicates (name + 200 m) are inserted with `possible_duplicate=true`.
- Playwright (`apps/admin/tests/e2e/bulk-import-csv.spec.ts`): admin uploads a 10-row CSV → 10 rows appear in `/restaurants` with appropriate flag chips.
- Vitest: the audit log viewer filters by actor correctly; date range inclusive on both ends.
- Vitest: Google Places fetch cost-caps at 1000 rows per job (hard server-side bound); exceeding returns `VALIDATION` error.

### Integration

Depends on Steps 22 + 23 (DataTable + audit helper). Closes the admin-app surface. Draft-state imports coexist cleanly with Step 27 (Phase 4 RLS) — imports are never consumer-visible until an owner or admin flips `status='published'`.

### Demo

Admin uploads a 10-row CSV; `/restaurants` fills with 10 new draft rows. Admin clicks one marked `possible_duplicate` and confirms it's a real duplicate, archives it. `/audit` shows three audit rows: CSV import, archive, and the flag-acknowledge.

### Commit convention

`feat(v2): admin bulk import (CSV + Google Places) + audit log viewer (plan step 25)`

---

## H. E2E + release

## Step 26: Playwright gold paths — signup/onboard, menu-scan, publish Realtime, admin CSV

### Objective

Bundle the four release-gating Playwright suites, fully fleshed out, with shared fixtures. These run in CI on every owner-app and admin-app deploy and block merges on failure.

### Implementation guidance

- Suite 1: `signup → onboard → first restaurant draft persists across page close` (design §7). Builds on the scaffold from Step 15 / 16.
- Suite 2: `menu scan upload → Realtime progress → confirm → dishes appear`. Builds on Step 21.
- Suite 3: `publish → Realtime event reaches a second browser session`. Builds on Step 18.
- Suite 4: `admin bulk import (CSV happy path)`. Builds on Step 25.
- Shared fixtures in `apps/web-portal-v2/tests/e2e/fixtures/`: `createAuthedBrowser(userRole)`, `seedRestaurant()`, `resetDb()` utility (truncates test-schema-only tables via service-role client; never touches prod).
- Worker config: 4 shards in CI, running against staging Supabase. A teardown hook cleans seeded rows by tag (`test_run_id`).
- Playwright reporter: HTML + GitHub Actions annotations. Screenshots + traces on failure.

### Test requirements

- All four suites green end-to-end against staging — the 5-minute onboarding → publish budget from design §2.5 is asserted in Suite 1 + Suite 3 (`expect(elapsedMs).toBeLessThan(5 * 60_000)`).
- Menu-scan suite asserts the 90-second extract-to-review budget (design §2.5). Allow a 30 s tolerance for staging OpenAI latency variance.
- Admin CSV asserts the 3-second search budget on a 1000-row staging dataset (design §2.5, §2.2).
- Flake rate in CI over 10 consecutive runs ≤ 10% per suite.

### Integration

Depends on every E- and F- and G-phase step. Gates Step 27 (Phase 4 migration deploy) and Step 28 (canary cutover). Without 4-suite green, no prod deploy.

### Demo

`turbo test:e2e --filter web-portal-v2 --filter admin` runs against staging and reports "4 suites, 0 failures, 87 assertions passed in 8m 14s."

### Commit convention

`test(v2): Playwright gold paths — signup/onboard, menu-scan, publish, admin CSV (plan step 26)`

---

## Step 27: Migration 123 — RLS tightening (the one-way door)

### Objective

Run the one-way-door migration that flips `restaurants` / `menus` / `dishes` SELECT policies from `USING (true)` to `USING (status = 'published')` for anon readers (with a second owner-or-admin SELECT policy keyed on ownership). **Preconditions are hard-gated: every release-safety check must be green, Phase 3 mobile must be in production ≥ 48 h.**

### Implementation guidance

- File: `supabase/migrations/123_tighten_public_read_rls.sql`. Body verbatim from `release-safety §6.2` + design §5.4.
- Pre-written reverse migration `123_REVERSE_ONLY_restore_public_read.sql` per `release-safety §6.4` — sub-60-second rollback capability.
- **Explicit preconditions recorded in the PR description and enforced by a release-checklist template**:
  1. `turbo release-safety --filter web-portal-v2` green (Step 12 suite, run against staging within 15 min of deploy).
  2. Phase 0 pre-flight audit queries from `release-safety §2.1` all return 0 against **production**.
  3. Phase 3 mobile patch (Step 13) **in production** — i.e., store-published, not just submitted — for ≥ 48 h. Measured by latest EAS build id + app-store release date.
  4. Playwright gold paths (Step 26) green on the last successful CI run within the preceding 24 h.
  5. A 30-minute baseline of `nearby-restaurants` / `feed` / `group-recommendations` latency + error rate captured in the PR.
  6. Observability dashboard pinned; on-call designated; rollback script pre-staged.
- Deploy in a low-traffic window. Watch for 60 minutes (`release-safety §6.3`). Trigger rollback on: any consumer Edge Function error rate > 2× baseline, row-count drop > 5%, mobile crash rate spike.

### Test requirements

- Pre-flight automated check (wire into a `turbo release-safety:phase4-gate` task): re-runs the six Phase-0 queries + asserts all = 0, fails loudly if any is nonzero.
- Post-deploy: `turbo release-safety` re-runs against production — both suites (drafts-hidden + parity) must remain green.
- Staging rehearsal: apply 123 + reverse + 123 again on staging within 2 h of prod deploy. Schema + policy diff empty.
- Mobile staging smoke (manual): open map, open restaurant, open dish on the staging mobile build against the post-Phase-4 staging DB — no crashes.

### Integration

Hard-depends on Steps 6, 10, 11, 12, 13, 18, 26. This is the migration that makes drafts (now creatable via the v2 app since Step 18) invisible to consumers. After this step, the draft lifecycle is enforced at the database layer in addition to the Edge Function + mobile filter layers.

### Demo

Post-deploy: service-role client inserts a `draft` restaurant. Anon client queries `/functions/v1/nearby-restaurants` — the draft is absent. Flip to `'published'` via service role — it appears within 1 s. `cron.job_run_details` shows the menu-scan worker still ticking. No error-rate bump on the 60-minute dashboard window.

### Commit convention

`feat(v2): migration 123 — tighten public-read RLS to status='published' (plan step 27, Phase 4 one-way door)`

---

## Step 28: Canary deploy to `v2.portal.eatme.app` + admin subdomain + 7-day soak + DNS cutover ticket

### Objective

Deploy `apps/web-portal-v2/` and `apps/admin/` to separate Vercel projects behind a canary subdomain (`v2.portal.eatme.app`) and an admin subdomain (e.g., `admin.eatme.app`). v1 remains live at the current URL during a seven-day soak. DNS cutover of the primary domain is a **separate ticket** filed at the end of this step.

### Implementation guidance

- Vercel: two new projects. `web-portal-v2` pointed at `apps/web-portal-v2/`; `admin` pointed at `apps/admin/`. Each has its own env-var set: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, and (admin only) `SUPABASE_SERVICE_ROLE_KEY`. Staging + production environments per project.
- DNS: `v2.portal.eatme.app` CNAME to the owner-app Vercel deployment; `admin.eatme.app` CNAME to the admin deployment. v1's `portal.eatme.app` unchanged.
- Monitoring: Vercel Analytics + Supabase Dashboard alerts wired for error-rate > 1% and p95 > 500 ms.
- Owner outreach: signed-in banner on v1 pointing existing owners at `v2.portal.eatme.app` with "try the new portal" language. Email blast optional, timed 48 h after the canary goes live.
- The 7-day soak acceptance criteria (see design §1 end): zero P1 regressions, Playwright gold paths green on every deploy, Edge Function error rates flat.
- **File the DNS-cutover ticket** at the end of this step. The ticket specifies: swap `portal.eatme.app` DNS to the v2 project, deprecate v1 Vercel project (keep the deployment up but remove domain), set a 30-day reminder to archive v1 source code. Per design §8.4 + `release-safety §7.3`.

### Test requirements

- Synthetic monitoring: a Vercel Cron running `curl -fsS https://v2.portal.eatme.app/` every 5 min for the first 72 h — page-up signal.
- Daily soak check (manual): Playwright run against production v2; screenshot archived.
- Rollback rehearsal (staging): DNS flip back to v1 in < 30 min end-to-end. Any in-progress v2 drafts persist in DB and are inaccessible via v1 UI — expected and documented.

### Integration

Depends on Step 27 (Phase 4 RLS in place — drafts cannot leak to anon even if v2 deploy has a bug). Closes the plan. After this step, `v2.portal.eatme.app` is live, owners can self-migrate, v1 remains operational until the DNS cutover ticket lands.

### Demo

`curl -I https://v2.portal.eatme.app/` returns HTTP 200. A fresh user navigates to the canary, signs up, completes onboarding, publishes a restaurant, sees it appear in the consumer mobile app against production — all within 5 minutes. v1's `portal.eatme.app` is also still serving existing owners.

### Commit convention

`chore(v2): deploy web-portal-v2 + admin to canary subdomains; open DNS cutover ticket (plan step 28)`

---

_End of plan. The authoritative spec remains `design/detailed-design.md`; the runbook remains `research/release-safety.md`._
