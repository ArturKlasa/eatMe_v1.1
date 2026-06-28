# EatMe Web Portal v2 — Implementation

## Goal

Execute the 28-step implementation plan at
`apps/web-portal-v2/planning/implementation/plan.md`
to ship the v2 rebuild described in
`apps/web-portal-v2/planning/design/detailed-design.md`.

The build is two new Next.js 16 apps (owner at `apps/web-portal-v2/`, admin
at `apps/admin/`) plus additive Supabase schema changes, Edge Function
patches, and six mechanical mobile filter patches. (The former v1 owner
portal was removed 2026-06-18; only the v2 apps remain.)

Each step is atomic and demoable. Tick the plan's top-level checklist as
each step passes its verification gate. **Steps 27 and 28 are human-gated** —
the Ralph loop emits `LOOP_COMPLETE` after Step 26 with a handoff note;
humans decide when Step 27 (RLS tightening — the one-way door) and Step 28
(canary deploy + DNS cutover) are safe to run.

## Authoritative inputs (read on every iteration)

1. **This file (`PROMPT.md`)** — the task contract.
2. **`design/detailed-design.md`** (8 sections + 4 mermaid diagrams) — the
   spec that drives every step. Do NOT edit it.
3. **`implementation/plan.md`** — the ordered 28-step checklist + per-step
   guidance. DO edit it (tick boxes as steps complete; annotate if needed).
4. **`research/*.md`** — supporting research:
   - `prior-work-consolidation.md` — what v2 inherits from prior planning
   - `frozen-surface.md` — mobile-frozen API + migration state
   - `nextjs-foundation.md` — Next.js 16 + auth wrappers + SSR + Zod
   - `release-safety.md` — 6-phase release runbook
   - `small-memos.md` — B1 job worker, C1 OpenAI, G1 images, G2 defaults
5. **`summary.md`** — quick index of the planning bundle and locked decisions.
6. **`CLAUDE.md`** at repo root — project conventions and pitfalls.
7. **`agent_docs/*.md`** — architecture, database, conventions, terminology.

## What "done" means for this loop

**Loop output:** `LOOP_COMPLETE` after Step 26 is ticked and all backpressure
gates are green. Steps 27 and 28 are explicitly out of the loop's scope
(human-gated).

Steps 1–26 are complete when all of the following hold:

1. Every `- [ ]` in plan.md for Steps 1–26 is `- [x]`. Steps 27 and 28
   remain `- [ ]`.
2. `turbo check-types` passes across the whole monorepo.
3. `turbo test` passes across the whole monorepo (including new
   v2 workspaces).
4. `turbo build --filter web-portal-v2` and `turbo build --filter admin`
   succeed. Owner first-load bundle ≤ 250 KB gzip (design §2.5).
5. `turbo lint` passes — custom `no-unwrapped-action` rule enforces auth
   wrapper coverage.
6. Release-safety CI suite (Step 12) green: drafts-never-visible across
   every consumer endpoint + pre/post-Phase-4 parity snapshot.
7. `git status` clean or contains only intended commits. No unlisted
   changes to `apps/mobile/`.
8. Every commit is conventional-commit-formatted and references a plan
   step. No `--no-verify`, no force pushes, no hook bypasses.

**Full v2 ship** (Steps 27 + 28) happens after `LOOP_COMPLETE`, operated by
a human per `research/release-safety.md`.

## Phase grouping (plan.md structure)

- **A. Foundation** (Steps 1–4): monorepo scaffolding (two apps +
  `@eatme/ui`), auth wrappers + DAL + ESLint rule, shared Zod schemas,
  per-app proxies.
- **B. Additive migrations — Phase 1 of runbook** (Steps 5–10): storage
  buckets (116a), `status` columns on restaurants + menus (116 + 117),
  `menu_scan_jobs` extend + RLS + Realtime (118 + 119), `publish_restaurant_draft`
  (120), `menu_scan_confirmations` + `confirm_menu_scan` + worker helpers
  (121), `generate_candidates` + `get_group_candidates` filter patches (122).
- **C. Edge Function patches + release-safety tests** (Steps 11–12):
  `nearby-restaurants` + `feed` patches, drafts-never-visible +
  pre/post-Phase-4 parity CI suites.
- **D. Mobile patches — 6 sites in 3 files** (Step 13):
  `restaurantStore.ts`, `useDish.ts`, `BasicMapScreen.tsx`.
