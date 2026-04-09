# Implement Security & Bug Fixes from Code Review

## Objective

Implement the 3 confirmed findings from `.agents/review/report.md`: one critical RLS security fix (new migration), one high-severity error-handling fix, and one medium-severity injection fix. Each fix must be minimal and targeted — do not refactor surrounding code.

## Context

EatMe is a food discovery platform (pnpm + Turborepo monorepo):
- **`apps/mobile`** — React Native + Expo (SDK 54), Zustand stores, Supabase client
- **`apps/web-portal`** — Next.js, restaurant owner onboarding and admin dashboard
- **Backend** — Supabase (PostgreSQL + PostGIS), Edge Functions (Deno/TypeScript)

Findings are in `.agents/review/report.md`. Read the full report before starting.

## Fixes Required

### Fix 1 — F-001 (Critical): Stale permissive RLS policies

**File to create:** `infra/supabase/migrations/078_fix_stale_rls_policies.sql`

Migration `008a` tried to drop policies from `005` but used wrong names, so the permissive `005` policies are still active and OR-merge with the stricter `008a`/`067` policies — letting owners delete restaurants/menus/dishes they should not be able to delete.

Drop the stale policies by their **correct names** (from migration `005`):

```sql
-- restaurants
DROP POLICY IF EXISTS "Anyone can read restaurants" ON restaurants;
DROP POLICY IF EXISTS "Users can create restaurants" ON restaurants;
DROP POLICY IF EXISTS "Users can update own restaurants" ON restaurants;
DROP POLICY IF EXISTS "Users can delete own restaurants" ON restaurants;
-- menus
DROP POLICY IF EXISTS "Anyone can read menus" ON menus;
DROP POLICY IF EXISTS "Users can create menus for own restaurants" ON menus;
DROP POLICY IF EXISTS "Users can update own restaurant menus" ON menus;
DROP POLICY IF EXISTS "Users can delete own restaurant menus" ON menus;
-- dishes
DROP POLICY IF EXISTS "Anyone can read dishes" ON dishes;
DROP POLICY IF EXISTS "Users can create dishes for own restaurants" ON dishes;
DROP POLICY IF EXISTS "Users can update own restaurant dishes" ON dishes;
DROP POLICY IF EXISTS "Users can delete own restaurant dishes" ON dishes;
```

After dropping, re-create the three public read policies with clear names so consumer-facing reads continue to work:

```sql
CREATE POLICY "Public read restaurants" ON restaurants FOR SELECT USING (true);
CREATE POLICY "Public read menus" ON menus FOR SELECT USING (true);
CREATE POLICY "Public read dishes" ON dishes FOR SELECT USING (true);
```

---

### Fix 2 — F-008 (High): Unchecked errors on destructive DB operations

**File:** `apps/web-portal/lib/restaurantService.ts`

Two delete-then-insert patterns silently ignore delete failures, risking duplicate rows:

1. **Line ~362** inside `saveMenus()` — `menus.delete()` result is ignored.
2. **Line ~602** inside `saveOptionGroupsForDish()` — `option_groups.delete()` result is ignored.

For each, destructure the error and throw if present:

```typescript
const { error: deleteError } = await supabase.from('menus').delete().eq('restaurant_id', restaurantId);
if (deleteError) throw new Error(`Failed to clear menus: ${deleteError.message}`);
```

Apply the same pattern to the option groups delete. Do not change anything else in these functions.

---

### Fix 3 — F-009 (Medium): ilike pattern injection in searchUsersByProfileName

**File:** `apps/mobile/src/services/eatTogetherService.ts` line ~505

User-controlled `searchQuery` is interpolated directly into an ilike pattern. A bare `%` returns all profiles; pathological patterns cause expensive sequential scans.

Escape `%`, `_`, and `\` before interpolation — the same pattern already used in `apps/web-portal/app/api/menu-scan/route.ts`:

```typescript
const escaped = searchQuery.replace(/[%_\\]/g, c => `\\${c}`);
// then:
.ilike('profile_name', `%${escaped}%`)
```

---

## Constraints

- Do NOT modify any files not mentioned above
- Do NOT refactor, rename, or reformat surrounding code
- Do NOT add new dependencies
- Run `pnpm tsc --noEmit` from the repo root after the TypeScript changes to confirm no type errors

## Success Criteria

- [ ] Fix 1: `078_fix_stale_rls_policies.sql` exists; drops all 12 stale `005` policies; re-creates 3 public read policies
- [ ] Fix 2: Both `.delete()` calls in `restaurantService.ts` are followed by an error check that throws on failure
- [ ] Fix 3: `searchUsersByProfileName` escapes `%`, `_`, `\` before the ilike call; no other changes to the function

## Progress Log

- [ ] Fix 1: F-001 — Stale RLS policies migration
- [ ] Fix 2: F-008 — Error handling on destructive DB operations
- [ ] Fix 3: F-009 — ilike pattern injection escape

---
The orchestrator will continue iterations until limits are reached.
