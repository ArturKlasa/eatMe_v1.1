---
phase: 5
slug: dead-code-doc-cleanup
status: draft
nyquist_compliant: true
wave_0_complete: true
created: 2026-06-20
---

# Phase 5 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.
> **This phase is delete/edit-only with NO new test surface** (CONTEXT.md scope lock: "any new tests beyond what typecheck already gives" is out of scope). Validation = existing static analysis (`tsc` / `deno check`) + grep + one on-device operator check. No test framework, no Wave 0 install.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | None — static analysis only (TypeScript `tsc` via Turborepo; Deno `deno check` for the edge fn) |
| **Config file** | `turbo.json` (check-types task); `apps/mobile/tsconfig.json`; no Deno config (esm.sh imports) |
| **Quick run command** | `turbo check-types` (or `cd apps/mobile && pnpm check-types`) |
| **Full suite command** | `turbo check-types` + the CLEAN-02 grep + `deno check infra/supabase/functions/enrich-dish/index.ts` |
| **Estimated runtime** | ~30–60 seconds (typecheck dominated) |

---

## Sampling Rate

- **After every task commit:** Run the track's static check (`pnpm check-types` for CLEAN-01; the import grep for CLEAN-02; `deno check` for CLEAN-03)
- **After every plan wave:** Run `turbo check-types`
- **Before `/gsd-verify-work`:** `turbo check-types` green + CLEAN-02 grep empty + `deno check` clean
- **Max feedback latency:** ~60 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 05-01-* | 01 | 1 | CLEAN-01 | — | N/A (UI deletion) | static | `cd apps/mobile && pnpm check-types` | ✅ | ✅ |
| 05-01-* | 01 | 1 | CLEAN-01 | — | No residual symbols | grep | `grep -rn "viewModeStore\|ViewModeToggle\|RestaurantMarkers\|viewModeToggle" apps/mobile/src` → only REFACTORING_SUMMARY.md | ✅ | ✅ |
| 05-02-* | 02 | 1 | CLEAN-02 | — | N/A (doc text) | grep | `grep -rn "from ['\"].*apps/web-portal" apps packages infra \| grep -v web-portal-v2` → empty | ✅ | ✅ |
| 05-03-* | 03 | 1 | CLEAN-03 | — | N/A (comment-only) | static | `deno check infra/supabase/functions/enrich-dish/index.ts` | ✅ | ✅ |
| 05-03-* | 03 | 1 | CLEAN-03 | — | Header matches reality | grep | header lines 8–21 contain no `ingredient`/`parent`; retain `option_group` + `_trg_after_dish_embedded` | ✅ | ✅ |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

*None — existing static-analysis infrastructure (`tsc`, `deno check`) covers all phase requirements. No test framework to install; no test stubs to author (delete/edit-only phase).*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Daily-filter modal renders correctly without the `🏪 Places` tab; dish markers + dish-card navigation still work | CLEAN-01 | UI-visible change; no emulator in the agent loop (operator builds on a physical device) | Operator opens the map, opens the daily-filter modal, confirms no Places/view-mode toggle, taps a dish marker → opens the dish's restaurant, taps a footer dish card → opens restaurant with dish featured |

---

## Validation Sign-Off

- [x] All tasks have `<automated>` verify or are explicitly manual-only (CLEAN-01 on-device)
- [x] Sampling continuity: every track has an automated signal; no 3 consecutive tasks without automated verify
- [x] Wave 0 covers all MISSING references (none — no framework needed)
- [x] No watch-mode flags (`vitest`/`tsc --watch` not used)
- [x] Feedback latency < 60s
- [x] `nyquist_compliant: true` set in frontmatter

**Approval:** approved 2026-06-20 (delete/edit-only; static-analysis + grep + single operator check fully cover SC#1/2/3)
