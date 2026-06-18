# Mobile UX Fixes — Batch 2

Filters, onboarding personalization, hard price cap, i18n, and sheet sizing.
Sibling to `docs/plans/mobile-ux-fixes-batch.md` (batch 1).

## Locked decisions

1. **Daily filter button label** → "Customize Your Cravings" (distinct from the permanent "Personal Preferences").
2. **i18n** → wire existing keys + add 3 missing keys; standardize the diet emoji on 🥗.
3. **Onboarding** → (A) sync diet to permanent filter + soft-boost the unused taste fields, then (B) seed a cold-start preference vector. **Both this session, A first.**
4. **Daily max price** → convert from soft boost to **hard filter**, per-currency sentinels, null = no bound.
5. **Mexico price slider** → `{ min: 50, max: 250, step: 25, sliderMax: 250 }`.
6. **Greyed-out dishes** → split the restaurant menu into "For you (N)" + collapsed "Other dishes (M)".
7. **Permanent filters sheet** → FiltersScreen-scoped height cap (~60%); do NOT edit shared `modalScreenStyles`.

---

## Item 1 — Rename daily filter button

- **Key:** `mapFooter.filterButton` in `apps/mobile/src/locales/{en,es,pl}.json`.
- **New values:**
  - en: `🥢 Customize Your Cravings`
  - es: `🥢 Personaliza tus antojos`
  - pl: `🥢 Dopasuj swoje smaki`
- Pure value change; `MapFooter.tsx:112` already reads the key. No logic.

## Item 2 — Translation wiring

- `DrawerFilters.tsx:56` — replace hardcoded `🥗 Diet Preference` with `t('filters.dietPreferenceTitle')`; update that key's value to use 🥗 (currently 🥕) in all 3 locales for consistency with the daily modal.
- `DrawerFilters.tsx:73` — replace `option.charAt(0).toUpperCase()+slice(1)` with `t('filters.dietOption.${option}')` (keys exist).
- `RootNavigator.tsx` stack titles — wire existing keys: `ViewedHistory`→`profile.viewedHistory`, back-titles→`common.back`/`common.cancel`, `CreateSession`→`eatTogether.createSessionTitle`, `JoinSession`→`sessionJoin.title`, `VotingResults`→`votingResults.title`.
- **Add 3 new keys** to en/es/pl: `sessionLobby.waitingRoom` ("Waiting Room"), `eatTogether.recommendationsTitle` ("Restaurant Recommendations"), `onboarding.completeProfile` ("Complete Your Profile"). Wire the SessionLobby / Recommendations / Onboarding screen titles.
- **Wording shifts to accept:** `eatTogether.createSessionTitle` = "Create Eat Together **Session**" (vs hardcoded "Create Eat Together"); `votingResults.title` carries a 🎉. Both fine.
- **Caveat:** stack `title:` is evaluated at navigator-render, so it won't react to a *mid-session* language switch. Acceptable today (language set at startup). Not over-engineering.

## Item 3 — Onboarding: filters + recommendations

Personalization today is interaction-only: `user_behavior_profiles.preference_vector` is averaged from liked/saved/viewed dish embeddings. New users = no vector = cold start. `favorite_cuisines`/`spice_tolerance` are server-read and lightly boost; **`favorite_dishes`/`protein_preferences` are write-only**. Onboarding diet is not directly synced to `permanent.dietPreference` (only transitively via the shared DB column, with a dual-writer race).

