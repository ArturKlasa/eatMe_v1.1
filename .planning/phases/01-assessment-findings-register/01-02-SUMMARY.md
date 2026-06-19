---
phase: 01-assessment-findings-register
plan: 02
subsystem: infra
tags: [sql, postgres, rls, pgvector, supabase, prod-probe, read-only, security-gate]

# Dependency graph
requires:
  - phase: 01-assessment-findings-register (Plan 01)
    provides: FINDINGS register with PENDING live-state sections (F-11 RLS, F-13 pgvector, F-21 webhook coverage) awaiting prod paste-back
provides:
  - "infra/scripts/assess-live-state.sql — ONE consolidated strictly read-only prod-state probe (D-08)"
  - "Wave-0 static-safety evidence (READONLY_OK) clearing the script for the Plan 03 operator checkpoint"
affects: [01-03 operator-checkpoint, 01-04 scope-propagation, phase-3-rls, phase-6, phase-7-pgvector-webhooks]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Read-only SQL probe with hard guard: BEGIN; SET TRANSACTION READ ONLY; ... ROLLBACK; (no COMMIT)"
    - "Wave-0 static-safety gate: strip comment lines then grep canonical write-keyword list before operator handoff"

key-files:
  created:
    - infra/scripts/assess-live-state.sql
  modified: []

key-decisions:
  - "Moved the Block 3 inline '-- INSERT/UPDATE/DELETE' descriptive comment off the executable SELECT line onto its own '--' comment line so the canonical write-keyword gate strips it (the gate only strips lines that START with --)"
  - "Reworded the ROLLBACK trailing comment ('nothing to write back' instead of 'nothing to commit') so the acceptance grep -ic COMMIT returns 0"
  - "Placed the dish_analytics exclusion rationale on the four comment lines BEFORE the '-- [BLOCK 4]' label so the acceptance grep -A6 'BLOCK 4' finds zero dish_analytics occurrences while the exclusion is still documented"

patterns-established:
  - "Read-only operator prod-probe (.sql sibling to the .ts operator scripts): comment header banner + transaction-level read-only guard + labeled SELECT-only blocks + ROLLBACK close"
  - "Comments that name forbidden tokens (INSERT/UPDATE/DELETE/COMMIT) must live on lines starting with -- so the static gate's comment-strip removes them"

requirements-completed: [ASSESS-02, ASSESS-03]

# Metrics
duration: 9min
completed: 2026-06-19
status: complete
---

# Phase 01 Plan 02: Read-Only Prod-State Probe Summary

**Authored `infra/scripts/assess-live-state.sql` — a strictly read-only Supabase prod-state probe (BEGIN; SET TRANSACTION READ ONLY; ... ROLLBACK; no COMMIT) covering RLS+policies, an unprotected-table catch-all, pgvector version, deployed feed-table triggers, and owner-column sanity in one paste-back pass — and proved it read-only via the Wave-0 static-safety gate before operator handoff.**

## Performance

- **Duration:** ~9 min
- **Completed:** 2026-06-19
- **Tasks:** 2
- **Files modified:** 1 (created)

## Accomplishments
- Authored the ONE consolidated read-only prod probe (D-08), query bodies copied VERBATIM from 01-RESEARCH.md lines 149-200 + the A2 catch-all from line 326 — no SQL invented.
- Five labeled blocks present: BLOCK 1 (RLS + policies via pg_tables LEFT JOIN pg_policies over the 11 behavioral tables), BLOCK 1b (catch-all `rowsecurity=false`), BLOCK 2 (pgvector via pg_extension + pg_available_extensions), BLOCK 3 (deployed triggers via information_schema.triggers over restaurants/menus/dishes), BLOCK 4 (owner-column sanity via information_schema.columns).
- Read-only hard guard in place: `BEGIN; SET TRANSACTION READ ONLY;` open, `ROLLBACK;` close, zero COMMIT anywhere.
- `dish_analytics` correctly EXCLUDED from the Block 4 owner-column IN-list (dish-keyed, no user_id) with a documented rationale comment; it remains present in Block 1 as an RLS target.
- Wave-0 static-safety gate passes: zero write keywords on any executable (non-comment) line → `READONLY_OK`, exit 0. Script cleared for the Plan 03 operator checkpoint.

## Task Commits

1. **Task 1: Author the read-only probe (header + 4 labeled blocks + catch-all + guard)** — `be1fa3e` (feat)
2. **Task 2: Wave-0 static-safety gate** — no code change of its own; a verification gate. Evidence recorded below. (The Block 3 inline-comment fix it surfaced is folded into the Task 1 commit `be1fa3e`.)

**Plan metadata:** (final docs commit — see Task Commits trailer)

## Files Created/Modified
- `infra/scripts/assess-live-state.sql` — read-only prod-state probe; 5 labeled SELECT-only blocks wrapped in a read-only transaction guard. The operator runs it once in the Supabase SQL editor and pastes the full output back at the Plan 03 checkpoint.

## Static-Safety Gate Evidence (Task 2)

The Wave-0 gate the VALIDATION contract requires before the operator ever executes the script. Both commands + their passing output, verbatim:

**Gate 1 — write-keyword grep over non-comment lines (must print READONLY_OK, exit 0):**

Command:
```
grep -vE '^[[:space:]]*--' infra/scripts/assess-live-state.sql | grep -inE '\b(insert|update|delete|alter|drop|create|truncate|grant|revoke)\b' && { echo 'FAIL: write keyword found'; exit 1; } || echo READONLY_OK
```
Output:
```
READONLY_OK
gate1_exit=0
```

