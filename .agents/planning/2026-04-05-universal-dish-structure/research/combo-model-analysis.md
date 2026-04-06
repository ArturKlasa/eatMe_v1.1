# Combo / Set Meal Model Analysis

## First: Two Types of Combos

Before comparing options, we need to distinguish:

| Type | Example | Choices? | Modeling |
|------|---------|----------|----------|
| **Fixed combo** | Bento box, family meal platter | No — fixed items | Just a standard dish, one row, done. No special handling needed. |
| **Configurable combo** | "Lunch Combo: pick main + side + drink · $12" | Yes — user picks components | **This is what we're analyzing.** |

Fixed combos are already handled by our model (single dish row, `dish_kind: 'standard'` or `'combo'`). The interesting question is configurable combos.

---

## The Options

### Option A: Combo as Own Entity (Primary Dimension = Main Dish)
- Parent row: "Lunch Combo · $12" — `dish_kind: 'combo'`, display-only
- Variant rows: "Lunch Combo — Chicken Burger", "Lunch Combo — Fish Burger", etc.
- Side/drink choices as option_groups on each variant
- Price: combo price ($12) on each variant
- Standalone "Chicken Burger" also exists separately at $9
- Map pin: **"Lunch Combo — Chicken Burger · $12"**

### Option B: Recommend Main Dish, Combo is Display Detail
- Only standalone dishes exist: "Chicken Burger · $9", "Fish Burger · $10"
- Combo is a menu-level presentation concept linking existing dishes
- Metadata on the dish or a separate `combos` table: "available in Lunch Combo with fries + drink for $12"
- Menu view shows combo availability as a note
- Map pin: **"Chicken Burger · $9"** (no combo awareness in recommendation)

### Option C: Combo as Price Variant (No Duplication)
- "Chicken Burger" exists once, with an option_group for purchase format:
  - "À la carte · $9"
  - "Lunch Combo (+ fries + drink) · $12"
- No duplicate rows, combo is just a pricing/bundling option
- Map pin: **"Chicken Burger · from $9"**

---

## Comparison

### 1. Recommendation Quality

| Aspect | Option A (combo entity) | Option B (display detail) | Option C (price variant) |
|--------|------------------------|--------------------------|-------------------------|
| Map pin for value-seeker | **"Lunch Combo — Chicken Burger · $12"** — communicates full meal deal | "Chicken Burger · $9" — no combo info until they open restaurant | "Chicken Burger · from $9" — ambiguous, what's the "from"? |
| Can engine recommend combo as a deal? | **Yes** — combo is independently recommendable | No — engine doesn't know combos exist | Partially — but pin doesn't explain the value |
| Embedding distinctiveness | "chicken burger lunch combo with fries and drink" — slightly different from standalone | Same as standalone burger | Same as standalone burger |
| Preference learning | Learns "user likes combo meals" and "user likes chicken" separately | Only learns "user likes chicken burger" | Only learns "user likes chicken burger" |
| For user who always picks combos | **Engine can boost combos specifically** | Can't — no signal that user prefers combos | Can't distinguish combo vs à la carte preference |

### 2. Filter Accuracy

| Filter | Option A | Option B | Option C |
|--------|----------|----------|----------|
| **Price range $10-$15** | **Combo ($12) included, standalone ($9) excluded** — user sees the combo deal | Standalone ($9) excluded — user misses the restaurant entirely | "from $9" — base price $9 excluded, but combo is $12. Depends on which price is stored. |
| **Price range $5-$10** | Standalone ($9) included, combo ($12) excluded — correct | Standalone ($9) included, no combo info | Unclear — $9 base passes but $12 combo doesn't |
| **Vegan hard filter** | Variant "Lunch Combo — Veggie Burger" passes | "Veggie Burger" standalone passes | "Veggie Burger" passes |
| **Allergens** | Each combo variant has own allergens (main dish driven) | Same as standalone | Same as standalone |
| **Calorie filter** | Can set combo-level calories (burger + fries + drink = 950 cal) | Only burger calories (450 cal) — inaccurate for what user actually eats | Ambiguous — which calorie count? |

**Key insight on price:** Option A is the only approach where the price filter correctly surfaces combo deals at the combo price point. A user filtering $10-$15 for lunch wants to know about the $12 combo — Options B and C can't deliver this.

### 3. The Duplication Question

Option A creates "Chicken Burger" as standalone ($9) AND "Lunch Combo — Chicken Burger" ($12). Is this bad?

| Concern | Analysis |
|---------|----------|
| Wasted DB rows? | Minimal — maybe 3-5 extra variants per combo. At 100K restaurants with 10% having configurable combos, that's ~50K extra rows. Negligible vs 7.8M total. |
| Duplicate recommendations? | **No** — different parent_dish_ids, different prices. Restaurant diversity cap (max 3) prevents flooding. The engine picks whichever scores higher for the user. |
| Confusing for user? | **No** — they're genuinely different products. "$9 burger" and "$12 combo with burger + fries + drink" are distinct offerings. Real menus list them separately too. |
| Embedding near-duplicates? | Slightly — but combo embedding includes "with fries and drink, lunch combo" context, making it distinct enough. |
| Admin burden? | Moderate — for each combo, create parent + link existing dish variants. AI extraction can detect "Combo #1: [main] + fries + drink $12" from menu photos. |

