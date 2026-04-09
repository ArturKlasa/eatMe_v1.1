# Implementation Plan: EatMe Rating System Redesign

## Checklist

- [x] Step 1: Database migrations
- [ ] Step 2: Type system + display service layer
- [ ] Step 3: submitInContextRating + updated submitRating
- [ ] Step 4: InContextRating component + RestaurantDetailScreen wiring
- [ ] Step 5: Full flow enhancement — note field
- [ ] Step 6: Updated display components (DishRatingBadge + RestaurantRatingBadge)
- [ ] Step 7: Gamification — streaks + Trusted Taster badge
- [ ] Step 8: i18n strings (EN / ES / PL)

---

## Step 1: Database Migrations

### Objective
Apply all schema changes required by the new rating system. Every subsequent step depends on these columns, tables, and views existing.

### Implementation Guidance

Create a new migration file: `infra/supabase/migrations/079_rating_system_redesign.sql`

**In this exact order** (dependency-aware):

1. Add columns to existing tables:
   ```sql
   ALTER TABLE public.dish_opinions
     ADD COLUMN note text CHECK (char_length(note) <= 47),
     ADD COLUMN source text DEFAULT 'full_flow' CHECK (source IN ('full_flow', 'in_context'));

   ALTER TABLE public.user_visits
     ADD COLUMN source text DEFAULT 'full_flow' CHECK (source IN ('full_flow', 'in_context'));
   ```

2. Create new tables with RLS (see design §Data Models steps 3–4 for full DDL):
   - `user_streaks` — one row per user, tracks current/longest streak + last_rating_week
   - `user_badges` — one row per user per badge_type; client INSERT allowed (badge awarded client-side per design decision)

3. Drop views in reverse dependency order, then recreate in forward order:
   ```sql
   DROP MATERIALIZED VIEW IF EXISTS public.restaurant_ratings_summary;
   DROP MATERIALIZED VIEW IF EXISTS public.dish_ratings_summary;
   -- CREATE dish_ratings_summary (see design §5)
   -- CREATE restaurant_ratings_summary (see design §6)
   ```

4. Update `refresh_materialized_views()` RPC to refresh in the correct order:
   ```sql
   CREATE OR REPLACE FUNCTION public.refresh_materialized_views()
   RETURNS void LANGUAGE plpgsql AS $$
   BEGIN
     REFRESH MATERIALIZED VIEW CONCURRENTLY public.dish_ratings_summary;
     REFRESH MATERIALIZED VIEW CONCURRENTLY public.restaurant_ratings_summary;
   END;
   $$;
   ```

### Test Requirements
- Migration runs to completion without errors on a clean DB
- `dish_opinions` has `note` and `source` columns with correct constraints
- `user_visits` has `source` column
- `user_streaks` and `user_badges` tables exist with correct RLS policies
- `dish_ratings_summary` returns: `dish_id`, `total_ratings`, `like_percentage`, `okay_percentage`, `dislike_percentage`, `liked_count`, `okay_count`, `disliked_count`, `top_tags`, `recent_notes`
- `restaurant_ratings_summary` returns: `restaurant_id`, `food_score`, `total_dish_ratings`, `service_percentage`, `cleanliness_percentage`, `wait_time_percentage`, `value_percentage`, `would_recommend_percentage`, `total_experience_responses`, `overall_percentage`
- Insert a `dish_opinion` row, call `refresh_materialized_views()`, verify view reflects it
- Insert opinions for dishes at a restaurant, verify `food_score` is a Bayesian average in 0–100 range

### Demo
Run `supabase db reset --local` and verify migration applies cleanly. Query both views and confirm column shapes match the design spec. Manually insert 5 opinions (3 liked, 1 okay, 1 disliked) for a dish and verify `like_percentage = 60.0`, `okay_percentage = 20.0`, `dislike_percentage = 20.0`.

---

## Step 2: Type System + Display Service Layer

