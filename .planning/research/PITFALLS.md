# Domain Pitfalls

**Domain:** Brownfield codebase hardening — Postgres/Supabase schema teardown, RLS hardening, pgvector+PostGIS perf, Deno edge-function dep upgrades, CORS lockdown, Zustand persist refactors, mobile refactors without an emulator
**Researched:** 2026-06-18

> Scope-specific to EatMe. Operations verified against the live edge functions (`infra/supabase/functions/*`), migration `151_retire_ingredient_triggers.sql`, `filterStore.ts`, and CONCERNS.md. External best-practice claims verified against Supabase, pgvector, and Deno docs (sources at bottom). Confidence tags: **[HIGH]** verified against code + authoritative docs; **[MEDIUM]** authoritative single source; **[LOW]** inferred.

---

## Critical Pitfalls

High blast radius: prod data loss, user-data exposure, or breaking the live mobile discovery experience.

### Pitfall 1: `DROP TABLE ... CASCADE` silently removing live objects during ingredient-schema teardown (Phase C)

**What goes wrong:** To drop the orphaned ingredient tables you hit a dependency error (FKs, views, the `dishes.allergens_override` lineage, generated-column refs). The reflex is to add `CASCADE`. `CASCADE` then drops *everything* that depends on the object transitively — possibly a view, FK, or function on a **live** table (`dishes`) that you did not intend to touch. There is no dry-run for `CASCADE`'s blast radius once it runs.

**Why it happens:** `canonical_ingredients` is an FK *target* (CONCERNS line 16); `dish_ingredients` FKs into it; the override columns and old compute functions reference these. A naive `DROP TABLE canonical_ingredients CASCADE` can cascade through more than the seven listed tables.

**Consequences:** Irreversible loss of a live object on prod. No local psql means you cannot easily inspect the dependency graph first, and the "user deploys manually" model means the destructive statement runs once, on prod, unrehearsed.

**Prevention (this stack):**
- **Enumerate dependencies before writing any DROP.** In the staged migration, precede drops with a read-only audit query the user runs on prod first: `SELECT classid::regclass, objid::regclass, refobjid::regclass FROM pg_depend WHERE refobjid = 'public.canonical_ingredients'::regclass;` and `\d`-equivalent via `information_schema.table_constraints` / `pg_views` to list dependents.
- **Drop in explicit dependency order with `RESTRICT` (the default), not `CASCADE`.** Order: triggers → trigger functions → FK constraints → child tables (`dish_ingredients`, `*_translations`, `ingredient_variants`, `ingredient_aliases_v2`, `ingredient_concepts`) → parent (`canonical_ingredients`). If `RESTRICT` errors, that error *is* the signal you missed a dependent — investigate it, do not paper over it with `CASCADE`.
- **Wrap in `BEGIN;`/`COMMIT;`** (migration 151 already does this) so a mid-script failure rolls back the whole drop.
- **Ship a tested `*_REVERSE_ONLY` file** (151 already establishes this pattern) — but note Phase C dropping *tables* is far harder to reverse than dropping triggers; the reverse can recreate empty tables but not the data. Treat Phase C as effectively one-way and gate it harder.

**Detection (warning signs):** A migration that contains `CASCADE`; a DROP that "just worked" against fewer objects than the seven tables; any DROP not preceded by a dependency-audit query in the same PR.

**Milestone area:** Debt/dependency cleanup — *Ingredient-pipeline teardown Phase B/C*. Make the dependency audit a required step in the Phase C plan.

---

### Pitfall 2: Enabling RLS without a permissive policy = silent deny-all on a live behavioral table

**What goes wrong:** `ALTER TABLE favorites ENABLE ROW LEVEL SECURITY;` with **no** accompanying `CREATE POLICY` flips the table to **deny-all** for every non-service-role caller. The mobile app's reads/writes of `favorites`, `dish_opinions`, `user_dish_interactions` instantly return empty results (not errors — RLS denies are silent empties, per the project's own RLS test pattern in TESTING.md line 345-352). The feed degrades and "favorites disappeared" with no stack trace.

