# F-007b: Eliminate `any` Type Usage in Mobile App

**Priority:** HIGH
**Scope:** `apps/mobile` only
**Status:** Web-portal portion already complete (see `f007-eliminate-any-types-plan.md`)
**Current count:** ~90 occurrences across ~20 files
**Goal:** 0 `any` + ESLint rule to prevent regressions

---

## Current State (Audit — April 2026)

```
24  src/screens/RestaurantDetailScreen.tsx
 9  src/services/favoritesService.ts
 9  src/screens/eatTogether/VotingResultsScreen.tsx
 8  src/components/common/ (6 files, style props)
 7  src/screens/eatTogether/RecommendationsScreen.tsx
 6  src/screens/BasicMapScreen.tsx
 5  src/services/eatTogetherService.ts
 5  src/screens/eatTogether/CreateSessionScreen.tsx + SessionLobbyScreen.tsx
 4  src/screens/EatTogetherScreen.tsx + ProfileScreen.tsx + SettingsScreen.tsx
 3  src/screens/onboarding/*.tsx + stores/onboardingStore.ts
 3  src/utils/i18nUtils.ts + src/config/environment.ts
 3  src/styles/common.ts + src/styles/filters.ts
 3  src/services/geoService.ts + userPreferencesService.ts + edgeFunctionsService.ts
 2  src/components/FilterComponents.tsx + DailyFilterModal.tsx + DishMarkers.tsx
──
~90 total
```

---

## Root Causes

| Pattern                               | Count | Root cause                                                                                                                           |
| ------------------------------------- | ----- | ------------------------------------------------------------------------------------------------------------------------------------ |
| `navigate('Screen' as any)`           | ~13   | `useNavigation()` or prop-based navigation without typed navigate call; `RootStackParamList` exists but not constrained at call site |
| `(restaurant/dish/menu as any).field` | ~15   | Fields exist on the type but screen imports wrong type alias or missing from Supabase-derived type                                   |
| `favorites` table not in DB types     | ~9    | `supabase gen types` not run after migration 064; whole client cast to `any` as workaround                                           |
| Unknown/untyped function params       | ~12   | `renderMenuItem(item: any)`, `safeArrayValue(value: any)`, `handleScroll(event: any)`                                                |
| Style prop `container?: any` etc.     | ~12   | Should be `StyleProp<ViewStyle>` / `StyleProp<TextStyle>` from `react-native`                                                        |
| Service interface fields typed `any`  | ~7    | `RestaurantRecommendation.dietary_compatibility: any`, `restaurant?: any`, return `any[]`                                            |
| `as any` to satisfy enum/union param  | ~4    | `setDietPreference(option.key as any)` — key is `string`, param is union                                                             |
| Style object inference failure        | ~3    | `const style: any = {}` and `} as any` on RN `TextStyle` objects                                                                     |
| RPC / edge function response          | ~2    | `(errorData as any).error`, `supabase.from('user_preferences') as any`                                                               |
| `...args: any[]` in debug util        | 1     | `debugLog(message, ...args: any[])`                                                                                                  |

---

## Implementation Plan

### Phase 1 — Navigation type safety (~13 route-name casts + 1 state `any`)

**Root cause:** Some screens use `useNavigation()` without the generic parameter; others receive `navigation` via props but the prop type's `.navigate()` overload isn't satisfied by a plain string literal. All screen names already exist in `RootStackParamList` (defined in `src/types/navigation.ts`), and the global namespace declaration is already in place.

**Files using `useNavigation()` — need generic param added:**

- `src/screens/eatTogether/CreateSessionScreen.tsx` — 1 navigation + 1 `useState<any>(null)` (session state)
- `src/screens/eatTogether/JoinSessionScreen.tsx` — 1 navigation
- `src/screens/eatTogether/RecommendationsScreen.tsx` — 1 navigation
- `src/screens/eatTogether/SessionLobbyScreen.tsx` — 2 navigations
- `src/screens/eatTogether/VotingResultsScreen.tsx` — 2 navigations
- `src/components/FloatingMenu.tsx` — 1 navigation

