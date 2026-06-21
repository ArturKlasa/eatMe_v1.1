---
phase: 7
slug: performance-cache
status: draft
nyquist_compliant: false
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
| {pending — planner fills} | | | PERF-01/02/03 | T-7-* / — | | unit / parse | | ❌ W0 | ⬜ pending |

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

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references (fixture + Deno harnesses)
- [ ] No watch-mode flags
- [ ] Feedback latency < 15s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
