# MOB-09 — Rating System

## Overview

After visiting a restaurant, users are prompted to rate individual dishes and give overall feedback on the restaurant. Ratings improve the recommendation engine and are displayed back to future users via rating badges in the restaurant detail screen.

---

## Key Files

| File                                                    | Role                                                                                |
| ------------------------------------------------------- | ----------------------------------------------------------------------------------- |
| `apps/mobile/src/components/rating/RatingFlowModal.tsx` | Step-through modal: rate dishes → rate restaurant → earn points                     |
| `apps/mobile/src/services/ratingService.ts`             | Core DB operations: visits, dish opinions, restaurant feedback, points              |
| `apps/mobile/src/services/dishRatingService.ts`         | Read-side: `getDishRatingsBatch()` — average ratings per dish                       |
| `apps/mobile/src/services/restaurantRatingService.ts`   | Read-side: `getRestaurantRating()` — overall restaurant rating                      |
| `apps/mobile/src/stores/sessionStore.ts`                | Tracks viewed restaurants during a session to trigger rating prompts                |
| `apps/mobile/src/types/rating.ts`                       | TypeScript interfaces: `DishRatingInput`, `RestaurantFeedbackInput`, `PointsEarned` |

---

## Database Tables

| Table                      | Purpose                                                    |
| -------------------------- | ---------------------------------------------------------- |
| `user_visits`              | Records that a user visited a restaurant                   |
| `user_dish_opinions`       | Per-dish rating: score, photo, comment                     |
| `user_restaurant_feedback` | Overall restaurant rating + tags (ambiance, service, etc.) |
| `user_sessions`            | Tracks browsing sessions (used to group views)             |
| `rating_points`            | Gamification: points earned per rating action              |

---

## Rating Trigger — When the Prompt Appears

The `RatingFlowModal` is rendered inside `BasicMapScreen`. It appears when:

1. The user has returned to the map after viewing a restaurant
2. `sessionStore.getRecentRestaurantsForRating()` returns restaurants that were viewed
3. `isFirstVisitToRestaurant(userId, restaurantId)` confirms the user has not rated it before

```
User navigates back to map from RestaurantDetailScreen
  → sessionStore.recentRestaurants checked
  → For each recent restaurant:
    → isFirstVisitToRestaurant() query
    → If first visit: show RatingFlowModal
  → Modal is shown once per restaurant per session
```

---

## Rating Flow (Step-Through Modal)

The `RatingFlowModal` walks the user through rating in steps:

### Step 1 — Dish Ratings

Shows each dish that was tracked as viewed during the restaurant visit. For each dish, the user can:

- Give a thumbs up / thumbs down / neutral
- Add a photo (optional) → uploaded to Supabase Storage

```
User rates a dish
  → dishRatingInput: { dishId, restaurantId, score: 1|-1|0, photoUri? }
  → If photoUri: uploadPhoto(uri, 'dish', userId) → returns publicUrl
  → Stored temporarily until Step 3 submission
```

### Step 2 — Restaurant Feedback

Overall restaurant rating:

- Star rating (1–5)
- Category tags: ambiance, service, value, food quality
- Optional text comment

### Step 3 — Submission

```
User taps "Submit Ratings"
  → createUserVisit(userId, restaurantId, sessionId)
    → INSERT INTO user_visits
  → For each dish rating:
    → submitDishRating(dishRatingInput, visitId)
      → INSERT INTO user_dish_opinions
  → submitRestaurantFeedback(feedbackInput, visitId)
    → INSERT INTO user_restaurant_feedback
  → Award points for participating:
    → Points for each dish rated
    → Bonus points for photo uploads
    → Points for restaurant feedback
    → INSERT INTO rating_points
  → RatingFlowModal closes
  → Success animation / points summary shown
```

---

## Rating Display

### Dish Rating Badge

`DishRatingBadge` appears on each dish card in `RestaurantDetailScreen`. It shows the average opinion score (percentage of likes):

```
getDishRatingsBatch(dishIds)
  → SELECT AVG(score), COUNT(*) FROM user_dish_opinions WHERE dish_id IN (...)
  → Returns Map<dishId, { averageScore, totalRatings }>
```

### Restaurant Rating Badge

`RestaurantRatingBadge` appears in the restaurant header:

```
getRestaurantRating(restaurantId)
  → SELECT AVG(overall_rating), COUNT(*) FROM user_restaurant_feedback WHERE restaurant_id = ?
  → Returns { averageRating, totalRatings, breakdown }
```

There is also a `live_restaurant_ratings` view (migration `033`) that pre-aggregates ratings for performance.

---

## Photo Upload

When a user includes a photo with a rating:

```
uploadPhoto(photoUri, 'dish' | 'restaurant', userId)
  → fetch(photoUri) → ArrayBuffer
  → supabase.storage.from('photos').upload(filePath, arrayBuffer)
  → Returns public URL stored alongside the rating record
```

Photos are stored in the `photos` Supabase Storage bucket under `dish_photos/` or `restaurant_photos/`.

---

## Session Store — View Tracking

`sessionStore` tracks what the user sees during a session:

```typescript
trackRestaurantView(restaurant); // Called on RestaurantDetailScreen mount
trackDishView(restaurantId, dish); // Called when a dish card is tapped
```

This data is:

- Persisted to AsyncStorage (survives backgrounding)
- Used to determine which restaurants to prompt for ratings
- Synced to Supabase `user_sessions` table when a session starts/ends

---

## Gamification / Points

Users earn `rating_points` for completing ratings. The points system:

- Encourages engagement and high-quality data
- Points are displayed on the Profile screen (planned: leaderboard)
- Point values are configured in `ratingService.ts`

The specific point amounts per action are defined in the service and can be tuned without a schema change.
