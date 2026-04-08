# Research: Frontend Analysis

## Service Layer (eatTogetherService.ts)

### DB/RPC Calls Made
- `supabase.rpc('generate_session_code')` — **MISSING RPC** (line 79)
- `supabase.rpc('get_vote_results', { p_session_id })` — **MISSING RPC** (line 370)
- CRUD on: `eat_together_sessions`, `eat_together_members`, `eat_together_recommendations`, `eat_together_votes`
- `users` table: SELECT for profile search (line 444)

### Missing Service Functions
- No `invokeGroupRecommendations()` — edge function never called
- No `updateSessionStatus()` — session state transitions not wired
- No `finalizeSelection()` — host selecting winner not implemented

---

## Screen-by-Screen Issues

### SessionLobbyScreen (MOST CRITICAL)
| Line | Issue | Severity |
|------|-------|----------|
| 38 | `isHost` destructured from route.params but not in navigation type | Critical |
| 46 | `locationMode` is local state only, never synced to DB | High |
| 132 | `getRecommendations()` reads DB, never invokes edge function | Critical |
| 83-119 | Realtime subscription cleanup not called on unmount | High |
| 108-110 | Navigates to Recommendations without verifying they exist | Medium |
| 126 | Alert for < 2 members — only validation before generate | Low |

### CreateSessionScreen
| Line | Issue | Severity |
|------|-------|----------|
| 51 | Non-null assertion `user!` | Medium |
| 46 | `updateMemberLocation()` error not handled | Medium |
| 72 | Deep link format hardcoded | Low |
| 76 | Navigates to SessionLobby without passing `isHost: true` | Critical |

### JoinSessionScreen
| Line | Issue | Severity |
|------|-------|----------|
| 32-35 | Session code validation hardcoded (6 chars, alphanumeric) | Low |
| 110 | "QR Scanner Coming Soon" hardcoded, not i18n | Low |
| 52 | Navigates to SessionLobby without passing `isHost: false` | Critical |

### RecommendationsScreen
| Line | Issue | Severity |
|------|-------|----------|
| 84 | `v.user_id as string` unsafe cast | Medium |
| 120-122 | Navigates to VotingResults on 'decided' without checking selected_restaurant_id | Medium |
| 95-131 | Realtime subscription cleanup not called | High |
| 59-68 | Error logged but no user feedback | Medium |

### VotingResultsScreen
| Line | Issue | Severity |
|------|-------|----------|
| 62-74 | `openMaps()` accesses `restaurant.location` but type doesn't include location | High |
| 87 | Doesn't check if `selected_restaurant_id` exists | Medium |

---

## Navigation Flow Issues

```
EatTogetherScreen
├── CreateSession → SessionLobby (missing isHost param)
├── JoinSession → SessionLobby (missing isHost param)
└── SessionLobby
    ├── [Host] Generate → Recommendations (edge fn not called)
    │   └── Vote → VotingResults (no status transition)
    └── Leave/Close → back
```

**Missing navigation type:** `isHost` not defined in `MainStackParamList` for SessionLobby route.

---

## Realtime Subscription Pattern
- Two channels: sessions changes + members changes
- Members subscription refetches all members on any change
- Session subscription updates state with `payload.new`
- **Problem**: No unsubscribe cleanup in useEffect return
- **Problem**: No error handling if channel fails

---

## Missing Error Messages
- Session expired
- Host disconnected
- Recommendation generation failed (specific: no restaurants, conflict)
- Vote submission failed
- Location permission denied
- Session not found (invalid code)

---

## Summary of All Changes Needed

### Critical (feature-breaking)
1. Wire edge function invocation in SessionLobbyScreen
2. Add `isHost` to navigation params type and pass it correctly
3. Add session status transition calls

### High (data leakage / reliability)
4. Fix realtime subscription cleanup on all screens
5. Fix VotingResultsScreen restaurant location type
6. Sync locationMode to DB when host changes it

### Medium (UX / safety)
7. Add loading states for async operations
8. Add specific error messages
9. Fix type safety issues (unsafe casts, non-null assertions)
10. Add null checks before navigation

### Low (polish)
11. i18n for hardcoded strings
12. Extract session code constants
13. Extract deep link format
