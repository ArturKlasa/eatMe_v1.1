---
phase: 06-schema-teardown-spine
plan: 01
subsystem: infra/scripts
tags: [verification, rest-probe, schema-teardown, debt-01, debt-02]
status: complete
requires:
  - "@supabase/supabase-js (already pinned, Phase 4)"
  - "infra/scripts/verify-phase7.ts (structural analog)"
provides:
  - "infra/scripts/verify-phase6-teardown.ts (read-only post-apply GONE check)"
affects:
  - "06-03 / 06-06 (downstream plans reference this script as the post-apply gate)"
tech-stack:
  added: []
  patterns:
    - "REST-only GONE probe: service-role select(col/id).limit(1) → PostgREST error means dropped"
key-files:
  created:
    - infra/scripts/verify-phase6-teardown.ts
  modified: []
decisions:
  - "No prod-guard wired — the script is read-only and writes nothing; the guard is for write scripts only (PATTERNS.md explicit warning)"
  - "Used the full 10-table reconciled drop list from RESEARCH § Authoritative reconciled drop list (PATTERNS.md sample showed 9; RESEARCH/plan authoritative list is 10, incl. canonical_ingredient_dietary_tags)"
metrics:
  duration: ~5 min
  completed: 2026-06-20
---

# Phase 6 Plan 01: Verify-Phase6-Teardown Script Summary

Authored `infra/scripts/verify-phase6-teardown.ts`, a read-only `@supabase/supabase-js` REST probe that mirrors `verify-phase7.ts` and reports GONE/STILL-EXISTS for every object the ingredient teardown drops — the DEBT-02 automated post-apply gate flagged as MISSING in 06-VALIDATION.md.

## What Was Built

A single read-only ts-node script that, given the prod service-role key in `.env`:

1. Probes the 2 dead `dishes` columns (`allergens_override`, `dietary_tags_override`) — `select(col).limit(1)` errors when the column is dropped.
2. Probes the FK-sever column `options.canonical_ingredient_id`.
3. Loops the full 10-table reconciled ingredient drop list (`dish_ingredients`, `canonical_ingredients`, `canonical_ingredient_allergens`, `canonical_ingredient_dietary_tags`, `ingredient_aliases`, `ingredient_aliases_v2`, `ingredient_concepts`, `ingredient_variants`, `concept_translations`, `variant_translations`).
4. Closes with the `(read-only — nothing written)` banner; calls `main()` bare (no top-level await), exactly as verify-phase7.ts.

Run via `cd infra/scripts && pnpm exec ts-node verify-phase6-teardown.ts`.

## Tasks Completed

| Task | Name | Commit | Files |
| ---- | ---- | ------ | ----- |
| 1 | Author verify-phase6-teardown.ts | 65a95f1 | infra/scripts/verify-phase6-teardown.ts |

## Verification

- All 7 acceptance-criteria greps pass: file exists; `GONE ✓` count = 3 (≥2 required); `createClient(process.env.SUPABASE_URL` present; `canonical_ingredient_id` present; `variant_translations`/`concept_translations` present; `read-only — nothing written` banner present; prod-guard token count = 0.
- TS compile: clean under the real `infra/scripts/tsconfig.json` (target ES2022, lib ES2022, types: node) — the only context that matters, since the script runs via ts-node exactly like verify-phase7.ts. The bare `npx tsc` invocation in the plan's `<automated>` check emits target/lib/@types-node resolution noise (7 errors) for the *already-working* verify-phase7.ts too, confirming those are env-default artifacts, not defects in this script.

## Deviations from Plan

None affecting behavior. One clarification for the record:

**Drop-list source of truth.** The PATTERNS.md inline snippet (lines 155-159) lists 9 tables and omits `canonical_ingredient_dietary_tags`. The plan `<action>` and RESEARCH § "Authoritative reconciled drop list" specify the full 10-table list. Used the authoritative 10-table list as the plan's action text directs — no deviation from the plan, just resolving the PATTERNS sample-vs-authoritative discrepancy in favor of the plan.

## Self-Check: PASSED

- FOUND: infra/scripts/verify-phase6-teardown.ts
- FOUND: commit 65a95f1
