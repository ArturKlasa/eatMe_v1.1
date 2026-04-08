# Plan — Fix Eat Together

1. **Step 1 — Migration 075: Database layer**
   - Demo: All SQL objects exist — private schema, security definer function, scoped RLS policies on 4 tables, generate_session_code() RPC, get_vote_results() RPC, pg_cron expiry job
   - Wave:
     - Write complete migration file `075_fix_eat_together.sql` with all DB changes
   - Note: Single task because all SQL objects are interdependent (RLS depends on security definer, RPCs depend on schema)

2. **Step 2 — Service layer + navigation types**
   - Demo: Service has `invokeGroupRecommendations()`, `updateSessionStatus()`, `finalizeSelection()`. Navigation types include `isHost` param.
   - Wave:
     - Add 3 new service functions to eatTogetherService.ts
     - Add `isHost: boolean` to SessionLobby params in navigation.ts

3. **Step 3 — Frontend screen fixes (Create/Join/Lobby)**
   - Demo: CreateSession passes isHost:true with error handling, JoinSession passes isHost:false with i18n, SessionLobby wires edge function + expiry timer + realtime cleanup
   - Wave:
     - Fix CreateSessionScreen (non-null assertion, error handling, isHost)
     - Fix JoinSessionScreen (isHost, i18n)
     - Fix SessionLobbyScreen (edge function wiring, expiry countdown, realtime cleanup, error messages, loading states)

4. **Step 4 — Frontend screen fixes (Recommendations/VotingResults)**
   - Demo: RecommendationsScreen has type safety + realtime cleanup + navigation validation. VotingResultsScreen has openMaps fix + null checks + loading state.
   - Wave:
     - Fix RecommendationsScreen
     - Fix VotingResultsScreen

5. **Step 5 — Final verification + progress log update**
   - Demo: All PROMPT.md checkboxes checked, backwards compatibility verified
   - Wave:
     - Update PROMPT.md progress log
     - Verify no regressions in existing flows
