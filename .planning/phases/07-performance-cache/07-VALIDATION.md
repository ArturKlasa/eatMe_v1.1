---
phase: 7
slug: performance-cache
status: planned
nyquist_compliant: true
wave_0_complete: false
created: 2026-06-21
---

# Phase 7 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.
> Source of truth for methods: `07-RESEARCH.md` → "## Validation Architecture".
> All validation works WITHOUT prod access (stage-don't-apply, REST-only, no local psql).

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Deno test for edge logic (`deno test --node-modules-dir=none -A <path>`; deno at ~/.deno) + SQL dry-run parse for migrations |
| **Config file** | none for `feed/` (no existing Deno suite); migrations validated by parse/dry-run only |
| **Quick run command** | `deno check infra/supabase/functions/feed/index.ts` |
| **Full suite command** | n/a (minimal-tests posture — targeted Deno tests for the behavior-preserving seams only) |
| **Estimated runtime** | ~15 seconds |

---

## Sampling Rate

- **After every task commit:** Run `deno check` on edited edge files; SQL parse of edited migration
- **After every plan wave:** Run the byte/row-count harness + behavior-preserving diversified-output assertion
- **Before `/gsd-verify-work`:** All migrations authored + REVERSE-paired + dry-run validated; targeted Deno tests green
- **Max feedback latency:** ~15 seconds

---

## Per-Task Verification Map

> Populated by the planner during planning. Each task maps to an automated `<verify>` or a Wave 0 fixture/harness dependency. See `07-RESEARCH.md` "## Validation Architecture" → "Per-Success-Criterion validation" for the method per SC.

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 01-T1 fixture | 07-01 | 1 | PERF-02 | — | n/a (test asset) | fixture/parse | `node -e` JSON shape assert (≥3 rest × ≥8 dishes, modifier_groups) | ❌ → create | ⬜ pending |
| 01-T2 tiered harness | 07-01 | 1 | PERF-01 | T-07-06/07 | loop never exceeds requested radius; shape parity | unit (Deno) | `deno test ... feed/__tests__/tiered-loop.test.ts` | ❌ → create | ⬜ pending |
| 01-T3 pre-cap + DELETE harness | 07-01 | 1 | PERF-02/03 | T-07-01/11 | pre-cap behavior-preserving; DELETE old_record | unit (Deno) | `deno test ... precap-behavior.test.ts delete-path.test.ts` | ❌ → create | ⬜ pending |
| 02-T1 mig 175 forward | 07-02 | 2 | PERF-01/02 | T-07-01/02/03 | iterative_scan bounded; pre-cap K=8; directive kept | sql parse/grep | grep-structure gate (iterative_scan + ROW_NUMBER + use_column) | ❌ → create | ⬜ pending |
| 02-T2 mig 175 REVERSE | 07-02 | 2 | PERF-01/02 | — | RESET GUCs + restore 169 body, no DROP | sql parse/grep | grep-structure gate (RESET + CREATE OR REPLACE, no ROW_NUMBER) | ❌ → create | ⬜ pending |
| 03-T1 tiered loop | 07-03 | 2 | PERF-01 | T-07-05/06/07 | byte-identical below `pool`; bounded radius | typecheck + git-diff | `deno check feed/index.ts` + diff-scope assert | ❌ → edit | ⬜ pending |
| 03-T2 loop parity | 07-03 | 2 | PERF-01 | T-07-07 | break/replace/shape contract holds | unit (Deno) | `deno test ... tiered-loop.test.ts` | ✅ (W0) | ⬜ pending |
| 04-T1 mig 176 forward | 07-04 | 2 | PERF-03 | T-07-08/09/10 | Vault secret-name-only; fire-and-forget; 3×3 triggers | sql parse/grep | grep-structure gate (net.http_post + vault + 3 triggers; no http_request) | ❌ → create | ⬜ pending |
| 04-T2 mig 176 REVERSE | 07-04 | 2 | PERF-03 | — | DROP triggers then function | sql parse/grep | grep-structure gate (3 DROP TRIGGER + DROP FUNCTION) | ❌ → create | ⬜ pending |
| 04-T3 invalidate-cache edit | 07-04 | 2 | PERF-03 | T-07-09/11 | DELETE old_record fallback; flush-all unchanged; CORS wired | typecheck + unit | `deno check` + `deno test ... delete-path.test.ts` | ❌ → edit | ⬜ pending |
| 05-T1 operator runbook | 07-05 | 3 | PERF-01/02/03 | — | apply checklist authored; nothing applied | doc/grep | grep-structure gate (vault secret + catalog SQL + recall) | ❌ → create | ⬜ pending |
| 05-T2 operator checkpoint | 07-05 | 3 | PERF-01/02/03 | T-07-08..11 | prod-gated apply + recall/catalog validation | manual-only | blocking-human (operator paste-back) | — | ⬜ pending |

> **Sampling continuity:** no run of 3 consecutive tasks lacks an automated verify — every auto task carries a `deno`/grep/`node` gate; only the closing operator checkpoint (05-T2) is manual-only (prod-gated by design, D-04/SC#4).

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] Representative multi-restaurant candidate fixture (≥3 restaurants, ≥8 dishes each) — JSON fixture for the byte/row + behavior-preserving harness (none exists)
- [ ] Deno test harness for the tiered-loop stub (stubs `supabase.rpc`, asserts break-at-POOL_TARGET + response-shape parity)
- [ ] Deno test harness for the `invalidate-cache` DELETE-path body parsing (`{type:'DELETE', old_record:{...}, record:null}`)

*No framework install needed — Deno is available.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| `hnsw.iterative_scan` recall + latency under heavy filters | PERF-01 (SC#2) | Only measurable on prod data (operator-gated, D-04); migration is authored + dry-run only | Operator applies migration 175 to a prod branch/clone, compares feed recall + p95 latency before/after, decides to keep the GUC or RESET it |
| 9-row trigger-catalog coverage (3 tables × INSERT/UPDATE/DELETE) | PERF-03 (SC#4) | `information_schema.triggers` only reflects truth after the migration is applied; no local psql | Operator runs the catalog assertion SQL (see RESEARCH §SC#4) on the branch after applying migration 176; expects 9 `trg_invalidate_cache%` rows |
| Existing dashboard-configured webhook disabled at apply-time | PERF-03 (SC#4) | Dashboard config is out-of-band (not in any migration) | Operator runbook step: delete/disable the untracked Database Webhook when applying 176 to avoid double-flush |

---

## Validation Sign-Off

- [x] All tasks have `<automated>` verify or Wave 0 dependencies (only the prod-gated operator checkpoint 05-T2 is manual-only by design)
- [x] Sampling continuity: no 3 consecutive tasks without automated verify
- [x] Wave 0 covers all MISSING references (fixture + tiered-loop + pre-cap + DELETE-path Deno harnesses — Plan 07-01)
- [x] No watch-mode flags
- [x] Feedback latency < 15s
- [x] `nyquist_compliant: true` set in frontmatter

**Approval:** planner-approved (Per-Task Verification Map finalized; Wave 0 = Plan 07-01). `wave_0_complete` flips to true after 07-01 executes green.