- **E. Owner app — draft to publish E2E** (Steps 14–18): auth + DAL →
  restaurant draft CRUD → onboarding stepper → menu + dish CRUD → publish
  flow with Realtime. **Core end-to-end milestone at Step 18.**
- **F. Menu scan end-to-end** (Steps 19–21): `menu-scan-worker` Edge
  Function + `pg_cron` (116b) + OpenAI (v2-rewritten prompt + schema),
  upload UI, review + category assignment + confirm.
- **G. Admin app** (Steps 22–25): auth shell + restaurant browse, edit with
  `is_active`, menu-scan power tool, bulk import (CSV + Google Places) +
  audit log.
- **H. E2E + release** (Steps 26–28): Playwright gold paths →
  **Step 27 RLS tightening (human-gated)** → **Step 28 canary deploy
  (human-gated)**.

## Key decisions (summary — see design for detail)

- **Two apps, parallel to v1.** `apps/web-portal-v2/` + `apps/admin/`. v1
  untouched.
- **Job worker:** Supabase Edge Function + `pg_cron` (1-minute tick) +
  `pg_net.http_post`. Table-based claim via `claim_menu_scan_job` using
  `FOR UPDATE SKIP LOCKED`. `attempts ≥ 3 → failed`.
- **AI for menu scan:** OpenAI GPT. **Inherit the integration pattern from
  v1; REWRITE the prompt + response schema for v2** (drop allergen /
  dietary / ingredient fields, pin `dish_kind` to the 5-value enum, pin
  `primary_protein` to the 11-value list, add per-dish
  `suggested_category_name`, omit `is_template` and `calories`). Pin
  `gpt-4o-2024-11-20`; fallback `gpt-4o-mini`.
- **Data access:** raw Supabase client + generated types. No Drizzle/Kysely.
- **Images:** browser-side `browser-image-compression` (max 2048 px, JPEG
  q0.85) → direct upload to Supabase Storage → worker reads from Storage.
- **Next.js 16:** middleware file is `proxy.ts` (not `middleware.ts`). Node
  runtime. Async `params` / `searchParams` / `cookies()` — always `await`.
  `@supabase/ssr` canonical.
- **Auth:** `withAuth` / `withAdminAuth` / `withPublic` wrappers mandatory
  on every Server Action and Route Handler. `getUser()` (remote,
  authoritative) inside wrappers; `getClaims()` (local JWT, `cache()`-wrapped)
  inside DAL. Admin role from `app_metadata.role` only. ESLint rule
  `no-unwrapped-action` fails CI.
- **Shared UI:** `packages/ui/` hosts shadcn primitives + composed helpers
  + Tailwind v4 config; both apps depend on it.
- **Idempotency:** side-table `menu_scan_confirmations` with PK
  `(job_id, idempotency_key)` for `confirm_menu_scan` dedup.
- **RLS tightening:** migration 123 drops `USING (true)` anon SELECT on
  `restaurants` / `menus` / `dishes`; replaces with
  `USING (status = 'published')`. **One-way door. Human-gated (Step 27).**
- **No Zustand in v2.** Server Components + TanStack Query + Server Actions
  cover it. 2026-04-22 shipped Zustand in v1's review UI; it stays in v1.
  Some visual components are ported from v1 — rewire their state.
- **Allergens / dietary_tags default `[]`, not `null`.** Matches
  `@eatme/shared` non-nullable types + Zod validator.

## Backpressure gates (required before declaring any step done)

Ordered cheap → expensive:

1. `turbo check-types` — whole monorepo.
2. `turbo test --filter <affected workspace>` — must pass.
3. Step-specific Demo criterion from plan.md — exercise it.
4. For DB migrations: `supabase start` + `supabase db reset` on a scratch
   DB. Apply forward. Apply the reverse migration. Re-apply forward. Schema
   round-trip must be identical. Forward is gate; the round-trip catches
   non-reversible migrations.
5. For Edge Functions: Deno bundle builds; integration test exercises the
   handler with OpenAI stubbed to return canned Structured Output.
6. For Next.js apps: `turbo build --filter <app>` must build clean. Bundle
   budget (owner ≤ 250 KB gzip first-load) checked via the CI bundle-size
   report.
7. For RLS policy changes (migration 123, Step 27): staging parity run.
   **Not executed by the loop.**

No step is "done" with red gates. No "fix later" commits.

## Commit conventions

- One logical change per commit (multiple commits per step permitted for
  genuinely multi-part steps — e.g., migration + function + types).
