# Idea Honing — Requirements Clarification

_Rough idea: Improve the restaurants and dish ingestion, including the web-portal menu-scan review page._

---

## Q1 — Scope of this cycle

The rough idea spans three sizeable areas that could easily be separate projects:

1. **Restaurant ingestion** (Google Places import flow, dedup, quality flags)
2. **Dish ingestion pipeline** (AI extraction quality, enrichment, Kind taxonomy redesign, DB modeling)
3. **Menu-scan review page** (UI/UX rework, state management, testability)

Each could be 1–3 weeks of work depending on depth. Which of these do you want to tackle in this cycle?

**Options:**
- A) All three, but shallow — surface-level improvements across the board
- B) All three, deep — and accept a large multi-week scope
- C) Focus on ONE area deeply (which one?)
- D) Focus on TWO areas deeply (which two?)
- E) Different cut — tell me how you'd like to slice it

**Answer:** D — focus on two areas deeply: (2) Dish ingestion pipeline and (3) Menu-scan review page. Restaurant ingestion is out of scope for this cycle.

---

## Q2 — Which real-world menu structures are you actually hitting?

To ground the Kind taxonomy redesign in concrete needs, I want to know which of the missing patterns have actually bitten you in the field.

From research I identified these gaps. Which of these do you hit **often enough** that we need to model them properly this cycle?

1. **Prix-fixe / tasting menu with sequenced courses** (e.g., "3-course tasting: starter → main → dessert, $65")
2. **Prix-fixe with choice-per-course** ("starter: soup OR salad; main: fish OR steak; dessert")
3. **Family-style / sharing platters** with mix-and-match ("pick 3 proteins + 2 sides + 1 sauce, serves 4")
4. **Buffet / AYCE** — true flat-rate access (not currently a distinct kind; shoehorned into `experience`)
5. **Kids menu** as a first-class concept (audience/age group)
6. **Happy-hour / time-based dish pricing** (dish-level price overrides within a window)
7. **Seasonal / date-ranged availability** (e.g., "Oct 1 – Nov 15 only")
8. **Brunch / daypart categorization** beyond simple menu-level time windows
9. **Beverage structures** — wine by glass/half/full/magnum, tasting flights, bottle service
10. **Build-your-own with dynamic base pricing** ("chicken is base, beef +$2, fish +$5")
11. **Something else** I didn't list

Please tell me which numbers are "often hit" (must model), which are "occasional" (nice to have), and which are "rare / skip for now." Freeform is fine — no need to go item-by-item if a few are dominant.

**Answer:** Must-model: 1, 2, 3, 4, 9, 10. Out of scope this cycle: kids menu (5), happy-hour/time-based pricing (6), seasonal/date-ranged availability (7), daypart categorization (8).

---

## Q3 — Review page: top daily pain points

You said the menu-scan review page needs a UI/UX rework. Before I propose a redesign, I want your direct view on where the friction actually is when you use it.

From code inspection, I see candidate pain points below. Please rank the **top 2–3** that hurt most in practice (or name a pain I missed):

- **A) Density / scrolling** — long menus force endless scrolling; no section collapse memory, no virtualization, hard to find a specific dish
- **B) Variant / parent-child workflow** — grouping dishes into variants, accepting AI-proposed groups, ungrouping wrong ones, adding new variants
- **C) Kind selection + price-field hiding** — changing to "combo" silently hides the price input, unclear auto-patching of `display_price_prefix`
- **D) Ingredient editing** — modal fatigue (AddIngredient + InlineSearch + SubIngredientEdit overlap), clunky for bulk dishes
- **E) Image ↔ parsed comparison** — can't easily look at the source image region that produced a parsed dish; AI errors are hard to spot-check
- **F) Flagged duplicates** — the "similar dish in DB" flow is opaque (no "why flagged", hard to decide accept/reject)
- **G) Restaurant details form integrated into review** — context switching between dish editing and restaurant metadata on the same page
- **H) No keyboard shortcuts / slow with mouse only** — bulk review is tedious
- **I) Warnings / errors not actionable** — you see a warning but no clear "click to fix"
- **J) Mobile / narrow viewport** — unusable on small screens
- **K) Saving feels risky** — no preview/diff of what will be written to DB; no undo after save
- **L) Something else**

**User addendum to Q2:** Supplied a longer in-house menu-pattern taxonomy (11 core patterns + ~20 edge/combined patterns) as additional design input. Saved to `research/user-taxonomy-proposal.md`. The must-model list from Q2 still stands as scope for this cycle; the broader taxonomy informs the Kind redesign approach.

**User deferred answer to Q3:** asked me to research and propose.

**Claude's proposed answer to Q3 (top 3 pain points, with reasoning):**

### #1 — Image ↔ parsed comparison is broken (E)
The core value of this page is *verifying* AI output. Admin looks at an extracted dish and needs to answer "did the AI get this right?" Current UI:
- Images live in a carousel in the left panel — **one image at a time**.
- Parsed dishes live in a nested tree in the right panel.
- **There is no per-dish source linkage.** `pageIndex` exists in the merge logic but only as a category placeholder ("Uncategorized (page 3)") — individual dishes don't carry a `source_page` or `source_region` field anywhere. Verified: `lib/menu-scan.ts:599-687`; no such field in `EditableDish` (`lib/menu-scan.ts:117-139`).
- Effect: to verify a dish, admin must hunt the carousel, find the relevant page, mentally compare. This is the dominant friction because it breaks the core workflow on every dish.

