# Buffet / Unlimited Consumption Model Analysis

## The Options

### Option A: Buffet as Single Dish Entry
One row: "All-You-Can-Eat Sushi Buffet", `dish_kind: 'experience'`, price $25.
Individual buffet items listed in description or as non-recommendable metadata.

### Option B: Buffet as Menu-Level Concept + Individual Dish Rows
Menu marked `menu_type: 'buffet'` with `buffet_price: $25`.
Individual items (salmon sashimi, vegetable rolls, etc.) are full dish rows with own embeddings, allergens, dietary_tags. Each dish row carries the buffet price.

### Option C: Buffet as Parent + Representative Variants (Primary Dimension Applied)
Apply the same primary dimension logic we chose for configurable dishes:
- Parent row: "Sushi Buffet" (`dish_kind: 'experience'`, display-only, not in feed)
- 3-5 variant rows representing major dietary profiles available:
  - "Sushi Buffet — Seafood" (fish, shellfish allergens)
  - "Sushi Buffet — Meat & Poultry" (meat allergens)
  - "Sushi Buffet — Vegetarian/Vegan Options" (vegan-friendly)
- Each variant: price $25, `display_price_prefix: 'per_person'`, own allergens/dietary_tags/embedding

---

## Comparison

### 1. Filter Accuracy (Most Critical Difference)

| Filter | Option A (single entry) | Option B (all items) | Option C (representative variants) |
|--------|------------------------|---------------------|-----------------------------------|
| **Vegan hard filter** | **BROKEN** — buffet contains fish+meat+dairy, excluded entirely. But a vegan CAN eat at this buffet (veggie rolls exist). | Correct — vegan sees "Vegetable Roll" | **Correct** — vegan sees "Sushi Buffet — Vegan Options" |
| **Fish allergy** | **BROKEN** — buffet excluded entirely, even though non-fish items exist | Correct — non-fish items pass | **Correct** — "Meat & Poultry" and "Vegan Options" variants pass |
| **No allergy filters** | Works fine — "Sushi Buffet $25" shown | Works — but which of 50 items to recommend? | **Works** — best-matching variant recommended |
| **Protein type: fish** | Can't boost — what protein IS a buffet? | Correct — fish items boosted | **Correct** — seafood variant boosted |
| **Price range $20-$30** | Correct — $25 passes | Correct — all items carry $25 | **Correct** — all variants carry $25 |

**Key insight:** Option A has a fundamental filter problem. A buffet inherently contains multiple allergen categories. As a single row, it either:
- Lists ALL allergens → gets excluded by almost every allergy filter (even though users can avoid those items)
- Lists NO allergens → unsafe for users with allergies
- There's no good answer for a single row.

### 2. Recommendation Quality

| Aspect | Option A | Option B | Option C |
|--------|----------|----------|----------|
| Map pin label | "Sushi Buffet · $25/person" | "Salmon Sashimi · $25 buffet" | "Sushi Buffet — Seafood · $25/person" |
| Pin appeal | Clear but generic | Misleading — implies you pay $25 for just sashimi | **Clear — communicates it's a buffet + what you'd eat** |
| Embedding quality | Generic "sushi buffet" — broad | Hyper-specific per item | **Balanced — captures dietary profile** |
| Preference vector learning | Learns "user likes buffets" | Learns "user likes salmon sashimi" (loses buffet context) | **Learns "user likes seafood buffets"** |
| For a user who loves fish | Can't distinguish from any other buffet | Recommends individual fish items well | **Recommends "Seafood" variant — appropriate** |

### 3. Scale & Practicality

| Aspect | Option A | Option B | Option C |
|--------|----------|----------|----------|
| Rows per buffet restaurant | 1 | 30-100 (all buffet items) | **3-5** |
| Admin burden | Low — one entry | Very high — enter every buffet item | **Low — 3-5 dietary categories** |
| AI menu scan feasibility | Easy — "Lunch Buffet $15" | Very hard — buffet menus rarely list all items | **Feasible — can infer dietary categories from buffet type** |
| Menu update when items rotate | No change needed | Constant updates | **Rarely needs updating — dietary profiles are stable** |
| Extra rows at 100K restaurants (est. 5% have buffets) | 5K rows | 250K-500K rows | **15K-25K rows** |

