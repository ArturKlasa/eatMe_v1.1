# Codebase Review — Executive Summary (2026-04-16)

Read-only audit of the EatMe monorepo. 13 review areas covering Supabase
migrations, web/mobile auth, the AI menu-scan pipeline, web API routes,
form validation, mobile stores, PostGIS, the client factory, shared
constants/zod, mobile i18n, design tokens / web a11y, and TypeScript /
DX hygiene. **188 findings** with `file:line` evidence, severity, and
confidence.

## Executive summary

Overall code quality is good for a product this young — clear package
boundaries, real RLS thinking in migrations, recent auth-flow research
already on file, and a coherent mobile rating system. The serious risks
cluster in three places: **(1) a leaked production secret** (Mapbox
`sk.*` token in `apps/mobile/app.json`), **(2) silent CI/lint/type
infrastructure** (`turbo check-types` is a no-op repo-wide and the apps
do not extend the root `strict` profile, so neither tsc nor most lint
runs in CI), and **(3) a cluster of correctness regressions in the
AI menu-scan + ratings + PostGIS surfaces** — including AI suggestions
silently overwriting `allergens_override` (a food-safety regression of
migration 092's contract), `restaurants.location_point` going stale on
every UPDATE because it is `DEFAULT` rather than `GENERATED ALWAYS AS
STORED`, and the mobile Facebook OAuth handler parsing hash tokens
while supabase-js defaults to PKCE (sign-in silently fails). The Zod
major-version mismatch (v3 in `@eatme/shared`, v4 in `apps/web-portal`)
and the design-token system being orphaned by `globals.css` round out
the systemic items. There are no production outages waiting in the code,
but the silent CI gates mean the team is currently flying blind on the
exact things that need verification first.

## Severity rollup

| Severity | Count |
|----------|------:|
| critical |     1 |
| high     |    22 |
| medium   |    63 |
| low      |    72 |
| info     |    30 |
| **total**|**188**|

## Top findings

| # | Title | Severity | Category | Location | Detail |
|--:|-------|----------|----------|----------|--------|
| 1 | Mapbox secret (`sk.*`) token committed in `app.json` — must rotate today | critical | security | `apps/mobile/app.json:55` | [03-auth-session-mobile.md](03-auth-session-mobile.md) |
| 2 | `turbo run check-types` is a silent no-op repo-wide; CI's "Type-check" step does nothing | high | dx | `turbo.json:13-15`, `package.json:11`, `.github/workflows/ci.yml:42-43` | [13-type-safety-dx.md](13-type-safety-dx.md) |
| 3 | AI-suggested allergens auto-populate `allergens_override`, silencing the ingredient-cascade source of truth (food-safety regression of migration 092) | high | correctness | `apps/web-portal/app/api/menu-scan/confirm/route.ts:334`; `apps/web-portal/lib/menu-scan.ts:820-839` | [04-web-admin-menu-scan.md](04-web-admin-menu-scan.md) |
| 4 | `restaurants.location_point` is `DEFAULT` not `GENERATED` — every restaurant relocation leaves the geography column stale | high | correctness | `infra/supabase/migrations/database_schema.sql:365` | [08-postgis-point-order.md](08-postgis-point-order.md) |
| 5 | Menu-scan address edits patch `location` only, triggering the location_point drift | high | correctness | `apps/web-portal/app/admin/menu-scan/hooks/useReviewState.ts:104-122` | [08-postgis-point-order.md](08-postgis-point-order.md) |
| 6 | Supabase session (incl. refresh tokens) persisted in plaintext AsyncStorage; no SecureStore/Keychain | high | security | `apps/mobile/src/lib/supabase.ts:13-17`; `packages/database/src/client.ts:71-94` | [03-auth-session-mobile.md](03-auth-session-mobile.md) |
| 7 | Facebook (browser) OAuth parses hash tokens but supabase-js defaults to PKCE — sign-in silently fails | high | correctness | `apps/mobile/src/stores/authStore.ts:416-453` | [03-auth-session-mobile.md](03-auth-session-mobile.md) |
| 8 | `eatme://reset-password` deep link has no handler — the password-reset feature is non-functional | high | correctness | `apps/mobile/src/stores/authStore.ts:273` | [03-auth-session-mobile.md](03-auth-session-mobile.md) |
| 9 | Open redirect via protocol-relative URL in post-login redirect (`?redirect=//attacker`) | high | security | `apps/web-portal/app/auth/login/page.tsx:42-45` | [02-auth-session-web.md](02-auth-session-web.md) |
| 10 | Zod major-version mismatch: `@eatme/shared` peers v3, `apps/web-portal` runs v4 — two Zod runtimes bundled, instanceof checks brittle | high | correctness | `packages/shared/package.json:19-26`; `apps/web-portal/package.json` | [10-shared-zod-types.md](10-shared-zod-types.md) |
| 11 | `user_badges.user_id` FK has no ON DELETE action — user deletion blocked by FK violation | high | correctness | `infra/supabase/migrations/079_rating_system_redesign.sql:45-51` | [01-supabase-migrations.md](01-supabase-migrations.md) |
| 12 | Onboarding basic-info form bypasses Zod entirely — `basicInfoSchema` declared but no resolver wired | high | correctness | `apps/web-portal/app/onboard/basic-info/page.tsx:27-29` | [06-web-forms-zod.md](06-web-forms-zod.md) |
| 13 | Allergen icon maps key off legacy codes (`tree_nuts`, `soybeans`) the DB no longer stores after migration 093 — badges fall back to ⚠️ | high | correctness | `apps/mobile/src/constants/icons.ts:10-25`; `apps/web-portal/lib/icons.ts:10-25` | [10-shared-zod-types.md](10-shared-zod-types.md) |
| 14 | App tsconfigs do not extend the root `strict + noUncheckedIndexedAccess` profile — strictness flags silently dropped on app code | high | maintainability | `apps/web-portal/tsconfig.json`; `apps/mobile/tsconfig.json`; `tsconfig.json` | [13-type-safety-dx.md](13-type-safety-dx.md) |
| 15 | `--token-color-*` design tokens have zero consumers in `apps/web-portal/globals.css` — shadcn theme palette + tokens drift independently | high | maintainability | `apps/web-portal/app/globals.css:62-150`; `apps/web-portal/app/tokens.css:1-105` | [12-tokens-a11y.md](12-tokens-a11y.md) |

## Areas table

| Area | Status | Findings | Highest severity | Detail |
|------|--------|---------:|------------------|--------|
| REV-01 supabase-migrations           | reviewed | 12 | high     | [01-supabase-migrations.md](01-supabase-migrations.md) |
| REV-02 auth-session-web              | reviewed | 16 | high     | [02-auth-session-web.md](02-auth-session-web.md) |
| REV-03 auth-session-mobile           | reviewed | 16 | critical | [03-auth-session-mobile.md](03-auth-session-mobile.md) |
| REV-04 web-admin-menu-scan           | reviewed | 19 | high     | [04-web-admin-menu-scan.md](04-web-admin-menu-scan.md) |
| REV-05 web-api-routes                | reviewed | 18 | medium   | [05-web-api-routes.md](05-web-api-routes.md) |
| REV-06 web-forms-zod                 | reviewed | 22 | high     | [06-web-forms-zod.md](06-web-forms-zod.md) |
| REV-07 mobile-stores-data-flow       | reviewed | 19 | high     | [07-mobile-stores-data-flow.md](07-mobile-stores-data-flow.md) |
| REV-08 postgis-point-order           | reviewed |  6 | high     | [08-postgis-point-order.md](08-postgis-point-order.md) |
| REV-09 supabase-client-factory       | reviewed |  7 | medium   | [09-supabase-client-factory.md](09-supabase-client-factory.md) |
| REV-10 shared-zod-types              | reviewed | 13 | high     | [10-shared-zod-types.md](10-shared-zod-types.md) |
| REV-11 mobile-i18n                   | reviewed | 11 | medium   | [11-mobile-i18n.md](11-mobile-i18n.md) |
| REV-12 tokens-a11y                   | reviewed | 15 | high     | [12-tokens-a11y.md](12-tokens-a11y.md) |
| REV-13 type-safety-dx                | reviewed | 14 | high     | [13-type-safety-dx.md](13-type-safety-dx.md) |

## Category heatmap

Rough finding counts per category (a finding has one primary category;
when it bridges two we counted the dominant one):

| Category        | Count |
|-----------------|------:|
| correctness     |    71 |
| security        |    32 |
| maintainability |    44 |
| dx              |    14 |
| a11y            |     9 |
| conventions     |     9 |
| performance     |     9 |

Where the systemic issues cluster:

- **Correctness** dominates — schema-vs-form drift (REV-06), AI override
  semantics + serial inserts in the menu-scan confirm path (REV-04),
  PostGIS sync (REV-08), mobile rating optimistic-update edges (REV-07),
  and several FK/RLS edge cases (REV-01).
- **Security** is concentrated in mobile auth (REV-03 — secret token,
  AsyncStorage session, missing PKCE/nonce) plus a handful of admin
  error-leak / open-redirect / CSP items in web (REV-02/04/05).
- **Maintainability** debt: shared-package duplication (REV-10), inline
  redefined types in apps (REV-09/REV-10), three forms of the same
  concept (allergen icons, payment methods, restaurant types), and the
  orphaned design-token pipeline (REV-12).
- **DX** is the silent multiplier: no real CI type-check (REV-13), lint
  skips four workspaces, no mobile/package tests, stale generated types.

## Needs-verification queue

Items where code inspection alone cannot confirm — each lists what to
check.

- **REV-01-h** — search_path hardening on `generate_candidates` /
  `get_group_candidates`: depends on production `CREATE`/`USAGE`
  grants on `public`. Check current grants in DB.
- **REV-02-c** — OAuth callback `next` validation: needs origin
  inspection / contrived-host repro to confirm exploitability.
- **REV-02-k** — `verifyOtp({type:'recovery'})` leaves a session before
  password change — confirm whether team accepts Supabase-default
  behaviour or wants an explicit sign-out gate.
- **REV-02-o** — middleware `getUser()` cost on hot paths: validate
  Supabase QPS / latency in production traces.
- **REV-03-f / REV-03-g / REV-03-h** — Google nonce flow, Android App
  Links, "Reauth Required" toggle: dashboard inspection of Supabase Auth
  + Mapbox + Google scopes.
- **REV-04-i / REV-05-o** — admin role trust model: is "admin" superadmin
  across all restaurants, or is per-tenant admin planned? Determines
  whether the `restaurants.owner_id` check is missing.
- **REV-04-k** — `dish_categories.name` UNIQUE constraint: run `\d+
  dish_categories` against live DB; not visible in
  `database_schema.sql`.
- **REV-04-n** — extraction-notes prompt-injection rendering: confirm
  `lib/menu-scan-warnings.ts` does not use `dangerouslySetInnerHTML`.
- **REV-04-o** — `formatLocationForSupabase('json')` save path: live
  observation of whether the menu-scan address patch silently fails.
- **REV-05-g** — `restaurants.website` rendering: where is it surfaced
  as `<a href>`? `javascript:` URI risk depends on the consumer.
- **REV-05-j** — `ingredient_aliases.display_name` UNIQUE: not in the
  schema dump; need `\d+ ingredient_aliases`.
- **REV-07-r** — Supabase client `flowType: 'pkce'` for mobile: confirm
  in client init.
- **REV-08-d / REV-08-e** — `eat_together_members.current_location`
  PostgREST serialisation: run `select current_location from
  eat_together_members limit 1` to see hex EWKB vs WKT vs GeoJSON.
  Determines whether `parseLocation` in
  `group-recommendations/index.ts:154-166` returns null for every
  request.
- **REV-09-e** — Edge Function auth model: do `feed` /
  `update-preference-vector` use `auth.uid()` from the bearer? If yes,
  the mobile clients currently always run as anon.
- **REV-10-m** — Metro tree-shaking of `@eatme/shared` re-exports:
  measure mobile bundle to see if zod is actually being included.
- **REV-11-h** — PL `auth.email`, `settings.email`, `settings.build`
  intentional loanwords or untranslated? Native PL reviewer.
- **REV-12-m** — amber/yellow text on light bg contrast: run axe-core
  on rendered DOM to confirm AA failure.
- **REV-12-o** — should the web portal also be i18n-ready? Product call.
- **REV-13-g** — `react-hooks` rule activation under `expo lint`: run
  `npx expo lint --debug 2>&1 | grep react-hooks`.

## Out of scope / not reviewed

- `node_modules/`, lockfiles, build output, vendored code.
- Generated files: `*.generated.ts`, `packages/database/src/types/`
  (Supabase-generated types).
- Existing migrations were read-only — no edits proposed; only new
  migrations recommended.
- `lib/menu-scan-warnings.ts` was not opened in REV-04 (called out as a
  follow-up; relevant for REV-04-n).
- Web portal i18n was not exhaustively reviewed (REV-11 is mobile only;
  REV-12-o flags the web absence as a product question).
- Edge Function internals beyond their callers: deeper audit of
  `infra/supabase/functions/*` was deferred — only the call sites and
  `parseLocation`/auth surface were touched.
- Planning / research docs under `.agents/planning/**` — referenced in
  passing for context (e.g. REV-03-c cross-references the prior auth
  review) but not formally reviewed.
- Feed Edge Function performance / vector index health — only the
  PostGIS arg order was checked.

## Recommended next steps

Ordered, grouped by severity. Each item links to the originating
finding(s).

### Immediately (today)

1. **Rotate the leaked Mapbox `sk.*` token.** Replace with a
   downloads-only scoped token, inject via EAS Secrets / Expo env var,
   purge from git history (BFG or `git filter-repo`). REV-03-a.

### Within the week (high-impact correctness + security)

2. **Wire a real `check-types` in CI.** Add `"check-types": "tsc
   --noEmit"` to every workspace `package.json`; rename `type-check` →
   `check-types` in the three packages or alias both. Then run
   `pnpm check-types` once locally and triage the burst. REV-13-a, also
   unblocks regression-catching for many other findings.
3. **Stop the AI menu-scan from auto-writing `*_override` columns.**
   Only persist override on explicit admin opt-in; otherwise let the
   trigger compute from `dish_ingredients`. Restores food-safety
   semantics. REV-04-a, REV-04-b.
4. **Convert `restaurants.location_point` to `GENERATED ALWAYS AS …
   STORED`** in a new migration. Eliminates the silent drift on every
   address update across menu-scan, admin, and any future writer.
   REV-08-a, REV-08-b.
5. **Mobile Supabase session → SecureStore/Keychain.** Wrap
   `expo-secure-store` in an AsyncStorage-shaped adapter and pass to
   `getMobileClient`. Refresh tokens are bearer credentials with ~60-day
   lifetime. REV-03-b.
6. **Fix Facebook OAuth (PKCE) and the missing reset-password handler.**
   Branch on `code` vs hash-tokens; add `PASSWORD_RECOVERY` listener +
   reset-password screen. REV-03-c, REV-03-d.
7. **Patch the open redirect.** Reject `redirectParam` starting with
   `//` or `/\` in login + OAuth callback; same shape on mobile if
   applicable. REV-02-a, REV-02-c.
8. **Add `ON DELETE CASCADE` (or SET NULL with `DROP NOT NULL`) to
   `user_badges.user_id`** in a new migration. Currently blocks user
   deletion. REV-01-a.
9. **Pick one Zod major version across the workspace.** Either bump
   shared to v4 and migrate schemas, or pin web-portal to v3.
   Drop `peerDependenciesMeta.zod.optional`. REV-10-c, REV-10-d.

### Within the sprint (broad maintainability + DX)

10. **Have apps extend the root `tsconfig.json`** (or a shared
    `tsconfig.base.json`). Land in two PRs — wire `extends`, then burn
    down errors. Save `noUncheckedIndexedAccess` for last. REV-13-b.
11. **Add lint coverage to `packages/*` and `infra/scripts`** + land
    `eslint-plugin-react-hooks` for mobile. REV-13-c, REV-13-g.
12. **Regenerate `packages/database/src/types.ts` against the current
    schema** (`favorites`, `recent_viewed_restaurants` are missing).
    Drop the `as any` workarounds in
    `apps/mobile/src/services/favoritesService.ts` and
    `viewHistoryService.ts`. REV-13-e, REV-13-j, REV-13-n.
13. **Make the design-token pipeline real.** Alias every `--brand-*` /
    `--primary` / `--accent` / `--ring` in `apps/web-portal/app/
    globals.css` to a `--token-color-*` value. Extend the
    `no-hardcoded-colors` test to cover `.ts` files and the full
    palette. REV-12-a, REV-12-b.
14. **Onboarding form: wire `zodResolver(basicInfoSchema)` and
    consolidate the duplicate `BasicInfoFormData` types.** Reuse shared
    schemas in `RestaurantForm`. REV-06-a, REV-06-b, REV-06-c.
15. **Wrap menu-scan confirm in a Postgres function/transaction.**
    Replace serial PostgREST inserts with one RPC; eliminates the
    half-written-menu failure mode and the orphan option_groups
    pattern that migration 094/096 already had to clean up. REV-04-c,
    REV-04-g.
16. **Centralise allergen + dietary-tag icons in `@eatme/shared`** and
    delete the two `apps/*/icons.ts` copies. Tighten `dishSchema`
    `allergens` / `dietary_tags` to `z.enum(...)` of canonical codes.
    REV-10-a, REV-10-b, REV-10-l.
17. **Fix the menu-scan address-save PostGIS path** (`'point'` not
    `'json'`). REV-04-o (overlaps with REV-08).
18. **Set `maxDuration = 60` on extraction + import routes** to stop
    silent Vercel timeouts on realistic payloads. REV-04-e, REV-05-c.
19. **Fix the `getRecentRestaurantsForRating` 1h-vs-24h confusion** —
    split `SESSION_TIMEOUT_MS` from `RATING_PROMPT_WINDOW_MS`. REV-07-a.

### Near-term backlog (mediums + a11y polish)

20. Replace per-row `await` inserts with batched inserts in
    confirm/import paths; adopt a single transactional RPC for menu
    confirm. REV-04-c, REV-04-g, REV-05-b (atomic counter), REV-05-d
    (CSV size cap + streaming).
21. Generic-error responses on admin endpoints (no raw PG messages
    surfacing to client). REV-04-p, REV-05-h, REV-05-k.
22. Address mobile data-flow performance: lazy category loading,
    `React.memo` + `useMemo` in `FoodTab`, fix `trackView` auth
    round-trip. REV-07-b, REV-07-d, REV-07-e.
23. Web-portal a11y fixes: `LocationPicker` keyboard alternative,
    `DishGroupCard` raw control labels, `IngredientAutocomplete`
    keyboard pattern, `BasicInfoFields` `aria-invalid`. REV-12-f, g, h,
    i.
24. Mobile i18n: replace hard-coded `FloatingMenu` labels and
    `BasicMapScreen` loading strings; remove the English
    "Allergic to …" sentence in ProfileScreen. REV-11-a, b, e.
25. Update `CLAUDE.md` pitfall #3 to reference the actual
    `eatme_draft_${userId}` storage key. REV-02-i, REV-06-k.

### Lower-priority / future hardening

26. SECURITY DEFINER functions: pin `SET search_path` on the three
    signup triggers (REV-01-c) and tighten `generate_candidates` /
    `get_group_candidates` once `public` grants are confirmed
    (REV-01-h).
27. Drop dead exports from `@eatme/database` (`getWebClient`) and the
    web-portal mock helper. REV-09-a, REV-09-g.
28. Delete the `X-XSS-Protection` header; plan nonce-based CSP for
    Next.js 16. REV-02-n, REV-02-m.
29. Land tests for the mobile services layer — start with
    `result.ts`, `dishRatingService`, and one Zustand store.
    REV-13-d.
30. Add `commitlint` only if Conventional Commits become load-bearing
    (release-please etc.). REV-13-m.

---

Acceptance criteria check (per PROMPT.md): all 13 review areas marked
`[x]` in `.agent/scratchpad.md`; every area has a detail file with at
least Scope reviewed + Findings sections; every finding carries
severity, category, `file:line`, and confidence; this summary covers
all required sections; only `.agent/scratchpad.md` and
`.agents/research/codebase-review-2026-04-16/` were written. No git
mutations performed.

`LOOP_COMPLETE`
