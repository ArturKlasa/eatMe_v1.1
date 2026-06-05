# Ingredient pipeline — Phase A cleanup

**Status:** Shipped 2026-05-17
**Last updated:** 2026-05-17
**Scope:** Remove all runtime read paths that depend on `dish_ingredients`, `canonical_ingredients`, `ingredient_concepts`, `ingredient_variants`, and `ingredient_aliases_v2`. No schema changes. No data deletion. No triggers touched.
**Out of scope:** Trigger retirement (Phase B), schema retirement (Phase C), rebuilding "Ingredients to Avoid" on the modifier model. `apps/web-portal` is the legacy v1 portal being retired and is not modified here.
**Sequencing:** Phase A runs **before** the dish-model rewrite. Independent and reversible.

---

## 1. Background

The ingredient pipeline is vestigial. Three independent forces have left it stranded:

1. **Admin no longer writes ingredients.** `apps/admin` has zero references to `dish_ingredients`. The dish form takes `primary_protein` + allergens + dietary_tags directly. The `menu-scan-worker` prompt explicitly instructs the AI: *"Do NOT include allergens, dietary tags, ingredients..."* (`infra/supabase/functions/menu-scan-worker/index.ts:133`). The Zod schema doesn't have an ingredients field.
2. **The "Ingredients to Avoid" mobile feature is gated off.** `EXPO_PUBLIC_INGREDIENT_ENTRY_ENABLED` defaults to `false`. The drawer section is hidden in production.
3. **The new ingredient_concepts/variants schema (mig 099–106) is stuck mid-cutover.** Phase 6 (rename `ingredient_aliases_v2` → `ingredient_aliases`, retire legacy tables) never ran.

For new dishes (i.e. every dish created post-`primary_protein` rollout), the `dish_ingredients` table holds zero rows. The runtime read paths fire against empty rowsets, consuming latency and review attention while returning nothing useful.

Phase A removes those read paths. After Phase A:
- Nothing in the runtime touches `dish_ingredients` except the DB trigger.
- Embedding context for new dishes is unchanged (it was empty from this source already).
- Embedding context for legacy dishes loses ingredient names — re-enrichment via name/description edits or the existing pg_cron sweep restores parity over time.
- The mobile "Ingredients to Avoid" code path is deleted entirely.

---

## 2. Decisions needed before kickoff

### 2.1 Dish-photo modal ingredient display — keep or drop?

`apps/mobile/src/screens/restaurant-detail/useRestaurantDetail.ts:300–313` queries `dish_ingredients` joined with `ingredient_concepts`, `ingredient_variants`, `concept_translations`, `variant_translations`, and `canonical_ingredients` to display localized ingredient names in the dish-photo modal.

**For new dishes:** the query returns zero rows. `dishIngredientNames` falls back to `dish.ingredients || []` (which is also empty for new dishes — no field is written there). User sees no ingredients section.

**For legacy dishes:** the query returns 5–15 ingredient names, displayed as a comma-separated list in the photo modal.

Options:

| Option | Description | Pro | Con |
|---|---|---|---|
| **A1 — Drop the display** | Remove the ingredients section from the photo modal entirely. Drop the query + `resolveIngredientNames` + `lib/ingredientDisplay.ts`. | Cleanest. Removes the largest single chunk of ingredient-pipeline code. | Legacy dishes lose their ingredient list in the photo modal until the data is retired in Phase C. |
| **A2 — Keep query, drop nothing visible** | Leave the query in place. Returns empty for new dishes; populates for legacy. | Zero user-visible regression. | Keeps ~50 lines of mid-modal complexity alive for a feature that will retire anyway. |
| **A3 — Drop query only** | Keep the photo-modal section, but always render from `dish.ingredients` (empty for everything new). | Smallest delta. | Identical user-visible behavior to A1 — same legacy regression, with more residual code. |

**Recommendation: A1.** The dish-photo modal ingredient list is dying anyway (no new dishes have ingredients, the schema is being retired in Phase C). Carrying the display surface adds review cost across every future mobile-side change to that screen. A 5–15-item list disappearing from legacy dishes in the photo modal is a minor visual regression; users haven't been entering ingredients themselves and don't reference this section for filtering anymore.

