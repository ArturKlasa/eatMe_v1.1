# Terminology

## Restaurant Types

- **Restaurant**: Any food establishment (restaurant, cafe, food truck, etc.)
- **Owner**: Restaurant operator who manages their profile via the web portal
- **Onboarding**: Multi-step wizard for restaurant owners to register and set up their menu

## Dish Concepts

- **Dish Kind**: Category of dish — `food`, `drink`, `dessert`
- **Menu Category**: Grouping within a menu (e.g., "Appetizers", "Main Course", "Beverages")
- **Dish Options**: Variants of a dish (e.g., size, spice level) with optional price modifiers
- **Enrichment**: AI-generated descriptions, tags, and embeddings for dishes

## Dietary & Allergens

- **Dietary Tags**: Labels like `vegetarian`, `vegan`, `gluten-free`, `halal`, `kosher`
- **Allergens**: FDA top-9 allergens auto-calculated from ingredients via Postgres triggers
- **Ingredients Master**: Curated ingredient list with pre-mapped allergen and dietary metadata

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
