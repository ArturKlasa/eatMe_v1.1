# Database Schema Research

## Overview
- 36 core tables, 5 materialized views
- PostgreSQL with PostGIS + pgvector extensions
- Supabase-managed auth

## Tables (grouped by domain)

### Core Restaurant/Menu
- restaurants — Location (PostGIS), ratings, cuisine_types, hours, services, vector embedding
- menus — Food/drink menus with time-based availability
- menu_categories — Hierarchical menu sections
- dishes — Rich metadata: embeddings, enrichment status, protein families, option groups
- dish_categories — Taxonomy (appetizer, main, dessert, etc.) with parent hierarchy
- option_groups — Customization groups (size, toppings) with selection rules
- options — Individual options with price/calorie deltas

### Ingredient System
- canonical_ingredients — Master ingredient list with vegetarian/vegan flags
- ingredient_aliases — Multi-language alternative names with tsvector search
- dish_ingredients — Junction: dish ↔ canonical ingredient
- allergens — Standard allergen definitions (code, name, severity)
- dietary_tags — Dietary classifications (code, name, category)
- canonical_ingredient_allergens — Junction: ingredient ↔ allergen
- canonical_ingredient_dietary_tags — Junction: ingredient ↔ dietary tag

### User System
- users — Extended profiles (roles: consumer, restaurant_owner, admin)
- user_preferences — Dietary prefs, allergies, exclusions, religious restrictions, ingredients to avoid
- user_behavior_profiles — Aggregated metrics + preference_vector (pgvector 1536)
- user_points — Gamification (dish_rating, photo, streak bonuses)

### Interactions & Analytics
- user_swipes — Swipe interactions (left/right/super) with context
- user_sessions — App session tracking
- session_views — Entity views within sessions
- user_dish_interactions — All dish interactions (viewed, liked, disliked, ordered, saved)
- dish_opinions — Ratings with tags and photo links
- dish_photos — User-uploaded photos
- dish_analytics — Engagement metrics (views, swipes, trending)
- user_visits — Restaurant visit records
- restaurant_experience_responses — Post-visit survey (service, cleanliness, value)
- favorites — Dish/restaurant favorites

### Eat Together
- eat_together_sessions — Group sessions (status, location_mode, 3h expiry)
- eat_together_members — Session members with live GPS location
- eat_together_votes — Restaurant votes
- eat_together_recommendations — Scored recommendations with dietary compatibility

### Admin & System
- admin_audit_log — Admin action tracking
- security_documentation — Security notes
- menu_scan_jobs — OCR processing jobs with status tracking

## Materialized Views
- admin_dashboard_stats — Restaurant/dish/user counts
- dish_ratings_summary — Aggregated dish ratings and tags
- restaurant_ratings_summary — Experience rating percentages

## Custom Types (Enums)
- user_roles: consumer | restaurant_owner | admin
- session_status: waiting | recommending | voting | decided | cancelled | expired
- location_mode: host_location | midpoint | max_radius
- subject_type: dish | restaurant

## Key PostgreSQL Functions
- generate_candidates — Feed generation (PostGIS + vector ANN, 11 params)
- get_group_candidates — Group recommendation candidates
- recalculate_user_profile / recalculate_all_profiles
- get_nearest_restaurants / restaurants_within_radius
- refresh_materialized_views
- generate_session_code / get_vote_results
- is_admin / log_admin_action / add_user_role

## Design Patterns
- Vector embeddings (pgvector 1536-dim) for dishes, restaurants, users
- PostGIS for geospatial queries (ST_DWithin, ST_Distance)
- Soft deletes via is_active flags
- Flexible enrichment pipeline (none/pending/completed/failed)
- Dietary/allergen arrays with canonical ingredient resolution
- Gamification with point types and milestones
