# Progress — Fix Eat Together

## Current Step
Step 2 — Service layer + navigation types

## Active Wave
- `task-1775544584-4fef` (`code-assist:fix-eat-together:step-02:service-layer`) — Add invokeGroupRecommendations(), updateSessionStatus(), finalizeSelection() to eatTogetherService.ts [OPEN — prior builder started but did not complete; reopened for fresh builder]

### Closed in this wave
- `task-1775544587-3150` (`code-assist:fix-eat-together:step-02:navigation-types`) — CLOSED + review PASSED (2026-04-07): isHost: boolean added to SessionLobby params, CreateSessionScreen passes isHost:true, JoinSessionScreen passes isHost:false

## Verification Notes
- Migration file written: infra/supabase/migrations/075_fix_eat_together.sql
- Contains all 6 required components:
  1. `CREATE SCHEMA IF NOT EXISTS private`
  2. `private.is_eat_together_participant()` — SECURITY DEFINER, SET search_path = '', (SELECT auth.uid()) for caching
  3. DROP + CREATE SELECT policy on `eat_together_sessions` (host OR participant)
  4. DROP + CREATE SELECT policy on `eat_together_members` (self OR participant)
  5. DROP + CREATE SELECT policy on `eat_together_recommendations` (participant only)
  6. DROP + CREATE SELECT policy on `eat_together_votes` (participant only)
  7. `generate_session_code()` — SECURITY DEFINER, collision-retry loop
  8. `get_vote_results()` — SECURITY DEFINER, participant guard, aggregated results
  9. `cron.schedule('expire-eat-together-sessions', '*/5 * * * *', ...)` — expires stale sessions
- Policy names dropped match migration 019 exactly (confirmed via git history)

## Completed Steps
- step-01: Migration 075 written (2026-04-07)
