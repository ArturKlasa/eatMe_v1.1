# New User Creation — Research Findings

Investigated: migrations 071–081, database_schema.sql, AuthContext.tsx, authStore.ts, callback/route.ts

---

## What happens when a new user signs up

### Expected flow (per documentation intent)
1. `auth.users` row created by Supabase Auth
2. A DB trigger fires `AFTER INSERT ON auth.users`
3. Trigger creates: `public.users` (profile), `public.user_preferences` (defaults), and (implied) `public.user_behavior_profiles`
4. User is now fully set up and can use the app

### Actual flow (from code)

**Step 1 — auth.users row:** ✅ Created by Supabase Auth on signUp()

**Step 2 — public.users row:** ❓ No `CREATE TRIGGER` exists in any migration file.
The function to create it may exist in the Supabase dashboard (not version-controlled), or it may be entirely missing.

**Step 3 — user_preferences row:** ⚠️ Trigger function `create_user_preferences_on_signup()` is defined in migration 081, but:
- No `CREATE TRIGGER` statement exists in any migration file
- Migration 081's comment says it "fixes" an existing trigger — implying the trigger was created manually in the Supabase dashboard
- If the trigger IS attached (via dashboard), the function now works. But in a fresh environment it won't.

**Step 4 — user_behavior_profiles row:** ❌ No trigger function and no `CREATE TRIGGER` found anywhere. Row is never auto-created.

---

## Critical Issues Found

### Issue A: Trigger definitions not in version control

The `CREATE TRIGGER` binding(s) are absent from all migration files. Migration 081 defines the *function* but not the *trigger*. This means:
- In the live Supabase project: works (trigger exists via dashboard)
- In a fresh environment (new Supabase project, CI, staging): trigger does not fire → `user_preferences` and `public.users` rows are never created → broken app from the first signup

**Fix:** Add `CREATE OR REPLACE TRIGGER` statements to migration 081 (and a new migration for `public.users` and `user_behavior_profiles`).

---

### Issue B: Trigger silently swallows errors

```sql
EXCEPTION
  WHEN OTHERS THEN
    RAISE WARNING 'create_user_preferences_on_signup error: %', SQLERRM;
    RETURN NEW;  -- ← auth insert succeeds even if preferences creation failed
```

The EXCEPTION block catches all errors and returns `NEW` anyway. This means:
- Auth user is created ✅
- `user_preferences` row silently fails ❌
- User can log in but has no preferences row → any feature reading `user_preferences` returns null or fails FK checks on writes

**Fix:** For non-critical fields (preferences), this silent failure is acceptable. But it should at minimum emit a structured log. For `public.users`, the trigger should be more strict (or the missing row should be handled defensively in the app).

---

### Issue C: `user_behavior_profiles` never auto-created

No trigger, no function, no app-side code creates a `user_behavior_profiles` row on signup. The row is only created by the `recalculate_user_profile` analytics function, which runs on a schedule.

**Consequence:** New users have no `user_behavior_profiles` row for an indeterminate period. Any query that assumes this row exists will return null or fail.

The schema shows: `user_behavior_profiles_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id)` — so it's nullable by omission. Features that read it must handle the null case.

---

### Issue D: Three inconsistent role systems

| System | Location | Writable by | Used by |
|--------|----------|-------------|---------|
| `user_metadata.role` | `auth.users` | Any authenticated user via `updateUser()` | `callback/route.ts`, `proxy.ts` (WRONG — see main findings) |
| `app_metadata.role` | `auth.users` | Service role only | `supabase-server.ts:verifyAdminRequest` |
| `roles[]` array | `public.users` | Service role via `add_user_role()` DB function | `is_admin()` DB function |

None of these are synchronized. A user could be admin in one system and not in another.

The `is_admin()` DB function (used in RLS policies) checks `public.users.roles[]`, but the application layer checks `app_metadata.role` (or incorrectly `user_metadata.role`). These can diverge.

**Fix:** Pick one authoritative role source. `app_metadata.role` is the most secure (service-role-only, lives in JWT). The DB `is_admin()` function and `roles[]` array should either be removed or kept in sync with `app_metadata` via a trigger or migration.

---

### Issue E: OAuth signup creates auth.users row but no public.users or user_preferences row (same as email)

When a user signs up via Google OAuth (first time), Supabase creates the `auth.users` row. The same trigger (if attached) would fire. Same gap — if the trigger doesn't exist in a fresh environment, the profile row is never created.

Additionally, for OAuth users, `user_metadata` is populated by the provider (Google sets `full_name`, `avatar_url`, etc.). The `public.users` trigger function (if it exists) presumably copies these fields. If the trigger doesn't run, the `public.users` row is empty or missing.

---

## What the App Code Does After Signup (none of it creates DB rows)

Checked: `AuthContext.tsx`, `authStore.ts`, `callback/route.ts`

None of these files insert into `public.users`, `user_preferences`, or `user_behavior_profiles` after a successful signup. The entire user profile setup is deferred to database triggers. If those triggers don't fire, the app never recovers.

The mobile app reads `user_preferences` in onboarding and recommendation flows — it would silently get null back and may crash or show wrong defaults.