- Conventional-commit prefix: `feat`, `refactor`, `test`, `chore`, `fix`,
  `docs`.
- **Scope tags:**
  - `v2` — new-app code (`apps/web-portal-v2/`, `apps/admin/`)
  - `db` — Supabase migrations
  - `edge` — Edge Function code
  - `mobile` — the 6 filter patches in Step 13
  - `shared` — `@eatme/shared`, `@eatme/database`, `@eatme/tokens`, `@eatme/ui`
  - `plan` — plan.md checkbox updates
  - `ci` — ESLint rule, Playwright setup, CI workflow changes
- Every commit's message references the plan step, e.g.:
  - `feat(v2): scaffold web-portal-v2 + admin + @eatme/ui (plan step 1)`
  - `feat(ci): no-unwrapped-action ESLint rule + wrappers + DAL (plan step 2)`
  - `feat(db): migrations 116+117 — status columns on restaurants/menus (plan step 6)`
  - `feat(edge): menu-scan-worker + pg_cron + OpenAI (plan step 19)`
  - `feat(mobile): defense-in-depth status='published' filters, 6 sites (plan step 13)`
  - `chore(plan): tick step 6`
- Never `--no-verify`, never `--no-gpg-sign`, never `push --force`.

## Hard constraints

- **No edits to `design/detailed-design.md`** — locked spec. If wrong:
  write to `.agent/scratchpad.md` + emit `BLOCKED:`. Reviewer escalates.
- **No edits to `PROMPT.md`** — this file. Same escalation path.
- **No edits to the former v1 owner portal** — it was removed 2026-06-18;
  all code lives in the v2 apps.
- **No edits to `apps/mobile/` outside Step 13's six listed sites:**
  `apps/mobile/src/stores/restaurantStore.ts` (lines 126, 159, 269, 312),
  `apps/mobile/src/hooks/useDish.ts` (line 41), and
  `apps/mobile/src/screens/BasicMapScreen.tsx` (line 491).
- **Steps 27 and 28 are human-gated.** The loop emits `LOOP_COMPLETE` after
  Step 26. Do NOT author migration 123 as "applied" against any DB. Do NOT
  initiate a canary deploy. A human verifies the six preconditions in
  plan.md Step 27 before migration 123 runs.
- **No Zustand introduced in v2 code.** If porting a component from v1's
  2026-04-22 work (Step 17), rewire its state to react-hook-form + Server
  Actions. Do not bring the Zustand dependency into `apps/web-portal-v2/`
  or `apps/admin/`.
- **No bypassing git hooks.** If a hook fails, fix the underlying issue.
- **`no-unwrapped-action` ESLint rule** must stay enforced once Step 2
  lands. Do not disable it to make CI green — wrap the handler instead.

## Explicit out-of-scope (do not drift)

- Ingredient pipeline UI (allergen picker, AI ingredient extraction).
  Deferred to a follow-up project per design §2.6. DB tables stay
  populated for legacy dishes; v2 UI does not surface them. New v2 dishes
  get `allergens: []` and `dietary_tags: []`.
- Payments / billing / analytics dashboards for owners.
- Multi-user-per-restaurant teams.
- Mobile UX changes / redesigns.
- Schema rewrites (dish variant consolidation, option-group refactor).
- Cache Components / `use cache` directive.
- React Compiler.
- `packages/ui/` migration for v1.
- k6 load testing.
- Sentry / APM (dedicated observability beyond Supabase + Vercel logs).
- Fix for `get_group_candidates` missing `is_template=false` filter
  (pre-existing v1 bug — flagged for a follow-up ticket).
- Model bake-off (Claude / Gemini vs GPT).
- Admin "promote to admin" UI (role assignment stays service-role /
  dashboard only).

## Acceptance criteria (Steps 1–26)

- [ ] `plan.md` Steps 1–26 are all `- [x]`.
- [ ] Steps 27 and 28 remain `- [ ]` (human-gated).
- [ ] `apps/web-portal-v2/` and `apps/admin/` exist as independently
      buildable Next.js 16 projects, each with its own `proxy.ts`, sharing
      `@eatme/ui`, `@eatme/shared`, `@eatme/database`, `@eatme/tokens`.
- [ ] `packages/ui/` hosts shadcn components + Tailwind v4 config; both
      apps consume via `transpilePackages`.
- [ ] Custom ESLint rule `no-unwrapped-action` lives in
      `packages/eslint-config-eatme/` and fails CI on bare exports.
