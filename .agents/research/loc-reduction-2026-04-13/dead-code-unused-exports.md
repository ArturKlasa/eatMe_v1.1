# LOC-05: dead-code-unused-exports

## Current state

Four exported symbols have zero import sites across both apps:

1. **`testSupabaseConnection`** — `apps/web-portal/lib/supabase.ts:70-86` (17 lines incl. JSDoc)
   - Diagnostic function that queries `restaurants` table. Never imported anywhere.

2. **`WIZARD_STEPS`** — `packages/shared/src/constants/wizard.ts:1-12` (entire 12-line file)
   - Re-exported via `packages/shared/src/constants/index.ts:23` but never consumed by any app.
   - Also referenced in index.ts header comment at line 14.

3. **`spiceIcon`** — `packages/shared/src/constants/pricing.ts:21-24` (4 lines incl. JSDoc)
   - Maps spice level text to chilli icon. Zero imports.
   - Note: `apps/mobile/src/styles/filters.ts:148` has a style key named `spiceIcon` — unrelated (property name, not an import).

4. **`hasSavedData`** — `apps/web-portal/lib/storage.ts:45-52` (8 lines)
   - Checks localStorage for saved restaurant data. Zero imports in any code file.
   - Referenced only in `docs/project/04-web-portal.md:255` (documentation, not code).

## Proposed reduction

### supabase.ts — remove lines 70-86
```diff
- /** Test Supabase connection.
-  * @returns*/
- export async function testSupabaseConnection(): Promise<boolean> {
-   try {
-     const { error } = await supabase.from('restaurants').select('count').limit(1);
-
-     if (error) {
-       console.error('❌ Supabase connection failed:', error.message);
-       return false;
-     }
-
-     return true;
-   } catch (error) {
-     console.error('❌ Unexpected error:', error);
-     return false;
-   }
- }
```

### wizard.ts — delete entire file + remove re-export
Delete `packages/shared/src/constants/wizard.ts` (12 lines).
In `packages/shared/src/constants/index.ts`:
- Remove line 23: `export * from './wizard';`
- Remove line 14 reference in header comment: `wizard — WIZARD_STEPS...`

### pricing.ts — remove lines 21-24
```diff
- /** Map a spice_level text value to its chilli-icon string. */
- export function spiceIcon(level: string | null | undefined): string {
-   return SPICE_LEVELS.find(l => l.value === level)?.icon ?? '';
- }
```

### storage.ts — remove lines 45-52
```diff
- export const hasSavedData = (userId: string): boolean => {
-   try {
-     return localStorage.getItem(getStorageKey(userId)) !== null;
-   } catch (error) {
-     console.error('Failed to check for saved data:', error);
-     return false;
-   }
- };
```

## Estimated LOC savings

~35 lines (17 + 12 + 2 from index.ts + 4 + 8 = 43 gross, ~35 net after any formatting adjustments)

## Risk assessment

**Zero functional risk.** Every symbol was verified to have zero import sites across the entire repo:

- `testSupabaseConnection`: grep found definition only at supabase.ts:72. No imports.
- `WIZARD_STEPS`: grep found definition at wizard.ts:6, re-export at index.ts:23. No imports in apps/.
- `spiceIcon`: grep found definition at pricing.ts:22. The `spiceIcon` in filters.ts:148 is a style property name, not an import of this function.
- `hasSavedData`: grep found definition at storage.ts:45. Only other reference is docs/project/04-web-portal.md:255 (documentation).

The web-portal's `WIZARD_STEPS` was likely intended for the onboarding wizard but the wizard uses its own local step definitions instead. The `spiceIcon` helper is superseded by inline icon lookup in the consuming components. The `testSupabaseConnection` is a diagnostic utility that was never wired into any health-check route. The `hasSavedData` check is unused — the app calls `loadRestaurantData` directly.

No test files import any of these symbols. `turbo check-types` and `turbo lint` will pass since removing unused exports cannot break anything.

## Decision: apply
- Safe to implement, no side effects
- Pure dead code removal — no call sites, no consumers, no runtime impact
