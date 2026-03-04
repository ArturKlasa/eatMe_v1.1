# Backend Implementation Plan - EatMe

**Originally written:** January 26, 2026  
**Last updated:** March 3, 2026  
**Status:** ✅ Core backend implemented — Mobile integration in progress

> **Update (March 2026):** All four Edge Functions (`feed`, `nearby-restaurants`, `swipe`, `group-recommendations`) are deployed. The analysis below remains valid; items marked 🟢 are now complete. Items still pending are in [TODO_LIST.md](./TODO_LIST.md).

## Executive Summary

This document analyzes the backend requirements for EatMe based on the current mobile app, web portal, database schema, and project plan. It evaluates what needs to be implemented and whether Supabase Edge Functions can handle the requirements.

**Key Finding:** ✅ **Supabase Edge Functions can handle 90%+ of backend needs** with some architectural considerations.

---

## Current Architecture Status (March 2026)

### ✅ What's Built

**Database (Supabase PostgreSQL) — 40 migrations applied**

- ✅ Core tables: restaurants, menus, dishes, dish_categories
- ✅ PostGIS extension for geospatial queries
- ✅ Row Level Security (RLS) policies on all tables
- ✅ Authentication (Supabase Auth with email + OAuth)
- ✅ Admin role system + audit log
- ✅ Ingredient system with allergen/dietary triggers
- ✅ Rating system (`dish_opinions` → `restaurants.rating` trigger)
- ✅ Eat Together tables (sessions, participants, votes)
- ✅ User preferences + behavior profiles
- ✅ Menu scan jobs table

**Web Portal (Next.js)**

- ✅ Restaurant owner onboarding
- ✅ Admin CRUD for restaurants/menus/dishes
- ✅ Admin: ingredient management, dish categories, menu scan
- ✅ OAuth callback handling
- ✅ Direct Supabase client integration

**Mobile App (React Native + Expo)**

- ✅ Map-based UI with Mapbox
- ✅ Filter system (daily + permanent filters) - **client-side only**
- ✅ Mock restaurant data structure
- ✅ Zustand stores for state management
- ❌ **NOT connected to Supabase yet**

---

## Backend Requirements Analysis

### 1. **Geospatial Query Service** 🔴 CRITICAL

**Requirement:** Find restaurants near user's location with efficient radius search

**Current State:**

- Mobile app has hardcoded mock data
- No real-time location-based queries
- FilterService operates on mock data arrays

**Implementation Needed:**

```typescript
// Edge Function: /functions/nearby-restaurants
interface NearbyRestaurantsRequest {
  latitude: number;
  longitude: number;
  radiusMeters: number; // default: 5000 (5km)
  limit?: number; // default: 50
  filters?: {
    cuisines?: string[];
    priceRange?: [number, number];
    minRating?: number;
  };
}

interface NearbyRestaurantsResponse {
  restaurants: RestaurantWithDistance[];
  totalCount: number;
  searchRadius: number;
}
```

**Supabase Edge Function Implementation:**

```typescript
// supabase/functions/nearby-restaurants/index.ts
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

serve(async req => {
  const { latitude, longitude, radiusMeters = 5000, limit = 50, filters } = await req.json();

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  );

  // PostGIS ST_DWithin query for efficient geospatial search
  let query = supabase
    .from('restaurants')
    .select(
      `
      *,
      menus!inner(
        *,
        dishes(*)
      )
    `
    )
    .filter(
      'location',
      'st_dwithin',
      {
        type: 'Point',
        coordinates: [longitude, latitude],
      },
      radiusMeters
    )
    .limit(limit);

  // Apply filters
  if (filters?.cuisines?.length) {
    query = query.overlaps('cuisine_types', filters.cuisines);
  }
  if (filters?.minRating) {
    query = query.gte('rating', filters.minRating);
  }

  const { data, error } = await query;

  if (error) throw error;

  // Calculate distances client-side using Haversine
  const withDistances = data.map(restaurant => ({
    ...restaurant,
    distance: calculateDistance(latitude, longitude, restaurant.location),
  }));

  return new Response(
    JSON.stringify({
      restaurants: withDistances,
      totalCount: data.length,
      searchRadius: radiusMeters,
    }),
    {
      headers: { 'Content-Type': 'application/json' },
    }
  );
});
```

