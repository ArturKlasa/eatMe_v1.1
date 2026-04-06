# Small Plates / Shared & Group / Bulk Meals Analysis

## The Patterns

| Pattern | Examples | Key Characteristics |
|---------|----------|-------------------|
| **Small plates / shared** | Tapas, dim sum, mezze, appetizers | Low price ($4-$12), meant to order 3-5 for a table, each is a distinct dish |
| **Group / bulk** | Family meals, party platters, catering trays | High price ($30-$80+), serves 2-8 people, often a bundle |

## Key Question: Do These Need Structural Changes or Just Metadata?

### Small Plates Analysis

Each tapa or dim sum item is structurally a **standard dish**. "Patatas Bravas · $7" has fixed ingredients, a fixed price, and specific allergens. There's nothing structurally different from "Steak · $25" — only the portion context differs.

What IS different:
- **Ordering intent**: you order 3-5 small plates, not just one
- **Price perception**: $7 per plate but $28-$35 for a meal for one person
- **Menu presentation**: grouped under "Small Plates" / "Tapas" / "Dim Sum" section

Options for handling:

**Option S1: No special handling — just menu category**
- Small plates are standard dish rows under a "Tapas" or "Small Plates" menu_category
- No new fields needed
- Menu view already groups by category

**Option S2: Add `serving_style` metadata**
- New field on dishes: `serving_style: 'individual' | 'shared'`
- `shared` indicates this dish is meant to be one of several ordered together
- Could influence presentation: "Small Plate · $7" label, "Order 3-4 to share" note
- Enables future filter: "Show me restaurants with shareable/tapas-style dining"

### Group / Bulk Meals Analysis

A family meal could be:
- **Fixed**: "Family Feast: 4 tacos + rice + beans · $45" — standard dish, serves 4
- **Configurable**: "Family Meal: pick 2 mains + 2 sides · $55" — combo pattern (already handled)

What's needed:
- **`serves` count**: how many people does this feed? Essential for the family/group filter.
- **Price per person**: $45 / 4 = $11.25/person. Important for price filtering.
- **In-app filter**: user explicitly asked for option to search for family/group meals.

Options for handling:

**Option G1: `serves` field only**
- Add `serves: INTEGER` to dishes (default 1)
- Family/group filter: `WHERE serves >= 2`
- Price filter uses total price (not per-person)

**Option G2: `serves` + `serving_style` combined field**
- Add `serves: INTEGER` (default 1)
- Add `serving_style: 'individual' | 'shared' | 'family'`
- `individual` (serves=1): standard dish
- `shared` (serves=1): small plate / tapas
- `family` (serves≥2): family meal, party platter
- Family filter: `WHERE serving_style = 'family'`

**Option G3: `serves` + price-per-person computed field**
- Add `serves: INTEGER` (default 1)
- Add `price_per_person: NUMERIC` (computed: price / serves, stored or virtual)
- Price filter can optionally use price_per_person instead of total price
- Family filter: `WHERE serves >= 2`

---

## Comprehensive Comparison

### Small Plates: S1 vs S2

| Aspect | S1 (category only) | S2 (+ serving_style) |
|--------|--------------------|-----------------------|
| Structural complexity | None | One new enum field |
| Menu presentation | Groups by category name (works) | Can add "Small Plate" badge, "Order 3-4 to share" hint |
| Recommendation engine | No awareness of shared dining style | Could boost shared plates when user is dining with group (Eat Together feature) |
| Filter capability | Can't filter for "tapas-style dining" | **Can filter `serving_style = 'shared'`** |
| AI extraction | No extra work | GPT would need to infer sharing intent — moderate difficulty |
| Is it needed now? | Sufficient for MVP | Nice-to-have for Eat Together feature |

### Group Meals: G1 vs G2 vs G3

