# Feature Research

**Domain:** Production-hardening baselines for a solo-operated Supabase + React Native (Expo) + Deno-edge food-discovery app
**Researched:** 2026-06-18
**Confidence:** HIGH

> **Reframing note.** This is a brownfield **codebase-hardening / tech-debt** milestone, not a feature cycle (see `.planning/PROJECT.md` → "New consumer features … Out of Scope"). "Features" below are read as the **hardening / quality / security / observability practices** expected of a production app of this kind. They are categorized as Table Stakes (must exist), Differentiators (worth it, optional, complexity-noted), and Anti-Features (over-engineering to deliberately avoid given a solo/single-operator app with a deliberate minimal-tests posture). Every Table Stakes item maps to a concrete finding in `.planning/codebase/CONCERNS.md`.

## Feature Landscape

### Table Stakes (Users Expect These)

Security / correctness baselines that **must** exist for a production app handling per-user location, preference vectors, and behavioral data. Missing these = the app is insecure or silently incorrect. Each maps to a CONCERNS finding.

| Feature (Hardening Practice) | Why Expected (Baseline It Establishes) | Complexity | Notes |
|---------|--------------|------------|-------|
| **CORS allowlist on edge functions** (`feed`, `enrich-dish`) | Wildcard `Access-Control-Allow-Origin: *` on endpoints that take location + return user-vector-ranked results is a baseline web-security violation; restrict to known app/admin origins | LOW | CONCERNS §Security. `feed` line 20, `enrich-dish` line 33. Keep wildcard only in dev; gate by env. Cheap, high-value. |
| **RLS enabled + owner policy on every user-owned behavioral table** | Default-deny RLS with `owner_id` FK is the project's own stated invariant (PROJECT.md Constraints). Without it, one authenticated user can read another's favorites / interactions / opinions via REST | MEDIUM | CONCERNS §Security RLS gap. Tables: `favorites`, `dish_opinions`, `user_dish_interactions`, `user_behavior_profiles`, `dish_analytics`, `user_points`, `user_sessions`, `user_visits`, `session_views`, `dish_photos`, `restaurant_experience_responses`, `eat_together_*`. **Assessment-first**: status is uncertain (may already be on via dashboard/early migration) — verify with `SELECT tablename, rowsecurity FROM pg_tables` before writing policies. Depends on findings-register triage. |
| **Prod-write guard on `infra/scripts`** | These scripts hit live prod with the service-role key; a single missing `--dry-run` is an irreversible prod mutation. A harness-enforced gate matches the operator's existing dry-run discipline | LOW | CONCERNS §Security. `replay-menu-scan-ab.ts`, `apply-phase6-flag-fixes.ts`. `REQUIRE_DRY_RUN`/explicit-confirm before any write path. Aligns with "Explain before executing" + "infra/scripts runs prod backfills" memory. |
| **Pin edge-function dependencies to exact versions** | Reproducible cold starts are table stakes for serverless. Unpinned `@supabase/supabase-js@2` (esm.sh) and old `deno.land/std@0.168.0` mean a silent breaking change or missed security patch on next cold start | LOW–MEDIUM | CONCERNS §Dependencies. supabase-js pin is trivial (pin patch, e.g. `@2.x.y`). Deno std bump toward 2.x module resolution is the harder, breaking part — scope the pin now, treat the std major bump as its own assessed step. |
| **Event-driven cache invalidation on data change** | A cache that only expires passively serves stale menus after an edit — a correctness defect, not just a perf nit. Bust affected keys when the source data changes | MEDIUM | CONCERNS §Scaling (Redis). Add a purge in `admin_confirm_menu_scan` for affected feed cache keys (`user_id`/`location_hash`/`filter_hash` namespace). Depends on understanding the cache key scheme in `feed/index.ts`. |
| **Generated DB types in sync with schema** | Types referencing dropped columns (migrations 153/156/163) cause runtime mismatch + misleading autocomplete; keeping generated types current is baseline type-safety hygiene | LOW | CONCERNS §Tech Debt. Regenerate `packages/database/src/types.ts` through migration 169; commit slimmed file. Best done *after* ingredient schema teardown so it sheds orphaned-table types in one pass. |
| **Remove known-dead / known-broken code paths** | Dead reachable branches and broken-by-design forms are latent bugs and maintainer traps. Removing them is baseline correctness hygiene | LOW–MEDIUM | CONCERNS §Bugs. Map restaurant-view-mode branch (`viewModeStore`/`ViewModeToggle`/`BasicMapScreen` line 510). Mobile changes are behavior-preserving + **on-device verified** (no emulator in agent loop). web-portal deletion is already done by the operator (2026-06-18) — verify clean. |
| **Accurate header/contract comments on retained code** | Stale comments referencing retired pipelines (ingredient triggers, parent-dish) actively mislead the next change; doc-accuracy on live files is baseline | LOW | CONCERNS §Tech Debt. `enrich-dish/index.ts` header (lines 9, 14–15). Pure doc fix, near-zero risk. |
| **Finish staged schema teardown of retired subsystems** | Inert triggers + orphaned tables (ingredient pipeline) bloat the generated types file and confuse future schema work; completing an already-planned, already-gated teardown is baseline debt repayment | MEDIUM | CONCERNS §Tech Debt. Phase B (drop triggers, mig 151 written) → Phase C (drop schema). **Stage-don't-apply**: author + dry-run only; operator deploys. Gate (Phase 7 stable ≥1–2wk) is satisfied (mig 163 shipped). |
| **Targeted regression test before any risky refactor** | Not a coverage push — a single characterization test that pins the *current* behavior of the thing you're about to move, so the refactor is provably behavior-preserving | LOW per test | PROJECT.md Out of Scope allows "targeted tests that de-risk a specific refactor." Highest value: `filterStore.ts` persisted-storage format (a wrong `partialize`/version bump silently corrupts user prefs on update) and feed Stage-2 ranking math if it's touched. Reuse existing Vitest patterns (TESTING.md). |

