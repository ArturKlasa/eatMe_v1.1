# MOB-02 — User Onboarding (Preference Collection)

## Overview

After first login, new users are guided through a 2-step onboarding flow to collect their dietary preferences and cuisine tastes. This data is used to personalise the map, the swipe feed, and restaurant recommendations.

The onboarding can be:

1. **Triggered automatically** after registration (if the user hasn't completed it)
2. **Triggered manually** from the Profile screen
3. **Skipped** by the user (preferences stay at defaults)

---

## Key Files

| File                                                           | Role                                                                 |
| -------------------------------------------------------------- | -------------------------------------------------------------------- |
| `apps/mobile/src/stores/onboardingStore.ts`                    | Zustand store managing onboarding state, form data, and DB sync      |
| `apps/mobile/src/screens/onboarding/OnboardingStep1Screen.tsx` | Step 1: Diet type, protein preferences, allergies                    |
| `apps/mobile/src/screens/onboarding/OnboardingStep2Screen.tsx` | Step 2: Favourite cuisines, favourite dishes, spice tolerance        |
| `apps/mobile/src/components/ProfileCompletionBanner.tsx`       | Banner shown on map screen prompting users to complete their profile |
| `apps/mobile/src/components/ProfileCompletionCard.tsx`         | Card on profile screen showing completion percentage                 |

---

## Onboarding State

```typescript
// onboardingStore state
{
  currentStep: number,           // 1 or 2
  totalSteps: 2,
  isVisible: boolean,            // Whether the onboarding overlay is shown
  formData: {
    dietType: 'all' | 'vegetarian' | 'vegan',
    proteinPreferences: string[], // ['meat', 'fish', 'seafood', 'egg']
    allergies: string[],          // ['nuts', 'dairy', 'gluten', ...]
    favoriteCuisines: string[],   // ['Italian', 'Japanese', ...]
    favoriteDishes: string[],     // ['pizza', 'sushi', ...]
    spiceTolerance: 'yes' | 'no',
  },
  isCompleted: boolean,
  profileCompletion: number,     // 0–100 percentage
  profilePoints: number,
}
```

---

## Flow — First-Time Onboarding

```
User completes registration → MainNavigator renders
  → Map screen mounts
  → ProfileCompletionBanner checks onboardingStore.shouldShowPrompt()
    → If not completed AND cooldown expired → banner appears
  → User taps banner or "Complete Profile" CTA
    → onboardingStore.showOnboarding()
    → Navigation to OnboardingStep1Screen
```

### Step 1 (`OnboardingStep1Screen`)

The user selects:

- **Diet type**: Everything / Vegetarian / Vegan (single choice, emoji buttons)
- **Protein preferences**: Meat, Fish, Seafood, Egg (multi-select; only shown if diet ≠ vegan/vegetarian)
- **Allergies**: Nuts, Dairy, Gluten, Shellfish, Eggs, Soy (multi-select)

```
User makes selections
  → onboardingStore.updateFormData({ dietType, proteinPreferences, allergies })
  → User taps "Next"
    → onboardingStore.nextStep() → currentStep = 2
    → navigation.navigate('OnboardingStep2')
```

### Step 2 (`OnboardingStep2Screen`)

The user selects:

- **Favourite cuisines** (multi-select from a list)
- **Favourite dishes** (multi-select from a list)
- **Spice tolerance** (Yes / No)

```
User makes selections
  → onboardingStore.updateFormData({ favoriteCuisines, favoriteDishes, spiceTolerance })
  → User taps "Finish"
    → onboardingStore.completeOnboarding()
      → Saves to AsyncStorage (key: @eatme_onboarding)
      → savePreferences(userId) → writes to Supabase user_preferences table
      → isCompleted = true
      → updateProfileStats() → recalculates profileCompletion %
    → onboardingStore.hideOnboarding()
    → Return to Map screen
```

---

## Database Persistence

Preferences are saved to the `user_preferences` table (migration `022`) via `userPreferencesService.saveUserPreferences()`:

```
user_preferences row:
  - user_id
  - diet_type
  - protein_preferences (array)
  - allergies (array)
  - favorite_cuisines (array)
  - favorite_dishes (array)
  - spice_tolerance
```

On login, `onboardingStore.loadUserPreferences(userId)` reads this table and populates `formData`, so preferences are restored across devices.

---

## Prompt Cooldown

`shouldShowPrompt()` returns `true` only if:

- `isCompleted === false`, AND
- The last time the prompt was shown was more than 24 hours ago (`PROMPT_COOLDOWN_HOURS = 24`)

This prevents the onboarding banner from being annoying on every app open.

---

## Profile Completion Percentage

`updateProfileStats()` calculates a `profileCompletion` score (0–100%) based on:

- Has chosen diet type (not just default 'all')
- Has selected at least one cuisine
- Has selected at least one dish
- Has set spice tolerance
- Has set protein preferences

This percentage is displayed on the `ProfileCompletionCard` in the Profile screen and on the `ProfileCompletionBanner` on the Map screen.

---

## Skip / Dismiss

- "Skip for now" → `onboardingStore.skipOnboarding()` → sets `lastPromptShown` (starts cooldown), hides overlay but does **not** mark as completed
- "Don't show again" is not currently implemented — users will continue to see the banner until they complete or skip with a 24h cooldown

---

## Relationship to Filter Store

The `permanent` filters in `filterStore` mirror some onboarding preferences (diet type, allergies). When onboarding is completed, the `filterStore` is not automatically updated — the two stores are kept in sync during login via `filterStore.syncWithDatabase()`. This means there can be a lag between onboarding completion and filter application until the next login.
