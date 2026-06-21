# Phase 8: Mobile Filter Store Refactor - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-06-21
**Phase:** 08-mobile-filter-store-refactor
**Areas discussed:** Persistence approach, Serialization-seam proof, Pre-existing quirks, Slice file layout

---

## Persistence approach

| Option | Description | Selected |
|--------|-------------|----------|
| Keep hand-rolled | Move saveFilters/loadFilters + direct AsyncStorage verbatim; same keys/debounce/session-only semantics. Byte-for-byte safe. | ✓ |
| Migrate to persist middleware | Adopt Zustand `persist`; re-wraps storage as {state,version}; needs a legacy-key migration shim; breaks byte-for-byte. | |

**User's choice:** Keep hand-rolled
**Notes:** Recommended option. Aligns with the phase goal (no installed user loses saved filters). Also surfaced that CONCERNS.md's "bump the persist middleware version / check partialize" guidance is stale — there is no persist middleware in this store.

---

## Serialization-seam proof

| Option | Description | Selected |
|--------|-------------|----------|
| Throwaway diff harness | One-shot script diffing serialized permanent payload pre vs post split, then deleted. No runner setup. | ✓ |
| Committed targeted test | Stand up a mobile test runner + keep a permanent serialization unit test. | |
| Reasoning + on-device only | No code artifact; rely on verbatim moves + operator force-close/reopen check. | |

**User's choice:** Throwaway diff harness
**Notes:** Recommended option. Matches the cycle's minimal-test policy (apps/mobile has no test runner today). Pairs with — does not replace — the operator's on-device check (SC#3).

---

## Pre-existing behavior quirks

| Option | Description | Selected |
|--------|-------------|----------|
| Preserve exactly + log | Freeze current behavior incl. the saveFilters-vs-savePermanentFilters inconsistency; record quirks as deferred. | ✓ |
| Fix DB-sync inconsistency too | Route all permanent setters through savePermanentFilters (local+DB). Behavior change inside a behavior-preserving phase. | |

**User's choice:** Preserve exactly + log
**Notes:** Recommended option. Keeps the refactor a pure move so any on-device regression bisects cleanly. The DB-sync normalization is captured as a deferred follow-up.

---

## Slice file layout

| Option | Description | Selected |
|--------|-------------|----------|
| filterStore/ directory + index.ts | Convert filterStore.ts → folder; index.ts = composition root + re-export barrel; named slice files in locked order. Import path resolves unchanged. | ✓ |
| Your discretion | Keep locked slice order, leave exact file/dir structure to planning. | |

**User's choice:** filterStore/ directory + index.ts
**Notes:** Recommended option. index.ts must re-export useFilterStore + DailyFilters/PermanentFilters/DietPreference/FilterState + the value defaultDailyFilters (+ getDefaultDailyFilters, DAILY_FILTER_PRESETS). Exact file granularity left flexible.

---

## Claude's Discretion

- Exact number/naming of slice files within the chosen directory layout.
- Zustand `StateCreator` slice typing vs plain factory functions (final composed type + single `create()` call unchanged).
- Internal placement of the module-level `_saveFiltersTimer` debounce singleton.

## Deferred Ideas

- Normalize the permanent-setter DB-sync inconsistency (follow-up todo).
- Adopt Zustand `persist` middleware with a proper legacy-key migration (future modernization).
- Stand up a real test runner in apps/mobile (beyond this cycle's minimal-test policy).