### #2 — Variant/parent-child + Kind/price-hiding (B + C, tightly coupled)
Given Q2's must-model list (prix-fixe, family-style, AYCE, BYO dynamic pricing, beverage sizes), this area is about to get more central, not less. Current pain:
- Combo kind **silently hides the price input** (`DishEditPanel.tsx:91: {!isCombo && ...}`). Admins who entered a price see it "disappear" on kind change.
- Adding a variant by hand is a recent addition (`useReviewState.ts:229: addVariantDish`) and the UX is clunky per the git-WIP state.
- AI-proposed variant groupings show no rationale, and ungrouping is a one-way action.
- Kind selector auto-patches `is_parent` + `display_price_prefix` with no explanation (`DishEditPanel.tsx:98-113`).
- Effect: reorganizing AI output into the correct Kind/variant structure is slow and error-prone. Directly coupled to the Kind redesign.

### #3 — Saving feels risky + density (K + A, tightly coupled)
Long menus produce long reviews; there's no safety net. Confirmed:
- **No draft persistence** — no `localStorage`/`sessionStorage` in any hook. Tab refresh / accidental nav = all work lost.
- **No save preview** — admin can't see "this will insert 42 dishes, update 3" before committing.
- **No undo after save** — post-save, no rollback.
- **No collapse memory / virtualization** — long menus scroll forever; no "jump to category"; accidentally collapsed sections don't restore.
- Effect: a 30-minute review session can evaporate from a refresh; saving feels like a leap of faith.

### Also real, but lower priority for this cycle
- **F) Flagged duplicates opacity** — real but secondary once #1 is solved (if you can see source + existing, dedup decisions get easier).
- **D) Ingredient editing modal fatigue** — currently feature-flagged OFF (`NEXT_PUBLIC_INGREDIENT_ENTRY_ENABLED=false`), so it's not a daily pain today. Fix when the flag flips.
- **G) Restaurant details form mixed in** — mild friction; tab switcher already separates it.
- **H) Keyboard shortcuts** — quality-of-life, not foundational.
- **I) Warnings not actionable** — fix opportunistically while touching the warning UI.
- **J) Mobile** — deliberately deferred.

---

**Please confirm or correct this ranking.** If you have different daily frictions in mind, tell me. Once Q3 is settled we can move to Q4.

**User answer:** Address all pain points listed — top-3 (E, B+C, K+A) plus the lower-priority items (F flagged duplicates, D ingredient modal fatigue, G restaurant-details form split, H keyboard shortcuts, I actionable warnings).

Note on J (Mobile): previously flagged as deferred per the 2026-04-06 plan. User said "all those you mentioned" which technically includes J. **Claude's interpretation:** mobile is likely **not** a first-class goal here; at most we'll avoid making it worse, but a full responsive redesign is out of this cycle's scope unless user explicitly confirms otherwise.

---

## Q4 — Kind taxonomy: redesign approach

Your Q2 must-model list (prix-fixe, prix-fixe-with-choice, family-style, buffet/AYCE, beverage sizes, BYO-with-dynamic-pricing) combined with your taxonomy proposal means the current 4-value enum (`standard | template | experience | combo`) needs to change. There are three broadly different ways to do this, with very different implications:

### Approach A — **Additive**: keep the current 4 values, add new values only
- New enum: `standard | template | experience | combo | buffet | course_menu | …`
- Existing rows unchanged. AI prompt learns new values.
- Pro: cheapest; minimal migration risk; backward-compatible with mobile.
- Con: doesn't fix the underlying conflation (template-is-a-state, experience-is-two-things). You'll hit the same "doesn't work well" feeling in 6 months when a new edge case arrives.

### Approach B — **Restructure to composition shape only**: redefine the enum
Change the enum to a clean composition-shape set: e.g. `single | bundle | course_menu | configurable | buffet` (and move `template` out to a separate `status` field; split `experience` into `course_menu` vs `buffet`).
- Requires DB migration (data remap + CHECK constraint change), AI prompt rewrite, review UI rewrite, mobile update, feed recheck.
- Pro: solves the root cause — the taxonomy matches how real menus decompose.
- Con: larger migration scope; every existing dish needs mapping; AI re-training/prompt re-tuning; mobile needs a rev.

### Approach C — **Keep `kind` as-is, add orthogonal fields** for the missing dimensions
Leave the enum at 4 values; add new columns for the things that were being conflated: `is_course_sequence` (bool), `is_buffet` (bool), `status` (draft|template|published|archived), `portion_scale` (individual|shared|family|per_person), `price_model` (exact|per_person|market|tiered), etc.
- Pro: no breaking change to enum; solves the specific must-model gaps additively.
- Con: schema grows; "kind" becomes less informative; risk of flags drifting inconsistent (e.g., kind=combo + is_buffet=true).

### Approach D — **Hybrid**: reshape the enum partially
Something like: keep `standard`, rename `template` → `configurable`, split `experience` → `course_menu` + `buffet`, add `bundle` as alias/replacement for `combo`, add `status` as new field (draft|template|published).
- Pragmatic middle path.
- Pro: fixes the two worst conflations (template-is-state, experience-is-two-things) without a full rebuild.
- Con: still a migration; naming churn requires grep-and-replace across codebase.

### Recommendation
My default would be **D (hybrid)** because:
1. It resolves the two clearest category errors (template-as-state, experience-as-two-things).
2. It keeps the scope bounded — the enum change is small, the biggest cost is data migration + prompt rewrite.
3. It lets us evolve further later (e.g., move `configurable` → multi-axis model) without blocking this cycle.

But I want to hear which direction feels right to you. Also relevant: **how important is keeping the mobile app shippable during this cycle?** If the enum changes, mobile needs a release too.

**User deferred answer to Q4:** asked me to research and propose.

---

**Claude's proposed answer to Q4:**

### Coupling check
Before recommending, I audited how deeply `dish_kind` is baked in:

