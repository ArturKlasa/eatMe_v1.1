## 2026-04-12 — Planner pass (initial)

### Step status

All 11 steps are unchecked ([ ]) in `implementation/plan.md`.

### Work queue overview

| Step | Description | Status |
|------|-------------|--------|
| 1 | Rename `proxy.ts` → `middleware.ts`, rename export | [ ] |
| 2 | Change admin role checks to `app_metadata` in callback/route.ts + middleware.ts | [ ] |
| 3 | Create `infra/supabase/migrations/082_wire_signup_triggers.sql` | [ ] |
| 4 | Create `infra/supabase/migrations/083_signup_user_profile_trigger.sql` | [ ] |
| 5 | Consume `?redirect` param in `login/page.tsx` | [ ] |
| 6 | Simplify `AuthContext.tsx` to single `onAuthStateChange` listener | [ ] |
| 7 | `AuthContext` signUp returns `needsEmailVerification`; update `signup/page.tsx` | [ ] |
| 8 | Create `components/AdminRoute.tsx`; replace `ProtectedRoute` in admin pages | [ ] |
| 9 | Add `emailRedirectTo: 'eatme://auth/callback'` to mobile `authStore.ts` | [ ] |
| 10 | Add `DraftData` interface in `storage.ts`; fix `lastSaved` cast | [ ] |
| 11 | Update `docs/project/workflows/auth-flow.md` | [ ] |

### Next step to implement: Step 1

**Goal:** Make Next.js edge middleware actually run — it's currently in `proxy.ts` which Next.js ignores.

**Key files:**
- `apps/web-portal/proxy.ts` — rename to `apps/web-portal/middleware.ts`
- Change `export async function proxy` → `export async function middleware`
- `export const config` stays unchanged
- After Step 1 is done, update `implementation/plan.md` checkbox

**Prerequisite awareness:**
- Step 2 must come after Step 1 (it references `middleware.ts` at line 80)
- Steps 3, 4 are standalone SQL migrations, no code deps
- Steps 5–11 are mostly independent from each other
- Steps should be executed in order per the plan

### Key decisions
- Rename actual file (not re-export shim) per plan guidance
- Run `turbo check-types` + `vitest run` after every TS change
- SQL migration steps (3, 4) verified visually — no automated DB test
