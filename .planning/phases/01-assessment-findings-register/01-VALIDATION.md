---
phase: 1
slug: assessment-findings-register
status: approved
nyquist_compliant: true
wave_0_complete: true
created: 2026-06-18
---

# Phase 1 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.
>
> **This is a docs + read-only-SQL phase, not application code.** Validation = artifact-completeness checks + SQL static-safety review, NOT a unit-test suite. No app test runner (Vitest / `deno test`) is exercised. Consistent with the project's minimal-tests decision.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | None applicable (no app code changes). Validation = artifact-completeness + SQL static safety review. |
| **Config file** | none — checks are grep/diff gates listed below |
| **Quick run command** | SQL read-only check: `grep -inE '\b(insert\|update\|delete\|alter\|drop\|create\|truncate\|grant\|revoke)\b' infra/scripts/assess-live-state.sql` → zero hits outside comments |
| **Full suite command** | N/A — completeness checklist below is the gate |
| **Estimated runtime** | < 5 seconds (grep/diff only) |

---

## Sampling Rate

- **After the SQL script is written:** Run the write-keyword grep + confirm `SET TRANSACTION READ ONLY` guard present — before it is ever handed to the operator.
- **After the register's code-assessable (Pass-A) verdicts are written:** Run the completeness checklist (every CONCERNS finding has a row; every cited `file:line` resolves on current HEAD).
- **At the execution checkpoint (Pass-B):** Confirm all three live-state sections (RLS, pgvector, webhook) are populated from the operator paste-back and reconciled against the code-first assessment.
- **Before `/gsd-verify-work`:** Completeness checklist fully green; scope edits applied only after user sign-off, with no phase renumber.
- **Max feedback latency:** < 5 seconds (static checks).

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 1-XX-XX | TBD | 1 | ASSESS-01 | — | Register completeness: detail-section count ≥ CONCERNS finding count (~26); no empty verdict/evidence cells | completeness | `grep -c '^### ' .planning/codebase/FINDINGS.md` ≥ CONCERNS finding count | ❌ W0 | ⬜ pending |
| 1-XX-XX | TBD | 1 | ASSESS-01 | — | No verdict cites a stale line number | correctness | Each cited `file:line` resolves via `git grep -n` on current HEAD | ❌ W0 | ⬜ pending |
| 1-XX-XX | TBD | 1 | ASSESS-02 / ASSESS-03 | T-1-XX (prod read access) | SQL script is read-only & syntactically sound | static safety | write-keyword grep returns 0 outside comments; `SET TRANSACTION READ ONLY` present | ❌ W0 | ⬜ pending |
| 1-XX-XX | TBD | 2 (checkpoint) | ASSESS-02 | — | RLS state captured for every behavioral table + catch-all; each labeled mobile-direct vs service-role-only | completeness | Block 1 + catch-all output transcribed; no behavioral table missing | ❌ W0 | ⬜ pending |
| 1-XX-XX | TBD | 2 (checkpoint) | ASSESS-03 | — | pgvector extversion + deployed INSERT/UPDATE/DELETE webhook coverage recorded; code-first vs deployed reconciled | completeness | Block 2 + Block 3 output present; register states agree-or-drift | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky. Task IDs finalized by the planner; the wave-2 rows are the D-10 checkpoint-gated live-state sections.*

---

## Wave 0 Requirements

- [ ] **FINDINGS completeness checklist** — finding-count parity (FINDINGS detail sections ≥ CONCERNS findings, ~26) + filled-cell check (no empty verdict/evidence). No such checker exists; implement as a manual review step or a tiny grep gate.
- [ ] **SQL read-only static check** — write-keyword grep (`INSERT|UPDATE|DELETE|ALTER|DROP|CREATE|TRUNCATE|GRANT|REVOKE` → 0 outside comments) + `SET TRANSACTION READ ONLY` guard presence. Implement as a one-line grep gate run before the operator executes the script.
- [ ] **Framework install:** none required.

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Live RLS / pgvector / webhook state captured | ASSESS-02, ASSESS-03 | Prod-only by design (stage-don't-apply, no local psql); only the operator can run prod SQL | Operator runs `infra/scripts/assess-live-state.sql` once in the Supabase SQL editor and pastes full output back at the D-10 checkpoint |
| Code-first vs deployed reconciliation (webhook) | ASSESS-03 | Requires human judgment comparing migration code intent against the deployed-trigger dump | Reviewer confirms the register shows BOTH sides and explicitly states agree-or-drift |
| Scope edits to ROADMAP/REQUIREMENTS | ASSESS-01 (D-11/D-12) | User-gated; edits applied only after sign-off, no renumber | User reviews proposed scope-impact changes at phase close; reviewer diffs ROADMAP to confirm only annotations added, phase numbers unchanged |

---

## Validation Sign-Off

- [x] All tasks have an automated static check (grep/diff/file-resolve) or a documented manual-only verification with checkpoint gating
- [x] Sampling continuity: SQL safety check runs before operator handoff; completeness check runs before phase close
- [x] Wave 0 covers the two MISSING checkers (completeness checklist + SQL read-only gate — both embedded as inline plan gates; no separate install needed)
- [x] No watch-mode flags
- [x] Feedback latency < 5s
- [x] `nyquist_compliant: true` set in frontmatter

**Approval:** approved 2026-06-19
