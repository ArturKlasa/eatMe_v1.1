# EatMe — Auth Flow Fixes

## Objective

Implement the auth flow fixes documented in the implementation plan at:
`.agents/planning/2026-04-12-auth-flow-review/implementation/plan.md`

Work through the checklist in order. Every step must pass `turbo check-types` and
`npx vitest run` (web-portal) before being marked complete.

---

## Context

All research, findings, and fix specifications live in:
```
.agents/planning/2026-04-12-auth-flow-review/
├── research/auth-flow-findings.md   — 13 issues with file:line citations
├── research/new-user-creation.md    — DB trigger gaps + new-user flow
├── design/detailed-design.md        — exact code snippets for every fix
└── implementation/plan.md           — the checklist you are working through
```

Read `design/detailed-design.md` for the exact code changes for each step before
implementing. Do not invent solutions — the design is already specified.

---

## Steps (in order)

- [ ] Step 1: Rename `proxy.ts` → `middleware.ts`, rename export `proxy` → `middleware`
- [ ] Step 2: Change admin role checks from `user_metadata?.role` to `app_metadata?.role` in `callback/route.ts` and `middleware.ts`
- [ ] Step 3: Create `infra/supabase/migrations/082_wire_signup_triggers.sql` — bind the existing `create_user_preferences_on_signup()` function to a trigger
- [ ] Step 4: Create `infra/supabase/migrations/083_signup_user_profile_trigger.sql` — auto-create `public.users` and `user_behavior_profiles` on signup, with backfill
- [ ] Step 5: Consume `?redirect` query param in `login/page.tsx` after successful sign-in
- [ ] Step 6: Replace dual `getSession()` + `onAuthStateChange` in `AuthContext.tsx` with a single `onAuthStateChange` listener using the `INITIAL_SESSION` event
- [ ] Step 7: Update `AuthContext` `signUp` to return `needsEmailVerification`; update `signup/page.tsx` to use it
- [ ] Step 8: Create `components/AdminRoute.tsx`; replace `ProtectedRoute` with `AdminRoute` in all `/admin` pages
- [ ] Step 9: Add `emailRedirectTo: 'eatme://auth/callback'` to `authStore.ts` mobile `signUp`
- [ ] Step 10: Add `DraftData` interface extending `FormProgress` in `storage.ts`; fix `lastSaved` cast
- [ ] Step 11: Update `docs/project/workflows/auth-flow.md` per the spec in Step 11 of the plan

---

## Acceptance Criteria

Each step is done when:
1. The change matches the specification in `design/detailed-design.md`
2. `cd apps/web-portal && npx turbo check-types` exits 0
3. `cd apps/web-portal && npx vitest run` exits 0
4. The checkbox in `implementation/plan.md` is marked `[x]`

SQL migration steps (3, 4) are done when the `.sql` file is written correctly.
There is no automated DB test — verify the SQL is syntactically correct and matches
the specification before marking done.

The final step (11) is done when the doc is updated. Emit `LOOP_COMPLETE` after Step 11.

---

## Guardrails

- Read `design/detailed-design.md` before implementing each step — don't guess.
- Run `turbo check-types` and `vitest run` after every TypeScript change.
- Do not modify any files outside the scope of the current step.
- Do not rename or move files other than `proxy.ts` → `middleware.ts`.
- DB migration filenames must follow the pattern: `NNN_description.sql`.
- Do not implement Facebook OAuth — it is explicitly deferred.
- Mark each step `[x]` in `implementation/plan.md` only after verification passes.
- If `check-types` or `vitest` fails, fix the failure before moving to the next step.
