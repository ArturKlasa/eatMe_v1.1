---
type: quick
quick_id: 260628-vvi
slug: delete-dead-code-from-ponytail-audit-dea
status: complete
created: 2026-06-29
---

# Plan: Delete dead code from ponytail-audit (findings 1, 2, 3, 5)

Pure deletions of grep-verified dead code surfaced by a whole-repo
ponytail-audit. No behavior change, no DB migration (old AsyncStorage blobs
harmlessly carry the removed keys — same as the existing `ingredientsToAvoid`
strip precedent).

## Findings (all verified 0 external callers before deletion)

1. **Dead `PermanentFilters` fields + setters** (`apps/mobile/src/stores/filterStore/`).
   Fields `defaultPriceRange`, `cuisinePreferences`, `defaultNutrition`,
   `notifications` are never read by any UI and never persisted to the DB
   (`permanentFiltersToDb` maps only `dietPreference` + `exclude`). Their setters
   `setPermanentPriceRange` / `setCuisinePreferences` / `setDefaultNutrition` /
   `toggleNotification` have 0 callers outside the store. `defaultNutrition.enabled`
   is permanently false (no setter wires it), so its branch in
   `getPermanentFilterCount` is dead.
   - `types.ts` — drop 4 fields from `PermanentFilters` + 4 action signatures.
   - `defaults.ts` — drop 4 fields from `defaultPermanentFilters`.
   - `permanent-actions.ts` — drop the 4 setter implementations.
   - `selectors.ts` — drop the `defaultNutrition.enabled` branch.

2. **`packages/shared/src/constants/calendar.ts`** — `DAYS_OF_WEEK` / `DayKey`,
   0 importers (admin + v2 inline their own weekday list). Delete file + the
   `export * from './calendar'` barrel line.

3. **`packages/shared/src/constants/wizard.ts`** — `WIZARD_STEPS`, 0 importers,
   not even in the barrel (v2 onboard inlines its own `STEPS`). Delete file.

5. **`scripts/`** — empty top-level dir (untracked). `rmdir`.
   (NOT `infra/scripts/`, which holds real backfill tooling.)

## Verification

- `cd apps/mobile && npx tsc --noEmit` → 0 (the real mobile gate)
- `cd packages/shared && npx tsc --noEmit` → 0
- `pnpm exec turbo run check-types --filter=admin` → pass (shared consumer)
- `cd packages/shared && npx vitest run` → 91 passed
- Repo-wide grep confirms no residual references to any removed symbol.

One batched commit (all dead-code removal).
