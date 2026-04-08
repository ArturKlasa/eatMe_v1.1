# Research: Session Expiry Enforcement

## Current State
- `eat_together_sessions.expires_at` defaults to `created_at + interval '3 hours'`
- No backend enforcement — expired sessions remain in `waiting`/`voting` status
- No UI indication of remaining time

## Backend: pg_cron Approach

Source: [Supabase Cron docs](https://supabase.com/docs/guides/cron/quickstart)

### Cron Job to Expire Sessions
```sql
SELECT cron.schedule(
  'expire-eat-together-sessions',
  '*/5 * * * *',  -- every 5 minutes
  $$
    UPDATE eat_together_sessions
    SET status = 'expired', closed_at = now()
    WHERE status NOT IN ('decided', 'cancelled', 'expired')
      AND expires_at < now()
  $$
);
```

### Additional Backend Enforcement
Add `expires_at > now()` checks in:
- RPC functions (`get_vote_results`, `generate_session_code` usage context)
- Edge function (already checks session exists, should also check expiry)
- RLS policies (optional — could add `AND expires_at > now()` to SELECT policies)

## Frontend: Countdown Timer

### Implementation
- Calculate remaining time from `session.expires_at`
- Display countdown in lobby and voting screens
- When timer hits zero OR realtime broadcasts `expired` status:
  - Show "Session Expired" overlay
  - Disable all actions
  - Offer navigation back to main screen

### Edge Cases
- Clock skew between client and server — use server time from session data, not `Date.now()`
- Session expiring mid-vote — cron job transitions status, realtime notifies all members
- Host extending session — not currently supported (could be future feature)
