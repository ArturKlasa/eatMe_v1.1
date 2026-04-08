# Rough Idea: Fix Eat Together Feature

The "Eat Together" feature in the eatMe app is not working properly. We need to investigate and fix it.

## Initial Investigation Summary

The feature is approximately 60% functional. Session/member management, the recommendation algorithm, realtime infrastructure, and voting mechanics all work. However, critical issues prevent the feature from being usable end-to-end:

### Critical Issues Found

1. **RLS Policy Blocks Non-Host Members** - Migration `019_fix_eat_together_rls_recursion.sql` removed member-based access from `eat_together_sessions` SELECT policy, leaving only `USING (auth.uid() = host_id)`. Non-host members cannot view or fetch session data at all.

2. **Missing RPC Functions** - `generate_session_code()` and `get_vote_results()` are called by the service layer but are not defined in any migration.

3. **No Edge Function Invocation** - `SessionLobbyScreen` calls `getRecommendations(sessionId)` to fetch existing recommendations from the DB, but never actually triggers the `group-recommendations` edge function to generate them.

### Secondary Issues

- RLS on `eat_together_members`, `eat_together_votes`, and `eat_together_recommendations` uses `USING(true)`, leaking cross-session data
- No session expiry enforcement in the UI
- QR code scanning shows "Coming Soon"
- Missing null checks before navigation
- Type safety issues with `as any` casts