- **Mobile:** only 2 call sites, both cosmetic (emoji badges in `DishPhotoModal.tsx:173-174`, `RestaurantDetailScreen.tsx:282`, plus the select in `restaurantStore.ts:317`). No filtering, no branching. **Impact: low.**
- **Backend functions:**
  - `enrich-dish/index.ts:188,193` — completeness logic branches on `template`/`experience`/`combo`. Needs update.
  - `feed/index.ts:144,727` — returns kind in payload but doesn't branch. Fine.
  - RPC `generate_candidates` returns kind but doesn't filter by it. Fine.
- **Web-portal:** ~15 string-literal refs, concentrated in `api/menu-scan/route.ts` (AI prompt + Zod enum), `api/menu-scan/confirm/route.ts`, `DishEditPanel.tsx`, `DishGroupCard.tsx`, `useGroupState.ts`, tests.
- **DB:** `dish_kind` stored as `text` with CHECK (not native PG enum), so migrations are flexible — rename via UPDATE; relax+tighten the CHECK.

Coupling is **manageable**. The enum is not load-bearing for the feed or recommendations.

### Recommendation: Approach D (Hybrid), with concrete shape

**New `kind` enum — composition shape only (5 values):**

| Value | Replaces | Meaning |
|---|---|---|
| `standard` | (same) | Single fixed dish, one composition, one price |
| `bundle` | `combo` | N fixed items together at one price (combo, bento, set meal) |
| `configurable` | `template` | Customer selects from predefined slots (protein + sauce; build-your-own; BYO dynamic pricing) |
| `course_menu` | `experience` (part) | Multi-course served in sequence (prix-fixe, tasting menu, chef's menu, Q2.1 and Q2.2) |
| `buffet` | `experience` (part) | Flat-rate unlimited access (buffet, AYCE; Q2.4) |

Four renames plus one split. No `variant` or `beverage` as separate kinds:
- **Variants** (sizes, wine by the glass vs. bottle — Q2.9) keep using existing parent-child (`is_parent=true`, children are `standard`). Already works.
- **Family-style mix-and-match** (Q2.3) maps to `configurable` + `serves>1` (existing field).
- **BYO dynamic pricing** (Q2.10) maps to `configurable` + option-group `price_delta` (existing field).
- **Add-ons / sides** stay as `standard` dishes (no modifier kind this cycle — scope creep).
- **Small plates / tapas** stay as `standard` (shareability is `serves`, not a kind).

**New orthogonal fields to split the conflated meanings:**

| Field | Type | Purpose |
|---|---|---|
| `status` | text, NOT NULL, DEFAULT `'published'` | `published \| draft \| archived`. Lifecycle, not kind. |
| `is_template` | boolean, NOT NULL, DEFAULT false | Reusable shell; excluded from feed; cloneable. Splits the "template is a state" conflation. |

Templates (is_template=true) are orthogonal to kind: you can have a template `configurable` dish OR a template `bundle`, etc.

### Migration plan outline (detail in design phase)

1. **Expand CHECK** to temporarily accept both old + new values.
2. **Auto-migrate renames:**
   - `standard` → `standard` (no change)
   - `combo` → `bundle`
   - `template` → `configurable` + `is_template = true`
3. **Manual triage for `experience`:** leave as-is, add a one-time admin UI screen to reclassify each existing `experience` row as either `course_menu` or `buffet`. Not many rows expected (early-stage product).
4. **Tighten CHECK** to only new values once triage is complete.
5. **Update AI prompt** in `api/menu-scan/route.ts` with new decision tree.
6. **Update completeness logic** in `enrich-dish` function.
7. **Update mobile badges** in `DishPhotoModal.tsx` (single-line change, plus a fallback for unknown kinds).
8. **Add `status` and `is_template` columns** in the same migration.
9. **Ship coordinated release:** web+mobile together; mobile tolerates unknown kind values gracefully (no badge shown).

### Why D, not B or C

- **B (full restructure)** is only marginally better than D (both fix the conflations) but much riskier: more renames, more doc churn, harder migration. Not worth the cost given D already fixes the worst.
- **C (keep enum + add flags)** preserves the conflation (template-is-state stays misleading), and accumulates booleans that can drift inconsistent. Short-term win, long-term tech debt.
- **A (additive)** is cheapest but leaves the biggest conflations untouched — you'd be back here soon.

### Mobile compatibility stance
Mobile coupling is cosmetic-only. I recommend:
- **Ship web+mobile coordinated** (single release cycle).
- Mobile gracefully tolerates unknown kind values (no badge rendered; no crash).
- No need to block web progress on a long mobile release schedule.

**Does this shape sound right?** If yes, we're ready to move to the next question. If you disagree on any specific choice (renames, 5 vs. 6 values, the `is_template` separation, etc.) call it out.

**User follow-up to Q4:** asked whether I considered the full 11-core + 20-edge pattern taxonomy. Taxonomy saved to `research/user-taxonomy-proposal.md`.

**Claude's expanded response — mapping the taxonomy to the 5-kind proposal:**

Yes — I did consider the whole list. Below is an explicit mapping showing how each pattern is represented. The **insight** is that many "patterns" in the list aren't structurally distinct *kinds* — they're combinations of `kind` + orthogonal fields (portion size, parent-child variants, option groups, status, pricing prefix). A small enum + orthogonal axes covers more ground than a large flat enum.

### Core patterns — mapping

| # | User's pattern | Representation | Concrete example | Notes |
|---|---|---|---|---|
| 1 | Standard (Fixed Item) | `kind=standard` | Grilled ribeye steak $28 | 1:1 |
| 2 | Customizable (Add-ons) | `kind=standard` + `option_groups` (optional) | Cheeseburger $12; +bacon $3; +avocado $2 | Add-ons are modifiers on a single dish, not a different composition shape. Existing option_groups cover this. |
| 3 | Template / Matrix | `kind=configurable` | "Choose your pasta + sauce" ($16) — penne/fettuccine/spaghetti × marinara/alfredo/pesto | Selecting from predefined dimensions = definition of configurable. |
| 4 | Build-Your-Own | `kind=configurable` | Poke bowl $14: base → protein → 4 toppings → sauce → crunch | Multi-step construction = configurable with N option groups. |
| 5 | Variant (Size/Quantity) | parent-child pattern | Margherita pizza: S $10 / M $14 / L $18 (parent "Margherita", 3 standard children) | Parent `is_parent=true`, children are `standard` dishes of different sizes. Already works. |
| 6 | Combo / Set | `kind=bundle` | Big Mac Meal: burger + fries + drink $11 | Rename `combo` → `bundle`. |
| 7 | Experience (Interactive/Format) | **split** → `course_menu` / `buffet` / `bundle` / `configurable` | Omakase tasting → `course_menu`; AYCE Korean BBQ $45pp → `buffet`; Fondue-for-2 $65 → `bundle`; Per-item hot pot → `configurable` | Depends on the pricing structure of the specific restaurant. See Q5 note below. |
| 8 | Small Plates / Shared | `kind=standard` + `serves > 1` | Patatas bravas $8, serves 2 | Shareability = portion scale, not composition kind. |
| 9 | Specials / Dynamic | `status=published` + future temporal scheduling; `display_price_prefix='market_price'` for market price | "Today's catch: Sea Bass $MP"; "Chef's daily special" | Dynamic availability is a *state*, not a shape. **Temporal availability is deferred (Q2).** |
| 10 | Group / Bulk | any kind + `serves > 1` | Family Pack: 8-piece fried chicken + 2 large sides $35, serves 4 (kind=bundle, serves=4) | Portion scale. |
| 11 | Add-ons / Sides | `kind=standard` (standalone) OR `option_group` (attached) | "Side of fries $4" (standalone standard) vs "Add fries +$3" on a burger (option_group entry) | Could become a `kind=modifier` in a future cycle. **Not this cycle.** |

### Edge/combined patterns — mapping

| User's pattern | Representation | Concrete example |
|---|---|---|
| Experience + Build-Your-Own | `kind=configurable` + `serves>1`. AYCE variant → `kind=buffet`. | Per-item hot pot: $6 broth + $4–$12 per item (configurable); or "Hot pot AYCE $35pp" (buffet) |
| Experience + Template | `kind=buffet` (if AYCE) or `kind=configurable` (per-item) | Korean BBQ AYCE $45pp, choose 5 meats from the menu |
| Template + Variant | `kind=configurable` + parent-child for size | Pizza: S/M/L × 3 crust types × unlimited toppings |
| Template + Customizable | `kind=configurable` + `option_groups` | "Build-your-sushi-roll" (fish choice required) + optional avocado +$1, tempura flakes +$1 |
| Build-Your-Own + Variant | `kind=configurable` + parent-child for size | Salad bar: regular $9 / large $12 + choose 5 ingredients |
| Combo + Customizable | `kind=bundle` + `option_groups` | Kids Meal $6: burger + [fries OR apple slices] + [milk OR juice] |
| Combo + Variant | `kind=bundle` + parent-child for size | Combo meal: small $7.99 / medium $9.99 / large $11.99 |
| Small Plates + Experience | Each dish `kind=standard` + `serves>1` | Dim sum cart: har gow $5.50 / siu mai $5 / char siu bao $4.50 — each ordered separately |
| Specials + Any Pattern | base `kind` + `status=published` + temporal schedule (future) | "October tasting menu" → `course_menu` + seasonal schedule |
| Market Price | `display_price_prefix='market_price'` (existing field) | "Whole branzino — market price" |
| Tiered Pricing ("1/$5, 12/$50") | parent-child with `standard` children, OR `option_group` with quantity-tier price_delta | Wings: 6 for $9, 12 for $16, 24 for $28 |
| Multi-Entity Dish | `kind=bundle` | Sampler platter: 3 tacos + guacamole + chips + salsa $18 |
| Progressive Course Structure | `kind=course_menu` | Chef's 7-course tasting, fixed sequence $125 |
| Category-Level Options | menu-level / category-level option inheritance — **future** | "All curries: choose mild / medium / hot" (applies to 8 curry dishes) |
| Shared Add-ons Across Dishes | cross-dish relation / global modifiers — **future** | "Add rice +$2 to any entrée" (applies to 15+ dishes) |
| Time-Based Availability | scheduling — **deferred (Q2)** | Breakfast menu 7am–11am; happy-hour 4pm–6pm |
| Location / Context-Based Menu | restaurant/menu scope, not dish — **future** | CDMX branch has birria; LA branch has fish tacos |
| Limited / Rotating Menu | `status` + scheduling — **future** | Monthly chef special; weekly "farmer's pick" |
| Buffet / Unlimited | `kind=buffet` | Sunday brunch buffet $35pp |
| Predefined Course Bundles | `kind=course_menu` if sequenced; `kind=bundle` if not | 3-course prix-fixe lunch $22 (sequenced → `course_menu`); bento box (unordered → `bundle`) |
| Hybrid Menus | not a dish pattern — restaurants naturally have dishes of multiple kinds | One restaurant offers standard plates + a tasting menu + a brunch buffet |

### What's not representable, and what we're deferring

**Representable today with 5 kinds + orthogonal fields:** everything in your core 11 and everything in the edge/combined list that is *structural*.

**Not fully modeled in this cycle (deferred per Q2):**
- Time-based availability (happy hour, breakfast menu, seasonal dates)
- Category-level / menu-level option inheritance (spice level for all curries)
- Shared add-ons across dishes (global "add rice")
- Location/context-based menu variations

These are legitimate needs — I'm flagging them as deferred, not denying they exist.

### Key philosophical claim

Your list is longer than mine because it mixes *composition shape* (how a dish decomposes into components) with *state* (specials, templates), *scheduling* (time-based, seasonal, rotating), *portion* (group/bulk, small plates), *pricing model* (market price, tiered), and *scope* (location, category). These are **orthogonal axes** — each can vary independently. A single dish can simultaneously be: kind=configurable + is_template=true + status=published + serves=4 + display_price_prefix=per_person.

Collapsing all axes into one enum gives you 100+ values (11 core × ≥10 edge combinations). Separating them into a small `kind` + a handful of orthogonal fields gives the same expressive power with much less modeling load.

### Clarifying sub-question (Q4.1 — informal)

One genuinely ambiguous case: **interactive dining (hot pot, Korean BBQ, fondue)**. Structurally these are `buffet` OR `configurable` OR `bundle` depending on pricing — but they share a cultural/UX trait ("interactive group dining") that none of those kinds capture on their own.

Options:
- **(a)** Accept the mapping as-is (structure determines kind; "interactive" is a UX concern handled elsewhere — maybe a display tag or restaurant-level trait).
- **(b)** Keep `experience` as a 6th kind for interactive/format-based dining, separate from `course_menu` and `buffet`.
- **(c)** Add a separate `format_tag: interactive | sequenced | shared | …` optional field alongside kind.

My default is **(a)** — keep 5 kinds, don't re-introduce the conflation. But if you regularly need to *identify* interactive dining as a first-class category (e.g., for recommendations, filtering, UX badges), **(b)** or **(c)** are worth it. Let me know.

**If this mapping is acceptable, we can proceed to Q5.** If anything feels forced or wrong, call it out.

**User answer:** Mapping accepted. Interactive dining: default (a) stands — structural kinds only; "interactive" is a UX concern, not a dish kind. 5-kind enum confirmed.

---

## Q5 — Review page rework: incremental refactor or rebuild?

You want to address all the pain points from Q3 (image↔parsed linkage, variant/kind UX, save safety, density, flagged-duplicate opacity, ingredient modals, details-form split, keyboard shortcuts, actionable warnings). That's a big surface. Two broad approaches:

### Approach A — Incremental refactor
Keep the current structure (step-based flow, left images / right list, same hooks) and fix pain points in place:
- Add `source_page_index` to dish data, wire page badges + "jump to source" buttons
- Refactor prop-drilling to context / store (React context or Zustand)
- Fix combo price-hiding bug, clarify kind change effects
- Add `localStorage` draft persistence + save preview modal
- Virtualize long lists, add section collapse memory
- Incrementally update `DishEditPanel`, `DishGroupCard`, `MenuExtractionList` for new kinds

**Pros:** safer (no big regressions), ships in smaller increments, keeps WIP variant work unified.
**Cons:** architectural issues persist — 500+ line components, complex prop trees, untested hooks. Rework drags as each pain point needs to fit the old structure.

### Approach B — Full rebuild of review UI
Design a new review flow from scratch around the identified pains:
- Source-image-first layout (image + its dishes side-by-side, not separate carousel)
- New state layer (Zustand or context + reducer), proper tests
- New kind/variant model baked in from the start (5-kind enum, course_menu, etc.)
- Save preview + diff + localStorage draft as core primitives
- Kill legacy ingredient-modal overlaps; design proper disclosure
- Ship behind a feature flag; allow fallback to old UI during transition

**Pros:** no bolted-on fixes; state layer becomes testable; can design around the new Kind shape directly.
**Cons:** bigger upfront cost; risk of never-quite-done; user-facing change is large; WIP variant work needs re-landing.

### Approach C — Hybrid: keep layout, replace core machinery
Keep the overall page structure (steps, left/right panels) but:
- Replace the state layer (prop-drilling → context/store) and add tests
- Redesign the right-side panel (MenuExtractionList + DishEditPanel + DishGroupCard) as new components that know about the new 5-kind model
- Leave upload/processing flow as-is
- Layer in source-image linkage as a first-class concept
- Ship behind a feature flag but target replacing old UI within this cycle

**Pros:** ~70% of B's benefit at ~50% of B's cost. Bounded scope: upload/processing are already fine.
**Cons:** still a large PR; some churn.

### Recommendation
My default is **C (Hybrid)**. Reasoning:
- The upload + processing steps are not a pain point — leave them.
- The review state layer is where the rot is (prop-drilling, untested hooks, nested modals). Worth replacing.
- The right-side tree (extraction list + dish edit + group card) is where Kind/variant/source-linkage/density all land — it's the natural redesign target.
- Incremental (A) pretends the architecture is fine. Full rebuild (B) throws out functional upload/processing. C targets the actual problem.

**Your preference? A, B, C, or something else?**

**User answer:** C (Hybrid).

---

## Q6 — Course-menu modeling: how deep?

`course_menu` is the one new kind that doesn't have a clean analog in the current schema. The other kinds reuse existing primitives (parent-child, option_groups, serves, price_prefix). Course menus are different because a course has **ordinal position** and **per-course choices** — that's a new primitive.

Your must-model list includes both:
- **Q2.1:** Tasting menu (sequenced courses, no choice) — "3-course tasting: starter → main → dessert $65"
- **Q2.2:** Prix-fixe with choice-per-course — "soup OR salad → fish OR steak → dessert"

Three modeling options:

### Option 1 — Lightweight: overload existing primitives
- Course menu = parent dish (`kind=course_menu`, `is_parent=true`).
- Each course = an `option_group` on the parent with a required choice.
- Course order = `option_group.sort_order` (already exists? if not, add).
- Course items = `option_group.options` with `name` referencing dish concepts.

**Pros:** no new tables; reuses existing option_group infra; minimal migration.
**Cons:** option_groups weren't designed for ordered multi-course structures; items-in-course are strings, not true dish references (can't link to existing dishes; no ingredient/dietary inheritance from the underlying dish).

