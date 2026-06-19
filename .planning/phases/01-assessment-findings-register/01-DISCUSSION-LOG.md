# Phase 1: Assessment & Findings Register - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-06-18
**Phase:** 1-assessment-findings-register
**Areas discussed:** Register format & home, Coverage scope, Prod live-state workflow, Scope-adjustment propagation

---

## Register format & home

### Where should the findings register live?

| Option | Description | Selected |
|--------|-------------|----------|
| `.planning/codebase/FINDINGS.md` | Co-located with CONCERNS.md as its verdict layer; stable path, persists across milestone | ✓ |
| Phase-1 dir artifact | Standard GSD phase deliverable, but archived at milestone completion | |
| `docs/` in the repo | Repo-proper doc, versioned with code | |

**User's choice:** `.planning/codebase/FINDINGS.md`

### How should the register be structured?

| Option | Description | Selected |
|--------|-------------|----------|
| Summary table + detail sections | Master triage table + one evidence section per finding | ✓ |
| Single master table only | One row per finding, terse evidence cell | |
| Section-per-finding only | Prose per finding, no overview table | |

**User's choice:** Summary table + detail sections

---

## Coverage scope

### Which findings get a register entry?

| Option | Description | Selected |
|--------|-------------|----------|
| Every CONCERNS.md finding | All ~26 get a verdict + disposition; satisfies "deliberate disposition" Core Value | ✓ |
| In-scope findings only | Just the 21 requirement-mapped findings | |

**User's choice:** Every CONCERNS.md finding

### If assessment surfaces a NEW issue not in CONCERNS.md, what happens?

| Option | Description | Selected |
|--------|-------------|----------|
| Record + route, don't expand | Flagged register section, routed to backlog/insert-phase decision | ✓ |
| Assess CONCERNS.md only | Ignore anything new | |
| Fold into scope if cheap | Add small adjacent issues to existing phases | |

**User's choice:** Record + route, don't expand

---

## Prod live-state workflow

**Grounding check:** Confirmed the feed-cache webhook is wired via Postgres `net.http` triggers in migrations (132, 138_REVERSE, 165, 166) — code-readable, but deployed state can drift, so an operator trigger dump confirms it. pgvector version and live RLS state strictly require an operator query.

### How should the operator-run prod queries be packaged?

| Option | Description | Selected |
|--------|-------------|----------|
| One consolidated SQL script | Single read-only script (committed artifact), run once, full paste-back | ✓ |
| Per-finding query snippets | Separate snippets per concern; more round-trips | |

**User's choice:** One consolidated SQL script

### How does the phase handle waiting on those operator results?

| Option | Description | Selected |
|--------|-------------|----------|
| Partial-complete + checkpoint | Code-assessable verdicts finalized now (unblocks 2/4/5); live-state filled at execution checkpoint (gates 3/6/7) | ✓ |
| Hard block | Nothing downstream starts until all live-state recorded | |
| Placeholder, no checkpoint | Ship with PENDING markers, fill anytime | |

**User's choice:** Partial-complete + checkpoint

---

## Scope-adjustment propagation

### When a verdict trims a later phase's scope, how does it propagate?

| Option | Description | Selected |
|--------|-------------|----------|
| Register → user review → Phase 1 edits | Scope-impact recorded, user reviews at close, Phase 1 edits ROADMAP/REQUIREMENTS | ✓ |
| Register-only; later phase self-adjusts | No roadmap edits in Phase 1; planners self-adjust | |
| Phase 1 auto-edits, no gate | Direct rewrite from verdicts, no sign-off | |

**User's choice:** Register → user review → Phase 1 edits

### If a verdict fully resolves a phase, how is it handled?

| Option | Description | Selected |
|--------|-------------|----------|
| Annotate as skipped, keep number | Mark "descoped per FINDINGS", requirement satisfied, no renumber | ✓ |
| Remove + renumber | /gsd-remove-phase, renumber subsequent phases | |
| Keep as no-op verification | Leave phase as thin "verify already-resolved" check | |

**User's choice:** Annotate as skipped, keep number

---

## Claude's Discretion

- Register ID scheme and summary-table column ordering
- Per-finding evidence depth (git grep + file:line vs one-line confirmation)
- Exact SQL in `assess-live-state.sql`
- Operator-checkpoint prompt phrasing

## Deferred Ideas

- QUAL-V2-01 (RLS regression suite), QUAL-V2-02 (Deno→JSR modernization), PERF-V2-01 (geo-aware ANN rebuild), PERF-V2-02 (SQL ranking pushdown)
- Net-new findings → backlog/insert-phase decision (per D-07)
