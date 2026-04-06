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

