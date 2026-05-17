# Phase A — implementation plan

**Companion to:** `docs/plans/ingredient-pipeline-phase-a-cleanup.md` (the design doc)
**Status:** Shipped 2026-05-17
**Last updated:** 2026-05-17 (revised after gap review)
**Estimated wall time:** ~1 working day (9 commits over 6.5–8 hours including verification)

This plan turns Phase A's design into an ordered, atomic commit sequence. Each commit leaves the workspace in a buildable state. Each is independently revertible.

**Anchors over line numbers.** Line numbers in this plan are recorded as of 2026-05-17 and will drift. Each step includes a **grep anchor** — a unique string that locates the target regardless of drift. Run the grep at execution time to get the current line.

---

## 0. Why this ordering

The cleanup needs to respect TypeScript dependency direction. If we drop a field from a source type before removing its consumers, intermediate commits break the build.

The graph (writer → reader):

```
filterStore.PermanentFilters.ingredientsToAvoid
   ↓ written by: DrawerFilters
   ↓ read by:    geoService (maps to flagIngredients), userPreferencesService,
                 useRestaurantDetail → RestaurantDetailScreen → FoodTab → DishMenuItem
                                                                          ↓
                                                                     classifyDish
                                                                     (menuFilterUtils)

edgeFunctionsService.FeedRequest.filters.flagIngredients
   ↑ written by: geoService
   ↑ read by:    feed server

feed response.flagged_ingredients
   ↑ written by: feed server
   ↑ read by:    edgeFunctionsService Dish type (no runtime consumer in mobile)

ingredientService.ts → DrawerFilters (autocomplete picker)
ingredientDisplay.ts → useRestaurantDetail (photo modal)
dish_ingredients table → useRestaurantDetail (photo modal), restaurantStore (SELECT),
                         menuFilterUtils (classifyDish input shape), enrich-dish, feed
```

Correct teardown order: **server first → writer sites → readers → state holders → leaf files**. Concretely:

1. Server (independent — no mobile dependencies)
2. Mobile writer to feed (`geoService` + `edgeFunctionsService` types)
3. Mobile UI consumer of `filterStore.ingredientsToAvoid` for the drawer (`DrawerFilters`)
4. Mobile state holder (`filterStore` + `userPreferencesService`)
5. Mobile client-side per-restaurant filtering chain (`classifyDish` and its callers — restaurant-detail components)
6. Photo-modal display (drops the `dish_ingredients` join + state)
7. Leaf files + flag + locales + legacy comment
8. Documentation

Commit 6a (the client-side filtering chain) lands between the filterStore drop (Commit 5) and the photo-modal change (Commit 6) because:
- The chain consumes the type **and** the field that Commit 5 deletes. After Commit 5 the type/field are gone, so this chain's typecheck breaks — Commit 6a fixes it immediately.
- Putting 6a before 5 would type-check (the field/type still exists) but leaves the chain temporarily dead-code; functional impact is identical, but the 5-then-6a ordering keeps "drop the source, then drop the unused readers" as a clean rule.

---

## 1. Commit map