**Why it happens:** The audit requirement (PROJECT.md, CONCERNS line 172-182) is "enable RLS + add owner policies." It is dangerously easy to ship the `ENABLE` half in one migration and the `CREATE POLICY` half in another — or to enable RLS on a table the mobile client reads via the anon/user JWT, assuming the existing service-role edge functions cover it (they don't; the mobile client talks to PostgREST directly for these tables).

**Consequences:** Live mobile breakage of favorites/opinions/interactions — exactly the "zero regression to mobile discovery" line the milestone must not cross. High blast radius.

**Prevention (this stack):**
- **`ENABLE` and `CREATE POLICY` must land in the same migration, atomically.** Never split them across deploys.
- **Confirm the access pattern per table before enabling.** Some of these tables are written by service-role edge functions (`update-preference-vector`, `batch-update-preference-vectors`) and some by the mobile client directly. Service-role *bypasses RLS entirely* — so enabling RLS won't break service-role writers, but it *will* break any direct mobile read/write unless a user policy exists. Map each table's caller (mobile-direct vs edge-only) first.
- **Separate SELECT/INSERT/UPDATE/DELETE policies** with `auth.uid() = user_id` (or the actual owner column — verify the column name; some tables may use `user_id`, some `owner_id`).
- **Verify against prod first** with the read-only query from CONCERNS line 182: `SELECT tablename, rowsecurity FROM pg_tables WHERE schemaname='public';` plus `SELECT * FROM pg_policies WHERE schemaname='public';` to distinguish "RLS on, policies present" from "RLS on, no policy = locked." This is the assessment step — some tables may *already* have RLS+policies set via the dashboard (CONCERNS notes this is unknown).

**Detection (warning signs):** A migration with `ENABLE ROW LEVEL SECURITY` and zero `CREATE POLICY` in the same file; mobile favorites/opinions returning empty after a deploy; `pg_policies` empty for a table that has `rowsecurity = true`.

**Milestone area:** Security & bugs — *RLS audit on behavioral tables*. Highest-priority guard in the milestone.

---

### Pitfall 3: `auth.uid()` called per-row in new RLS policies → statement timeout on high-write tables

**What goes wrong:** Writing the new owner policies as `USING (auth.uid() = user_id)` causes Postgres to re-evaluate `auth.uid()` **once per row**. On `user_dish_interactions` / `dish_analytics` (high-row behavioral tables) this turns a ~5ms policy into a multi-second one — and with the existing 8s `statement_timeout` (CONCERNS line 204) a large scan can time out outright. [HIGH]

**Why it happens:** The "obvious" policy form is the slow form. The fix is non-obvious unless you know the InitPlan trick.

**Consequences:** Feed/analytics queries that touch these tables slow down or time out *after* RLS is added — looks like RLS "broke performance," actually a policy-authoring bug. Compounds with Pitfall 7 (timeouts).

**Prevention (this stack):**
- **Wrap auth calls in a scalar subquery:** `USING ((select auth.uid()) = user_id)`. The planner hoists it to a single InitPlan evaluated once per query. Same applies to `auth.role()`, `auth.jwt()`, `current_setting()`.
- **Ensure the owner column is indexed** (`CREATE INDEX ... ON user_dish_interactions (user_id)`) so the policy predicate uses an index, not a seq scan.
- **Run `EXPLAIN ANALYZE`** on a representative query post-policy: a correct policy shows `InitPlan 1` at the top and the filter referencing `$0`; the slow form shows the function call inside the per-row filter.

**Detection (warning signs):** Any new policy with a bare `auth.uid()` not wrapped in `(select ...)`; EXPLAIN output without an InitPlan; query latency on behavioral tables rising after the RLS phase.

**Milestone area:** Security & bugs — *RLS audit* (author policies correctly the first time).

---

### Pitfall 4: Breaking persisted mobile state when splitting `filterStore.ts`

**What goes wrong:** `filterStore.ts` (927 lines) persists **only permanent filters + `lastSyncedAt`** via Zustand `persist`; daily filters are session-only (verified: lines 709, 790, and CONCERNS line 258). Splitting the store, renaming a persisted field, or changing the `partialize` shape **without bumping `version` + adding a `migrate` function** corrupts every existing user's persisted AsyncStorage blob on app update. On next launch the store either crashes hydrating, silently resets the user's permanent filters, or—worse—starts persisting a *daily* (session-only) field because the split moved it under the persisted slice.

**Why it happens:** The persisted slice and the session-only slice currently live in one store with one `partialize`. A refactor that splits them must preserve (a) the exact storage key, (b) the exact persisted field names, and (c) the partialize boundary (permanent persisted, daily NOT). Easy to get any of the three wrong.

**Consequences:** Silent loss of user-saved permanent filters across the entire installed base — a regression that is invisible in code review and only shows on a real device after an app update (no emulator, no CI for mobile). High blast radius via the installed base.

**Prevention (this stack):**
- **Treat the persisted shape as a public contract.** If field names/structure change, bump `version` in the `persist` options and write a `migrate(persistedState, fromVersion)` that maps old → new. If you only split files but keep the same store instance + same key + same partialize output, *no migration is needed* — make that an explicit goal ("behavior-preserving split, identical persisted payload").
- **Keep the storage key byte-identical** (mirrors the web-portal localStorage-key warning in CLAUDE.md pitfall #3).
- **Re-verify `partialize` still excludes daily/transient state** after the split (CONCERNS line 261 calls this out). Add an assertion/test that the persisted object contains permanent fields and none of the daily fields.
- **On-device verification is mandatory** (see Pitfall 8): test the upgrade path = install old build, set filters, install new build, confirm filters survive. Code review cannot catch this.

**Detection (warning signs):** Any diff to `filterStore.ts` that touches `persist`, `partialize`, `name:` (storage key), or field names without a `version` bump; a split that changes which fields are returned by `partialize`.

**Milestone area:** Big-file refactors — *Split `filterStore.ts`*. Flag for mandatory on-device upgrade-path test.

---

### Pitfall 5: Regenerated `@eatme/database` types silently break edge functions or mask a missed migration

**What goes wrong:** Regenerating `types.ts` (CONCERNS line 112-121) is treated as a mechanical commit, but it can (a) be generated against the **wrong DB state** (a prod that hasn't had Phases B/C applied yet, since deploys are manual) — re-introducing dropped-table types and defeating the purpose; or (b) remove a type that app/admin code still references, turning a runtime-dead column into a compile error mid-refactor; or (c) drift from what edge functions assume (edge functions can't import workspace packages and **duplicate enums/schemas inline** per PROJECT.md constraints — so the regenerated types and the inline edge copies can silently disagree).

**Why it happens:** "Stage-don't-apply" means the generated types reflect whatever DB the user pointed `supabase gen types` at — which may lead or lag prod. The compile-time type-parity tests (TESTING.md line 240-255) only cover tables that have explicit parity tests.

**Consequences:** Either the cleanup is cosmetic-but-wrong (types still list dropped tables) or it breaks compilation in a way that blocks the rest of the milestone.

**Prevention (this stack):**
- **Regenerate types only after the corresponding migration is confirmed applied to the DB you generate against.** Sequence: apply Phase B/C migration → regenerate → commit. Do not commit slimmed types ahead of the prod drop, or the types will claim columns/tables exist that don't (or vice-versa).
- **Run `turbo check-types` across all apps** after regenerating; treat new compile errors as a map of code still referencing dropped schema (that's a feature — fix those references).
- **Manually reconcile the inline edge-function enum/schema copies** when a regeneration changes an enum — grep edge functions for the changed type; they won't fail `check-types` (infra/ is excluded from root tsconfig, CONVENTIONS line 58).

**Detection (warning signs):** A `types.ts` diff that still contains `dish_ingredients` / `canonical_ingredients` after Phase C; new `check-types` failures; an enum changed in `types.ts` but not in the corresponding edge-function inline copy.

**Milestone area:** Debt/dependency cleanup — *Regenerate types*. Must run **after** the schema-drop phases, not before.

---

### Pitfall 6: CORS lockdown that breaks the mobile client (which has no web origin) or drops preflight

**What goes wrong:** Replacing `'Access-Control-Allow-Origin': '*'` (verified in `feed/index.ts` line ~19, also `enrich-dish`) with a fixed allowlist breaks clients in two ways: (1) **React Native fetch sends no `Origin` header** (it's not a browser) — so an origin allowlist that the mobile app must "match" is the wrong model; the mobile client authenticates via JWT, not origin. Locking CORS to `app.eatme.com` can break the *admin* web client while doing nothing for mobile security. (2) Forgetting the **OPTIONS preflight** branch (or returning the locked origin only on the main response, not the preflight) makes browser-based admin calls fail preflight before the real request.

**Why it happens:** CORS is a browser mechanism; the codebase has one browser client (admin) and one non-browser client (mobile). A single allowlist applied uniformly mis-models both.

**Consequences:** Either admin calls fail (preflight/origin mismatch) or the lockdown gives false security confidence while the actually-sensitive endpoint (`feed`, which takes location + returns a user's personalized results) is unchanged for the mobile path. The real control for both is the JWT check, which CONCERNS line 166 confirms already exists.

**Prevention (this stack):**
- **Reflect-or-allowlist for browser origins (admin); rely on JWT for mobile.** Echo the request `Origin` back only if it's in a known set (admin origin); for requests with no `Origin` (mobile/native), do not block on CORS — enforce auth via the existing JWT validation.
- **Handle the OPTIONS preflight explicitly** and return the *same* `Access-Control-Allow-Origin` (and `-Allow-Headers` already present: `authorization, x-client-info, apikey, content-type`) on both the preflight and the real response.
- **Add `Vary: Origin`** when reflecting, so caches/Upstash don't serve one origin's CORS headers to another.
- **Test the admin browser path and a no-Origin (curl/native) path** after the change; don't assume `*`→allowlist is transparent.

**Detection (warning signs):** A CORS change that hardcodes a single origin and applies it to the OPTIONS handler only or the main handler only; admin console CORS errors post-deploy; treating mobile as needing an allowlisted origin.

**Milestone area:** Security & bugs — *Lock down wildcard CORS*.

---

## Moderate Pitfalls

### Pitfall 7: pgvector HNSW filtered search returns fewer results than expected after geo-filtering / radius timeout at scale

**What goes wrong:** The known issue (CONCERNS line 202-212): the HNSW ANN scan (`<=>`) runs **before** geography filtering, so at large radii (>~5km) on a full catalog the candidate pull either times out against the 8s `statement_timeout` or — when a tight geo/diet filter is applied — the index returns its top-k by vector distance and *then* filters, yielding **fewer than `LIMIT` rows** because most ANN hits fell outside the radius. Tuning `ef_search` up to compensate inflates latency and worsens the timeout. [HIGH]

**Why it happens:** Approximate indexes filter post-scan. With `hnsw.ef_search = 40` and a filter matching ~10% of rows, only ~4 of the requested rows survive on average.

**Prevention (this stack):**
- **Prefer geo-narrow-then-vector ordering** where possible: the migration-169 materialized-CTE pushdown already pushes the PostGIS radius set in front of the ANN ranking. When assessing 169, confirm the planner actually executes radius-restrict → vector-rank, not the reverse (read `EXPLAIN ANALYZE`).
- **Consider `hnsw.iterative_scan` (pgvector 0.8.0+)** — `SET hnsw.iterative_scan = strict_order; SET hnsw.ef_search = 100;` makes the index keep fetching until the filter is satisfied, fixing the "too-few-rows" symptom. **First verify the deployed pgvector version supports it** (0.8.0+); on older versions this is unavailable and the tiered-radius fallback (CONCERNS line 290) is the path.
- **Tiered radius** (try 3km, expand only if < N results) bounds worst-case scan size and avoids the timeout for the common dense-urban case.
- Don't blindly raise `ef_search` to fix recall — it directly increases scan cost and pushes toward the timeout.

**Detection:** Feed returning short result sets in dense areas with tight filters; `generate_candidates` latency climbing with radius; EXPLAIN showing vector rank before radius restrict.

**Milestone area:** Performance & scaling — *generate_candidates radius timeout*. Confirm pgvector version during the assessment step.

### Pitfall 8: Mobile refactor regressions invisible without on-device testing

**What goes wrong:** `BasicMapScreen.tsx` (608 lines), `DailyFilterModal.tsx` (894 lines), `filterStore.ts` bundle Mapbox camera, permissions, marker rendering, deep-links, and filter subscriptions (CONCERNS line 242-268). There is **zero mobile test coverage** and **no emulator in the agent loop** (PROJECT.md). A behavior-preserving split can break camera behavior, marker re-render, deep-link handling, or filter→feed wiring in ways `tsc`/lint never catch.

**Prevention (this stack):**
- **Define an on-device smoke checklist per refactor before coding** (camera centers on location, dish markers render and tap-through, daily filters apply and reset, deep-link opens correct dish, persisted permanent filters survive restart). Hand it to the user (mobile visual verification is the user's loop, per memory).
- **Split by extracting pure/leaf pieces first** (presentational subcomponents, pure selectors) — these are the lowest-risk extractions and the few that *can* be unit-tested (the milestone allows targeted tests that de-risk a specific refactor).
- **One refactor per commit**, so an on-device regression bisects cleanly.
- **Remove the dead `viewModeStore`/`ViewModeToggle` branch first** (CONCERNS line 141-152) — it shrinks `BasicMapScreen` before the split and removes a reachable-only-programmatically branch that would otherwise complicate the extraction.

**Detection:** Any mobile diff merged without an on-device pass; refactors that move camera/permission/deep-link logic in the same commit as a structural split.

**Milestone area:** Big-file refactors (mobile). Pair every mobile phase with a user on-device verification gate.

### Pitfall 9: Deno std migration off `@0.168.0` introducing breaking changes on cold start

**What goes wrong:** Every edge function imports `serve` from `https://deno.land/std@0.168.0/http/server.ts` (verified across feed, enrich-dish, group-recommendations, invalidate-cache, app-config, batch-update, update-preference-vector; menu-scan-worker uses `npm:@supabase/supabase-js`). `deno.land/std` now only gets security patches; new work lives on `jsr:@std`. Jumping straight from 0.168.0 to a current `jsr:@std/http` changes the `serve` API surface; a wrong import lands as a **runtime error on the next cold start** of a deployed function — not a build error — because edge functions don't go through `turbo check-types` (infra/ excluded). [HIGH]

**Prevention (this stack):**
- **The cleanest target on Supabase Edge is `Deno.serve` (built-in global) — drop the `std/http/server` import entirely** rather than chasing the JSR `@std/http` API. Supabase's runtime provides `Deno.serve`; this removes a whole dependency. Verify in the local edge runtime before deploying.
- If staying on `@std/http`, **step through `deno.land/std@0.224.0` first, then switch the specifier to `jsr:@std/http@<pin>`** (the documented migration path) rather than a single big jump.
- **Migrate and deploy one function at a time**, smoke-testing each (the project already deploys functions individually and runs Deno tests with `deno test --node-modules-dir=none -A`, per memory).
- **Note `menu-scan-worker/test.ts` imports `std@0.168.0/testing/asserts.ts`** — the assert module also moved (`jsr:@std/assert`); update test imports in the same pass or tests break.

**Detection:** A function that compiles locally but 500s on first invocation after deploy; mixed `deno.land/std` and `jsr:@std` versions; `serve` import left in place when `Deno.serve` would do.

**Milestone area:** Debt/dependency cleanup — *Pin/upgrade edge-function deps*.

### Pitfall 10: Pinning `@supabase/supabase-js@2` without verifying the pinned version behaves

**What goes wrong:** Functions import `@supabase/supabase-js@2` (unpinned minor) from esm.sh (verified); `app-config` already pins `@2.39.3`, `menu-scan-worker` uses `npm:@supabase/supabase-js@2`. Pinning all functions to one exact version is correct (CONCERNS line 319-325) but picking a version that differs from what each function was implicitly running can change RPC/error-shape behavior — and esm.sh vs `npm:` specifiers resolve/transpile differently, so "pin to the same number" across both specifier styles isn't guaranteed identical.

**Prevention (this stack):**
- **Pin to one exact version and standardize the specifier style** (prefer `npm:@supabase/supabase-js@<exact>` where the runtime supports it, matching menu-scan-worker; otherwise `esm.sh/@supabase/supabase-js@<exact>`). Don't mix `npm:` and `esm.sh` for the same dep across functions without reason.
- **Pick the version already running in prod** as the pin target (least-change) rather than latest, then upgrade deliberately as a separate step.
- **Smoke-test each function's happy path** after pinning (cold start + one real call), since behavior changes surface only at runtime.

**Detection:** A pin commit that upgrades versions and pins in one step; mixed specifier styles; no per-function smoke test after the pin.

**Milestone area:** Debt/dependency cleanup — *Pin edge-function deps*.

### Pitfall 11: Upstash feed-cache invalidation that purges the wrong keys (or nothing)

**What goes wrong:** Adding event-driven invalidation in `admin_confirm_menu_scan` (CONCERNS line 294-300) must purge feed cache keys for the affected restaurant — but feed keys are `(user_id, location_hash, filter_hash)` (CONCERNS line 296), which **do not contain restaurant_id**. A menu change can't be mapped to specific keys without an auxiliary index, so the naive implementation either purges nothing useful or flushes the whole namespace (thundering-herd cold cache → feed latency spike + possible `generate_candidates` timeout storm).

**Prevention (this stack):**
- **Decide the invalidation granularity deliberately:** maintain a secondary set per restaurant (Redis set of cache keys touching that restaurant) so a menu change purges a bounded key set; or accept a short TTL as "good enough" (current passive expiry) rather than a flush-all.
- **Avoid `FLUSHALL`/namespace-wide deletes** triggered by a single restaurant's menu update.
- This couples to the existing `invalidate-cache` edge function — route invalidation through it rather than duplicating Redis logic in the RPC.

**Detection:** Invalidation logic that calls a wildcard/flush; cache hit-rate cratering after a single menu confirm; feed latency spiking right after admin confirms a scan.

**Milestone area:** Performance & scaling — *event-driven cache invalidation*.

---

## Minor Pitfalls

### Pitfall 12: Surgical `DishKind` removal breaking `web-portal-v2` (on-ice, untested)

**What goes wrong:** Removing the `DishKind`/`DISH_KIND_META` shims from `@eatme/shared` (CONCERNS line 35-48, 81-92) breaks `web-portal-v2/src/components/menu/KindSelector.tsx` and `DishForm.tsx`, which still import them. v2 is on-ice and **not in CI**, so the break won't surface in `turbo build`/`turbo test` — it surfaces only if/when v2 is revived.

**Prevention:** Per PROJECT.md, the plan is *first* remove the usage from v2's `DishForm.tsx`/`KindSelector.tsx`, *then* delete the shims + `dish-kinds.test.ts`. Do them in that order in the same milestone; don't delete the shim while a consumer still imports it. Grep `@eatme/shared` consumers for `DishKind`/`DISH_KIND_META` before deleting.

**Milestone area:** Debt/dependency cleanup — *Surgical DishKind removal*.

### Pitfall 13: `infra/scripts` prod-write guard that's bypassable or blocks the user's real workflow

**What goes wrong:** Adding a `REQUIRE_DRY_RUN` gate (CONCERNS line 186-196) that's trivially bypassed (e.g., an env var the user always has set) gives false safety; one that's too strict blocks the legitimate dry-run→sample→full progression the user actually uses (memory: infra/scripts runs LIVE prod backfills, --dry-run first).

**Prevention:** Gate the **write path specifically** — require an explicit, intentional flag (e.g., `--confirm-prod-write` *in addition to* not passing `--dry-run`), default to dry-run when neither is present, and print the target project ref before any mutation. Preserve the existing dry-run→sample→full flow rather than replacing it.

**Milestone area:** Security & bugs — *prod-write guard*.

### Pitfall 14: Stale comment/doc cleanup that misses the actual behavior

**What goes wrong:** Fixing `enrich-dish` header comments (CONCERNS line 95-108) by deleting ingredient/parent-dish references is safe, but if the cleanup is done from the comment alone without reading the code, you might "fix" a comment that's actually still accurate for a surviving trigger (`trg_enrich_on_dish_change`, `after_dish_embedded`, `trg_enrich_on_option_group_change` are explicitly **preserved** per migration 151).

**Prevention:** Update comments against the *current code path*, not against the assumption that everything ingredient-adjacent is dead. Migration 151's "Preserved" list is the authority on which triggers still fire.

**Milestone area:** Debt/dependency cleanup — *stale comment fixes*.

---

## Phase-Specific Warnings

| Phase Topic | Likely Pitfall | Mitigation |
|-------------|---------------|------------|
| Assessment / findings register (foundation) | Acting on stale CONCERNS items (RLS may already be set via dashboard; types may already be current) | Run read-only prod queries (`pg_tables.rowsecurity`, `pg_policies`, check generated types vs live schema) before planning fixes — verdict each item confirmed/stale/resolved first |
| Ingredient teardown Phase B (drop triggers) | Dropping a still-wanted trigger | Use migration 151's explicit "Preserved" list; it's already authored + has a REVERSE file — verify it still matches prod before deploy |
| Ingredient teardown Phase C (drop tables) | `CASCADE` foot-gun / irreversible prod loss | Dependency-audit query first; drop in order with `RESTRICT`; treat as one-way |
| RLS audit on behavioral tables | Enable-without-policy (deny-all) + per-row `auth.uid()` | `ENABLE`+`CREATE POLICY` atomic in one migration; wrap `(select auth.uid())`; index owner column; verify caller is mobile-direct vs edge-only |
| CORS lockdown | Breaking admin preflight / mis-modeling mobile | Reflect allowlisted origin on both preflight+response; rely on JWT for native; add `Vary: Origin` |
| Edge dep upgrade (Deno std / supabase-js) | Runtime-only break on cold start | Prefer `Deno.serve`; migrate one function at a time; smoke-test cold start; update test imports too |
| Regenerate `@eatme/database` types | Generated against wrong DB state | Regenerate **after** schema drops are applied; run `turbo check-types`; reconcile inline edge copies |
| Split `filterStore.ts` | Corrupting persisted user filters | Keep storage key + partialize output identical, or bump `version` + add `migrate`; on-device upgrade-path test |
| Split `BasicMapScreen` / `DailyFilterModal` | Invisible mobile regression | Remove dead view-mode branch first; extract pure leaves; one refactor/commit; user on-device smoke checklist |
| Feed perf (generate_candidates / pgvector) | Filtered ANN returns too few rows / timeout | Verify migration-169 pushdown order via EXPLAIN; check pgvector version for `iterative_scan`; tiered radius |
| Upstash cache invalidation | Flush-all thundering herd | Per-restaurant key index or short TTL; route via `invalidate-cache` fn; never namespace-flush |
| DishKind shim removal | Breaking on-ice v2 (not in CI) | Remove v2 usage first, then delete shims; grep consumers before deleting |

---

## Sources

- Supabase RLS — InitPlan `(select auth.uid())` per-query vs per-row; enable-vs-policy semantics; service-role bypass: https://supabase.com/docs/guides/troubleshooting/rls-performance-and-best-practices-Z5Jjwv , https://supabase.com/docs/guides/database/postgres/row-level-security , https://supabase.com/docs/guides/database/database-advisors?lint=0003_auth_rls_initplan — **[HIGH]**
- pgvector HNSW filtered-scan returning fewer rows than LIMIT; `hnsw.iterative_scan` (0.8.0+); `ef_search` tradeoffs: https://supabase.com/docs/guides/ai/vector-indexes/hnsw-indexes , https://github.com/pgvector/pgvector/issues/721 , https://www.thenile.dev/blog/pgvector-080 — **[HIGH]**
- Deno `deno.land/std` → `jsr:@std` migration; std now patch-only; `@std/http` serve / `Deno.serve`: https://deno.com/blog/std-on-jsr , https://jsr.io/docs/migrate-x-to-jsr , https://jsr.io/@std/http — **[HIGH]**
- Postgres `DROP ... CASCADE` vs `RESTRICT`, `pg_depend`: PostgreSQL DROP TABLE docs (general knowledge, standard behavior) — **[MEDIUM]**
- Zustand `persist` `version`/`migrate`/`partialize`: Zustand persist middleware docs (general knowledge) — **[MEDIUM]**
- Codebase ground-truth: `infra/supabase/functions/feed/index.ts`, `enrich-dish/index.ts`, `infra/supabase/migrations/151_retire_ingredient_triggers.sql`, `apps/mobile/src/stores/filterStore.ts`, `.planning/codebase/CONCERNS.md`, `.planning/PROJECT.md` — **[HIGH]**
