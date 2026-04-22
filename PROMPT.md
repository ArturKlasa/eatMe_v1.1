# Dish Ingestion & Menu-Scan Review Rework — Implementation

## Goal

Execute the 18-step implementation plan at
`.agents/planning/2026-04-22-ingestion-improvements/implementation/plan.md`
to ship the dish-ingestion + menu-scan-review-page rework described in
`.agents/planning/2026-04-22-ingestion-improvements/design/detailed-design.md`.

Each step is atomic and demoable. Tick the plan's top-level checklist as
each step passes its verification gate. When all 18 boxes are ticked AND
the manual verification checklist from the design doc §7.5 passes, emit
`LOOP_COMPLETE`.

## Authoritative inputs (read on every iteration)

1. **This file** — the task contract.
2. **`design/detailed-design.md`** (18 numbered sections + 4 mermaid
   diagrams) — the spec that drives every step. Do NOT edit it.
3. **`implementation/plan.md`** — the ordered checklist + per-step
   guidance. DO edit it (tick boxes as steps complete).
4. **`idea-honing.md`** — the Q&A that produced the scope. Useful if a
   decision is ambiguous; never overrides the design.
5. **`CLAUDE.md`** at repo root — project conventions and pitfalls. In
   particular: PostGIS `POINT(lng lat)`, RLS on every new table,
   `primary_protein` is NOT NULL, `transpilePackages` for TS-source
   workspace packages, localStorage keys for draft persistence.
6. **Research under `.agents/planning/2026-04-22-ingestion-improvements/research/`** —
   use as reference for any unclear decision.

## What "done" means

The work is complete when all of the following hold:

1. Every `- [ ]` in `plan.md`'s top-level checklist is `- [x]`.
2. `turbo check-types` passes across the whole monorepo.
3. `turbo test` passes across the whole monorepo.
4. `turbo build` succeeds in `apps/web-portal` and `apps/mobile`.
5. `turbo lint` passes.
6. Every item in the **manual verification checklist** (design §7.5) has
   been executed against the running app and ticks.
7. No stray edits: `git status` is clean except for the intended commits.
8. No commits violate the conventional-commit format tying each commit
   back to a plan step.
9. A squashable PR branch exists (or the commits already form a clean
   mergeable sequence) against `main`.

The ORDER is important:
- Steps 1–4 land the DB foundation + AI extraction + server endpoints.
- Step 5 ships the admin triage page.
- **Step 6 (tighten CHECK migration) is AUTHORED locally but must NOT be
  auto-applied to a DB that still has legacy `experience` rows.** Operators
  run it in production after triage. Locally you may seed the DB such that
  Step 6's migration runs cleanly.
- Steps 7–10 port state to Zustand (functional parity; no visual change).
- Steps 11–16 are the visible UX rework.
- Step 17 is the mobile kind-badge update (independent; mobile release
  lags web by 1–2 weeks).
- Step 18 is merge prep: narrow the `DishKind` type, cleanup, docs.

## Key decisions (summary — see design for detail)

- **Kind enum (final):** `standard | bundle | configurable | course_menu | buffet`.
- **Transitional union during Steps 2–17:** union of old + new values to
  avoid a big-bang refactor. The narrow 5-value enum ships in Step 18.
- **Course menu modeling:** two new tables, `dish_courses` +
  `dish_course_items`.
- **New columns on `dishes`:** `status`, `is_template`, `source_image_index`,
  `source_region` (the last one reserved — not wired this cycle).
- **Review UI:** Approach C Hybrid — Zustand state layer + right-panel
  rewrite. Upload + processing stages are untouched.
- **Save safety:** localStorage autosave (versioned) + confirm modal +
  15-min soft undo. The `source_region` column is reserved for a future
  region-level cycle.
- **No feature flag** per Q9.2. Intermediate commits may leave visible
  half-rewritten UI; prioritize keeping upload + processing functional.
- **Mobile (RN):** add new kinds to the badge map; unknown kinds fall
  through to no badge; no crash path.

## Backpressure gates (required before declaring any step done)

Ordered from cheap to expensive:

- `turbo check-types` — whole monorepo.
- `turbo test --filter <affected workspace>` — must pass.
- Step-specific demo criterion from `plan.md` — exercise it.
- For DB migrations: run against a local `supabase db reset`; verify the
  migration applies cleanly AND rolls back or is idempotent.
- For Edge Functions (`enrich-dish`): smoke-test against a local Supabase
  or (if unavailable) read the function manually and verify the kind
  branches match the new 5-value enum + legacy transitional handling.
- For API routes: `curl` or a Vitest route test.
- For UI: smoke-render; if possible, run `pnpm dev` in `apps/web-portal`
  and exercise the page.

No step is "done" with red gates. No "fix later" commits.

## Commit conventions

- One logical change per commit (multiple commits per step allowed if the
  step is genuinely multi-part — e.g., migration + types).
- Conventional-commit prefix: `feat`, `refactor`, `test`, `chore`, `fix`,
  `docs`.
- Every commit's message references the plan step number, e.g.:
  - `feat(menu-scan): add KindSelectorV2 with tooltip (plan step 11)`
  - `test(menu-scan): reviewSlice slice unit tests (plan step 8)`
  - `chore(plan): tick step 11`