**Files receiving `navigation` via props — cast to satisfy typed navigate overload:**

- `src/screens/EatTogetherScreen.tsx` — 2 navigations (already has typed props, but navigate call uses `as any`)
- `src/screens/ProfileScreen.tsx` — 2 navigations (same pattern)

**Pattern to apply everywhere:**

```typescript
// Before — useNavigation without type + as any cast
import { useNavigation } from '@react-navigation/native';
// ...
const navigation = useNavigation();
navigation.navigate('CreateSession' as any);

// After — typed useNavigation, no cast needed
import { useNavigation } from '@react-navigation/native';
import type { NavigationProp } from '@react-navigation/native';
import type { RootStackParamList } from '@/types/navigation';
// ...
const navigation = useNavigation<NavigationProp<RootStackParamList>>();
navigation.navigate('CreateSession'); // ← TypeScript verifies name and params
```

**Screens that receive `navigation` via props** (EatTogetherScreen, ProfileScreen) use `MainStackScreenProps<'EatTogether'>` / `MainStackScreenProps<'Profile'>`. All target screens (`CreateSession`, `JoinSession`, `ProfileEdit`, `OnboardingStep1`) are already in `MainStackParamList`. The `as any` casts on these screens are simply **unnecessary** — remove them. No change to the navigate call signature is needed.

**`CreateSessionScreen.tsx` also has `useState<any>(null)`** for the session object. Fix: `useState<EatTogetherSession | null>(null)` (the type is already defined in `eatTogetherService.ts`).

**Special case — `FloatingMenu.tsx` with dynamic screen name:**

```typescript
// src/components/FloatingMenu.tsx:44
navigation.navigate(screen as any);

// Fix: accept only valid screen names in the prop type
interface FloatingMenuProps {
  screen: keyof RootStackParamList; // constrain to valid names
}
navigation.navigate(screen); // TypeScript will verify the param requirement
// If screen has required params, add overload or restrict further
```

> **Effort:** Low — mechanical addition of `<NavigationProp<RootStackParamList>>` generic. No logic changes.

---

### Phase 2 — Add `favorites` table to Supabase types (9 occurrences)

**Root cause:** Migration `064_add_favorites_table.sql` added the `favorites` table, but `supabase gen types typescript` has not been run since. The `favoritesService.ts` works around the missing type by casting `const supabase = _supabase as any`.

**Option A (recommended) — Regenerate DB types:**

```bash
# From project root — regenerates packages/database/src/types.ts
supabase gen types typescript --project-id <project-id> --schema public \
  > packages/database/src/types.ts
```

After regeneration, `Tables<'favorites'>` will be available, and `favoritesService.ts` can use it directly.

**Option B (immediate, no CLI required) — Add local type matching DB schema:**

Add to `apps/mobile/src/lib/supabase.ts`:

```typescript
/** Row shape for the `favorites` table (migration 064). */
export interface FavoriteRow {
  id: string;
  user_id: string;
  subject_type: 'restaurant' | 'dish';
  subject_id: string;
  created_at: string;
}
```

Then in `favoritesService.ts`:

```typescript
// Before
import { supabase as _supabase } from '../lib/supabase';
const supabase = _supabase as any;               // ← entire client cast away

// After — use typed client directly
import { supabase, type FavoriteRow } from '../lib/supabase';

// Before
const { data, error } = (await (supabase.from('favorites') as any)
  .insert({ ... })
  .select()
  .single()) as { data: any; error: any };

// After — supabase.from() with table string + manual cast of the return
const { data, error } = await supabase
  .from('favorites')
  .insert({ user_id, subject_type: subjectType, subject_id: subjectId })
  .select()
  .single() as unknown as { data: FavoriteRow | null; error: { message: string; code: string } | null };
```

