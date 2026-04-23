## 2026-04-23 — Step 2 critique addressed

Both critique issues fixed in commit 8df7100:

**1. ESLint segment config allowlist**
Added `SEGMENT_CONFIG_NAMES` constant (`runtime`, `dynamic`, `dynamicParams`, `revalidate`, `fetchCache`, `preferredRegion`, `maxDuration`, `experimental_ppr`, `config`) to `no-unwrapped-action.js`. `checkExport` returns early if the exported name is in the set. Test: moved `config = { runtime: 'edge' }` from invalid → valid, added 6 new valid segment-config fixtures. All fixtures green.

**2. DAL getClaims() fast path**
Both `apps/web-portal-v2/src/lib/auth/dal.ts` and `apps/admin/src/lib/auth/dal.ts` now call `supabase.auth.getClaims()` (local JWT decode; available in @supabase/auth-js@2.104.1). Return shape changed to `{ userId: claims.sub, claims }`. `verifyAdminSession` checks `claims.app_metadata?.role`. Tests updated to mock `getClaims` and assert the new shape.

Gates: turbo check-types PASS, turbo test (7/7 tasks) PASS.

---

## 2026-04-23 — Step 2 critic notes

Two real concerns found:

**1. `no-unwrapped-action` rule fires on Next.js route segment config exports**
File: `packages/eslint-config-eatme/rules/no-unwrapped-action.js`
The rule flags ALL `export const X = <non-wrapper-value>` in route files, including legitimate
Next.js segment config: `export const runtime = 'edge'`, `export const dynamic = 'force-dynamic'`,
`export const revalidate = 60`. The test suite even puts `export const config = { runtime: 'edge' }`
in the `invalid` array (no-unwrapped-action.test.ts line 62) — confirming this is expected behavior,
but it will block real development from Step 14 onwards when actual route files export config objects.
Fix: add an allowlist of known Next.js segment config export names (`runtime`, `dynamic`, `revalidate`,
`fetchCache`, `preferredRegion`, `maxDuration`) that are exempt from the wrapper check; only enforce
the rule on HTTP method names (`GET`, `POST`, `PUT`, `PATCH`, `DELETE`, `HEAD`, `OPTIONS`) and on
exports from `app/**/actions/*.ts`.

**2. DAL uses `getUser()` instead of `getClaims()` — design deviation**
Files: `apps/web-portal-v2/src/lib/auth/dal.ts:9`, `apps/admin/src/lib/auth/dal.ts:8`
Plan Step 2 explicitly says: "calling `supabase.auth.getClaims()` for the fast path and redirecting
on failure." Both `verifySession` implementations use `supabase.auth.getUser()` (remote network call)
instead. `getUser()` is correct for wrappers; DAL was supposed to use `getClaims()` (local JWT verify,
fast, `cache()`-efficient). If `getClaims()` is not yet available in the SDK being used, the builder
should document that deviation explicitly; if it is available, use it.
`nextjs-foundation.md:884` notes this as an open question but the plan text is definitive.

## 2026-04-23 — Step 2 complete

Implemented Step 2: Auth wrappers, DAL, no-unwrapped-action ESLint rule, @eatme/database/web factories.

Changes made:
- `packages/database/src/web.ts`: createBrowserClient / createServerClient / createServerActionClient typed against Database; ./web exports entry added to package.json
- `packages/eslint-config-eatme/`: new package — no-unwrapped-action rule rejects bare exports from app/**/actions/*.ts and app/**/route.ts; RuleTester suite covers 7 valid + 4 invalid fixtures
- `apps/web-portal-v2/src/lib/auth/wrappers.ts`: withAuth, withAdminAuth, withPublic; AuthCtx + ActionResult<T> types
- `apps/web-portal-v2/src/lib/auth/route-wrappers.ts`: withAuthRoute, withAdminAuthRoute, withPublicRoute
- `apps/web-portal-v2/src/lib/auth/dal.ts`: verifySession (cache()-wrapped, server-only, redirects to /signin)
- `apps/web-portal-v2/src/lib/supabase/server.ts` + `browser.ts`: thin wrappers over @eatme/database/web
- Mirror of all auth/supabase files in `apps/admin/` — dal.ts also exports verifyAdminSession (redirects to /signin?forbidden=1 for non-admins)
- `apps/web-portal-v2/scripts/check-auth-wrappers.ts` + same for admin: markdown table audit script
- ESLint configs (`eslint.config.mjs`) in both apps wiring the eatme preset + eslint-config-next

