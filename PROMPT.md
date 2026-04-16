# Codebase Review (read-only)

## Goal

Review the entire EatMe monorepo and produce a written report of issues
ranked by severity. This is a **read-only** pass: the loop MUST NOT modify
any source file, MUST NOT create git commits, and MUST NOT run any tool
in write mode.

All output lives under
`.agents/research/codebase-review-2026-04-16/` plus
`.agent/scratchpad.md` (the agenda). No other files are writable.

## What the review must cover

Scan for issues in these categories. Every finding must cite `file:line`.

1. **Security** — RLS policies (every new table needs RLS with `owner_id`
   FK to `auth.users`), auth/session handling, secret exposure, injection
   vectors (SQL, XSS, command), unsafe deserialisation, open redirects.
2. **Correctness** — race conditions, nullability holes, PostGIS POINT
   order (`POINT(lng lat)` not `POINT(lat lng)`), timezone/currency
   handling, Zod schemas that drift from runtime shape, off-by-one.
3. **Performance** — N+1 queries, missing indexes, unnecessary
   re-renders, oversized client bundles, unbatched network calls.
4. **Maintainability** — duplicate logic, god-components, unclear
   naming, excessive `as` casts / `any`, dead code, commented-out blocks.
5. **Accessibility** (web-portal) — missing labels, keyboard traps,
   focus management, colour contrast from tokens.
6. **Convention adherence** — departures from `CLAUDE.md` and
   `agent_docs/` (e.g. transpilePackages for TS-source workspace pkgs,
   explicit env var passing to the Supabase client factory, localStorage
   draft-persistence keys).
7. **Developer experience** — broken scripts, missing type-check coverage,
   flaky or missing tests on high-risk surfaces.

## Severity and confidence taxonomy

- **Severity**: `critical` (data loss / security breach / outage),
  `high` (user-visible bug or realistic security risk),
  `medium` (latent bug, maintainability debt likely to bite),
  `low` (minor polish), `info` (observation, no action needed).
- **Confidence**: `confirmed` (verified by reading all relevant code),
  `likely` (strong signal, one reasonable alternative explanation),
  `needs-verification` (requires runtime trace, DB state, or product
  context to resolve). Needs-verification items go in a separate queue
  in the final summary, not mixed with confirmed findings.

## What is NOT part of this task

- Writing or editing any source file (including tests, configs, styles,
  types). If a fix seems obvious, document it as a suggestion — do not
  apply it.
- Git commits, branch creation, pushes, or stashes of any kind.
- Editing existing Supabase migrations. You may recommend a NEW migration
  but you must not create the file.
- Reviewing generated files (`*.generated.ts`, Supabase types under
  `packages/database/src/types/`) — not human-authored.
- Reviewing `node_modules/`, lockfiles, build output, or vendored code.

## Scope (in priority order)

- `apps/web-portal/` — Next.js 16 + React 19, admin menu-scan pipeline,
  form handling (react-hook-form + Zod), server actions, routing.
- `apps/mobile/` — Expo 54 + RN 0.81, Zustand stores, Mapbox integration,
  i18next (en/es/pl).
- `packages/shared/` — Zod schemas, TS types, constants. Watch for
  duplication with consumers.
- `packages/database/` — Supabase client factory, env var handling,
  generated types boundary.
- `packages/tokens/` — design tokens and their consumer usage.
- `infra/supabase/migrations/` — review for RLS, FK integrity, indexes.
  Read-only: do not propose edits, only new-migration suggestions.
- Root config: `turbo.json`, workspace `package.json` files, `tsconfig.json`.

## Deliverables

1. **`.agent/scratchpad.md`** — agenda of 8-14 review AREAS, each marked
   `[ ]` (pending) or `[x]` (reviewed). No `[~]` — every area must get
   reviewed in read-only mode since there is no "too risky to attempt".

2. **`.agents/research/codebase-review-2026-04-16/<slug>.md`** for each
   area, with:
   - Scope reviewed (files/dirs actually read, with line ranges).
   - Findings list, each with severity, category, `file:line`,
     observation, why-it-matters, suggested direction, confidence,
     evidence.
   - "No issues found in" list — sub-areas checked clean.
   - Follow-up questions list — items needing runtime context.

3. **`.agents/research/codebase-review-2026-04-16/00-summary.md`** with:
   - Executive summary (4-8 sentences).
   - Severity rollup (counts across entire review).
   - Top 5-10 findings across all areas, with links to detail files.
   - Areas table: Area | Status | Findings count | Highest severity |
     Detail file.
   - Category heatmap.
   - Needs-verification queue.
   - Out-of-scope list with reasons.
   - Recommended next steps (ordered, grouped by severity).

## Hard constraints

- **No source edits.** Not to `apps/`, `packages/`, `infra/`, or root.
- **No git mutations.** `git log`, `git blame`, `git diff`, `git show`
  are fine. `git add`, `git commit`, `git checkout -- <file>`,
  `git reset`, `git push` are forbidden.
- **Cite `file:line` for every claim.** If you cannot point to a line,
  it is not a finding yet — either verify or demote to
  "needs-verification".
- **Write only to the review directory and the scratchpad.** Any other
  write is a bug in the loop.
- **No minification or "summary LOC" theatrics.** This is a review task,
  not a reduction task.

## Acceptance criteria

- [ ] `.agent/scratchpad.md` has 8-14 review areas, all marked `[x]`
- [ ] Every area has a detail file under
      `.agents/research/codebase-review-2026-04-16/` with at least the
      "Scope reviewed" and "Findings" (or "No issues found") sections
- [ ] `00-summary.md` exists with executive summary, severity rollup,
      top findings, areas table, category heatmap, needs-verification
      queue, out-of-scope list, and recommended next steps
- [ ] Every finding in every detail file has severity, category,
      `file:line`, and confidence
- [ ] No tracked files outside `.agent/` and
      `.agents/research/codebase-review-2026-04-16/` have been modified
      (verify with `git status` — working tree should be clean for
      everything else)
- [ ] No git commits were created during the loop
      (verify with `git log origin/main..HEAD` or equivalent — should
      show no new commits)

## Output signal

When the summary is written and all acceptance criteria pass,
emit `LOOP_COMPLETE`.
