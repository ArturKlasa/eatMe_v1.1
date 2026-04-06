# Idea Honing: Universal Dish Structure

## Requirements Clarification

### Q1: Who is the primary user creating/managing these dish structures?

**Proposed answer (based on codebase research):**

There are three data entry paths, in likely order of importance:

1. **Admins via AI menu scan** — The most sophisticated path. Admins upload menu photos/PDFs, GPT-4o Vision extracts dishes/prices/ingredients, results are reviewed and confirmed. This is likely the primary bulk-import method.
2. **Admins via manual entry** — Admin panel at `/admin/restaurants/new` and `/admin/menu-scan` allows full CRUD on restaurants, menus, dishes, ingredients, and dish categories.
3. **Restaurant owners via onboarding wizard** — Owners sign up, go through `/onboard/` flow (basic info → menu/dish creation → review). They can only edit their own restaurant (RLS enforced via `owner_id`).

The mobile app is **consumer-facing only** — no data creation for restaurants.

**Implication for this redesign:** The new structure needs to be representable in all three paths — AI-extractable from menu images, manageable by admins, and enterable by restaurant owners. The AI extraction path is the most constrained since GPT needs to output structured data matching our schema.

**Confirmed by user.** Future plan: restaurant owners may also get access to AI menu scan, but not yet.

### Q2: From the consumer (mobile app) perspective, what does the user actually need to see and interact with for these complex dish types?

**Answer:**

The app no longer has swipe functionality. Current flow:
- **Main screen**: Map with 5 pins (option to load more), each pin = a recommended dish (main dishes, but also salads etc. can qualify)
- **On pin click**: User goes to **restaurant menu screen** showing the full menu of that restaurant
- **Menu screen must have excellent presentation** — easy to read, with nice presentation for complex types (e.g., "pick your protein" dishes)

**Critical dual requirement:**
1. **Frontend (menu view)**: Needs to present complex dish types in a readable, user-friendly way
2. **Backend (recommendation engine)**: Needs dish data stored in a format that allows the recommendation mechanism to recommend individual dish configurations — e.g., each protein combination for a "pick your protein" dish might be stored as a separate database entry (or similar approach that makes each recommendable variant individually addressable)

**Key insight:** The data model must serve two masters — clean presentation AND granular recommendation. These may require different "views" of the same underlying data.

### Q3: How specific should recommendations be — base dish, fully resolved variant, or either?

**Proposed answer: Option A — recommend fully resolved variants. Here's why:**

The recommendation engine relies heavily on per-dish attributes for both hard filtering and soft ranking:

**Hard filters that break without resolved variants:**
- A "Poke Bowl" base dish can't answer "is this vegan?" — it depends on whether you pick tofu or salmon. A vegan user's allergen/diet hard filter would either wrongly exclude the whole dish, or wrongly include a non-vegan variant.
- Same for allergens (salmon = fish allergy), protein family exclusions (`noFish`), religious restrictions (halal/kosher meat choices).

**Soft boosts that lose precision without resolved variants:**
- Protein type boost (+0.20) and meat subtype boost (+0.10) need to know the specific protein
- Price can vary by variant (salmon bowl vs tofu bowl)
- Calories differ per variant
- The 1536-dim preference vector embedding would be too generic for a base dish — "Poke Bowl with Salmon" and "Poke Bowl with Tofu" attract fundamentally different user profiles

**The recommendation pin on the map should say "Poke Bowl with Salmon" not just "Poke Bowl"** — this is more compelling, more specific, and matches what the engine actually scored.

**But we need a parent-child relationship** so the menu view can group all variants back under one presentable "Poke Bowl" entry with its options shown nicely underneath.

**Confirmed by user.**

### Q4: How should we handle the "variant explosion" problem?

Full analysis: [research/variant-explosion-analysis.md](research/variant-explosion-analysis.md)

**Chosen: Option 2 — Primary Dimension**

Resolve only the primary choice (usually protein) into separate dish rows. All secondary choices (sauce, size, toppings) stay as option_group metadata. Use `parent_dish_id` FK to group variants for menu display.

Full analysis with comparison tables: [research/variant-explosion-analysis.md](research/variant-explosion-analysis.md)

**Scale at 100K restaurants:** ~7.8M rows, ~75 GB storage, ~$1,840 one-time embedding cost (manageable per user).

