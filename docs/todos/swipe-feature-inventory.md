# Swipe Feature — Complete Inventory

> **Purpose:** Catalogue every file and symbol that touches swipe functionality so a developer can make informed removal decisions.

> **Scope note:** This document covers two distinct meanings of "swipe" in the codebase:
>
> - **Dish-preference swipe** — the Tinder-style card deck mechanic where users swipe left/right/super on dishes to express preferences. This is the primary swipe _feature_.
> - **Swipe-to-close gesture** — the pan-down gesture used by modal screens to dismiss themselves. This is a UI _affordance_, not the swipe feature, and is listed separately in [§6](#6-ui-swipe-to-close-gesture--unrelated-to-dish-preference-swiping).

---

## Table of Contents

1. [Edge Functions](#1-edge-functions)
2. [Database — Tables](#2-database--tables)
3. [Database — Columns in Shared Tables](#3-database--columns-in-shared-tables)
4. [Database — SQL Functions](#4-database--sql-functions)
5. [Mobile App — Active Code](#5-mobile-app--active-code)
6. [UI Swipe-to-Close Gesture (unrelated to dish-preference swiping)](#6-ui-swipe-to-close-gesture--unrelated-to-dish-preference-swiping)
7. [Mobile App — Shelved / Commented-Out Code](#7-mobile-app--shelved--commented-out-code)
8. [i18n Locale Keys](#8-i18n-locale-keys)
9. [TypeScript Type Definitions](#9-typescript-type-definitions)
10. [Feed Function — Indirect Dependency](#10-feed-function--indirect-dependency)
11. [Documentation Files](#11-documentation-files)
12. [Planning and Historical Docs](#12-planning-and-historical-docs)

---

## 1. Edge Functions

### `swipe` (primary)

| Location                                  | Status                                  |
| ----------------------------------------- | --------------------------------------- |
| `supabase/functions/swipe/index.ts`       | **Active** — deployed copy              |
| `infra/supabase/functions/swipe/index.ts` | **Active** — mirror (identical content) |

**What it does:**

- `POST /functions/v1/swipe` — accepts `{ userId, dishId, action: 'left'|'right'|'super', viewDuration?, position?, sessionId?, context? }`
- Inserts a row into `user_swipes`
- Asynchronously increments `dish_analytics.right_swipe_count` / `left_swipe_count` / `super_like_count`
- Asynchronously upserts `user_behavior_profiles` — increments `total_swipes`, `right_swipes` or `left_swipes`
- Returns `{ success: true, message: "Swipe recorded" }`

> **Note:** The swipe function does **not** write to `user_dish_interactions`. The preference vector pipeline (`update-preference-vector`) reads from `user_dish_interactions`, not `user_swipes`. These are separate pipelines.

### `update-preference-vector` (indirect)

| Location                                                     | Status          |
| ------------------------------------------------------------ | --------------- |
| `infra/supabase/functions/update-preference-vector/index.ts` | Active          |
| `supabase/functions/update-preference-vector/index.ts`       | Active — mirror |

This function is **not a swipe function** but depends on `user_behavior_profiles.preference_vector_updated_at` (a field written by the swipe pipeline). It reads from `user_dish_interactions` to compute vectors and writes back to `user_behavior_profiles`. If the swipe feature is removed, this function continues to work normally via `interactionService.ts`.

---

## 2. Database — Tables

### `user_swipes`

**Schema source:** `infra/supabase/migrations/database_schema.sql` (line 476)

```sql
CREATE TABLE public.user_swipes (
  id          uuid        PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id     uuid        NOT NULL — FK → auth.users
  dish_id     uuid        NOT NULL — FK → public.dishes
  action      text        NOT NULL CHECK (action IN ('left', 'right', 'super'))
  session_id  text
  position    integer
  context     jsonb
  created_at  timestamptz DEFAULT now()
);
```

**RLS migration reference:** `infra/supabase/migrations/012b_*.sql` (INSERT/SELECT own rows; ALL for service_role)

**Consumers:**

- Written by: `swipe` Edge Function only
- Read by: `apps/mobile/src/screens/ProfileScreen.tsx` (to show interaction stats)
- Referenced in type: `packages/database/src/types.ts` (line 1659)

---

## 3. Database — Columns in Shared Tables

These columns live inside tables that are **not exclusively** swipe tables, so they cannot be dropped without a targeted migration.

### `dish_analytics` table

| Column              | Type                | Written by            | Read by                                                         |
| ------------------- | ------------------- | --------------------- | --------------------------------------------------------------- |
| `right_swipe_count` | `integer DEFAULT 0` | `swipe` Edge Function | `feed` Edge Function (via `generate_candidates_exclude_params`) |
| `left_swipe_count`  | `integer DEFAULT 0` | `swipe` Edge Function | nowhere currently                                               |
| `recent_swipes_24h` | `integer DEFAULT 0` | `swipe` Edge Function | nowhere currently                                               |

**Schema source:** `infra/supabase/migrations/database_schema.sql` (lines 66–74)

### `user_behavior_profiles` table

| Column                         | Type                          | Written by                    | Read by                                  |
| ------------------------------ | ----------------------------- | ----------------------------- | ---------------------------------------- |
| `total_swipes`                 | `integer DEFAULT 0`           | `swipe` Edge Function         | nowhere currently                        |
| `right_swipes`                 | `integer DEFAULT 0`           | `swipe` Edge Function         | nowhere currently                        |
| `left_swipes`                  | `integer DEFAULT 0`           | `swipe` Edge Function         | nowhere currently                        |
| `super_swipes`                 | `integer DEFAULT 0`           | `swipe` Edge Function         | nowhere currently                        |
| `right_swipe_rate`             | `double precision` (computed) | Derived from above            | nowhere currently                        |
| `preference_vector`            | `vector(1536)`                | `update-preference-vector` fn | `feed` Edge Function                     |
| `preference_vector_updated_at` | `timestamptz`                 | `update-preference-vector` fn | `update-preference-vector` fn (debounce) |

**Schema source:** `infra/supabase/migrations/database_schema.sql` (lines 397–418)

> **Note:** `preference_vector` and `preference_vector_updated_at` are written by `update-preference-vector` (not the swipe function). They would survive swipe removal.

---

## 4. Database — SQL Functions

### `generate_candidates_exclude_params`

**File:** `infra/supabase/migrations/071_generate_candidates_exclude_params.sql`

Uses `right_swipe_count` (line 74, 119) as an output column from `dish_analytics`. This is used by the `feed` Edge Function for candidate scoring. If swipe is removed and the column is kept (just frozen at 0), the feed function continues to work but loses swipe-based popularity signals.

---

## 5. Mobile App — Active Code

### `apps/mobile/src/screens/ProfileScreen.tsx`

| Lines | What it does                                                                                                                              |
| ----- | ----------------------------------------------------------------------------------------------------------------------------------------- |
| 65–73 | Queries `user_swipes` table (`.from('user_swipes').select('action').eq('user_id', ...)`) to count total interactions, likes, and dislikes |
| 273   | Renders `{t('profile.totalSwipes')}` stat label                                                                                           |

This is the **only active mobile code** that reads the `user_swipes` table. The query is gracefully handled — if the table is empty or removed, the stats section shows zeros.

---

## 6. UI Swipe-to-Close Gesture — UNRELATED to Dish-Preference Swiping

These files use the word "swipe" in a completely different context: a pan-gesture that lets users swipe down to dismiss modal screens. **This is not the dish recommendation swipe feature.**

| File                                          | Role                                                                                      |
| --------------------------------------------- | ----------------------------------------------------------------------------------------- |
| `apps/mobile/src/hooks/useSwipeToClose.ts`    | Pan responder hook — detects downward drag, animates screen off-screen, calls `onClose()` |
| `apps/mobile/src/screens/FiltersScreen.tsx`   | Imports `useSwipeToClose` for modal dismiss                                               |
| `apps/mobile/src/screens/FavoritesScreen.tsx` | Imports `useSwipeToClose` for modal dismiss                                               |
| `apps/mobile/src/hooks/index.ts` (line 8)     | Re-exports `useSwipeToClose`                                                              |
| `docs/project/05-mobile-app.md`               | Documents `useSwipeToClose` hook                                                          |

**Do not remove these** if the goal is to remove the dish-preference swipe feature.

---

## 7. Mobile App — Shelved / Commented-Out Code

The core dish-swipe UI (card deck) was built and then shelved. References survive as comments:

| File                                               | Line    | Content                                                                                                                           |
| -------------------------------------------------- | ------- | --------------------------------------------------------------------------------------------------------------------------------- |
| `apps/mobile/src/services/edgeFunctionsService.ts` | 247–248 | `// trackSwipe(), SwipeRequest, and generateSessionId() have been shelved.` `// See shelf/swipe-feature/services/swipeService.ts` |
| `apps/mobile/src/hooks/index.ts`                   | 6       | `// useAllDishes shelved — see shelf/swipe-feature/hooks/useAllDishes.ts`                                                         |
| `apps/mobile/src/screens/FavoritesScreen.tsx`      | 13      | `// Will be enhanced with swipe preferences integration in later tasks.`                                                          |

> **Note:** `shelf/swipe-feature/` is referenced in comments but the directory does **not exist** in the working tree (it was never committed or was deleted). These are dead comments only.

---

## 8. i18n Locale Keys

### `swipe` namespace

The `swipe` locale key block exists in all three language files but is **not referenced anywhere in active code** (the SwipeDemo screen it described was never implemented or was shelved).

| File                                         | Key path                          | Value (en)                   |
| -------------------------------------------- | --------------------------------- | ---------------------------- |
| `apps/mobile/src/locales/en.json` (line 658) | `swipe.title`                     | `"Swipe Demo"`               |
|                                              | `swipe.gettingLocation`           | `"Getting your location..."` |
|                                              | `swipe.loadingDishes`             | `"Loading dishes..."`        |
|                                              | `swipe.noMoreDishes`              | `"No more dishes nearby!"`   |
|                                              | `swipe.noMoreDishesHint`          | `"Try adjusting …"`          |
|                                              | `swipe.startOver`                 | `"Start Over"`               |
|                                              | `swipe.sessionStats`              | `"Session Stats:"`           |
|                                              | `swipe.liked`                     | `"❤️ Liked:"`                |
|                                              | `swipe.passed`                    | `"✕ Passed:"`                |
|                                              | `swipe.personalizedBanner`        | `"✨ Personalized for you…"` |
|                                              | `swipe.noImage`                   | `"No Image"`                 |
| Mirrored in                                  | `apps/mobile/src/locales/es.json` | —                            |
| Mirrored in                                  | `apps/mobile/src/locales/pl.json` | —                            |

### `profile.totalSwipes` key

Used actively in `ProfileScreen.tsx`:

| File                                         | Key path              | Value (en)       |
| -------------------------------------------- | --------------------- | ---------------- |
| `apps/mobile/src/locales/en.json` (line 618) | `profile.totalSwipes` | `"Total Swipes"` |
| Mirrored in                                  | `es.json`, `pl.json`  | —                |

### `favorites.emptyMessage`

`apps/mobile/src/locales/en.json` contains: `"Start swiping on dishes and liking restaurants…"` — this is UI copy referencing the concept of swiping. Safe to reword.

---

## 9. TypeScript Type Definitions

**File:** `packages/database/src/types.ts`

| Lines     | Symbol                               | Description                                                                       |
| --------- | ------------------------------------ | --------------------------------------------------------------------------------- |
| 1659–1695 | `user_swipes` table type             | Row, Insert, Update shapes for `user_swipes`                                      |
| 229–266   | `dish_analytics` type fields         | `right_swipe_count`, `left_swipe_count`, `recent_swipes_24h`                      |
| 1447–1500 | `user_behavior_profiles` type fields | `total_swipes`, `right_swipes`, `left_swipes`, `super_swipes`, `right_swipe_rate` |
| 1460–1503 | `user_behavior_profiles` type fields | `preference_vector`, `preference_vector_updated_at`                               |
| 2225–2234 | View type fields                     | `recent_swipes_24h`, `last_swiped`                                                |

Types are auto-generated from the database schema. They should be regenerated (not hand-edited) after schema changes.

---

## 10. Feed Function — Indirect Dependency

**File:** `infra/supabase/functions/feed/index.ts`

The feed function has two points of swipe dependency:

1. **Line 109** — `CandidateRow` type includes `right_swipe_count: number` (returned by `generate_candidates_exclude_params`). Used as a popularity signal in scoring.
2. **Lines 423, 478–530** — Reads `preference_vector` from `user_behavior_profiles` and passes it to `generate_candidates_exclude_params` for cosine-similarity ranking.

If the swipe feature is removed:

- `right_swipe_count` stays at 0 for all dishes → feed ranking loses swipe popularity signal but remains functional.
- `preference_vector` is unaffected (written by `update-preference-vector`, which reads `user_dish_interactions`).

---

## 11. Documentation Files

These docs reference the swipe feature and would need updating after removal:

| File                                            | Nature of reference                                           |
| ----------------------------------------------- | ------------------------------------------------------------- |
| `docs/project/workflows/preference-learning.md` | Entire document describes swipe → preference vector pipeline  |
| `docs/project/07-edge-functions.md`             | §5 documents the `swipe` Edge Function in full                |
| `docs/project/06-database-schema.md`            | Documents `user_swipes` table; swipe counters in other tables |
| `docs/project/05-mobile-app.md`                 | Lists `useSwipeToClose` hook (UI gesture, not dish swipe)     |
| `docs/project/README.md`                        | Links to `workflows/preference-learning.md`                   |
| `docs/project/09-deployment.md`                 | Lists `swipe` among deployed Edge Functions                   |
| `docs/project/01-project-overview.md`           | Describes preference vectors and swipe as a core mechanic     |

---

## 12. Planning and Historical Docs

These are planning/notes files. They do not affect the running system but may be confusing to new developers if left contradicting a post-removal codebase.

| File                                            | Section                                                  |
| ----------------------------------------------- | -------------------------------------------------------- |
| `.ppd-docs/tasks-new/phase-1-detailed-tasks.md` | §1.6 "Swipe Recommendation Flow" — implementation tasks  |
| `.ppd-docs/prompt-plan.md`                      | §1.6 "Swipe Recommendation Flow" — plan                  |
| `.ppd-docs/architecture.md`                     | Line 85 — "Swipe Flow" in architecture description       |
| `.ppd-docs/project.md`                          | Lines 99–102, 205, 207, 243 — swipe analysis and metrics |
| `README_eatme.md`                               | Line 94 — "Swipe Interface" in feature list              |
| `.github/copilot-instructions.md`               | Line 5, 314 — describes platform as "swipe-based"        |
| `PROMPT.md`                                     | Line 11, 13 — project description                        |
| `INTEGRATION_COMPLETE_SUMMARY.md`               | Various — historical integration notes                   |
