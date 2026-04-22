# External Research — Real-World Menu Taxonomies

## Canonical menu structures observed in the wild

Grouped by *compositional shape* (the thing that matters for an enum).

### A. Single-item structures
- **À la carte / Standard** — one dish, one price. Baseline.
- **Size variants** — same dish at multiple sizes (S/M/L; 6"/12"). Usually modeled as price variants rather than separate dishes.
- **Preparation variants** — same item, different prep (steak temp, egg style). Usually a modifier.
- **Kids portion** — smaller portion; often its own section or a variant.

### B. Fixed composites (one price, multiple components)
- **Combo / Meal deal** — Main + side + drink, bundled. Can be fixed or "choose your side."
- **Bento / Thali / Teishoku / Set meal** — tray with fixed components.
- **Prix fixe / Table d'hôte** — multi-course, single price.
- **Platter / Combination plate** — mixed grill, fajitas for two.

### C. Multi-course (sequence matters)
- **Tasting menu / Chef's / Omakase** — 5–20 courses, fixed sequence, no choice.
- **Prix fixe with choice** — N courses, 2–4 options per course.
- **Degustation with pairing** — tasting + wine/beverage pairing as coupled upgrade.

### D. Build-your-own / Configurable
- **Modular bowl / salad / burrito** — choose base → protein → toppings → sauce (Chipotle, Sweetgreen, poke).
- **Pizza / pasta builders** — crust → sauce → N toppings.
- **Cocktail builders** — spirit → mixer → garnish.

### E. Shareables / portion-variable
- **Shareable / Family-style** — sized for 2+.
- **Tapas / Mezze / Small plates** — structurally à la carte; sharing is convention.
- **Dim sum / cart service** — many small items; distinctive ordering UX.

### F. Buffet / AYCE
- **Buffet** — flat-price admission, unlimited access. Sometimes tiered (lunch vs. dinner vs. weekend brunch).
- **AYCE with ordered rounds** — Korean BBQ, churrascaria, AYCE sushi. Flat price, items ordered from menu.

### G. Beverage programs (structurally distinct)
- **By-the-bottle wine** — priced by glass / half-bottle / bottle / magnum; vintage-dependent.
- **Wine/tasting flights** — fixed set of 3–5 pours at one price.
- **Cocktail vs. mocktail vs. NA** — alcohol axis orthogonal to structure.
- **Beer on tap** — rotating availability; sized by half-pint / pint / pitcher.

### H. Temporally-gated
- **Happy hour** — discounted prices during hours; sometimes a separate short menu.
- **Brunch / breakfast / lunch / dinner / late-night** — different menus per daypart.
- **Seasonal / LTO** — start/end dates (pumpkin spice, summer menu).
- **Daily specials** — chalkboard-style rotating.

### I. Modifiers / add-ons
- **Add protein** — "+chicken $4, +shrimp $6" on any salad.
- **Upgrade** — swap fries for side salad (+$2).
- **Extras** — extra cheese, guac (always extra).
- **Allergen substitutions** — GF bun, dairy-free milk (sometimes free, sometimes +$).

### J. Non-food items on the menu
- **Merchandise / retail** (cookbook, hot sauce).
- **Gift cards.**
- **Service fees / cover / couvert.**

## Established taxonomies (quick scan)

| System | Model | "Kind" field? |
|---|---|---|
| **Schema.org** | `Menu → MenuSection → MenuItem`; `menuAddOn` for modifiers; `offers`+`priceSpecification` | No — composition via `menuAddOn` / nesting. Prix fixe = MenuItem with course list in description, or a MenuSection. |
| **Google Business Profile** | Follows Schema.org closely | No |
| **Toast POS** | `Menu → MenuGroup → MenuItem → ItemGroup (modifier groups)` with min/max/required | No explicit kind. Combos = parent item with required modifier groups pointing to component items. Size = native variant. |
| **Square** | `Category → Item → Variation → ModifierList` | No first-class "kind"; `Combo` is a dedicated item type in some regions. |
| **DoorDash / Uber Eats** | Heavy required/optional modifier groups; dietary tags; promotional pricing layers | No. Tasting menu = single item with long description. |
| **Resy / OpenTable** | Menus are often PDFs; Resy has "experiences" as a separate entity (ticketed dinners) | Separate entity, not a dish kind. |
| **OpenMenu XML** | `Menu/Section/Item` with ingredients/nutrition first-class | No kind discriminator. |

