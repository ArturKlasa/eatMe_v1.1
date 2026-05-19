# Phase 2 — Backend functions

**Parent plan:** `docs/project/dish-model-rewrite-plan.md`
**Status:** Shipped 2026-05-18
**Last updated:** 2026-05-18
**Estimated wall time:** 3 days
**Reversibility:** Additive output fields — old clients continue working; new fields are optional.

Update `menu-scan-worker` to emit modifier groups + `dining_format` + `bundled_items`, extend `enrich-dish` to include modifier option names in embedding inputs, and rewrite `feed` to surface `effective_*` fields + apply per-user variant selection.

**Ship log:**
- `menu-scan-worker` updated to emit `modifier_groups`, `dining_format`, `bundled_items` alongside the existing `dish_kind` (commit `b48e196`). `dish_kind` kept through the Phase 2→4 window to keep the admin review UI working; Phase 7 drops it once Phase 4 consumes `modifier_groups`. 7 fixture tests added (Pad Thai, Caesar, Pizza S/M/L, build-your-own bowl, tasting menu, buffet, tiered wings) plus a combo-meal `bundled_items` fixture.
- `enrich-dish` extended to union `dish.allergens` with every option's `adds_allergens` for the embedding "Contains: ..." line; `is_parent` skip removed (commit `a6e94ba`).
- `feed` rewritten to consume migration 142's modifier-aware shape: `Candidate` interface extended with `modifier_groups` / `reachable_proteins` / `reachable_protein_families` / `dining_format` / `bundled_items`; scoring uses `reachable_*` for proteinTypes/meatTypes matches; new `selectConfigForUser` step auto-picks one option per required group; response gains `applied_options` + `effective_*` fields; cache key bumped to `feed:v2:` (commit `be6b279`).
- **Deploy notes (carried out by user):** drain `menu_scan_jobs.status='processing'` to zero before deploying the new worker (parent plan risk #7). Worker + feed + enrich-dish can be deployed independently; the parent plan covers order/dependencies in §3.
- **Open items (non-blocking):** Deno test run for the 7 worker fixtures (no Deno in CI yet); end-to-end smoke test of the deployed worker emitting the new schema shape (deferred 2026-05-18 — verification will happen organically on the next admin-triggered menu scan, since `menu-scan-worker` v6 is live at 20:29:29 UTC and any subsequent scan exercises the new code path); shadow-comparison of `feed:v2:` responses vs `feed:v1:` for the same restaurant set (deferred until modifier data exists in Phase 4); worker prompt A/B tooling (parent plan open question #2 still pending).

---

## 1. `menu-scan-worker` rewrite

**File:** `infra/supabase/functions/menu-scan-worker/index.ts`

**Schema changes (Zod):**
```ts
const DINING_FORMATS = ['buffet','course_menu','interactive_table','shared_plates','sampler'] as const;

const modifierOptionSchema = z.object({
  name: z.string(),
  price_delta: z.number(),
  price_override: z.number().nullable(),
  primary_protein: z.enum(PRIMARY_PROTEINS).nullable(),
  removes_dietary_tags: z.array(z.string()),
  adds_allergens: z.array(z.string()),
  serves_delta: z.number().int(),
  is_default: z.boolean(),
});

const modifierGroupSchema = z.object({
  name: z.string(),
  selection_type: z.enum(['single','multiple']),
  min_selections: z.number().int().min(0),
  max_selections: z.number().int().min(1),
  display_in_card: z.boolean(),
  options: z.array(modifierOptionSchema),
});

const bundledItemSchema = z.object({
  name: z.string(),
  note: z.string().nullable(),
});

// Per-dish schema:
// KEEP: dish_kind (until Phase 4 admin UI consumes modifier_groups — see Decision below)
// ADD: dining_format, bundled_items, modifier_groups
```

**Decision 2026-05-18 — keep `dish_kind` during Phase 2→4 window:** the per-phase plan originally said "REMOVE: dish_kind" but the parent plan §1 frames Phase 2 as "additive output fields". The admin review UI (`apps/admin/src/app/(admin)/menu-scan/[jobId]/`) heavily consumes `dish_kind` from `result_json` — removing it would break the review screen for every menu scanned in the window between Phase 2 and Phase 4 ship. Resolution: worker continues emitting `dish_kind` alongside the new fields. Phase 4 migrates the admin UI to consume `modifier_groups`; Phase 7 cleanup drops `dish_kind` from the worker schema and prompt.

**Note on OpenAI Structured Outputs compatibility:** the schema above drops `.default()` (incompatible with OpenAI's strict `required:all` mode) and `.min()/.max()` on strings/arrays. The AI is instructed via prompt to emit empty arrays where the plan called for `.default([])`, and the application code accepts empty arrays as the no-modifier case. Length bounds live at the DB layer (migration 140 + table constraints).

**Prompt update:** replace the `dish_kind` instruction block with:

```
- dining_format: when the listing is a dining EXPERIENCE rather than a regular dish, set to one of:
    'buffet'             — flat-rate unlimited access
    'course_menu'        — multi-course sequenced meal (tasting menus)
    'interactive_table'  — interactive cooking (hot pot, Korean BBQ, fondue)
    'shared_plates'      — small plates for sharing (tapas, dim sum)
    'sampler'            — fixed selection presented as one (mixed grill)
    Otherwise output null.

- bundled_items: when the listing pre-includes items the customer doesn't pick,
    output as [{name, note?}, ...]. Examples: "Burger meal: burger + fries + drink"
    becomes [{name:"burger"},{name:"fries"},{name:"drink"}].

- modifier_groups: extract for every "choose your X", "add Y for $Z", "+$N upgrade",
    "size: S/M/L", protein choice, dressing choice, course choice, etc.
    Required vs optional: set min_selections >= 1 for required groups; min_selections = 0 for optional.
    selection_type: 'single' (one choice) or 'multiple' (many choices).
    display_in_card: set to true ONLY for groups whose selected option meaningfully changes
      the dish identity in a one-line description (e.g. protein choice on Pad Thai → "with chicken").
      Set to false (default) for size choices, dressing choices, drink choices in combos, etc.
      The mobile feed falls back to options with primary_protein set, so leaving this false
      for most groups is safe.
    For each option:
      - price_delta: signed surcharge. 0 if no extra cost.
      - price_override: ONLY for non-linear quantity pricing
        (e.g. "12 wings for $45" → 12-wing option has price_override=45, price_delta=0).
      - primary_protein: if option changes the protein source.
      - removes_dietary_tags: include ['vegetarian','vegan'] when adding meat/fish/dairy
        to a vegetarian base.
      - adds_allergens: shellfish, dairy, eggs, peanuts, etc.
      - is_default: set on the cheapest/standard option in required groups.
```

**Tests:** `infra/supabase/functions/menu-scan-worker/test.ts` — add fixtures for:
- Pad Thai with required protein choice
- Caesar with optional add-ons
- Pizza S/M/L (sizes as required_single with serves_delta)
- Build-your-own bowl (multi-group)
- Tasting menu (dining_format='course_menu' + sequential required groups)
- Buffet (dining_format='buffet' only, no modifier groups)
- Tiered wings ($5/$25/$45 via price_override)

**Deploy concern (drain in-flight jobs):**
- Before deploying the new worker, set worker invocation to halt and let `menu_scan_jobs.status='processing'` rows complete.
- Confirm zero rows with `status='processing'` AND `locked_until > now() - interval '5 min'`.
- Deploy worker.
- Resume admin scan creation.

## 2. `enrich-dish` update

**File:** `infra/supabase/functions/enrich-dish/index.ts`

- Remove the `is_parent=true` skip clause (post-Phase 6, no parents exist; pre-Phase 6, parents still get skipped harmlessly via the legacy filter).
- Extend embedding-input construction to include modifier option names:
  ```ts
  const optionNames = dish.option_groups?.flatMap(g => g.options.map(o => o.name)) ?? [];
  const embeddingInput = `${dish.name}. ${dish.description ?? ''}.
    Options: ${optionNames.join(', ')}.
    Cuisine: ${restaurant.cuisine_types.join(', ')}.`;
  ```
- Allergen union for embedding context: `dish.allergens` ∪ all `option.adds_allergens`.

## 3. `feed` function rewrite

**File:** `infra/supabase/functions/feed/index.ts`

**Key changes:**
1. `Candidate` interface gains `modifier_groups: jsonb`, `reachable_proteins: string[]`, `reachable_protein_families: string[]`, `dining_format`, `bundled_items`.
2. Stage 2 scoring uses `reachable_proteins` (base + option `primary_protein` values) and `reachable_protein_families` (CASE-derived) for daily `meatTypes` / `proteinTypes` matches. Base dish's `protein_canonical_names` is still consulted for fine-grained subtype precision; modifier-option matches coarsen to family-level via `primary_protein`. See `phase-1-database.md` §3 protein design decision.
3. Each applied option carries `group_display_in_card` (joined from `option_groups.display_in_card`) so the feed card knows whether to include this option in the dish-name suffix.
4. **New step `selectConfigForUser`** runs after scoring, before diversification:

```ts
type AppliedOption = {
  option_id: string;
  group_name: string;
  group_display_in_card: boolean;   // from option_groups.display_in_card
  name: string;
  primary_protein: string | null;   // null when this option doesn't set protein
  price_delta: number;
};

function selectConfigForUser(
  dish: Candidate,
  filters: FeedRequest['filters'],
  userAllergens: string[],
): {
  applied_options: AppliedOption[];
  effective_price: number;
  effective_primary_protein: string;
  effective_dietary_tags: string[];
  effective_allergens: string[];
} {
  const applied: AppliedOption[] = [];
  let proteinOverride: string | null = null;
  const tagsRemoved = new Set<string>();
  const allergensAdded = new Set<string>();
  let totalDelta = 0;
  let overridePrice: number | null = null;

  const groups = (dish.modifier_groups as ModifierGroup[]) ?? [];
  for (const group of groups.sort((a,b) => a.display_order - b.display_order)) {
    if (group.min_selections < 1) continue; // optional groups: default to "not applied"

    // Filter to options that pass user's hard constraints
    const candidates = group.options.filter(opt => {
      if (opt.adds_allergens?.some(a => userAllergens.includes(a))) return false;
      if (filters.dietPreference === 'vegetarian' && opt.removes_dietary_tags?.includes('vegetarian')) return false;
      if (filters.dietPreference === 'vegan' && opt.removes_dietary_tags?.includes('vegan')) return false;
      return true;
    });
    if (candidates.length === 0) continue; // dish should already be filtered out by required_groups_safe

    // Score within survivors (option-level matches use primary_protein only — see phase-1-database §3)
    const scored = candidates.map(opt => {
      let s = 0;
      if (opt.primary_protein === filters.primaryProtein) s += 100;
      if (opt.primary_protein && filters.meatTypes?.includes(opt.primary_protein)) s += 50;
      if (matchesDailyProteinFamily(opt, filters.proteinTypes)) s += 30;
      s -= opt.price_delta * 0.5; // tie-break: cheaper wins
      if (opt.is_default) s += 1;
      return { opt, s };
    });
    scored.sort((a,b) => b.s - a.s);
    const winner = scored[0].opt;

    applied.push({
      option_id: winner.id,
      group_name: group.name,
      group_display_in_card: group.display_in_card,
      name: winner.name,
      primary_protein: winner.primary_protein ?? null,
      price_delta: winner.price_delta,
    });
    if (winner.primary_protein) proteinOverride = winner.primary_protein;
    winner.removes_dietary_tags?.forEach(t => tagsRemoved.add(t));
    winner.adds_allergens?.forEach(a => allergensAdded.add(a));
    if (winner.price_override !== null) overridePrice = winner.price_override;
    else totalDelta += winner.price_delta;
  }

  const effective_price = overridePrice ?? (dish.price + totalDelta);
  return {
    applied_options: applied,
    effective_price,
    effective_primary_protein: proteinOverride ?? dish.primary_protein!,
    effective_dietary_tags: dish.dietary_tags.filter(t => !tagsRemoved.has(t)),
    effective_allergens: [...new Set([...dish.allergens, ...allergensAdded])],
  };
}
```

5. Response shape gains `applied_options`, `effective_price`, `effective_primary_protein`, `effective_dietary_tags`, `effective_allergens`, `dining_format`, `bundled_items`.
6. `applyDiversity`: keep `parent_dish_id` special-case during transition; remove in Phase 7.
7. **Cache invalidation**: bump cache key version to `feed:v2:` so old cached responses without `applied_options` are not returned.

## 4. Acceptance criteria

- Worker emits a Pad Thai-with-protein test fixture cleanly into the new shape.
- `enrich-dish` runs on every existing dish without errors; embeddings re-computed for dishes that now have modifier-context inputs.
- Feed returns `effective_*` fields. For dishes with no modifier groups, `effective_price === dish.price` and `applied_options === []`.
- Old mobile clients (which don't read `applied_options`) see no behavioural change.

## 5. Effort: 3 days

1d worker + prompt + tests, 0.5d enrich-dish, 1.5d feed (including the variant-selection step and benchmarking the JSON aggregation path).
