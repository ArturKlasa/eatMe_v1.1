# Rough Idea: Universal Dish Structure

## Problem
The current restaurant/menu/dish/ingredient structure is not universal enough. We need a "one fits all" solution that can represent the wide variety of dish patterns found across different restaurant types.

## Current State
- Restaurant types are reasonably well covered
- Most restaurants have just one menu (acceptable)
- **Dish structure is the main pain point** — many restaurants have fundamentally different dish structures

## Core Dish Patterns to Support

### Standard (Fixed Item)
Single dish with fixed composition and fixed price.
Examples: steak, salad, sushi roll.

### Customizable (Add-ons)
Base dish with optional additions/modifiers.
Examples: burger with extra cheese, ramen with egg, pizza toppings.

### Template / Matrix
Dish created by selecting from predefined dimensions.
Examples: protein + sauce, pasta + sauce, sushi (fish + style).

### Build-Your-Own (Multi-step Construction)
User constructs dish through multiple steps.
Examples: poke bowl, salad builder, burrito bowl.

### Variant (Size / Quantity)
Same dish offered in different sizes or quantities.
Examples: small/large pizza, 6 vs 12 wings, 1 taco vs 3 tacos.

### Combo / Set
Bundle of multiple items sold together.
Examples: burger + fries + drink, bento box, lunch combo.

### Experience (Interactive / Format-based)
Dining experience rather than a single dish.
Examples: hot pot, Korean BBQ, fondue, buffet, tasting menu.

### Small Plates / Shared
Many small dishes meant for sharing.
Examples: tapas, dim sum, mezze.

### Specials / Dynamic
Items that change frequently or have variable availability.
Examples: daily specials, seasonal dishes, chef specials, market price.

### Group / Bulk
Designed for multiple people or large portions.
Examples: family meals, party platters, catering trays.

### Add-ons / Sides
Auxiliary items that complement main dishes.
Examples: fries, rice, sauces, bread.

## Edge / Combined Patterns

- **Experience + Build-Your-Own**: hot pot (choose broth, meats, vegetables), fondue.
- **Experience + Template**: Korean BBQ (choose meats), some tasting menus.
- **Template + Variant**: pizza (size + toppings), sandwiches (size + fillings).
- **Template + Customizable**: sushi rolls with optional extras, pasta with add-ons.
- **Build-Your-Own + Variant**: bowl (regular/large) + ingredient choices.
- **Combo + Customizable**: combo meal where user picks sides or drink.
- **Combo + Variant**: small/large combo meals, family vs individual sets.
- **Small Plates + Experience**: dim sum carts, tapas bars.
- **Specials + Any Pattern**: seasonal ramen (standard), seasonal tasting menu (experience).
- **Market Price (Dynamic Pricing Variant)**: seafood priced per market rate.
- **Tiered Pricing (Quantity Deals)**: "1 for $5, 12 for $50".
- **Multi-Entity Dish (Composite Identity)**: sampler platters, mixed grills.
- **Progressive Course Structure**: items served in sequence (tasting menu courses).
- **Category-Level Options**: choose spice level for all curries.
- **Shared Add-ons Across Dishes**: add rice, add soup, add extra sauce globally.
- **Time-Based Availability**: breakfast menu, lunch specials.
- **Location / Context-Based Menu**: different menu per branch, regional variations.
- **Limited / Rotating Menu**: seasonal menus, weekly specials.
- **Buffet / Unlimited Consumption**: pay for access rather than individual items.
- **Predefined Course Bundles**: chef tasting menu, set menu.
- **Hybrid Menus**: combination of multiple patterns within one menu.
