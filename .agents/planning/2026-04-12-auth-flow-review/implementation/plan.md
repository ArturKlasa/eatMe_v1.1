# Auth Flow Fixes — Implementation Plan (v2)

> Revised 2026-04-12: Facebook OAuth deferred; database trigger gaps and new-user creation flow added.

## Checklist

- [x] Step 1: Activate Next.js middleware (rename proxy.ts → middleware.ts)
- [x] Step 2: Secure admin role checks (user_metadata → app_metadata)
- [x] Step 3: Add missing CREATE TRIGGER bindings to migrations
- [x] Step 4: Add public.users + user_behavior_profiles auto-creation on signup
- [x] Step 5: Honour post-login ?redirect param in login page
- [x] Step 6: Simplify AuthContext to single onAuthStateChange listener
- [x] Step 7: Surface needsEmailVerification from web signUp
- [x] Step 8: Add AdminRoute client-side role guard
- [x] Step 9: Add emailRedirectTo deep link to mobile signUp
- [x] Step 10: Fix lastSaved type cast in storage.ts
- [x] Step 11: Update auth-flow.md to match fixed code

---

## Step 1: Activate Next.js middleware (rename proxy.ts → middleware.ts)

**Objective:** Make the edge route protection and session refresh actually run by giving the middleware file the name Next.js requires.

**Implementation guidance:**
- Rename `apps/web-portal/proxy.ts` → `apps/web-portal/middleware.ts`
- Rename the exported function: `export async function proxy` → `export async function middleware`
- The `export const config` stays unchanged
- No logic changes — file content is otherwise identical

**Test requirements:**
- Start the dev server; confirm Next.js logs show the middleware matcher is active (it prints the matcher pattern on startup)
- Navigate to `/auth/login` while logged in → should redirect to `/`
- Navigate to `/admin` while logged out → should redirect to `/auth/login?error=unauthorized&redirect=/admin`
- Navigate to `/admin` as a non-admin logged-in user → should redirect to `/?error=admin_only`
- Confirm session cookie refresh: manually expire the access token cookie, make a request → still authenticated

**Integration:** Foundational — all subsequent steps that rely on middleware behaviour depend on this.

**Demo:** Open an incognito tab. Navigate to `/admin`. You are redirected to login instead of seeing the page.

---

## Step 2: Secure admin role checks (user_metadata → app_metadata)

**Objective:** Close the privilege escalation vulnerability where any user can self-promote to admin via `supabase.auth.updateUser()`.

**Implementation guidance:**

`apps/web-portal/app/auth/callback/route.ts:32`:
```ts
// BEFORE
const role = data.session.user.user_metadata?.role;

// AFTER
const role = data.session.user.app_metadata?.role;
```

`apps/web-portal/middleware.ts:80` (after Step 1 rename):
```ts
// BEFORE
if (user.user_metadata?.role !== 'admin') {

// AFTER
if (user.app_metadata?.role !== 'admin') {
```

`supabase-server.ts:verifyAdminRequest` already uses `app_metadata` — no change needed there.

**Important prerequisite:** Existing admin users must have `app_metadata.role = 'admin'` set via the Supabase dashboard (Auth → Users → Edit → app_metadata) or a one-time service-role script. Deploying this without updating admin users will lock them out.

**Test requirements:**
- In browser console as a non-admin: `await supabase.auth.updateUser({ data: { role: 'admin' } })`. Then navigate to `/admin` → should still be blocked.
- Log in as a user with `app_metadata.role = 'admin'` (set via dashboard) → callback should redirect to `/admin`, proxy should allow access.
- Run `npx vitest run` to check for regressions.

**Integration:** Builds on Step 1 (middleware must be running for the proxy check to fire).

**Demo:** Browser console → `updateUser({ data: { role: 'admin' } })` → navigate to `/admin` → blocked. Privilege escalation closed.

---

## Step 3: Add missing CREATE TRIGGER bindings to migration

**Objective:** Ensure the `create_user_preferences_on_signup()` function actually fires on new user creation in all environments (not just the live Supabase project where the trigger was set up manually).

**Implementation guidance:**

Create a new migration file `infra/supabase/migrations/082_wire_signup_triggers.sql`:

```sql
-- Migration 082: Wire signup trigger for user_preferences
-- The function create_user_preferences_on_signup() was defined in 081 but
-- never bound to a trigger in migrations (it was set up via the dashboard).
-- This migration makes the binding explicit and reproducible.

-- Drop and recreate to ensure correct function is bound
DROP TRIGGER IF EXISTS on_auth_user_created_preferences ON auth.users;

CREATE TRIGGER on_auth_user_created_preferences
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION create_user_preferences_on_signup();
```

