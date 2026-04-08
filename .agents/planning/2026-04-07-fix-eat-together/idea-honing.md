# Idea Honing: Fix Eat Together Feature

Requirements clarification through Q&A.

---

## Q1: Scope — Which issues should we fix?

The investigation found 3 critical and several secondary issues. Should we:

- **A) Fix critical issues only** — RLS policies, missing RPCs, edge function wiring (minimum viable fix)
- **B) Fix critical + secondary issues** — also tighten leaky RLS on related tables, add session expiry handling, improve type safety
- **C) Full polish** — everything above plus UX improvements (QR scanning, loading states, error messages, null checks)

**Answer:** C — Full polish. Fix all critical issues, secondary issues, and UX improvements.

---

## Q2: RLS Policy Strategy

The original migration `019` removed the member-based subquery from `eat_together_sessions` SELECT policy to fix a recursion issue. To restore non-host member access, we have a few options:

- **A) Subquery with recursion guard** — Re-add the member check with a flag/config to prevent infinite recursion
- **B) Security definer function** — Create a `SECURITY DEFINER` helper function that checks membership without triggering RLS recursion
- **C) Session-scoped RLS on all tables** — Use `session_id IN (SELECT session_id FROM eat_together_members WHERE user_id = auth.uid())` consistently, with the members table itself using a simpler policy

Which approach do you prefer, or would you like me to research the tradeoffs first?

**Answer:** B — Security definer function. Create a `SECURITY DEFINER` helper (e.g. `is_eat_together_participant(session_id)`) that checks membership without triggering RLS recursion. All table policies will use this function consistently.

---

## Q3: Missing RPC Functions — `generate_session_code()` Behavior

The service calls `generate_session_code()` but it doesn't exist in any migration. How should session codes be generated?

- **A) Database RPC** — Create the function in PostgreSQL (generates a random 6-char alphanumeric code, checks uniqueness, retries on collision)
- **B) Client-side generation** — Generate the code in the service layer (TypeScript), then insert. Simpler but relies on the UNIQUE constraint to catch collisions.
- **C) Database default** — Add a DEFAULT expression on the `session_code` column that auto-generates on INSERT, so the client never needs to create one.

**Answer:** A — Database RPC. Create `generate_session_code()` in PostgreSQL with a retry loop for uniqueness. Matches the existing service call, keeps logic server-side, and is atomic.

---

## Q4: Edge Function Invocation — How should the UI trigger recommendations?

`SessionLobbyScreen` currently calls `getRecommendations()` which reads from the DB but never invokes the `group-recommendations` edge function. How should this be wired?

- **A) Host-triggered** — The host presses a "Get Recommendations" button, which calls the edge function. Other members see results via realtime subscription once recommendations are saved to DB.
- **B) Auto-triggered on status change** — When the session status transitions to `recommending`, a database trigger or the service layer automatically invokes the edge function.
- **C) Lobby screen auto-triggers** — The lobby screen detects all members are present and automatically calls the edge function (with a confirmation prompt to the host).

**Answer:** A — Host-triggered. The host presses a "Find Restaurants" button in the lobby, which updates session status to `recommending` and calls the edge function. Members see results via realtime subscription.

---

## Q5: Session Expiry Handling

Sessions have a 3-hour `expires_at` but the UI doesn't enforce or display it. How should we handle expiry?

- **A) UI timer + soft block** — Show a countdown timer in the lobby/voting screens. When expired, show an "expired" message and prevent further actions, but don't delete data.
- **B) Backend enforcement only** — Add a check in RPC functions and the edge function to reject actions on expired sessions. UI shows an error when an action fails due to expiry.
- **C) Both** — UI timer for visibility + backend enforcement for security. Expired sessions auto-transition to `expired` status.

**Answer:** C — Both. UI countdown timer for visibility + backend enforcement (expires_at checks in RLS/RPCs) for security. Expired sessions auto-transition to `expired` status via pg_cron or edge function check. Realtime broadcasts the status change so UI can react.

---

## Q6: QR Code Scanning

The QR display works but scanning shows "Coming Soon." Should we:

- **A) Implement scanning now** — Use `expo-camera` or `expo-barcode-scanner` to enable QR scanning as part of this fix.
- **B) Keep it deferred** — Leave the "Coming Soon" placeholder. QR display + manual code entry is sufficient for now.
- **C) Remove the scan button** — Hide the non-functional scan option to avoid confusing users, keep only manual code entry.

**Answer:** B — Keep it deferred. Leave the "Coming Soon" placeholder. Manual code entry is sufficient. QR scanning can be a follow-up effort.

---

## Q7: Testing Strategy

Given this is a fix for an existing feature, how should we approach testing?

- **A) Manual end-to-end testing only** — Test the full flow manually with multiple devices/users. No automated tests.
- **B) Unit tests for new functions + manual E2E** — Write tests for the new RPC functions (`generate_session_code`, `get_vote_results`, `is_eat_together_participant`) and the edge function invocation, plus manual E2E testing.
- **C) Full test coverage** — Unit tests for RPCs, integration tests for the RLS policies (using Supabase test helpers), service layer tests, and manual E2E.

**Answer:** B — Unit tests for new RPC functions + manual E2E. Automated tests for `generate_session_code`, `get_vote_results`, `is_eat_together_participant`, and edge function invocation. Manual multi-user E2E testing for the full flow and RLS verification.

---

## Q8: Migration Strategy

We need to add new RPC functions, fix RLS policies, and possibly add expiry enforcement. How should we structure the migrations?

- **A) Single migration** — One new migration file that contains all DB changes (RPC functions, RLS policy fixes, expiry cron).
- **B) Separate migrations per concern** — One for the security definer function + RLS fixes, one for missing RPCs, one for expiry enforcement.

**Answer:** A — Single migration. All DB changes (security definer function, RLS fixes, missing RPCs, expiry enforcement) in one well-commented migration file. These changes are interdependent and need to land together.

---

## Q9: Error Handling & Loading States

For the UX polish, how detailed should error messages be?

- **A) Specific and actionable** — e.g., "Session has expired. Please ask the host to create a new one." / "No restaurants match everyone's dietary requirements within the search radius."
- **B) Category-based** — e.g., "Session error" / "No results found. Try expanding your search." — less specific but less maintenance.

**Answer:** A — Specific and actionable. Error messages should tell the user exactly what happened and what to do next. The failure modes are well-defined and manageable. Surface the existing conflict analysis from the edge function to the UI.

---

## Requirements Clarification Complete

**Final decisions:**
1. **Scope:** Full polish (critical + secondary + UX)
2. **RLS strategy:** Security definer function (`is_eat_together_participant`)
3. **Session codes:** Database RPC (`generate_session_code`) with retry loop
4. **Edge function trigger:** Host-triggered "Find Restaurants" button
5. **Session expiry:** UI countdown timer + backend enforcement + auto-status transition
6. **QR scanning:** Deferred (keep "Coming Soon")
7. **Testing:** Unit tests for new RPCs + manual multi-user E2E
8. **Migrations:** Single migration file with all DB changes
9. **Error messages:** Specific and actionable, surfacing conflict analysis from edge function
