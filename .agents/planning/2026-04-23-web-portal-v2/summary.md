# EatMe Web Portal v2 — Planning Summary

> Artifact produced at the close of the Prompt-Driven Development session on 2026-04-23.
> Collects the planning outputs, names the locked decisions, flags residual refinement
> areas, and hands off to implementation. Treat this as the reader's entry point to the
> v2 planning bundle.

---

## 1. Scope

v2 rebuilds `apps/web-portal/` from scratch as two separate apps — owner at
`apps/web-portal-v2/`, admin at `apps/admin/` — while the existing v1 portal stays
deployed and untouched until DNS cutover. Supabase gains additive schema pieces (status
columns, `menu_scan_jobs` extensions, three Postgres functions, one new RLS tightening
migration). The consumer mobile app receives six mechanical defense-in-depth filter
patches and zero UX changes. Rough idea at `apps/rough-idea.md`.

---

## 2. Artifacts produced

All paths relative to `.agents/planning/2026-04-23-web-portal-v2/`.

### Spec & planning inputs
- `rough-idea.md` — copy of `apps/rough-idea.md` (the session seed).
- `idea-honing.md` — intentionally sparse. The user chose to start with research instead
  of a formal Q&A round; the research docs + design review iteration replaced it.

### Research
- `research/prior-work-consolidation.md` — mines prior planning archives
  (`2026-04-22-ingestion-improvements`, `2026-04-12-auth-flow-review`,
  `2026-04-10-web-portal-redesign`, `2026-04-09-web-portal-ux-redesign`,
  `2026-04-06-menu-ingestion-enrichment`, `2026-04-10-admin-restaurant-ingestion`,
  `2026-04-11-eatme-code-refactor`, `2026-04-08-implement-performance-optimizations`)
  for what v2 inherits vs rebuilds vs defers.
- `research/frozen-surface.md` — inventory of everything v2 cannot change without
  breaking mobile: 6 direct Supabase queries across 3 mobile files,
  `@eatme/shared` + `@eatme/database` public API, consumer-facing Edge Functions,
  migrations 100–115, RLS state, existing `menu_scan_jobs` shape.
- `research/nextjs-foundation.md` — Next.js 16 + React 19 + App Router + Server Actions
  conventions; `proxy.ts` (the new middleware-file convention) on Node runtime;
  `@supabase/ssr` patterns; two-app monorepo specifics; auth wrapper design;
  `getUser()` vs `getClaims()` split; Zod-on-server idioms.
- `research/release-safety.md` — 6-phase release runbook with SQL-level detail
  (Phase 0 pre-flight, Phase 1 additive migrations, Phase 2 Edge Function patches,
  Phase 3 mobile, Phase 4 RLS tightening — the one-way door, Phase 5 canary deploy).
  Surfaced a zero-menu `menus!inner` risk on `nearby-restaurants`.
- `research/small-memos.md` — four tactical memos: B1 (Supabase Edge + pg_cron + pg_net
  + `FOR UPDATE SKIP LOCKED`), C1 (OpenAI Structured Outputs + Vision + pinned model),
  G1 (browser-side resize with `browser-image-compression`), G2 (allergens / dietary_tags
  default `[]`).

### Design
- `design/detailed-design.md` — the authoritative v2 spec (≈ 10 k prose words +
  4 mermaid diagrams). Sections: Overview → Requirements → Architecture (system diagram
  + menu-scan sequence + publish sequence) → Components & Interfaces (owner app,
  admin app, shared packages, Edge Functions, mobile patches) → Data Models (8
  migrations, 7 Postgres function signatures, state machine, RLS table, type additions)
  → Error Handling → Testing Strategy → Appendices (tech rationale, research findings
  table with locked/deferred flags, alternatives considered, release runbook summary).
  Iterated once post-review to resolve 8 internal contradictions.

### Implementation plan
- `implementation/plan.md` — 28 numbered steps, each with Objective, Implementation
  guidance, Test requirements, Integration, Demo, Commit convention. Checklist at the
  top tracks progress. Phase groupings:
  - **A. Foundation** (Steps 1–4): scaffolding, auth wrappers, Zod schemas, proxies.
  - **B. Migrations** (Steps 5–10): buckets (116a) → status cols (116+117) →
    menu_scan_jobs extend + RLS + Realtime (118+119) → publish function (120) →
    confirm function + side-table (121) → candidate-RPC filters (122).
  - **C. Edge Function patches + release-safety tests** (Steps 11–12).
  - **D. Mobile patches** (Step 13).
  - **E. Owner app** (Steps 14–18): auth → draft CRUD → onboarding stepper → menu/dish
    CRUD → publish. **Core end-to-end milestone at Step 18.**
  - **F. Menu scan end-to-end** (Steps 19–21): worker + cron → upload UI →
    review + confirm.
  - **G. Admin app** (Steps 22–25).
  - **H. E2E + release** (Steps 26–28): Playwright gold paths → migration 123 (the
    one-way door, with 6 explicit preconditions) → canary deploy + DNS cutover ticket.
- Cross-checked against the design at 94% coverage; zero MUST FIX items; two SHOULD FIX
  items addressed (auth-wrapper audit script specifics in Step 2; dish photo upload in
  Step 17).

---

## 3. Locked decisions

- **App layout:** two Next.js 16 apps (`apps/web-portal-v2/` owner, `apps/admin/`),
  plus new `packages/ui/` hosting shadcn sources + Tailwind v4 config. Old
  `apps/web-portal/` untouched.
- **Coordination with in-flight `2026-04-22-ingestion-improvements`:** parallel track
  (option iii). v2 re-implements menu-scan as async jobs rather than the synchronous
  Zustand review UI that shipped to v1.