| Aspect | G1 (serves only) | G2 (serves + serving_style) | G3 (serves + price_per_person) |
|--------|-------------------|----------------------------|-------------------------------|
| Family/group filter | `serves >= 2` — works | `serving_style = 'family'` — more semantic | `serves >= 2` — works |
| Small plates integration | Can't distinguish shared plates (serves=1) | **Unifies small plates + group meals in one model** | Can't distinguish shared plates |
| Price filter for groups | Total price ($45) — user must do mental math | Total price ($45) | **Can filter by $/person ($11.25) — much more useful** |
| Map pin for family meal | "Family Feast · $45" | "Family Feast · $45 (serves 4)" | **"Family Feast · $45 ($11.25/person)"** |
| Eat Together feature | Can find group-size dishes | Can find shared + group dishes | Can find group dishes + show per-person cost |
| Data model additions | 1 field | 2 fields | 2 fields (or 1 field + computed column) |
| Admin burden | Set serves count | Set serves + serving_style | Set serves (price_per_person auto-computed) |

---

## Combined Recommendation: G2 + G3 (serves + serving_style + price_per_person)

### Proposed Fields

| Field | Type | Default | Purpose |
|-------|------|---------|---------|
| `serves` | INTEGER | 1 | How many people this feeds |
| `serving_style` | ENUM | 'individual' | 'individual' \| 'shared' \| 'family' |
| `price_per_person` | NUMERIC | NULL | Computed: price / serves. Stored for query performance. |

### How Each Pattern Maps

| Dish Type | serves | serving_style | price | price_per_person | Example |
|-----------|--------|---------------|-------|-----------------|---------|
| Standard dish | 1 | individual | $15 | $15 | Steak |
| Small plate / tapa | 1 | shared | $7 | $7 | Patatas Bravas |
| Dim sum item | 1 | shared | $5 | $5 | Har Gow (3 pcs) |
| Family meal (fixed) | 4 | family | $45 | $11.25 | Family Feast |
| Party platter | 6 | family | $60 | $10 | Sushi Platter |
| Meal for 2 | 2 | family | $35 | $17.50 | Couple's Special |
| Buffet variant | 1 | individual | $25 | $25 | Buffet — Seafood |
| Combo meal | 1 | individual | $12 | $12 | Lunch Combo — Chicken |

### App Filter Implementation

**New daily filter: "Group / Family Meals"**
- Toggle on → `WHERE serving_style = 'family'` (or `serves >= 2`)
- Shows dishes designed for groups
- Map pins show per-person price: "Family Feast · $45 ($11.25/person)"

**Price filter enhancement (optional, future):**
- Option to filter by "price per person" instead of "dish price"
- When enabled: family meal at $45 (serves 4) matches $10-$15/person filter
- Prevents family meals from being excluded by individual-budget price filters

**Eat Together feature integration:**
- When in group dining mode, boost `serving_style = 'shared'` and `'family'`
- Group of 4 → boost dishes with `serves >= 4`
- Show per-person price breakdown

### Menu View Presentation

```
── Small Plates / Tapas ──────────────
  Patatas Bravas .............. $7    [shared]
  Gambas al Ajillo ........... $9    [shared]
  Croquetas .................. $6    [shared]
  💡 Order 3-4 plates to share

── Family Meals ──────────────────────
  Family Feast (serves 4) .... $45   [$11.25/person]
    Includes: 4 tacos + rice + beans + salsa
  Party Platter (serves 6) ... $60   [$10/person]
    Includes: 12 rolls + edamame + miso soup
```

### Recommendation Engine Impact

| Aspect | How it works |
|--------|-------------|
| Hard filter | `WHERE serving_style = 'family'` when group filter toggled |
| Soft boost | +0.15 for `serving_style = 'family'` when Eat Together session active |
| Soft boost | +0.10 for `serving_style = 'shared'` when Eat Together with 3+ people |
| Price filter | Optionally use `price_per_person` instead of `price` for group meals |
| Map pin | "Family Feast · $45 ($11.25/pp)" when serves > 1 |
| Diversity | Standard rules — family meals are just dishes with extra metadata |

### Why This Approach Wins

1. **No structural changes** — small plates and family meals are standard dish rows with 2 extra metadata fields
2. **Enables the family/group filter** the user requested
3. **Price per person** solves the problem of family meals being excluded by individual price filters
4. **Unifies small plates + group meals** under one `serving_style` field
5. **Eat Together integration** — group dining mode can boost shared/family dishes
6. **Minimal AI extraction burden** — GPT can detect "serves 4", "for sharing", "family" from menu text
7. **No new patterns** — everything stays in the dish table, no parent/variant needed (unless the family meal is configurable, in which case combo pattern applies)