### Option 2 — Medium: add course_order + slots
- `dish_courses` table: `(id, parent_dish_id, course_number, course_name, required_count, choice_type)`
- `dish_course_items` table: `(id, course_id, option_label, price_delta, links_to_dish_id?)`
- Dish remains the unit; a course_menu is a dish with an ordered list of courses, each with N items.

**Pros:** clean separation; can later link course items to real dishes (e.g., "the salmon course references Salmon Teriyaki dish with all its ingredients"); admin UI can render sequenced courses cleanly; queries are simple.
**Cons:** 2 new tables; AI prompt needs to emit structured courses; review UI needs a course editor.

### Option 3 — Heavy: full course-sequencing graph
- Courses are first-class entities with sequence, optional course-level modifiers, per-course pricing tiers.
- Supports nested menus (e.g., "Pre-theater 3-course OR 5-course" — upgrade path).
- Supports wine pairings attached to a course.

**Pros:** covers every edge case from the taxonomy (progressive course structure, predefined course bundles, tasting-with-pairing).
**Cons:** large surface; scope creep given Q2 said "deferred" to happy-hour / time-based / scheduling; most restaurants won't need this depth.

### Recommendation
**Option 2 (medium)** — here's why:
1. Option 1 (overload option_groups) sounds cheap but will rot: course items as strings means no ingredient/dietary inheritance, no dish-level photos, and AI extraction becomes inconsistent (sometimes courses as dishes, sometimes as strings).
2. Option 3 is over-engineered for what Q2 scoped. Wine pairings, tiered menus, and course-level modifiers can come later if the data justifies it.
3. Option 2 is the smallest model that actually represents what the user's taxonomy describes as "Progressive Course Structure" and "Predefined Course Bundles" cleanly — and leaves a clean extension path to Option 3 later.

