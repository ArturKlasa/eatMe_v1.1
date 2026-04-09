# Context: Security & Bug Fixes

## Source
Rough description → 3 targeted fixes from `.agents/review/report.md`

## Repo
- pnpm + Turborepo monorepo
- `apps/mobile` — React Native + Expo (SDK 54)
- `apps/web-portal` — Next.js
- `infra/supabase/migrations/` — sequential SQL migrations (latest: 077)

## Fixes

### F-001 (Critical) — Stale RLS policies
- File to CREATE: `infra/supabase/migrations/078_fix_stale_rls_policies.sql`
- Drop 12 stale policies from migration 005 (wrong names used in 008a attempt)
- Re-create 3 public read policies

### F-008 (High) — Unchecked delete errors
- File: `apps/web-portal/lib/restaurantService.ts`
- Line ~362: `saveMenus()` — `supabase.from('menus').delete()` result ignored
- Line ~602: `saveOptionGroupsForDish()` — `supabase.from('option_groups').delete()` result ignored
- Fix: destructure error, throw if present

### F-009 (Medium) — ilike injection
- File: `apps/mobile/src/services/eatTogetherService.ts` line ~505
- `searchUsersByProfileName` interpolates raw `searchQuery` into ilike
- Fix: escape `%`, `_`, `\` before interpolation

## Constraints
- No new dependencies
- No refactoring beyond the exact lines
- Run `pnpm tsc --noEmit` after TS changes
