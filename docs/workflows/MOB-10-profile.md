# MOB-10 — Profile & Settings

## Overview

The profile section gives users a view of their account information, activity statistics, dietary preferences, and app settings. It also provides the sign-out action.

---

## Key Files

| File                                                   | Role                                           |
| ------------------------------------------------------ | ---------------------------------------------- |
| `apps/mobile/src/screens/ProfileScreen.tsx`            | Main profile screen (swipe-to-close modal)     |
| `apps/mobile/src/screens/ProfileEditScreen.tsx`        | Edit profile name and avatar                   |
| `apps/mobile/src/screens/SettingsScreen.tsx`           | App settings (language, notifications, etc.)   |
| `apps/mobile/src/screens/ViewedHistoryScreen.tsx`      | List of recently viewed restaurants            |
| `apps/mobile/src/components/ProfileCompletionCard.tsx` | Card showing onboarding completion %           |
| `apps/mobile/src/components/LanguageSelector.tsx`      | Language switcher component                    |
| `apps/mobile/src/stores/authStore.ts`                  | `updateProfile()`, `signOut()`                 |
| `apps/mobile/src/stores/onboardingStore.ts`            | `profileCompletion`, `profilePoints`           |
| `apps/mobile/src/stores/filterStore.ts`                | Reads permanent filter preferences for display |

---

## ProfileScreen

Opened from the `FloatingMenu` on the map screen. Presented as a transparent modal with swipe-to-close (same pattern as Filters/Favorites — see improvement D4).

### Content sections

1. **User info**: Avatar (placeholder), display name, email address
2. **Activity stats**: Fetched from `user_swipes` table on mount
   - Total interactions
   - Likes (right swipes + super swipes)
   - Dislikes (left swipes)
3. **Profile completion card**: Shows `profileCompletion` percentage; taps into the onboarding flow if incomplete
4. **Dietary preferences summary**: Reads from `filterStore.permanent` (diet type, allergies)
5. **Action buttons**:
   - Edit Profile → `ProfileEditScreen`
   - Settings → `SettingsScreen`
   - My History → `ViewedHistoryScreen`
   - Sign Out → `authStore.signOut()`

### Stats loading

```
ProfileScreen mounts
  → user = authStore.user
  → if user: supabase.from('user_swipes').select('action').eq('user_id', user.id)
    → Count total, filter for likes (action='right' OR 'super') and dislikes ('left')
    → setStats({ interactions, likes, dislikes })
```

---

## ProfileEditScreen

Allows users to update:

- **Profile name** (`user.user_metadata.profile_name`)
- **Avatar** (planned — not yet wired to a real image picker)

```
User edits name → taps Save
  → authStore.updateProfile({ profile_name: newName })
    → supabase.auth.updateUser({ data: { profile_name } })
    → Also UPDATE user_profiles SET profile_name WHERE user_id
  → Success toast shown → navigate back
```

---

## SettingsScreen

App-level settings including:

- **Language**: English / Spanish / Polish
  - Uses `i18n.changeLanguage(code)` from `apps/mobile/src/i18n/`
  - Persisted to AsyncStorage and applied on next app load
- **Notifications**: Toggle for various notification types (planned)
- **Currency**: The user's preferred display currency (linked to `filterStore.permanent.currency`)
- **About / Privacy Policy / Terms of Service**: External links

---

## ViewedHistoryScreen

Shows restaurants that the user has previously viewed, sourced from the `sessionStore.recentRestaurants` list or from the `user_visits` Supabase table.

> **Status**: The exact data source (local session store vs. DB query) should be verified in the implementation.

---

## Language System

The mobile app supports 3 languages managed by `react-i18next`:

| Language | Code | Translation file                  |
| -------- | ---- | --------------------------------- |
| English  | `en` | `apps/mobile/src/locales/en.json` |
| Spanish  | `es` | `apps/mobile/src/locales/es.json` |
| Polish   | `pl` | `apps/mobile/src/locales/pl.json` |

The `LanguageSelector` component also appears on the `LoginScreen` so unauthenticated users can switch language before signing in.

Language is changed via:

```typescript
import { changeLanguage } from '../../i18n';
await changeLanguage('es'); // Persists to AsyncStorage
```

---

## Sign Out

```
User taps "Sign Out" on ProfileScreen
  → authStore.signOut()
    → supabase.auth.signOut()
    → AsyncStorage session cleared
    → authStore: user = null, session = null
  → RootNavigator detects null user → AuthNavigator rendered
  → User sees LoginScreen
```