**Industry pattern:** `Section → Item → Modifier Groups → Modifiers` is near-universal. "Kind" as a first-class enum is **rare** — most systems represent variation via composition (modifier groups, variants, template/combo items) rather than a discriminator.

## Orthogonal axes (key insight)

Many "kinds" above are combinations of orthogonal axes. Collapsing them onto one enum creates explosion (combo × kids × happy-hour × shareable = 16 values just for that corner). Proposed axes:

| Axis | Values | What it captures |
|---|---|---|
| **1. Composition shape** | `single`, `bundle`, `course_sequence`, `configurable`, `buffet` | This is what "kind" should actually mean |
| **2. Choice structure** | none / choice-per-slot / free-selection | Within a composition |
| **3. Portion / shareability** | individual / shareable / family-style / per-person | Independent of kind |
| **4. Temporal availability** | always / daypart / hour-gated / date-range / daily | Schedule, not kind |
| **5. Audience** | general / kids / senior / vegan-sub-menu | Audience tag |
| **6. Item type** | food / non-alcoholic bev / alcoholic bev / retail / service fee | Type-of-thing |
| **7. Role in order** | standalone / modifier / upgrade | Relational |

## Is "Template" a kind or a state?

**State, not kind.** A "template" is a reusable shell that produces real dish records; the output dishes have their own actual kinds. Mixing `template` into the kind enum conflates publishing lifecycle with composition shape. Better modeled as:
- `status: draft | template | published | archived`, OR
- Separate `dish_template` table that dishes reference via `template_id`.

Toast and Square both separate "item library / template" from published menu items.

## Recommended redesign direction

`kind` should capture **composition shape only** (Axis 1). Move other dimensions to dedicated fields:

- `status: draft | template | published | archived` — template is a state.
- `portions` / `serves` — shareability.
- `availability_window` — temporal (separate table or JSON).
- `audience_tags[]` — kids, etc.
- Option-level pricing → `modifier_group` relation with price_delta.

Plausible new `kind` enum: `single | bundle | course_menu | configurable | buffet | modifier` (5–6 values, each structurally distinct in composition and ordering).

- Current `standard` → `single`
- Current `combo` → `bundle`
- Current `experience` → `course_menu` or `buffet` (split — tasting menu and AYCE are different)
- Current `template` → `configurable` + `status=template` (split a conflated concept)

Tradeoff: migration touches every dish row + AI prompt + UI. Not cheap. But the conflations explain why current kinds "don't work well."

## UX patterns for AI-extracted menu review (admin tools)

- **Section-first grouping** — near-universal. Toast, Square, Popmenu, Slice group review by detected section with collapsibles.
- **Side-by-side source + parsed** — Popmenu / Toast onboarding: source image on left, parsed data on right; clicking parsed item highlights source region.
- **Inline edit vs. side panel** — ~50/50. Square: inline for quick fields, modal for complex. Toast: full-page edit.
- **Confidence scores** — rare in consumer tools; common in dedicated digitization services (Chowly, MustHaveMenus). Usually a colored badge, not raw %.
- **Bulk operations** — Toast/Square both support multi-select for bulk category reassignment, price adjustment (%), tag application.
- **Duplicate detection** — flag same-name across sections; merge action.
- **Accept-all / reject-all per section** — common after spot-check.
- **Progressive disclosure** — name/price/description/section prominent; modifiers/variants/allergens/nutrition behind "advanced" tabs.

**Sources:** schema.org/Menu, Toast Developer Docs, Square Catalog API, DoorDash Merchant API, Uber Eats Menu API, Google Business Profile Food Menu schema, OpenMenu XML, Popmenu / Chowly product docs.