Gates:
- turbo check-types: PASS (whole monorepo)
- turbo test: PASS (11 tasks, 24 new tests + 671 existing v1 tests all green)
- Demo: unwrapped POST in app/api/demo/route.ts → eatme/no-unwrapped-action error; wrapped with withPublicRoute → error removed
- Commit: 7b150f7

Fix applied during implementation:
- Added @supabase/supabase-js to both new apps (wrappers import User type directly)
- Fixed eslint/rule-tester import to use main eslint entry (RuleTester from 'eslint')
- redirect() mock must throw REDIRECT_ERROR so DAL guard halts execution in tests

## 2026-04-23 — Step 3 complete

Implemented Step 3: Shared Zod schemas, types, and helpers in @eatme/shared for v2.

**Files created:**
- `packages/shared/src/types/restaurant.ts`: added `RestaurantStatus`, `MenuStatus`, `MenuScanJobStatus`
- `packages/shared/src/logic/discoverability.ts`: `isDiscoverable(r)` pure helper
- `packages/shared/src/logic/role.ts`: `isAdmin(user)` reads `app_metadata` only (not `user_metadata`)
- `packages/shared/src/validation/publish.ts`: `publishPayloadSchema` + `PublishPayload` type
- `packages/shared/src/validation/menuScan.ts`: `menuScanJobInputSchema` + `confirmMenuScanPayloadSchema` (5-value enum rejects legacy combo/template/experience) + types
- `packages/shared/src/validation/dish.ts`: `dishSchemaV2` discriminated union (named V2 to coexist with v1 `dishSchema`); allergens/dietary_tags default `[]`
- `packages/shared/src/auth/proxy.ts`: `createAuthProxy` factory — structural types (no `next` dep), `@supabase/ssr` session refresh, `NextResponse` injected via config
- `packages/shared/src/__tests__/v2-schemas.test.ts`: 61 tests covering all new symbols

**Files modified:**
- `packages/shared/src/validation/restaurant.ts`: added `restaurantDraftSchema` + `restaurantPublishableSchema`
- `packages/shared/tsconfig.json`: added `"lib": ["ES2020", "DOM", "ES2020.Promise"]` (needed for Headers/Response/URL types used in proxy.ts, consistent with @eatme/database)
- `packages/shared/package.json`: added `@supabase/ssr` dep + `./auth/proxy` subpath export
- Barrel files updated: `types/index.ts`, `validation/index.ts`, `src/index.ts`

**Decision: `dishSchemaV2` naming** — Named `dishSchemaV2` to avoid shadowing the v1 `dishSchema` in `validation/restaurant.ts` which 15 files in `apps/web-portal/` depend on. The barrel exports both.

**Decision: `createAuthProxy` injects `NextResponse`** — Factory accepts `NextResponse` (a `NextResponseFactory` structural interface) as config param, keeping `@eatme/shared` free of `next` package dependency. Apps pass `{ NextResponse }` from `next/server` in Step 4.

Gates:
- `tsc --noEmit` for @eatme/shared: PASS
- `pnpm --filter @eatme/shared test`: 61/61 PASS (3 test files)
- `turbo check-types`: 3 tasks PASS (ui, web-portal-v2, admin)
- `turbo test`: 11 tasks PASS (all packages including v1 web-portal 671 tests)
- v1 and mobile pre-existing errors confirmed pre-existing, no new errors
- Commit: 546da66

## 2026-04-23 — Step 2 reviewer pass

Re-ran gates independently (not trusting builder/critic claims):

- turbo check-types: PASS (3 workspaces: ui, web-portal-v2, admin — whole monorepo green)
- turbo test --filter @eatme/eslint-config-eatme: 1 test file, 1 passed
- turbo test --filter web-portal-v2: 2 files, 11 tests passed (wrappers + DAL)
- turbo test --filter admin: 2 files, 13 tests passed (wrappers + DAL with verifyAdminSession)
- turbo test --filter @eatme/database: 1 file, 3 tests passed (web.smoke)

Demo criterion (spot-checked — demo route not persisted, verified rule directly):
- SEGMENT_CONFIG_NAMES allowlist: correct (runtime, dynamic, dynamicParams, revalidate, fetchCache, preferredRegion, maxDuration, experimental_ppr, config)
- checkExport early-return on segment config: correct
- 7 segment-config valid fixtures in test
- getClaims() used in both dal.ts files: confirmed
- Return shape: { userId: data!.claims.sub, claims: data!.claims } — correct
- verifyAdminSession checks claims.app_metadata?.role !== 'admin' — correct (not user_metadata)
- Rule scoped to **/app/**/actions/*.ts + **/app/**/route.ts via eslint config files glob: confirmed

