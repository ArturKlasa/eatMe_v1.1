# Code Quality & LOC Reduction Opportunities

## 1. Oversized Files (Critical)

| File | Lines | Action |
|------|-------|--------|
| `useMenuScanState.ts` | 1,378 | Split into `useMenuScanUpload`, `useMenuScanReview`, `useMenuScanRestaurant`, `useMenuScanConfirm` |
| `MenuScanReview.tsx` | 1,265 | Extract `DishGroupCard`, ingredient panels, location pickers |
| `common.ts` (mobile styles) | 1,202 | Reduce with design token utilities (~50% reduction possible) |
| `filterStore.ts` | 1,107 | OK as-is (complex state justified), but add JSDoc |
| `RestaurantDetailScreen.tsx` | 1,003 | Split by feature area |
| `RestaurantForm.tsx` | 662 | Split by sections (location, cuisines, hours) |

## 2. Dead Code & Console Statements

- **console.log statements** (5+ instances):
  - `app/api/ingredients/route.ts`
  - `app/api/menu-scan/route.ts` (multiple)
  - `useMenuScanState.ts` (lines 398, 421, 429)
- **TODO comments** with unimplemented features in `app/admin/restaurants/page.tsx`

## 3. Test Mock Boilerplate

- `DishFormDialog.test.tsx` (433 lines) has repetitive mock setup (lines 16-72)
- `useMenuScanState.test.ts` (208 lines) duplicates Supabase mocking
- **Recommendation:** Extract shared test utilities (`createMockSupabase`, `createMockToast`)
- Estimated savings: ~100 lines

## 4. Verbose Patterns

- Manual state update patterns with map/spread — could use Immer or helpers
- Repeated null/undefined checks instead of optional chaining
- Form schemas defined locally in components instead of centralized `lib/validation.ts`

## 5. Mobile Style Factory Bloat

`apps/mobile/src/styles/common.ts` (1,202 lines) uses factory functions (`createFlexContainer`, `createPadding`, etc.) generating repetitive patterns. Could reduce ~50% with design token utilities.

## 6. Potentially Unused Dependencies

- `baseline-browser-mapping` in web-portal devDependencies (not found in imports)
- `string-similarity` in `menu-scan.ts` — only used once, consider inlining

## Summary of LOC Reduction Potential

| Category | Estimated Savings |
|----------|-------------------|
| Shared constants/types extraction | ~800 (dedup) |
| Splitting oversized files | ~0 (restructuring, not reduction) |
| Dead code & console removal | ~50 |
| Test mock consolidation | ~100 |
| Mobile style factory simplification | ~600 |
| Verbose pattern cleanup | ~200 |
| **Total estimated** | **~1,750 LOC** |