### Objective
Update all TypeScript types and display-side service functions to reflect the new schema. This step has no visible UI changes — it establishes the type-safe foundation every other step builds on.

### Implementation Guidance

**`apps/mobile/src/types/rating.ts`**
- Add `note?: string` to `DishRatingInput`
- Remove `DishRatingStats` interface (it duplicates `DishRating` in `dishRatingService.ts`) — check for any consumers and migrate them to `DishRating`
- Add `weekly_streak_bonus` action type to `PointsEarned` (new field: `streakBonus: number`)
- Update `PointsEarned.dishPhotos` comment: 15 pts → 20 pts

**`apps/mobile/src/services/dishRatingService.ts`**
- Expand `DishRating` interface:
  ```typescript
  export interface DishRating {
    dishId: string;
    likePercentage: number | null;
    okayPercentage: number | null;       // new
    dislikePercentage: number | null;    // new
    totalRatings: number;
    topTags: string[];
    recentNotes: string[];               // new
  }
  ```
- Update `getDishRatingsBatch` and `getDishRating` selects to include new columns
- Add `getRatingTier(likePercentage, totalRatings): 'top' | 'good' | 'neutral' | 'none'`:
  - `'top'`: ≥90% AND ≥20 ratings
  - `'good'`: ≥75% AND ≥5 ratings
  - `'neutral'`: ≥60% AND ≥3 ratings
  - `'none'`: below thresholds
- Update `formatRatingText` output: `"85% 👍 (47)"` (was `"85% ❤️ 47"`)
- Update `getRatingColor` thresholds to align with new tier definitions (≥80% = success, ≥60% = warning)

**`apps/mobile/src/services/restaurantRatingService.ts`**
- Expand `RestaurantRating` interface (see design §Modified Service: restaurantRatingService.ts)
- Update `getRestaurantRating` and `getRestaurantRatingsBatch`:
  - Remove `Math.round((data.food_score || 0.5) * 100)` — `food_score` is now already a percentage
  - Map all new columns: `totalDishRatings`, `servicePercentage`, `cleanlinessPercentage`, `waitTimePercentage`, `valuePercentage`, `wouldRecommendPercentage`, `totalExperienceResponses`
  - Rename snake_case DB columns to camelCase TS fields

### Integration: Previous Steps
No wiring to screens needed yet. Types are consumed by components in Steps 4–6.

### Test Requirements
- Unit: `getRatingTier` — test all 4 tier boundary conditions including edge cases (null percentage, 0 ratings, exactly 20 ratings at 90%)
- Unit: `formatRatingText` — verify `"85% 👍 (47)"` output format; verify null handling
- Unit: `getRatingColor` — verify correct color at each threshold
- TypeScript: `tsc --noEmit` passes with no type errors after removing `DishRatingStats`

### Demo
All unit tests pass. `tsc --noEmit` compiles cleanly. No screen changes yet — this step is purely internal.

---

## Step 3: submitInContextRating + Updated submitRating

### Objective
Add the `submitInContextRating` function to `ratingService.ts` and update `submitRating` / `awardPoints` for changed photo point values. This step makes in-context rating fully functional at the service layer, ready for the UI to call.

### Implementation Guidance

**`apps/mobile/src/services/ratingService.ts`**

Add `submitInContextRating`:
```typescript
export async function submitInContextRating(
  userId: string,
  restaurantId: string,
  dishId: string,
  dishName: string,
  opinion: DishOpinion,
  tags: DishTag[],
  sessionId: string | null
): Promise<{ success: boolean; error?: string }>
```

Implementation:
1. Find or create in-context visit:
   ```sql
   SELECT id FROM user_visits
   WHERE user_id = $userId AND restaurant_id = $restaurantId
     AND source = 'in_context'
     AND visited_at > now() - interval '24 hours'
   LIMIT 1
   ```
   If not found, INSERT new visit with `source = 'in_context'`
