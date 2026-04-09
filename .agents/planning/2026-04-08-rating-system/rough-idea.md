# Rough Idea: Rating System Redesign

## User's Request
I want to implement a rating system for this app. Each dish (and each restaurant) should have its own rating. We need to come up with a rating system thinking from First Principles about the app user (customer). Currently there's some kind of rating implemented, but it should be replaced by a better one. Please do research to decide which type of rating will be the most suitable for our application.

## Current State
The app (EatMe) currently has a fully implemented rating system consisting of:

### Dish Ratings (3-tier opinion system)
- Users rate dishes as `liked`, `okay`, or `disliked`
- Optional tags: flavor, portion, presentation, value, fresh (positive) / too_salty, too_bland, portion_small, not_fresh, not_as_described (negative)
- Optional photo upload
- Aggregated as "like percentage" (e.g., "85% liked, 12 ratings")

### Restaurant Feedback (5 yes/no questions)
- service_friendly, clean, wait_time_reasonable, would_recommend, good_value
- Each question gets a boolean response
- Aggregated as percentage per question type

### Supporting Infrastructure
- User visits tracking (links ratings to specific visits)
- Points gamification system (10-20 points per action)
- Session-based prompting (shows rating banner for recently viewed restaurants)
- Materialized views for aggregated display (dish_ratings_summary, restaurant_ratings_summary)
- Batch fetching APIs for efficient data loading

### Key Files
- `apps/mobile/src/services/ratingService.ts` — Core submission pipeline
- `apps/mobile/src/services/dishRatingService.ts` — Dish rating display
- `apps/mobile/src/services/restaurantRatingService.ts` — Restaurant rating display
- `apps/mobile/src/types/rating.ts` — Type definitions
- `apps/mobile/src/components/rating/*.tsx` — UI components (7 files)
- `apps/mobile/src/components/DishRatingBadge.tsx` — Inline dish display
- `apps/mobile/src/components/RestaurantRatingBadge.tsx` — Restaurant display

## Goal
Research and design a better rating system from first principles, considering:
- What the app user (food discovery customer) actually needs
- Which rating model best serves dish-level and restaurant-level evaluation
- How to replace the current system with something more suitable