**Why Edge Function?**

- ✅ Runs close to database (low latency)
- ✅ Can use PostGIS efficiently
- ✅ Reduces mobile app complexity
- ✅ Centralized filtering logic

---

### 2. **Smart Filtering & Recommendation Engine** 🟡 MEDIUM PRIORITY

**Requirement:** Filter dishes/restaurants by dietary preferences, allergens, price, etc.

**Current State:**

- Mobile has `filterService.ts` with client-side filtering
- Operates on full dataset (inefficient at scale)
- No server-side optimization

**Two-Tier Approach:**

**Tier 1: Basic Server-Side Filtering** (Edge Function)

```typescript
// supabase/functions/filter-dishes/index.ts
interface FilterRequest {
  location: { lat: number; lng: number };
  radiusMeters: number;
  dietaryTags?: string[]; // ['vegan', 'gluten-free']
  allergens?: string[]; // exclude dishes with these
  priceRange?: [number, number];
  spiceLevel?: { min: number; max: number };
  calorieRange?: [number, number];
}

// Use Postgres ARRAY operations and JSONB queries
SELECT d.*, r.name as restaurant_name, r.location
FROM dishes d
JOIN restaurants r ON d.restaurant_id = r.id
WHERE
  ST_DWithin(r.location, ST_Point($1, $2), $3)
  AND d.dietary_tags @> $4  -- contains all required tags
  AND NOT d.allergens && $5  -- doesn't overlap with allergens
  AND d.price BETWEEN $6 AND $7
  AND d.spice_level BETWEEN $8 AND $9
  AND d.is_available = true
ORDER BY ST_Distance(r.location, ST_Point($1, $2))
LIMIT 100;
```

**Tier 2: ML-Based Recommendations** (Future - Phase 3)

- Keep client-side for now
- Migrate to Edge Functions with Deno ML libraries when ready
- Store learned preferences in `profiles.learned_preferences` JSONB

**Why Hybrid Approach?**

- ✅ Basic filters run server-side (efficient)
- ✅ ML/scoring can start client-side (simpler)
- ✅ Gradual migration path

---

### 3. **Group Dining / Multi-User Sessions** 🟢 LOW PRIORITY (Phase 3)

**Requirement:** Combine multiple users' filters to find compatible restaurants

**Implementation Options:**

**Option A: Edge Function**

```typescript
// supabase/functions/group-recommendations/index.ts
interface GroupRequest {
  userIds: string[];
  location: { lat: number; lng: number };
}

// 1. Fetch all users' permanent filters
// 2. Combine constraints (intersection of dietary needs)
// 3. Query restaurants that satisfy ALL constraints
// 4. Rank by how well they satisfy preferences
```

**Option B: Realtime Subscriptions + Client Logic**

- Use Supabase Realtime to sync group session state
- Each user's filters stored in `group_sessions.filters_snapshot`
- Client-side merging logic (simpler for MVP)

**Recommendation:** Start with **Option B** (client-side), migrate to Edge Function in Phase 3.

---

### 4. **Review & Rating Aggregation** 🟡 MEDIUM PRIORITY

**Requirement:** Calculate average ratings, count reviews, update restaurant scores

**Current Schema:**

