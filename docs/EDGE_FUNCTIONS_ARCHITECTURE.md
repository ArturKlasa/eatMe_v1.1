# Server-Side Filtering Architecture with Supabase Edge Functions

**Date:** January 28, 2026  
**Status:** Proposed Design  
**Goal:** Move filtering from mobile client to server-side for better performance and scalability

---

## 📋 Table of Contents

1. [Current Architecture Problems](#current-problems)
2. [Proposed Architecture](#proposed-architecture)
3. [Technology Stack](#technology-stack)
4. [Implementation Plan](#implementation-plan)
5. [Database Schema Updates](#database-schema)
6. [Edge Functions Design](#edge-functions)
7. [Redis Caching Strategy](#redis-caching)
8. [Mobile App Changes](#mobile-changes)
9. [Performance Metrics](#performance)
10. [Migration Steps](#migration)

---

## 🔴 Current Architecture Problems {#current-problems}

### What Happens Now:

```
Mobile App
  ↓ Query ALL dishes (1000+)
  ↓ Transfer 5-10 MB of data
  ↓ Filter client-side (battery drain)
  ↓ Show 20 dishes
```

### Issues:

- ❌ **Excessive data transfer** - Wastes user's mobile data
- ❌ **Battery drain** - Complex filtering on mobile
- ❌ **Slow performance** - Processing 1000+ dishes
- ❌ **No caching** - Same query repeated constantly
- ❌ **Algorithm exposed** - Recommendation logic visible
- ❌ **No personalization** - Can't track behavior server-side
- ❌ **Scaling problems** - Won't work with 10,000+ dishes

---

## ✅ Proposed Architecture {#proposed-architecture}

### New Flow:

```
┌──────────────────────────────────────────────────────┐
│              Mobile App                              │
│  Sends:                                              │
│    • User location (lat, lng)                        │
│    • Filter preferences                              │
│    • User behavior context                           │
│                                                      │
│  Receives:                                           │
│    • 20 pre-filtered dishes                          │
│    • Match scores & reasons                          │
│    • ~50 KB of data                                  │
└──────────────────────────────────────────────────────┘
                      ↓ HTTPS
┌──────────────────────────────────────────────────────┐
│         Supabase Edge Function                       │
│         /functions/feed                              │
│                                                      │
│  1. Check Redis cache (5 min TTL)                   │
│  2. If miss: Query PostgreSQL                       │
│  3. Apply server-side filtering                     │
│  4. Apply ranking algorithm                         │
│  5. Cache result in Redis                           │
│  6. Return top 20 dishes                            │
│                                                      │
│  Runtime: Deno (TypeScript)                         │
│  Location: Edge (low latency)                       │
└──────────────────────────────────────────────────────┘
         ↓                        ↓
┌─────────────────┐      ┌─────────────────┐
│   PostgreSQL    │      │  Redis (Upstash)│
│   (Supabase)    │      │                 │
│                 │      │  • User sessions│
│ • Restaurants   │      │  • Feed cache   │
│ • Dishes        │      │  • Geo cache    │
│ • Ingredients   │      │  • Hot data     │
│ • User swipes   │      │                 │
└─────────────────┘      └─────────────────┘
```

---

## 🛠️ Technology Stack {#technology-stack}

### Core Technologies:

| Component          | Technology                     | Why                                         |
| ------------------ | ------------------------------ | ------------------------------------------- |
| **Database**       | Supabase PostgreSQL + PostGIS  | Already using, has geospatial support       |
| **Edge Functions** | Supabase Edge Functions (Deno) | Serverless, near users, TypeScript support  |
| **Cache**          | Upstash Redis                  | Serverless Redis, works with Edge Functions |
| **Mobile**         | React Native (Expo)            | Already using                               |
| **Auth**           | Supabase Auth                  | Already integrated                          |

### Why Upstash Redis?

- ✅ **Serverless** - No servers to manage
- ✅ **Edge compatible** - Works with Deno/Edge Functions
- ✅ **REST API** - Simple HTTP calls (no connection pooling needed)
- ✅ **Free tier** - 10,000 commands/day
- ✅ **Low latency** - Global regions
- ✅ **Pay-per-request** - Only pay for what you use

**Alternative:** Supabase doesn't have native Redis, but Upstash is the recommended solution for Edge Functions.

---

## 📊 Database Schema Updates {#database-schema}

### 1. User Swipe Tracking

```sql
-- Track every swipe for behavior learning
CREATE TABLE user_swipes (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  dish_id UUID REFERENCES dishes(id) ON DELETE CASCADE,
  action TEXT CHECK (action IN ('left', 'right', 'super')) NOT NULL,
  view_duration INTEGER, -- milliseconds spent viewing
  position_in_feed INTEGER, -- 1st, 2nd, 3rd dish shown
  session_id TEXT,
  context JSONB, -- time_of_day, filters_active, etc.
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for fast queries
CREATE INDEX user_swipes_user_id_idx ON user_swipes(user_id);
CREATE INDEX user_swipes_dish_id_idx ON user_swipes(dish_id);
CREATE INDEX user_swipes_created_at_idx ON user_swipes(created_at DESC);
CREATE INDEX user_swipes_action_idx ON user_swipes(action);

-- RLS policies
ALTER TABLE user_swipes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can insert their own swipes"
ON user_swipes FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can view their own swipes"
ON user_swipes FOR SELECT
TO authenticated
USING (auth.uid() = user_id);
```

### 2. User Behavior Profile (Aggregated)

```sql
-- Aggregated user preferences (updated periodically)
CREATE TABLE user_behavior_profiles (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,

  -- Swipe statistics
  total_swipes INTEGER DEFAULT 0,
  right_swipes INTEGER DEFAULT 0,
  left_swipes INTEGER DEFAULT 0,
  right_swipe_rate FLOAT GENERATED ALWAYS AS (
    CASE WHEN total_swipes > 0
    THEN right_swipes::float / total_swipes::float
    ELSE 0 END
  ) STORED,

  -- Preferences (learned from behavior)
  preferred_cuisines TEXT[] DEFAULT ARRAY[]::TEXT[],
  preferred_price_range FLOAT[], -- [min, max]
  avg_calories_viewed INTEGER,
  favorite_dish_ids UUID[],

  -- Metadata
  last_active_at TIMESTAMPTZ DEFAULT NOW(),
  profile_updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index
CREATE INDEX user_behavior_profiles_user_id_idx ON user_behavior_profiles(user_id);

-- RLS
ALTER TABLE user_behavior_profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own profile"
ON user_behavior_profiles FOR SELECT
TO authenticated
USING (auth.uid() = user_id);

CREATE POLICY "System can update profiles"
ON user_behavior_profiles FOR ALL
TO service_role
USING (true);
```

### 3. Dish Analytics (For Ranking)

```sql
-- Track dish popularity for recommendation scoring
CREATE TABLE dish_analytics (
  dish_id UUID PRIMARY KEY REFERENCES dishes(id) ON DELETE CASCADE,

  -- Engagement metrics
  view_count INTEGER DEFAULT 0,
  right_swipe_count INTEGER DEFAULT 0,
  left_swipe_count INTEGER DEFAULT 0,
  super_like_count INTEGER DEFAULT 0,

  -- Conversion metrics
  favorite_count INTEGER DEFAULT 0,
  order_count INTEGER DEFAULT 0,

  -- Calculated scores
  engagement_rate FLOAT,
  conversion_rate FLOAT,
  popularity_score FLOAT,

  -- Metadata
  last_updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index
CREATE INDEX dish_analytics_popularity_idx ON dish_analytics(popularity_score DESC);

-- RLS (public read, service_role write)
ALTER TABLE dish_analytics ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read dish analytics"
ON dish_analytics FOR SELECT
TO public
USING (true);

CREATE POLICY "System can update analytics"
ON dish_analytics FOR ALL
TO service_role
USING (true);
```

### 4. PostGIS Geospatial Index (Already exists, but optimize)

```sql
-- Ensure PostGIS extension is enabled
CREATE EXTENSION IF NOT EXISTS postgis;

-- Add computed geography column to restaurants
ALTER TABLE restaurants
ADD COLUMN IF NOT EXISTS location_point geography(POINT, 4326)
GENERATED ALWAYS AS (
  ST_SetSRID(ST_MakePoint(
    (location::json->>'lng')::float,
    (location::json->>'lat')::float
  ), 4326)::geography
) STORED;

-- Spatial index for fast radius queries
CREATE INDEX IF NOT EXISTS restaurants_location_point_idx
ON restaurants USING GIST(location_point);

-- Helper function for nearby restaurants
CREATE OR REPLACE FUNCTION restaurants_within_radius(
  lat FLOAT,
  lng FLOAT,
  radius_km FLOAT
)
RETURNS TABLE(
  id UUID,
  name TEXT,
  distance_km FLOAT
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    r.id,
    r.name,
    ST_Distance(
      r.location_point,
      ST_SetSRID(ST_MakePoint(lng, lat), 4326)::geography
    ) / 1000 AS distance_km
  FROM restaurants r
  WHERE ST_DWithin(
    r.location_point,
    ST_SetSRID(ST_MakePoint(lng, lat), 4326)::geography,
    radius_km * 1000
  )
  ORDER BY distance_km;
END;
$$ LANGUAGE plpgsql STABLE;
```

---

## ⚡ Edge Functions Design {#edge-functions}

### 1. Main Feed Endpoint

**File:** `supabase/functions/feed/index.ts`

```typescript
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { Redis } from 'https://esm.sh/@upstash/redis@latest';

// Initialize clients
const supabase = createClient(
  Deno.env.get('SUPABASE_URL') ?? '',
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
);

const redis = new Redis({
  url: Deno.env.get('UPSTASH_REDIS_REST_URL') ?? '',
  token: Deno.env.get('UPSTASH_REDIS_REST_TOKEN') ?? '',
});

interface FeedRequest {
  location: { lat: number; lng: number };
  radius?: number; // km, default 10
  filters: {
    priceRange?: [number, number];
    dietPreference?: string;
    calorieRange?: { min: number; max: number };
    allergens?: string[];
    cuisines?: string[];
  };
  userId?: string;
  limit?: number; // default 20
}

serve(async req => {
  try {
    // Parse request
    const body: FeedRequest = await req.json();
    const { location, radius = 10, filters, userId, limit = 20 } = body;

    // Generate cache key
    const cacheKey = `feed:${userId || 'anon'}:${location.lat.toFixed(3)}:${location.lng.toFixed(3)}:${JSON.stringify(filters)}`;

    // Check cache
    const cached = await redis.get(cacheKey);
    if (cached) {
      console.log('[Feed] Cache hit');
      return new Response(JSON.stringify(cached), {
        headers: { 'Content-Type': 'application/json' },
      });
    }

    console.log('[Feed] Cache miss, querying database');

    // 1. Find nearby restaurants
    const { data: nearbyRestaurants, error: restaurantError } = await supabase.rpc(
      'restaurants_within_radius',
      {
        lat: location.lat,
        lng: location.lng,
        radius_km: radius,
      }
    );

    if (restaurantError) throw restaurantError;
    if (!nearbyRestaurants || nearbyRestaurants.length === 0) {
      return new Response(JSON.stringify({ dishes: [], message: 'No restaurants nearby' }), {
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const restaurantIds = nearbyRestaurants.map((r: any) => r.id);

    // 2. Fetch dishes from nearby restaurants with analytics
    const { data: dishes, error: dishError } = await supabase
      .from('dishes')
      .select(
        `
        *,
        restaurant:restaurants(id, name, cuisine, rating, location),
        analytics:dish_analytics(
          view_count,
          right_swipe_count,
          popularity_score
        )
      `
      )
      .in('restaurant_id', restaurantIds)
      .eq('is_available', true);

    if (dishError) throw dishError;

    // 3. Apply filters
    let filteredDishes = dishes || [];

    // Price filter
    if (filters.priceRange) {
      const [min, max] = filters.priceRange;
      const minPrice = min * 5; // 1=$, 2=$$, etc.
      const maxPrice = max * 10;
      filteredDishes = filteredDishes.filter(
        (d: any) => d.price >= minPrice && d.price <= maxPrice
      );
    }

    // Diet preference filter
    if (filters.dietPreference && filters.dietPreference !== 'all') {
      filteredDishes = filteredDishes.filter((d: any) =>
        d.dietary_tags?.includes(filters.dietPreference)
      );
    }

    // Calorie filter
    if (filters.calorieRange) {
      filteredDishes = filteredDishes.filter(
        (d: any) =>
          d.calories &&
          d.calories >= filters.calorieRange!.min &&
          d.calories <= filters.calorieRange!.max
      );
    }

    // Allergen filter (exclude dishes with user's allergens)
    if (filters.allergens && filters.allergens.length > 0) {
      filteredDishes = filteredDishes.filter((d: any) => {
        const dishAllergens = d.allergens || [];
        return !filters.allergens!.some(allergen => dishAllergens.includes(allergen));
      });
    }

    // Cuisine filter
    if (filters.cuisines && filters.cuisines.length > 0) {
      filteredDishes = filteredDishes.filter((d: any) =>
        filters.cuisines!.includes(d.restaurant?.cuisine)
      );
    }

    // 4. Score and rank dishes
    const scoredDishes = filteredDishes.map((dish: any) => {
      const baseScore = calculateScore(dish, filters, nearbyRestaurants);
      return {
        ...dish,
        score: baseScore,
        distance_km: nearbyRestaurants.find((r: any) => r.id === dish.restaurant_id)?.distance_km,
      };
    });

    // Sort by score
    scoredDishes.sort((a: any, b: any) => b.score - a.score);

    // 5. Apply diversity (max 3 dishes per restaurant in top 20)
    const diversified = applyDiversity(scoredDishes, 3);

    // 6. Take top N
    const result = diversified.slice(0, limit);

    // 7. Cache result (5 minutes)
    await redis.setex(cacheKey, 300, JSON.stringify(result));

    return new Response(
      JSON.stringify({
        dishes: result,
        metadata: {
          totalAvailable: filteredDishes.length,
          returned: result.length,
          cached: false,
        },
      }),
      {
        headers: { 'Content-Type': 'application/json' },
      }
    );
  } catch (error) {
    console.error('[Feed] Error:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
});

// Simple scoring function (can be enhanced later)
function calculateScore(dish: any, filters: any, restaurants: any[]): number {
  let score = 50; // Base score

  // Restaurant rating
  if (dish.restaurant?.rating) {
    score += (dish.restaurant.rating / 5) * 20;
  }

  // Popularity
  if (dish.analytics?.popularity_score) {
    score += dish.analytics.popularity_score * 15;
  }

  // Distance bonus (closer is better)
  const restaurant = restaurants.find((r: any) => r.id === dish.restaurant_id);
  if (restaurant?.distance_km) {
    const distanceScore = Math.max(0, 15 - restaurant.distance_km * 3);
    score += distanceScore;
  }

  // Has image
  if (dish.image_url) {
    score += 10;
  }

  return score;
}

// Prevent too many dishes from same restaurant
function applyDiversity(dishes: any[], maxPerRestaurant: number): any[] {
  const result: any[] = [];
  const restaurantCounts = new Map<string, number>();

  for (const dish of dishes) {
    const restaurantId = dish.restaurant_id;
    const count = restaurantCounts.get(restaurantId) || 0;

    if (count < maxPerRestaurant) {
      result.push(dish);
      restaurantCounts.set(restaurantId, count + 1);
    }
  }

  return result;
}
```

### 2. Swipe Tracking Endpoint

**File:** `supabase/functions/swipe/index.ts`

```typescript
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const supabase = createClient(
  Deno.env.get('SUPABASE_URL') ?? '',
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
);

interface SwipeRequest {
  userId: string;
  dishId: string;
  action: 'left' | 'right' | 'super';
  viewDuration?: number;
  position?: number;
  sessionId?: string;
}

serve(async req => {
  try {
    const body: SwipeRequest = await req.json();
    const { userId, dishId, action, viewDuration, position, sessionId } = body;

    // 1. Log swipe
    const { error: swipeError } = await supabase.from('user_swipes').insert({
      user_id: userId,
      dish_id: dishId,
      action,
      view_duration: viewDuration,
      position_in_feed: position,
      session_id: sessionId,
    });

    if (swipeError) throw swipeError;

    // 2. Update dish analytics (async)
    const columnToIncrement =
      action === 'right'
        ? 'right_swipe_count'
        : action === 'super'
          ? 'super_like_count'
          : 'left_swipe_count';

    await supabase.rpc('increment_dish_stat', {
      p_dish_id: dishId,
      p_column: columnToIncrement,
    });

    // 3. Update user behavior profile (async)
    await supabase.rpc('update_user_behavior', {
      p_user_id: userId,
      p_action: action,
    });

    return new Response(JSON.stringify({ success: true }), {
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('[Swipe] Error:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
});
```

---

## 🔥 Redis Caching Strategy {#redis-caching}

### Cache Keys & TTLs

```typescript
// Cache key patterns
const CACHE_KEYS = {
  // Feed cache (5 minutes)
  feed: (userId: string, location: string, filters: string) =>
    `feed:${userId}:${location}:${filters}`,

  // Nearby restaurants (10 minutes)
  nearbyRestaurants: (lat: number, lng: number, radius: number) =>
    `restaurants:${lat.toFixed(3)}:${lng.toFixed(3)}:${radius}`,

  // Dish details (1 hour)
  dishDetails: (dishId: string) => `dish:${dishId}`,

  // User session (24 hours)
  userSession: (userId: string) => `session:${userId}`,

  // User behavior profile (1 hour)
  userProfile: (userId: string) => `profile:${userId}`,
};

const TTL = {
  feed: 300, // 5 minutes
  nearbyRestaurants: 600, // 10 minutes
  dishDetails: 3600, // 1 hour
  userSession: 86400, // 24 hours
  userProfile: 3600, // 1 hour
};
```

### Cache Invalidation Strategy

```typescript
// Invalidate cache when:
// 1. Restaurant updates menu
await redis.del(`restaurants:${restaurantId}:*`);

// 2. Dish is updated
await redis.del(`dish:${dishId}`);

// 3. User updates preferences
await redis.del(`feed:${userId}:*`);
await redis.del(`profile:${userId}`);
```

---

## 📱 Mobile App Changes {#mobile-changes}

### Before (Client-Side Filtering):

```typescript
// ❌ OLD: Query all dishes, filter on mobile
const { data: dishes } = await supabase.from('dishes').select('*');

const filtered = filterService.applyFilters(dishes, filters);
```

### After (Server-Side Filtering):

```typescript
// ✅ NEW: Call edge function, get pre-filtered results
const response = await fetch(`${SUPABASE_URL}/functions/v1/feed`, {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${session.access_token}`,
  },
  body: JSON.stringify({
    location: { lat: userLat, lng: userLng },
    radius: 10,
    filters: {
      priceRange: [2, 3],
      dietPreference: 'vegan',
      allergens: ['peanuts'],
    },
    userId: user.id,
    limit: 20,
  }),
});

const { dishes } = await response.json();
// Ready to display! No client-side filtering needed
```

### Track Swipes:

```typescript
// Log swipe to server
await fetch(`${SUPABASE_URL}/functions/v1/swipe`, {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${session.access_token}`,
  },
  body: JSON.stringify({
    userId: user.id,
    dishId: dish.id,
    action: 'right',
    viewDuration: 3500,
    position: 5,
    sessionId: currentSessionId,
  }),
});
```

---

## 📈 Performance Metrics {#performance}

### Expected Improvements:

| Metric             | Before           | After              | Improvement      |
| ------------------ | ---------------- | ------------------ | ---------------- |
| **Data Transfer**  | 5-10 MB          | 50-100 KB          | **50-100x less** |
| **API Latency**    | 2-5 seconds      | 200-500ms          | **10x faster**   |
| **Battery Usage**  | High (filtering) | Low (display only) | **5x better**    |
| **Cache Hit Rate** | 0%               | 70-80%             | **New feature**  |
| **Scalability**    | 1,000 dishes max | 100,000+ dishes    | **100x better**  |

### Monitoring:

```typescript
// Add to Edge Function
console.log(
  JSON.stringify({
    type: 'performance',
    endpoint: 'feed',
    duration: Date.now() - startTime,
    cacheHit: cached ? true : false,
    dishesReturned: result.length,
    userId: userId,
  })
);
```

---

## 🚀 Migration Steps {#migration}

### Phase 1: Database Setup (Week 1)

1. **Run new migrations:**

   ```bash
   # Create new tables
   supabase migration new user_swipes
   supabase migration new user_behavior_profiles
   supabase migration new dish_analytics
   supabase migration new geospatial_functions

   # Apply migrations
   supabase db push
   ```

2. **Verify PostGIS extension:**

   ```sql
   SELECT PostGIS_Version();
   ```

3. **Test geospatial queries:**
   ```sql
   SELECT * FROM restaurants_within_radius(37.7749, -122.4194, 5);
   ```

### Phase 2: Upstash Redis Setup (Week 1)

1. **Sign up for Upstash:** https://upstash.com
2. **Create Redis database:**
   - Choose global region
   - Enable REST API
3. **Get credentials:**
   - `UPSTASH_REDIS_REST_URL`
   - `UPSTASH_REDIS_REST_TOKEN`
4. **Add to Supabase secrets:**
   ```bash
   supabase secrets set UPSTASH_REDIS_REST_URL=https://...
   supabase secrets set UPSTASH_REDIS_REST_TOKEN=...
   ```

### Phase 3: Deploy Edge Functions (Week 2)

1. **Create functions:**

   ```bash
   supabase functions new feed
   supabase functions new swipe
   ```

2. **Implement logic** (see code above)

3. **Test locally:**

   ```bash
   supabase functions serve feed
   curl -X POST http://localhost:54321/functions/v1/feed \
     -H "Content-Type: application/json" \
     -d '{"location":{"lat":37.7749,"lng":-122.4194},"filters":{}}'
   ```

4. **Deploy:**
   ```bash
   supabase functions deploy feed
   supabase functions deploy swipe
   ```

### Phase 4: Mobile App Integration (Week 3)

1. **Update API calls** (see mobile changes above)
2. **Remove client-side filtering code**
3. **Add swipe tracking**
4. **Test thoroughly**

### Phase 5: Monitoring & Optimization (Week 4)

1. **Monitor Edge Function logs:**

   ```bash
   supabase functions logs feed
   ```

2. **Track cache hit rates:**
   - Check Redis stats in Upstash dashboard

3. **Optimize queries:**
   - Add more indexes if needed
   - Adjust cache TTLs based on usage

4. **A/B test scoring algorithm:**
   - Try different weight combinations

---

## 📊 Cost Estimate

### Upstash Redis (Free Tier):

- **10,000 commands/day** - Free
- **100 MB storage** - Free
- **Good for:** ~5,000 users/day

### When to Upgrade:

- Upstash Pro: $0.20 per 100K commands
- Estimate: $10-20/month for 50K active users

### Supabase Edge Functions:

- **2 million requests/month** - Included in Pro plan ($25/month)
- **Additional:** $2 per 1M requests

---

## ✅ Success Criteria

1. ✅ Feed API responds in < 500ms (80th percentile)
2. ✅ Cache hit rate > 70%
3. ✅ Mobile data usage reduced by 90%
4. ✅ Battery usage improved (measurable via profiling)
5. ✅ Can handle 10,000+ dishes without performance degradation
6. ✅ Swipe tracking captures 99%+ of events

---

## 🔮 Future Enhancements (Post-MVP)

### Phase 6: Machine Learning (When you have data)

- Train recommendation model on swipe history
- Deploy TensorFlow.js model to Edge Function
- Personalize scoring based on user patterns

### Phase 7: Real-Time Updates

- WebSocket connection for live feed updates
- Push notifications for new dishes nearby

### Phase 8: Advanced Analytics

- Heatmaps of user preferences
- Restaurant performance dashboards
- A/B testing framework

---

## 🎯 Decision Points

### ✅ Approved for Implementation:

- [x] Use Supabase Edge Functions
- [x] Integrate Upstash Redis
- [x] Move filtering server-side
- [x] Track user swipes
- [x] No ML yet (save for later)

### 🔄 To Be Decided:

- [ ] Cache TTL values (start with 5 min, adjust based on data)
- [ ] Scoring algorithm weights (A/B test later)
- [ ] Diversity rules (max dishes per restaurant)

---

**Next Steps:** Review this design, approve, and begin Phase 1 (Database Setup).
