# Menu-scan: ingredients-as-bundled-items + category over-splitting

Implementation plan for two operator-reported menu-scan issues (2026-06-17).
Nothing here is implemented yet — each part gets explicit go-ahead before work
starts. (Operator issue #1 "grams doubled in description" is **deferred** — no
example yet. Issue #4 "pick which modifier group to copy" is a separate plan.)

Key files:
- Worker / prompt: `infra/supabase/functions/menu-scan-worker/index.ts`
  - `buildExtractionPrompt` — `bundled_items` block ~373–386, `suggested_category_name`
    block ~423–430, `canonical_category_slug` block ~431–437
  - `resolveCategorySlugCollisions` deterministic backstop ~625–655, called in
    `runExtraction` ~811
- Worker tests: `infra/supabase/functions/menu-scan-worker/test.ts`
- Review UI: `apps/admin/src/app/(admin)/menu-scan/[jobId]/ReviewDishEditor.tsx`
  + `useReviewState.ts`
- Review-state tests: `apps/admin/src/__tests__/menu-scan/useReviewState.test.ts`
- Confirm RPC: migration `146_admin_confirm_menu_scan_portion_size.sql`
  (`admin_confirm_menu_scan`) — **no change needed**

Both worker-prompt edits (#2 and #3-A) ship in **one** `menu-scan-worker` deploy.
The review-UI change (#3-B) ships with the `apps/admin` app. No DB migration, no
RPC change, no schema change.

---

## #2 — Ingredients misclassified as `bundled_items`

**Symptom.** Ingredients in a dish description (e.g. "preparados con tocino y
chorizo") are extracted as `bundled_items` rather than left in the description.

**Root cause.** Classification is **100% prompt-driven** — `index.ts:373–386`
already distinguishes *inclusion* language ("served with fries" → bundled) from
*composition* language ("con tocino" → description), with examples. There is **no
deterministic backstop**, and at `reasoning_effort: 'low'` the model still
misfires on ambiguous wording. This is a precision problem: the model needs a
firmer default and a sharper definition of what *qualifies* as a bundled item.

**Fix — prompt hardening only.** Rewrite the `bundled_items` block to (a) define a
bundled item as a **separately-nameable dish/drink served alongside** (a side, a
drink, a dessert — something that could be its own menu line), (b) state
explicitly that an ingredient / sauce / spice / marinade / topping / cooking
method is **never** a bundled item, and (c) add a hard **default-to-description
when unsure** rule plus one more sauce example.

Replace `index.ts:373–386` with:

```
- bundled_items: SEPARATELY-NAMEABLE items served ALONGSIDE the dish that the customer
    does NOT pick from a list — a side, a drink, a dessert, a soup, bread, a salad that
    comes with the dish. Use this ONLY for combo meals and fixed accompaniments.
    A bundled item must be a dish or drink in its own right (something that could appear on
    its own menu line). An INGREDIENT, sauce, spice, marinade, topping, dressing, or cooking
    method is NOT a bundled item — it stays in the description and nowhere else.
    Decide by the WORDING, and WHEN UNSURE DEFAULT TO description (leave it out of bundled_items):
      - Accompaniment language → bundled_items:
        "includes side salad", "served with fries", "viene con papas",
        "incluye arroz y frijoles", "+ papas y refresco".
      - Composition / preparation language → description ONLY, never bundled_items:
        "preparados con tocino y chorizo", "a base de maíz", "con salsa de chipotle",
        "topped with cheese", "marinated in garlic" — what the dish is MADE OF is not bundled.
    Examples:
      "Burger meal: burger + fries + drink" → [{"name":"burger","note":null},{"name":"fries","note":null},{"name":"drink","note":null}]
      "Steak frites (includes side salad)"  → [{"name":"side salad","note":null}]
      "Tacos preparados con tocino y chorizo" → [] (tocino/chorizo are ingredients — keep in description)
      "Pollo a la parrilla con chimichurri"  → [] (chimichurri is a sauce — keep in description)
    Output an empty array [] when the dish has no bundled items. Each item is {name, note?}.
    Do NOT use bundled_items for customer choices — use modifier_groups for those.
```

**Tests.** Prompt wording is not unit-testable (worker tests mock the model
output, they don't exercise the prompt). The existing `test.ts` bundled-items
fixtures (`'fixture: combo meal with bundled_items'`, line ~1565; the
no-bundled assertion at ~1510) don't assert on prompt text and stay green. No
new automated test — verified by **real-menu smoke** (below).

**Effort.** ~15 lines of prompt + one worker deploy. No code-path change.

**Risk — the failure mode is asymmetric (this is the headline risk of #2).** The
fix biases the model toward "leave it in the description." The new wrong-direction
is therefore **missing a real bundled side on a combo meal** (a `menú del día`
with included sides/drink whose items now stay in prose) — which is worse for the
customer than an extra ingredient line, because the included items never become
structured `bundled_items`. So smoke MUST include a combo / `menú del día` with
real included sides, not just ingredient-heavy single dishes. A deterministic
backstop is **not feasible** (ingredient-vs-side is semantic, not regex-able); the
existing safety net is that `bundled_items` stay operator-editable in review.

---

## #3 — Scan over-splits categories / doesn't follow the menu's structure

**Symptom.** The scan creates **more** menu categories than the menu actually
prints — it splits one printed section into several, instead of reproducing the
menu's own section structure. (Confirmed: on a fresh scan the restaurant has **no**
pre-existing categories — *the scan creates them* — so there is nothing to "map
onto"; the menu image itself is the source of truth for the category list.)

**Root cause — a pendulum from a prior fix.** Commit `15b623d` ("never merge two
printed sections", operator issue #1) deliberately pushed the model toward
*splitting* to stop the opposite failure (distinct sections merging — "Tostadas"
swallowed by "Entradas"). It added:
1. **Prompt pressure to split** (`index.ts:423–430`): *"check whether a new header
   (often small, stylized, or ALL-CAPS text) is printed between the two dishes …
   Every distinct printed header starts its own section: NEVER merge."* This makes
   the model hunt for section boundaries and treat decorative/dish-level text as
   headers → invented sections.
2. **A deterministic backstop** `resolveCategorySlugCollisions` (`index.ts:625–655`):
   if two **differently-spelled** headers claim the same canonical slug, the later
   one **loses its slug** and falls back to a custom category. Combined with
   **per-page extraction** (one OpenAI call per image — see `runExtraction`), the
   *same* real section spelled slightly differently across pages (OCR/transcription
   variance: "Entradas" vs "Entrantes") fragments into two categories.

Since the scan now *creates* the categories and the operator reviews before
confirm, the fix is two-pronged: make the model **faithful to the printed
structure** (reduce invented boundaries) and give the operator a **one-click way
to consolidate** the residual. We deliberately **keep** the collision backstop —
it still prevents the issue-#1 merge regression; the new review-side merge handles
the over-split it can cause.

**Considered and rejected — a cross-page consolidation pass.** A second LLM call
("here are all section names extracted across every page; group the duplicates")
would attack the cross-page fragmentation at its root instead of leaving it to the
operator. Rejected for v1: it adds a serial round-trip of latency and cost on
every scan, and introduces a *new* failure mode (the consolidator wrongly merging
two genuinely-distinct sections — reviving issue #1, but now silently and
server-side where the operator can't see it). The review-side merge (#3-B) is
deterministic, operator-visible, and reversible, so it is the safer default; the
consolidation pass stays on the shelf if manual merge proves too tedious in
practice.

### #3-A — Prompt recalibration (worker)

Rewrite `index.ts:423–430` (`suggested_category_name`) to reproduce the menu's own
grouping and stop inventing finer sections, while still keeping genuinely-distinct
printed section titles separate (so issue #1 doesn't regress):

```
- suggested_category_name: the menu SECTION this dish belongs to, written exactly as it
    appears on the menu (verbatim, in the source language). A section header is a TITLE that
    introduces a GROUP of dishes (e.g. "Entradas", "Tacos", "Postres", "Bebidas") — usually
    set apart in larger, bolder, or differently-styled type and followed by several dishes.
    Reproduce the menu's OWN section structure: assign each dish to the nearest section title
    printed above it, and carry that SAME title forward to every following dish until the next
    section title appears. Do NOT invent finer sections than the menu shows — a dish name, a
    price line, a tagline or subtitle, an item descriptor, or a single emphasized dish is NOT a
    section header. Prefer matching the menu's visible grouping over splitting. Only start a NEW
    section when the text is clearly a group title for the dishes beneath it; when it is, keep it
    separate from the previous section (do not merge two clearly-distinct printed section titles).
    Null if the dish sits under no section header.
```

Leave the `canonical_category_slug` block (`index.ts:431–437`) and
`resolveCategorySlugCollisions` **unchanged** — both still guard against
distinct-section merges.

The surgical cut here matters: we **keep** the recognition cue ("larger, bolder,
or differently-styled type") so subtle-but-real headers are still caught, and only
remove the old "check between the two dishes" per-pair hunting pressure that drove
over-splitting. That threads between over-split and the issue-#1 under-merge — but
prompt tuning is empirical, so it needs an explicit **regression check, not just a
caveat**: smoke MUST re-scan the original issue-#1 menu (the "Tostadas printed
after Entradas" case) and confirm those stay two sections, **alongside** the
over-split menu that motivated this change. If the rewrite over-corrects toward
#1, tighten the "clearly a group title" clause rather than removing the backstop.

**Tests.** Prompt-only; the collision-backstop test (`test.ts` ~716–754) asserts
behavior of the *code*, not the prompt text, and stays green. No new automated
test for the prompt — verified by the two-menu smoke above.

### #3-B — Review-side section merge (admin UI)

Give the operator a per-section **"Merge into …"** control so an over-split
section collapses in one action, instead of reassigning every dish individually
via the existing per-dish category combobox.

**`useReviewState.ts` — new pure reducer + hook method.** Add next to
`applyCopyModifierGroups`:

```ts
// Reassign every dish in a scanned category group to another category, so the
// operator can collapse an over-split section in one action (the scan sometimes
// splits one printed menu section into several — operator category issue).
export function applyMergeCategory(
  dishes: EditableDish[],
  dishIds: string[],
  categoryPatch: Pick<
    EditableDish,
    'categoryMode' | 'categoryExistingId' | 'categoryCanonicalSlug' | 'categoryCustomName'
  >
): EditableDish[] {
  const ids = new Set(dishIds);
  if (ids.size === 0) return dishes;
  return dishes.map(d => (ids.has(d._id) ? { ...d, ...categoryPatch } : d));
}
```

In `useReviewState`, expose:

```ts
const mergeCategory = (
  dishIds: string[],
  categoryPatch: Parameters<typeof applyMergeCategory>[2]
) => setDishes(prev => applyMergeCategory(prev, dishIds, categoryPatch));
```

and return it.

**`ReviewDishEditor.tsx` — section-header control.** In the section `<header>`
(next to the "Select all" button, ~722–732), for every group that is **not**
`'none'` when **>1** group exists, render a small `<select>`:

- Label: "Merge into …".
- Options: the `displayName` of every **other** group in `groups` (computed via
  the existing `getGroupMeta(otherKey).displayName`), excluding self and `'none'`.
- On change to `targetKey`, build the target's category fields from a
  representative dish (all dishes in a group share these) and apply them to every
  active dish in this group:

```ts
function groupCategoryPatch(targetKey: string) {
  const rep = dishes.find(d => getGroupKey(d) === targetKey);
  if (!rep) return null;
  return {
    categoryMode: rep.categoryMode,
    categoryExistingId: rep.categoryExistingId,
    categoryCanonicalSlug: rep.categoryCanonicalSlug,
    categoryCustomName: rep.categoryCustomName,
  };
}

function handleMergeGroup(sourceKey: string, targetKey: string) {
  const patch = groupCategoryPatch(targetKey);
  if (!patch) return;
  const ids = dishes
    .filter(d => !d._deleted && getGroupKey(d) === sourceKey)
    .map(d => d._id);
  mergeCategory(ids, patch);
}
```

**Behavior notes (by design, call out in PR):**
- After a merge the source group key vanishes (its dishes now carry the target
  key), so the section disappears and the dishes render under the target. The
  source group's `categoryDescriptions` entry becomes orphaned and is naturally
  dropped on confirm (`handleSave` only emits descriptions for group keys present
  in active dishes). If the source had a description and the target did not, that
  description is lost — acceptable; the operator can re-type it on the target.
- Merge operates on **active** dishes only; deleted dishes keep their own key
  (consistent with how `selectedActiveIds` filters deleted dishes elsewhere).
- No server contract change: each merged dish carries the target's
  `categoryMode`/fields, which `handleSave` already encodes and the confirm RPC
  already deduplicates (canonical slug or case-insensitive custom name).

**Tests — `useReviewState.test.ts`.** Add an `applyMergeCategory` block:
- merges all dishes in a group into a `'custom'` target → every source dish gets
  the target's `categoryMode`/`categoryCustomName`; non-group dishes untouched;
- merge into a `'canonical'` target sets `categoryCanonicalSlug` and clears the
  custom name fields per the patch;
- empty `dishIds` is a no-op (returns the same logical result).

**Effort.** Small, client-only: ~10-line reducer + ~25-line UI control + unit
tests. No worker/DB involvement.

---

## Rollout

Build order is **#3-B first** — it is deterministic, unit-tested, and useful no
matter how the model behaves, so it de-risks the empirical prompt work that
follows.

1. **Admin (#3-B)** — implement the reducer + UI, `cd apps/admin && npx vitest
   run src/__tests__/menu-scan` (green), then deploy the admin app.
2. **Worker (#2 and #3-A) — as TWO SEPARATE COMMITS, one prompt change each.**
   Prompt tuning is empirical; keeping them separate means either change can be
   reverted independently if the two-menu smoke (below) shows one regressed while
   the other is fine. Then deploy `menu-scan-worker` once from `infra/supabase/`
   (`supabase functions deploy menu-scan-worker`) and confirm the version bumps.
   Run `deno test --node-modules-dir=none -A
   infra/supabase/functions/menu-scan-worker/test.ts` (expected: all green — no
   test asserts prompt text).

The worker and admin changes don't depend on each other; only the
two-prompt-commit discipline within step 2 is required.

## Verification (operator smoke, on a real menu)

- **#2 (two directions).** (a) Ingredient prose ("…preparados con tocino y
  chorizo", "…con chimichurri") stays in the **description**, not `bundled_items`.
  (b) **Required:** a combo / `menú del día` with real included sides/drink still
  produces correct `bundled_items` — this is the asymmetric-bias risk and the one
  most likely to regress.
- **#3-A (two menus, regression-gated).** (a) The over-split menu that motivated
  this change now groups into the menu's **printed** sections (count and names),
  no invented sub-sections. (b) **Required regression:** the original issue-#1
  menu ("Tostadas after Entradas") still comes back as two separate sections.
- **#3-B** — when the scan still over-splits one section, "Merge into …" on the
  stray section moves all its dishes into the intended section in one click; the
  stray section disappears and confirm creates the consolidated category.

## Risks / notes

- **#3-A vs issue #1.** The reworded prompt keeps "do not merge two
  clearly-distinct printed section titles" and leaves `resolveCategorySlugCollisions`
  intact, so the issue-#1 merge regression stays guarded. The net shift is *fewer
  invented boundaries*, not *more merging*. If smoke shows #1 creeping back,
  tighten the "clearly a group title" clause rather than removing the backstop.
- **Per-page extraction is unchanged**, so cross-page same-section-different-
  spelling can still fragment occasionally — that residual is now a one-click
  review-side merge instead of a manual per-dish reassignment.
- Prompt changes can't be locked down by unit tests; the worker test suite only
  covers deterministic post-processing. Real-menu smoke is the gate.
</content>
</invoke>