A dish modeled with Option 2:
```
Dish: "Spring Tasting Menu" (kind=course_menu, price=65, is_parent=true)
  Course 1 (course_number=1, name="Starter", required_count=1, choice_type="one_of")
    Item: "Butternut Squash Soup"
    Item: "Arugula Salad"
  Course 2 (course_number=2, name="Main", required_count=1, choice_type="one_of")
    Item: "Pan-Seared Salmon"
    Item: "Herb-Roasted Chicken"
  Course 3 (course_number=3, name="Dessert", required_count=1, choice_type="one_of")
    Item: "Chocolate Tart"
    Item: "Crème Brûlée"
```

`choice_type` could be `"fixed"` (admin picks the single item for that course, no choice) for tasting menus, or `"one_of"` for choice-per-course prix fixe.

**Pick: 1, 2, or 3? Any specific concerns?**

**User answer:** Option 2 (medium). `dish_courses` + `dish_course_items` tables; `choice_type ∈ {fixed, one_of}`.

---

## Q7 — Source-image linkage (Q3 pain #1)

Today there's no per-dish source-image tracking (`pageIndex` exists only for category placeholders in `lib/menu-scan.ts:642`). Fixing this is the biggest UX win for the review page. Three approaches:

### Option A — Page-level only, automatic
- API already calls Vision once per image (per `lib/menu-scan.ts:642` iteration). We already know which image produced which batch of dishes.
- Tag every dish with `source_image_index: number` (and optionally `source_image_url`) at extraction time.
- Review UI shows a small "Page N" chip on each dish; clicking it jumps the left-panel carousel to that image.
- **Cost:** tiny. ~10 lines in the API route + EditableDish type + one UI chip + one jump-handler. No AI prompt change.