### Differentiators (Competitive Advantage)

Practices that genuinely raise robustness and would pay off **if** the project grows beyond solo / current scale — but are optional this cycle. Listed so the roadmap can consciously defer rather than accidentally skip.

| Feature (Hardening Practice) | Value Proposition | Complexity | Notes |
|---------|-------------------|------------|-------|
| **Automated RLS regression test** (anon + cross-user) | Turns the one-time RLS audit into a permanent guarantee — a future migration can't silently drop a policy. TESTING.md already shows the exact pattern (anon select → empty result; gated by local Supabase env) | MEDIUM | Worth it precisely because RLS is the one place a solo operator can't eyeball regressions. Gated integration test, runs only with local Supabase. Depends on the RLS audit (Table Stakes) landing first. The single highest-ROI "extra." |
| **Query-plan / timeout monitoring for `generate_candidates`** | The vector+geo candidate gen already brushes the 8s `statement_timeout` past ~5km (mig 169). A logged `EXPLAIN`/timing harness catches regressions before users hit timeouts | MEDIUM | CONCERNS §Perf/Scaling. This cycle: **assess** mig 169 pushdown and *propose* a tiered-radius / partition path — don't necessarily build it. Full geo-aware ANN re-architecture is an Anti-Feature for now (see below). |
| **Move feed Stage-2 diversity cap + final sort into SQL** | Shrinks the JS payload the edge function serializes as dish records get richer; reduces edge CPU/egress | MEDIUM–HIGH | CONCERNS §Perf. Behavior-sensitive (ranking output must not change) → pairs with a targeted ranking characterization test. Do only the parts that demonstrably help; measure first. |
| **Dependency-update automation (Renovate/Dependabot) — pinning only** | Once deps are pinned, an automated PR bot keeps them current without manual tracking — low ongoing cost for a solo dev | LOW–MEDIUM | Optional. Value is real but secondary to the *initial* pin. Config-only; no app code. Defer unless dep drift is already biting. |
| **Behavior-preserving big-file splits** | Splitting 600–1258 line god-files (`BasicMapScreen`, `filterStore`, `DailyFilterModal`, `ReviewDishEditor`) lowers change-risk in the fragile areas | MEDIUM | CONCERNS §Fragile Areas. Genuinely useful but **pure maintainability** — must be strictly behavior-preserving, and mobile ones need on-device verification. Sequence *after* security/correctness items; a split that breaks persisted state (filterStore) is worse than the size. |