- Never `--no-verify`, never `--no-gpg-sign`, never `push --force`.

## Hard constraints

- **No edits to `design/detailed-design.md`** — it's the locked spec. If
  the design is wrong, write a note to `.agent/scratchpad.md` and emit
  the `step.complete` event with `BLOCKED:` prefix. The reviewer hat
  decides whether to escalate to the human.
- **No edits to `PROMPT.md`** — this file. Same escalation path if
  something seems miscontracted.
- **Migration 115 is not auto-runnable in production.** Author it with
  the row-count guard described in design §6.4. Locally it may run after
  the triage screen has been exercised or the test DB seeded into a
  compatible state.
- **No bypassing git hooks.** If a hook fails, fix the underlying issue.
- **No feature flag for the new review UI** — ship as a coordinated
  replacement per Q9.2.
- **Mobile coordination:** web ships first. Do not gate web on mobile.

## Explicit out-of-scope (do not drift)

- Restaurant ingestion improvements (different planning cycle).
- Mobile responsive redesign for the admin portal (laptop-only per user).
- Kids menu, happy-hour/time-based pricing, seasonal date ranges,
  daypart categorization.
- Region-level source-image linkage (field reserved only).
- Full merge-preview UI.
- Cross-device draft persistence (localStorage only).
- Full audit-log revert history (soft-undo only).
- Full keyboard-first flow (minimal shortcuts only).
- Flipping `NEXT_PUBLIC_INGREDIENT_ENTRY_ENABLED` — design extension
  points only.
- Category-level options, shared add-ons, location-based menus,
  rotating-menu modeling.

## Acceptance criteria

- [ ] `plan.md` checklist: every step is `- [x]`.
- [ ] Migration 114 applies cleanly on a fresh `supabase db reset`;
      introduces all new columns, renames `combo→bundle` and
      `template→configurable`+`is_template=true`, creates `dish_courses`
      and `dish_course_items`, extends `menu_scan_jobs`, updates
      `generate_candidates()` with `is_template=false` filter.
- [ ] Migration 115 is authored with a row-count guard that refuses to
      run if any legacy kind remains; it is NOT committed as applied
      against a production DB.
- [ ] `DishKind` in `@eatme/shared` is narrowed to the 5-value union in
      Step 18 (not before).
- [ ] `DISH_KIND_META` exports 5 entries with labels, descriptions, icons.
- [ ] AI extraction (`/api/menu-scan`) emits dishes with new-kind values
      and `source_image_index` per dish; `course_menu` dishes carry a
      `courses` array.
- [ ] `enrich-dish` function's completeness logic handles all 5 new kinds.
- [ ] Confirm endpoint writes to `dish_courses` + `dish_course_items`;
      `menu_scan_jobs.saved_dish_ids` + `saved_at` populated on success.
- [ ] `/api/menu-scan/undo` exists; deletes saved dishes within 15 min,
      resets `status='needs_review'`, returns 409 after expiry.
- [ ] Experience triage page at `/admin/dishes/experience-triage` writes
      to `admin_audit_log` with `entity_type='dish'`,
      `action='dish_kind_triage'`.
- [ ] Web-portal now has `zustand` as a dependency (verify
      `apps/web-portal/package.json`).
- [ ] The review page's top-level state is in Zustand; no ~96-prop trees;
      prior hook files are either wrappers (pre-Step-18) or removed
      (post-Step-18).
- [ ] Draft autosave: refreshing the tab mid-review preserves state via
      versioned localStorage. An unversioned/old-version draft is
      discarded with a toast.
- [ ] Source-image chip on every dish jumps the left carousel on click.
- [ ] `KindSelectorV2` shows a "this will change" caption on kind change;
      bundle no longer silently hides the price field.
- [ ] `CourseEditor` supports `fixed` and `one_of` choice types; adding
      a course_menu dish auto-seeds Course 1.
- [ ] `FlaggedDuplicatePanel` shows "why flagged" (similarity + reasons)
      with side-by-side comparison.
- [ ] `SavePreviewModal` blocks save if untouched flagged dishes remain
      unless the "Save anyway" override is checked.
- [ ] `UndoToast` shows for 15 minutes after save with a live countdown.
- [ ] Keyboard shortcuts `E | N | Cmd/Ctrl+S | A | R | Escape` work,
      and do NOT fire while focus is in an input field (except
      Cmd/Ctrl+S, which always fires with preventDefault).
- [ ] Header warnings are clickable → scroll + highlight target dish;
      one-click "fix with default" where applicable.
- [ ] Mobile (`apps/mobile`) renders emoji badges for new kind values;
      unknown kind → no badge, no crash.
- [ ] `turbo check-types && turbo test && turbo build && turbo lint` all
      green.
- [ ] Manual verification checklist from `design/detailed-design.md`
      §7.5 has been run against a local dev env with every item passing.
- [ ] Every commit is conventional-commit formatted and references a plan
      step. No `--no-verify`, no force pushes.

## Output signal

When every item above is ticked AND the full backpressure suite is
green, emit `LOOP_COMPLETE` on its own line.

If at any point the design and plan contradict each other, STOP:
- Write the contradiction to `.agent/scratchpad.md` with file:line cites.
- Emit `step.complete` with a `BLOCKED:` payload.
- The reviewer hat will decide whether to escalate.

Do not silently deviate from the plan.
