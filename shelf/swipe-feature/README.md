# Swipe Feature — Shelved

**Shelved:** March 13, 2026  
**Reason:** Core gesture UX (drag-to-swipe with animation) not yet implemented. The backend plumbing is complete and production-ready. Shelving until the gesture layer is built.

---

## What this is

The swipe screen is EatMe's primary dish discovery interface — a Tinder-style card stack where users swipe right (like) or left (pass) on individual dishes. Every interaction is recorded server-side and feeds back into the personalisation engine.

### What was fully working before shelving

| Layer                                     | Status      | Notes                                                                                                   |
| ----------------------------------------- | ----------- | ------------------------------------------------------------------------------------------------------- |
| Feed Edge Function (`/functions/v1/feed`) | ✅ Live     | Fetches nearby dishes, applies all permanent + daily filters, scores & ranks by distance/rating/history |
| `getFeed()` client                        | ✅ Complete | In `edgeFunctionsService.ts` — still used by BasicMapScreen                                             |
| `trackSwipe()` client                     | ✅ Complete | In `edgeFunctionsService.ts` — writes to `user_dish_interactions`                                       |
| Personalisation                           | ✅ Complete | Feed de-weights previously disliked dishes; boosts preferred cuisines                                   |
| Allergen hard-filter                      | ✅ Complete | Dishes with user's allergens are excluded server-side                                                   |
| Ingredients-to-avoid soft flag            | ✅ Complete | Dishes annotated with `flagged_ingredients[]` — amber warning shown on card                             |
| UI: card rendering                        | ✅ Complete | Image, name, restaurant, price, dietary tags, distance, match score, flagged warning                    |
| UI: tap buttons (✕ / ♥)                   | ✅ Complete | Functional — calls `handleSwipe()` correctly                                                            |
| UI: gesture swiping                       | ❌ Missing  | No `react-native-gesture-handler` pan gesture, no card animation                                        |

### What's missing before re-enabling

1. **Gesture recogniser** — `PanGestureHandler` from `react-native-gesture-handler` on the card
2. **Animated card** — `Animated.View` tracking `translateX` + `rotate` as the user drags
3. **Visual feedback** — "LIKE ✓" / "PASS ✕" overlays that fade in as you drag left/right
4. **Release animation** — spring-back on cancel, fly-off on threshold exceeded
5. (Optional) **Super-swipe gesture** — fast upward flick to save to favourites

---

## Files in this shelf

```
shelf/swipe-feature/
├── README.md                        ← this file
├── screens/
│   ├── SwipeScreen.tsx              ← main screen component
│   └── SwipeScreen.styles.ts        ← styles
├── services/
│   └── swipeService.ts              ← trackSwipe(), SwipeRequest, generateSessionId() — shelved March 18, 2026
└── hooks/
    └── useAllDishes.ts              ← hook for fetching all dishes (swipe feed) — shelved March 18, 2026
```

**Not shelved** (still in use by BasicMapScreen):

- `apps/mobile/src/services/edgeFunctionsService.ts` — `getFeed()`, `FeedRequest`, `FeedResponse`, `ServerDish` type

---

## How to restore

### 1. Copy files back

```bash
cp shelf/swipe-feature/screens/SwipeScreen.tsx       apps/mobile/src/screens/SwipeScreen.tsx
cp shelf/swipe-feature/screens/SwipeScreen.styles.ts apps/mobile/src/screens/SwipeScreen.styles.ts
```

Merge `trackSwipe()`, `SwipeRequest`, and `generateSessionId()` from
`shelf/swipe-feature/services/swipeService.ts` back into
`apps/mobile/src/services/edgeFunctionsService.ts`.

Restore the `useAllDishes` hook:

```bash
cp shelf/swipe-feature/hooks/useAllDishes.ts apps/mobile/src/hooks/useAllDishes.ts
```

Then re-add the export in `apps/mobile/src/hooks/index.ts`:

```typescript
export { useAllDishes } from './useAllDishes';
```

### 2. Re-export from screens index

In `apps/mobile/src/screens/index.ts`, add:

```typescript
export { SwipeScreen } from './SwipeScreen';
```

### 3. Add route to navigation types

In `apps/mobile/src/types/navigation.ts`, inside `MainStackParamList`:

```typescript
Swipe: undefined;
```

### 4. Register in the navigator

In `apps/mobile/src/navigation/RootNavigator.tsx`:

**Import:**

```typescript
import { ..., SwipeScreen } from '@/screens';
```

**Screen registration** (inside `MainNavigator`, after the `Map` screen):

```tsx
<MainStack.Screen
  name="Swipe"
  component={SwipeScreen}
  options={{
    headerShown: true,
    title: 'Swipe',
  }}
/>
```

### 5. Add gesture library (if not already done)

```bash
cd apps/mobile
npx expo install react-native-gesture-handler react-native-reanimated
npx expo prebuild --clean   # required — native module
```

Then wrap the card in a `GestureDetector` or `PanGestureHandler` and add `Animated` card motion.

### 6. Add a navigation entry point

Add a button in `BasicMapScreen` (or bottom tab bar) that calls:

```typescript
navigation.navigate('Swipe');
```

---

## Backend — no changes needed

The `feed` Edge Function is already deployed and handles everything. No backend work required to re-enable the feature.
