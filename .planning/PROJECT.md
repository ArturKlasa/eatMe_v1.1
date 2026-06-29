# EatMe — Codebase Hardening

## What This Is

EatMe is a food-discovery platform connecting consumers with restaurants through personalized, protein-based dish recommendations. Consumers browse a personalized dish feed on a Mapbox map in the mobile app (Expo/RN); restaurant data is ingested and managed internally through an admin portal (`apps/admin`) with AI-assisted menu scanning. The backend is Supabase (Postgres 15 + PostGIS + pgvector), RLS-enforced.

**v1.0 (Hardening) shipped 2026-06-28** — a codebase-hardening / tech-debt remediation cycle driven by `.planning/codebase/CONCERNS.md`. It **assessed** each chosen finding (validated against current code + live DB — many were explicitly uncertain) and then **addressed** it, leaving the codebase more secure, leaner, and easier to evolve. All 21 v1 requirements completed (PERF-01's `iterative_scan` sub-goal deferred with evidence → PERF-V2-01). The next milestone's scope is defined via `/gsd-new-milestone`.

## Core Value

After this cycle, the documented concerns in CONCERNS.md are either fixed or have a verified, deliberate disposition — with **zero regression to the live mobile discovery experience**. Hardening must not break what already works.

## Requirements

### Validated

<!-- Inferred from existing code (.planning/codebase/) — shipped and relied upon. -->

- ✓ Personalized dish discovery feed — two-stage pipeline (PostGIS + pgvector `generate_candidates()` → JS scoring) — existing
- ✓ Mobile map browsing of dishes (Mapbox) with personal + daily filters — existing
- ✓ Protein-based classification + diet filtering (`primary_protein`, `deriveProteinFields`) — existing
- ✓ AI menu scanning (admin → `menu-scan-worker` → OpenAI gpt-5.4-mini → review/confirm) — existing
- ✓ Admin restaurant/menu management (`apps/admin`, port 3001) — existing
- ✓ EatTogether group recommendation sessions (mobile) — existing
- ✓ Preference-vector maintenance from interactions (`update-preference-vector`) — existing
- ✓ Supabase Auth + RLS-enforced data ownership — existing
- ✓ Shared packages: `@eatme/database`, `@eatme/shared`, `@eatme/tokens`, `@eatme/ui` — existing
- ✓ Allowlist CORS on `feed` / `enrich-dish` / `invalidate-cache` edge functions — single DRY `_shared/cors.ts` `buildCorsHeaders` (exact-match reflection, fail-closed on unset, `Vary: Origin`, no wildcard/credentials) — validated in Phase 2 (SEC-01)
- ✓ RLS codified on the 11 behavioral tables — migration 170 name-agnostic policy sweep (30 InitPlan-form policies + 7 owner indexes, one BEGIN/COMMIT, operator-validated on a prod-clone) — validated in Phase 3 (SEC-02)
- ✓ Edge functions on pinned, non-deprecated deps — native `Deno.serve` (no `std@0.168.0` serve), exact `@supabase/supabase-js@2.39.3` + `@upstash/redis@1.38.0` + `jsr:@std/assert@1.0.19` — validated in Phase 4 (DEBT-05)
- ✓ `infra/scripts` prod-write guard — shared `lib/prod-guard.ts` (default-dry-run, `--apply` sole write trigger, announces target project ref, fails loud on malformed `--limit`); all 8 write scripts wired — validated in Phase 4 (SEC-03)
- ✓ Map restaurant-view-mode dead code removed — `viewModeStore` / `ViewModeToggle` / `RestaurantMarkers` deleted, `BasicMapScreen` collapsed to the dish-only marker path, zero residue, mobile `tsc` green (on-device UI confirmation pending) — validated in Phase 5 (CLEAN-01)
- ✓ Residual `apps/web-portal` references purged from agent-facing docs — 7 docs retargeted to current reality (`apps/admin` active, `apps/web-portal-v2` on ice); zero live imports; `web-portal-v2` + provenance refs preserved — validated in Phase 5 (CLEAN-02)
- ✓ `enrich-dish` header comment corrected to match actual load logic (dish + option groups + restaurant cuisine), migration-151 trigger language preserved — validated in Phase 5 (CLEAN-03)
- ✓ Ingredient-pipeline teardown authored as a strictly-ordered, irreversible-aware spine — Phase B trigger/function drop (migration 171, supersedes 151 per D-06) + Phase C `ingredient_archive` snapshot (172) → RESTRICT child→parent table drop with `options` FK-sever (173) → dead-column drop (174), each + REVERSE; zero CASCADE. Operator prod probe confirmed prod **already at the teardown end-state** (all GONE, dep-audit clean) — migrations are no-ops, intentionally not applied — validated in Phase 6 (DEBT-01/DEBT-02)
- ✓ `DishKind` / `DISH_KIND_META` shims removed — `apps/web-portal-v2` severed first (`KindSelector.tsx` + `dish-kinds.test.ts` deleted, `DishForm`/`MenuManager` reconciled), then shims dropped from `@eatme/shared`; zero-importer grep clean, `turbo check-types` green — validated in Phase 6 (DEBT-03)
- ✓ Generated `@eatme/database` types confirmed in sync with the slimmed schema — `types.ts` already regenerated post-teardown (zero ingredient/`*_override`/`dish_kind` residue); re-verified by grep + `turbo check-types` rather than re-regenerated to avoid drift — validated in Phase 6 (DEBT-04)
- ✓ `filterStore.ts` split into a `filterStore/` slice directory (types/defaults/selectors/daily-actions/permanent-actions/db-sync/persistence composed in `index.ts` as the single `create()` root + re-export barrel) — pure verbatim move, public store API + hand-rolled AsyncStorage serialization shape preserved byte-for-byte (all 13 consumers' imports unchanged, `tsc --noEmit` green, all landmines preserved); proven byte-for-byte by a throwaway diff harness (deleted before close) + operator on-device force-close/reopen confirmation — validated in Phase 8 (RFCT-01)
- ✓ `BasicMapScreen.tsx` (581 lines) + `DailyFilterModal.tsx` (891 lines) decomposed into co-located directories — map screen → `useMapCamera`/`useDishFeed`/`useRatingFlow` hooks + `RatingBanner` child (reuses the shared `useUserLocation`); filter modal → parent draft+reducers `index.tsx` + 4 presentational value+onChange sections + 2 verbatim sub-modals + `DualRangeSlider`/`helpers`/`constants`, each with a composition-root `index.tsx` barrel. Pure behavior-preserving move: all 4 landmines preserved + guard-commented (feed-effect deps, `[visible]`-only seed effect, protein/meat special-casing, Android slider measure-poll), dead Diet Type Tabs block dropped (D-12), local-draft→Apply semantics intact. `apps/mobile tsc --noEmit` green, code review clean (0 critical), operator on-device SC#4 smoke approved — validated in Phase 9 (RFCT-02/RFCT-03)
- ✓ `ReviewDishEditor.tsx` (1258 lines, admin) decomposed into a `ReviewDishEditor/` directory — `index.tsx` (orchestration root + re-export barrel), pure `reviewHelpers.ts` (7 transform helpers) + `buildConfirmPayload.ts` (the confirm-payload assembly), and presentational children `BundledItemsBlock`/`CategorySection`/`DishCard` (props-in/callbacks-out; `ModifierGroupsEditor` reused, parent-owned `SourceImageStrip` untouched). Split along form regions, not the submit boundary: a single `buildConfirmPayload()` + single `adminConfirmMenuScan` submit keep the `admin_confirm_menu_scan` payload byte-identical (locked by a new inline-snapshot test + an adversarial code-review diff vs the monolith). All 5 landmines (L-1..L-5) preserved + guard-commented; `onActiveImageIndexChange` image-sync wiring intact. `turbo check-types` green, full admin unit suite 169/169, code review clean (0 critical/0 warning), phase verification 3/3, operator in-browser Save on a real `needs_review` job approved — validated in Phase 10 (RFCT-04)
- ✓ Assessment-first findings register — every in-scope CONCERNS finding verdicted (confirmed / stale / already-resolved) with evidence; live RLS state + prod pgvector version + feed-cache webhook coverage captured via an operator prod probe, gating downstream phase scope (`.planning/codebase/FINDINGS.md`) — validated in Phase 1 (ASSESS-01/02/03)
- ✓ Feed candidate query bounded within `statement_timeout` — `feed` wraps `generate_candidates` in an expanding-radius loop over `[0.25, 0.5, 1.0]` (`POOL_TARGET=100`), keeping the dense-urban case fast and bounding worst-case scan; `iterative_scan` assessed against the live ~15k-dish corpus and deferred (+4.4s for zero recall benefit at the production tier → PERF-V2-01) — validated in Phase 7 (PERF-01 via SC#1)
- ✓ Feed Stage-2 payload reduced — per-restaurant K=8 pre-cap (migration 175), behavior-preserving (`applyDiversity` yields identical dish-ID lists full-pool vs capped) — validated in Phase 7 (PERF-02)
- ✓ Feed-cache invalidation widened to INSERT/UPDATE/DELETE on restaurants/menus/dishes — migration 176 `net.http_post` + Vault triggers (9-row catalog, operator-confirmed smoke 200, no double-flush) — validated in Phase 7 (PERF-03). *(Superseded post-milestone: quick task 260627-cfb removed the invalidate-cache subsystem; feed cache is now TTL-only.)*

### Active

<!-- v1.0 (Hardening) shipped — all v1 requirements above moved to Validated. Next milestone's scope is defined via /gsd-new-milestone. -->

_(empty — awaiting next milestone)_

### Deferred to v2 (carried forward)

- **PERF-V2-01**: Geo-aware ANN rebuild — per-restaurant centroid + restaurant-level vector search (the durable fix beyond tiered radius; absorbs the deferred PERF-01 `iterative_scan` sub-goal)
- **PERF-V2-02**: Full SQL-side ranking pushdown (beyond the Stage-2 payload reduction)
- **QUAL-V2-01**: Automated RLS regression test suite (anon-deny pattern) — deferred to keep v1.0 minimal-test
- **QUAL-V2-02**: Deno std → JSR full modernization beyond the import swap

### Out of Scope

- Broad automated-test-coverage push — only targeted tests that de-risk a specific refactor this cycle (solo/single-operator app; ROI not there yet) — minimal-tests decision
- Applying migrations/scripts directly to prod — all DB changes are **staged + dry-run only**; the user deploys to prod manually
- Deleting `apps/web-portal-v2` — on ice, kept for future revival
- Allergen / dietary-tag / religious-restriction features — abandoned; EatMe is protein-based discovery, not allergen-safety
- Reintroducing the parent/variant dish model — replaced by modifier groups (dropped in migration 163)
- New consumer features — this is a hardening cycle, not a feature cycle

## Context

- **v1.0 (Hardening) shipped 2026-06-28** — 10 phases, all 21 v1 requirements complete. Codebase is now: allowlist-CORS edge functions on pinned deps + native `Deno.serve`; behavioral RLS codified in a tracked migration; `infra/scripts` prod-write paths behind a shared default-dry-run guard; ingredient pipeline + DishKind shims torn down; tiered-radius feed with a K=8 pre-cap; and the four big files (`filterStore`, `BasicMapScreen`, `DailyFilterModal`, `ReviewDishEditor`) decomposed behavior-preserving.
- Brownfield monorepo (pnpm + Turborepo). Full codebase map exists at `.planning/codebase/` (ARCHITECTURE, STACK, CONVENTIONS, CONCERNS, STRUCTURE, INTEGRATIONS, TESTING).
- `apps/web-portal` (old owner portal) was deleted + committed (`c1a7e3f`, 2026-06-18); workspace config is clean of references. This pre-resolved the "broken web-portal dish form", "onboarding-only broken dish mgmt", and "two admin codepaths" findings; `apps/admin` (port 3001) is now the sole admin surface.
- Remaining apps: `apps/mobile`, `apps/admin`, `apps/web-portal-v2` (paused, on ice).
- No psql locally — DB access is REST/Supabase-client only; migrations are authored as SQL files and deployed by the user.
- `apps/mobile` and `apps/admin` have thin/zero automated test coverage; mobile visual behavior is verified by the user on a physical device (no emulator in the agent loop).
- Several scripts in `infra/scripts/` hit **live prod** Supabase with the service-role key.
- **Deferred at close (operator-confirmation paperwork, not gaps):** debug `publish-statement-timeout` (root cause deleted by quick task 260627-cfb; wants a large-publish re-test); Phase 04/07 live-deploy UAT + verification (codebase halves VERIFIED; prod confirmations done verbally but not persisted as machine-readable artifacts). See STATE.md → Deferred Items.

## Constraints

- **Prod DB**: Stage-don't-apply. Author + dry-run all migrations/scripts; the user deploys to prod (dry-run → sample → full). Never mutate prod directly.
- **Mobile changes**: Behavior-preserving; verified on-device by the user. No emulator available to the agent.
- **Edge functions (Deno)**: Cannot import workspace packages — enums/schemas duplicated inline.
- **RLS**: Every table needs RLS enabled with an `owner_id` FK to `auth.users`; default deny-all.
- **PostGIS**: `POINT(lng lat)` — longitude first.
- **primary_protein**: NOT NULL on every dish; sole food-classification axis.
- **Workflow**: Solo project — commit straight to `main` (no feature branches) when the user says "commit".
- **web-portal-v2**: On ice — do not delete; touch only minimally (the DishKind removal).

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| Scope all four CONCERNS areas (security/bugs, debt/deps, perf/scaling, refactors) | User wants a comprehensive hardening pass | ✓ Good — all 21 v1 reqs shipped across 10 phases |
| Stage-don't-apply for all prod DB changes | No local psql; user owns prod deploys; matches dry-run discipline | ✓ Good — every migration authored + dry-run; operator applied (170/175/176); zero agent-direct prod writes |
| Minimal/targeted tests only (not a coverage push) | Solo/single-operator app; broad test ROI not there yet | ✓ Good — only seam-de-risking tests added (cors, prod-guard, tiered-loop, pre-cap, serialization, snapshot); RLS regression suite deferred to QUAL-V2-01 |
| Surgical DishKind cleanup; keep web-portal-v2 | Shims now only block v2; v2 is on ice, not deleted | ✓ Good — shims severed from v2 first, then dropped from `@eatme/shared` (DEBT-03); v2 preserved |
| Treat web-portal deletion as already-done input | User deleted it 2026-06-18; pre-resolves 3 findings | ✓ Good — confirmed committed (`c1a7e3f`); Phase 5 narrowed to residual-doc cleanup |
| Assessment-first (findings register before fixes) | Several findings are explicitly uncertain/possibly-stale | ✓ Good — operator prod probe overturned several findings (RLS already on, web-portal already gone), repurposing Phase 3/5 scope |
| Single DRY `_shared/cors.ts` allowlist helper, fail-closed (3-function scope incl. `invalidate-cache`) | One CORS source for all importers; missing `ALLOWED_ORIGINS` degrades admin-browser only, never mobile/security | ✓ Good — Phase 2 (SEC-01) |
| Codify (not enable) prod RLS via a name-agnostic policy sweep (migration 170) | Prod already had RLS; the repo baseline had zero ENABLE — close the migrations↔prod drift idempotently | ✓ Good — operator-validated on a prod-clone across 2 rounds (Phase 3 / SEC-02) |
| Tiered-radius loop as PERF-01's delivery; defer `iterative_scan` | Live latency test: `iterative_scan` added +4.4s for zero recall benefit at the 2.5km production tier on the ~15k-dish corpus | ⚠️ Revisit — durable fix is geo-aware ANN (PERF-V2-01); revisit when the corpus grows sparse enough to under-return at the first tier |
| Decompose the four big files behavior-preserving, gated by on-device / in-browser operator smoke | No emulator/UI tests for mobile; the operator is the authoritative regression gate | ✓ Good — RFCT-01..04 all closed with operator confirmation; zero reported regressions |

## Evolution

This document evolves at phase transitions and milestone boundaries.

**After each phase transition** (via `/gsd-transition`):
1. Requirements invalidated? → Move to Out of Scope with reason
2. Requirements validated? → Move to Validated with phase reference
3. New requirements emerged? → Add to Active
4. Decisions to log? → Add to Key Decisions
5. "What This Is" still accurate? → Update if drifted

**After each milestone** (via `/gsd-complete-milestone`):
1. Full review of all sections
2. Core Value check — still the right priority?
3. Audit Out of Scope — reasons still valid?
4. Update Context with current state

---
*Last updated: 2026-06-28 after v1.0 (Hardening) milestone completion — 10 phases, 21/21 v1 requirements shipped. Full review done: "What This Is" reframed to v1.0-shipped, all shipped requirements moved to Validated, Active emptied (awaiting next milestone), v2/quality items carried forward, Key Decisions outcomes scored (one ⚠️ Revisit: tiered-radius vs deferred `iterative_scan`), Context refreshed with the shipped state + deferred items. Out of Scope reasons re-audited and still valid. Next milestone scope: `/gsd-new-milestone`.*
