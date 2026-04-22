# User-provided Menu Pattern Taxonomy

Supplied by user on 2026-04-22 as design input for the Kind redesign.
User note: "this list is too long, but we can also consider some of those patterns."

## Core patterns (11)

| # | Pattern | Description | Examples |
|---|---|---|---|
| 1 | **Standard (Fixed Item)** | Single dish, fixed composition, fixed price | steak, salad, sushi roll |
| 2 | **Customizable (Add-ons)** | Base dish with optional additions/modifiers | burger + extra cheese, ramen + egg, pizza toppings |
| 3 | **Template / Matrix** | Dish created by selecting from predefined dimensions | protein + sauce, pasta + sauce, sushi (fish + style) |
| 4 | **Build-Your-Own** | Multi-step construction | poke bowl, salad builder, burrito bowl |
| 5 | **Variant (Size / Quantity)** | Same dish in different sizes/quantities | S/L pizza, 6 vs 12 wings, 1 vs 3 tacos |
| 6 | **Combo / Set** | Bundle of multiple items | burger+fries+drink, bento, lunch combo |
| 7 | **Experience (Format-based)** | Dining experience rather than a single dish | hot pot, Korean BBQ, fondue, buffet, tasting menu |
| 8 | **Small Plates / Shared** | Many small dishes meant for sharing | tapas, dim sum, mezze |
| 9 | **Specials / Dynamic** | Changes frequently or variable availability | daily specials, seasonal, chef specials, market price |
| 10 | **Group / Bulk** | Multiple people or large portions | family meals, party platters, catering |
| 11 | **Add-ons / Sides** | Auxiliary items complementing mains | fries, rice, sauces, bread |

## Edge / combined patterns

- **Experience + Build-Your-Own** — hot pot (broth + meats + vegetables), fondue
- **Experience + Template** — Korean BBQ (choose meats), some tasting menus
- **Template + Variant** — pizza (size + toppings), sandwiches (size + fillings)
- **Template + Customizable** — sushi rolls with optional extras, pasta with add-ons
- **Build-Your-Own + Variant** — bowl (regular/large) + ingredient choices
- **Combo + Customizable** — combo meal where user picks sides or drink
- **Combo + Variant** — small/large combo meals, family vs individual sets
- **Small Plates + Experience** — dim sum carts, tapas bars
- **Specials + Any Pattern** — seasonal ramen (standard), seasonal tasting menu (experience)
- **Market Price** — seafood priced per market rate (dynamic pricing variant)
- **Tiered Pricing** — "1 for $5, 12 for $50"
- **Multi-Entity Dish** — sampler platters, mixed grills (composite identity)
- **Progressive Course Structure** — tasting menu courses served in sequence
- **Category-Level Options** — spice level applies to all curries
- **Shared Add-ons Across Dishes** — global "add rice / soup / sauce"
- **Time-Based Availability** — breakfast menu, lunch specials
- **Location/Context-Based Menu** — different menu per branch, regional variations
- **Limited / Rotating Menu** — seasonal, weekly specials
- **Buffet / Unlimited Consumption** — pay for access
- **Predefined Course Bundles** — chef tasting, set menu
- **Hybrid Menus** — restaurant with standard + BYO + combos

## Interpretation for this cycle

This taxonomy reinforces the finding that "kind" is overloaded. Key observations:

1. **Many patterns are compositions of orthogonal axes** (confirmed by the edge/combined list). A pure "kind" enum covering all combinations would explode. A dish can simultaneously be: `template` × `variant` × `specials` × `shared-add-ons`.

2. **Some patterns are really states, schedules, or relations**, not composition shapes:
   - Specials / Dynamic → **state/schedule** (lifecycle, availability)
   - Time-Based Availability → **schedule**
   - Location-Based → **scope**
   - Market Price → **price-type flag**
   - Tiered Pricing → **price-tier relation**
   - Shared Add-ons → **cross-dish relation**
   - Category-Level Options → **option inheritance / menu-level**

3. **Composition shapes reduce to ~5–6 fundamentals:**
   - **Single** — standard (fixed item)
   - **Variant** — size/quantity of the same item
   - **Bundle** — combo/set/bento
   - **Configurable** — template/matrix/build-your-own
   - **Experience / Format** — hot pot, AYCE, tasting (group dining / interactive)
   - (**Add-on / Side** — debatable: standalone small item, OR a modifier that attaches to parents. Maybe both.)

4. **Must-model (from Q2) maps cleanly to this set:**
   - Q2.1 prix-fixe → `experience` (course-sequence subtype)
   - Q2.2 prix-fixe-with-choice → `experience` + per-course configurable slots
   - Q2.3 family-style mix-and-match → `configurable` + `group/bulk` portion size
   - Q2.4 buffet/AYCE → `experience` (flat-rate subtype) OR its own kind
   - Q2.9 beverage structures (wine by glass/bottle) → `variant` (same wine, different pour size)
   - Q2.10 build-your-own with dynamic base pricing → `configurable` + per-slot price_delta

The redesign question becomes: does `experience` split further (course-sequence vs. flat-rate) or stay a parent kind with a `subtype` field? That's a design decision for later, not a scoping one.
