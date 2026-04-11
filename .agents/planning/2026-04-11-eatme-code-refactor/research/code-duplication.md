# Code Duplication & Shared Logic Analysis

## 1. Constants Duplication (HIGH PRIORITY)

Both apps define identical cuisine and allergen mappings:
- **Web Portal:** `apps/web-portal/lib/constants.ts` (373 lines) — `POPULAR_CUISINES`, `CUISINES`, `DIETARY_TAGS`, `ALLERGENS`, `SPICE_LEVELS`, `MENU_CATEGORIES`, `PRICE_RANGES`
- **Mobile:** `apps/mobile/src/constants/index.ts` (104 lines) + `apps/mobile/src/constants/icons.ts` (56 lines) — `POPULAR_CUISINES`, `ALL_CUISINES`, `ALLERGEN_ICONS`, `DIETARY_TAG_ICONS`

These are manually synced ("Keep in sync" comments found). ~200 lines of duplication.

**Recommendation:** Move to a new `@eatme/constants` package or extend `@eatme/database`.

## 2. Type Definitions Beyond Database Package (MEDIUM)

- **Web Portal:** `apps/web-portal/types/restaurant.ts` (100+ lines) — `Location`, `Option`, `OptionGroup`, `OperatingHours`, `DishCategory`, `Dish`, `Menu`, `Restaurant`
- **Mobile:** `apps/mobile/src/lib/supabase.ts` (120+ lines) — `Option`, `OptionGroup`, `DishWithRelations`, `RestaurantWithMenus`

~150+ lines of overlapping type definitions.

**Recommendation:** Centralize in `@eatme/database`.

## 3. Validation & Parsing Schemas

- **Web Portal:** `apps/web-portal/lib/validation.ts` — Zod schemas for restaurant onboarding (~150 lines)
- **Web Portal:** `apps/web-portal/lib/parseAddress.ts` (145 lines) — Nominatim geocoding parsing
- **Mobile:** No equivalent Zod schemas; runtime validation only

**Recommendation:** Share validation schemas via a shared package.

## 4. Supabase Call Patterns (HIGH VOLUME)

Both apps make similar nested Supabase queries without shared abstraction:
- **Web Portal:** `apps/web-portal/lib/restaurantService.ts` (150+ lines)
- **Mobile:** `apps/mobile/src/hooks/useDish.ts` (66 lines), plus 8,200+ lines across services (`filterService.ts` 503 lines, `geoService.ts` 227 lines, `ratingService.ts` 558 lines, etc.)

**Recommendation:** Abstract common query builders into `@eatme/database`.

## 5. Filtering & Sorting Logic

- **Web Portal:** `apps/web-portal/hooks/useFilters.ts` (23 lines) — generic filter composition
- **Mobile:** `apps/mobile/src/services/filterService.ts` (503 lines) — complex filtering with price estimation, daily/permanent filters, sorting

**Recommendation:** Consolidate into shared filtering utilities.

## 6. React Hooks

- **Web Portal:** `apps/web-portal/lib/hooks/useDebounce.ts` (20 lines)
- **Mobile:** Equivalent hooks scattered, no centralized hook library

## Summary

| Category | Estimated Duplicate LOC |
|----------|------------------------|
| Constants | ~200 |
| Types | ~150 |
| Service patterns | ~400+ |
| Utilities | ~50+ |
| **Total** | **~800+** |