The `as unknown as { data: ...; error: ... }` cast is narrower than `as any` — it keeps the shape explicit. All downstream access via `data.user_id`, `error.message` etc. becomes type-checked.

> **Effort:** Low (Option B is ~20 lines changed); regenerating types (Option A) is more thorough but requires Supabase CLI access.

---

### Phase 3 — Fix service layer interfaces (10 occurrences)

#### 3a — `eatTogetherService.ts`: `dietary_compatibility: any` and `restaurant?: any`

The `RestaurantRecommendation` interface uses `any` for two fields:

```typescript
// Before
export interface RestaurantRecommendation {
  // ...
  dietary_compatibility: any;
  restaurant?: any; // Full restaurant details
}

// After — explicit shapes
import type { Restaurant } from '../lib/supabase';

/** Compatibility breakdown by dietary category. */
type DietaryCompatibility = Record<string, boolean | number>;

export interface RestaurantRecommendation {
  // ...
  dietary_compatibility: DietaryCompatibility | null;
  restaurant?: Restaurant;
}
```

#### 3b — `eatTogetherService.ts`: `getVoteResults` return type `any[]`

```typescript
// Before (line 357)
export async function getVoteResults(
  sessionId: string
): Promise<{ data: any[] | null; error: Error | null }> {

// After — VoteResult type is already defined in the same file
export async function getVoteResults(
  sessionId: string
): Promise<{ data: VoteResult[] | null; error: Error | null }> {
```

Same pattern at line 426 (second any[] return).

#### 3c — `eatTogetherService.ts` line 209: `(m: any)` in member mapping

The `getSessionMembers` function maps Supabase query results with `data.map((m: any) => ...)` where `m` is a row from `eat_together_members` with a joined `users` object.

```typescript
// Before
const members = data.map((m: any) => ({
  ...m,
  profile_name: m.users?.profile_name || 'Unknown',
}));

// After — define inline row type matching the .select() columns
type MemberRow = Tables<'eat_together_members'> & { users: { profile_name: string } | null };
const members = data.map((m: MemberRow) => ({
  ...m,
  profile_name: m.users?.profile_name || 'Unknown',
}));
```

#### 3d — `geoService.ts`: `appliedFilters: any` and `const filters: any` (2 occurrences)

```typescript
// Before
export interface NearbyRestaurantsResponse {
  // ...
  appliedFilters: any;
}

function buildEdgeFunctionFilters(...) {
  const filters: any = {};
  // ...
}

// After — explicit shape
type EdgeFunctionFilters = {
  cuisines?: string[];
  priceMin?: number;
  priceMax?: number;
  dietaryTags?: string[];
  maxDistance?: number;
  proteinTypes?: string[];
  proteinFamilies?: string[];
};

export interface NearbyRestaurantsResponse {
  // ...
  appliedFilters: EdgeFunctionFilters;
}

function buildEdgeFunctionFilters(...): EdgeFunctionFilters {
  const filters: EdgeFunctionFilters = {};
  // ...
}
```

#### 3e — `userPreferencesService.ts` (line 167): `supabase.from('user_preferences') as any`

**Correction:** `Tables<'user_preferences'>` DOES exist in the generated types (unlike `favorites`). The `as any` cast is likely due to a mismatch between the upsert payload shape (`UserPreferencesDB`) and the generated `TablesInsert<'user_preferences'>`. The column names may differ (e.g. `diet_preference` in DB vs `dietPreference` in the local type).

**Fix — align the upsert payload with the generated Insert type:**

```typescript
import type { TablesInsert } from '@eatme/database';

// Before
const { error } = await (supabase.from('user_preferences') as any).upsert(payload);

// After — construct payload using the DB column names directly
const dbPayload: TablesInsert<'user_preferences'> = {
  user_id: userId,
  diet_preference: payload.diet_preference,
  allergies: payload.allergies,
  // ... map all fields to DB column names
};
const { error } = await supabase.from('user_preferences').upsert(dbPayload);
```