2. Upsert `dish_opinions` with `source = 'in_context'`, `onConflict: 'user_id,dish_id,visit_id'`
3. If `opinion === 'liked' || opinion === 'okay'`: call `recordInteraction(userId, dishId, 'liked', sessionId)`
4. Award points asynchronously (non-blocking): 10 pts for rating + 5 pts if `tags.length > 0`
5. Return `{ success: true }` optimistically — don't await points

Update `awardPoints`:
- Change dish photo points from `15` to `20` (line ~259 in current file)

Update `calculatePoints` in `RatingFlowModal.tsx`:
- Change `dishRatings.filter(r => r.photoUri).length * 15` → `* 20`
- Change `restaurantFeedback?.photoUri ? 10 : 0` — keep as is (restaurant photo stays 10)

Update `PointsEarned` type: change comment `15 pts per photo` → `20 pts per photo`

### Integration: Previous Steps
- Uses `DishOpinion`, `DishTag`, `DishRatingInput` updated in Step 2
- Uses DB `source` column added in Step 1

### Test Requirements
- Integration: `submitInContextRating` — happy path creates visit + opinion row with `source='in_context'`
- Integration: calling twice same day for same restaurant reuses existing in-context visit (verify only 1 visit row created)
- Integration: calling on day 2 creates a new visit (verify 2 visit rows after 24h boundary)
- Integration: `opinion='disliked'` does NOT call `recordInteraction` (verify no row in `user_dish_interactions`)
- Unit: `awardPoints` — verify photo bonus is 20 pts, not 15

### Demo
Write a test script (or use Supabase SQL editor) to call `submitInContextRating` for a known user+restaurant+dish. Verify `dish_opinions` and `user_visits` rows are created with `source='in_context'`. Call again — verify the visit row is reused and the opinion is updated (upsert).

---

## Step 4: InContextRating Component + RestaurantDetailScreen Wiring

### Objective
Build the `InContextRating` component and wire it into the dish cards in `RestaurantDetailScreen`. Users can now rate a dish in under 5 seconds without leaving the screen.

### Implementation Guidance

**New file: `apps/mobile/src/components/rating/InContextRating.tsx`**

Props:
```typescript
interface InContextRatingProps {
  dishId: string;
  dishName: string;
  restaurantId: string;
  existingOpinion: DishOpinion | null;  // from dishRatings Map in RestaurantDetailScreen
  onRated: (opinion: DishOpinion, tags: DishTag[]) => void;
}
```

Component states (local `useState`):
1. **Idle**: if `existingOpinion === null` → show "Tried it?" button; if not null → show existing opinion highlighted (3 small buttons with the current one active)
2. **Selecting**: show 3 opinion buttons (👍 😐 👎) full-size, tapping one selects it
3. **Tagging** (only for 'liked' or 'disliked'): show relevant tags (reuse `POSITIVE_DISH_TAGS` / `NEGATIVE_DISH_TAGS` + `DISH_TAG_LABELS` from `types/rating.ts`); "Skip" link to submit without tags
4. **Done**: animated checkmark; after 1.5s auto-collapse back to idle (now showing the new opinion)

Submission: on opinion selected (for 'okay') or tags confirmed (for 'liked'/'disliked'):
- Call `submitInContextRating` from `ratingService.ts`
- Show success state immediately (optimistic)
- On error: revert to idle, show toast

**`apps/mobile/src/screens/RestaurantDetailScreen.tsx`**

The screen already has `dishRatings: Map<string, DishRating>`. Also add:
```typescript
const [userDishOpinions, setUserDishOpinions] = useState<Map<string, DishOpinion>>(new Map());
```

On screen load (after fetching `dishIds`): query `dish_opinions` for `WHERE user_id = user.id AND dish_id IN (dishIds)` to pre-populate existing user opinions. This enables the "already rated" state.

