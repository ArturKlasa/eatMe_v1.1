# Milestones

## v1.0 Hardening (Shipped: 2026-06-28)

**Delivered:** A four-track codebase-hardening pass driven by CONCERNS.md — security, debt/dependency cleanup, performance/cache, and behavior-preserving refactors — with zero regression to the live mobile discovery experience.

**Phases completed:** 10 phases, 32 plans, 52 tasks
**Requirements:** 21/21 v1 complete (PERF-01 via SC#1; its `iterative_scan` sub-goal deferred → PERF-V2-01)
**Closeout type:** override_closeout
**Known verification overrides:** 5 (see STATE.md → Deferred Items)

**Key accomplishments:**

- **Assessment-first (Phase 1):** authored `FINDINGS.md` — a verdict overlay on all 26 CONCERNS findings — plus a strictly read-only `assess-live-state.sql` prod probe. The operator's one-shot run overturned several findings (prod already had RLS on every behavioral table; web-portal already deleted), materially descoping Phases 3 and 5 before any code changed.
- **Security (Phases 2–4):** locked the three edge functions to an allowlist CORS helper (`_shared/cors.ts`, fail-closed); codified prod's behavioral-table RLS into migration 170 (name-agnostic sweep, 30 InitPlan-form policies + 7 owner indexes, operator-validated on a prod-clone); and gated all 8 `infra/scripts` prod-write paths behind a shared default-dry-run guard (`--apply`-only, announces the target ref).
- **Debt & dependencies (Phases 4 & 6):** migrated all 8 edge functions to native `Deno.serve` on one exactly-pinned specifier set; tore down the orphaned ingredient pipeline (triggers → tables → columns, RESTRICT-ordered, snapshot-first) and removed the last `DishKind`/`DISH_KIND_META` shims; regenerated types verified residue-free.
- **Performance & cache (Phase 7):** wrapped `generate_candidates` in an expanding-radius loop (`[0.25, 0.5, 1.0]`, `POOL_TARGET=100`) and added a per-restaurant K=8 pre-cap (migration 175); widened cache invalidation to INSERT/UPDATE/DELETE (migration 176). `iterative_scan` assessed against the live corpus and deferred with evidence (+4.4s for zero recall benefit).
- **Behavior-preserving refactors (Phases 8–10):** decomposed the four largest files — `filterStore.ts` (927 lines), `BasicMapScreen.tsx`, `DailyFilterModal.tsx`, and admin `ReviewDishEditor.tsx` (1258 lines) — into co-located directories, each preserving its serialization/payload contract byte-for-byte and gated by operator on-device / in-browser smoke. All landmines preserved + guard-commented; zero reported regressions.

### Known Gaps

- **PERF-01 (SC#2):** the `iterative_scan` optimization was assessed against the live ~15k-dish corpus and deferred (added +4.4s at 10km for zero recall benefit at the 2.5km production tier). PERF-01 itself shipped via the tiered-radius loop (SC#1); the durable fix is carried forward as **PERF-V2-01** (geo-aware ANN rebuild).

### Deferred / Verification Overrides (acknowledged at close)

All five are operator-confirmation artifacts, not functional gaps (full notes in STATE.md → Deferred Items):

- `publish-statement-timeout` debug session — `fix-applied`; root cause (the per-row invalidate-cache trigger) was deleted by quick task 260627-cfb. Wants a large-publish re-test to formally close.
- Phase 04 UAT (1 pending) + VERIFICATION (`human_needed`) — edge-function live-deploy smoke; codebase half VERIFIED, operator-gated by design.
- Phase 07 UAT (3 pending) + VERIFICATION (`human_needed`) — prod migration-apply confirmation done verbally (07-05 SUMMARY) but not persisted as a machine-readable artifact.

---