### Option B — Region-level, from AI
- Prompt the Vision model to emit bounding-box coordinates for each extracted dish.
- Review UI can highlight the region on the source image (a small inset or overlay).
- **Cost:** higher — OpenAI Vision's region-emission quality is inconsistent; extraction prompt grows; confidence varies by image resolution; we'd need fallback handling for when coordinates are missing or wrong. Also the source image is rescaled before Vision call (sharp), so coordinates need transform.

### Option C — Hybrid: Option A now, Option B later
- Ship A in this cycle (page-level linkage).
- Leave a schema extension point for B (nullable `source_region: {x, y, w, h}` field).
- If page-level linkage is enough to resolve the pain, never need B.

### Recommendation: **C (page-level now, region-level later if needed)**

Reasoning:
- Page-level linkage alone solves the core pain: "what image produced this dish?" That's what admins hunt for today.
- Region-level is nice-to-have but uncertain — Vision coordinate quality is variable and we'd spend real effort on fallback logic.
- A future cycle can add region-level without breaking compat if we reserve the field now.

### Review-UI implications
With page-level linkage, the redesigned right panel can:
- Render dishes in **source-image order** by default (group dishes by `source_image_index`, with a collapsible image thumbnail per group)
- Let admin click a page chip on any dish → scroll left-panel carousel to that image
- Alternative: lock-step scrolling — scrolling the list auto-advances the image on the left (toggleable)

**Pick: A, B, or C? Any other linkage mechanism you want (e.g., OCR-based)?**

**User answer:** C — ship page-level linkage this cycle; reserve a nullable `source_region` column for future region-level work.

---

## Q8 — Save safety primitives (Q3 pain #3)

Today: no draft persistence, no save preview, no undo. A 30-min review can vanish from a refresh. Let's scope what to add.

Three primitives to consider, each with bounded options:

### 8.1 — Draft persistence
- **(a)** None — keep current behavior (risky)
- **(b)** `localStorage` autosave every N seconds per `job_id`. Restore prompt on return. Cleared after successful save.
- **(c)** Server-side draft — save `editableMenus` state to `menu_scan_jobs.draft_payload` column; resumable from any device.

### 8.2 — Save preview
- **(a)** None — button immediately commits (current behavior)
- **(b)** Confirmation modal with a summary: "Will insert 42 dishes across 3 menus, update 0, flag 2 duplicates as accepted." One-button proceed.
- **(c)** Full diff view: side-by-side list of to-insert / to-update / to-skip with ability to deselect specific rows before commit.

