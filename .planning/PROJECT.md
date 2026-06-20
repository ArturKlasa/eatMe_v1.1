# EatMe — Codebase Hardening

## What This Is

EatMe is a food-discovery platform connecting consumers with restaurants through personalized, protein-based dish recommendations. Consumers browse a personalized dish feed on a Mapbox map in the mobile app (Expo/RN); restaurant data is ingested and managed internally through an admin portal (`apps/admin`) with AI-assisted menu scanning. The backend is Supabase (Postgres 15 + PostGIS + pgvector), RLS-enforced.

**This milestone** is a codebase-hardening / tech-debt remediation cycle driven by `.planning/codebase/CONCERNS.md`. Its job is to **assess** each chosen finding (validate it against current code and live DB — many findings are explicitly uncertain) and then **address** it, leaving the codebase more secure, leaner, and easier to evolve.

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

### Active

<!-- This milestone's scope. All findings get assessed (validated) before addressed. -->

**Triage / assessment (foundation)**

- [ ] Validate every in-scope CONCERNS finding against current code + live DB; produce a findings register with per-item verdicts (confirmed / stale / already-resolved)

**Security & bugs**

- [x] Audit RLS on behavioral tables (`favorites`, `dish_opinions`, `user_dish_interactions`, `user_behavior_profiles`, `dish_analytics`, etc.); add owner policies where missing — Phase 3 (SEC-02)
- [x] Add a prod-write guard to `infra/scripts` (require explicit `--dry-run` clearance before any write path) — Phase 4 (SEC-03)
- [x] Remove the dead map restaurant-view-mode branch (`viewModeStore` / `ViewModeToggle` / `BasicMapScreen`) — Phase 5 (CLEAN-01)
- [x] Verify the `apps/web-portal` deletion is clean and finish residual cleanup (stale doc references) — Phase 5 (CLEAN-02)

**Debt & dependency cleanup**

- [ ] Ingredient-pipeline teardown — Phase B (drop inert triggers), then Phase C (drop orphaned schema)
- [ ] Surgical DishKind removal — drop `DishKind`/`DISH_KIND_META` usage from `apps/web-portal-v2` (`DishForm.tsx`, `KindSelector.tsx`), then delete the shims + `dish-kinds.test.ts` from `@eatme/shared`
- [ ] Regenerate `@eatme/database` types after recent migrations; commit the slimmed file
- [x] Fix stale `enrich-dish` header comments (no ingredient/parent-dish references) — Phase 5 (CLEAN-03)
- [x] Pin edge-function deps — Deno std and `@supabase/supabase-js` to exact versions — Phase 4 (DEBT-05)

**Performance & scaling**

- [ ] `generate_candidates` radius timeout past ~5km — assess migration 169 pushdown, propose tiered-radius / partition path
- [ ] Feed Stage-2 ranking — reduce JS payload size (move diversity cap/sort toward SQL where it helps)
- [ ] Upstash Redis feed cache — add event-driven invalidation on menu change (`admin_confirm_menu_scan`)

**Big-file refactors (behavior-preserving)**

- [ ] Split `BasicMapScreen.tsx`, `filterStore.ts`, `DailyFilterModal.tsx` (mobile — on-device verification)
- [ ] Split `ReviewDishEditor.tsx` (admin)

### Out of Scope

- Broad automated-test-coverage push — only targeted tests that de-risk a specific refactor this cycle (solo/single-operator app; ROI not there yet) — minimal-tests decision
- Applying migrations/scripts directly to prod — all DB changes are **staged + dry-run only**; the user deploys to prod manually
- Deleting `apps/web-portal-v2` — on ice, kept for future revival
- Allergen / dietary-tag / religious-restriction features — abandoned; EatMe is protein-based discovery, not allergen-safety
- Reintroducing the parent/variant dish model — replaced by modifier groups (dropped in migration 163)
- New consumer features — this is a hardening cycle, not a feature cycle

## Context

- Brownfield monorepo (pnpm + Turborepo). Full codebase map exists at `.planning/codebase/` (ARCHITECTURE, STACK, CONVENTIONS, CONCERNS, STRUCTURE, INTEGRATIONS, TESTING).
- `apps/web-portal` (old owner portal) was **deleted by the user on 2026-06-18** — deletion currently uncommitted; workspace config is already clean of references. This pre-resolves the "broken web-portal dish form", "onboarding-only broken dish mgmt", and "two admin codepaths" findings; `apps/admin` is now the sole admin surface.
- Remaining apps: `apps/mobile`, `apps/admin`, `apps/web-portal-v2` (paused, on ice).
- No psql locally — DB access is REST/Supabase-client only; migrations are authored as SQL files and deployed by the user.
- `apps/mobile` and `apps/admin` have thin/zero automated test coverage; mobile visual behavior is verified by the user on a physical device (no emulator in the agent loop).
- Several scripts in `infra/scripts/` hit **live prod** Supabase with the service-role key.

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
| Scope all four CONCERNS areas (security/bugs, debt/deps, perf/scaling, refactors) | User wants a comprehensive hardening pass | — Pending |
| Stage-don't-apply for all prod DB changes | No local psql; user owns prod deploys; matches dry-run discipline | — Pending |
| Minimal/targeted tests only (not a coverage push) | Solo/single-operator app; broad test ROI not there yet | — Pending |
| Surgical DishKind cleanup; keep web-portal-v2 | Shims now only block v2; v2 is on ice, not deleted | — Pending |
| Treat web-portal deletion as already-done input | User deleted it 2026-06-18; pre-resolves 3 findings | — Pending |
| Assessment-first (findings register before fixes) | Several findings are explicitly uncertain/possibly-stale | ✓ Phase 1 |
| Single DRY `_shared/cors.ts` allowlist helper, fail-closed (3-function scope incl. `invalidate-cache`) | One CORS source for all importers; missing `ALLOWED_ORIGINS` degrades admin-browser only, never mobile/security | ✓ Phase 2 (SEC-01) |

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
*Last updated: 2026-06-20 after Phase 5 (Dead Code & Doc Cleanup) completion — CLEAN-01/02/03 validated; one on-device UI check (CLEAN-01) pending in 05-HUMAN-UAT.md*