In the dish card render, below `<DishRatingBadge>`:
```tsx
{user && (
  <InContextRating
    dishId={dish.id}
    dishName={dish.name}
    restaurantId={restaurantId}
    existingOpinion={userDishOpinions.get(dish.id) ?? null}
    onRated={(opinion, tags) => {
      setUserDishOpinions(prev => new Map(prev).set(dish.id, opinion));
      // optimistic: update local dishRatings display (approximate)
    }}
  />
)}
```

Add a new service function to `dishRatingService.ts`:
```typescript
export async function getUserDishOpinions(
  userId: string,
  dishIds: string[]
): Promise<Map<string, DishOpinion>>
```
Queries `dish_opinions` for the most recent opinion per dish for this user.

### Integration: Previous Steps
- Calls `submitInContextRating` (Step 3)
- Uses `DishOpinion`, `DishTag`, `POSITIVE_DISH_TAGS`, `NEGATIVE_DISH_TAGS`, `DISH_TAG_LABELS` (Step 2 types)
- `existingOpinion` lookup needs Step 1 schema (no code dep, just works)

### Test Requirements
- Unit: InContextRating renders "Tried it?" when `existingOpinion === null`
- Unit: InContextRating renders highlighted opinion button when `existingOpinion = 'liked'`
- Unit: selecting 'okay' immediately calls `onRated` (no tags step)
- Unit: selecting 'liked' shows positive tags before calling `onRated`
- Unit: `getUserDishOpinions` returns correct `DishOpinion` per dish
- Integration: rate a dish in-context → verify `dish_opinions` row in DB; reload screen → verify `existingOpinion` is pre-populated

### Demo
Open RestaurantDetailScreen for a restaurant with dishes. Each dish card shows "Tried it?" button. Tap it → 3 opinion buttons appear → tap 👍 → positive tags appear → tap "Great flavor" → checkmark animation → collapses showing the 👍 highlighted. Tap again → see the 👍 already selected; tap 😐 → updates to okay.

---

## Step 5: Full Flow Enhancement — Note Field

### Objective
Add the optional 47-character note field to the full post-visit rating flow (`RateDishScreen`). Users who take the time to go through the full flow can leave a brief note alongside their opinion.

### Implementation Guidance

**`apps/mobile/src/components/rating/RateDishScreen.tsx`**

Add local state: `const [note, setNote] = useState<string>('')`

Below the tags section, add "+ Add a note" expandable UI:
- Collapsed: a small tappable row "+ Add a note" (text button)
- Expanded: a `TextInput` with `maxLength={47}`, placeholder from i18n key `rating.rateDish.addNote`, and a character counter `"{47 - note.length} left"` that turns red below 10 chars
- Only show the note field after an opinion has been selected
- Clear the note when dish changes (add `note` to the `useEffect` reset on `dish.id`)

Update `handleSubmit`:
```typescript
onSubmit({
  dishId: dish.id,
  dishName: dish.name,
  opinion,
  tags: Array.from(selectedTags),
  photoUri,
  note: note.trim() || undefined,  // only include if non-empty
});
```

**`apps/mobile/src/services/ratingService.ts` — `saveDishOpinions`**

Update the upsert payload to include `note`:
```typescript
const { error: opinionError } = await supabase.from('dish_opinions').upsert(
  {
    user_id: userId,
    dish_id: rating.dishId,
    visit_id: visitId,
    opinion: rating.opinion,
    tags: rating.tags,
    photo_id: photoId,
    note: rating.note ?? null,       // new
    source: 'full_flow',             // new
  },
  { onConflict: 'user_id,dish_id,visit_id' }
);
```

