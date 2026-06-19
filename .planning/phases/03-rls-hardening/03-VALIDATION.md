---
phase: 3
slug: rls-hardening
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-06-19
---

# Phase 3 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.
> **Phase shape:** dry-run-only SQL DDL migration (no app/runtime code, no test harness this cycle —
> the automated RLS regression suite is deferred as QUAL-V2-01). Validation = static SQL self-review
> (grep/inspection-checkable) + `pnpm check-types` no-regression gate + operator branch/shadow-DB handoff.
> Source: `03-RESEARCH.md` § Validation Architecture + § Security Domain.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | **None** — SQL DDL migration; no executable test suite this phase |
| **Config file** | none — no test config needed (see Wave 0: nothing to install) |
| **Quick run command** | `pnpm check-types` (type no-regression gate; expect zero diff — RLS doesn't change generated types) |
| **Full suite command** | `pnpm check-types` + the static SQL self-review checklist below (grep/inspection-checkable) |
| **Estimated runtime** | ~30–60 seconds (`pnpm check-types`); static review is inspection |
| **Real validation** | Operator applies `170` on a Supabase branch / shadow DB (prod clone) and runs the anon/own-row probes |

---

## Sampling Rate

- **After every task commit:** Run `pnpm check-types` + the grep-checkable acceptance criteria for that task (e.g. `grep "(select auth.uid())"`, `grep -c` bare `auth.uid()` == 0, `idx_<table>_user_id` present).
- **After the migration plan completes:** Run the full static SQL self-review checklist (below) end-to-end.
- **Before `/gsd-verify-work`:** `pnpm check-types` green AND every static checklist item ticked.
- **Max feedback latency:** ~60 seconds (type check + grep assertions are near-instant).

---

## Per-Task Verification Map

> Verification here is **grep/inspection over the authored SQL + `pnpm check-types`**, not a runtime suite.
> Each criterion is checkable with `grep`, file read, or CLI output (Anti-Shallow rule). Concrete commands run
> against `infra/supabase/migrations/170_codify_behavioral_rls.sql` (and its REVERSE sibling).

| SC | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | Status |
|----|-------------|------------|-----------------|-----------|-------------------|--------|
| SC#1 | SEC-02 | T-silent-deny-all | One file; enable RLS + policy + index atomic per table inside one `BEGIN/COMMIT` | static/grep | `test $(ls infra/supabase/migrations/170_codify_behavioral_rls.sql \| wc -l) -eq 1` ; `grep -c "BEGIN;" 170_*.sql` == 1 ; `grep -c "ENABLE ROW LEVEL SECURITY" 170_codify*.sql` == 11 | ⬜ pending |
| SC#2 | SEC-02 | T-horiz-priv-esc / T-row-reassign | Every own-row predicate is InitPlan form; owner col indexed | static/grep | `grep -c "(select auth.uid()) = user_id" 170_codify*.sql` ≥ 10 ; bare-form count `grep -oE "[^(]auth\.uid\(\) = " 170_codify*.sql \| wc -l` == 0 ; `grep -c "idx_.*_user_id ON" 170_codify*.sql` == 7 | ⬜ pending |
| SC#3 | SEC-02 | T-dish-analytics-misclass | `dish_analytics` = public/service-role, no owner policy; 10 owner blocks reference `user_id` | static/grep | dish_analytics block has no `user_id` ; `grep -A20 "dish_analytics" 170_codify*.sql \| grep -c "user_id"` == 0 ; `grep "ALL TO service_role"` present for dish_analytics | ⬜ pending |
| SC#4 | SEC-02 | — | Types unchanged; operator dry-run validates on prod clone | type gate + operator | `pnpm check-types` exits 0 (no type regen) ; operator branch-apply (see Manual-Only) | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Static SQL Self-Review Checklist (agent-runnable by inspection/grep)

- [ ] **Valid DDL** — every statement parses; correct `public.<table>` qualification throughout.
- [ ] **Table/column names** cross-checked against the F-11 cross-check table + `database_schema.sql` (all 11 tables; `user_id` on the 10 owner tables; `dish_analytics` has none).
- [ ] **Idempotency guards** — `DROP POLICY IF EXISTS` before every `CREATE POLICY`; `CREATE INDEX IF NOT EXISTS`; idempotent `ALTER TABLE … ENABLE ROW LEVEL SECURITY`.
- [ ] **Transaction wrap** — forward + REVERSE both wrapped in `BEGIN; … COMMIT;`.
- [ ] **InitPlan form** — every own-row predicate is `(select auth.uid()) = user_id`; zero bare `auth.uid()`.
- [ ] **Role targeting** — own-row policies `TO authenticated`; public reads stay `USING (true)` open to `public` (NOT moved to authenticated).
- [ ] **Command coverage** per table matches F-11 verbatim (no extra/missing verbs).
- [ ] **UPDATE policies** have both `USING` and `WITH CHECK` (079 gotcha: prevents `user_id` reassignment).
- [ ] **No `is_admin()` clause** anywhere (D-03).
- [ ] **`dish_analytics`** — public-read + service-role only; no owner policy; no `user_id` index.
- [ ] **REVERSE pair** drops exactly what forward creates (7 new indexes + all new policies + DISABLE RLS) and does NOT drop the 3 pre-existing 076 composites.
- [ ] **Header** documents the table-precondition (D-12) and names the reverse sibling.

---

## Wave 0 Requirements

*None — no test infrastructure is created this phase. The automated RLS regression suite is QUAL-V2-01 (deliberately deferred). Validation is static review + `pnpm check-types` + operator handoff; no framework install, no fixtures, no test files.*

---

## Manual-Only Verifications

> Operator runs on a **prod-clone** branch / shadow DB (tables MUST exist — D-12 precondition; NOT a from-scratch `migrations/` build). Prod is never touched (already protected).

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Migration applies cleanly + idempotently; reverse undoes it | SEC-02 / SC#4 | Requires a live Postgres/Supabase DB the agent cannot touch (stage-don't-apply) | Apply `170_codify_behavioral_rls.sql` → no error; **re-run** → still succeeds (idempotency). Apply `170_REVERSE_ONLY_…` → all 170-created policies/indexes gone, RLS disabled on the 11; the 3 `076` composites still present. |
| Anon cannot read another user's private rows | SEC-02 / SC#3 | Needs an anon JWT session against live RLS | As anon: `SELECT * FROM favorites` (and other own-row tables) → **0 rows** (NULL uid fails own-row predicate). |
| Authenticated reads/writes only own rows | SEC-02 / SC#2 | Needs user-A JWT session against live RLS | As user A: `SELECT … FROM user_visits` → only A's rows; `INSERT`/`UPDATE` with `user_id = <userB>` → **rejected** (WITH CHECK). |
| Public reads still work | SEC-02 / SC#3 | Needs live RLS to confirm public-read preserved | As anon: `SELECT … FROM dish_opinions / dish_photos / dish_analytics` → returns rows. |

**Operator "pass" =** clean idempotent apply + reverse on the prod-clone, anon-deny on private tables, own-only on authenticated reads, public-read intact, and `pnpm check-types` green with no type diff.

---

## Validation Sign-Off

- [ ] Every task has either a grep/`pnpm check-types` `<automated>` verify OR an entry in Manual-Only with operator instructions
- [ ] Sampling continuity: no 3 consecutive tasks without an automated (grep/type) verify
- [ ] Wave 0: N/A (no infrastructure to install)
- [ ] No watch-mode flags
- [ ] Feedback latency < 60s
- [ ] `nyquist_compliant: true` set in frontmatter once plans pass the checker

**Approval:** pending