### 4. Mobile UX

| Aspect | Option A | Option B | Option C |
|--------|----------|----------|----------|
| Menu view presentation | "Sushi Buffet · $25/person" with description | 50+ individual items cluttering the menu | **"Sushi Buffet · $25/person" parent with 3-5 dietary highlights underneath** |
| Does it match real-world? | Yes — buffets are listed as one item | No — nobody lists every buffet item on a menu | **Yes — mirrors "Buffet includes: seafood, meat, vegetarian options"** |
| Info for user with dietary needs | Nothing — just a name and price | Full detail but overwhelming | **Right level — "vegan options available"** |

### 5. Price Handling

| Aspect | Option A | Option B | Option C |
|--------|----------|----------|----------|
| Price display | $25/person (clear) | $25 on each of 50 items (redundant, confusing) | **$25/person on each variant (clear)** |
| `display_price_prefix` | `per_person` | `per_person` on every item (weird for "Salmon Sashimi · $25/person") | **`per_person` (natural for "Sushi Buffet — Seafood · $25/person")** |
| Price filter | Works | Works but 50 rows all at same price wastes candidate slots | **Works efficiently — 3-5 rows** |

### 6. Diversity Cap Interaction

| Aspect | Option A | Option B | Option C |
|--------|----------|----------|----------|
| Feed behavior | 1 slot used, clean | Up to 3 slots (diversity cap) all from same buffet — wasteful | **Max 1 variant per parent (our existing rule) — clean** |
| Candidate pool efficiency | Excellent | Poor — 50 near-identical-price items compete for 200 candidate slots | **Good — 3-5 entries, max 1 selected** |

### 7. Consistency with Our Primary Dimension Model

| Aspect | Option A | Option B | Option C |
|--------|----------|----------|----------|
| Uses parent_dish_id? | No (standalone) | No (flat dish list under buffet menu) | **Yes — same pattern as configurable dishes** |
| Consistent with Poke Bowl approach? | No — different model for buffets | No — different model again | **Yes — primary dimension = dietary profile** |
| New concepts needed? | `dish_kind: 'experience'` | `menu_type: 'buffet'`, buffet_price on menu | **Only `dish_kind: 'experience'` + existing parent-child model** |

---

## Summary Scorecard

| Criteria | Option A (single) | Option B (all items) | Option C (representative) |
|----------|-------------------|---------------------|--------------------------|
| Filter accuracy (25%) | 2/10 | 9/10 | **8/10** |
| Recommendation quality (20%) | 4/10 | 6/10 | **8/10** |
| Scale & practicality (15%) | 9/10 | 2/10 | **8/10** |
| Mobile UX (15%) | 6/10 | 3/10 | **9/10** |
| Price handling (10%) | 8/10 | 4/10 | **8/10** |
| Consistency with data model (10%) | 4/10 | 3/10 | **10/10** |
| AI extraction feasibility (5%) | 9/10 | 2/10 | **7/10** |
| **Weighted total** | **4.9/10** | **4.8/10** | **8.3/10** |

---

## Recommendation: Option C — Representative Variants

Apply the same primary dimension model to buffets. The "primary dimension" of a buffet is the **dietary profile** of what you'd eat there.

### How it works:
- **Parent row**: "Sushi Buffet" — `dish_kind: 'experience'`, display-only, not in feed
- **Variant rows** (3-5 per buffet):
  - "Sushi Buffet — Seafood Selection" — allergens: fish, shellfish; dietary: pescatarian
  - "Sushi Buffet — Meat & Poultry" — allergens: none fish-related; dietary: none
  - "Sushi Buffet — Vegetarian/Vegan" — dietary_tags: vegan, vegetarian
- **Price**: $25 on each variant, `display_price_prefix: 'per_person'`
- **Menu view**: parent groups variants, shows "$25/person" once

### Why this wins:
1. **Solves the filter problem** without Option A's allergen dilemma
2. **Consistent with primary dimension model** — no new patterns needed
3. **Manageable scale** — 3-5 rows per buffet, not 50+
4. **AI can infer** dietary categories from buffet type (sushi buffet → seafood + vegetarian options)
5. **Menu view is clean** — matches how buffets are actually presented
6. **Diversity cap works naturally** — max 1 variant per parent
