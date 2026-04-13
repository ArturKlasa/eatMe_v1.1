# Research + Execute: Lines-of-Code Reduction

## Goal

Investigate whether the EatMe codebase can be made smaller **without removing
any functionality**, and if so, apply the reductions. This task has a research
phase followed by an execution phase — both driven by Ralph.

Output lives under `.agents/research/loc-reduction-2026-04-13/` plus the actual
code edits in the tracked source tree.

## What counts as a valid reduction

All of these are acceptable as long as behaviour is preserved:

1. **Dead code** — unused exports, unreferenced functions/components/types,
   unreachable branches, commented-out blocks.
2. **Duplication** — identical or near-identical blocks that can collapse to a
   shared helper already in `packages/shared`, `@eatme/tokens`, or a local util.
3. **Over-abstraction** — one-call-site wrappers, pass-through components,
   single-use interfaces that only rename an existing type.
4. **Verbose syntax** — explicit returns around single expressions, redundant
   `as` casts, needless `React.FC<{}>` generics, unnecessary intermediate
   variables, manual loops that are a single `.map`/`.filter`.
5. **Redundant types** — duplicate Zod/TS definitions that exist in
   `@eatme/shared` already.
6. **Comment bloat** — multi-paragraph JSDoc on obvious code, stale TODO
   comments that reference shipped work, section banners that aren't load-bearing.

## What is NOT a valid reduction

- Removing error handling at system boundaries (API routes, external calls)
- Inlining code that exists for RLS, security, or audit reasons
- Collapsing Supabase SQL migrations
- Deleting tests to reduce test LOC
- Minifying — we count human-readable lines, not compressed ones
- Anything that changes observable behaviour, even subtly

If in doubt, leave it and note it in `not-recommended.md`.

## Scope

**In scope (in priority order):**
- `apps/web-portal/` — Next.js app (largest surface, most TS churn)
- `apps/mobile/` — Expo app
- `packages/shared/`, `packages/database/`, `packages/tokens/` — watch for
  duplication *between* these and consumers
- Root config files if clearly redundant

**Out of scope:**
- `infra/supabase/migrations/` — migrations are append-only history
- Generated files (`*.generated.ts`, Supabase types)
- `node_modules/`, lockfiles, build output
- Third-party vendored code

## Hard constraints

- **Functionality preservation is non-negotiable.** After every implementer
  iteration: `turbo check-types` and `turbo lint` must pass. If a test suite
  covers the touched area (`turbo test` for web-portal), run it.
- **Small, reversible commits.** One topic per commit, with a message like
  `refactor(loc): <topic> — removes N lines`. Never bundle unrelated topics.
- **Cite file:line for every claim** made about the current code.
- **Skip, don't force.** If a topic turns out to not be safely reducible,
  mark it skipped in the scratchpad and move on — do not hack around it.

## Deliverables

1. `.agent/scratchpad.md` — agenda of 6-12 reduction topics, each marked
   `[ ]` (pending), `[x]` (applied), or `[~]` (investigated but skipped).
2. `.agents/research/loc-reduction-2026-04-13/<slug>.md` for each topic:
   - Current state (file:line)
   - Proposed reduction
   - Estimated LOC savings
   - Risk assessment (why functionality is preserved)
   - Decision: apply / skip / defer
3. `.agents/research/loc-reduction-2026-04-13/00-summary.md`:
   - Executive summary
   - Table: Topic | Status | LOC removed | Files touched
   - Grand total LOC delta (measured via `git diff --shortstat` on the
     accumulated commits)
   - "Not recommended" section for ideas investigated but rejected
4. Git history: one commit per applied topic on the current branch.

## Acceptance criteria

- [ ] `.agent/scratchpad.md` contains 6-12 topics, each resolved to `[x]` or `[~]`
- [ ] Every topic has a detail file under the research directory
- [ ] `00-summary.md` exists with executive summary, status table, total delta,
      and a "Not recommended" section
- [ ] `turbo check-types` passes
- [ ] `turbo lint` passes
- [ ] `turbo test` passes (web-portal Vitest suite)
- [ ] `git log` shows one focused commit per applied topic
- [ ] Net LOC delta in the summary is negative (i.e. lines actually went down)

## Output signal

When the summary is written and all acceptance criteria pass,
emit `LOOP_COMPLETE`.