If `TablesInsert<'user_preferences'>` matches the payload shape already, simply remove the `as any`.

> **Effort:** Low-medium — type definitions only, no logic changes.

---

### Phase 4 — Fix `RestaurantDetailScreen.tsx` (15+ occurrences)

This is the largest single file. All issues stem from three root causes that are already partially fixed:

#### 4a — `(restaurant as any).payment_methods` (line 211)

`restaurant` is typed as `RestaurantWithMenus` which extends `Tables<'restaurants'>`. **The `payment_methods` field DOES exist** in the generated types (`packages/database/src/types.ts`) as `payment_methods: string | null`. The `as any` cast is therefore completely unnecessary.

```typescript
// Before
switch ((restaurant as any).payment_methods) {

// After — no cast needed, field exists on Restaurant
switch (restaurant.payment_methods) {
```

If you want enum-style narrowing on the switch, you can optionally type it:

```typescript
const paymentMethods = restaurant.payment_methods as
  | 'cash_only'
  | 'card_only'
  | 'cash_and_card'
  | null;
```

But this is optional — the cast to `any` is the only thing that needs removing.

#### 4b — `handleDishPress(dish: any)` (line 277)

Dishes are accessed via `RestaurantWithMenus.menus[*].menu_categories[*].dishes[*]`. That array element is `Dish & { option_groups?: OptionGroup[] }` per `src/lib/supabase.ts`.

```typescript
// Before
const handleDishPress = async (dish: any) => {

// After — import the compound type
import type { Dish, OptionGroup } from '../lib/supabase';
type DishWithGroups = Dish & { option_groups?: OptionGroup[] };

const handleDishPress = async (dish: DishWithGroups) => {
```

**Note on `selectedDish`:** The state is `useState<Dish | null>(null)` and `Dish = Tables<'dishes'>` already has both `dish_kind` and `display_price_prefix` fields. The `as any` casts on lines 771-772 are completely unnecessary — simply removing the casts is sufficient. This is independent of the `handleDishPress` typing.

#### 4c — `renderMenuItem(item: any)` (line 389)

```typescript
// Before
const renderMenuItem = (item: any) => {

// After — same DishWithGroups type from 4b
const renderMenuItem = (item: DishWithGroups) => {
```

#### 4d — `sortedDishes(dishes: any[]): any[]` (line 466)

```typescript
// Before
const sortedDishes = (dishes: any[]): any[] => {

// After
const sortedDishes = (dishes: DishWithGroups[]): DishWithGroups[] => {
```

#### 4e — `(menu as any).dishes` and `(category as any)` (lines 537, 541)

These navigate the `RestaurantWithMenus` nested structure. The type already defines `menus.menu_categories.dishes` — the cast is unnecessary. Use the typed navigation prop directly:

```typescript
// Before
{restaurant.menus?.map((menu: any) => (
  { menu.menu_categories?.map((category: any) => (

// After — menus is already Menu[] & { menu_categories: ... } per RestaurantWithMenus
{restaurant.menus?.map((menu) => (
  { menu.menu_categories?.map((category) => (
```

#### 4f — `(opt as any).canonical_ingredient_id` (lines 298, 301)

`canonical_ingredient_id` is already declared on the `Option` interface in `src/lib/supabase.ts` (line ~60). No cast needed:

```typescript
// Before
if ((opt as any).canonical_ingredient_id) {
  optionsWithIngredient.push({
    optionId: opt.id,
    ingredientId: (opt as any).canonical_ingredient_id,
  });
}

// After — field exists on Option
if (opt.canonical_ingredient_id) {
  optionsWithIngredient.push({ optionId: opt.id, ingredientId: opt.canonical_ingredient_id });
}
```

#### 4g — `(row: any) => row.canonical_ingredient?.canonical_name` (line 353)