- **Job worker:** Supabase Edge Function + `pg_cron` + `pg_net.http_post`. Table-based
  claim via `FOR UPDATE SKIP LOCKED`; `attempts ≥ 3 → failed`. 1-minute cron cadence.
- **Menu-scan AI:** OpenAI GPT (stays on the v1 model, not Claude). Pin
  `gpt-4o-2024-11-20`, fallback `gpt-4o-mini`. Structured Outputs + Vision inherited
  from `2026-04-06-menu-ingestion-enrichment`.
- **Data access layer:** raw Supabase client + generated types. No Drizzle, no Kysely.
- **Image handling:** browser-side `browser-image-compression` (max 2048 px, JPEG 0.85)
  → direct upload to Supabase Storage → worker reads from Storage. No Sharp.
- **Ingredient gap defaults:** new v2 dishes get `allergens: []` and
  `dietary_tags: []` (not `null`). Matches `@eatme/shared` non-nullable types.
- **Session validation:** `getUser()` in auth wrappers (remote, authoritative,
  security gate); `getClaims()` inside DAL for repeated reads (local JWT verify).
- **Auth wrapper enforcement:** custom ESLint rule `no-unwrapped-action` fails CI if
  any exported Server Action or Route Handler is not wrapped. Plus a non-gating
  `turbo audit` task that emits a markdown wrapper report.
- **Admin role check:** `app_metadata.role === 'admin'` only. Never
  `user_metadata.role` (user-writable, privilege-escalation risk).
- **`proxy.ts` not `middleware.ts`:** Next.js 16 renamed the convention. Proxy is a
  UX affordance (cookie refresh + optimistic redirect), not the security gate; wrappers
  + DAL + RLS are the gates.
- **Cache Components / React Compiler:** skipped for v2.0. Reconsider with a perf
  baseline.
- **`menu_scan_jobs` RLS:** explicit owner-only policies via migration 119 (was
  historically dashboard-toggled).
- **Storage buckets:** migration-tracked in 116a (were historically dashboard-toggled).
- **Idempotency for `confirm_menu_scan`:** side-table `menu_scan_confirmations` with
  PK `(job_id, idempotency_key)`. Cleaner than a JSONB UNIQUE on the jobs table.
- **`nearby-restaurants` zero-menu handling:** LEFT embed + RLS-only nested
  enforcement (zero-menu mid-onboarding restaurants stay visible until the
  post-Phase-4 RLS gates them).

---

## 4. Residual refinement areas

Not blockers for implementation, but worth an eye when the corresponding step is
executed:

- **Menu-scan `needs_review → failed` transition** has no automatic trigger (only
  manual admin action via Step 24). If a scan sits in `needs_review` indefinitely, it
  never auto-expires. Consider a cron-based stale-job sweeper if abandoned-scan
  hoarding becomes a real problem.
- **`processing → pending` reclaim test** (stuck-worker rescue via expired
  `locked_until`) is implicit in Step 19 but not called out as a named test case.
- **Dish photo upload** was clarified in the post-review edit pass but reuses
  Step 16's restaurant-photo helper — validate on first real dish-photo upload that
  the RLS policy scopes correctly to the owner (the test in Step 17 covers this, but
  integration only proves out end-to-end on Step 26's Playwright run).
- **k6 load test** is explicitly optional per design §7 ("not a launch gate"). Absent
  from the 28 steps. Add post-launch if capacity planning needs it.
- **Observability / APM strategy** (Sentry or similar) deferred to post-launch. v2
  launches on Supabase dashboard logs + Vercel logs.
- **Admin rate limiting for menu scans** beyond the global `MAX_PER_TICK=3` is
  deferred. Per-owner caps are a post-launch addition if abuse surfaces.
- **`get_group_candidates` missing `is_template=false` filter** is a pre-existing
  v1 bug flagged in the plan (Step 10) for a follow-up ticket — out of v2 scope.

---

## 5. Next steps for the user

1. Skim the design doc (`design/detailed-design.md`) one more time with fresh eyes.
   Skim the plan's checklist. Spot-check Steps 8, 9, 19, 21, 27 — they carry the
   most irreversible risk.
2. If anything surprises you, iterate: the plan phase can be revisited without
   rebuilding research.
3. Line up execution (see §6).
4. Before Phase 4 (Step 27), re-read `research/release-safety.md` end-to-end with
   whoever is on-call for the deploy. The six preconditions in Step 27 should be
   turned into a pre-deploy checklist tracked in your release tool.

---

## 6. Implementation handoff (Ralph Loop)

Per the Prompt-Driven Development SOP, this session ends at planning. Implementation
is driven by a Ralph loop that reads these artifacts on every iteration. The
existing `ralph.yml` at the repo root is configured for the
`2026-04-22-ingestion-improvements` task; for v2 you will want a separate
`ralph.v2.yml` (or edit `ralph.yml` once 2026-04-22 is fully in production) pointing
at this planning directory.

To start the loop:

```
ralph run --config presets/pdd-to-code-assist.yml --prompt "Execute the 28-step implementation plan at .agents/planning/2026-04-23-web-portal-v2/implementation/plan.md. Authoritative spec is design/detailed-design.md. Research at research/*.md. Each step is atomic and demoable; tick the checklist on completion."
```

Alternative (if custom hats aren't needed):

```
ralph run -c ralph.yml -H builtin:pdd-to-code-assist -p "<same-prompt-as-above>"
```

Notes:

- Step 27 (migration 123, the one-way door) has six hard preconditions — do not let
  the loop execute this step until all are demonstrably satisfied. Gate it in the
  orchestrator or pause the loop before that step.
- Step 28 (canary deploy + DNS cutover) is operational; treat as human-in-the-loop.
- Steps 13 (mobile patches) can run in parallel with any owner-app step once
  migrations are landed, per the plan's parallelisability notes.
