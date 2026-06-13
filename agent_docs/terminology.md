# Terminology

## Restaurant Types

- **Restaurant**: Any food establishment (restaurant, cafe, food truck, etc.)
- **Owner**: Restaurant operator who manages their profile via the web portal
- **Onboarding**: Multi-step wizard for restaurant owners to register and set up their menu

## Dish Concepts

- **Menu Category**: Grouping within a menu (e.g., "Appetizers", "Main Course", "Beverages")
- **Modifier Groups**: `option_groups` + `options` — the sole composition/customization model. Sizes, add-ons, and bundle choices are all modifier groups with `price_delta`/`price_override`.
- **Dining Format**: Nullable UX hint on a dish (`buffet`, `course_menu`, `interactive_table`, `shared_plates`, `sampler`) that switches the mobile layout flavor. NULL = normal dish row.
- **Enrichment**: AI-generated descriptions, tags, and embeddings for dishes

> The legacy `dish_kind` / parent-variant dish model was dropped 2026-06-12 (migrations 158 + 163). Dishes are flat rows; never nest dishes under a parent.

## Food Classification

- **Primary Protein**: The single classification axis for dishes — a 12-value enum (`chicken`, `turkey`, `beef`, `pork`, `lamb`, `goat`, `other_meat`, `fish`, `shellfish`, `eggs`, `vegetarian`, `vegan`). Drives feed filtering + daily meat-type filters.
- **Protein Families**: Derived from `primary_protein` (`meat`, `poultry`, `fish`, `shellfish`, `eggs`) via `deriveProteinFields`. Power the protein-based diet filter — vegetarian = none of meat/poultry/fish/shellfish (eggs OK); vegan = `primary_protein = 'vegan'`.
- **Diet Preference**: User's `all` / `vegetarian` / `vegan` choice. Permanent = hard exclude (SQL `WHERE`); daily = soft re-rank (JS boost).

> Allergens, dietary-tag vocabularies, and the ingredient pipeline that fed them were **abandoned** (2026-06-05) — EatMe is a protein-based discovery app, not an allergen-safety app. See the root `CLAUDE.md`.

## Rating System

- **Dish Opinion**: User's rating of a dish — `liked`, `okay`, or `disliked`
- **Rating Tags**: Descriptive tags attached to opinions (e.g., "generous portions", "too salty")
- **In-Context Rating**: Quick opinion submitted while viewing a restaurant menu (as opposed to full rating flow)
- **Full Flow Rating**: Detailed rating with photos, notes, and tags via dedicated screen
- **Trusted Taster**: Badge earned after 20+ tagged ratings over 3+ months

## Gamification

- **Points**: Earned for rating dishes, adding photos, writing notes
- **Streak**: Consecutive weeks with at least one rating
- **Streak Bonus**: Extra points awarded at streak milestones (3, 7, 14 weeks)

## Menu Scanning

- **Menu Scan**: AI-powered workflow to extract dish data from uploaded menu photos/PDFs
- **Dish Group**: Cluster of extracted dishes grouped by menu section during scan review
- **Flagged Duplicate**: Dish detected as potentially duplicating an existing menu item

## Geography

- **Proximity Search**: Finding restaurants/dishes within a radius using PostGIS `ST_DWithin`
- **Feed**: Personalized dish recommendations scored by preference match, rating, and distance

## Pricing

- **Price Range**: Integer 1-4 scale ($ to $$$$) for restaurant-level pricing
- **Dish Price**: Exact price in local currency stored on each dish