- [ ] `scripts/check-auth-wrappers.ts` exists in both apps; `turbo audit`
      produces a markdown wrapper-status table (informational, non-gating).
- [ ] Migrations 116a / 116 / 117 / 116b / 118 / 119 / 120 / 121 / 122
      apply cleanly on a fresh `supabase db reset` and round-trip with
      their reverse migrations. Migration 123 is AUTHORED but **NOT
      applied** in this loop.
- [ ] `menu_scan_confirmations` side-table exists (PK `(job_id,
      idempotency_key)`); `confirm_menu_scan` uses it.
- [ ] `publish_restaurant_draft(uuid)` is `SECURITY DEFINER`, gates on
      `owner_id = auth.uid() OR public.is_admin()`, runs restaurant +
      menus + dishes flips in a single transaction.
- [ ] Worker helpers `claim_menu_scan_job`, `complete_menu_scan_job`,
      `fail_menu_scan_job` exist with `FOR UPDATE SKIP LOCKED` claim,
      `attempts` increment, `locked_until` reclaim semantics.
- [ ] `menu_scan_jobs` has `input`, `attempts`, `locked_until` columns;
      CHECK constraint accepts `pending | processing | needs_review |
      completed | failed`; default is `'pending'`; RLS enabled with
      owner-only SELECT/INSERT/UPDATE; table added to
      `supabase_realtime` publication.
- [ ] Edge Function `menu-scan-worker` deployed; invoked by `pg_cron`
      every minute via `pg_net.http_post`; integration test proves
      `pending → processing → needs_review` transition with stubbed
      OpenAI, and `processing → failed` after 3 rate-limit errors.
- [ ] OpenAI prompt + `MenuExtractionSchema` are v2-specific (not a copy
      of v1). Schema rejects legacy `dish_kind='combo'` fixtures and
      values outside the 11-value `primary_protein` list. Extra fields
      (allergens, dietary_tags) from an overly-helpful model are rejected
      or stripped.
- [ ] `nearby-restaurants` + `feed` Edge Functions patched with
      `status='published'` filters. `nearby-restaurants` uses a LEFT embed
      for `menus` so zero-menu mid-onboarding restaurants stay visible
      through Phase 2 (RLS closes it in Phase 4).
- [ ] `generate_candidates` + `get_group_candidates` RPC bodies updated
      via migration 122 to include `status='published'` predicates.
- [ ] Mobile defense-in-depth: 6 direct queries across 3 files gain
      `.eq('status', 'published')`. EAS build green. No UX regressions.
- [ ] Release-safety CI suite (Step 12) passes on staging:
      drafts-never-visible across every consumer endpoint + every mobile
      direct-query shape; pre/post-Phase-4 parity snapshot empty.
- [ ] Owner gold path works locally: signup → onboard stepper → draft
      restaurant + menu + dish → publish — end-to-end.
- [ ] Menu-scan gold path works locally: upload → `pg_cron` tick → worker
      extracts → Realtime notifies → review with category assignment →
      confirm → dishes land as `status='draft'`. Retrying the confirm
      with the same idempotency key returns the original result (no
      duplicates).
- [ ] Admin gold path works locally: sign-in as admin → browse → suspend
      one → batch menu scan → CSV bulk-import → admin_audit_log shows
      every mutation.
- [ ] Playwright 4-gold-path suite (Step 26) green:
      signup→onboard→draft-persist, menu-scan E2E, publish Realtime,
      admin CSV import.
- [ ] `turbo check-types && turbo test && turbo build && turbo lint` all
      green.
- [ ] Every commit is conventional-commit formatted and references a
      plan step. No `--no-verify`, no force pushes.

## Output signal

When every item above is `- [x]` AND the backpressure suite is green,
reviewer emits on its own line:

`LOOP_COMPLETE Steps 1-26 complete. Step 27 (migration 123 RLS tightening — the one-way door) and Step 28 (canary deploy + DNS cutover) are human-gated. Preconditions are listed in plan.md Step 27 and research/release-safety.md. Handoff complete.`

If at any point the design and plan contradict each other:

- Write the contradiction to `.agent/scratchpad.md` with file:line cites.
- Emit `step.complete` with a `BLOCKED:` payload (NOT
  `BLOCKED: HUMAN_GATE_REQUIRED` — that is reserved for Steps 27/28).
- The reviewer escalates.

Do not silently deviate from the plan.