Also add `source: 'in_context'` to the upsert in `submitInContextRating` (already specified in Step 3 — just confirm it's there).

### Integration: Previous Steps
- `note` field on `DishRatingInput` added in Step 2
- `source` column on `dish_opinions` added in Step 1
- `RateDishScreen` props unchanged (note is internal state, per design)

### Test Requirements
- Unit: `RateDishScreen` — note field not visible before opinion selected
- Unit: note input enforces 47-char limit (`maxLength` prop)
- Unit: empty note after trim is not included in `DishRatingInput` (undefined, not `""`)
- Integration: submit full flow with note → verify `dish_opinions.note` persists in DB
- Integration: submit full flow without note → verify `dish_opinions.note` is NULL (not empty string)

### Demo
Open the full post-visit rating flow. Rate a dish as "Loved it" → "+ Add a note" appears below tags → tap it → text input expands with "47 left" counter → type "the carbonara was great but skip the tiramisu" (47 chars exactly) → counter reaches 0 → submit → check DB row has note persisted.

---

## Step 6: Updated Display Components

### Objective
Update `DishRatingBadge` and `RestaurantRatingBadge` to use the new display format: percentage + count + tier badges for dishes, and Bayesian food score + experience breakdown for restaurants.

### Implementation Guidance

**`apps/mobile/src/components/DishRatingBadge.tsx`**

Update props:
```typescript
interface DishRatingBadgeProps {
  likePercentage: number | null;
  totalRatings: number;
  topTags: string[];
  maxTags?: number;      // default: 2
  showBadge?: boolean;   // default: true
  compact?: boolean;     // default: false — for map pin use
}
```

Render logic:
- **Minimum threshold**: return `null` if `totalRatings < 3` (was `=== 0`)
- **Tier badge**: call `getRatingTier(likePercentage, totalRatings)` from `dishRatingService`:
  - `'top'`: prepend `🔥` before the percentage
  - `'good'`: no icon, just the percentage
  - `'neutral'` / `'none'`: no icon
- **Format**: `"🔥 85% 👍 (47)"` using updated `formatRatingText` (Step 2)
- Tags unchanged in structure, but now rendered with correct spacing: `· Great flavor · Good value`

**`apps/mobile/src/components/RestaurantRatingBadge.tsx`**

The component accepts `RestaurantRating` which now has renamed fields. Update all prop references:
- `rating.foodScore` (was derived from experience, now Bayesian dish score — already a 0–100 number, no `* 100`)
- `rating.servicePercentage` (was `serviceScore`)
- `rating.cleanlinessPercentage` (was `cleanlinessScore`)
- `rating.waitTimePercentage` (was `waitTimeScore`)
- `rating.valuePercentage` (was `valueScore`)

Update `getCategoryLabel`: the `percentage` parameter is now already 0–100, so remove the `* 100` multiplication inside the function.

Optionally surface `totalDishRatings` in the Food label: `"Delicious (124 dish ratings)"` — or keep it clean and just show the label. Recommendation: keep clean, add count only on the detailed view.

Update `RestaurantDetailScreen.tsx` to pass the correctly typed `RestaurantRating` — field renames from Step 2 should propagate here via TypeScript errors.

### Integration: Previous Steps
- Uses `getRatingTier` and `formatRatingText` from Step 2
- Uses updated `RestaurantRating` interface from Step 2
- DB views from Step 1 provide the new column values

### Test Requirements
- Unit: `DishRatingBadge` renders `null` for `totalRatings = 2` (below threshold)
- Unit: `DishRatingBadge` renders `🔥` for 90%+ with 20+ ratings
- Unit: `DishRatingBadge` renders no badge icon for 85% with 15 ratings
- Unit: `RestaurantRatingBadge` correctly maps new field names to category labels
- Unit: `RestaurantRatingBadge` no longer multiplies scores by 100 (verify correct label at e.g. `servicePercentage = 88`)
- Snapshot: render `DishRatingBadge` with known values and compare to expected output string

### Demo
Open `RestaurantDetailScreen` for a restaurant with rated dishes. Dish cards now show `"🔥 87% 👍 (23) · Great flavor · Good portion"` for top-rated dishes. Restaurant badge at top shows `"Delicious · Excellent service · Clean · Quick · Great value"` colored labels. A dish with only 2 ratings shows nothing (below threshold).

---

## Step 7: Gamification — Streaks + Trusted Taster Badge

### Objective
Implement streak tracking and the Trusted Taster badge. Both are checked client-side after each rating submission (full flow and in-context), award points/badges when milestones are hit, and surface feedback in the UI.

### Implementation Guidance

**New file: `apps/mobile/src/services/gamificationService.ts`**

```typescript
// Streak milestones: { weeks: number, points: number }[]
const STREAK_MILESTONES = [
  { weeks: 3, points: 15 },
  { weeks: 7, points: 30 },
  { weeks: 14, points: 50 },
];

export interface StreakResult {
  currentStreak: number;
  longestStreak: number;
  milestoneHit: { weeks: number; points: number } | null;
}

export async function updateStreak(userId: string): Promise<StreakResult>
```

Logic for `updateStreak`:
1. Fetch current row from `user_streaks` (or create if not exists)
2. Get ISO week start date for today
3. If `last_rating_week === thisWeek`: no change (already rated this week), return current streak
4. If `last_rating_week === lastWeek`: increment `current_streak`, update `last_rating_week`
5. Else: reset `current_streak` to 1, update `last_rating_week`
6. Update `longest_streak` if `current_streak > longest_streak`
7. Check if `current_streak` exactly equals any milestone week (3, 7, or 14): if so, award points and return `milestoneHit`
8. Upsert `user_streaks` row

```typescript
export interface BadgeResult {
  earned: boolean; // true if badge was just awarded this call
}

export async function checkAndAwardTrustedTasterBadge(userId: string): Promise<BadgeResult>
```

Logic:
1. Check if badge already awarded: `SELECT id FROM user_badges WHERE user_id=$userId AND badge_type='trusted_taster'` — if exists, return `{ earned: false }`
2. Check eligibility using two separate queries:
   - Total tagged ratings: `SELECT COUNT(*) FROM dish_opinions WHERE user_id=$userId AND tags IS NOT NULL AND array_length(tags,1) > 0` — must be ≥20
   - Tenure: `SELECT MIN(created_at) FROM dish_opinions WHERE user_id=$userId AND tags IS NOT NULL AND array_length(tags,1) > 0` — earliest must be ≤ now() - 3 months
   Both conditions must pass. (Previous single-query approach only counted old ratings, which was incorrect.)
3. If eligible: INSERT into `user_badges`; INSERT into `user_points` (cosmetic: 0 pts or a bonus — badge is its own reward; recommend 0 pts to avoid inflating the economy)
4. Return `{ earned: true }`

**Wire into rating submissions:**

In `ratingService.ts — submitRating` (after successful submission, non-fatal):
```typescript
const [streakResult, badgeResult] = await Promise.all([
  updateStreak(userId).catch(() => null),
  checkAndAwardTrustedTasterBadge(userId).catch(() => null),
]);
return { success: true, streakResult, badgeResult };
```

In `submitInContextRating` — same pattern.

Update **both** `submitRating` and `submitInContextRating` return types to:
```typescript
Promise<{
  success: boolean;
  error?: string;
  streakResult?: StreakResult | null;
  badgeResult?: BadgeResult | null;
}>
```

**`apps/mobile/src/components/rating/RatingCompleteScreen.tsx`**

Accept optional `streakResult` and `badgeResult` props. If `streakResult?.milestoneHit` is set, show a celebration row: `"🔥 {N}-week streak! +{pts} pts"`. If `badgeResult?.earned`, show `"🏅 Trusted Taster badge earned!"`.

For in-context ratings, show a brief toast (not a full screen) with the same info if a milestone was hit.

### Integration: Previous Steps
- Reads/writes `user_streaks` and `user_badges` tables from Step 1
- Writes `user_points` (existing table, new action types `weekly_streak_bonus`)
- Hooks into `submitRating` and `submitInContextRating` from Step 3
- `RatingCompleteScreen` updates consume `streakResult`/`badgeResult` from the modal's `onComplete` handler in `RatingFlowModal`

### Test Requirements
- Unit: `updateStreak` — rating first time: streak = 1, no milestone
- Unit: `updateStreak` — rating same week twice: streak unchanged, `last_rating_week` unchanged
- Unit: `updateStreak` — rating 3 consecutive weeks: `milestoneHit = { weeks: 3, points: 15 }` on exactly week 3
- Unit: `updateStreak` — skipping a week: streak resets to 1
- Unit: `checkAndAwardTrustedTasterBadge` — not eligible (only 5 tagged ratings): returns `{ earned: false }`
- Unit: `checkAndAwardTrustedTasterBadge` — already has badge: returns `{ earned: false }`, no duplicate insert
- Integration: simulate 20 tagged ratings (≥3 months apart) → verify badge row inserted + no duplicate on second call
- Integration: `RatingCompleteScreen` renders milestone row when `milestoneHit` is set

### Demo
Complete a rating in the full flow. `RatingCompleteScreen` shows the existing points breakdown. Simulate a 3-week streak (by manually inserting `user_streaks` rows with consecutive `last_rating_week` values) and complete one more rating — the complete screen now shows `"🔥 3-week streak! +15 pts"` alongside the regular points. Trigger Trusted Taster eligibility and see `"🏅 Trusted Taster badge earned!"` appear.

---

## Step 8: i18n Strings (EN / ES / PL)

### Objective
Add all new localization keys for the features built in Steps 4–7 to all three locale files. Without this step, new UI elements will show raw key strings.

### Implementation Guidance

**Files to update:**
- `apps/mobile/src/locales/en.json`
- `apps/mobile/src/locales/es.json`
- `apps/mobile/src/locales/pl.json`

**New keys to add** (under existing `"rating"` namespace):

```json
"rating": {
  ...existing keys...,

  "inContext": {
    "triedIt": "Tried it?",
    "ratedSuccess": "Rated!"
  },

  "rateDish": {
    ...existing keys...,
    "addNote": "Add a note (optional)",
    "noteCharLimit": "{{count}} left"
  },

  "streak": {
    "weekStreak": "{{count}}-week streak!",
    "bonus": "+{{points}} bonus pts"
  },

  "badge": {
    "trustedTaster": "Trusted Taster",
    "earned": "Badge earned!"
  },

  "complete": {
    ...existing keys...,
    "streakMilestone": "🔥 {{count}}-week streak! +{{points}} pts",
    "badgeEarned": "🏅 Trusted Taster badge earned!"
  }
}
```

For ES and PL, provide accurate translations (not placeholder text). Use the same i18next interpolation syntax (`{{count}}`, `{{points}}`).

### Integration: Previous Steps
All components built in Steps 4–7 call `useTranslation()` using these keys. Without this step, they either show fallback English strings or raw key paths.

### Test Requirements
- All new keys present in all three locale files (`en.json`, `es.json`, `pl.json`)
- No missing interpolation variables (e.g., `{{count}}` must exist in every plural form)
- `i18next` does not emit "missing key" warnings for any new key in English

### Demo
Switch device language to Spanish. Open the rating flow and verify: "Tried it?" → "¿Lo probaste?", note placeholder, streak messages, and badge text all appear in Spanish. Repeat for Polish.

---

## Notes for Implementation

- Context documents (this plan, detailed-design.md, idea-honing.md, research/) should all be available during implementation.
- Steps 4 and 5 can be worked on in parallel by different developers — they touch different components with no shared state changes.
- Step 8 (i18n) can be started as soon as Step 4 is begun — the key names are known.
- The `packages/database/src/types.ts` auto-generated file will need to be regenerated after Step 1 using `supabase gen types typescript`. This must be done before Step 2 can be completed cleanly.