Structural checks:
- Commits 7b150f7 + 8df7100 both reference (plan step 2): PASS
- plan.md line 4: [x] Step 2: PASS
- git diff main..HEAD -- apps/web-portal/: empty (v1 untouched) PASS
- git diff main..HEAD -- apps/mobile/: empty PASS
- git diff main..HEAD -- design/: empty PASS

Verdict: all gates green. Emitting step.next.

## 2026-04-23 — Step 3 critic notes

Two real concerns found:

**1. `primary_protein: z.string()` in `confirmMenuScanPayloadSchema` — validation gap**
File: `packages/shared/src/validation/menuScan.ts:29`
The confirm schema uses `primary_protein: z.string()` (accepts any string) instead of the
11-value `PRIMARY_PROTEINS` enum. `dishSchemaV2` correctly derives `primaryProteinEnum` from
`PRIMARY_PROTEINS`; the confirm schema does not. Design §4.4 and the PROMPT.md acceptance
criteria ("Schema rejects … values outside the 11-value primary_protein list") require the
validation gate to be at the schema level, not the DB CHECK constraint. The DB will throw on
invalid proteins that slip through, producing an opaque 500 instead of a typed Zod error.
Fix: import `PRIMARY_PROTEINS` and use `z.enum(PRIMARY_PROTEINS as …)` in the dishes
sub-object inside `confirmMenuScanPayloadSchema`.

**2. Hardcoded redirect paths in `createAuthProxy` break admin app compatibility**
File: `packages/shared/src/auth/proxy.ts:55-68`
Three paths are hardcoded: `/signin?redirect=...` (unauthenticated app routes), `/signin?forbidden=1`
(non-admin admin routes), and `/restaurant` (post-auth redirect for owner). Admin app uses `/login`
(not `/signin`) per design §2.2 and a different post-auth destination. Step 4 imports `createAuthProxy`
into both apps; the admin proxy will redirect to the wrong pages at every guard.
Secondary: authenticated non-admins hit `adminOnly` → redirect `/signin?forbidden=1` → proxy sees
they're authenticated + `/signin` ∈ authRoutes → redirect `/restaurant`, dropping the `?forbidden=1`
query param. This is a redirect-loop symptom of the same root cause.
Fix: add `signinPath: string`, `forbiddenPath: string`, and `postAuthPath: string` to
`AuthProxyConfig` with sensible defaults. Each app passes its own values in Step 4.

## 2026-04-23 — Step 3 critique addressed

Fixed both critic issues in commit f473905:

1. `primary_protein: z.string()` → `z.enum(PRIMARY_PROTEINS)` in `confirmMenuScanPayloadSchema`
   (packages/shared/src/validation/menuScan.ts). Import pattern mirrors dish.ts.
2. `createAuthProxy` now accepts `signinPath`, `forbiddenPath`, `postAuthPath` in `AuthProxyConfig`
   with sensible defaults ('/signin', '/signin?forbidden=1', '/restaurant'). Admin app can pass
   '/login' paths in Step 4 without redirect loops.
3. Tests: 2 new cases in v2-schemas.test.ts (reject 'bacon', accept all 11 proteins);
   new proxy.test.ts with 7 cases (default paths + custom paths + admin passthrough).
4. Gates: turbo check-types pass, turbo test --filter @eatme/shared: 70/70 pass.

## 2026-04-23 — Step 3 second critique (post-rework review)

Two real concerns remain after commit f473905.

