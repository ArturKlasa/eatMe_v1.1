# EatMe Monorepo — Code Review Report

**Date:** 2026-04-08  
**Last verified:** 2026-04-08 (post-migration-075 relevance check)  
**Scope:** Actionable findings only — confirmed open against current codebase

---

## Summary

| Severity | Finding | Area                                       |
| -------- | ------- | ------------------------------------------ |
| Critical | F-001   | Database security (RLS)                    |
| High     | F-008   | Error handling — destructive DB operations |
| Medium   | F-009   | Security — ilike pattern injection         |

---

## Critical

### F-001 — Stale permissive RLS policies bypass admin-only DELETE restrictions

**Affected tables (live DB):** `restaurants`, `menus`, `dishes`

**Problem:** Migration `008a` attempted to drop the original permissive policies from migration `005` before creating stricter admin+owner replacements. The `DROP POLICY IF EXISTS` statements in `008a` targeted **wrong policy names** — the ones from `005` were never dropped:

| `008a` drops (wrong name)                | `005` actually created               |
| ---------------------------------------- | ------------------------------------ |
| `"Users can only view own restaurant"`   | `"Anyone can read restaurants"`      |
| `"Users can only update own restaurant"` | `"Users can update own restaurants"` |
| `"Users can only delete own restaurant"` | `"Users can delete own restaurants"` |

Because the `005` policies are never dropped, PostgreSQL's OR-semantics across permissive policies means the most permissive policy always wins:

- **restaurants**: Owners can delete their own restaurant despite `"Only admins can delete restaurants"` from `008a`
- **menus**: Owners can delete their own menus despite `"Only admins can delete menus"` from `008a`
- **dishes**: Owners can delete their own dishes despite `"Only admins can delete dishes"` from `067`

**Fix:** New migration dropping the `005` policies by their correct names:

```sql
DROP POLICY IF EXISTS "Anyone can read restaurants" ON restaurants;
DROP POLICY IF EXISTS "Users can create restaurants" ON restaurants;
DROP POLICY IF EXISTS "Users can update own restaurants" ON restaurants;
DROP POLICY IF EXISTS "Users can delete own restaurants" ON restaurants;
DROP POLICY IF EXISTS "Anyone can read menus" ON menus;
DROP POLICY IF EXISTS "Users can create menus for own restaurants" ON menus;
DROP POLICY IF EXISTS "Users can update own restaurant menus" ON menus;
DROP POLICY IF EXISTS "Users can delete own restaurant menus" ON menus;
DROP POLICY IF EXISTS "Anyone can read dishes" ON dishes;
DROP POLICY IF EXISTS "Users can create dishes for own restaurants" ON dishes;
DROP POLICY IF EXISTS "Users can update own restaurant dishes" ON dishes;
DROP POLICY IF EXISTS "Users can delete own restaurant dishes" ON dishes;
```

Re-create public read policies with clear naming if consumer-facing reads are needed.

---

## High

### F-008 — Unchecked Supabase errors on destructive operations risk silent data corruption

**Affected files:**

- `apps/web-portal/lib/restaurantService.ts:362` (`saveMenus`)
- `apps/web-portal/lib/restaurantService.ts:602` (`saveOptionGroupsForDish`)

**Problem:**

1. `saveMenus()` line 362: `menus.delete()` result ignored — if delete fails, the subsequent insert creates duplicate menus with no recovery path
2. `saveOptionGroupsForDish()` line 602: `option_groups.delete()` result ignored — if delete fails, the loop creates duplicate option groups per dish

Both are delete-then-insert patterns on the critical restaurant onboarding path.

**Fix:** Destructure and throw on error from each `.delete()` call:

```typescript
const { error: deleteError } = await supabase
  .from('menus')
  .delete()
  .eq('restaurant_id', restaurantId);
if (deleteError) throw new Error(`Failed to clear menus: ${deleteError.message}`);
```

---

## Medium

### F-009 — `searchUsersByProfileName` allows ilike pattern injection

**Affected file:** `apps/mobile/src/services/eatTogetherService.ts:505`

**Problem:**

```typescript
.ilike('profile_name', `%${searchQuery}%`)
```

User-controlled `searchQuery` is interpolated directly. A search for `%` returns all profiles. Pathological patterns like `%_%_%_%_%` cause expensive sequential scans.

**Fix:** Escape `%`, `_`, and `\` before interpolation (same pattern already used in `apps/web-portal/app/api/menu-scan/route.ts:217`):

```typescript
const escaped = searchQuery.replace(/[%_\\]/g, c => `\\${c}`);
.ilike('profile_name', `%${escaped}%`)
```
