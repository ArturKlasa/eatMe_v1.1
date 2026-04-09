# Plan

1. Step 1 — Apply all 3 fixes
   - Demo: migration file exists, both TS files patched, `pnpm tsc --noEmit` passes
   - Wave tasks:
     - Create 078_fix_stale_rls_policies.sql with 12 drops + 3 creates
     - Patch restaurantService.ts: add error checks after both .delete() calls
     - Patch eatTogetherService.ts: escape searchQuery before ilike
     - Verify: run pnpm tsc --noEmit and confirm no errors

2. Step 2 — Mark PROMPT.md checklist complete
   - Demo: all 3 items checked off in PROMPT.md progress log
