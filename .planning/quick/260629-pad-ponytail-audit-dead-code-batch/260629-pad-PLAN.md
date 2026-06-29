---
type: quick
quick_id: 260629-pad
slug: ponytail-audit-dead-code-batch
status: complete
created: 2026-06-29
---

# Plan: Ponytail-audit dead-code batch (F1, F2, F3, F5, F6 + F4 comment)

Grep-verified dead-code deletions surfaced by a whole-repo ponytail-audit, plus
one comment-only fix. No behavior change, no DB migration.

## Findings

**F1 — legacy v1 form-validation schemas** (`packages/shared/src/validation/`).
`dishSchema`+`DishFormData`, `menuSchema`+`MenuFormData`,
`restaurantDataSchema`+`RestaurantDataFormData`: 0 importers anywhere.
`dishSchema` still encodes the dropped `dish_kind`/`is_parent`/`variants` model
(migration 163). Delete the 6 symbols from `restaurant.ts` + their barrel
exports in `validation/index.ts`.
- CORRECTION to audit text: there is NO "self-referential test block" to cut —
  `v2-schemas.test.ts` never references these three. `basicInfoSchema`/
  `operationsSchema` STAY because `restaurantPublishableSchema = basicInfoSchema
  .merge(operationsSchema)` (tested), not because the test imports them. Test
  untouched.

**F2 — 7 unused mobile i18n exports** (`apps/mobile/src/utils/i18nUtils.ts`).
`formatDate`, `getRegionalCuisineOrder`, `pluralize`, `formatDistance`,
`formatNumber`, `getCurrencySymbol`, `getLocale`: 0 importers. Keep
`formatCurrency`, `formatOpeningHours`, `isRestaurantOpenNow`, internal
`formatTime`.

**F3 — `packages/shared/src/constants/pricing.ts`**. `PRICE_RANGES`,
`SPICE_LEVELS`/`SpiceLevel`, `DISPLAY_PRICE_PREFIXES`/`DisplayPricePrefixValue`:
0 importers (mobile's `SPICE_LEVELS` is a local `const`). Delete file +
`export * from './pricing'` barrel line in `constants/index.ts`.

**F5 — `CUISINES` alias** (`packages/shared/src/constants/cuisine.ts:88-90`).
0 importers; web-portal (the alias's only consumer) was deleted. Delete the
comment + alias.

**F6 — dead api/baseUrl env config** (`apps/mobile/src/config/environment.ts`).
`EnvironmentConfig.api` + `apiUrl`/`EXPO_PUBLIC_API_URL` parsing + the `api`
return block: never read. Surgical cut only — `ENV`/`debugLog` stay (19 callers).

**F4 — Result<T> overpromising comment** (`apps/mobile/src/lib/result.ts`).
NOT dead code (2/12 services use it, type-safe, works). Only the comment's
"canonical for all new mobile service functions" is false. Soften the comment;
keep the type. Do NOT migrate the other 10 services.

## Verification

- `cd apps/mobile && npx tsc --noEmit` → 0 (the real mobile gate)
- `cd packages/shared && npx tsc --noEmit` → 0
- `cd packages/shared && npx vitest run` → pass (v2-schemas.test.ts unchanged)
- `pnpm exec turbo run check-types --filter=admin` → pass (shared consumer)
- Repo-wide grep confirms no residual references to removed symbols.

One batched commit.
