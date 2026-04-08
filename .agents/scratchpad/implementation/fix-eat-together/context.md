# Fix Eat Together — Implementation Context

## Source Type
PDD directory: `.agents/planning/2026-04-07-fix-eat-together/`

## Original Request Summary
Fix the "Eat Together" group dining feature end-to-end. Three critical bugs (broken RLS, missing RPCs, no edge function invocation) plus secondary issues (data leakage, no session expiry, type safety gaps) and UX polish (error messages, loading states, realtime cleanup).

## Repo Patterns
- **Monorepo**: pnpm + Turborepo (`apps/mobile`, `apps/web-portal`, `packages/database`)
- **Mobile**: React Native + Expo, Zustand stores, `useTranslation()` for i18n
- **Backend**: Supabase (PostgreSQL + PostGIS + pgvector), Edge Functions, Upstash Redis
- **Migrations**: Sequential numbered SQL files in `infra/supabase/migrations/`
- **Service layer**: Class-based services in `apps/mobile/src/services/` using Supabase client
- **Navigation**: React Navigation with typed `MainStackParamList` in `apps/mobile/src/types/navigation.ts`
- **Realtime**: Supabase channels with `.on('postgres_changes', ...)` pattern

## Key Files to Modify
1. `infra/supabase/migrations/075_fix_eat_together.sql` (NEW)
2. `apps/mobile/src/services/eatTogetherService.ts`
3. `apps/mobile/src/types/navigation.ts`
4. `apps/mobile/src/screens/eatTogether/SessionLobbyScreen.tsx`
5. `apps/mobile/src/screens/eatTogether/RecommendationsScreen.tsx`
6. `apps/mobile/src/screens/eatTogether/VotingResultsScreen.tsx`
7. `apps/mobile/src/screens/eatTogether/CreateSessionScreen.tsx`
8. `apps/mobile/src/screens/eatTogether/JoinSessionScreen.tsx`

## Key Files to Reference (DO NOT MODIFY)
- `infra/supabase/migrations/database_schema.sql` — Full schema
- `infra/supabase/migrations/073_universal_dish_structure.sql` — `get_group_candidates()` RPC
- `infra/supabase/functions/group-recommendations/index.ts` — Edge function

## Acceptance Criteria
See PROMPT.md Progress Log (18 items) and Success Criteria (20 items).

## Constraints
- Single migration file: `075_fix_eat_together.sql`
- DO NOT modify the edge function or `get_group_candidates()` RPC
- No new npm dependencies
- Security definer in private schema with `SET search_path = ''`
- Wrap `(SELECT private.is_eat_together_participant(...))` in RLS for initPlan caching
- DROP existing policies before recreating (migrations 018/019 deployed but removed from dir)
- Edge function already transitions to 'voting' — don't call updateSessionStatus('voting') from frontend
- QR scanning deferred — leave "Coming Soon" placeholder
- Update PROMPT.md progress checkboxes after each item
