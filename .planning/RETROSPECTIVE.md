# Project Retrospective

*A living document updated after each milestone. Lessons feed forward into future planning.*

## Milestone: v1.0 — Hardening

**Shipped:** 2026-06-28
**Phases:** 10 | **Plans:** 32 | **Tasks:** 52

### What Was Built
- **Security:** allowlist CORS on the edge functions (`_shared/cors.ts`, fail-closed), prod RLS codified into a tracked migration (170, operator-validated on a prod-clone), and a shared default-dry-run guard on every `infra/scripts` prod-write path.
- **Debt/deps:** all 8 edge functions on native `Deno.serve` + one exactly-pinned specifier set; the orphaned ingredient pipeline and `DishKind` shims torn down (RESTRICT-ordered, snapshot-first); types verified residue-free.
- **Performance/cache:** tiered-radius feed loop + per-restaurant K=8 pre-cap (migration 175); cache invalidation widened to INSERT/UPDATE/DELETE (migration 176).
- **Refactors:** the four largest files (`filterStore`, `BasicMapScreen`, `DailyFilterModal`, `ReviewDishEditor`) decomposed behavior-preserving, each contract held byte-for-byte and gated by operator smoke.

### What Worked
- **Assessment-first paid off.** The Phase 1 findings register + one read-only prod probe overturned multiple findings (RLS already on, web-portal already deleted) *before* any code changed — Phases 3 and 5 were descoped instead of doing redundant work.
- **Stage-don't-apply held across the whole milestone.** Every migration was authored + dry-run; the operator applied to prod (170/175/176). Zero agent-direct prod writes, zero prod incidents.
- **Operator-as-regression-gate worked for the no-emulator surfaces.** On-device / in-browser smoke caught nothing broken because the refactors were pure verbatim moves with landmines guard-commented.
- **Byte-for-byte contract proofs** (serialization harness, payload inline-snapshot) made the high-risk refactors safe to ship without a broad test suite.

### What Was Inefficient
- **STATE/ROADMAP drift.** The ROADMAP progress table still showed Phase 5 "Not started" and Phase 6 "In Progress" at close though both were done weeks earlier — had to reconcile by hand before archiving. Phase transitions didn't keep the roadmap table current.
- **`milestone complete` accomplishment extraction is noisy** — it scraped deviation-log fragments ("Task 1 — Fixture", "[Rule 3 — Blocking]…") as accomplishments; the entry needed a manual rewrite.
- **Deferred verification piled up.** Five operator-confirmation artifacts (2 UAT, 2 verification, 1 debug) were confirmed verbally in summaries but never persisted as machine-readable closeouts, so they surfaced as "open" at milestone close.

### Patterns Established
- **Assessment-first phase** (findings register + read-only prod probe) gating downstream scope — repeat for any milestone touching uncertain live state.
- **Severed-first shim teardown:** delete app importers, then delete the shared symbol, gated by a zero-importer grep + `check-types`.
- **Pure-move refactor with guard-commented landmines** + a contract proof (snapshot/serialization harness) + operator smoke as the authoritative gate.
- **Stage-don't-apply** for all prod DB work; operator owns the apply.

### Key Lessons
1. Verify live state before planning fixes — several "concerns" were already resolved in prod; assuming the repo reflects prod would have wasted whole phases.
2. Persist verification/UAT closeouts at phase time, not at milestone close — verbal confirmation in a SUMMARY isn't a machine-readable artifact and resurfaces as an "open gap".
3. Keep the ROADMAP progress table current at each phase transition; reconciling 10 phases at close is error-prone.
4. For solo/no-emulator surfaces, a byte-for-byte contract proof + operator smoke is a sufficient and proportionate regression gate — a broad test suite would have been low-ROI.

### Cost Observations
- Model mix: predominantly Opus (quality profile).
- Notable: heavy use of GSD quick-tasks alongside planned phases (7 quick tasks during the milestone window) — the maintenance work rode the same rails as the planned work.

---

## Cross-Milestone Trends

### Process Evolution

| Milestone | Phases | Plans | Key Change |
|-----------|--------|-------|------------|
| v1.0 Hardening | 10 | 32 | Established assessment-first + stage-don't-apply + operator-as-regression-gate |

### Cumulative Quality

| Milestone | Tests added | Coverage approach | Notes |
|-----------|-------------|-------------------|-------|
| v1.0 Hardening | Seam-only (cors, prod-guard, tiered-loop, pre-cap, serialization, snapshot) | Minimal/targeted (no broad push) | RLS regression suite deferred → QUAL-V2-01 |

### Top Lessons (Verified Across Milestones)

1. *(first milestone — trends accumulate from v1.1 onward)*
