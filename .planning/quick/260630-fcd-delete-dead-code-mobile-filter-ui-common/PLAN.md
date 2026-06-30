---
slug: 260630-fcd-delete-dead-code-mobile-filter-ui-common
date: 2026-06-30
mode: quick
---

# Delete verified dead code — mobile filter UI v1 + common components + orphan ui css

Ponytail-audit findings, all grep-verified as 0-importer. No behavior change.

## Commit 1 — mobile dead code + slider dep

Whole-file deletions (0 importers, no barrel re-exports):

- `apps/mobile/src/components/FilterComponents.tsx` (455L) — dead v1 filter UI (PriceRangeFilter/CuisineTypeFilter/DietToggleFilter/CalorieRangeFilter/QuickFilterPresets/FilterSummary), superseded by DrawerFilters + FiltersScreen. Sole importer of slider.
- `apps/mobile/src/components/FilterFAB.tsx` (61L) — FilterFAB + QuickFilterModal, both only defined/used in this file.
- `apps/mobile/src/components/common/ScreenLayout.tsx` (56L)
- `apps/mobile/src/components/common/SettingItem.tsx` (44L)
- `apps/mobile/src/components/common/EmptyState.tsx` (39L)
- `apps/mobile/src/components/common/FeatureList.tsx` (33L)
- `apps/mobile/src/components/common/SectionContainer.tsx` (32L)
- `apps/mobile/src/components/map/MapHeader.tsx` (29L)
- `apps/mobile/src/utils/spiceUtils.ts` (33L) — DISH_SPICE_LEVELS/dishSpiceIcon, 0 importers.

Dependency:
- Drop `@react-native-community/slider@5.0.1` from `apps/mobile/package.json` (sole importer was FilterComponents.tsx). Update lockfile (`pnpm install --lockfile-only`).
  - Note: native module removal — on-device rebuild (`expo prebuild --clean`) is the user's step.

Gate: `cd apps/mobile && npx tsc --noEmit` + grep for stale references.

## Commit 2 — orphan packages/ui css

- `packages/ui/styles/globals.css` (1L) — orphan `@import` shim. Package `exports` map sends `@eatme/ui/styles/globals.css` → `./src/styles/globals.css` directly, so this physical file is never resolved.

## Held back (not in this batch)

- `apps/web-portal-v2/src/components/restaurant/BasicInfoForm.tsx` — 0 importers but lives in the paused (on-ice, not abandoned) web-portal-v2. Leave until that app revives or is cut.
- `apps/mobile/src/utils/currencyConfig.ts` shim — deleting it means rewriting 12 importers to `@eatme/shared`; churn > value for a stable 20-line re-export. Skip / do opportunistically.
