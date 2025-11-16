# Future Features & Enhancements

This document tracks features and fields that were removed from the initial MVP but should be considered for future phases.

## Database Schema Enhancements

### Profiles Table

#### `reward_points` field

**Removed:** 2025-11-13  
**Reason:** Gamification can wait for Phase 3  
**Priority:** Low  
**Description:** Points system to reward user engagement and encourage app usage.

**Example use cases:**

- Earn points for writing reviews (10 points)
- Earn points for adding photos (5 points)
- Earn points for trying new restaurants (20 points)
- Redeem points for discounts or special features
- Leaderboards and achievements

**Implementation notes:**

```sql
ALTER TABLE profiles
ADD COLUMN reward_points INTEGER DEFAULT 0;

CREATE INDEX profiles_reward_points_idx ON profiles(reward_points DESC);

-- Create rewards history table
CREATE TABLE reward_transactions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  points INTEGER NOT NULL,
  action_type TEXT, -- 'review', 'photo', 'visit', 'redeem'
  description TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
```

---

#### `learned_preferences` field

**Removed:** 2025-11-13  
**Reason:** ML/AI feature - Phase 2 or 3  
**Priority:** Medium  
**Description:** JSONB field storing learned user preferences for personalized recommendations.

**Example structure:**

```json
{
  "preferred_cuisines": ["Mexican", "Italian"],
  "avoided_allergens": ["peanuts"],
  "price_sensitivity": 0.7,
  "spice_tolerance": 3,
  "favorite_ingredients": ["avocado", "cilantro", "lime"],
  "dining_patterns": {
    "lunch_preference": "quick",
    "dinner_preference": "sit-down"
  },
  "location_patterns": {
    "home_area": { "lat": 19.43, "lon": -99.18 },
    "work_area": { "lat": 19.42, "lon": -99.17 }
  }
}
```

**Use cases:**

- Smart recommendations: "Based on your preferences..."
- Auto-apply filters user tends to use
- Predict what user wants based on time/location
- Improve search ranking based on history

**Implementation notes:**

```sql
ALTER TABLE profiles
ADD COLUMN learned_preferences JSONB DEFAULT '{}'::jsonb;

CREATE INDEX profiles_learned_preferences_idx
ON profiles USING GIN(learned_preferences);

-- Requires ML service to analyze:
-- - User's favorite history
-- - Review patterns
-- - Search/filter history
-- - Time and location patterns
```

---

### Restaurant Table

#### `cuisine_region` field

**Removed:** 2025-11-13  
**Reason:** Too specific for MVP  
**Priority:** Medium  
**Description:** Add back regional cuisine classification for more specific filtering and cultural context.

**Example values:**

- `Oaxaca` (regional Mexican)
- `Sichuan` (regional Chinese)
- `Tuscany` (regional Italian)
- `Northern Mexico`

**Use cases:**

- Advanced filtering: "Show me Oaxacan restaurants"
- Cultural recommendations: "You liked Oaxacan food, try these other Oaxacan places"
- Tourist education: Learn about regional cuisines

**Implementation notes:**

```sql
ALTER TABLE restaurants
ADD COLUMN cuisine_region TEXT;

CREATE INDEX restaurants_cuisine_region_idx ON restaurants(cuisine_region);
```

---

#### `local_cuisine_tags` field

**Removed:** 2025-11-13  
**Reason:** Redundant with `is_local_cuisine` boolean for MVP  
**Priority:** Low  
**Description:** Array of tags to identify authentic local/traditional restaurants.

**Example values:**

- `['street-food', 'traditional-mexican', 'family-recipe', 'cdmx-style']`
- `['grandmother-cooking', 'pre-hispanic', 'market-food']`
- `['local-favorite', 'hidden-gem', 'authentic']`

**Use cases:**

- "Local Experience" filter toggle
- Tourist vs local food distinction
- Authenticity scoring
- Social proof for travelers

**Implementation notes:**

```sql
ALTER TABLE restaurants
ADD COLUMN local_cuisine_tags TEXT[] DEFAULT ARRAY[]::TEXT[];

CREATE INDEX restaurants_local_cuisine_tags_idx
ON restaurants USING GIN(local_cuisine_tags);
```

---

## Future Phases

### Phase 2: Advanced Features

- [ ] User reviews system
- [ ] Master data tables (cuisines, allergens, ingredients)
- [ ] Auto-allergen tagging via ingredient_allergens junction table
- [ ] Restaurant operating hours sync
- [ ] Multi-language support
- [ ] `learned_preferences` for basic recommendations

### Phase 3: Intelligence & Gamification

- [ ] `reward_points` and full gamification system
- [ ] Advanced ML recommendations using learned_preferences
- [ ] `popularity_score` calculation algorithm
- [ ] User engagement metrics and analytics
- [ ] Achievements and badges system

### Phase 4: Data Enrichment

- [ ] `cultural_significance` field for dishes
- [ ] `preparation_methods` array for filtering
- [ ] `food_composition` JSONB for nutritional data
- [ ] Integration with nutrition APIs
- [ ] `cuisine_region` for regional filtering
- [ ] `local_cuisine_tags` for authenticity scoring

---

## Notes

- Review this document quarterly to re-prioritize features
- Consider user feedback when deciding what to implement
- Keep MVP lean and focused on core value proposition
- Start with usage analytics before implementing ML features
