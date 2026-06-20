---
phase: 4
slug: edge-dependency-pinning-script-guard
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-06-19
---

# Phase 4 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.
> Source: `04-RESEARCH.md` § Validation Architecture. Stage-don't-apply: Claude validates
> locally; the operator deploys functions and smoke-tests one real call per function (SC#4).

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework (edge)** | Deno built-in test runner — Deno **2.8.1** at `~/.deno/bin/deno` (NOT on PATH; `export PATH="$HOME/.deno/bin:$PATH"` first) |
| **Framework (scripts)** | none today — `infra/scripts` are ts-node scripts with no test harness |
| **Config file** | none — Deno tests are standalone `*.test.ts` / `test.ts` run by path |
| **Quick run command** | `deno test --node-modules-dir=none -A <path>` (one file) |
| **Full suite command** | both edge test files: `_shared/cors.test.ts` + `menu-scan-worker/test.ts` (only 2 exist) |
| **Compile-check (no test)** | `deno check --node-modules-dir=none infra/supabase/functions/<fn>/index.ts` |
| **Estimated runtime** | ~10–30 s per file (first run fetches deps over network, then cached) |

---

## Sampling Rate

- **After every task commit:** for an edge file touched → the single `deno test … <path>` (or `deno check` if the fn has no test) for that file; for a script touched → a `--dry-run` (no `--apply`) smoke of that script asserting the DRY-RUN banner + ref print.
- **After every track/wave merge:**
  - Track A: both Deno test files green **and** all grep assertions (below) return 0.
  - Track B: a no-flag run of each guarded script asserts default-dry-run (zero writes) + project-ref print.
- **Before `/gsd-verify-work`:** all grep assertions clean, both Deno tests pass, guard dry-run behavior verified locally.
- **Max feedback latency:** ~30 s (single Deno test / single script dry-run).

### Grep assertions (Track A — all must return zero matches)

| Assertion | Command (expect 0 matches) |
|-----------|----------------------------|
| No std `serve` import remains | `grep -rn "std@0.168.0/http/server" infra/supabase/functions` |
| No `testing/asserts` import remains | `grep -rn "testing/asserts" infra/supabase/functions` |
| No unpinned upstash | `grep -rn "upstash/redis@latest" infra/supabase/functions` |
| supabase-js all exact esm.sh | `grep -rn "supabase-js" infra/supabase/functions/*/index.ts \| grep -v "esm.sh/@supabase/supabase-js@2.39.3"` |

---

## Per-Task Verification Map

> Concrete task IDs assigned by the planner; rows below map each requirement/track behavior to its
> automated check so the planner can attach the right `<verify>` / `<acceptance_criteria>` to each task.

| Track | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|-------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| A (serve swap) | 1 | DEBT-05 | — | 7 fns on native `Deno.serve`; corsHeaders seam preserved | grep + compile | `grep -rn "std@0.168.0/http/server" …` → 0; `deno check` per fn | ✅ | ⬜ pending |
| A (cors seam) | 1 | DEBT-05 | — | feed/enrich-dish/invalidate-cache keep per-req `corsHeaders` + cors.ts import | unit (Deno) | `deno test … _shared/cors.test.ts` | ✅ | ⬜ pending |
| A (supabase-js) | 1 | DEBT-05 | — | every specifier = `esm.sh/@supabase/supabase-js@2.39.3` | grep | `grep -rn "supabase-js" …/*/index.ts` (all @2.39.3) | ✅ | ⬜ pending |
| A (upstash) | 1 | DEBT-05 | — | every `@upstash/redis` = `@1.38.0` | grep | `grep -rn "upstash/redis@latest" …` → 0 | ✅ | ⬜ pending |
| A (asserts→jsr) | 1 | DEBT-05 | — | both test files import `jsr:@std/assert@1.0.19`; tests pass | unit (Deno) | `deno test … menu-scan-worker/test.ts` + `… cors.test.ts` | ✅ | ⬜ pending |
| A (shim) | 1 | DEBT-05 | — | `deno-globals.d.ts` shim keys match new specifiers (no phantom editor errors) | grep | shim contains `@2.39.3`, `@1.38.0`; no `std@0.168.0/http/server`, no `@latest` | ✅ | ⬜ pending |
| B (guard module) | 1 | SEC-03 | T-04-01 | `prod-guard.ts` default-dry-run; `--apply` required to write; prints project ref | behavior / unit | guard dry-run smoke; optional `prod-guard.test.ts` | ⚠️ W0 | ⬜ pending |
| B (wire scripts) | 2 | SEC-03 | T-04-01 | each of 8 write scripts default-dry-run, refuse write absent `--apply`, print ref, keep `--limit` | behavior (local, no prod) | per-script no-flag run → DRY-RUN banner, zero writes | ✅ | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] **(Optional — Claude's-discretion D)** `infra/scripts/lib/prod-guard.test.ts` — a tiny test of `parseGuard(argv)`: (1) no flag → `dryRun:true`; (2) `--apply` → `dryRun:false`; (3) `--dry-run` → `dryRun:true` (no throw); (4) project ref derived from a sample `SUPABASE_URL`. **ROI: WORTH IT** — the guard's failure mode is "silently writes to prod" (the exact SEC-03 risk); a ~20-line pure-function test cheaply de-risks the only net-new logic. **Caveat:** `infra/scripts` has no Node test runner today, so this needs one added (`node --test` via ts-node/tsx, or a plain assert script run by ts-node). Judge the harness-add cost at plan time; if non-trivial, a documented manual `--dry-run` check per script is acceptable given the solo / minimal-test posture.
- [ ] No framework install needed for the **edge** side — Deno's test runner is built in; only ensure `~/.deno/bin` is on PATH (`export PATH="$HOME/.deno/bin:$PATH"`).

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| One real call per migrated function on the live edge runtime | DEBT-05 (SC#4) | stage-don't-apply — operator deploys prod functions; Claude cannot deploy | After deploy from `infra/supabase/`, operator hits each of the 7 migrated functions once and confirms a non-error response (cold-start succeeds on the new pinned deps) |
| Actual `--apply` prod-write run of each guarded script | SEC-03 | exercises a real prod mutation — operational, not a phase gate | When a backfill is next needed, operator runs the script with `--apply`, confirms the project-ref banner shows the correct target before any write |

---

## Validation Sign-Off

- [ ] All tasks have `<verify>` automated command or a Wave 0 dependency
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify (grep assertions cover the mechanical swaps)
- [ ] Wave 0 covers any MISSING references (only the optional guard test)
- [ ] No watch-mode flags (use `deno test … <path>`, never `deno test` watch)
- [ ] Feedback latency < 30 s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
