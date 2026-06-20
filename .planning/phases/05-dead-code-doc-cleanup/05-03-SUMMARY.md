---
phase: 05-dead-code-doc-cleanup
plan: 03
subsystem: edge
tags: [enrich-dish, comment, edge-function, deno, clean-03]

# Dependency graph
requires: []
provides:
  - "enrich-dish header comment matches actual load logic (dish + option groups + restaurant cuisine)"
affects: []

# Tech tracking
tech-stack:
  added: []
  patterns: []

key-files:
  created: []
  modified:
    - infra/supabase/functions/enrich-dish/index.ts
  deleted: []

key-decisions:
  - "Matched comment to verified actual load logic (lines 135-164: dishes.select(...), option_groups.select('name, options(name)'), restaurants.select('cuisine_types')) per D-08 — not just 'less wrong'."
  - "Kept `option_group` (trigger trg_enrich_on_option_group_change is a migration-151 keep) and the _trg_after_dish_embedded centroid line (D-09). Dropped ingredient / parent dish / parent ingredients / variant."

requirements-completed: [CLEAN-03]

# Deviations
deviations:
  - "deno is not on PATH — invoked via full path /home/art/.deno/bin/deno (matches the edge_fn_deno_tests convention). `deno check` exits 0."

# Metrics
duration: ~3min
completed: 2026-06-20
status: complete
---

# Phase 5 Plan 03: enrich-dish Header Comment Fix (CLEAN-03)

**Corrected the stale `enrich-dish/index.ts` header to describe what the function actually loads today (dish + option groups + restaurant cuisine), dropping the retired ingredient/parent-dish references while preserving the migration-151 trigger language and the centroid note. Comment-only — no runtime change.**

## Performance
- **Duration:** ~3 min
- **Tasks:** 2
- **Files:** 1 (comment-only)

## Accomplishments
- **Line 9:** `_trg_notify_enrich_dish trigger on dish/ingredient/option_group writes` → `… on dish/option_group writes` (dropped the retired `ingredient` trigger; kept `option_group` per D-09).
- **Lines 14–15:** `Load dish + ingredients + option groups + restaurant cuisine + parent dish (when this is a variant) + parent ingredients` → `Load dish + option groups + restaurant cuisine` (single accurate line, matching the real load logic at lines 135–164 / F-06).
- **Preserved:** the `_trg_after_dish_embedded` centroid note (lines 20–21) and pipeline steps 2–4.

## Verification
- `~/.deno/bin/deno check infra/supabase/functions/enrich-dish/index.ts` → **EXIT 0**.
- Header lines 8–21: `ingredient|parent|variant` count = **0**; `option_group` present (1); `_trg_after_dish_embedded` present (1).
- No runtime code below the header changed (createClient / getEmbedding / EMBEDDING_MODEL intact).

## Self-Check: PASSED
Both tasks complete; header accurate to current load logic; deno check green; no runtime change. One commit for the track (D-11).