| # | Commit message | Files | Buildable? |
|---|---|---|---|
| 0 | _(no commit — pre-flight checks)_ | — | — |
| 1 | `fix(edge): drop dish_ingredients reads from enrich-dish` | enrich-dish/index.ts | ✅ |
| 2 | `fix(edge): drop flagIngredients filter from feed` | feed/index.ts | ✅ |
| 3 | `fix(mobile): stop sending flagIngredients in feed request` | geoService.ts, edgeFunctionsService.ts | ✅ |
| 4 | `fix(mobile): remove Ingredients to Avoid drawer section` | DrawerFilters.tsx | ✅ |
| 5 | `fix(mobile): drop ingredientsToAvoid from filterStore + clean rehydration` | filterStore.ts, userPreferencesService.ts | ⚠️ requires 6a |
| 6a | `fix(mobile): drop client-side ingredient-flagging from restaurant detail` | menuFilterUtils.ts, DishMenuItem.tsx, FoodTab.tsx, RestaurantDetailScreen.tsx, useRestaurantDetail.ts (chain B only) | ✅ |
| 6 | `fix(mobile): drop dish-photo modal ingredient display` | useRestaurantDetail.ts (photo modal), DishPhotoModal.tsx, RestaurantDetailScreen.tsx (modal prop), restaurantStore.ts | ✅ |
| 7 | `chore(mobile): delete dead ingredient files, flag, i18n, comment` | ingredientService.ts (del), ingredientDisplay.ts (del), environment.ts, locales/*.json, DishGrouping.ts (comment) | ✅ |
| 8 | `docs: drop INGREDIENT_ENTRY refs from CLAUDE.md` | CLAUDE.md | ✅ |

**⚠️ Note on Commit 5:** The Commit 5 → 6a pair is the only place where an intermediate state (5 applied, 6a not yet) is non-buildable. Run them as a tight pair — finish 5, then immediately run 6a's typecheck-driven cleanup. If you need to push midway, push 5+6a together as a single PR even if you keep the commits atomic.

9 commits, each reviewable in 5–15 minutes, each separately revertible (with the 5+6a caveat above).

---

## 2. Pre-flight (do this first, before any code change)

These checks verify assumptions in the design doc against the actual code. They take 15–20 minutes and prevent surprises mid-implementation.

### 2.1 Confirm baseline tests pass

```bash
cd /home/art/Documents/eatMe_v1
pnpm install
pnpm build
pnpm typecheck
pnpm test
```

Record the baseline pass count. The acceptance criteria for each subsequent commit is "same pass count, no new failures."

### 2.2 Verify the feed request parses as a plain cast, not Zod

**Why:** the design doc claims the server "silently ignores unknown fields." Verify the mechanism. Phase A research (2026-05-17) confirmed the feed body is read as a plain TypeScript cast (`const body: FeedRequest = await req.json()` at `feed/index.ts:426`), not validated by Zod. Extra fields are silently ignored — but if a `Schema.parse(body)` pattern has been added since, the rollback story changes.

```bash
grep -n "await req.json\|z\.parse\|\.parse(\|Schema" infra/supabase/functions/feed/index.ts
```

**Pass condition:** the request body parsing is `await req.json()` with no schema validation in between. If a strict Zod schema shows up, add a compatibility shim in Commit 2 that explicitly accepts and ignores `flagIngredients`.

### 2.3 Verify the filterStore persistence mechanism

**Why:** Commit 5 strips `ingredientsToAvoid` from rehydrated AsyncStorage state. Research (2026-05-17) confirmed `filterStore.ts` uses a hand-rolled AsyncStorage layer (`loadFilters` / `saveFilters`), **not** Zustand's `persist` middleware. No version field exists. The strip is a one-line `delete parsedPermanent.ingredientsToAvoid;` in `loadFilters`. Re-verify the mechanism in case it was migrated since.

```bash
grep -n "persist(\|loadFilters\|saveFilters\|PERMANENT_STORAGE_KEY" apps/mobile/src/stores/filterStore.ts | head -15
```

**Pass condition:** finds `loadFilters` and `saveFilters` and `PERMANENT_STORAGE_KEY = '@eatme_permanent_filters'`. No `persist(` middleware import or call. If the store has migrated to Zustand's `persist` since, switch to bump-version + migrate-handler.

### 2.4 Verify ingredient autocomplete location

**Why:** the design doc flags an open question about whether the ingredient autocomplete picker is inline in `DrawerFilters.tsx` or extracted as a separate component.

```bash
ls /home/art/Documents/eatMe_v1/apps/mobile/src/components/ | grep -i ingredient
grep -n "Autocomplete\|IngredientPicker\|IngredientSearch" /home/art/Documents/eatMe_v1/apps/mobile/src/components/DrawerFilters.tsx
```

**Pass condition:** record the answer. If separate, add the file to Commit 7's deletion list. If inline, skip.

### 2.5 Verify `@eatme/shared` doesn't expose ingredient fields we need to drop

**Why:** the design doc claims §5.4 — "Shared package — no changes." Verify the `Dish` type doesn't carry a residual `ingredients` field.

```bash
grep -n "ingredients\|flagged" /home/art/Documents/eatMe_v1/packages/shared/src/types/restaurant.ts
```

**Pass condition:** any matches should be unrelated to the dropped feature (e.g., `ingredients_visibility` is a separate concept and stays). If there's a `Dish.ingredients?: string[]` field, add a shared-package update to Commit 6.

### 2.6 Capture grep baselines

For the acceptance gate in §12.

```bash
git grep "dish_ingredients" apps/mobile infra/supabase/functions | wc -l            # baseline N1
git grep "flagIngredients\|flagged_ingredients" apps/mobile | wc -l                  # baseline N2
git grep "EXPO_PUBLIC_INGREDIENT_ENTRY_ENABLED" apps/mobile | wc -l                  # baseline N3
git grep "ingredientService\|ingredientDisplay\|dishIngredientNames" apps/mobile | wc -l  # baseline N4
git grep "ingredientsToAvoid\|IngredientToAvoid" apps/mobile | wc -l                 # baseline N5
git grep "flaggedIngredientNames" apps/mobile | wc -l                                # baseline N6
```

Record all six baselines. Final acceptance is: all six return zero.

---

## 3. Commit 1 — `fix(edge): drop dish_ingredients reads from enrich-dish`

**File:** `infra/supabase/functions/enrich-dish/index.ts`

**Grep anchor:**
```bash
grep -n "from('dish_ingredients')" infra/supabase/functions/enrich-dish/index.ts
# expect 2 matches — one in the primary query, one in the parent-dish branch
```

### Steps

1. Read the file around the first match (`Promise.all` block). Delete the first promise entry (the `dish_ingredients` SELECT) and its destructured `ingredientRows`.
2. Delete the `ingredientNames` derivation immediately after the destructure.
3. Read the second match (the `if (dish.parent_dish_id && parentDish)` block). Delete the inner `dish_ingredients` query and the `parentIngredients` derivation. Either drop the entire block if it becomes a no-op, or leave `parentName = parentDish.name` if downstream still uses it.
4. Open `buildEmbeddingInput` (defined elsewhere in the same file or in a helper). Remove `ingredientNames` and `parentIngredients` parameters from both the signature and the body's template string.
5. Update the call site to no longer pass those arguments.

### Verification

```bash
cd /home/art/Documents/eatMe_v1/infra/supabase/functions/enrich-dish
deno check index.ts
[ -f test.ts ] && deno test
```

If tests assert that ingredient names appear in `embeddingInput`, update them to assert absence (or just delete those assertions).

### Commit

```bash
git add infra/supabase/functions/enrich-dish/index.ts \
        infra/supabase/functions/enrich-dish/test.ts  # if modified
git commit
```

Commit message:
```
fix(edge): drop dish_ingredients reads from enrich-dish

The dish_ingredients pipeline is vestigial — no current writer
inserts rows (admin uses primary_protein directly; worker is
explicitly told not to extract ingredients). For new dishes the
query returns empty rowsets and contributes nothing to the
embedding input. For legacy dishes the embedding loses 5-15
ingredient name tokens; the dish gets re-enriched on next
name/description edit via trg_enrich_on_dish_change.

Part of Phase A — see docs/plans/ingredient-pipeline-phase-a-*.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
```

---

## 4. Commit 2 — `fix(edge): drop flagIngredients filter from feed`

**File:** `infra/supabase/functions/feed/index.ts`

**Grep anchors:**
```bash
grep -n "Ingredient flag annotation\|flagIngredients\|flagged_ingredients" infra/supabase/functions/feed/index.ts
# expect:
#   - 1 match for "Ingredient flag annotation" (the block header comment)
#   - 1 match for "flagIngredients" in the FeedRequest type
#   - 1 match for "filters.flagIngredients" inside the annotation block
#   - 4–5 matches for "flagged_ingredients" (Candidate type, derivation, response shape)
```

### Steps

1. Locate the `flagIngredients?: string[]` field on the `FeedRequest['filters']` type. Delete it.
2. Locate the `// ── Ingredient flag annotation` comment block. Delete from that comment through the closing `}` of the block (and the next-line `else { annotated = pool.map(d => ({ ...d, flagged_ingredients: [] })); }` fallback).
3. Replace the `annotated` derivation with a pass-through: `const annotated = pool;` (or rename `pool` downstream if simpler — verify by reading the next 50 lines).
4. Locate the response shape construction. Find `flagged_ingredients: ...` and delete that key (and the surrounding `...(d.flagged_ingredients?.length ? {...} : {})` spread).
5. Locate the `Candidate` interface near the top of the file. Delete `flagged_ingredients?: string[]` if it's declared there.

### Verification

```bash
cd /home/art/Documents/eatMe_v1/infra/supabase/functions/feed
deno check index.ts
[ -f test.ts ] && deno test
```

If tests reference `flagIngredients` or `flagged_ingredients`, update or delete them. Add one regression test:

```ts
test('feed silently ignores unknown filter fields', async () => {
  const res = await callFeed({ filters: { /* legacy */ flagIngredients: ['x'] } });
  assertEquals(res.status, 200);
  assertEquals(res.body.dishes[0].flagged_ingredients, undefined);
});
```

(Test name varies by framework.)

### Cache invalidation note

No code action. The cache key `feed:${userId}:${lat}:${lng}:${JSON.stringify(filters)}` naturally changes when filters drop `flagIngredients`. Legacy cached entries TTL out within 5 minutes of deploy.

### Commit

```
fix(edge): drop flagIngredients filter from feed

