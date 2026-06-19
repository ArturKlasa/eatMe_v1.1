# Phase 1: Assessment & Findings Register - Context

**Gathered:** 2026-06-18
**Status:** Ready for planning

<domain>
## Phase Boundary

Verify every finding in `.planning/codebase/CONCERNS.md` against current code + live prod state, assign each a verdict (confirmed / stale / already-resolved / out-of-scope), and resolve the three live-state unknowns (RLS status, pgvector version, feed-cache webhook event coverage) that gate Phases 3, 6, and 7.

**This phase produces a register (a document) + a read-only SQL probe script — NOT code changes.** Actually fixing any finding stays in Phases 2–10. The one mutation this phase makes is editing `ROADMAP.md` / `REQUIREMENTS.md` to reflect verdict-driven scope changes (user-gated, see D-11/D-12).

</domain>

<decisions>
## Implementation Decisions

### Register format & home
- **D-01:** The findings register lives at `.planning/codebase/FINDINGS.md` — co-located with `CONCERNS.md` as its verdict layer. Stable path that persists across the whole milestone (NOT inside the Phase-1 dir, so it survives milestone archival) and is the canonical_ref every later phase points to.
- **D-02:** Structure is **summary table + per-finding detail sections**. A scannable master table at top (one row per finding: `ID | area | verdict | gated phase | scope impact`) plus one detail section per finding carrying the evidence (file:line citations, query output, reasoning).
- **D-03:** Each finding gets a stable register ID. Map every entry back to its CONCERNS.md finding and, where applicable, its requirement ID (ASSESS/SEC/CLEAN/DEBT/PERF/RFCT) and gated phase. (Exact ID scheme = Claude's discretion — e.g. `F-01…F-NN`.)

### Coverage scope
- **D-04:** The register covers **every CONCERNS.md finding** (~26), not just the 21 requirement-mapped ones. Rationale: the Core Value requires each documented concern to be "fixed OR have a verified, deliberate disposition."
- **D-05:** In-scope findings (the 21 reqs) get full assessment with evidence. Pre-resolved web-portal findings (broken dish form, onboarding-only, two-admin-codepaths, broken dish create/edit) → verdict **already-resolved** ("`apps/web-portal` deleted 2026-06-18; deletion uncommitted — Phase 5 verifies cleanliness"). Out-of-scope items (test-coverage gaps, `web-portal-v2` dormant, scaling-limit/v2 perf notes) → verdict **out-of-scope** with the reason from REQUIREMENTS.md Out-of-Scope / v2.
- **D-06:** Verdict vocabulary: `confirmed` / `stale` / `already-resolved` / `out-of-scope`. (Claude may add a short modifier like "confirmed — partially mitigated" where evidence warrants.)

### Net-new findings
- **D-07:** If assessment surfaces an issue NOT in CONCERNS.md, record it in a clearly-flagged **"Net-new findings"** section of the register, but route it to backlog / a future insert-phase **decision** — do NOT silently grow this milestone's scope. The user decides disposition later.

### Prod live-state workflow (ASSESS-02/03)
- **D-08:** All operator-run prod queries are packaged as **one consolidated read-only SQL script**, committed as a Phase-1 artifact (e.g. `infra/scripts/assess-live-state.sql`). It covers, in one pass: per-table `rowsecurity` (`pg_tables`) + all `pg_policies` for the behavioral tables, the `pgvector` `extversion`, and a deployed-trigger dump (`information_schema.triggers` / `pg_trigger`) to confirm the feed-cache webhook event coverage against migrations. Operator runs it once in the Supabase SQL editor and pastes the full output back. **Read-only only** — no writes (stage-don't-apply, no local psql).
- **D-09:** Webhook event coverage is assessed **code-first** (the `net.http` triggers live in migrations — 132, 138_REVERSE, 165, 166, etc.); the operator's `information_schema.triggers` dump confirms the *deployed* state matches (prod can drift from migration files).
- **D-10:** **Partial-complete + execution checkpoint.** Execution finalizes all code-assessable verdicts immediately so Phases 2/4/5 (which don't need live-state) can proceed; the live-state sections that gate Phases 3 (RLS), 6 (schema/`pg_depend`), and 7 (pgvector/webhook) are filled at an execution checkpoint once the operator pastes results. The phase is not fully "done" until those sections are populated.

### Scope-adjustment propagation
- **D-11:** Each finding's register entry carries an explicit **"scope impact"** (e.g. "SEC-02: `favorites` already RLS-protected → Phase 3 skips this table"). At Phase-1 close the user **reviews** the proposed scope changes, then Phase 1 applies the **approved** edits to `ROADMAP.md` + `REQUIREMENTS.md` traceability so later phases read already-trimmed scope. One gated review — never auto-edit without sign-off.
- **D-12:** If a verdict fully resolves a phase (e.g. all behavioral tables already have RLS → Phase 3 empties), **annotate it "descoped per FINDINGS — <reason>"** in ROADMAP.md and mark the requirement satisfied in REQUIREMENTS.md. **Do NOT renumber** — preserve stable phase numbers and the audit trail.

### Claude's Discretion
- Register ID scheme and exact column ordering of the summary table.
- Per-finding evidence depth (which warrant a `git grep` + file:line vs a one-line confirmation) — but the dated `CONCERNS.md` (2026-06-19) must itself be re-checked against current code, since some findings (web-portal) are already overtaken by events.
- Exact SQL in `assess-live-state.sql` (table list, query shape) — derived from the behavioral-table list in CONCERNS.md "RLS Audit Gap" finding.
- Phrasing of the operator-checkpoint prompt.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Source of findings (the input being assessed)
- `.planning/codebase/CONCERNS.md` — the full concerns audit (2026-06-19); every register entry maps back to a finding here.

### Codebase maps (grounding for verdicts)
- `.planning/codebase/ARCHITECTURE.md` — package relationships / data flow
- `.planning/codebase/STACK.md` — tech + dependency versions (edge deps, pgvector context)
- `.planning/codebase/STRUCTURE.md` — file/dir layout (verify file:line citations)
- `.planning/codebase/INTEGRATIONS.md` — edge functions, webhooks, external services
- `.planning/codebase/CONVENTIONS.md` — patterns/idioms
- `.planning/codebase/TESTING.md` — current test posture (for the out-of-scope test-gap findings)

### Milestone scope (what the register adjusts)
- `.planning/REQUIREMENTS.md` — ASSESS-01/02/03, the 21 v1 reqs, Out-of-Scope + v2 lists, traceability table (Phase 1 edits this per D-11/D-12)
- `.planning/ROADMAP.md` — phase scope + success criteria (Phase 1 annotates per D-11/D-12)
- `.planning/PROJECT.md` — constraints (stage-don't-apply, no local psql, RLS rules), Key Decisions, the web-portal pre-resolution input

### Per-finding source docs (cite in the relevant detail sections)
- `infra/supabase/migrations/151_retire_ingredient_triggers.sql` — Phase B migration (already written) — DEBT-01
- `docs/plans/ingredient-pipeline-phase-b-trigger-retirement.md` — Phase B gating conditions — DEBT-01
- `docs/plans/ingredient-pipeline-phase-c-schema-retirement.md` — Phase C schema-drop plan — DEBT-02
- `docs/plans/dish-model-rewrite-phase-7-cleanup.md` — DishKind shim removal — DEBT-03
- `docs/plans/abandon-allergens-dietary.md` — context for migrations 155/156 (dropped allergen/dietary columns) — ingredient-pipeline findings
- `infra/supabase/functions/feed/index.ts` (CORS ~line 20) — SEC-01 / PERF-02
- `infra/supabase/functions/enrich-dish/index.ts` (CORS ~line 33; stale header comments ~lines 9, 14–15) — SEC-01 / CLEAN-03
- `infra/supabase/functions/invalidate-cache/index.ts` — PERF-03 (cache invalidation)
- `infra/supabase/migrations/169_generate_candidates_pushdown.sql`, `infra/supabase/migrations/136_hnsw_dishes_embedding.sql` — PERF-01
- `infra/supabase/migrations/database_schema.sql` — baseline RLS source for ASSESS-02
- `packages/database/src/types.ts` — DEBT-04 (stale generated types)
- `packages/shared/src/types/restaurant.ts`, `packages/shared/src/constants/menu.ts` — DishKind / DISH_KIND_META shims (DEBT-03)
- `apps/web-portal-v2/src/components/menu/KindSelector.tsx` — last DishKind importer (DEBT-03)

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- **`CONCERNS.md`** is the structured input — the register is a verdict overlay on it, not a from-scratch audit. Keep finding titles aligned so the two cross-reference cleanly.
- **`.planning/codebase/*` maps** already enumerate affected files and line numbers for most findings — use them to seed evidence rather than re-deriving.
- **`infra/scripts/`** is the established home for operator-run prod scripts (service-role, dry-run discipline) — `assess-live-state.sql` fits here as a read-only sibling.

### Established Patterns
- **Stage-don't-apply / operator-runs-prod**: no local psql; all live-prod access is read-only SQL the operator executes and pastes back. The assessment workflow inherits this verbatim.
- **Migrations as source of truth, prod as drift check**: webhook triggers and RLS may exist in migrations OR have been changed via the Supabase dashboard — verdicts must reconcile both.

### Integration Points
- **`ROADMAP.md` + `REQUIREMENTS.md`** — Phase 1's only write targets (verdict-driven scope edits, user-gated).
- **Phases 3 / 6 / 7** consume the live-state sections; Phases 2 / 4 / 5 only need the code-assessable verdicts (drives the partial-complete + checkpoint gating in D-10).
- **`STATE.md` Blockers/Concerns** already lists the three live-state unknowns — the register resolves them.

</code_context>

<specifics>
## Specific Ideas

- The register is the verdict layer ON TOP of CONCERNS.md — not a replacement. A reader should be able to go finding-by-finding from CONCERNS.md into FINDINGS.md.
- "Deliberate disposition" is the bar: even an out-of-scope or pre-resolved finding must have a one-line recorded reason, so a future audit never re-opens a settled item.
- The operator is present and runs prod SQL — design the checkpoint as a single clean paste-back, not a drip of separate queries.

</specifics>

<deferred>
## Deferred Ideas

- **Automated RLS regression test suite** (anon-deny pattern) — already tracked as `QUAL-V2-01`; out of scope this cycle (minimal-test decision).
- **Deno std → JSR full modernization** beyond the Phase-4 import swap — `QUAL-V2-02`.
- **Geo-aware ANN rebuild** (per-restaurant centroid / restaurant-level vector search) — `PERF-V2-01`, the durable fix beyond Phase-7 tiered radius.
- **Full SQL-side ranking pushdown** — `PERF-V2-02`.
- Any **net-new finding** surfaced during assessment → flagged in FINDINGS.md and routed to a backlog / insert-phase decision (per D-07), not actioned this milestone.

### Reviewed Todos (not folded)
None — no pending todos matched this phase.

</deferred>

---

*Phase: 01-assessment-findings-register*
*Context gathered: 2026-06-18*