```sql
CREATE TABLE reviews (
  id UUID PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id),
  subject_type TEXT CHECK (subject_type IN ('dish', 'restaurant')),
  subject_id UUID NOT NULL,
  rating SMALLINT CHECK (rating BETWEEN 1 AND 5),
  text TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

**Implementation: Database Triggers + Edge Function**

**Option 1: Postgres Trigger (Preferred)**

```sql
-- Auto-update restaurant rating when review is added/updated/deleted
CREATE OR REPLACE FUNCTION update_restaurant_rating()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE restaurants
  SET rating = (
    SELECT AVG(rating)::NUMERIC(3,2)
    FROM reviews
    WHERE subject_type = 'restaurant'
      AND subject_id = restaurants.id
  )
  WHERE id = (
    CASE
      WHEN TG_OP = 'DELETE' THEN OLD.subject_id
      ELSE NEW.subject_id
    END
  )
  AND (
    CASE
      WHEN TG_OP = 'DELETE' THEN OLD.subject_type
      ELSE NEW.subject_type
    END
  ) = 'restaurant';

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_rating_on_review
AFTER INSERT OR UPDATE OR DELETE ON reviews
FOR EACH ROW
EXECUTE FUNCTION update_restaurant_rating();
```

**Option 2: Edge Function Batch Job**

```typescript
// supabase/functions/recalculate-ratings/index.ts
// Run nightly via cron
Deno.cron('recalculate ratings', '0 2 * * *', async () => {
  // Recalculate all restaurant ratings
  await supabase.rpc('refresh_all_ratings');
});
```

**Recommendation:** **Postgres Trigger** for real-time updates + nightly cleanup job.

---

### 5. **Image Upload & Management** 🟢 LOW PRIORITY

**Requirement:** Users upload dish photos, restaurant photos

**Supabase Storage Solution:**

```typescript
// Direct upload from mobile/web
const { data, error } = await supabase.storage
  .from('dish-images')
  .upload(`${userId}/${dishId}.jpg`, file, {
    contentType: 'image/jpeg',
    upsert: true,
  });

// Get public URL
const {
  data: { publicUrl },
} = supabase.storage.from('dish-images').getPublicUrl(`${userId}/${dishId}.jpg`);

// Update dish record
await supabase.from('dishes').update({ image_url: publicUrl }).eq('id', dishId);
```

**Image Processing (Optional - Phase 3):**

- Edge Function for image compression/resizing
- Use Deno image libraries: `imagescript` or `sharp-deno`

**No Edge Function Needed Initially** - Direct upload works fine.

---

### 6. **Search & Autocomplete** 🟡 MEDIUM PRIORITY

**Requirement:** Search restaurants/dishes by name, cuisine, ingredients

**Postgres Full-Text Search:**

```sql
-- Add search index
ALTER TABLE dishes
ADD COLUMN search_vector tsvector
GENERATED ALWAYS AS (
  to_tsvector('english',
    coalesce(name, '') || ' ' ||
    coalesce(description, '') || ' ' ||
    array_to_string(ingredients, ' ')
  )
) STORED;

CREATE INDEX dishes_search_idx ON dishes USING GIN(search_vector);
```

**Edge Function for Smart Search:**

```typescript
// supabase/functions/search/index.ts
interface SearchRequest {
  query: string;
  location?: { lat: number; lng: number };
  type?: 'dishes' | 'restaurants' | 'both';
}

// Use ts_rank for relevance scoring
SELECT
  d.*,
  r.name as restaurant_name,
  ts_rank(d.search_vector, to_tsquery($1)) as rank