```typescript
// Before
.map((row: any) => row.canonical_ingredient?.canonical_name)

// After — inline type matching the .select() columns
type IngredientRow = { canonical_ingredient: { canonical_name: string } | null };
.map((row: IngredientRow) => row.canonical_ingredient?.canonical_name)
```

#### 4h — `error: any` in state type (line 368)

```typescript
// Before
error: any;

// After
error: Error | null;
```

> **Effort:** Medium — many small substitutions, all mechanical. No logic changes. Test thoroughly by navigating to a restaurant with menus.

---

### Phase 5 — Fix `BasicMapScreen.tsx` (6 occurrences)

#### 5a — `(menu as any).dishes` (line 166)

The map screen iterates data from the nearby-restaurants **Edge Function**, NOT a direct Supabase `.select()`. The Edge Function returns a **flattened** shape where `dishes` is directly on the `menu` object (no `menu_categories` nesting). This means the data shape is NOT the same as `RestaurantWithMenus` from `src/lib/supabase.ts`.

**This is NOT a latent bug** — the `as any` works correctly at runtime because the Edge Function really does return `menu.dishes`.

**Fix — define the Edge Function response shape:**

```typescript
// The Edge Function returns a different shape than the direct Supabase query
interface EdgeFunctionMenu {
  id: string;
  name: string;
  dishes: Array<Dish & { option_groups?: OptionGroup[] }>;
  // ... other fields from edge function response
}

// Then:
for (const dish of menu.dishes ?? []) {   // no cast needed
```

This requires checking the actual Edge Function response schema in `infra/supabase/functions/nearby-restaurants/` to confirm the exact shape.

#### 5b — `const raw = dish as any` (lines 220, 261)

Same as RestaurantDetailScreen — `dish` should be typed as `DishWithGroups`:

```typescript
// Before
const raw = dish as any;
raw.dish_kind ?? 'standard';

// After — import DishWithGroups (or define locally) and remove the intermediate cast
dish.dish_kind ?? 'standard';
```

#### 5c — `pointsEarned: any` in local state type (line 519)

```typescript
// Before
pointsEarned: any;

// After — the actual value is always a number
pointsEarned: number;
```

> **Effort:** Low-medium — 5a requires defining the Edge Function response type (different from the direct Supabase query shape). Verify by testing map → dish interaction flow.

---

### Phase 6 — Fix `VotingResultsScreen.tsx` and `RecommendationsScreen.tsx` (12 occurrences)

#### 6a — `VotingResultsScreen.tsx` (5 non-navigation casts)

`(winner as any)` casts on lines 117, 118, 126 access `.restaurant?.name`, `.restaurant?.address`, and `.percentage`. `(result: any, index)` at line 142 types `voteResults` array elements as `any` (also accessing `result.restaurant?.name` and `result.percentage`). `openMaps(restaurant: any)` at line 59 types the param as `any`.

**Fix — extend `VoteResult` in `eatTogetherService.ts` and type `openMaps`:**

```typescript
// Before
export interface VoteResult {
  restaurant_id: string;
  restaurant_name: string;
  vote_count: number;
  [key: string]: unknown;
}

// After — add the fields the RPC actually returns
import type { Restaurant } from '../lib/supabase';

export interface VoteResult {
  restaurant_id: string;
  restaurant_name: string;
  vote_count: number;
  percentage?: number; // calculated by get_vote_results RPC
  restaurant?: Pick<Restaurant, 'id' | 'name' | 'address' | 'cuisine_types'>;
  [key: string]: unknown; // keep for forward compatibility
}
```

Then in `VotingResultsScreen.tsx`:

```typescript
// Before
function openMaps(restaurant: any) { ... }
(winner as any).restaurant?.name
(winner as any).percentage?.toFixed(0)
voteResults.map((result: any, index) => ...)

// After
type OpenMapsArg = Pick<Restaurant, 'name' | 'location'> & { address?: string };
function openMaps(restaurant: OpenMapsArg) { ... }
winner.restaurant?.name
winner.percentage?.toFixed(0)
voteResults.map((result, index) => ...)
```

