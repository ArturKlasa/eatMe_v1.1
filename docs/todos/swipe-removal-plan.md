# Swipe Feature — Removal Plan

> **Companion to:** [`swipe-feature-inventory.md`](./swipe-feature-inventory.md)
>
> **Goal:** Remove the dish-preference swipe feature entirely without breaking the feed, preference-vector pipeline, authentication, navigation, or any other running system.
>
> **Out of scope:** The `useSwipeToClose` hook and its usages in `FiltersScreen` / `FavoritesScreen` — these are UI gestures for modal dismissal and are **not** related to dish-preference swiping. Do not touch them.

---

## Dependency Map (what breaks if swipe is removed without care)

```
swipe Edge Function
    └─ writes → user_swipes  ←── read by ProfileScreen (stats only, non-fatal if empty)
    └─ writes → dish_analytics.right_swipe_count
                └─ read by generate_candidates_exclude_params SQL fn
                   └─ read by feed Edge Function (popularity signal, non-fatal if 0)
    └─ writes → user_behavior_profiles.(total_swipes, right_swipes, left_swipes, super_swipes)
                └─ read by nothing currently active

preference_vector (NOT a swipe dependency — fed by interactionService → user_dish_interactions)
    └─ written by update-preference-vector fn (reads user_dish_interactions, NOT user_swipes)
    └─ read by feed Edge Function (cosine-similarity ranking) — KEEP as-is
```

**Conclusion:** Removing the swipe feature has **no hard breaking dependencies**. The only soft degradations are:

- `ProfileScreen` stat section will show 0s (graceful)
- Feed loses swipe-based popularity signal (`right_swipe_count` stays at 0 for new dishes)

---

## Removal Phases

The plan is split into five independent phases, ordered from safest to most invasive. Each phase can be done separately and tested before proceeding.

---

## Phase 1 — Remove the Swipe Edge Function

**Risk:** Low. The function is not called by any active mobile code (`trackSwipe()` was shelved).

**Steps:**

1. Delete the Edge Function directories:

   ```bash
   rm -rf supabase/functions/swipe
   rm -rf infra/supabase/functions/swipe
   ```

2. Undeploy from Supabase (run from project root or Supabase Dashboard):

   ```bash
   supabase functions delete swipe
   ```

   Or delete via Supabase Dashboard → Edge Functions → swipe → Delete.

3. Remove the test in `infra/supabase/test-edge-functions.sh`:
   - Delete the "Test 3: Swipe Function" block (lines 91–124).

**Verification:** `POST /functions/v1/swipe` should return 404. All other Edge Functions unaffected.

---

## Phase 2 — Clean Up Mobile App Code

**Risk:** Low. Changes are isolated to a few files.

### 2a — Remove ProfileScreen swipe stats

**File:** `apps/mobile/src/screens/ProfileScreen.tsx`

1. Remove the `user_swipes` query in `loadUserStats()` (lines 65–73). Replace the stats read with `{ interactions: 0, likes: 0, dislikes: 0 }` or remove the stats display block entirely.
2. Remove the `{t('profile.totalSwipes')}` stat row (~line 273) from the JSX.

### 2b — Remove shelved comments

**File:** `apps/mobile/src/services/edgeFunctionsService.ts`

- Delete lines 247–248 (comment about shelved `trackSwipe()` and `swipeService.ts`).

**File:** `apps/mobile/src/hooks/index.ts`

- Delete line 6 (comment about shelved `useAllDishes`).

**File:** `apps/mobile/src/screens/FavoritesScreen.tsx`

- Delete line 13 (comment about swipe preferences integration).

### 2c — Remove unused i18n keys

**Files:** `apps/mobile/src/locales/en.json`, `es.json`, `pl.json`

1. Delete the entire `"swipe"` namespace block (`swipe.title`, `swipe.gettingLocation`, etc.) from all three files.
2. Delete the `"profile.totalSwipes"` key from all three files (only needed once ProfileScreen stat row is removed in 2a).
3. Optionally reword `favorites.emptyMessage` to remove the phrase "Start swiping on dishes…" if desired.

**Verification:** Run `turbo run check-types` — no TypeScript errors expected. Run the app and confirm ProfileScreen renders without errors; favorites/filters modals still swipe-to-close.

---

## Phase 3 — Remove the `user_swipes` Database Table

**Risk:** Medium (irreversible). Backup or snapshot first.

> **Prerequisite:** Phase 1 must be complete so nothing is writing to the table.

**Steps:**

1. Create migration `infra/supabase/migrations/072_remove_swipe_feature.sql`:

```sql
-- 072_remove_swipe_feature.sql
-- Removes the user_swipes table and related swipe counter columns.
-- Prerequisites: swipe Edge Function must be undeployed before running.

-- 1. Drop user_swipes table (no foreign keys point TO this table)
DROP TABLE IF EXISTS public.user_swipes;

-- 2. Remove swipe counters from dish_analytics
ALTER TABLE public.dish_analytics
  DROP COLUMN IF EXISTS right_swipe_count,
  DROP COLUMN IF EXISTS left_swipe_count,
  DROP COLUMN IF EXISTS recent_swipes_24h;

-- 3. Remove swipe counters from user_behavior_profiles
ALTER TABLE public.user_behavior_profiles
  DROP COLUMN IF EXISTS total_swipes,
  DROP COLUMN IF EXISTS right_swipes,
  DROP COLUMN IF EXISTS left_swipes,
  DROP COLUMN IF EXISTS super_swipes,
  DROP COLUMN IF EXISTS right_swipe_rate;

-- NOTE: preference_vector and preference_vector_updated_at are NOT removed here.
-- They are written by update-preference-vector (not the swipe function) and
-- read by the feed function for personalized ranking. Keep them.
```

