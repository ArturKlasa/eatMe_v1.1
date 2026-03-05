# MOB-08 — Eat Together (Group Session)

## Overview

"Eat Together" is a social feature that allows a group of friends to collectively decide where to eat. One user creates a session, others join via a code or QR/link, and the group votes on restaurant recommendations that satisfy everyone's dietary preferences and proximity.

---

## Key Files

| File                                                            | Role                                                  |
| --------------------------------------------------------------- | ----------------------------------------------------- |
| `apps/mobile/src/screens/EatTogetherScreen.tsx`                 | Entry screen — choose to create or join               |
| `apps/mobile/src/screens/eatTogether/CreateSessionScreen.tsx`   | Host creates a session, gets QR code and share link   |
| `apps/mobile/src/screens/eatTogether/JoinSessionScreen.tsx`     | Guest enters a code to join an existing session       |
| `apps/mobile/src/screens/eatTogether/SessionLobbyScreen.tsx`    | Waiting room — shows who has joined, start when ready |
| `apps/mobile/src/screens/eatTogether/RecommendationsScreen.tsx` | Shows ranked restaurant recommendations for the group |
| `apps/mobile/src/screens/eatTogether/VotingResultsScreen.tsx`   | Shows voting outcome and final restaurant decision    |
| `apps/mobile/src/services/eatTogetherService.ts`                | All Supabase operations for session management        |

---

## Database Tables

| Table                          | Purpose                                            |
| ------------------------------ | -------------------------------------------------- |
| `eat_together_sessions`        | Session record (host, code, status, location mode) |
| `eat_together_members`         | Users who joined the session                       |
| `eat_together_recommendations` | Restaurant suggestions computed for the group      |
| `eat_together_votes`           | Each member's vote per restaurant                  |

Session status lifecycle: `waiting → recommending → voting → decided → cancelled / expired`

---

## Flow — Creating a Session (Host)

```
Host taps "Eat Together" from FloatingMenu
  → EatTogetherScreen shown
  → Host taps "Create Session"
    → CreateSessionScreen
    → Host selects location mode:
        - host_location: use host's GPS position
        - midpoint: average location of all members
        - max_radius: include all locations within maximum radius
    → Host taps "Create Session"
      → eatTogetherService.createSession(userId, locationMode)
        → supabase.rpc('generate_session_code') → e.g., 'PIZZA7'
        → INSERT INTO eat_together_sessions (host_id, code, location_mode, status='waiting')
        → Returns session object
      → Host location registered: updateMemberLocation(sessionId, userId, { lat, lng })
      → Share link generated: eatme://eat-together/join/{session_code}
      → QR code rendered (react-native-qrcode-svg)
      → navigation.navigate('SessionLobby', { sessionId })
```

---

## Flow — Joining a Session (Guest)

```
Guest taps "Eat Together" → taps "Join Session"
  → JoinSessionScreen
  → Guest enters 6-character session code (e.g. 'PIZZA7')
    OR scans QR code from host's screen
    OR taps shared deep link (eatme://eat-together/join/PIZZA7)
  → eatTogetherService.joinSession(code, userId, guestLocation)
    → SELECT from eat_together_sessions WHERE session_code = code
    → INSERT INTO eat_together_members (session_id, user_id, is_host=false)
    → updateMemberLocation(sessionId, userId, guestLocation)
  → navigation.navigate('SessionLobby', { sessionId })
```

---

## Flow — Session Lobby

```
SessionLobbyScreen mounts
  → Supabase Realtime subscription on eat_together_members WHERE session_id = X
    → Live updates as new members join
  → Shows list of all current members
  → Only host sees "Start" button

Host taps "Start"
  → eatTogetherService.startRecommendations(sessionId)
    → UPDATE eat_together_sessions SET status = 'recommending'
    → Server (Edge Function or Postgres function) computes recommendations:
        - Fetch all member preferences (diet, allergies) from user_preferences
        - Find restaurants within max radius of location midpoint
        - Score each restaurant by: compatibility score, distance, rating
        → INSERT INTO eat_together_recommendations (session_id, restaurant_id, compatibility_score, ...)
    → UPDATE eat_together_sessions SET status = 'voting'
  → All members' Realtime subscriptions fire → navigate to RecommendationsScreen
```

---

## Flow — Recommendations & Voting

```
RecommendationsScreen mounts
  → Fetches eat_together_recommendations WHERE session_id = X
    → Joined with restaurants table for full restaurant data
  → Shows ranked list of restaurants with:
      - Name, cuisine, rating
      - Compatibility score (what % of members are satisfied)
      - Distance from group centre
  → Each member taps a restaurant to vote for it
    → eatTogetherService.submitVote(sessionId, userId, restaurantId)
      → INSERT INTO eat_together_votes
  → Realtime subscription shows vote counts live
  → Host sees "Finalise Decision" button when ready
    → eatTogetherService.finaliseSession(sessionId, restaurantId)
      → UPDATE eat_together_sessions SET status = 'decided', selected_restaurant_id = restaurantId
```

---

## Flow — Results

```
VotingResultsScreen
  → Shows winning restaurant
  → "Get Directions" button → opens Maps app
  → "View Menu" button → navigate to RestaurantDetailScreen
  → Session record kept in DB for history
```

---

## Session Expiry

Sessions have an `expires_at` timestamp (set to a few hours after creation). A Supabase scheduled function or trigger marks sessions as `expired` when the time passes. Expired sessions cannot be joined.

---

## Location Modes Explained

| Mode            | How location is calculated                                           |
| --------------- | -------------------------------------------------------------------- |
| `host_location` | Only the host's GPS is used as the search centre                     |
| `midpoint`      | Arithmetic mean of all members' GPS coordinates                      |
| `max_radius`    | Finds the smallest circle that contains all members, uses its centre |

---

## Known Gaps

- Supabase Realtime subscriptions provide live member list updates in the lobby, but the full real-time synchronisation across all screens (status transitions) relies on manual navigation in some paths.
- The recommendation computation (Edge Function or Postgres RPC) — the exact implementation should be verified in `infra/supabase/functions/`.
- No notification when a new member joins while the host's phone is locked.