#### 6b — `RecommendationsScreen.tsx` (5 non-navigation casts)

Lines 65, 82, 154, 159, 163 all cast service call results or lambda params to `any`. None of these are navigation-related.

```typescript
// Line 65 — data is already RestaurantRecommendation[] | null, state is SessionRecommendation[]
// (SessionRecommendation = RestaurantRecommendation)
if (data) {
  setRecommendations(data as any); // ← cast is unnecessary
  setRecommendations(data); // ← fix: types already match
}

// Lines 82, 154, 159, 163 — v is VoteResult which has restaurant_id, vote_count
// user_id is covered by the [key: string]: unknown index signature
const userVote = data.find((v: any) => v.user_id === user.id); // ← VoteResult[]
const result = voteResults.find((v: any) => v.restaurant_id === restaurantId);
const totalVotes = voteResults.reduce((sum: number, v: any) => sum + v.vote_count, 0);

// After — VoteResult type already covers all accessed fields
const userVote = data.find(v => (v.user_id as string) === user.id);
const result = voteResults.find(v => v.restaurant_id === restaurantId);
const totalVotes = voteResults.reduce((sum, v) => sum + v.vote_count, 0);
```

> **Effort:** Low — add 2 fields to `VoteResult`, remove casts in two files.

---

### Phase 7 — Fix utility patterns (~15 occurrences across many small files)

#### 7a — Scroll handlers: `handleScroll(event: any)` (3 files)

```typescript
// Before (EatTogetherScreen, ProfileScreen, SettingsScreen)
const handleScroll = (event: any) => {
  const y = event.nativeEvent.contentOffset.y;

// After
import type { NativeSyntheticEvent, NativeScrollEvent } from 'react-native';
const handleScroll = (event: NativeSyntheticEvent<NativeScrollEvent>) => {
  const y = event.nativeEvent.contentOffset.y;
```

#### 7b — Helper functions with `value: any` (3 occurrences)

```typescript
// Before (OnboardingStep1Screen, OnboardingStep2Screen, onboardingStore)
const safeArrayValue = (value: any): string[] => {
const ensureArray = (value: any): string[] => {

// After — use unknown and do the runtime check you were already doing
const safeArrayValue = (value: unknown): string[] => {
const ensureArray = (value: unknown): string[] => {
```

The function body already does `if (!Array.isArray(value))` so no logic change is needed.

#### 7c — `debugLog(...args: any[])` in `config/environment.ts`

```typescript
// Before
export const debugLog = (message: string, ...args: any[]): void => {

// After
export const debugLog = (message: string, ...args: unknown[]): void => {
```

This is safe — `console.log` accepts `unknown`.

#### 7d — Common component style props (12 occurrences)

All `any` style props in `EmptyState`, `FeatureList`, `ScreenLayout`, `SectionContainer`, `SettingItem`, `ViewModeToggle`:

```typescript
// Before
interface ComponentStyles {
  container?: any;
  title?: any;
  description?: any;
  icon?: any;
}

// After
import type { StyleProp, ViewStyle, TextStyle, ImageStyle } from 'react-native';

interface ComponentStyles {
  container?: StyleProp<ViewStyle>;
  title?: StyleProp<TextStyle>;
  description?: StyleProp<TextStyle>;
  icon?: StyleProp<ImageStyle> | StyleProp<ViewStyle>;
}
```

#### 7e — Enum/union casts: `option.key as any` (4 occurrences)

These appear in FilterComponents.tsx, DailyFilterModal.tsx, OnboardingStep1Screen, SessionLobbyScreen.

