# Progress

## Current Step
Step 1 — Apply all 3 fixes

## Active Wave
- code-assist:security-bug-fixes:step-01:rls-migration
- code-assist:security-bug-fixes:step-01:patch-restaurant-service
- code-assist:security-bug-fixes:step-01:patch-eat-together-service
- code-assist:security-bug-fixes:step-01:verify-typecheck

## Verification Notes

### Fix 3 (F-009) — ilike escape in eatTogetherService.ts
- Added `const escaped = searchQuery.replace(/[%_\\]/g, c => \`\\${c}\`);` at line 502
- Changed `.ilike('profile_name', \`%${searchQuery}%\`)` to `.ilike('profile_name', \`%${escaped}%\`)`
- No other changes to the function
- `pnpm tsc --noEmit`: no new errors (all existing errors are pre-existing in supabase/functions and web-portal module resolution)

## Completed Steps
(none)
