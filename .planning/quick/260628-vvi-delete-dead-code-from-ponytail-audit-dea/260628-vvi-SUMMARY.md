---
type: quick
quick_id: 260628-vvi
slug: delete-dead-code-from-ponytail-audit-dea
status: complete
created: 2026-06-29
completed: 2026-06-29
commit: 8bf0842
---

# Summary: Delete dead code from ponytail-audit (findings 1, 2, 3, 5)

Removed 113 lines of grep-verified dead code surfaced by a whole-repo
ponytail-audit. No behavior change, no DB migration. Audit findings 4 (the
`currencyConfig` re-export shim — 10-file churn for 20 harmless lines) and 6
(the `next`-injection interfaces in `@eatme/shared/auth/proxy` — justified
because non-Next mobile also imports `@eatme/shared`) were deliberately **not**
actioned.

## Changes

1. **mobile filterStore — dead `PermanentFilters` state**
   (`apps/mobile/src/stores/filterStore/{types,defaults,permanent-actions,selectors}.ts`).
   Dropped fields `defaultPriceRange`, `cuisinePreferences`, `defaultNutrition`,
   `notifications` + their setters `setPermanentPriceRange` /
   `setCuisinePreferences` / `setDefaultNutrition` / `toggleNotification`, plus
   the permanently-false `defaultNutrition.enabled` branch in
   `getPermanentFilterCount`. These were never read by any UI and never persisted
   to the DB — `permanentFiltersToDb` maps only `dietPreference` + `exclude`.
   Old AsyncStorage blobs harmlessly carry the removed keys (the `loadFilters`
   spread tolerates extra keys; same situation the existing `ingredientsToAvoid`
   strip already handles), so no migration is needed.

2. **`packages/shared/src/constants/calendar.ts`** — deleted. `DAYS_OF_WEEK` /
   `DayKey` had 0 importers (admin's `OpeningHoursSection` and v2's
   `HoursSection` each inline their own weekday list + `DayKey`). Removed the
   `export * from './calendar'` barrel line.

3. **`packages/shared/src/constants/wizard.ts`** — deleted. `WIZARD_STEPS` had
   0 importers and was not in the barrel (v2 onboard inlines its own `STEPS`).

5. **`scripts/`** — removed empty top-level dir (untracked; not `infra/scripts/`).

## Verification

- `cd apps/mobile && npx tsc --noEmit` → exit 0
- `cd packages/shared && npx tsc --noEmit` → exit 0
- `pnpm exec turbo run check-types --filter=admin` → 2 successful
- `cd packages/shared && npx vitest run` → 91 passed
- Repo-wide grep: 0 residual references to any removed symbol.
- Pre-commit hook (lint-staged + prettier) passed.

**Net: 113 deletions, 0 insertions. One code commit (8bf0842).**