**Note:** OnboardingStep1Screen uses `.value` not `.key` — `handleDietSelect(diet.value as any)`. The option arrays already have literal union values; the issue is that the array type widens to `string`. The fix is to type the array with `as const` or an explicit interface:

```typescript
// Before — option.key is `string`, but setDietPreference expects a union
onPress={() => setDietPreference(option.key as any)}

// After — type the options array properly
interface FilterOption {
  key: DietPreference;   // use the exact union type
  label: string;
}
const DIET_OPTIONS: FilterOption[] = [
  { key: 'all', label: 'All' },
  { key: 'vegetarian', label: 'Vegetarian' },
  { key: 'vegan', label: 'Vegan' },
];
// Now option.key is DietPreference and no cast is needed
onPress={() => setDietPreference(option.key)}
```

#### 7f — `i18nUtils.ts`: `(supportedLanguages.find(...) as any)` (lines 25, 248)

The `supportedLanguages` array is defined in `src/i18n/index.ts` as:

```typescript
const getSupportedLanguages = () => [
  { code: 'en', name: 'English', flag: '🇺🇸' },
  { code: 'es', name: 'Español', flag: '🇲🇽' },
  { code: 'pl', name: 'Polski', flag: '🇵🇱' },
];
```

**There is NO `currency` field.** The `.currency` access always returns `undefined`. This may be dead code or a missing feature.

**Fix — two options:**

1. **If currency is needed:** Add it to the array elements in `src/i18n/index.ts` and add `currency?: string` to the type:

   ```typescript
   { code: 'en', name: 'English', flag: '🇺🇸', currency: 'USD' },
   { code: 'es', name: 'Español', flag: '🇲🇽', currency: 'MXN' },
   { code: 'pl', name: 'Polski', flag: '🇵🇱', currency: 'PLN' },
   ```

2. **If currency is dead code:** Remove the `.currency` access entirely with a `// TODO` note or a hardcoded fallback.

Either way, the `as any` cast must go.

#### 7g — Style objects: `const style: any = {}` and `} as any` in RN styles

```typescript
// src/styles/common.ts:89
// Before
const style: any = {};
// After — if the object contains mixed ViewStyle/TextStyle, use a union
const style: ViewStyle | TextStyle = {};

// src/styles/filters.ts:399,412 — } as any on TextStyle objects
// After — check which exact field causes TS mismatch; usually letterSpacing on
// RN-web or fontVariant. Use explicit type assertion to TextStyle (not any):
} as TextStyle,
```

#### 7h — `edgeFunctionsService.ts`: `(errorData as any).error` (line 169)

```typescript
// Before
throw new Error((errorData as any).error || 'Failed to fetch feed');

// After — use unknown narrowing
const message =
  typeof errorData === 'object' && errorData !== null && 'error' in errorData
    ? String((errorData as { error: unknown }).error)
    : 'Failed to fetch feed';
throw new Error(message);
```

#### 7i — `DishMarkers.tsx`: `(dish as any).cuisine` (line 47)

```typescript
// Before
(dish as any).cuisine ?? (dish as any).restaurant?.cuisine_types?.[0] ?? '';

// After — the `cuisine` field does not exist on Dish. Use the fallback directly:
dish.restaurant?.cuisine_types?.[0] ?? '';
// Or if dish source guarantees cuisine_types from a join, type it properly:
type DishMarkerDish = Dish & { restaurant?: Pick<Restaurant, 'cuisine_types'> };
```

> **Effort:** Low — mostly import additions and type annotation updates. No logic changes except 7e (needs DIET_OPTIONS arrays typed properly).

---

### Phase 8 — Add ESLint `no-explicit-any` rule to mobile

The mobile app's `eslint.config.js` or `.eslintrc` does not current enforce `no-explicit-any`. Add it after all phases are complete:

```javascript
// apps/mobile/eslint.config.mjs (or .eslintrc.js)
rules: {
  '@typescript-eslint/no-explicit-any': 'error',
}
```