### 8.3 — Undo after save
- **(a)** None — once saved, it's final (current behavior)
- **(b)** Soft undo: hold `job_id` on the confirm call; within N minutes, admin can click "Undo last save" to delete the inserted dishes.
- **(c)** Full history: every save logged to `admin_audit_log` with a revert action.

### Recommendation
- **8.1(b) localStorage autosave** — cheap, solves the refresh problem completely. Server-side draft (c) is overkill unless admins routinely review across devices (unlikely for this flow).
- **8.2(b) confirmation modal** — good balance: reassurance without deselect-heavy micro-management. Deselection (c) adds a lot of UI surface for a rare need (if a row is wrong, edit it before save).
- **8.3(b) soft undo with a time window** — covers the "oops" case cheaply. Full audit-log history (c) is the right long-term answer but is bigger scope; pick this cycle only if you already have an audit-log surface.

So: **8.1(b) + 8.2(b) + 8.3(b)** — the middle option on all three.

### Why not skip 8.3?
Current review is all-or-nothing; if admin saved a batch and then noticed a kind mistake on dish #17, they either manually delete 40 rows or live with the error. Soft undo (within say 15 min) gives a safety net without building full history.

**Agree with middle-path (b/b/b)? Or prefer to drop any of them? Or go stronger on one?**

**User answer:** b/b/b confirmed.

---

## Q9 — Implementation strategy (bundled)

Three tightly related decisions on *how* we build this. Recommendations inline.

### 9.1 — State layer choice
The review page's prop-drilling (~96 props) needs to go. Options:
- **(a)** React Context + `useReducer` — idiomatic for Next.js; no new dep; easy to test reducers.
- **(b)** Zustand — already used in mobile app; tiny; great DX; easy to compose slices (`useReviewSlice`, `useGroupSlice`, etc.).
- **(c)** Server state (React Query) + minimal client — probably overkill; review state is ephemeral and client-driven.

**Recommendation: (b) Zustand.** Matches mobile. Slices line up cleanly with the current hook decomposition (upload, processing, review, groups). Unit-testable without mounting components.

### 9.2 — Feature flag / rollout
The new review UI is a big change. Options:
- **(a)** No flag — ship as a single replacement; code-review catches regressions.
- **(b)** Env flag (`NEXT_PUBLIC_NEW_REVIEW_UI=true`) — devs run new UI; admins stay on old until flip. Low overhead.
- **(c)** Per-admin flag — some admins opt-in; A/B test. Requires a user-level toggle in the DB/admin schema.

**Recommendation: (b) Env flag.** Solo dev, small admin team — per-admin flag overhead isn't worth it. Env flag lets us land the new UI over multiple PRs without breaking the live one, then flip in one commit.

### 9.3 — Test coverage target for the rewrite
- **(a)** Parity with today (minimal) — ship fast, test later.
- **(b)** Hooks/reducers tested thoroughly; components via render smoke-tests.
- **(c)** Full component + hook + integration test coverage.

**Recommendation: (b).** The current hooks are untested, which is exactly why refactoring is scary. Putting good tests on the *new* state layer (Zustand slices or reducers) delivers the biggest regression safety for the least effort. Component-level tests are brittle in React; keep them as smoke tests and rely on hook tests for correctness.

---

**Combined recommendation: 9.1(b) Zustand + 9.2(b) Env flag + 9.3(b) hook/reducer tests thorough, components smoke-tested.**

**Agree? Any disagreements?**

**User answer:** 9.1(b) Zustand, 9.2(a) No flag — ship as single replacement, 9.3(b) thorough hook/reducer tests + component smoke tests.

**Implication noted:** without a feature flag, the new review UI needs to land as a coordinated replacement. Either one sizeable PR or a short sequence where intermediate states are temporarily visible to admins. The implementation plan should account for this (sequence changes so the live UI remains functional, or bundle the swap into a single PR). I'll treat the new UI as "land in a single PR at the end" unless the plan proves that too risky.

---

## Q10 — AI extraction improvements (bundled)

Redesigning Kind changes the AI prompt anyway. While we're there, what other extraction improvements do we want? Three independent sub-decisions.

### 10.1 — Confidence thresholds / quality flags
Today: AI emits `confidence: number (0–1)` per dish; UI shows it as-is, no thresholds.
- **(a)** Keep as-is
- **(b)** Add thresholds: dishes with `confidence < 0.7` get a "needs review" flag; batch toolbar filters by it; block save until all flagged dishes are touched (or explicitly dismissed)
- **(c)** Replace numeric with categorical: `high | medium | low | unknown` (easier to reason about than a float)

**Recommendation: (b) thresholds + flag.** Numeric is fine; adding an actionable threshold converts "decorative number" into "sortable review queue." Gets admins to the uncertain dishes first.

### 10.2 — Structured Outputs tightening
Currently uses Zod enum (`dish_kind: z.enum([…])`) + likely `response_format: json_object`. Per the 2026-04-06 plan, the intent was to move to `json_schema` with `strict: true`. Status unclear — needs verification.
- **(a)** Verify and ensure `json_schema + strict:true` is in place; keep otherwise.
- **(b)** Verify, plus tighten the schema to the new 5-kind enum + course structures (`dish_courses` / `dish_course_items`).

**Recommendation: (b).** The Kind migration requires prompt + schema updates anyway. Double-check `strict:true` while we're there.

### 10.3 — Multi-page merge quality
The merge logic (fuzzy category matching, variant detection) was redesigned 2026-04-06. Needs a quality spot-check:
- **(a)** Leave as-is; trust the prior plan's implementation.
- **(b)** Review the current merge logic + add a "merge preview" showing which dishes were combined/split/flagged, editable before save.

