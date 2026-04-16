# Codebase Review (read-only) — Agenda

Objective: produce a severity-ranked written report under
`.agents/research/codebase-review-2026-04-16/`. Read-only pass — no source
edits, no git mutations, no codegen/linters in write mode.

Ordering rationale: security + correctness first (highest blast radius),
convention/maintainability in the middle, DX / type-safety last. Sizing
targeted so each area fits one reviewer activation (one area per iteration
per the Reviewer hat).

## Areas

- [x] REV-01: supabase-migrations — RLS policies, FK cascade integrity, and
      index coverage across `infra/supabase/migrations/` (071–097).
      (12 findings: 0c/1h/5m/3l/3i)
  - Why it matters: every new table needs RLS + `owner_id` FK to `auth.users`
    (CLAUDE.md pitfall #2). Recent migrations touched user FK cascades
    (084–087), content RLS (091), scoped option groups (094), and a telemetry
    table (089) — high surface area for policy/FK drift.
  - Key paths: `infra/supabase/migrations/07{1..9}_*.sql`,
    `08{0..9}_*.sql`, `09{0..7}_*.sql`, `infra/supabase/migrations/database_schema.sql`
  - Focus categories: security, correctness, performance
  - Detail file: .agents/research/codebase-review-2026-04-16/01-supabase-migrations.md

- [x] REV-02: auth-session-web — Next.js middleware, auth routes, session
      refresh, and server-action auth posture in the web portal.
      (16 findings: 0c/1h/3m/8l/4i)
  - Why it matters: Next.js 16 SSR + Supabase auth is easy to misconfigure
    (cookie scoping, RSC vs route handler, missing session refresh). Open
    redirects and session-fixation risks live here.
  - Key paths: `apps/web-portal/middleware.ts`, `apps/web-portal/app/auth/`,
    `apps/web-portal/contexts/` (any Auth/Session providers), any
    `createServerClient`/`createBrowserClient` call sites.
  - Focus categories: security, correctness, conventions
  - Detail file: .agents/research/codebase-review-2026-04-16/02-auth-session-web.md

- [x] REV-03: auth-session-mobile — Expo OAuth flow, Supabase session
      persistence, token refresh, deep-link handling.
      (16 findings: 1c/3h/4m/5l/3i)
  - Why it matters: mobile OAuth surfaces deep-link / redirect URI hijacking
    and secret-storage bugs (SecureStore vs AsyncStorage). Repo already has
    three OAuth docs (MOBILE_OAUTH_SUMMARY.md, OAUTH_SETUP.md) — signals
    complexity and risk.
  - Key paths: `apps/mobile/src/services/` (auth/session), `apps/mobile/App.tsx`,
    `apps/mobile/src/stores/` auth-related, `apps/mobile/src/screens/` login.
  - Focus categories: security, correctness
  - Detail file: .agents/research/codebase-review-2026-04-16/03-auth-session-mobile.md

- [x] REV-04: web-admin-menu-scan — AI menu extraction pipeline (vision
      model input, prompt assembly, structured-output parsing, owner-review
      gate, persistence).
      (19 findings: 0c/1h/5m/7l/6i)
  - Why it matters: AI ingest is a classic prompt-injection + unsafe-parse
    surface. Telemetry migration (089) shipped alongside this feature
    (1e7ecdd). Multiple in-progress edits (`useMenuScan.ts`, `useReviewState.ts`,
    `DishOptionsSection.tsx`, `DishVariantsSection.tsx` all modified).
  - Key paths: `apps/web-portal/app/admin/menu-scan/`, `apps/web-portal/app/api/`
    (extraction endpoint), `apps/web-portal/components/forms/dish/`.
  - Focus categories: security, correctness, maintainability
  - Detail file: .agents/research/codebase-review-2026-04-16/04-web-admin-menu-scan.md

- [x] REV-05: web-api-routes — server-side API surface: input validation,
      auth checks, error boundaries, secret handling, CORS, injection.
      (18 findings: 0c/0h/4m/10l/4i)
  - Why it matters: API routes in Next.js are the primary unauthenticated
    (or weakly authenticated) surface. Look for missing `zod.parse`, raw
    SQL, unvalidated redirects, and service-role-key leakage to the client.
  - Key paths: `apps/web-portal/app/api/**/route.ts`, any server actions
    under `apps/web-portal/app/**/actions.ts`.
  - Focus categories: security, correctness
  - Detail file: .agents/research/codebase-review-2026-04-16/05-web-api-routes.md

- [x] REV-06: web-forms-zod — react-hook-form + Zod schemas in web-portal:
      schema drift vs DB types, duplicated shapes, resolver wiring.
      (22 findings: 0c/4h/7m/8l/3i)
  - Why it matters: Zod schemas that drift from Supabase generated types
    produce latent runtime / persistence bugs. Onboarding draft
    persistence (`restaurant-draft`, `onboarding-step` keys per CLAUDE.md
    pitfall #3) must match schemas.
  - Key paths: `apps/web-portal/app/onboard/`, `apps/web-portal/components/forms/`,
    `apps/web-portal/lib/` (any schema/resolver files), cross-ref with
    `packages/shared/src/validation`.
  - Focus categories: correctness, maintainability, conventions
  - Detail file: .agents/research/codebase-review-2026-04-16/06-web-forms-zod.md

- [x] REV-07: mobile-stores-data-flow — Zustand stores, data-loading
      hooks, race conditions, stale-closure bugs, optimistic-update revert
      paths.
      (19 findings: 0c/3h/7m/8l/1i)
  - Why it matters: recent rating-system work wired optimistic updates
    across multiple stores/screens. Zustand selectors + useEffect combos
    are a common perf/correctness footgun.
  - Key paths: `apps/mobile/src/stores/` (filterStore, feedStore, rating
    stores), `apps/mobile/src/hooks/`, `apps/mobile/src/services/` data fns.
  - Focus categories: correctness, performance, maintainability
  - Detail file: .agents/research/codebase-review-2026-04-16/07-mobile-stores-data-flow.md

- [x] REV-08: postgis-point-order — every PostGIS POINT construction /
      read site across web, mobile, and migrations.
      (6 findings: 0c/2h/3m/0l/1i)
  - Why it matters: CLAUDE.md pitfall #1 — POINT(lng lat) not POINT(lat lng).
    One swap silently corrupts distance math. Feed algorithm, proximity
    queries, onboarding address-pick paths all touch this.
  - Key paths: grep for `POINT(`, `ST_MakePoint`, `ST_DDistance`,
    `coordinates` across repo; check mobile Mapbox integration + web
    restaurant create/edit + any search RPC.
  - Focus categories: correctness
  - Detail file: .agents/research/codebase-review-2026-04-16/08-postgis-point-order.md

- [x] REV-09: supabase-client-factory — `packages/database` client factory,
      explicit env-var passing contract, typed-client boundary,
      transpilePackages compliance.
      (7 findings: 0c/0h/1m/6l/0i)
  - Why it matters: CLAUDE.md pitfalls #4 + #5 + architecture.md require
    explicit env passing (Next.js / Expo static replacement) and
    transpilePackages entry. A misuse breaks prod deploys silently.
  - Key paths: `packages/database/src/client.ts`, `packages/database/src/index.ts`,
    `apps/web-portal/next.config.ts`, `apps/mobile/metro.config.js`,
    all `createClient*` call sites.
  - Focus categories: conventions, correctness, dx
  - Detail file: .agents/research/codebase-review-2026-04-16/09-supabase-client-factory.md

- [x] REV-10: shared-zod-types — `packages/shared` constants/types/zod:
      drift vs consumers, duplication, peer-dep boundary.
      (13 findings: 0c/3h/6m/3l/1i)
  - Why it matters: shared package with zod as *optional peer dep* is
    brittle — consumers that forget to install zod or import deep paths
    bypass the contract. Types duplicated across apps cause drift.
  - Key paths: `packages/shared/src/{constants,types,validation}/`,
    `packages/shared/package.json`, cross-ref imports from both apps.
  - Focus categories: maintainability, correctness, conventions
  - Detail file: .agents/research/codebase-review-2026-04-16/10-shared-zod-types.md

- [x] REV-11: mobile-i18n — en/es/pl locale coverage, missing keys,
      hard-coded strings, interpolation safety.
      (11 findings: 0c/0h/3m/7l/1i)
  - Why it matters: three locales declared (en/es/pl). Missing keys fall
    back silently in i18next — user-visible bug. Hard-coded strings in
    screens bypass translation entirely.
  - Key paths: `apps/mobile/src/i18n/`, `apps/mobile/src/locales/`,
    spot-check `apps/mobile/src/screens/` and `apps/mobile/src/components/`
    for raw strings.
  - Focus categories: maintainability, dx, a11y
  - Detail file: .agents/research/codebase-review-2026-04-16/11-mobile-i18n.md

- [x] REV-12: tokens-a11y — `packages/tokens` consumption consistency +
      web-portal accessibility (labels, keyboard, focus, contrast).
      (15 findings: 0c/2h/8m/4l/1i)
  - Why it matters: tokens are the single source of truth for color
    contrast — off-spec tokens or local overrides silently fail WCAG.
    Web-portal admin screens are form-heavy, so label/focus bugs bite.
  - Key paths: `packages/tokens/src/`, `apps/web-portal/app/tokens.css`,
    `apps/web-portal/app/globals.css`, `apps/web-portal/components/`
    form primitives; grep for hard-coded hex in apps.
  - Focus categories: a11y, maintainability, conventions
  - Detail file: .agents/research/codebase-review-2026-04-16/12-tokens-a11y.md

- [x] REV-13: type-safety-dx — unsafe `as` casts, `any`, `@ts-expect-error`,
      tsconfig strictness, test coverage gaps, script hygiene
      (`turbo.json`, workspace `package.json`).
      (14 findings: 0c/2h/7m/3l/2i)
  - Why it matters: type-safety erosion is silent debt. Gaps in tsc/test
    coverage on high-risk surfaces (menu-scan, auth, PostGIS) elevate
    regression risk.
  - Key paths: repo-wide grep for `as any`, `@ts-expect-error`, `// eslint-disable`,
    `tsconfig.json` (root + each app/package), `turbo.json`,
    `apps/web-portal/vitest.config.ts`, `apps/web-portal/test/`.
  - Focus categories: maintainability, dx
  - Detail file: .agents/research/codebase-review-2026-04-16/13-type-safety-dx.md

## Notes for downstream hats

- Acceptance requires `00-summary.md` with executive summary, severity
  rollup, top findings, areas table, category heatmap, needs-verification
  queue, out-of-scope list, and recommended next steps.
- Generated files off-limits: `*.generated.ts`,
  `packages/database/src/types/`.
- Existing migrations off-limits for edits — recommend NEW migrations only.
- Every finding must cite `file:line` with severity + confidence + category.