The "Ingredients to Avoid" filter is gated off in mobile
(EXPO_PUBLIC_INGREDIENT_ENTRY_ENABLED defaults to false), so
no production traffic sets flagIngredients. The dish_ingredients
join used to populate flagged_ingredients returns empty rowsets
for new dishes (no writer since the primary_protein cutover).

Server now silently ignores flagIngredients in the request body
(parsing is `await req.json()` cast to FeedRequest, not Zod) so
in-flight mobile clients still work.

Part of Phase A. Companion to enrich-dish change.
```

---

## 5. Commit 3 — `fix(mobile): stop sending flagIngredients in feed request`

**Files:**
- `apps/mobile/src/services/geoService.ts`
- `apps/mobile/src/services/edgeFunctionsService.ts`

**Grep anchors:**
```bash
grep -n "flagIngredients\|flagged_ingredients" apps/mobile/src/services/geoService.ts apps/mobile/src/services/edgeFunctionsService.ts
# expect:
#   geoService:   2 matches (filter type + active mapping line)
#   edgeFns:      4 matches (response type, JSDoc, request type, call body)
```

### Steps for `geoService.ts`

1. Delete `flagIngredients?: string[]` from the local filter type.
2. Delete the active mapping `filters.flagIngredients = permanent.ingredientsToAvoid.map(i => i.canonicalIngredientId);`.
3. Search the rest of the file for any other reference to `flagIngredients` or `ingredientsToAvoid` — should be zero after the deletions. If any, drop them.

### Steps for `edgeFunctionsService.ts`

1. Delete `flagged_ingredients: string[];` from the response dish type.
2. Delete the JSDoc lines about "Dishes containing these are annotated (flagged_ingredients), not excluded."
3. Delete `flagIngredients?: string[];` from the request type.
4. Delete the JSON body argument that maps `permanentFilters.ingredientsToAvoid` to `flagIngredients` in the `feed()` call body.

### Verification

```bash
cd /home/art/Documents/eatMe_v1/apps/mobile
pnpm typecheck

# Confirm no runtime consumers of flagged_ingredients exist anywhere in mobile:
grep -rn "\.flagged_ingredients" apps/mobile/src
# Expected: zero matches
```

The grep is defensive — research (2026-05-17) found zero runtime readers. If a new one has appeared since, optional-chain it before deleting the type declaration.

If typecheck fails with an error about `permanent.ingredientsToAvoid` being unused elsewhere, that's fine — the consumer chain is dropped in Commits 4 + 6a. Defer it.

The expected post-Commit-3 state: `filterStore.permanent.ingredientsToAvoid` still exists, `DrawerFilters` still reads/writes it, the restaurant-detail chain still reads it, but nothing forwards it to the server.

### Commit

```
fix(mobile): stop sending flagIngredients in feed request

geoService.ts was the active write site — without removing it, the
feed request still carries flagIngredients even though the server
(post-Commit 2) ignores it.

Also drops the field from edgeFunctionsService's request and
response types. The filterStore.ingredientsToAvoid state is kept
temporarily; Commit 5 removes it after the UI consumers
(Commits 4 + 6a) are gone.

Verified zero runtime consumers read `flagged_ingredients` on the
response — the type field was declared but never dereferenced.