Run `pnpm lint` from `apps/mobile` to confirm zero violations.

> **Effort:** Trivial once all phases are complete.

---

## Execution Order & Dependencies

```
Phase 1  ─── independent ───────────────────────────────── (start here, easiest)
Phase 7a ─── independent ───────────────────────────────── (3 files, 3 lines each)
Phase 7b ─── independent ───────────────────────────────── (value: any → unknown)
Phase 7c ─── independent ───────────────────────────────── (1 line)
Phase 7d ─── independent ───────────────────────────────── (6 files, import + type)
Phase 2  ─── independent ───────────────────────────────── (favoritesService)
Phase 3a ─── independent ───────────────────────────────── (eatTogetherService interfaces)
Phase 3b ─── depends on Phase 3a types ─────────────────── (VoteResult return type)
Phase 3c ─── independent ───────────────────────────────── (member mapping row type)
Phase 3d ─── independent ───────────────────────────────── (geoService filter type)
Phase 3e ─── independent ───────────────────────────────── (userPreferencesService)
Phase 6  ─── depends on Phase 3a (VoteResult extended) ─── (VotingResults + RecommendationsScreen)
Phase 4  ─── independent ───────────────────────────────── (RestaurantDetailScreen)
Phase 5  ─── independent ───────────────────────────────── (BasicMapScreen)
Phase 7e ─── independent ───────────────────────────────── (enum option arrays)
Phase 7f ─── independent ───────────────────────────────── (i18nUtils)
Phase 7g ─── independent ───────────────────────────────── (style objects)
Phase 7h ─── independent ───────────────────────────────── (edgeFunctionsService)
Phase 7i ─── independent ───────────────────────────────── (DishMarkers)
Phase 8  ─── depends on ALL phases complete ─────────────── (ESLint rule)
```

---

## Risk Assessment

| Change                                   | Risk           | Notes                                                                                                                                         |
| ---------------------------------------- | -------------- | --------------------------------------------------------------------------------------------------------------------------------------------- |
| Navigation generics (Phase 1)            | **Low**        | Pure type change; code already navigates correctly at runtime                                                                                 |
| Favorites table types (Phase 2)          | **Low–Medium** | If regenerating types, run full `pnpm build` to confirm no regressions                                                                        |
| Service interfaces (Phase 3)             | **Low**        | Adding fields to interfaces is non-breaking. 3c is new (member mapping)                                                                       |
| VoteResult extension (Phase 6)           | **Low**        | Index signature `[key: string]: unknown` stays; only adding named fields                                                                      |
| RestaurantDetailScreen (Phase 4)         | **Medium**     | Largest change; test full dish-press flow including option groups and ingredient loading                                                      |
| BasicMapScreen 5a Edge Function type     | **Medium**     | `(menu as any).dishes` is NOT a bug — Edge Function returns flattened dishes on menu. Need to define the EF response shape. Test after fixing |
| Style props (Phase 7d)                   | **Low**        | StyleProp<ViewStyle> is the correct type for all container props                                                                              |
| Enum option arrays (Phase 7e)            | **Low–Medium** | Requires typing the option arrays; check all 4 call sites for correct union types                                                             |
| `debugLog ...args: unknown[]` (Phase 7c) | **Low**        | `console.log` accepts unknown                                                                                                                 |

---

## Verification Checklist

After all phases:

```bash
cd apps/mobile
npx tsc --noEmit          # 0 TypeScript errors
pnpm lint                 # 0 no-explicit-any violations
```

Manual test:

- [ ] Navigate between all main screens (Map, Favorites, Profile, Settings)
- [ ] Open a restaurant → browse menu → tap a dish → see option groups
- [ ] Eat Together: create session → lobby → recommendations → voting → results
- [ ] Apply filters (diet preference, protein type, allergens)
- [ ] Add/remove a restaurant from favorites
- [ ] Complete onboarding flow (both steps)

---

_Plan created: April 5, 2026_