**Gate 2 — read-only guard presence (must return 1):**

Command:
```
grep -c 'SET TRANSACTION READ ONLY' infra/scripts/assess-live-state.sql
```
Output:
```
1
```

**Gate 3 — no COMMIT path (must return 0):**

Command:
```
grep -ic 'COMMIT' infra/scripts/assess-live-state.sql
```
Output:
```
0
```

The keyword list is the VALIDATION.md canonical quick-run list (`insert|update|delete|alter|drop|create|truncate|grant|revoke`, `create` included). `SET TRANSACTION READ ONLY`, `pg_available_extensions`, `pg_extension`, and `information_schema` contain none of the forbidden tokens. Script is statically validated read-only — cleared for operator handoff at the Plan 03 checkpoint (mitigates threat T-1-03).

## Task 1 Acceptance-Criteria Evidence

- `test -f infra/scripts/assess-live-state.sql` → OK
- `grep -c 'SET TRANSACTION READ ONLY'` → 1
- `grep -c 'ROLLBACK'` → 1 (≥1); `grep -ic 'COMMIT'` → 0
- `grep -cE '\-\- \[BLOCK [1-4]'` → 5 (≥4)
- `grep -c 'pg_policies'` → 1; `grep -c 'pg_extension'` → 1; `grep -c 'information_schema.triggers'` → 1; `grep -c 'rowsecurity=false'` → 1
- `grep -A6 'BLOCK 4' | grep -c dish_analytics` → 0 (excluded from owner-column block)
- `grep -c "'dish_analytics'"` → 1 (still an RLS target in Block 1)
- `wc -l` → 69 (≥40 min_lines)

## Decisions Made
See `key-decisions` frontmatter. All three are presentation-only adjustments that keep the security/acceptance gates green while preserving the documented rationale and verbatim query bodies; none alter the catalog queries' semantics.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Block 3 inline comment tripped the write-keyword gate**
- **Found during:** Task 2 (Wave-0 static-safety gate)
- **Issue:** The verbatim RESEARCH line `trigger_name, event_manipulation AS event,  -- INSERT/UPDATE/DELETE` placed the forbidden tokens INSERT/UPDATE/DELETE on an executable SQL line. The canonical gate strips only lines that START with `--`, so this inline comment was not stripped and the gate reported `FAIL: write keyword found` at line 28.
- **Fix:** Moved the descriptive note to its own `--` comment line above the SELECT (`-- event_manipulation reports the wired event per trigger (the three DML events).`), removing the literal forbidden tokens from any executable line. Query semantics unchanged.
- **Files modified:** infra/scripts/assess-live-state.sql
- **Verification:** Gate 1 re-run → `READONLY_OK`, exit 0.
- **Committed in:** be1fa3e (Task 1 commit — file authored and fixed before commit)

**2. [Rule 1 - Bug] Acceptance-grep false positives from comment wording/placement**
- **Found during:** Task 1 acceptance-criteria run
- **Issue:** (a) `grep -ic 'COMMIT'` matched the substring "commit" in the trailing comment `-- read-only; nothing to commit` → returned 1 (criterion wants 0). (b) The dish_analytics-exclusion NOTE comment sat on the lines AFTER the `-- [BLOCK 4]` label, so `grep -A6 'BLOCK 4' | grep -c dish_analytics` returned 1 (criterion wants 0).
- **Fix:** (a) Reworded the ROLLBACK comment to `-- read-only; nothing to write back`. (b) Moved the exclusion rationale to the four comment lines BEFORE the `-- [BLOCK 4]` label so it is outside the `-A6` window while still documenting the deliberate exclusion.
- **Files modified:** infra/scripts/assess-live-state.sql
- **Verification:** `grep -ic 'COMMIT'` → 0; `grep -A6 'BLOCK 4' | grep -c dish_analytics` → 0; dish_analytics still present in Block 1 (`grep -c "'dish_analytics'"` → 1).
- **Committed in:** be1fa3e (Task 1 commit)

---

**Total deviations:** 2 auto-fixed (1 blocking, 1 bug). All were comment-wording/placement adjustments to satisfy the security gate + acceptance greps; the verbatim catalog query bodies and the read-only guard are unchanged.
**Impact on plan:** None on scope. No SQL invented or altered; no prod execution performed (that is the operator's job at Plan 03).

## Issues Encountered
None beyond the two auto-fixed deviations above.

## User Setup Required
None for this plan. The script is authored and statically validated read-only but NOT executed — the operator runs it in the Supabase SQL editor at the Plan 03 checkpoint and pastes the output back.

## Next Phase Readiness
- `assess-live-state.sql` is statically validated read-only and ready for the Plan 03 operator checkpoint.
- Its four labeled blocks + catch-all fill the FINDINGS.md PENDING live-state sections (F-11 RLS Block 1/1b/4, F-13 pgvector Block 2, F-21 webhook coverage Block 3) once the operator pastes output back.
- No application-code changes were made; no prod state was touched.

## Self-Check: PASSED
- FOUND: infra/scripts/assess-live-state.sql
- FOUND: .planning/phases/01-assessment-findings-register/01-02-SUMMARY.md
- FOUND: commit be1fa3e (Task 1 — author probe)

---
*Phase: 01-assessment-findings-register*
*Completed: 2026-06-19*