2. Apply the migration via Supabase Dashboard SQL Editor (do NOT run `database_schema.sql`).

3. Update `infra/supabase/migrations/database_schema.sql` to reflect the new state (remove the `user_swipes` table block and the dropped columns).

**Verification:**

- `SELECT * FROM user_swipes;` → relation does not exist
- `SELECT right_swipe_count FROM dish_analytics LIMIT 1;` → column does not exist
- Feed Edge Function continues to work (test via `test-edge-functions.sh` Test 1 and Test 2)

---

## Phase 4 — Update TypeScript Types

**Risk:** Low, but requires regeneration.

After the schema changes in Phase 3, regenerate the Supabase types:

```bash
# From project root, with Supabase CLI authenticated
supabase gen types typescript --linked > packages/database/src/types.ts
```

This removes:

- `user_swipes` table type
- `right_swipe_count`, `left_swipe_count`, `recent_swipes_24h` from `dish_analytics`
- `total_swipes`, `right_swipes`, `left_swipes`, `super_swipes`, `right_swipe_rate` from `user_behavior_profiles`

**After regeneration:**

Check `infra/supabase/functions/feed/index.ts`:

- Line 109 references `right_swipe_count: number` on `CandidateRow`. If the column is dropped:
  - Update the `CandidateRow` type interface to remove this field.
  - Remove any reference to `right_swipe_count` in the scoring logic (if present).

Check `infra/supabase/migrations/071_generate_candidates_exclude_params.sql`:

- Lines 74 and 119 reference `right_swipe_count`. If the column is dropped, update the SQL function body to remove the column from the `SELECT` and the return type. Create migration `073_update_generate_candidates_no_swipe.sql` to `CREATE OR REPLACE FUNCTION generate_candidates_exclude_params(...)` without the column.

**Verification:** `turbo run check-types` — zero errors.

---

## Phase 5 — Update Documentation

**Risk:** Zero. Docs-only changes.

Update or remove references in `docs/project/`:

| File                                            | Action                                                                                                                                                                                                      |
| ----------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `docs/project/workflows/preference-learning.md` | Rewrite opening to clarify pipeline now driven solely by `user_dish_interactions`. Remove all `user_swipes` / swipe function references. Rename file to `preference-learning.md` or create a redirect note. |
| `docs/project/07-edge-functions.md`             | Delete §5 (swipe function section). Renumber remaining sections.                                                                                                                                            |
| `docs/project/06-database-schema.md`            | Remove `user_swipes` table section. Remove swipe columns from `dish_analytics` and `user_behavior_profiles` tables.                                                                                         |
| `docs/project/README.md`                        | Update or remove the "Preference Learning" workflow link description.                                                                                                                                       |
| `docs/project/09-deployment.md`                 | Remove `swipe` from the Edge Functions list.                                                                                                                                                                |
| `docs/project/01-project-overview.md`           | Remove "swipe" from the platform description; update preference vector description to say it is driven by explicit ratings/saves.                                                                           |
| `.github/copilot-instructions.md`               | Update the platform description (line 5) to remove "swipe-based preference learning".                                                                                                                       |

Planning docs (`.ppd-docs/`) can be left as historical reference or archived — they do not affect the running system.

---

## Checklist Summary

```
Phase 1 — Edge Function removal
  [ ] Delete supabase/functions/swipe/
  [ ] Delete infra/supabase/functions/swipe/
  [ ] Undeploy swipe function from Supabase
  [ ] Remove swipe test block from test-edge-functions.sh

Phase 2 — Mobile app cleanup
  [ ] Remove user_swipes query from ProfileScreen.tsx
  [ ] Remove totalSwipes stat row from ProfileScreen JSX
  [ ] Delete shelved comments (edgeFunctionsService.ts, hooks/index.ts, FavoritesScreen.tsx)
  [ ] Delete swipe i18n namespace from en/es/pl locale files
  [ ] Delete profile.totalSwipes i18n key from en/es/pl locale files

Phase 3 — Database migration
  [ ] Write migration 072_remove_swipe_feature.sql
  [ ] Apply via Supabase Dashboard SQL Editor
  [ ] Update database_schema.sql snapshot

Phase 4 — TypeScript types + Feed function
  [ ] Regenerate packages/database/src/types.ts
  [ ] Update CandidateRow type in feed/index.ts
  [ ] Write migration 073 to update generate_candidates_exclude_params (drop right_swipe_count)
  [ ] turbo run check-types → 0 errors

Phase 5 — Documentation
  [ ] Update docs/project/workflows/preference-learning.md
  [ ] Update docs/project/07-edge-functions.md
  [ ] Update docs/project/06-database-schema.md
  [ ] Update docs/project/README.md
  [ ] Update docs/project/09-deployment.md
  [ ] Update docs/project/01-project-overview.md
  [ ] Update .github/copilot-instructions.md
```

---

## What Is NOT Removed

To avoid scope creep, the following are explicitly **kept**:

| Item                                                         | Reason                                                                           |
| ------------------------------------------------------------ | -------------------------------------------------------------------------------- |
| `useSwipeToClose` hook and its usages                        | UI gesture (modal dismiss), unrelated to dish swiping                            |
| `preference_vector` / `preference_vector_updated_at` columns | Written by `update-preference-vector` fn; read by `feed` fn; not a swipe concern |
| `update-preference-vector` Edge Function                     | Reads `user_dish_interactions`, independent of swipe                             |
| `batch-update-preference-vectors` Edge Function              | Nightly job for preference vectors; independent of swipe                         |
| `user_dish_interactions` table                               | Used by rating, interaction, and preference vector systems                       |
| `interactionService.ts`                                      | Active service used by the rating and interaction flows                          |