### Phase A (first)
1. **Diet sync** — in `onboardingStore.ts` `completeOnboarding()`, after the upsert, call `useFilterStore.getState().setPermanentDietPreference(formData.dietType)`. Immediate, race-free. (Action at `filterStore.ts:516`; `dietType` and `DietPreference` are the same `'all'|'vegetarian'|'vegan'` union.) Use a lazy `require`/`getState()` to avoid an onboarding→filter import cycle (mirrors how `filterStore` lazily imports `authStore`).
2. **Soft-boost the unused fields** in the feed:
   - `feed/index.ts` ~735 — also read `protein_preferences`, `favorite_dishes` from `user_preferences` (alongside `spice_tolerance`/`favorite_cuisines`).
   - Thread both into `userPrefs` (~818-822) → `rankCandidates`.
   - In `rankCandidates`, mirror the `favoriteCuisines` block (~329-332):
     - `favorite_dishes` → +0.1 if dish `name` matches a favorite label (case-insensitive contains).
     - `protein_preferences` → +0.1 if dish `primary_protein`/family ∈ preferred set. (Collected only when dietType='all', so it's a positive taste signal, not an exclusion.)
3. **Soften the gate** — `OnboardingStep2Screen.tsx:225` min-2-cuisine "Complete" gate → lower to 1 (or make optional). *(Minor; confirm.)*

### Phase B (after A, this session)
- **Seed a cold-start preference vector** from onboarding favorites so semantic recs work from day one. Reuse existing machinery (`enrich-dish` embeddings + `update-preference-vector` averaging).
- New edge function `seed-preference-vector` (or extend `update-preference-vector` with a seed mode): on completeOnboarding, build a vector from the user's `favorite_dishes`/`favorite_cuisines` and upsert `user_behavior_profiles.preference_vector`.
- **Label→embedding strategy (decide at impl):** average embeddings of existing dishes whose name/cuisine match the favorites (preferred — stays in the same vector space as dish embeddings), falling back to embedding the label text via `text-embedding-3-small`.
- Real interactions later override the seed via the existing `update-preference-vector` cron.

## Item 4 — Hard daily max-price filter

- **Contract:** `priceRange?: [number | null, number | null]` (null = no bound) in **both** `FeedRequest` interfaces — `edgeFunctionsService.ts:72` (client) and `feed/index.ts:97` (server). No shared type; edit both.
- **Client** (`edgeFunctionsService.ts` `buildFilters`, ~189): thread `currency` in; compute `[ atFloor ? null : min, atCeiling ? null : max ]` using `getPriceRangeForCurrency(currency)` floor/ceiling. Omit `priceRange` entirely if both null.
- **Server** (`feed/index.ts`): delete hardcoded `SLIDER_MIN=10/SLIDER_MAX=50` (227-228) and the soft +0.08 boost (264-274). Add a **hard pre-rank filter** dropping candidates outside `[min,max]` (null bounds skipped).
- **Caveats (accepted for v1):**
  - Filters on base `price`; cards display `effective_price` (default options applied, computed post-rank). Small gap possible. Escalation = compute effective price earlier.
  - Candidate cap (LIMIT 200 in `generate_candidates`, migration 169) is applied before price filtering → low-cap thinning risk. Mexico ≤250 covers most dishes → low risk. Escalation = push price bound into `generate_candidates` SQL.

## Item 5 — Mexico price slider bounds

- `packages/shared/src/logic/currency.ts` `CURRENCY_CONFIG.MXN.priceRange`: `{ min: 100, max: 500, step: 50, sliderMax: 2000 }` → **`{ min: 50, max: 250, step: 25, sliderMax: 250 }`**.
- Floor 50 + ceiling 250 also become the default selected range (= no price filter by default; badge count stays 0). Only the mobile slider consumes this.

## Item 6 — Restaurant menu: "For you / All" toggle (revised)

Today: `DishMenuItem.tsx:87-102` applies `opacity:0.35` + "Not For You" pill to non-matching dishes (predicate = `classifyDish()` in `menuFilterUtils.ts`). With 1–2 matches the whole menu greys out.

**Why NOT a global two-section split:** the menu is **menu → category → dishes**, rendered through a virtualized flattened-row `FlatList` (`FoodTab.tsx`, `MenuRow` union). Matching dishes are **already** sorted to the top of each category by `sortDishesByFilter` (`menuFilterUtils.ts:90`, applied at `FoodTab.tsx:135`). A global "For you / Other dishes" split would destroy the category headers (Tacos / Drinks / Desserts) — a regression.

**Revised approach — a top-of-tab toggle that respects categories:**
- Add a segmented control at the top of `FoodTab`: **"For you" | "All"**.
  - **For you** — `rows` memo filters out dishes where `!passesHardFilters`, and drops categories left empty. Kills the grey wall; the 1–2 matches show under their real category headers.
  - **All** — current behavior (everything shown; non-matching greyed + sorted last).
- **Default:** "For you" *when the user has active permanent hard filters AND ≥1 dish doesn't match*; otherwise "All". Show a count, e.g. "Showing 2 for you · See all (30)".
- Implementation rides the existing `rows` `useMemo` (just a filter pass + empty-category drop) + one `useState` toggle. `DishMenuItem`'s existing dim/pill stays for "All" mode.
- New i18n keys: `restaurant.forYou`, `restaurant.showAll`, plus a count string.
- **Open sub-decision:** default to "For you" (hides the wall on open, my rec) vs. default "All" with the toggle as opt-in.

## Item 7 — Permanent filters sheet height

`modalBase.modalContainer` is `height: '100%'` (confirmed `bases.ts`), spread into `modalScreenStyles` and shared by Profile/Settings/Favorites/EatTogether (all want full height). **Do not edit the shared base.**

- **`FiltersScreen.tsx`** — pass a style array `[modalScreenStyles.modalContainer, { height: '55%' }]`. A later array entry reliably overrides the earlier `'100%'` (no `undefined`-override fragility).
- **Keep `DrawerFilters.tsx` container `flex:1`** — with a fixed-height (55%) parent the inner ScrollView stays bounded and scrolls if the (few) filters ever overflow. Do NOT drop `flex:1` (would collapse the ScrollView).
- Fixed 55% reads as "about bottom half" per the request and is robust regardless of content height. On-device verification still wanted.

---

## Execution order

- **Phase 1 — low risk:** #5 (currency), #2 (i18n), #1 (label), #7 (sheet height).
- **Phase 2 — price:** #4 (client + server contract, hard filter).
- **Phase 3 — menu:** #6 (section split).
- **Phase 4 — onboarding:** #3A (diet sync + soft boosts + gate), then #3B (seed vector).

Type-check (`npx tsc --noEmit`) + eslint after each phase. Edge-function changes (#4 server, #3 boosts, #3B) need redeploy from `infra/supabase/`; #3B may need a backfill for existing users. Device rebuild/verification by user (visual items #1, #6, #7).