### Anti-Features (Commonly Requested, Often Problematic)

Things that look like "good engineering practice" but are over-engineering for a solo operator with a deliberate minimal-tests posture. Documented to prevent scope creep and to align with PROJECT.md Out of Scope.

| Anti-Feature | Why Requested | Why Problematic (for THIS app) | Alternative |
|---------|---------------|-----------------|-------------|
| **Broad automated-test-coverage push** (unit suites for all stores/services/components) | "Production apps have high coverage"; CONCERNS lists many "zero tests" gaps | Explicitly **Out of Scope** (PROJECT.md): solo/single-operator, mobile verified on-device, breakage caught fast by the operator. Coverage ROI isn't there; large suites become maintenance ballast on still-churning code | Targeted characterization tests around *specific refactors only* (Table Stakes item). |
| **Heavy observability stack** (APM, distributed tracing, log aggregation, dashboards) | "Production needs observability" | Massive setup + ongoing cost for one operator and modest traffic; the app uses plain `console.*` by convention (CONVENTIONS.md) and that's adequate at current scale | Keep tagged `console.{error,warn}`; add the narrow timing/timeout log for `generate_candidates` only (Differentiator). |
| **Premature service extraction / microservices** (pull feed ranking or menu-scan into standalone services) | "Big files / hot paths should be their own service" | Adds deploy surface, network hops, and ops burden with no current scaling need; contradicts the monorepo + edge-function architecture | In-place big-file *splits* (Differentiator) and SQL pushdown where measured. No new deploy units. |
| **Full geo-aware ANN re-architecture / dedicated vector store** | `generate_candidates` brushes the timeout past 5km | Premature: tested stable at default 10km / current catalog. Rebuilding the vector+geo layer is a multi-week risk to the core discovery experience (Core Value: zero regression) | **Assess** mig 169 + *propose* tiered-radius / geo-tile partition as the documented scaling path; build only when dish density actually forces it. |
| **CI/CD gates, branch protection, mandatory PR review** | "Commit-straight-to-main is risky" | Directly contradicts the operator's locked workflow (commit straight to `main`, no feature branches — memory + PROJECT.md). Forcing PR ceremony on a solo project is pure friction | Keep straight-to-main; rely on atomic commits + the existing targeted Vitest suites running locally. |
| **Auto-applying migrations / scripts to prod from the agent** | "Automate the deploy" | **Out of Scope** (PROJECT.md): no local psql, stage-don't-apply, operator deploys dry-run→sample→full manually | Author + dry-run all SQL/scripts; hand off to operator. The prod-write guard (Table Stakes) reinforces this, it doesn't replace it. |
| **Reintroducing allergen/dietary safety or parent/variant dish modeling "while we're in here"** | "Hardening pass is a good time to fix the model" | Explicitly abandoned/replaced (allergens → protein-based; parent/variant → modifier groups, mig 163). Re-adding is anti-scope and re-introduces removed complexity | Leave removed. DishKind shims get *deleted* (Table Stakes adjacent), not revived. |
| **Component-level tests for the big admin/mobile UIs** (`ReviewDishEditor`, `DailyFilterModal`) | "These are big and fragile, test them" | Low ROI: admin is single-operator (breakage caught immediately, CONCERNS marks Medium), mobile is on-device verified. Component tests on churning UI rot fast | Lean on the existing `admin-confirm-rpc` integration test for the RPC contract; verify UI manually / on-device. |