Verify in the Supabase dashboard (Database → Triggers) that no duplicate trigger exists before applying.

**Test requirements:**
- In a fresh environment (or via Supabase local dev `supabase db reset`): run all migrations, sign up a new user → confirm `user_preferences` row exists for the new user
- Sign up via email/password → check `user_preferences` row
- Sign up via Google OAuth (first login) → check `user_preferences` row
- Confirm trigger fires even when `user_preferences` table is empty (i.e., no conflicts)

**Integration:** Standalone DB migration. No application code changes.

**Demo:** Create a fresh Supabase environment, run migrations, sign up. The `user_preferences` row is auto-created. Previously this would only work in environments where the trigger was manually set up.

---

## Step 4: Add public.users and user_behavior_profiles auto-creation on signup

**Objective:** Ensure every new user gets a `public.users` profile row and a `user_behavior_profiles` row created at signup. Currently neither is created reliably.

**Implementation guidance:**

Create `infra/supabase/migrations/083_signup_user_profile_trigger.sql`:

```sql
-- Migration 083: Auto-create public.users and user_behavior_profiles on signup

-- ── public.users trigger function ──────────────────────────────────────────
CREATE OR REPLACE FUNCTION create_user_profile_on_signup()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.users (id, email, full_name, avatar_url)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.raw_user_meta_data->>'name'),
    NEW.raw_user_meta_data->>'avatar_url'
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
EXCEPTION
  WHEN OTHERS THEN
    RAISE WARNING 'create_user_profile_on_signup error: %', SQLERRM;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created_profile ON auth.users;
CREATE TRIGGER on_auth_user_created_profile
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION create_user_profile_on_signup();

-- ── user_behavior_profiles trigger function ─────────────────────────────────
CREATE OR REPLACE FUNCTION create_behavior_profile_on_signup()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.user_behavior_profiles (user_id)
  VALUES (NEW.id)
  ON CONFLICT (user_id) DO NOTHING;
  RETURN NEW;
EXCEPTION
  WHEN OTHERS THEN
    RAISE WARNING 'create_behavior_profile_on_signup error: %', SQLERRM;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created_behavior ON auth.users;
CREATE TRIGGER on_auth_user_created_behavior
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION create_behavior_profile_on_signup();

-- ── Backfill for existing users missing their rows ──────────────────────────
INSERT INTO public.users (id, email)
SELECT id, email FROM auth.users
WHERE id NOT IN (SELECT id FROM public.users)
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.user_behavior_profiles (user_id)
SELECT id FROM auth.users
WHERE id NOT IN (SELECT user_id FROM public.user_behavior_profiles)
ON CONFLICT (user_id) DO NOTHING;
```

**Integration:** Depends on Step 3 (migration 082 should be applied first). Backfill queries handle existing users.

---

## Step 5: Honour the post-login ?redirect param

**Objective:** After login, send users to the page they originally tried to visit, not always `/`.

**Integration:** Requires Step 1 (middleware must be running to set the `?redirect` param for protected routes).

---

## Step 6: Simplify AuthContext to single onAuthStateChange listener

**Objective:** Eliminate the redundant `getSession()` call that causes double renders and makes `clearIfStale` miss fresh logins.

**Integration:** Standalone. No dependencies on other steps.

---

## Step 7: Surface needsEmailVerification from web signUp

**Objective:** Let the signup page correctly distinguish auto-login from "check your email" after signup.

**Integration:** Standalone.

---

## Step 8: Add AdminRoute client-side role guard

**Objective:** Ensure `/admin` pages are blocked client-side by role (not just authentication), using `app_metadata` consistently.

**Integration:** Requires Step 2 to confirm `app_metadata` is the correct field.

---

## Step 9: Add emailRedirectTo deep link to mobile signUp

**Objective:** Email verification links from mobile signups open the app via deep link, not the web portal.

**Integration:** Standalone. No code dependencies.

---

## Step 10: Fix lastSaved type cast in storage.ts

**Objective:** Remove the unsafe type assertion that pretends `FormProgress` has a `lastSaved` field.

**Integration:** Standalone.

---

## Step 11: Update auth-flow.md to match fixed code

**Objective:** Keep documentation accurate after all fixes are applied.

**Integration:** Final step.