Part of Phase A.
```

---

## 6. Commit 4 — `fix(mobile): remove Ingredients to Avoid drawer section`

**File:** `apps/mobile/src/components/DrawerFilters.tsx`

**Grep anchor:**
```bash
grep -n "ingredientsToAvoid\|ingredientService\|ingredientsToAvoidTitle" apps/mobile/src/components/DrawerFilters.tsx
# expect 6+ matches: import, section header, modal title, selected-chips list, add button, autocomplete results
```

### Steps

1. Locate the section gated by `EXPO_PUBLIC_INGREDIENT_ENTRY_ENABLED`.
2. Delete the entire gated JSX block — typically a `<View>` containing the section header (`ingredientsToAvoidTitle`), the autocomplete picker, the chip list of selected ingredients, and the "Add" button.
3. Delete imports from `'../services/ingredientService'`.
4. Delete any state hooks or local-state setters that only existed to drive the deleted UI (e.g., `const [ingredientQuery, setIngredientQuery] = useState('')`).
5. Delete the calls to `addIngredientToAvoid` / `removeIngredientToAvoid` and any local `permanent.ingredientsToAvoid` reads. After this commit, nothing in the drawer UI writes or reads that field.

### Verification

```bash
pnpm typecheck
```

Expected outcome: typecheck passes. `filterStore.permanent.ingredientsToAvoid` may now be unused from the drawer side — that's fine; Commits 5 + 6a drop it from the remaining consumers.

Run the snapshot tests:
```bash
cd /home/art/Documents/eatMe_v1/apps/mobile
pnpm test -- DrawerFilters
```

Update / regenerate snapshots after the section deletion. Review the diff to confirm only the Ingredients section is removed, no unrelated changes.

### Manual smoke

If a simulator is handy:
- Start the mobile app: `pnpm exec expo start`
- Open the filter drawer
- Confirm: no "Ingredients to Avoid" section, other sections render normally, app doesn't crash on open/close.

### Commit

```
fix(mobile): remove Ingredients to Avoid drawer section

The section was gated by EXPO_PUBLIC_INGREDIENT_ENTRY_ENABLED
(default false). With the feed no longer reading flagIngredients
and the worker no longer extracting ingredients, the feature
serves no purpose. Drops the section, the autocomplete picker,
and the imports.

filterStore.permanent.ingredientsToAvoid remains until Commit 5;
the per-restaurant client-side flagging chain (DishMenuItem,
FoodTab) is dropped in Commit 6a.