## Feature Dependencies

```
[Findings-register triage / assessment]   ← FOUNDATION; everything depends on this
    ├──gates──> [RLS audit + owner policies]
    │               └──enables──> [Automated RLS regression test]   (Differentiator)
    ├──gates──> [CORS allowlist]
    ├──gates──> [Prod-write guard]
    └──gates──> [Pin edge deps]

[Ingredient schema teardown: Phase B (triggers) ──requires──> Phase C (schema)]
                                                        └──then──> [Regenerate DB types]
                                                                        (sheds orphaned-table types)

[DishKind removal from web-portal-v2] ──unblocks──> [Delete DishKind/DISH_KIND_META shims + dish-kinds.test.ts]

[Targeted ranking characterization test] ──de-risks──> [Feed Stage-2 SQL pushdown]   (Differentiator)
[Targeted filterStore-persistence test]  ──de-risks──> [filterStore.ts split]        (Differentiator)

[Cache invalidation] ──reads──> [feed cache-key scheme in feed/index.ts]
[generate_candidates assessment] ──proposes──> [tiered-radius / partition path]  (deferred build)
```

### Dependency Notes

- **Assessment gates everything:** PROJECT.md is assessment-first — several findings are explicitly uncertain (notably RLS status, which may already be enabled out-of-band). Validate against live DB / current code before any fix, so no effort is spent "fixing" an already-resolved item.
- **Phase B requires its gate (satisfied) and precedes Phase C:** drop inert triggers (mig 151, written) before dropping the schema they reference; regenerate types last to capture both column drops *and* orphaned-table removal in one slimmed commit.
- **DishKind shim removal requires the v2 edit first:** shims can't be deleted from `@eatme/shared` until `apps/web-portal-v2` (`DishForm.tsx`, `KindSelector.tsx`) stops importing them. v2 is on-ice — touch *only* minimally for this.
- **Targeted tests precede their refactors:** the only justified tests this cycle exist to make a specific behavior-preserving change provable (filterStore persistence, feed ranking). Write the test, then refactor.
- **Cache invalidation + ranking pushdown both read `feed/index.ts`:** sequence them aware of the same 1111-line file to avoid churn collisions.

## MVP Definition

"MVP" = the minimum hardening set that satisfies Core Value (CONCERNS items fixed *or* given a verified deliberate disposition, with **zero regression to live mobile discovery**).

### Launch With (this milestone, must-do)

- [ ] **Findings-register triage** — per-item verdict (confirmed / stale / already-resolved) against live code + DB — *foundation, gates all fixes*
- [ ] **CORS allowlist** on `feed` + `enrich-dish` — *baseline security, LOW cost*
- [ ] **RLS audit + owner policies** on behavioral tables — *highest-severity correctness/security risk*
- [ ] **Prod-write guard** in `infra/scripts` — *prevents irreversible prod mutation*
- [ ] **Pin edge deps** (supabase-js exact; scope the Deno std bump) — *deterministic, patched cold starts*
- [ ] **Cache invalidation** on `admin_confirm_menu_scan` — *fixes stale-menu correctness defect*
- [ ] **Regenerate DB types** through mig 169 — *type-safety hygiene*
- [ ] **Remove dead map view-mode branch** + verify web-portal deletion clean — *latent-bug removal*
- [ ] **Fix `enrich-dish` stale comments** — *doc accuracy, near-zero risk*

### Add After Validation (this milestone, if capacity)

- [ ] **Ingredient teardown Phase B → C** (staged) + post-teardown type regen — *trigger: findings confirm triggers inert; gate satisfied*
- [ ] **DishKind v2 edit → delete shims + `dish-kinds.test.ts`** — *trigger: v2 minimal-touch acceptable*
- [ ] **Automated RLS regression test** — *trigger: after RLS audit lands; locks the guarantee in*
- [ ] **Targeted characterization test(s)** for any refactor actually undertaken — *trigger: a specific risky refactor is chosen*
- [ ] **Big-file splits** (`filterStore`, `BasicMapScreen`, `DailyFilterModal`, `ReviewDishEditor`) — *trigger: security/correctness items done; behavior-preserving + on-device verified*

