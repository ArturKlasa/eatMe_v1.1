---
type: quick
quick_id: 260629-pad
slug: ponytail-audit-dead-code-batch
status: complete
created: 2026-06-29
completed: 2026-06-29
---

# Summary: Ponytail-audit dead-code batch

Removed 5 blocks of grep-verified dead code (F1, F2, F3, F5, F6) and softened
one overpromising comment (F4). No behavior change.

## Changes

- **F1** `packages/shared/src/validation/restaurant.ts` + `validation/index.ts` —
  deleted `dishSchema`/`menuSchema`/`restaurantDataSchema` + `DishFormData`/
  `MenuFormData`/`RestaurantDataFormData` and their barrel exports. `dishSchema`
  carried the dropped `dish_kind`/`is_parent`/`variants` model (migration 163).
  Kept `basicInfoSchema`/`operationsSchema` (consumed by tested
  `restaurantPublishableSchema.merge`). Test file NOT touched — audit's
  "self-referential test block" claim was false (no such block existed).
- **F2** `apps/mobile/src/utils/i18nUtils.ts` — deleted 7 unused exports
  (`formatDate`, `getRegionalCuisineOrder`, `pluralize`, `formatDistance`,
  `formatNumber`, `getCurrencySymbol`, `getLocale`) + the now-orphaned
  `getCurrencyInfo` import. Live exports unchanged.
- **F3** deleted `packages/shared/src/constants/pricing.ts` + its barrel line
  in `constants/index.ts`. (Note: `logic/pricing.ts` is a different, live file.)
- **F5** `packages/shared/src/constants/cuisine.ts` — deleted the `CUISINES`
  alias (web-portal, its only consumer, was deleted).
- **F6** `apps/mobile/src/config/environment.ts` — removed dead
  `api.baseUrl` / `EXPO_PUBLIC_API_URL` config. `ENV`/`debugLog` untouched.
- **F4** `apps/mobile/src/lib/result.ts` — softened comment that falsely
  claimed `Result<T>` was "canonical for all new mobile service functions"
  (only 2/12 services use it). Type kept; no migration.

## Verification (all green)

- `packages/shared` tsc → 0; vitest → 91 passed (v2-schemas.test.ts unchanged)
- `apps/mobile` tsc → 0
- `turbo check-types --filter=admin` → 2 successful
- Residual-symbol grep across source → clean (only stale `dist/` build output)