Part of Phase A.
```

---

## 7. Commit 5 — `fix(mobile): drop ingredientsToAvoid from filterStore + clean rehydration`

**Files:**
- `apps/mobile/src/stores/filterStore.ts`
- `apps/mobile/src/services/userPreferencesService.ts`

**Grep anchors:**
```bash
grep -n "IngredientToAvoid\|ingredientsToAvoid\|addIngredientToAvoid\|removeIngredientToAvoid" apps/mobile/src/stores/filterStore.ts
# expect ~12 matches: interface export, field on PermanentFilters, FilterActions entries, action implementations, default value, count check
grep -n "ingredients_to_avoid\|ingredientsToAvoid" apps/mobile/src/services/userPreferencesService.ts
# expect 4 matches: DB interface, permanentFiltersToDb mapping, dbToPermanentFilters mapping
```

### Steps for `filterStore.ts`

1. Delete the `IngredientToAvoid` interface export (the type definition block).
2. Delete `ingredientsToAvoid: IngredientToAvoid[];` from the `PermanentFilters` interface.
3. Delete `addIngredientToAvoid: (ingredient: IngredientToAvoid) => void;` and `removeIngredientToAvoid: (canonicalIngredientId: string) => void;` from `FilterActions`.
4. Delete the action implementations (`addIngredientToAvoid: ...` and `removeIngredientToAvoid: ...` in the `create<...>(...)` body).
5. Delete `ingredientsToAvoid: [],` from `defaultPermanentFilters`.
6. Delete the count check block in `getPermanentFilterCount`:
   ```ts
   // Check ingredients to avoid
   if (state.permanent.ingredientsToAvoid.length > 0) {
     count++;
   }
   ```
7. **Add a one-line strip in `loadFilters`** to clean rehydration. Locate the block:
   ```ts
   if (permanentStored) {
     const parsedPermanent = JSON.parse(permanentStored);
     set(state => ({
   ```
   Insert immediately after the `JSON.parse` line:
   ```ts
       // Phase A migration: strip the retired ingredientsToAvoid field if
       // a pre-Phase-A version of the app saved it. The field/type was
       // removed from PermanentFilters; without this strip, the spread
       // below would keep a stale key on the in-memory state object.
       // Safe to remove this strip after a release cycle where ~all users
       // have re-saved their state.
       delete parsedPermanent.ingredientsToAvoid;
   ```

### Steps for `userPreferencesService.ts`

1. Delete `ingredients_to_avoid: PermanentFilters['ingredientsToAvoid'] | null;` from the `UserPreferencesDB` interface.
2. Delete `ingredients_to_avoid: filters.ingredientsToAvoid,` from `permanentFiltersToDb`.
3. Delete the `ingredientsToAvoid: Array.isArray(...) ? ... : [],` block from `dbToPermanentFilters`.

### Note on `user_preferences.ingredients_to_avoid` DB column

The column itself remains in the database. After this commit, mobile stops writing and reading it; existing rows retain their values as dead data. Dropping the column is a schema change that belongs in Phase C. (Phase C's plan doesn't currently list this column — that's a Phase C gap flagged separately for follow-up.)

### Verification

```bash
pnpm typecheck
# Expected: typecheck FAILS at this point — the chain B consumers (Commit 6a)
# still reference IngredientToAvoid and state.permanent.ingredientsToAvoid.
# Proceed immediately to Commit 6a; do not push until 6a is also done.

pnpm test -- filterStore userPreferencesService
```

Add a new test for the strip:
```ts
test('loadFilters strips legacy ingredientsToAvoid from AsyncStorage', async () => {
  await AsyncStorage.setItem('@eatme_permanent_filters', JSON.stringify({
    dietPreference: 'all',
    ingredientsToAvoid: [{ canonicalIngredientId: 'x', displayName: 'X' }],
  }));
  await useFilterStore.getState().loadFilters();
  const permanent: any = useFilterStore.getState().permanent;
  expect(permanent.ingredientsToAvoid).toBeUndefined();
});
```

### Commit

```
fix(mobile): drop ingredientsToAvoid from filterStore + clean rehydration

Removes the IngredientToAvoid type, the permanent.ingredientsToAvoid
field, both store actions, and the DB persistence path in
userPreferencesService.

filterStore uses a hand-rolled AsyncStorage layer (not Zustand's
persist middleware), so there's no version field to bump. Instead,
loadFilters gets a one-line `delete parsedPermanent.ingredientsToAvoid`
to strip stale state on first rehydration. After one save cycle the
field is gone from AsyncStorage as well.

The user_preferences.ingredients_to_avoid DB column is retained for
now; mobile simply stops writing it. Phase C drops the column.

NOTE: This commit makes the workspace temporarily non-buildable —
Commit 6a (immediate follow-up) drops the remaining consumers.

Part of Phase A.
```

---

## 8. Commit 6a — `fix(mobile): drop client-side ingredient-flagging from restaurant detail`

**Files:**
- `apps/mobile/src/utils/menuFilterUtils.ts`
- `apps/mobile/src/screens/restaurant-detail/DishMenuItem.tsx`
- `apps/mobile/src/screens/restaurant-detail/FoodTab.tsx`
- `apps/mobile/src/screens/restaurant-detail/RestaurantDetailScreen.tsx`
- `apps/mobile/src/screens/restaurant-detail/useRestaurantDetail.ts` (chain-B references only)

**Grep anchors:**
```bash
grep -n "IngredientToAvoid\|ingredientsToAvoid\|flaggedIngredientNames\|classifyDish" \
  apps/mobile/src/utils/menuFilterUtils.ts \
  apps/mobile/src/screens/restaurant-detail/
# expect ~20 matches across 5 files
```

### Steps for `menuFilterUtils.ts` (rewrite `classifyDish`)

1. Delete the `IngredientToAvoid` import (combine the import with the surviving `PermanentFilters` import).
2. Change the file header comment: drop "and ingredients-to-avoid list."
3. Change `classifyDish` signature from `(dish, permanent, ingredientsToAvoid)` to `(dish, permanent)`.
4. Drop `dish_ingredients?: Array<{ ingredient_id: string; concept_id?: string | null }> | null;` from the `dish` parameter type.
5. Drop the `dishIngredientIds` / `dishConceptIds` Set construction (the `for (const di of dish.dish_ingredients ?? []) { ... }` loop).
6. Delete the entire "── Soft: ingredient flagging ──" block (the `const flaggedIngredientNames: string[] = ingredientsToAvoid.filter(...).map(...)` derivation).
7. Change the return shape: `return { passesHardFilters };` (drop `flaggedIngredientNames`).
8. Update `DishClassification` interface: drop the `flaggedIngredientNames: string[];` field and its JSDoc.
9. Update the `classifyDish` JSDoc: drop the `@param ingredientsToAvoid` line and the "must include … and `dish_ingredients[].ingredient_id`" clause in the `@param dish` description.

### Steps for `DishMenuItem.tsx`

1. Drop `type IngredientToAvoid` from the import at the top.
2. Drop `ingredientsToAvoid: IngredientToAvoid[];` from `DishMenuItemProps`.
3. Drop `ingredientsToAvoid,` from the destructured arguments.
4. Update the `classifyDish` call: `classifyDish(item, permanentFilters)` — drop the third arg.
5. Drop `flaggedIngredientNames` from the destructured result; keep `passesHardFilters`.
6. Delete the `{flaggedIngredientNames.length > 0 && (...)}` JSX block at the bottom of the row (the "⚠️ Contains: …" warning).

### Steps for `FoodTab.tsx`

1. Drop `type IngredientToAvoid` from the import at the top.
2. Drop `ingredientsToAvoid: IngredientToAvoid[];` from `FoodTabProps`.
3. Drop the `ingredientsToAvoid: IngredientToAvoid[]` parameter from the local `sortedDishes` helper. Update its body's `classifyDish` call to drop the third arg.
4. Drop `ingredientsToAvoid,` from the component's destructured args.
5. Drop the `ingredientsToAvoid` argument from the `sortedDishes(...)` call site.
6. Drop `ingredientsToAvoid={ingredientsToAvoid}` from the `<DishMenuItem>` prop pass.

### Steps for `RestaurantDetailScreen.tsx`

1. Drop `ingredientsToAvoid,` from the `useRestaurantDetail` destructure.
2. Drop `ingredientsToAvoid={ingredientsToAvoid}` from the `<FoodTab>` prop pass.

### Steps for `useRestaurantDetail.ts` (chain-B references only — leave the photo-modal block for Commit 6)

1. Drop `IngredientToAvoid` from the import line at the top.
2. Drop `ingredientsToAvoid: IngredientToAvoid[];` from the `RestaurantDetailState` interface.
3. Drop the `const ingredientsToAvoid = useFilterStore(state => state.permanent.ingredientsToAvoid);` line near the top of the hook.
4. Drop `ingredientsToAvoid,` from the return object near the bottom.

### Verification

```bash
pnpm typecheck
# Expected: typecheck PASSES (this unblocks Commit 5).

pnpm test -- restaurant-detail menuFilterUtils DishMenuItem FoodTab
```

Snapshot regen: `DishMenuItem` and `FoodTab` snapshots will change (no more warning chip; no more `ingredientsToAvoid` in render path). Review the diff to confirm only those removals.

### Manual smoke

- Navigate to a restaurant detail screen with a dish that would have triggered a `flaggedIngredientNames` warning under old gated behavior (unlikely in production since the flag is off).
- Confirm the screen renders without warning chips.
- Confirm dishes that fail hard filters still show the "not for you" pill — `passesHardFilters` is untouched.

### Commit

```
fix(mobile): drop client-side ingredient-flagging from restaurant detail

The classifyDish helper had two responsibilities: hard filtering
(diet, allergens, religious restrictions — all still active) and
soft ingredient flagging (against permanent.ingredientsToAvoid).
This commit removes the second responsibility entirely:

  - menuFilterUtils.classifyDish loses its ingredientsToAvoid
    parameter and the flaggedIngredientNames return field
  - DishMenuItem stops rendering the "⚠️ Contains: ..." warning
  - FoodTab + RestaurantDetailScreen drop the prop chain
  - useRestaurantDetail drops the filterStore read and the
    ingredientsToAvoid field on its return type

This restores buildability after Commit 5 (which dropped the
IngredientToAvoid type and field). Run as an immediate pair.

The photo-modal display path in useRestaurantDetail (the
dish_ingredients query) is dropped in Commit 6 — orthogonal to
this commit.

Part of Phase A.
```

---

## 9. Commit 6 — `fix(mobile): drop dish-photo modal ingredient display`

**Files:**
- `apps/mobile/src/screens/restaurant-detail/useRestaurantDetail.ts` (photo-modal block only)
- `apps/mobile/src/components/DishPhotoModal.tsx`
- `apps/mobile/src/screens/restaurant-detail/RestaurantDetailScreen.tsx` (modal prop pass)
- `apps/mobile/src/stores/restaurantStore.ts`

**Grep anchors:**
```bash
grep -n "dishIngredientNames\|setDishIngredientNames\|ingredientsResult\|resolveIngredientNames\|JoinedDishIngredient\|dish_ingredients" \
  apps/mobile/src/screens/restaurant-detail/useRestaurantDetail.ts \
  apps/mobile/src/components/DishPhotoModal.tsx \
  apps/mobile/src/screens/restaurant-detail/RestaurantDetailScreen.tsx \
  apps/mobile/src/stores/restaurantStore.ts
# expect ~10 matches
```

**Decision (A1 strict):** drop the photo-modal ingredient display entirely. Verified during research that `primary_protein` is independent of `dish_ingredients` / `dish.ingredients` and is not consumed by the photo modal or restaurant-detail screen — zero `primary_protein` references in those files.

### Steps for `useRestaurantDetail.ts` (photo-modal block)

1. In the `Promise.allSettled` block (inside `handleDishPress`): delete the entire `dish_ingredients` query (the second `.from(...)` call cast through `supabase.from as unknown as ...`). The block then has two promises instead of three. Rename the destructured tuple accordingly (`[photosResult, allergenResult]`).
2. Delete the `if (ingredientsResult.status === 'fulfilled') { ... } else { ... }` block in its entirety.
3. Delete the `dishIngredientNames` / `setDishIngredientNames` `useState` declaration.
4. Delete `dishIngredientNames` and `setDishIngredientNames` from the `RestaurantDetailState` interface.
5. Delete the `import { resolveIngredientNames, type JoinedDishIngredient } from '../../lib/ingredientDisplay';` line.
6. Delete `dishIngredientNames` and `setDishIngredientNames` from the return object.
7. **Keep** the `canonical_ingredient_allergens` lookup (the third promise) — this is the per-option allergen path, independent of `dish_ingredients`. Re-verify by reading the surrounding context.

### Steps for `DishPhotoModal.tsx`

1. Delete `dishIngredients?: string[];` from `DishPhotoModalProps`.
2. Delete `dishIngredients,` from the destructured arguments.
3. Delete the `{dishIngredients && dishIngredients.length > 0 && (...)}` JSX block that renders the ingredients line.

### Steps for `RestaurantDetailScreen.tsx`

1. Delete `dishIngredientNames,` and `setDishIngredientNames,` from the `useRestaurantDetail` destructure.
2. Delete the `dishIngredients={...}` prop on `<DishPhotoModal>`.
3. Delete `setDishIngredientNames([]);` from the `onClose` reset block.

### Steps for `restaurantStore.ts`

1. In the SELECT clause for dishes (find the `dish_ingredients (ingredient_id, concept_id),` line), delete that single line.

### Verification

```bash
pnpm typecheck
pnpm test -- restaurant-detail
```

### Manual smoke

- Start the app.
- Navigate to a restaurant detail screen with a dish that has a photo.
- Tap the dish photo to open the modal.
- Confirm: the modal opens, no crash, no "Ingredients: undefined" stub. The dish photo, name, description, and per-option allergen badges all render correctly.

### Commit

```
fix(mobile): drop dish-photo modal ingredient display

Per Phase A design decision A1 (docs/plans/ingredient-pipeline-
phase-a-cleanup.md §2.1): the photo-modal ingredient list is
dropped entirely. For new dishes the query returned empty rows
anyway; for legacy dishes the ingredient list disappears from
the modal until Phase C retires the schema.

Verified that primary_protein (the current dish-classification
column) is independent of dish_ingredients and dish.ingredients,
and is not read anywhere in the photo modal or restaurant detail
screen — dropping the display has zero impact on classification.

The per-option allergen path via canonical_ingredient_allergens
is preserved — it's independent of dish_ingredients and powers
the allergen badges in the restaurant detail screen.

Part of Phase A.
```

---

## 10. Commit 7 — `chore(mobile): delete dead ingredient files, flag, i18n, comment`

**Files:**
- Delete: `apps/mobile/src/services/ingredientService.ts`
- Delete: `apps/mobile/src/lib/ingredientDisplay.ts`
- (Conditional, per pre-flight §2.4): delete the autocomplete component file
- Modify: `apps/mobile/src/config/environment.ts`
- Modify: `apps/mobile/src/locales/en.json`
- Modify: `apps/mobile/src/locales/es.json`
- Modify: `apps/mobile/src/locales/pl.json`
- Modify: `apps/mobile/src/screens/restaurant-detail/DishGrouping.ts` (comment fix only)

### Steps

1. `git rm apps/mobile/src/services/ingredientService.ts`
2. `git rm apps/mobile/src/lib/ingredientDisplay.ts`
3. If pre-flight §2.4 identified a separate autocomplete component file: `git rm <that file>`.
4. Open `environment.ts`. Delete `EXPO_PUBLIC_INGREDIENT_ENTRY_ENABLED` from the config object and the env-var typing.
5. For each of `locales/en.json`, `locales/es.json`, `locales/pl.json`: delete keys related to the "Ingredients to Avoid" section. Known keys (per grep):
   - `filters.ingredientsToAvoidTitle`
   - `filters.ingredientsToAvoid`
   - any `filters.selectIngredients` / `filters.addIngredient` / `filters.ingredientSearch.*` siblings
6. Open `DishGrouping.ts` line 17 comment. Change:
   - From: `ingredients: legacy text array column (superseded by dish_ingredients join table)`
   - To: `ingredients: legacy text array of ingredient names from menu scan`

### Verification

```bash
pnpm typecheck
pnpm build
pnpm test
```

Run the grep checks from pre-flight §2.6 — all six should now return zero:

```bash
git grep "dish_ingredients" apps/mobile infra/supabase/functions
git grep "flagIngredients\|flagged_ingredients" apps/mobile
git grep "EXPO_PUBLIC_INGREDIENT_ENTRY_ENABLED" apps/mobile
git grep "ingredientService\|ingredientDisplay\|dishIngredientNames" apps/mobile
git grep "ingredientsToAvoid\|IngredientToAvoid" apps/mobile
git grep "flaggedIngredientNames" apps/mobile
```

If any return nonzero, identify the straggler and decide: fix now (small edit) or defer to a Commit 7b.

### Commit

```
chore(mobile): delete dead ingredient files, flag, i18n, comment

Removes:
- ingredientService.ts (autocomplete data source, only consumed
  by the deleted drawer section)
- ingredientDisplay.ts (resolveIngredientNames, only consumed by
  the deleted photo-modal section)
- EXPO_PUBLIC_INGREDIENT_ENTRY_ENABLED flag (no remaining
  callers)
- i18n keys for the Ingredients to Avoid section across en/es/pl
- Stale "superseded by dish_ingredients join table" comment in
  DishGrouping.ts (the legacy text-array field stays — only the
  cross-reference to the retired join table is dropped)

Part of Phase A.
```

---

## 11. Commit 8 — `docs: drop INGREDIENT_ENTRY refs from CLAUDE.md`

**File:** `CLAUDE.md`

### Steps

1. Open `CLAUDE.md` in the project root.
2. Locate the section on dish classification / ingredient pipeline. The relevant line is the one that says *"To expose the ingredient pipeline, flip both flags to `"true"` in the respective `.env.local` / `.env` files."*
3. Delete the line. If the surrounding paragraph becomes nonsensical, restructure it:
   - Remove the sentence about `EXPO_PUBLIC_INGREDIENT_ENTRY_ENABLED` (mobile).
   - Keep or remove the `NEXT_PUBLIC_INGREDIENT_ENTRY_ENABLED` (web-portal) reference depending on whether web-portal is being mentioned at all — see the existing CLAUDE.md scope (web-portal is documented as legacy/being retired).
4. The "Dish Classification — Primary Protein" section that describes the gating should be reduced to: ingredient classification is no longer exposed; `primary_protein` is the single source of truth.

### Verification

```bash
git diff CLAUDE.md
```

Read through the changes once to make sure context isn't broken. Open `CLAUDE.md` in a markdown previewer if available.

### Commit

```
docs: drop INGREDIENT_ENTRY refs from CLAUDE.md

EXPO_PUBLIC_INGREDIENT_ENTRY_ENABLED was deleted in Commit 7;
the CLAUDE.md instruction to flip it to true is obsolete. The
dish classification model is fully driven by primary_protein now.

Part of Phase A.
```

---

## 12. Final acceptance gate (no commit)

Run all six grep checks from pre-flight §2.6 — all return zero:

```bash
git grep "dish_ingredients" apps/mobile infra/supabase/functions          # → 0
git grep "flagIngredients\|flagged_ingredients" apps/mobile               # → 0
git grep "EXPO_PUBLIC_INGREDIENT_ENTRY_ENABLED" apps/mobile                # → 0
git grep "ingredientService\|ingredientDisplay\|dishIngredientNames" apps/mobile  # → 0
git grep "ingredientsToAvoid\|IngredientToAvoid" apps/mobile               # → 0
git grep "flaggedIngredientNames" apps/mobile                              # → 0
```

Run the full test suite + typecheck + build, one last time:

```bash
pnpm install
pnpm build
pnpm typecheck
pnpm test
```

All baselines from pre-flight §2.1 should hold.

### Manual QA checklist

- [ ] Mobile app starts cleanly on simulator.
- [ ] Filter drawer renders without "Ingredients to Avoid" section.
- [ ] Permanent filters persist correctly across app restart (verify legacy `ingredientsToAvoid` is stripped — start with old AsyncStorage state if testable).
- [ ] Feed loads with normal dish list.
- [ ] Restaurant detail loads dishes with allergen badges.
- [ ] FoodTab dish list renders WITHOUT "⚠️ Contains: …" warnings (chain B fully gone).
- [ ] Dish-photo modal opens without crash, shows photo + name + description (no ingredient list).
- [ ] Edge function logs show no errors related to `dish_ingredients` or `flagIngredients`.

---

## 13. Deploy plan

Phase A has two deploy surfaces: edge functions and mobile.

### 13.1 Edge function deploy order

Deploy in the same order as the commits, one at a time, with a smoke check between:

1. **Deploy `enrich-dish`** (Commit 1). Verify: `enrich-dish` logs show successful invocations on new dish inserts, no exceptions referencing `ingredientRows` or `parentIngredients`.
2. **Deploy `feed`** (Commit 2). Verify: feed response shape no longer includes `flagged_ingredients` (curl a sample request); old-client requests with `flagIngredients` field still return 200; feed P95 latency unchanged.

Both edge function deploys can happen before mobile ships — old mobile clients tolerate the removed `flagged_ingredients` response field (no runtime consumers exist in mobile — verified during research).

### 13.2 Mobile release

Standard release flow. Bundle all mobile commits (3 through 8) into one app release. Phase A doesn't require a force-upgrade gate because:
- Old clients still send `flagIngredients` — server silently ignores.
- Old clients still expect `flagged_ingredients` — receive `undefined`, but the type field has no runtime reader.
- Old clients still expect the Ingredients-to-Avoid section in the drawer — section was gated off in production, so it's invisible whether the code is present or not.

### 13.3 Monitoring window

For 24 hours after each deploy:

- Edge function error rate (target: unchanged from baseline).
- Feed P95 latency (target: equal or marginally improved — one less DB query).
- `enrich-dish` per-invocation runtime (target: equal or marginally improved).
- Mobile crash-free session rate (target: unchanged).

If any metric regresses by more than 5%, investigate before declaring Phase A done.

---

## 14. Rollback

Each commit is `git revert`-able. The deploy order is symmetric — revert in reverse commit order if needed.

Specific rollback notes:

- **Rolling back Commit 5 (the AsyncStorage strip):** the `delete parsedPermanent.ingredientsToAvoid;` line can't be cleanly unwound for users who've already rehydrated post-strip. Their persisted state simply won't carry `ingredientsToAvoid` even after revert. The field would default to `[]` (post-revert) on next read, which is what the original code expected for fresh installs. Acceptable.
- **Rolling back Commit 6a:** strictly paired with Commit 5 — if you revert 5, also revert 6a (otherwise 6a's narrower `classifyDish` signature has no matching field source). In practice, revert as a pair.
- **Rolling back Commit 2 (feed server):** if rolled back after mobile (Commit 3) has shipped, the server starts returning `flagged_ingredients: []` for all responses (the join returns empty for new dishes anyway). Mobile is type-tolerant after Commit 3 and has no runtime readers — receives the field but doesn't use it. No regression.
- **Rolling back Commit 1 (enrich-dish):** if rolled back after deploy, new dishes queue an extra DB query that returns nothing. Latency reverts to baseline. No data harm.

The AsyncStorage strip in Commit 5 is the one structurally-irreversible bit (for users who've rehydrated post-strip). Everything else is symmetric.

---

## 15. After Phase A — what's next

Once Phase A is shipped and observed stable:

1. **Update `docs/plans/ingredient-pipeline-phase-a-cleanup.md` status from "Proposed" to "Shipped"** + add a "Shipped on YYYY-MM-DD" line.
2. **Begin the dish-model rewrite** — `docs/project/dish-model-rewrite-plan.md` Phase 1.
3. **Schedule Phase B** for ~1–2 weeks after the dish-model rewrite Phase 7 ships. See `docs/plans/ingredient-pipeline-phase-b-trigger-retirement.md`.
4. **Flag the Phase C addendum** (separate follow-up): Phase C's column-drop migration (§5.3) should add `user_preferences.ingredients_to_avoid` to its `ALTER TABLE` list. Phase A leaves it as dead data; Phase C should retire it.

---

## 16. Time budget

| Step | Estimated time |
|---|---|
| Pre-flight checks (§2) | 20 min |
| Commit 1 (enrich-dish) | 30 min |
| Commit 2 (feed) | 45 min |
| Commit 3 (geoService + edgeFunctionsService) | 20 min |
| Commit 4 (DrawerFilters) | 30 min |
| Commit 5 (filterStore + AsyncStorage strip) | 45 min |
| Commit 6a (client-side flagging chain) | 60 min |
| Commit 6 (photo modal + restaurantStore) | 45 min |
| Commit 7 (deletions + flag + locales + comment) | 30 min |
| Commit 8 (CLAUDE.md) | 10 min |
| Final acceptance + manual QA | 45 min |
| **Total** | **~6.5 hours** |

Plus deploy + 24-hour monitoring window. Realistic single-engineer wall time: **1 working day** for code + commit; **2 days** if you want overnight smoke observation between server and mobile deploys.