### Future Consideration (defer beyond this milestone)

- [ ] **Feed Stage-2 SQL pushdown** — *defer: behavior-sensitive; do only if measurement shows payload pain*
- [ ] **generate_candidates tiered-radius / partition build** — *defer: assess + document path now; build when density forces it*
- [ ] **Deno std major bump to 2.x module resolution** — *defer: breaking across all edge functions; isolate as its own assessed change*
- [ ] **Dependency-update automation (Renovate)** — *defer: value after manual pinning; config-only when wanted*

## Feature Prioritization Matrix

| Feature (Hardening Practice) | Risk-Reduction Value | Implementation Cost | Priority |
|---------|------------|---------------------|----------|
| Findings-register triage (assessment) | HIGH | LOW | P1 |
| RLS audit + owner policies | HIGH | MEDIUM | P1 |
| CORS allowlist | HIGH | LOW | P1 |
| Prod-write guard | HIGH | LOW | P1 |
| Cache invalidation on menu change | MEDIUM | MEDIUM | P1 |
| Pin edge deps (supabase-js) | MEDIUM | LOW | P1 |
| Regenerate DB types | MEDIUM | LOW | P1 |
| Remove dead map view-mode branch | MEDIUM | LOW | P1 |
| Fix enrich-dish stale comments | LOW | LOW | P1 |
| Ingredient teardown Phase B → C (staged) | MEDIUM | MEDIUM | P2 |
| DishKind shim removal | LOW | LOW | P2 |
| Automated RLS regression test | HIGH | MEDIUM | P2 |
| Targeted characterization tests | MEDIUM | LOW (per test) | P2 |
| Big-file splits | MEDIUM | MEDIUM | P2 |
| Feed Stage-2 SQL pushdown | MEDIUM | HIGH | P3 |
| generate_candidates re-architecture (build) | MEDIUM (future) | HIGH | P3 |
| Deno std 2.x major bump | MEDIUM | HIGH | P3 |
| Dependency-update automation | LOW | LOW–MEDIUM | P3 |

**Priority key:**
- P1: Must do this milestone — security/correctness baselines (Table Stakes)
- P2: Should do this milestone if capacity — debt repayment + the one high-ROI test (RLS regression)
- P3: Defer — assess + document the path, build later only when forced

## Competitor Feature Analysis

Not applicable — this is an internal codebase-hardening milestone, not a competitive product cycle. The relevant "standard" is the production-baseline expectation for a Supabase + RN + Deno-edge app: RLS-default-deny on user data, origin-restricted edge CORS, pinned serverless deps, guarded prod-mutation tooling, and cache invalidation tied to source-data change. All Table Stakes items align with those norms; all Anti-Features deviate from them deliberately *because* this is a solo/single-operator app with a stated minimal-tests posture.

## Sources

- `.planning/PROJECT.md` — scope, Out of Scope, constraints, key decisions (HIGH — project source of truth)
- `.planning/codebase/CONCERNS.md` — the findings register driving this milestone (HIGH — direct codebase audit, 2026-06-19)
- `.planning/codebase/TESTING.md` — current test posture; RLS-deny + gated-integration patterns to reuse (HIGH)
- `.planning/codebase/CONVENTIONS.md` — logging (`console.*`), error-handling, custom `no-unwrapped-action` lint rule (HIGH)
- Project memory (MEMORY.md) — commit-straight-to-main, stage-don't-apply prod, on-device mobile verification, infra/scripts prod posture (HIGH)

---
*Feature research for: production-hardening baselines, solo-operated Supabase + RN + Deno-edge food-discovery app*
*Researched: 2026-06-18*
