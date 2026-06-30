---
slug: 260630-fcd-delete-dead-code-mobile-filter-ui-common
date: 2026-06-30
status: complete
commits: 6f4f364, bee1fc7
---

# Summary — delete verified dead code (mobile filter UI v1 + common + orphan ui css)

All targets grep-verified 0-importer (no barrel `export *` re-exports). No behavior change.

## Commit 1 — `6f4f364` chore(mobile)

Deleted (9 files):
- `FilterComponents.tsx` (455L), `FilterFAB.tsx` (61L, incl. QuickFilterModal)
- `common/`: ScreenLayout, SettingItem, EmptyState, FeatureList, SectionContainer
- `map/MapHeader.tsx`, `utils/spiceUtils.ts`
- Dropped `@react-native-community/slider@5.0.1` from package.json (sole importer was FilterComponents); lockfile updated via `pnpm install --lockfile-only`.

Gate: `cd apps/mobile && npx tsc --noEmit` → exit 0; stale-ref grep → none.

**Follow-up (user):** slider is a native module — on-device rebuild needs `expo prebuild --clean`.

## Commit 2 — `bee1fc7` chore(ui)

- Deleted `packages/ui/styles/globals.css` (1L orphan `@import`). Export map resolves `@eatme/ui/styles/globals.css` → `./src/styles/globals.css` directly; both consumers (admin, web-portal-v2) go through the export.

## Held back

- `web-portal-v2/.../BasicInfoForm.tsx` — 0 importers but in the on-ice (not abandoned) v2 app; leave until revived/cut.
- `apps/mobile/src/utils/currencyConfig.ts` shim — deleting = 12 importer rewrites; churn > value. Skip / do opportunistically.