**Recommendation: (a)** for this cycle. Merge quality isn't on your Q3 pain list; opening the can now risks scope creep. Revisit in a future cycle with data on real merge errors.

---

**Combined: 10.1(b) thresholds + 10.2(b) verify+tighten + 10.3(a) leave-as-is.**

**Agree?**

**User answer:** Agreed. 10.1(b) + 10.2(b) + 10.3(a).

---

## Q11 — Remaining scope decisions (bundled)

Five small bounded decisions to close scope. Recommendations inline.

### 11.1 — Ingredient pipeline flag (`NEXT_PUBLIC_INGREDIENT_ENTRY_ENABLED`)
Currently OFF → ingredient modals in the review UI are hidden. Pain D (modal fatigue) only bites if the flag flips.
- **(a)** Leave OFF — skip all ingredient-modal redesign work this cycle.
- **(b)** Flip ON as part of this cycle — redesign the modals as part of the review-UI rework.
- **(c)** Leave OFF during implementation; design the new review UI so ingredient editing has a clean place to land when the flag flips later.

**Recommendation: (c).** Don't block scope on the ingredient pipeline readiness; do leave clean extension points in the new UI. When you flip the flag later, the slot exists.

### 11.2 — Flagged duplicates opacity (Q3 pain F)
Today flagged duplicates say "similar dish found" with no *why*.
- **(a)** Leave as-is — secondary pain.
- **(b)** Add a "why flagged" breakdown: name similarity %, description match, shared category, plus a side-by-side comparison of new vs. existing dish.

**Recommendation: (b).** Small, focused improvement. You've said we're addressing all listed pains; this one is cheap and valuable.

### 11.3 — Keyboard shortcuts (Q3 pain H)
- **(a)** None (current) — mouse-only.
- **(b)** Minimal: expand/collapse all (E), jump-to-next-flagged (N), save (Cmd/Ctrl+S), accept/reject group (A/R).
- **(c)** Full keyboard-first flow — every action bindable.

**Recommendation: (b).** Minimal set covers the 80% throughput wins. Full keyboard-first is engineering overkill for a small admin team.

### 11.4 — Actionable warnings (Q3 pain I)
Today warnings render in the header as text.
- **(a)** Leave as-is.
- **(b)** Make each warning clickable → scrolls to the dish it refers to, highlights it; offers "fix with default" where applicable (e.g., "Assign to 'Uncategorized'", "Set kind=standard").

**Recommendation: (b).** Small cost, big UX lift.

### 11.5 — Mobile coordination timing
Mobile needs to accept new kind values (`bundle`, `configurable`, `course_menu`, `buffet`) and tolerate unknowns. Options:
- **(a)** Same PR/release as web — synchronous.
- **(b)** Slightly lagging release — web ships first; mobile ships within 1–2 weeks. Mobile tolerates unknowns (no badge) so no crash risk.
- **(c)** Next mobile release whenever it naturally happens — no rush.

**Recommendation: (b).** Low coupling (cosmetic-only) means lagging mobile is safe. Synchronous release couples timelines unnecessarily. "Whenever" risks the mobile app carrying stale UI for months.

---

**Combined: 11.1(c) + 11.2(b) + 11.3(b) + 11.4(b) + 11.5(b).**

**Agree? Any different preferences?**

**User answer:** Agreed.

---

## Q12 — Success criteria & explicit non-goals

Last scoping question before we check in. Two small pieces:

### 12.1 — Success criteria
How do we know this cycle is "done"? Proposed bar (tell me to add/remove):
- Admin can review a 50-dish multi-page menu without losing work on refresh (draft autosave)
- Admin can see "which image" every dish came from (source-image linkage)
- Admin can review a course_menu (tasting / prix-fixe) without hacks
- Admin can confidently save (preview summary, soft undo within 15 min)
- All new Kind values (`standard`, `bundle`, `configurable`, `course_menu`, `buffet`) are extractable by AI, visible in review UI, persistable in DB, and readable by mobile (unknowns tolerated)
- All existing `experience` rows have been triaged (course_menu vs. buffet) via the one-time admin screen
- All `template` rows have been migrated to `configurable` + `is_template=true`
- All `combo` rows have been migrated to `bundle`
- Hooks/reducers in the new state layer have meaningful test coverage (Q9.3 target)
- No regression in the upload / processing stages (untouched)
- Mobile ships updated kind-badge handling within 1–2 weeks (Q11.5)

### 12.2 — Explicit non-goals for this cycle
Out of scope, to be surfaced explicitly so expectations match:
- Restaurant ingestion improvements (Q1 deferred)
- Kids menu, happy-hour / time-based dish pricing, seasonal / date-ranged availability, daypart categorization (Q2 deferred)
- Region-level source-image linkage (Q7 C — field reserved, not wired)
- Full merge-preview UI (Q10.3 — leave current merge logic alone)
- Cross-device draft persistence (Q8 — localStorage only, not server-side)
- Full audit-log with revert history (Q8 — soft undo only)
- Full keyboard-first flow (Q11.3 — minimal set only)
- Flipping the ingredient-entry feature flag (Q11.1 — design extension points only)
- **Mobile / narrow-viewport responsive redesign — web-portal is laptop-only, explicit user clarification 2026-04-22.**
- Category-level / shared add-ons / location-based menus / rotating menus (taxonomy items deferred)

**Does this bar match your definition of done? Anything to add or drop?**

**Dialogue:**
- First pass: user asked to add "mobile UX responsive redesign" to scope.
- Follow-up clarification: user confirmed the web-portal is used **on laptop only**. Mobile/narrow-viewport responsive redesign is therefore **NOT** in scope. Q12.1 (mobile depth) is moot.

**Final:** scope stays as originally proposed — no mobile responsive work. The review UI targets desktop/laptop only.