**Action required:** confirm A1 before kickoff. If A2 or A3, the §5.3 changes shrink.

### 2.2 `protein_canonical_names` from the embedding input

Plan §3.2 of the dish-model rewrite extends the `enrich-dish` embedding input to include modifier-option names. While we're touching the function, should we also drop `protein_canonical_names` from the input string? It's redundant with `primary_protein` (`deriveProteinFields()` is a deterministic mapping).

**Recommendation: defer.** Keep both for now. Cheap; preserves embedding stability for legacy dishes; the dish-model rewrite is the right place to reconsider.

---

## 3. End state (after Phase A)

```
┌──────────────────────────────────────────────────────────────────────┐
│  Runtime readers of dish_ingredients / canonical_ingredients / ...    │
├──────────────────────────────────────────────────────────────────────┤
│  enrich-dish      ─── DROPPED ────────────────────────────────────    │
│  feed             ─── DROPPED (flagIngredients block) ───────────     │
│  mobile filters   ─── DROPPED (filterStore, drawer section) ─────     │
│  mobile photomodal─── DROPPED (per §2.1 recommendation A1) ──────     │
│  mobile picker    ─── DROPPED (ingredientService) ───────────────     │
│                                                                       │
│  DB triggers      ─── PRESERVED (092, 105, 135) ─── Phase B will      │
│                                                      drop these.      │
│  Schema           ─── PRESERVED ─── Phase C will drop tables.         │
└──────────────────────────────────────────────────────────────────────┘
```

The only remaining runtime touchpoint after Phase A is the per-option `canonical_ingredient_id` → `canonical_ingredient_allergens` lookup in `useRestaurantDetail.ts:314–322`. **This is NOT dropped** — it powers per-option allergen badges in the restaurant detail screen, which is independent of `dish_ingredients`. It survives until either the modifier model's `option.adds_allergens` column (dish-model rewrite Phase 1) supersedes it or Phase C retires the entire ingredient schema.

---

## 4. Effort: ~1 day

0.5d server cleanup (enrich-dish + feed), 0.5d mobile cleanup (filter store + drawer + service + photo modal + types).

Total file count: 13 files modified, 2 files deleted (possibly 3 if the ingredient autocomplete component is a separate file), 0 migrations.

---

## 5. Concrete changes

### 5.1 `enrich-dish` — drop the dish_ingredients query

**File:** `infra/supabase/functions/enrich-dish/index.ts`

Current (lines 200–238) makes two `dish_ingredients` queries — one for the dish, one for its parent — and folds the returned `canonical_name` values into the embedding input.

**Changes:**
1. Drop the first promise in the `Promise.all` block (lines 200–204).
2. Drop the `ingredientNames` derivation (lines 216–218).
3. Drop the `parentIngredients` parallel query inside the `if (dish.parent_dish_id && parentDish)` block (lines 231–237).
4. Remove `ingredientNames` and `parentIngredients` from the `buildEmbeddingInput` call (lines 240–250). Update `buildEmbeddingInput` to no longer accept these arguments.

**Note on the dish-model rewrite:** plan §3.2 also extends `buildEmbeddingInput` to include modifier-option names. Phase A removes the ingredient inputs; the dish-model rewrite adds the option inputs. Both can land independently — Phase A first cleanly removes dead code, the dish-model rewrite then extends with new context.

**Embedding context delta for new dishes:** zero (no ingredient rows existed).