**Cons to address in design:**
1. Need clear guidelines per dish_kind for identifying primary dimension
2. Secondary choices (sauce, toppings) invisible to recommendation — acceptable trade-off
3. Price/calorie of secondary options not filterable — acceptable, base price is most relevant
4. Parent-child model adds complexity — needed for menu grouping regardless
5. Build-your-own with no clear primary axis — define fallback rules
6. Maintenance: new protein = new variant row + embedding — document process

**Confirmed by user.**

### Q5: Which menu-level patterns are in scope?

**Answer:**

| Pattern | In scope? | Notes |
|---------|-----------|-------|
| Time-based availability (breakfast/lunch/dinner) | **Yes** | |
| Location/context-based menu (per branch) | **No** | Not relevant |
| Specials / dynamic — daily menu | **Yes** | "Daily Menu" feature: option to filter and see only daily menus |
| Specials / dynamic — seasonal | **No** | Not important now |
| Specials / dynamic — market price | **No** | Not important now |
| Buffet / unlimited consumption | **Yes** | |
| Limited / rotating menu | **Yes** | |

### Q6: How should time-based availability work?

**Chosen: Option A — time fields on the menu level.**

Fields on `menus` table:
- `available_from`: TIME (nullable, null = all day)
- `available_until`: TIME (nullable)
- `available_days`: TEXT[] (nullable, null = every day)

Separate from time: `menu_type` field (`'regular' | 'daily' | 'rotating'`) for the "Daily Menu" filter feature.

Feed integration: one additional WHERE clause in `generate_candidates()`.

**Confirmed by user.**

### Q7: How should buffets / unlimited consumption be modeled?

**Chosen: Option C — Representative Variants (Primary Dimension = dietary profile)**

Apply the same parent + variant model. The "primary dimension" of a buffet is the dietary profile.

- Parent row: "Sushi Buffet" — `dish_kind: 'experience'`, display-only
- 3-5 variant rows per dietary profile (seafood, meat, vegan, etc.)
- Each variant has own allergens, dietary_tags, embedding
- Price: buffet price on each variant, `display_price_prefix: 'per_person'`
- Diversity cap: max 1 variant per parent (existing rule)

Full analysis: [research/buffet-model-analysis.md](research/buffet-model-analysis.md)

**Confirmed by user.**

### Q8: How should combo meals / set menus be modeled?

**Chosen: Option A — Combo as own entity (Primary Dimension = main dish)**

Same parent + variant pattern. Combos are first-class recommendable entities.

- Parent row: "Lunch Combo" — `dish_kind: 'combo'`, display-only
- Variant rows: "Lunch Combo — Chicken Burger", "Lunch Combo — Fish Burger", etc.
- Each variant has combo price ($12), own calories (full combo), allergens, dietary_tags, embedding
- Side/drink choices as option_groups
- Standalone dishes (e.g., "Chicken Burger · $9") exist separately — they're different products at different prices
- Engine picks whichever scores higher for the user

Key win: price filter correctly surfaces combo deals at combo price point.

Full analysis: [research/combo-model-analysis.md](research/combo-model-analysis.md)

**Confirmed by user.**

### Q9: How should small plates / shared and group / bulk meals be handled?

**Chosen: Metadata only — no structural changes.**

One new field:
- `serves`: INTEGER, default 1

Derived:
- `price_per_person`: computed (price / serves), never manually entered
- Family/group filter: `WHERE serves >= 2`
- Map pin for group meals: "Family Feast · $45 ($11.25/person)"

Small plates: no special field. Menu category name ("Tapas", "Small Plates") handles presentation. AI extraction / category inference covers any needed metadata.

`serving_style` dropped to minimize restaurant owner complexity — 95%+ of dishes use the default, and the rare family meals are covered by `serves` alone.

Full analysis: [research/small-plates-group-meals-analysis.md](research/small-plates-group-meals-analysis.md)

**Confirmed by user.**

### Q10: Should option_groups be shared across dishes (category-level) or duplicated per dish?

**Chosen: Option A — per-dish duplication (current approach)**

Keep option_groups linked per-dish. No shared/inherited option_groups.

- Storage difference is marginal (6 GB vs 1.6 GB in a 75 GB database)
- Avoids model complexity (no inheritance logic, no dual-source queries)
- AI extraction outputs per-dish options naturally
- Admin pain solved with UI tooling: "Copy options from dish" button + "Bulk update options"

Full analysis: [research/shared-option-groups-analysis.md](research/shared-option-groups-analysis.md)

**Confirmed by user.**

