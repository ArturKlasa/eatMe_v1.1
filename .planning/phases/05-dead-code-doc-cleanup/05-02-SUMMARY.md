---
phase: 05-dead-code-doc-cleanup
plan: 02
subsystem: docs
tags: [docs, web-portal, residual-cleanup, current-reality, clean-02]

# Dependency graph
requires: []
provides:
  - "Agent-facing docs no longer describe the deleted apps/web-portal (v1) as a live app"
  - "CLAUDE.md / architecture.md / copilot-instructions.md retargeted to current reality (apps/admin active; web-portal-v2 on ice)"
affects: []

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Doc current-reality: apps/admin = active web surface (port 3001); apps/web-portal-v2 = owner portal rebuild, on ice; legacy apps/web-portal removed 2026-06-18"

key-files:
  created: []
  modified:
    - CLAUDE.md
    - agent_docs/architecture.md
    - .github/copilot-instructions.md
    - INTEGRATION_COMPLETE_SUMMARY.md
    - agent_docs/conventions.md
    - agent_docs/commands.md
    - PROMPT.md
  deleted: []

key-decisions:
  - "Build-clean evidence (SC#2) = grep for live apps/web-portal imports → ZERO (no full turbo build; D-10). Deletion was already committed c1a7e3f."
  - "CLAUDE.md:62 (DishKind-shim line) LEFT deferred to Phase 6 / DEBT-03 (D-07)."
  - "web-portal-v2 references PRESERVED everywhere (on ice, not abandoned); the two code-comment provenance refs (menu-scan-worker, backfill-cuisine-from-google) LEFT untouched (D-05)."
  - "Test/command refs retargeted to the REAL current surface (turbo test runs Vitest across admin + web-portal-v2 + shared packages; admin = apps/admin port 3001) — verified against package.json scripts, not invented."

requirements-completed: [CLEAN-02]

# Deviations
deviations:
  - "SCOPE: `.github/copilot-instructions.md` was REWRITTEN, not surgically patched. It was a pervasively stale April-2026 snapshot that described apps/web-portal as live throughout AND documented the abandoned ingredient/allergen system (~13 dead apps/web-portal paths). Surgical web-portal-only edits would have left a doc that still badly misleads. Plan 05-02 Task 2 explicitly authorized dropping abandoned-feature refs; the rewrite reflects current reality (mobile + admin + web-portal-v2; primary_protein not allergens) and is anchored on the updated CLAUDE.md. RECOMMEND a quick operator read of the new file."
  - "INTEGRATION_COMPLETE_SUMMARY.md is a historical record of the (now abandoned) ingredient/allergen integration. Per D-06, scrubbed the apps/web-portal/ path strings and added a 'this was abandoned + app removed' historical note rather than rewriting the whole doc."
  - "PROMPT.md: edited ONLY the 3 v1-present lines (13, 58, 179); all web-portal-v2 / admin v2-build content preserved (9 web-portal-v2 refs intact). It is an on-ice v2-build contract — left otherwise as-is."

# Metrics
duration: ~20min
completed: 2026-06-20
status: complete
---

# Phase 5 Plan 02: Residual web-portal Doc Cleanup (CLEAN-02)

**Purged residual `apps/web-portal` (v1) references from all 7 agent-facing docs, retargeting live-architecture docs to current reality (admin active; web-portal-v2 on ice) and scrubbing historical records. web-portal-v2 and code-comment provenance refs preserved; CLAUDE.md:62 deferred to Phase 6.**

## Performance
- **Duration:** ~20 min
- **Tasks:** 4
- **Files:** 7 docs

## Accomplishments
- **Build-clean (SC#2):** `grep` confirms ZERO live `apps/web-portal` imports across apps/packages/infra — deletion (`c1a7e3f`) is clean against the workspace; no full `turbo build` needed (D-10).
- **Rewrote to current reality:** `CLAUDE.md` (tech-stack + test commands → admin/web-portal-v2; line 62 left for Phase 6), `agent_docs/architecture.md` (structure tree + dep graph + data-flow sections → admin/v2), `.github/copilot-instructions.md` (full rewrite — see deviation).
- **Scrubbed historical/minor docs:** `agent_docs/conventions.md` (kebab example), `agent_docs/commands.md` (test row + section header → admin), `INTEGRATION_COMPLETE_SUMMARY.md` (file-list block + testing block, with an "abandoned + removed" note), `PROMPT.md` (3 v1-present lines only).

## Verification
- All 7 docs: `grep -c "apps/web-portal/"` → **0** (v1 trailing-slash paths gone; the pattern excludes `apps/web-portal-v2/`).
- `CLAUDE.md`: only the deferred DishKind-shim line (`DISH_KIND_META`) still mentions web-portal (non-v2).
- `PROMPT.md`: `web-portal-v2` → 9 refs preserved (≥8).
- D-05 provenance refs intact: `menu-scan-worker/index.ts` (1), `backfill-cuisine-from-google.ts` (2) — untouched.

## Self-Check: PASSED
All 4 tasks complete; zero v1 web-portal paths across the 7 docs; v2 + provenance preserved; CLAUDE.md:62 deferred. One commit for the track (D-11).