**Embedding context delta for legacy dishes:** loses ~5–15 ingredient name tokens per dish. The dish gets re-enriched whenever its `name` or `description` changes via the existing trigger `trg_enrich_on_dish_change` (mig 135). For dishes that never change again, the embedding stays at its current value (Phase A doesn't bulk-re-embed).

### 5.2 `feed` — drop the flagIngredients filter

**File:** `infra/supabase/functions/feed/index.ts`

Current (lines 622–663) reads `flagIngredients` from the request body, joins `dish_ingredients` and `ingredient_aliases`, annotates each dish with `flagged_ingredients[]`.

**Changes:**
1. Drop the entire "Ingredient flag annotation" block (lines 620–663).
2. Drop `flagIngredients` from the `FeedRequest['filters']` type.
3. Drop `flagged_ingredients` from the response shape (the `Candidate` mapping below the block).

**Cache invalidation:** no action needed. The cache key is `feed:${userId}:${lat}:${lng}:${JSON.stringify(filters)}` (feed/index.ts:440) — no version prefix. Dropping `flagIngredients` from the request filters changes the JSON, so new requests hit different keys; legacy cached entries with `flagged_ingredients` populated expire naturally via TTL (~5 min). The dish-model rewrite later restructures the response shape and will introduce its own versioning then.

**No change to `generate_candidates` RPC** — it never returned `flagged_ingredients`; annotation happened in the edge function.

### 5.3 Mobile — drop the "Ingredients to Avoid" surface

**File:** `apps/mobile/src/stores/filterStore.ts`
- Drop the `flagIngredients` field from `PermanentFilters` (lines around 159–160 per grep).
- Drop the default-value initializer for that field.
- Drop any setter / migration code that referenced it.
- Bump the persisted-state version number so existing users' saved filters don't carry the dead field. (Filter store uses Zustand persist; check the migration handler.)

**File:** `apps/mobile/src/components/DrawerFilters.tsx`
- Delete the entire "Ingredients to Avoid" section that's wrapped in `EXPO_PUBLIC_INGREDIENT_ENTRY_ENABLED`.
- Delete the autocomplete picker rendering, the chip list rendering, and the "Add ingredient" button.
- Delete imports related to `ingredientService`.

**File:** `apps/mobile/src/config/environment.ts`
- Delete `EXPO_PUBLIC_INGREDIENT_ENTRY_ENABLED` from the config object and the env-var typing.
- Audit `.env` and `.env.local` for stale entries (user removes manually if present).

**File:** `apps/mobile/src/services/edgeFunctionsService.ts`
- Delete `flagIngredients?: string[]` from the `feed()` request type (line 66).
- Delete the `flagIngredients` argument from the `feed()` body (line 205).
- Delete `flagged_ingredients: string[]` from the response dish type (line 36).
- Audit consumers of `dish.flagged_ingredients` (none expected after cleanup).

**File:** `apps/mobile/src/services/ingredientService.ts`
- **Delete the entire file.** Only consumer is the gated drawer UI being deleted.

**File:** `apps/mobile/src/lib/ingredientDisplay.ts`
- **Delete the entire file** (per §2.1 recommendation A1). Used only by `useRestaurantDetail.ts` for the dish-photo modal display.

**File:** `apps/mobile/src/screens/restaurant-detail/useRestaurantDetail.ts`
- Drop the `dish_ingredients` query from the `Promise.allSettled` block (lines 290–323).
- Drop the `ingredientsResult` branch (lines 343–354) and the `setDishIngredientNames` calls.
- Drop the `JoinedDishIngredient` type and `resolveIngredientNames` import.
- **Keep** the `canonical_ingredient_allergens` lookup (lines 314–322) — that's the per-option allergen path, independent of `dish_ingredients`.
- Drop `dishIngredientNames` from the hook's return value.

**File:** `apps/mobile/src/screens/restaurant-detail/DishPhotoModal.tsx` (and any consumers of the dropped `dishIngredientNames`)
- Drop the ingredients-list rendering block.
- Drop the prop from the component signature.

**File:** `apps/mobile/src/stores/restaurantStore.ts`
- Drop `dish_ingredients (ingredient_id, concept_id)` from the dish select clause (line 328).

**File:** `apps/mobile/src/utils/menuFilterUtils.ts`
- Audit for any logic that consumed `flagged_ingredients` from feed responses or `dish_ingredients` directly. Remove.

**File:** `apps/mobile/src/services/userPreferencesService.ts`
- Drop the flagIngredients persistence path.

**File:** `apps/mobile/src/services/geoService.ts`
- Drop `flagIngredients?: string[]` from the request-filter type (line 64).
- Drop the active mapping `filters.flagIngredients = permanent.ingredientsToAvoid.map(i => i.canonicalIngredientId)` (line 111). Without this deletion the request still carries the field even after every other call site is gone, so this is the critical write-site for Phase A.
- Audit for any other reference to `permanent.ingredientsToAvoid` and remove (the permanent filter field itself goes away in `filterStore.ts` above).

**Files:** `apps/mobile/src/locales/{en,es,pl}.json`
- Drop the i18n keys for "Ingredients to Avoid" section labels, autocomplete placeholder, etc.

### 5.4 Shared package — no changes

`@eatme/shared` doesn't expose ingredient types that Phase A touches. The dish-model rewrite will eventually remove ingredient-related fields from `Dish`, but Phase A's deletions are confined to apps + edge functions.

`@eatme/database` types stay as-is — the underlying tables aren't dropped, only their callers. No regeneration needed.

---

## 6. Tests

### 6.1 Server

- **enrich-dish unit tests:** if existing tests assert ingredient names in the embedding input, update them to expect absence. (Spot-check `infra/supabase/functions/enrich-dish/test.ts` if it exists.)
- **feed unit tests:** drop test cases that exercised `flagIngredients`. Add one negative test: `request.filters.flagIngredients = ['some-id']` is silently ignored (server treats unknown fields as no-op rather than rejecting the request — preserves forward-compat for in-flight mobile clients).

### 6.2 Mobile

- **filterStore tests:** update the persisted-state migration test to confirm `flagIngredients` is stripped from rehydrated state.
- **DrawerFilters snapshot tests:** regenerate snapshots after removing the gated section.
- **useRestaurantDetail tests:** add a fixture for a dish with `canonical_ingredient_id` set on options, assert per-option allergen badges still resolve via `canonical_ingredient_allergens` (regression guard for the path we're **not** dropping).

### 6.3 Manual QA

- Open the mobile app, navigate to restaurant detail, open dish-photo modal for a legacy dish — confirm no crash and no visible "Ingredients: (empty)" stub.
- Open the filter drawer — confirm "Ingredients to Avoid" section is gone and the rest of the drawer renders cleanly.
- Hit the feed endpoint with no `flagIngredients` field — response is unchanged.
- Hit the feed endpoint with an in-flight old-client payload that includes `flagIngredients: ['xyz']` — server returns 200, no `flagged_ingredients` in response. Old client tolerates missing field (verified via a build of the previous mobile version against the new server).

---

## 7. Risks

| Risk | Severity | Mitigation |
|---|---|---|
| In-flight mobile clients send `flagIngredients` and expect `flagged_ingredients` back | Low | Server silently ignores unknown request fields. Mobile already defaults `flagged_ingredients` to `[]` if absent — no UI change because the section is gated off. |
| Legacy dishes lose ingredient display in photo modal | Low (per §2.1) | Documented regression; acceptable per recommendation. Reversible by re-adding the query (kept as backout option, see §8). |
| Embedding quality drop for legacy dishes | Low | New dishes already had no ingredient context, so feed ranking on the production cohort is unchanged. Legacy dishes get re-embedded on next name/description edit. Worst case: ~5–15 missing tokens per legacy dish embedding; ranking impact bounded by the embedding model's reliance on text length, which is small for short input shifts. |
| Persisted filter state on existing users includes `flagIngredients` and breaks rehydration | Medium | Bump Zustand persist version, drop the field in the migration handler. Tested via the filterStore migration test. |
| A grep miss leaves a dangling reference to `flagged_ingredients` somewhere | Low | Pre-merge grep for `flagIngredients|flagged_ingredients|EXPO_PUBLIC_INGREDIENT_ENTRY_ENABLED|ingredientService|dishIngredientNames|ingredientDisplay` across `apps/mobile` returns zero hits before merge. |
| Web-portal type mismatch (uses `flagged_ingredients`) | Low | Web-portal is being retired — out of scope. If grep finds web-portal references, leave them; they die when web-portal does. |

---

## 8. Rollback

Phase A is fully reversible by `git revert`. No schema changes, no data deletion, no breaking changes to live request/response contracts (the `flagIngredients` field becomes silently ignored rather than rejected, so old mobile clients continue to work).

To restore the feature wholesale: revert the Phase A commits. To restore selectively (e.g., re-enable photo-modal ingredient display only): cherry-pick the §5.3 photo-modal subset back in.

---

## 9. Sequencing

```
Phase A (this doc, ~1 day)
   │
   ├──→ Dish-model rewrite (Phase 1 → Phase 7, ~4–5 weeks)
   │       Plan: docs/project/dish-model-rewrite-plan.md
   │
   └──→ Phase B (trigger retirement, ~0.5 day, runs after dish-model rewrite ships)
            │
            └──→ Phase C (schema retirement, ~1 day, runs 4–6 weeks after Phase B)
```

Phase A is **not** a dependency of the dish-model rewrite — they can run in either order. The recommendation is "A before rewrite" because:
- Removing dead code first means the dish-model rewrite touches fewer lines per file, reducing review surface and merge-conflict risk.
- The mobile filter drawer (touched by both projects) is cleaner when Phase A has already removed the gated section.
- §3.2 of the dish-model rewrite (enrich-dish) becomes a pure extension instead of an extension-plus-removal.

---

## 10. Acceptance criteria

- `git grep "dish_ingredients" apps/mobile infra/supabase/functions` returns zero hits (excluding migrations).
- `git grep "flagIngredients\|flagged_ingredients\|EXPO_PUBLIC_INGREDIENT_ENTRY_ENABLED\|ingredientService\|ingredientDisplay\|dishIngredientNames"` returns zero hits in `apps/mobile`.
- `pnpm typecheck` passes across the workspace.
- `pnpm test` passes in `apps/mobile` and `infra/supabase/functions`.
- Manual QA per §6.3 passes.
- Feed P95 latency does not regress (no extra round trips were ever serial-blocking, so this is a sanity check, not a hard expectation).
- DB triggers `dish_ingredients_refresh`, `trg_enrich_on_ingredient_change` continue to exist in production (Phase B drops them later).

---

## 11. Appendix — file change summary

### Modified files (server)
- `infra/supabase/functions/enrich-dish/index.ts`
- `infra/supabase/functions/feed/index.ts`

### Modified files (mobile)
- `apps/mobile/src/stores/filterStore.ts`
- `apps/mobile/src/components/DrawerFilters.tsx`
- `apps/mobile/src/config/environment.ts`
- `apps/mobile/src/services/edgeFunctionsService.ts`
- `apps/mobile/src/screens/restaurant-detail/useRestaurantDetail.ts`
- `apps/mobile/src/screens/restaurant-detail/DishPhotoModal.tsx`
- `apps/mobile/src/stores/restaurantStore.ts`
- `apps/mobile/src/utils/menuFilterUtils.ts`
- `apps/mobile/src/services/userPreferencesService.ts`
- `apps/mobile/src/services/geoService.ts` (drops the flagIngredients type + mapping; see §5.3)
- `apps/mobile/src/locales/en.json`
- `apps/mobile/src/locales/es.json`
- `apps/mobile/src/locales/pl.json`

### Deleted files
- `apps/mobile/src/services/ingredientService.ts`
- `apps/mobile/src/lib/ingredientDisplay.ts`
- (Possibly) Ingredient autocomplete component file, if separate from `DrawerFilters.tsx` — confirm during implementation.

### Migrations
- None. No schema changes in Phase A.

### Documentation
- `CLAUDE.md` — small edit: drop the line about flipping `EXPO_PUBLIC_INGREDIENT_ENTRY_ENABLED` to `"true"` (now obsolete; flag no longer exists).

---

## 12. Open questions

1. **§2.1 dish-photo modal decision.** A1 (drop), A2 (keep query), or A3 (drop query keep section)? Default: A1.
2. **Persisted filter store version bump.** What's the current Zustand persist version on `filterStore`? Need to know before writing the migration handler.
3. **i18n key removal cadence.** Are translation keys reviewed by an external translator? If yes, send the removed-keys list ahead of merge so the translator's tracking is in sync.
4. **`apps/web-portal` audit.** Per §1, web-portal is out of scope. But the legacy confirm route writes `dish_ingredients` rows when `NEXT_PUBLIC_INGREDIENT_ENTRY_ENABLED` is on (which it shouldn't be in any deployed environment). Confirm with the user: leave web-portal entirely alone, or one-line disable the writer to make Phase A's "no new ingredient rows" claim airtight?