FROM dishes d
JOIN restaurants r ON d.restaurant_id = r.id
WHERE d.search_vector @@ to_tsquery($1)
ORDER BY rank DESC, ST_Distance(r.location, ST_Point($2, $3))
LIMIT 20;
```

**Why Edge Function?**

- ✅ Combines text search + geospatial ranking
- ✅ Can implement fuzzy matching logic
- ✅ Reduces client complexity

---

### 7. **Analytics & Logging** 🟢 LOW PRIORITY (Phase 4)

**Requirement:** Track user behavior, popular dishes, search patterns

**Options:**

**Option A: Edge Function + Supabase Tables**

```sql
CREATE TABLE analytics_events (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES auth.users(id),
  event_type TEXT NOT NULL, -- 'dish_view', 'restaurant_click', 'filter_applied'
  event_data JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Partition by month for efficiency
CREATE TABLE analytics_events_2026_01 PARTITION OF analytics_events
FOR VALUES FROM ('2026-01-01') TO ('2026-02-01');
```

**Option B: External Service (Mixpanel/Amplitude)**

- Send from mobile/web directly
- No backend needed

**Recommendation:** Start with **Option B**, migrate to Option A for custom analytics later.

---

### 8. **Daily Menu Management** 🟡 MEDIUM PRIORITY

**Requirement:** Restaurants can publish time-limited menus (e.g., lunch specials)

**Schema Addition:**

```sql
ALTER TABLE menus
ADD COLUMN availability_schedule JSONB;

-- Example:
{
  "days": ["monday", "tuesday", "wednesday", "thursday", "friday"],
  "startTime": "11:00",
  "endTime": "15:00",
  "validUntil": "2026-02-15"
}
```

**Edge Function for Active Menu Filtering:**

```typescript
// supabase/functions/active-menus/index.ts
// Filter menus by current time and day
function isMenuActive(menu, currentTime, currentDay) {
  if (!menu.availability_schedule) return true;

  const { days, startTime, endTime, validUntil } = menu.availability_schedule;

  // Check day
  if (days && !days.includes(currentDay)) return false;

  // Check time window
  if (startTime && endTime) {
    const now = new Date(currentTime);
    const start = new Date(`${now.toDateString()} ${startTime}`);
    const end = new Date(`${now.toDateString()} ${endTime}`);
    if (now < start || now > end) return false;
  }

  // Check expiry
  if (validUntil && new Date(currentTime) > new Date(validUntil)) return false;

  return true;
}
```

**Why Edge Function?**

- ✅ Complex time logic runs server-side
- ✅ Consistent across all clients

---

### 9. **Notification System** 🔵 FUTURE (Phase 4+)

**Requirement:** Push notifications for new dishes, promotions, friend activity

**Options:**

**Option A: Supabase Realtime + Mobile Push**

```typescript
// Listen to database changes
const channel = supabase.channel('new-dishes').on(
  'postgres_changes',
  {
    event: 'INSERT',
    schema: 'public',
    table: 'dishes',
    filter: 'restaurant_id=eq.user_favorite_restaurants',
  },
  payload => {
    // Trigger push notification
  }
);
```

**Option B: Edge Function + FCM/APNS**

```typescript
// supabase/functions/send-notification/index.ts
import { sendPushNotification } from './fcm-client.ts';

// Trigger from database webhook or cron job
```

**Recommendation:** **Phase 4** - Use Expo Notifications + Edge Function.

---

## Edge Functions Summary

### **Recommended Edge Functions to Build**

| Priority        | Function Name           | Purpose                                        | Complexity |
| --------------- | ----------------------- | ---------------------------------------------- | ---------- |
| 🔴 **Critical** | `nearby-restaurants`    | Geospatial search with PostGIS                 | Medium     |
| 🔴 **Critical** | `filter-dishes`         | Server-side dish filtering                     | Medium     |
| 🟡 **Medium**   | `search`                | Full-text search with ranking                  | Medium     |
| 🟡 **Medium**   | `active-menus`          | Filter menus by time/date                      | Low        |
| 🟡 **Medium**   | `submit-review`         | Validate + store review, trigger rating update | Low        |
| 🟢 **Low**      | `group-recommendations` | Multi-user filter merging                      | High       |
| 🟢 **Low**      | `recalculate-ratings`   | Batch rating updates (cron)                    | Low        |
| 🔵 **Future**   | `send-notification`     | Push notification delivery                     | Medium     |
| 🔵 **Future**   | `image-processor`       | Compress/resize images                         | Medium     |

---

## Can Supabase Edge Functions Handle This?

### ✅ **YES - With Caveats**

**Strengths:**

1. ✅ **PostGIS Integration** - Perfect for geospatial queries
2. ✅ **Direct Database Access** - Low latency, no extra hops
3. ✅ **TypeScript/Deno** - Modern, secure runtime
4. ✅ **Built-in Auth** - Seamless integration with Supabase Auth
5. ✅ **Serverless** - Auto-scaling, cost-effective
6. ✅ **Cron Jobs** - Native scheduled tasks support

**Limitations & Workarounds:**

| Challenge                    | Supabase Limitation         | Workaround                                                  |
| ---------------------------- | --------------------------- | ----------------------------------------------------------- |
| **ML/AI Recommendations**    | No built-in ML runtime      | Use Deno ML libraries OR start client-side                  |
| **Heavy Computation**        | 10s timeout limit           | Break into smaller functions OR use async processing        |
| **Large Image Processing**   | Memory limits               | Offload to Supabase Storage + external service (Cloudinary) |
| **Real-time Complex Logic**  | Better in Postgres triggers | Use triggers for complex updates                            |
| **External API Rate Limits** | No built-in retry logic     | Implement exponential backoff manually                      |

---

## Recommended Architecture

### **Phase 2 (Current - Backend Integration)**

```
Mobile App (React Native)
    ↓
Supabase Edge Functions
    ↓
Supabase PostgreSQL (PostGIS)
    ↓
Supabase Storage (Images)
```

**What to Build Now:**

1. ✅ `nearby-restaurants` - Core geospatial search
2. ✅ `filter-dishes` - Server-side filtering
3. ✅ Mobile app Supabase client setup
4. ✅ Migrate mock data to real database queries

**Defer to Phase 3:**

- Group recommendations
- ML-based personalization
- Advanced analytics
- Push notifications

---

## Cost Implications

**Supabase Free Tier:**

- ✅ 500MB database
- ✅ 1GB file storage
- ✅ 50,000 monthly active users
- ✅ 500K Edge Function invocations/month

**Projected Usage (First 6 Months):**

- ~100 restaurants × 20 dishes = 2,000 records
- ~10,000 images × 500KB = 5GB storage (NEED PAID TIER)
- ~1,000 users × 50 requests/day = 1.5M requests/month (NEED PAID TIER)

**Recommendation:** Start free tier, upgrade to **Pro ($25/month)** when you hit limits.

---

## Migration Strategy

### **Step 1: Replace Mock Data** — ⏳ In Progress

- ⏳ Add Supabase client to mobile app (`apps/mobile/src/lib/supabase.ts`)
- ✅ Create `nearby-restaurants` Edge Function (deployed)
- ✅ Create `feed` Edge Function (deployed)
- ⏳ Replace `restaurantStore` mock data with real API calls
- ⏳ Update `filterService` to call Edge Functions

### **Step 2: Reviews & Ratings** — ✅ DB complete, mobile pending

- ✅ `dish_opinions` table with `liked | okay | disliked`
- ✅ Postgres trigger: `dish_opinions` → `restaurants.rating`
- ✅ `swipe` Edge Function deployed
- ⏳ Mobile SwipeScreen wired to `swipe` Edge Function

### **Step 3: Personalization** — ⏳ Pending mobile integration

- ✅ `user_preferences` table (migration 022)
- ✅ `user_behavior_profiles` table (migration 013)
- ⏳ User preferences onboarding screens in mobile
- ⏳ Feed personalisation using `user_id`

---

## Conclusion

**✅ Supabase Edge Functions are SUFFICIENT for EatMe's backend needs**

**Pros:**

- All-in-one platform (auth, database, storage, functions)
- PostGIS is perfect for geospatial queries
- Cost-effective for early-stage startup
- TypeScript/Deno is familiar to existing codebase
- Direct integration with existing Next.js portal

**Cons:**

- ML/AI features may need external services later
- Image processing at scale needs CDN (Cloudinary/Imgix)
- Advanced analytics might need dedicated service

**Next Steps:**

1. Build 2 core Edge Functions: `nearby-restaurants` + `filter-dishes`
2. Connect mobile app to Supabase
3. Migrate mock data to production database
4. Test with real restaurants/dishes
5. Iterate based on performance metrics

**Timeline:** 2-3 weeks for core backend integration (Phase 2)
