# Comment Coverage & Code Clarity Assessment

## Overview

- **Total source files:** 337
- **Files with meaningful comments:** 200 (59%)
- **Files with no/minimal comments:** 137 (41%)

## Coverage by App

| App | Commented Files | Ratio |
|-----|----------------|-------|
| Web Portal | 79/196 | 40% |
| Mobile | 111/130 | 85% |
| Packages | 10/11 | 91% |

## Well-Commented Code (Templates to Follow)

1. **`packages/database/src/client.ts`** — JSDoc with WHY explanations and platform-specific usage examples
2. **`apps/web-portal/lib/menu-scan.ts`** (769 lines) — Section dividers, inline type explanations
3. **`apps/mobile/src/services/ratingService.ts`** — Full JSDoc blocks on all exports
4. **`packages/tokens/src/colors.ts`** — Section markers with value explanations

## Files Needing Comments

| File | Lines | Issue |
|------|-------|-------|
| `useMenuScanState.ts` | 1,378 | State initialization undocumented |
| `MenuScanReview.tsx` | 1,265 | Render logic unclear |
| `common.ts` (mobile) | 1,202 | Style constants with no usage guidance |
| `filterStore.ts` | 1,107 | Action signatures lack JSDoc |
| `RestaurantDetailScreen.tsx` | 1,003 | 30+ useState vars, minimal docs |

## Magic Numbers & Unclear Logic

- `filterStore.ts` — Price defaults (10, 50, 200, 800) unexplained
- `infra/supabase/functions/feed/index.ts` — Scoring weights lack tuning rationale
- `restaurantService.ts` — Error code `PGRST116` unexplained

## JSDoc Usage

- Only 49 instances of `@param`, `@returns`, `@throws`, `@deprecated` across entire codebase
- Mobile services lead; web pages lack them
- No consistent enforcement

## Recommendations

1. Add JSDoc to largest files first (useMenuScanState, MenuScanReview, filterStore)
2. Document all magic numbers with rationale
3. Standardize hook documentation with param/return JSDoc
4. Consider eslint-plugin-jsdoc for enforcement