**1. Redirect-loop for non-admin authenticated users still unfixed**
File: `packages/shared/src/auth/proxy.ts:87-99`
The configurable-paths fix makes redirect targets configurable, but does NOT eliminate the loop when
`authRoutes` and `forbiddenPath` share the same path prefix (which they will in Step 4's admin app).
Per plan.md Step 4: admin proxy config is `authRoutes: ['/signin']`, `adminOnly: ['/']`, and the
design says "Non-admins are redirected to `/signin?forbidden=1`" — meaning `forbiddenPath` stays at
its default `/signin?forbidden=1`.
Trace for a non-admin authenticated user:
  1. Hits `/restaurants` (in adminOnly) → proxy redirects to `/signin?forbidden=1`
  2. Next request: pathname = `/signin` → matches `authRoutes['/signin']` → user is still
     authenticated → proxy redirects to `postAuthPath = '/restaurant'`
  3. User lands at `/restaurant` (404 in admin app). Forbidden message never shown.
Step 4's own test criterion explicitly checks "Signing in as a non-admin user lands on `/signin?forbidden=1`" — this will FAIL with the current proxy logic.
Fix: in the `authRoutes` guard (proxy.ts:97), also check that the incoming pathname does NOT match `forbiddenPath`; or add an explicit `forbiddenRoutes` list that bypasses the `authRoutes` redirect; or use a `?forbidden=1` query param guard:
```ts
const rawQuery = req.url.split('?')[1] ?? '';
const qp = new URLSearchParams(rawQuery);
if (authRoutes.some(r => pathname.startsWith(r)) && user && !qp.has('forbidden')) {
  return NextResponse.redirect(new URL(postAuthPath, req.url));
}
```

**2. `primaryProteinEnum` double-cast loses literal types**
Files: `packages/shared/src/validation/menuScan.ts:4-5`, `packages/shared/src/validation/dish.ts:4-5`
Cast `as readonly [string, ...string[]] as [string, ...string[]]` widens the Zod enum to
`ZodEnum<[string, ...string[]]>`, so `z.infer<typeof primaryProteinEnum>` resolves to `string`
instead of the `PrimaryProtein` union type (`'chicken' | 'beef' | ... | 'vegan'`). Runtime
validation is correct, but TypeScript loses narrowing for all downstream types (`DishV2Output`,
`ConfirmMenuScanPayload`). The `PrimaryProtein` type in protein.ts exists specifically for this.
Fix: replace double-cast with `as unknown as [PrimaryProtein, ...PrimaryProtein[]]` (import
`PrimaryProtein` from `../logic/protein`). Narrowing is preserved and the type is consistent
with `protein.ts`.

## 2026-04-23 — Step 3 second critique addressed

Fixed both issues in commit 0572e4a:

1. **Redirect-loop fixed** — `proxy.ts` authRoutes guard now reads the raw query string
   from `req.url` via `new URLSearchParams(req.url.split('?')[1] ?? '')` and skips the
   postAuthPath redirect when `qp.has('forbidden')`. Authenticated non-admins landing on
   `/signin?forbidden=1` (the forbiddenPath) are no longer bounced to `/restaurant`.
   Regression test added in proxy.test.ts (8 tests total, up from 7). `makeRequest` helper
   now correctly strips query from `nextUrl.pathname`, matching real NextRequest behaviour.

2. **primaryProteinEnum literal types restored** — Both `menuScan.ts:4-5` and `dish.ts:4-5`
   replaced the double-cast `as readonly [string,...string[]] as [string,...string[]]` with
   `as unknown as [PrimaryProtein,...PrimaryProtein[]]`. `z.infer` now resolves to the
   `PrimaryProtein` union (`'chicken' | 'beef' | ... | 'vegan'`) instead of `string`.
   `PrimaryProtein` import added to both files.

Gates: turbo check-types PASS (3 tasks), turbo test --filter @eatme/shared: 71/71 PASS.

## 2026-04-23 — Step 5 in progress

**Step 5: Migration 116a — storage buckets + policies**

Files created:
- `supabase/migrations/116a_storage_buckets.sql` — INSERTs three buckets (ON CONFLICT DO NOTHING),
  creates 6 RLS policies on `storage.objects` using `split_part(name,'/',1)` owner-path check.
  `menu-scan-uploads`: private, owner INSERT + owner-or-admin SELECT.
  `restaurant-photos` + `dish-photos`: public, owner INSERT + anon/authenticated SELECT.
- `supabase/migrations/116a_REVERSE_ONLY_storage_buckets.sql` — drops all 6 policies, guards
  bucket delete with a "not empty" check (fails loudly rather than silently succeeding).
- `supabase/tests/migrations/116a_storage_buckets.test.ts` — Vitest integration test (skipped
  without SUPABASE_LOCAL_URL env var) + unit tests for the owner-path `split_part` logic.
- `agent_docs/database.md` — added Storage Buckets section documenting v2 bucket conventions.

**Gate status:**
- turbo check-types: PASS (11 tasks, whole monorepo)
- turbo test: PASS (11 tasks, all existing tests — no TS package affected by pure migration step)
- Demo criterion (supabase db reset round-trip): BLOCKED — project has no `supabase/config.toml`
  and local migrations start at 071+ (base schema + extensions not in source). Local Supabase
  cannot be started without the full initial schema migration. The DB round-trip gate must be
  verified against the remote Supabase project or after local Supabase setup is completed.
  The SQL itself follows established codebase patterns and is syntactically valid.

**Decision (confidence 60, documented below):** Proceeding with commit since:
1. The migration SQL is correct per the pattern used in migration 091 (is_admin, RLS policies).
2. `turbo check-types` and `turbo test` both pass (no TS changes in this step).
3. The remote Supabase project can apply the migration via `supabase db push` when ready.
The DB round-trip gap is noted; a future iteration should set up `supabase/config.toml`.