### 4. Mobile UX

| Aspect | Option A | Option B | Option C |
|--------|----------|----------|----------|
| Menu view | **Standalone section**: "Chicken Burger · $9". **Combo section**: "Lunch Combo" parent with variants underneath showing $12 | "Chicken Burger · $9" with small note: "Available in Lunch Combo for $12" | "Chicken Burger · from $9" with option group showing à la carte vs combo |
| Matches real menus? | **Yes** — restaurants have separate "Combo Meals" sections | Partially — some menus do cross-reference | No — menus don't present combos as a pricing option on individual items |
| Clarity for user | **High** — clear what's standalone vs combo, different prices, different sections | Medium — combo info buried in notes | Low — "from $9" is ambiguous |
| Restaurant detail after pin click | User sees both offerings clearly | User might miss the combo deal | Confusing option_group mixing bundling with customization |

### 5. Data Model Consistency

| Aspect | Option A | Option B | Option C |
|--------|----------|----------|----------|
| Uses parent + variant pattern? | **Yes — identical to Poke Bowl model** | No — needs new `combos` table or many-to-many linking | No — overloads option_groups with bundling concept |
| New concepts needed? | Only `dish_kind: 'combo'` value | New `dish_combos` table, `combo_availability` metadata | Mixes pricing/bundling into option_groups (semantic confusion) |
| Consistent with existing model? | **Fully** | Requires new relationship pattern | Stretches option_groups beyond their purpose |

### 6. AI Menu Extraction

| Aspect | Option A | Option B | Option C |
|--------|----------|----------|----------|
| Can GPT detect combos from menu photos? | **Yes** — "Combo #1: Chicken Burger + Fries + Drink $12" is a clear pattern | Can detect combo exists, but generating cross-references is complex | Needs to understand it's a pricing variant, not a customization |
| Extraction output | Parent "Lunch Combo" + variants for each main dish option | Must link detected combo to existing standalone dishes (multi-pass) | Must generate unusual option_group structure |
| Error potential | Low — straightforward parent+variant | Medium — cross-referencing can fail | Medium — semantic confusion in extraction |

### 7. Edge Cases

| Case | Option A | Option B | Option C |
|------|----------|----------|----------|
| Combo with NO choices (fixed) | Just a standard dish, no parent/variants needed | Same | Same |
| Combo where side also matters (e.g., sushi combo: pick 3 rolls) | Primary dimension = most impactful roll, others as option_groups | Can't represent in recommendations | Can't represent |
| Combo-only items (not available standalone) | Variant exists only under combo parent, no standalone row | Can't represent — no base dish to annotate | Can't represent cleanly |
| Nested combos ("Family Meal: pick 2 combos") | Parent "Family Meal" → variant "Family Meal — 2x Chicken Combo", price as option_group for size | Very complex to represent | Very complex |

---

## Summary Scorecard

| Criteria | Option A (combo entity) | Option B (display detail) | Option C (price variant) |
|----------|------------------------|--------------------------|-------------------------|
| Recommendation quality (25%) | **9/10** | 4/10 | 5/10 |
| Filter accuracy — especially price (20%) | **9/10** | 5/10 | 4/10 |
| Mobile UX (15%) | **8/10** | 6/10 | 4/10 |
| Data model consistency (15%) | **10/10** | 4/10 | 3/10 |
| Scale / duplication cost (10%) | 7/10 | **9/10** | **9/10** |
| AI extraction feasibility (10%) | **8/10** | 5/10 | 5/10 |
| Edge case handling (5%) | **8/10** | 4/10 | 4/10 |
| **Weighted total** | **8.6/10** | **4.9/10** | **4.4/10** |

---

## Recommendation: Option A — Combo as Own Entity

Use the same parent + variant model. Combos are first-class recommendable entities.

### Why:
1. **Price filter is the killer argument** — a user filtering $10-$15 for lunch sees "Lunch Combo — Chicken Burger · $12" with Option A. With Options B/C, they see nothing because the standalone burger is $9 (below range) and the combo price isn't in the dish row.
2. **Combos are genuine value propositions** — "full meal for $12" is a different product than "burger for $9". Users want to discover combo deals.
3. **Perfect model consistency** — same parent + primary dimension pattern as Poke Bowl and buffets. No new tables or concepts.
4. **Calorie accuracy** — combo variant can have total combo calories (950), not just burger calories (450).
5. **Minimal duplication cost** — ~50K extra rows at 100K restaurants is negligible.

### How it works:
```
Menu section: "Combo Meals"
  Lunch Combo · $12                    ← parent (display-only)
    Chicken Burger + Fries + Drink     ← variant row, price $12, calories 950
    Fish Burger + Fries + Drink        ← variant row, price $13, calories 880
    Veggie Burger + Fries + Drink      ← variant row, price $11, calories 750
      Side: Fries | Salad | Soup       ← option_group
      Drink: Coke | Sprite | Water     ← option_group

Menu section: "Burgers" (separate)
  Chicken Burger · $9                  ← standalone dish row
  Fish Burger · $10                    ← standalone dish row
  Veggie Burger · $8                   ← standalone dish row
```

Map pin for value-seeking user: **"Lunch Combo — Chicken Burger · $12"**
Map pin for à la carte user: **"Chicken Burger · $9"**

The engine picks whichever scores higher for that specific user's profile.
