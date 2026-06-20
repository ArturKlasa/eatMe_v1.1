# Phase 5: Dead Code & Doc Cleanup - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-06-20
**Phase:** 5-dead-code-doc-cleanup
**Areas discussed:** View-mode removal, Doc cleanup breadth, enrich-dish comment wording, Verification & commit shape

---

## Area Selection

| Option | Description | Selected |
|--------|-------------|----------|
| View-mode: keep or kill + depth | CLEAN-01, flagged highest-stakes (toggle actually user-reachable) | ✓ |
| Doc cleanup breadth | CLEAN-02, refs beyond the 4 named files | ✓ |
| enrich-dish comment wording | CLEAN-03, mostly mechanical | ✓ |
| Verification & commit shape | build-clean proof, on-device, commit granularity | ✓ |

**User's choice:** All four areas.

---

## View-mode removal — keep or kill

| Option | Description | Selected |
|--------|-------------|----------|
| Remove it fully | Delete store + toggle + branch; git history keeps it recoverable; unblocks Phase 9 | ✓ |
| Keep it parked (like web-portal-v2) | Leave code, hide the toggle render | |

**User's choice:** Remove it fully.
**Notes:** Scout discovered the F-09 "toggle not rendered" evidence is inaccurate — `ViewModeToggle` is rendered in `DailyFilterModal.tsx:146`, so the Places tab is user-reachable today. Operator chose deletion over parking despite the "for now" memory signal.

## View-mode removal — cascade depth

| Option | Description | Selected |
|--------|-------------|----------|
| Full cascade — leave zero residue | 3 named artifacts + DailyFilterModal render + styles + RestaurantMarkers + mapPinRestaurants + dead handler | ✓ |
| Stop at the toggle — keep RestaurantMarkers | Minimal-correct removal, leave RestaurantMarkers.tsx as standalone orphan | |

**User's choice:** Full cascade — leave zero residue.
**Notes:** Cleanest prep for the Phase 9 BasicMapScreen decompose.

---

## Doc cleanup breadth — scope

| Option | Description | Selected |
|--------|-------------|----------|
| All agent-facing docs | 4 named + conventions.md + commands.md + PROMPT.md; leave code provenance + archives | ✓ |
| Strict 4 named files only | Literal CLEAN-02 scope | |
| Docs + code provenance comments | Also fix menu-scan-worker/backfill provenance comments | |

**User's choice:** All agent-facing docs.

## Doc cleanup breadth — edit style

| Option | Description | Selected |
|--------|-------------|----------|
| Rewrite to current reality | Reflect admin = portal, v2 on ice; scrub-only for historical records | ✓ |
| Just delete the references | Remove lines without rewriting surrounding prose | |

**User's choice:** Rewrite to current reality.

## Doc cleanup breadth — CLAUDE.md:62 DishKind line

| Option | Description | Selected |
|--------|-------------|----------|
| Leave for Phase 6 | Phase 6 (DEBT-03) rewrites it when shims are removed | ✓ |
| Fix the staleness now | Correct the "app is deleted" fact now | |

**User's choice:** Leave for Phase 6.

---

## enrich-dish comment wording

| Option | Description | Selected |
|--------|-------------|----------|
| Match the comment to actual code | Executor reads load logic, writes provably-accurate header | ✓ |
| Literal drop, trust the finding | Delete ingredient/parent-dish words, trust F-06 | |

**User's choice:** Match the comment to actual code.
**Notes:** Keep `option_group` (trigger kept alive by migration 151) + the after_dish_embedded line; drop all ingredient/parent-dish refs.

---

## Verification & commit shape — verification

| Option | Description | Selected |
|--------|-------------|----------|
| Typecheck + grep, build only if needed | turbo check-types + grep for zero live web-portal imports + deno check + on-device smoke | ✓ |
| Full turbo build | Full monorepo build to prove workspace cleanliness | |

**User's choice:** Typecheck + grep, build only if needed.

## Verification & commit shape — commits

| Option | Description | Selected |
|--------|-------------|----------|
| One commit per track | CLEAN-01 / CLEAN-02 / CLEAN-03 separate commits | ✓ |
| One cleanup commit | Single bundled Phase 5 commit | |

**User's choice:** One commit per track.

---

## Claude's Discretion

- Exact corrected wording of the enrich-dish header (within the keep/drop constraints).
- Exact prose when rewriting web-portal architecture references to current reality.
- Which handlers/imports are proven dead by the CLEAN-01 cascade (verified via typecheck).

## Deferred Ideas

- CLAUDE.md:62 DishKind-shim sentence → Phase 6 (DEBT-03).
- Code-comment provenance refs (menu-scan-worker, backfill-cuisine) → intentionally left as-is.
- types.ts regen (F-07/DEBT-04) → Phase 6.
