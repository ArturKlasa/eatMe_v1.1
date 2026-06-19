# Phase 1: Assessment & Findings Register - Research

**Researched:** 2026-06-18
**Domain:** Codebase assessment / verdict-register authoring + a read-only prod-state SQL probe (no code changes)
**Confidence:** HIGH for all code-assessable verdicts (verified by `git grep` against current files); MEDIUM/LOW for the three live-state unknowns (genuinely prod-only, resolved at the operator checkpoint)

## Summary

Phase 1 is a documentation phase, not a code phase. It produces three artifacts: (1) `.planning/codebase/FINDINGS.md` — a verdict overlay on every CONCERNS.md finding; (2) `infra/scripts/assess-live-state.sql` — ONE read-only SQL probe the operator runs once in the Supabase SQL editor and pastes back; (3) user-gated scope edits to `ROADMAP.md` + `REQUIREMENTS.md`. The "research" here is verifying each CONCERNS finding against the *current* repo (the dated 2026-06-19 audit has already drifted) and designing the SQL probe whose shape is derived from code, not guessed.

The single most valuable discovery: **the assessment splits cleanly into two evidence classes.** Most findings are *code-assessable now* — `git grep` against the current tree gives a file:line-backed verdict immediately (these finalize per D-10 so Phases 2/4/5 can proceed). Only three are *prod-only*: live RLS state, pgvector `extversion`, and the deployed feed-cache webhook trigger coverage. Those three cannot be known from the repo because the relevant state lives outside git (Supabase dashboard webhook config, platform-provisioned extension version, and dashboard-toggled RLS). The SQL probe exists precisely to close that gap, and its design is the main technical content of this research.

I verified the load-bearing facts directly. `apps/web-portal` is **already deleted AND committed** (commit `c1a7e3f`), not "uncommitted" as CONTEXT/PROJECT claim — a verdict-affecting correction. The behavioral tables have **zero `ENABLE ROW LEVEL SECURITY` in any migration or in the stale baseline `database_schema.sql`** (confirming ASSESS-02 is a genuine unknown). `dish_analytics` is **dish-keyed, not user-owned** — SEC-02 mislists it. The `invalidate-cache` function's header documents **UPDATE-only** webhook invocation (confirming the PERF-03 INSERT/DELETE gap) and the triggers that invoke it are **not in any migration** (dashboard-configured), which is exactly why a deployed-trigger dump is required.

**Primary recommendation:** Plan the register as a two-pass build — Pass A finalizes all code-assessable verdicts with `git grep` file:line evidence; Pass B holds three named "PENDING — live-state" sections that the execution checkpoint fills from the operator's single SQL paste-back. Author `assess-live-state.sql` as four labeled read-only query blocks (RLS+policies, pgvector version, deployed-trigger dump, owner-column sanity) with a `SET TRANSACTION READ ONLY` guard and explicit "no writes" header.

## User Constraints (from CONTEXT.md)

### Locked Decisions
- **D-01:** Register lives at `.planning/codebase/FINDINGS.md` (co-located with CONCERNS.md, survives milestone archival, canonical_ref for later phases).
- **D-02:** Structure = summary table (one row per finding: `ID | area | verdict | gated phase | scope impact`) + one detail section per finding (file:line citations, query output, reasoning).
- **D-03:** Each finding gets a stable register ID, mapped back to its CONCERNS.md finding and (where applicable) its requirement ID + gated phase. ID scheme = Claude's discretion (e.g. `F-01…F-NN`).
- **D-04:** Cover **every** CONCERNS.md finding (~26), not just the 21 requirement-mapped ones.
- **D-05:** In-scope findings (21 reqs) get full assessment with evidence. Pre-resolved web-portal findings → `already-resolved`. Out-of-scope items (test-coverage gaps, `web-portal-v2` dormant, scaling-limit/v2 perf notes) → `out-of-scope` with the REQUIREMENTS.md reason.
- **D-06:** Verdict vocabulary: `confirmed` / `stale` / `already-resolved` / `out-of-scope` (short modifiers like "confirmed — partially mitigated" allowed).
- **D-07:** Net-new findings → clearly-flagged "Net-new findings" section, routed to backlog / insert-phase **decision** (user decides), NOT silently added to this milestone.
- **D-08:** ALL operator-run prod queries = ONE consolidated read-only SQL script (`infra/scripts/assess-live-state.sql`): per-table `rowsecurity` (`pg_tables`) + all `pg_policies` for behavioral tables, pgvector `extversion`, deployed-trigger dump (`information_schema.triggers` / `pg_trigger`). Run once in Supabase SQL editor, paste full output back. **Read-only only** — no writes, no local psql.
- **D-09:** Webhook event coverage assessed **code-first** (triggers in migrations 132/138_REVERSE/165/166); the operator's trigger dump confirms the *deployed* state matches (prod can drift).
- **D-10:** **Partial-complete + execution checkpoint.** Code-assessable verdicts finalize immediately (unblocks Phases 2/4/5). Live-state sections gating Phases 3 (RLS), 6 (schema/`pg_depend`), 7 (pgvector/webhook) fill at a checkpoint after the operator pastes results. Phase not "done" until those are populated.
- **D-11:** Each entry carries an explicit **"scope impact"**. At phase close the user **reviews** proposed scope changes, then Phase 1 applies the **approved** edits to ROADMAP.md + REQUIREMENTS.md traceability. One gated review — never auto-edit without sign-off.
- **D-12:** If a verdict fully resolves a phase, annotate it "descoped per FINDINGS — <reason>" in ROADMAP.md and mark the requirement satisfied in REQUIREMENTS.md. **Do NOT renumber** — preserve stable phase numbers + audit trail.

### Claude's Discretion
- Register ID scheme and exact column ordering of the summary table.
- Per-finding evidence depth (which warrant `git grep` + file:line vs a one-line confirmation) — but the dated CONCERNS.md (2026-06-19) must itself be re-checked against current code.
- Exact SQL in `assess-live-state.sql` (table list, query shape) — derived from the behavioral-table list in CONCERNS.md "RLS Audit Gap" finding.
- Phrasing of the operator-checkpoint prompt.

### Deferred Ideas (OUT OF SCOPE)
- Automated RLS regression test suite (anon-deny pattern) — `QUAL-V2-01`.
- Deno std → JSR full modernization beyond the Phase-4 import swap — `QUAL-V2-02`.
- Geo-aware ANN rebuild (per-restaurant centroid / restaurant-level vector search) — `PERF-V2-01`.
- Full SQL-side ranking pushdown — `PERF-V2-02`.
- Any net-new finding surfaced during assessment → flagged + routed to backlog/insert-phase decision (D-07), not actioned this milestone.

## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| ASSESS-01 | Every in-scope CONCERNS finding has a verdict in a findings register (confirmed / stale / already-resolved), with evidence | "Evidence-Depth Heuristic" + "Per-Finding Verdict Pre-Assessment" sections below give a verified starting verdict + evidence source for all ~26 findings; the planner turns each into a register row |
| ASSESS-02 | Live RLS state (`rowsecurity` + existing policies) captured for all behavioral tables before any RLS change is authored | "RLS Probe" section: exact `pg_tables` + `pg_policies` query, the verified behavioral-table list, owner-column = `user_id`, and the `dish_analytics`-is-not-user-owned correction |
| ASSESS-03 | Prod pgvector extension version and feed-cache webhook event coverage captured before perf/cache work begins | "pgvector Probe" (`pg_extension`/`pg_available_extensions`, `hnsw.iterative_scan` gate at >= 0.8.0) + "Webhook Coverage Probe" (deployed-trigger dump; code-first finding that invalidate-cache is UPDATE-doc'd and triggers are dashboard-configured) |

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Verdict assignment (code-assessable) | Planning / docs layer (`.planning/codebase/FINDINGS.md`) | — | Pure analysis over the repo; no runtime tier involved |
| Live RLS + policy capture | Database / Storage (prod Postgres via SQL editor) | Planning layer (records output) | RLS state is a DB-resident fact; only the prod catalog knows it |
| pgvector version capture | Database / Storage (platform-provisioned extension) | — | Extension version is Supabase-platform state, not in migrations |
| Feed-cache webhook coverage | Database / Storage (deployed triggers) + Edge (`invalidate-cache` fn) | Migrations (code-first baseline) | Triggers live in the dashboard webhook config; the edge fn is the handler — both must be reconciled |
| Scope propagation (ROADMAP/REQUIREMENTS edits) | Planning / docs layer | — | User-gated doc edits; no code/runtime change |

## Standard Stack

This phase installs **no packages** and writes **no application code**. The "stack" is the set of tools used to produce the two artifacts.

### Core
| Tool | Version | Purpose | Why Standard |
|------|---------|---------|--------------|
| `git grep` | system | File:line evidence for every code-assessable verdict | The repo IS the source of truth being assessed; grep against current HEAD is authoritative `[VERIFIED: used this session]` |
| Postgres system catalogs (`pg_tables`, `pg_policies`, `pg_extension`, `pg_trigger`, `information_schema.triggers`) | PG 15 | Read-only prod-state capture | Standard, side-effect-free introspection; works in the Supabase SQL editor `[CITED: postgresql.org/docs/15/view-pg-policies.html]` |
| Supabase SQL editor | prod | The operator's one-shot read-only run surface | Project constraint: no local psql; operator runs + pastes back `[VERIFIED: PROJECT.md constraints]` |

### Supporting
| Tool | Purpose | When to Use |
|------|---------|-------------|
| `.planning/codebase/*.md` maps | Seed evidence (files/line numbers already enumerated) | Use to ground verdicts instead of re-deriving (per CONTEXT code_context) |
| `docs/plans/*.md` (ingredient-pipeline, dish-model, abandon-allergens) | Per-finding source docs for the debt findings | Cite in the relevant detail sections (DEBT-01..04) |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| One consolidated SQL script (D-08) | Several separate queries the operator runs in sequence | Rejected by D-08/specifics — operator wants ONE clean paste-back, not a drip |
| Local psql introspection | — | Forbidden by PROJECT.md (no local psql; stage-don't-apply) |
| Re-deriving evidence from scratch | Reusing `.planning/codebase/*` maps | Maps already cite files/lines; faster + consistent |

**Installation:** None — no packages installed. The Package Legitimacy Audit is therefore **N/A** for this phase.

## Package Legitimacy Audit

**N/A — this phase installs no external packages.** It produces two text artifacts (a Markdown register and a read-only `.sql` script) and edits two planning docs. No `npm install`, `pip install`, or `cargo add` occurs. No legitimacy gate required.

## Architecture Patterns

### System Architecture Diagram

```
                        ┌─────────────────────────────────────────────┐
   CONCERNS.md (input)  │  PASS A — Code-assessable (finalize now)     │
   ~26 findings ───────▶│  git grep current HEAD → verdict + file:line │
                        │  (confirmed / stale / already-resolved /     │
                        │   out-of-scope) for ~23 findings             │
                        └───────────────┬─────────────────────────────┘
                                        │
                                        ▼
   ┌──────────────────────────────────────────────────────────────────┐
   │  FINDINGS.md  (summary table + per-finding detail sections)        │
   │  Pass-A rows: FINAL.   Pass-B rows: "PENDING — live-state".        │
   └───────────────┬───────────────────────────────────┬───────────────┘
                   │ unblocks Phases 2/4/5 immediately  │
                   ▼                                    ▼
   ┌──────────────────────────┐        ┌──────────────────────────────────┐
   │ assess-live-state.sql    │  run   │  EXECUTION CHECKPOINT (D-10)      │
   │ (4 read-only query blocks)├──once─▶│  operator pastes full SQL output │
   │ READ ONLY guard + header │  prod  │  back → Pass-B sections filled    │
   └──────────────────────────┘        └───────────────┬──────────────────┘
                                                        │ gates Phases 3/6/7
                                                        ▼
                        ┌─────────────────────────────────────────────┐
                        │  Scope propagation (D-11/D-12, USER-GATED):  │
                        │  proposed edits → user review → apply to     │
                        │  ROADMAP.md + REQUIREMENTS.md (no renumber)  │
                        └─────────────────────────────────────────────┘
```

A reader traces: CONCERNS finding → Pass-A grep verdict (or Pass-B prod query) → register row with scope impact → (at close) user-approved ROADMAP/REQUIREMENTS edit.

### Recommended Artifact Structure
```
.planning/codebase/
└── FINDINGS.md          # verdict overlay on CONCERNS.md (D-01) — persistent across milestone
infra/scripts/
└── assess-live-state.sql # ONE read-only probe (D-08) — sibling to the .ts prod scripts
.planning/
├── ROADMAP.md           # annotated at phase close (D-11/D-12, user-gated)
└── REQUIREMENTS.md      # traceability + status edits at phase close (user-gated)
```

### Pattern 1: Two-Pass Register (code-now / prod-later)
**What:** Build every code-assessable verdict to FINAL state in Pass A; leave exactly three named sections in "PENDING — live-state" awaiting the operator paste-back.
**When to use:** Whenever a finding's verdict depends on prod state not in git (RLS, extension version, dashboard webhooks).
**Why:** Implements D-10 partial-complete — Phases 2/4/5 don't wait on the operator; only 3/6/7 gate on Pass B.

### Pattern 2: Read-Only SQL Probe with Hard Guard
**What:** A single `.sql` file: a comment header stating "READ ONLY — paste full output back", a `SET TRANSACTION READ ONLY;` (or run-in-one-transaction note), then 4 labeled `SELECT`-only blocks each preceded by a `\echo`-style comment label.
**When to use:** Any operator-run prod introspection under stage-don't-apply.
**Example:**
```sql
-- assess-live-state.sql — READ ONLY. Run once in the Supabase SQL editor.
-- Paste the FULL output of all four blocks back. No writes. No DDL.
BEGIN;
SET TRANSACTION READ ONLY;   -- hard guard: any accidental write aborts

-- [BLOCK 1] RLS + policies for behavioral tables
SELECT t.tablename,
       t.rowsecurity                       AS rls_enabled,
       COALESCE(p.policyname, '(none)')    AS policy,
       p.cmd, p.permissive, p.roles, p.qual, p.with_check
FROM   pg_tables t
LEFT   JOIN pg_policies p
       ON p.schemaname = t.schemaname AND p.tablename = t.tablename
WHERE  t.schemaname = 'public'
  AND  t.tablename IN (
        'favorites','dish_opinions','user_dish_interactions',
        'user_behavior_profiles','dish_analytics','user_points',
        'user_sessions','user_visits','session_views','dish_photos',
        'restaurant_experience_responses'
        -- add eat_together_* tables verified to exist
       )
ORDER BY t.tablename, policy;

-- [BLOCK 2] pgvector version (gates hnsw.iterative_scan in Phase 7)
SELECT extname, extversion FROM pg_extension WHERE extname = 'vector';
SELECT name, default_version, installed_version
FROM   pg_available_extensions WHERE name = 'vector';

-- [BLOCK 3] Deployed triggers on feed-affecting tables (webhook coverage, code-first confirm)
SELECT event_object_table AS table_name,
       trigger_name, event_manipulation AS event,  -- INSERT/UPDATE/DELETE
       action_timing, action_statement
FROM   information_schema.triggers
WHERE  event_object_schema = 'public'
  AND  event_object_table IN ('restaurants','menus','dishes')
ORDER BY table_name, trigger_name, event;

-- [BLOCK 4] Owner-column sanity (confirm user_id exists where Phase 3 will add policies)
SELECT table_name, column_name, data_type
FROM   information_schema.columns
WHERE  table_schema = 'public'
  AND  column_name IN ('user_id','owner_id')
  AND  table_name IN (
        'favorites','dish_opinions','user_dish_interactions',
        'user_behavior_profiles','user_visits','session_views',
        'user_points','user_sessions','dish_photos',
        'restaurant_experience_responses')
ORDER BY table_name;
ROLLBACK;  -- read-only; nothing to commit
```
`[CITED: postgresql.org/docs/15/view-pg-policies.html — pg_policies columns]` `[VERIFIED: behavioral-table list from database_schema.sql + CONCERNS RLS Audit Gap]`

### Pattern 3: Verdict + Scope-Impact Row
**What:** Every summary-table row carries an explicit scope-impact cell (D-11): e.g. "if `favorites` already RLS-protected → Phase 3 skips it."
**Why:** Makes the ROADMAP/REQUIREMENTS edit mechanical and reviewable at the gated close.

### Anti-Patterns to Avoid
- **Trusting the dated CONCERNS.md verbatim:** It is 2026-06-19 and already drifted (web-portal is gone+committed; line numbers shifted — enrich-dish CORS is line 31 not 33). Re-grep current HEAD before writing any verdict.
- **A namespace flush-all assumption for Phase 7:** `invalidate-cache` already does `feed:v2:*` flush-all on every change — record this as-is; do NOT pre-judge it against ROADMAP Phase-7 SC#4's "never flush-all" goal (that's a Phase-7 design call; flag the tension as scope-impact, not a verdict).
- **Including `dish_analytics` as a user-owned RLS target:** It is dish-keyed (no `user_id`). Treat as a separate scope-impact note for Phase 3.
- **Renumbering phases on descope:** D-12 forbids it — annotate "descoped per FINDINGS" instead.
- **Writes in the SQL probe:** D-08 is read-only-only; no `UPDATE`/`INSERT`/DDL even "to test."

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Capturing RLS state | A custom per-table query loop | `pg_tables.rowsecurity` JOIN `pg_policies` (Block 1) | One catalog query returns enable-flag + every policy with `qual`/`with_check`/`cmd`/`roles` |
| pgvector version | Parsing migration files | `pg_extension.extversion` (Block 2) | Migrations don't `CREATE EXTENSION vector` (platform-provisioned) — only the catalog knows |
| Deployed webhook coverage | Inferring from migration text alone | `information_schema.triggers` dump (Block 3) | Webhooks are dashboard-configured, not in migrations — prod can drift; code-first + dump reconciles |
| Read-only enforcement | Trusting the operator to "just not write" | `SET TRANSACTION READ ONLY` guard | Aborts any accidental write at the DB level |

**Key insight:** Every prod fact this phase needs has a single, standard, side-effect-free catalog query. The work is *assembling and labeling* them into one paste-back script, not inventing introspection.

## Runtime State Inventory

> This phase makes **no runtime changes** — it is assessment + docs. However, the *findings it assesses* concern runtime state, so the relevant inventory is "what state must the probe capture that the repo cannot tell us."

| Category | Items Found | Action Required |
|----------|-------------|------------------|
| Stored data | Behavioral tables (`favorites`, `dish_opinions`, `user_dish_interactions`, `user_behavior_profiles`, `user_visits`, `session_views`, `user_points`, `user_sessions`, `dish_photos`, `restaurant_experience_responses`) — RLS enable-state unknown from repo | Capture via SQL Block 1 (read-only); record per-table verdict at checkpoint |
| Live service config | Supabase **DB webhooks** invoking `invalidate-cache` — configured in the dashboard, NOT in any migration (`git grep net.http` shows none for invalidate-cache); coverage = INSERT/UPDATE/DELETE unknown | Capture deployed triggers via SQL Block 3; reconcile against `invalidate-cache` header (documents UPDATE-only) |
| OS-registered state | None — no OS-level registrations involved in an assessment phase | None — verified (this phase touches only `.md` + `.sql` files) |
| Secrets/env vars | None changed. (Edge fns read `UPSTASH_*`, `SUPABASE_*` — relevant only to the findings being assessed, not to this phase's outputs) | None — read-only awareness only |
| Build artifacts | `packages/database/src/types.ts` (3226 lines) may be stale vs schema (DEBT-04) — but regen is Phase 6, not Phase 1 | None this phase — record verdict only (assess staleness, don't regenerate) |
| Platform extension state | pgvector `extversion` — provisioned by Supabase platform, not in migrations (no `CREATE EXTENSION vector` found) | Capture via SQL Block 2; gate `hnsw.iterative_scan` (Phase 7) |

## Common Pitfalls

### Pitfall 1: Treating CONCERNS.md (2026-06-19) as current
**What goes wrong:** Writing verdicts off the audit text; some are already overtaken by events.
**Why it happens:** The audit is recent enough to look trustworthy.
**How to avoid:** Re-grep current HEAD for every finding. **Verified drifts this session:** `apps/web-portal` deleted AND committed in `c1a7e3f` (CONCERNS/CONTEXT/PROJECT all say "uncommitted" — wrong); `enrich-dish` CORS is line **31** not 33; the three web-portal findings (broken dish form, onboarding-only, two-admin-codepaths) are `already-resolved`.
**Warning signs:** A verdict that cites a CONCERNS line number without re-confirming it against the file.

### Pitfall 2: Mislabeling `dish_analytics` as user-owned
**What goes wrong:** SEC-02 / the RLS gap finding lists `dish_analytics` among user-owned tables; planning a per-user owner policy for it.
**Why it happens:** CONCERNS groups it with behavioral tables.
**How to avoid:** Verified — `dish_analytics` PK is `dish_id`, FK to `dishes`, **no `user_id` column**. It is a public aggregate. Record as a distinct scope-impact: Phase 3 should NOT add an owner policy here (service-role-only or public-read instead).
**Warning signs:** A proposed owner policy referencing `user_id` on `dish_analytics`.

### Pitfall 3: Assuming webhook triggers live in migrations
**What goes wrong:** Asserting INSERT/DELETE coverage from migration grep alone.
**Why it happens:** Other triggers (132/165/166) ARE in migrations, so it's natural to assume invalidate-cache's are too.
**How to avoid:** Verified — `git grep` for invalidate/cache triggers in migrations returns **nothing**; the `invalidate-cache` header says "Invoked by Supabase webhooks on **UPDATE** events." These are dashboard webhooks. The deployed-trigger dump (Block 3) is the only authority. Assess code-first (the fn handles all 3 tables internally) but mark coverage PENDING until the dump confirms which events are wired.
**Warning signs:** A confident INSERT/DELETE-coverage verdict with no Block-3 output cited.

### Pitfall 4: Over-citing evidence on settled findings
**What goes wrong:** Spending grep+file:line effort on out-of-scope or pre-resolved items.
**Why it happens:** Uniform treatment feels rigorous.
**How to avoid:** Apply the evidence-depth heuristic (below): full file:line for in-scope confirmed findings; one-line disposition for out-of-scope/already-resolved.

### Pitfall 5: Auto-editing ROADMAP/REQUIREMENTS
**What goes wrong:** Applying scope changes before the user reviews.
**Why it happens:** The edits feel like a natural continuation.
**How to avoid:** D-11 mandates ONE gated review at phase close. Propose edits in the register's scope-impact cells; apply only after sign-off; never renumber (D-12).

## Code Examples

### Evidence-Depth Heuristic (which findings get file:line vs one-line)

| Finding class | Evidence depth | Verified starting point (this session) |
|---------------|----------------|----------------------------------------|
| In-scope, code-confirmable | `git grep` + file:line | CORS: `feed/index.ts:20`, `enrich-dish/index.ts:31`, `invalidate-cache/index.ts:20` all `'*'` — **confirmed** |
| In-scope, prod-only | PENDING + Block ref | RLS (Block 1), pgvector (Block 2), webhook (Block 3) |
| Pre-resolved (web-portal) | One-line + commit ref | `apps/web-portal` gone; deleted+committed `c1a7e3f` → **already-resolved** |
| Out-of-scope | One-line + REQUIREMENTS reason | test-gaps, `web-portal-v2` dormant, scaling-limit/v2 perf notes → **out-of-scope** |

### Per-Finding Verdict Pre-Assessment (verified seeds for the planner)

```
DEBT-01 ingredient triggers   → migration 151_retire_ingredient_triggers.sql EXISTS (authored, not yet dropped in prod) → confirmed; Phase 6 work stands
DEBT-02 orphaned tables       → tables still in database_schema.sql; RLS-enabled in migrations → confirmed
DEBT-03 DishKind shims        → last importer apps/web-portal-v2/.../KindSelector.tsx → confirmed (web-portal gone, v2 remains)
DEBT-04 stale types.ts        → 3226 lines, regen is Phase 6 → confirmed (assess only)
DEBT-05 deps                  → VERIFIED mix: deno.land/std@0.168.0 everywhere; @supabase/supabase-js@2 (unpinned) AND @2.39.3 (pinned) coexist; @upstash/redis@1.38.0 AND @latest coexist (invalidate-cache uses @latest) → confirmed, with the unpinned-vs-pinned nuance
SEC-01 CORS wildcard          → all three fns line-confirmed → confirmed
SEC-02 RLS gap                → ZERO ENABLE RLS for behavioral tables in any migration or baseline dump → confirmed-as-gap; PER-TABLE verdict PENDING (Block 1). dish_analytics is NOT user-owned (scope-impact)
SEC-03 script guard           → infra/scripts/*.ts (replay-menu-scan-ab, apply-phase6-flag-fixes, etc.) hit prod service-role, manual --dry-run → confirmed
CLEAN-01 dead view-mode       → viewModeStore/ViewModeToggle/BasicMapScreen branch → confirmed (assess; remove in Phase 5)
CLEAN-02 web-portal cleanup   → web-portal deleted+committed BUT residual refs remain: CLAUDE.md(5), agent_docs/architecture.md(4), .github/copilot-instructions.md(20), INTEGRATION_COMPLETE_SUMMARY.md(7) → confirmed (cleanup still needed in Phase 5)
CLEAN-03 enrich-dish comments → header lines 8-21 reference ingredient/parent-dish pipeline → confirmed
PERF-01 candidates radius     → migration 169 pushdown EXISTS; hnsw.iterative_scan gating PENDING (Block 2) → confirmed; perf-detail PENDING
PERF-02 stage-2 payload       → feed/index.ts JS ranking → confirmed (assess)
PERF-03 cache coverage        → invalidate-cache doc'd UPDATE-only; INSERT/DELETE coverage PENDING (Block 3); already flush-alls feed:v2:* (tension w/ Phase7 SC#4 — flag as scope-impact, not verdict)
web-portal findings (x3-4)    → apps/web-portal absent + committed → already-resolved
web-portal-v2 dormant         → exists, on-ice (memory: do NOT delete) → out-of-scope
Map view-mode bug             → same as CLEAN-01 → confirmed
Test-coverage gaps (x3)       → out-of-scope (minimal-tests decision, REQUIREMENTS Out-of-Scope)
Fragile big files (x4)        → map to RFCT-01..04 (Phases 8/9/10) → confirmed (assess only)
Scaling limits (x2)           → v2 (PERF-V2-01) → out-of-scope
Deno std / supabase-js deps   → fold into DEBT-05 → confirmed
```
`[VERIFIED: git grep / file inspection this session]`

## State of the Art

| Old Approach (CONCERNS.md said) | Current Approach (verified now) | When Changed | Impact on verdict |
|---------------------------------|----------------------------------|--------------|-------------------|
| "web-portal deletion uncommitted" | Deleted AND committed (`c1a7e3f`) | 2026-06-18 | already-resolved is solid; Phase 5 = residual-doc cleanup only |
| enrich-dish CORS at line 33 | Line 31 | line drift | Cite current line |
| `dish_analytics` among user-owned tables | dish-keyed, no `user_id` | always | Exclude from owner-policy plan |
| invalidate-cache triggers "in migrations 132/138/165/166" | Those are embed/enrich triggers; invalidate-cache is dashboard-webhook'd (no migration) | — | Webhook coverage = Block-3-only authority |

**Deprecated/outdated:**
- The 2026-06-19 CONCERNS.md line numbers and the "uncommitted" web-portal claim — superseded by current HEAD.

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | EatMe prod runs pgvector and `hnsw.iterative_scan` needs version >= 0.8.0 | pgvector Probe | LOW — Block 2 returns the exact version; the >=0.8.0 threshold is the documented one but the actual gate is decided in Phase 7 from the captured value `[ASSUMED]` |
| A2 | The behavioral-table list (Block 1/4) is complete; `eat_together_*` tables exist and are user-owned | RLS Probe | MEDIUM — derived from CONCERNS + database_schema.sql; the probe should also run a catch-all "any public table with a `user_id` column and `rowsecurity=false`" query to avoid missing one. Recommend the planner add that safety query `[ASSUMED]` |
| A3 | Owner column is uniformly `user_id` for behavioral tables | RLS Probe | LOW — verified `user_id uuid NOT NULL FK auth.users` for the sampled tables; Block 4 confirms the rest `[VERIFIED: database_schema.sql]` (listed as assumption only for tables not individually sampled) |
| A4 | Postgres major version is 15 (affects catalog column availability) | SQL Probe | LOW — PROJECT.md + CLAUDE.md state PG15; `pg_policies` columns identical across 12-18 `[VERIFIED: CLAUDE.md]` |

**Note:** A2's catch-all safety query is a concrete recommendation — add to Block 1: `SELECT tablename, rowsecurity FROM pg_tables WHERE schemaname='public' AND rowsecurity=false ORDER BY tablename;` so no unprotected table is missed.

## Open Questions

1. **Exact pgvector version in prod**
   - What we know: No `CREATE EXTENSION vector` in migrations (platform-provisioned); HNSW index exists (migration 136).
   - What's unclear: The `extversion` value, which gates `hnsw.iterative_scan` for Phase 7.
   - Recommendation: Block 2 captures it at the checkpoint; Phase 7 decides applicability from the value.

2. **Deployed INSERT/UPDATE/DELETE webhook coverage**
   - What we know: `invalidate-cache` handles all 3 tables internally but its header documents UPDATE-only invocation; no migration wires the triggers.
   - What's unclear: Which events are actually wired in the dashboard for `restaurants`/`menus`/`dishes`.
   - Recommendation: Block 3 dump is authoritative; mark PERF-03 detail PENDING until pasted.

3. **Complete behavioral-table set**
   - What we know: CONCERNS lists ~11 + `eat_together_*`.
   - What's unclear: Whether any other `public` table has a `user_id` and `rowsecurity=false`.
   - Recommendation: Add the catch-all query (A2 note) so the register can't miss a table.

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| `git grep` | All code-assessable verdicts (Pass A) | ✓ | system git | — |
| Supabase SQL editor (operator) | Live-state Pass B | ✓ (operator-run) | prod | None — no local psql by constraint; this is the only path |
| Local psql | — | ✗ (forbidden by PROJECT.md) | — | Operator runs the SQL script and pastes back (D-08) |

**Missing dependencies with no fallback:** None — the operator-run SQL editor is the designed path, not a gap.
**Missing dependencies with fallback:** Local psql is intentionally absent; the operator paste-back workflow is the fallback by design.

## Validation Architecture

> nyquist_validation is enabled (config.json `workflow.nyquist_validation: true`). This phase produces documents + a SQL script, not application code — so validation is *completeness and safety checking of artifacts*, not a unit-test suite.

### "Test" Framework
| Property | Value |
|----------|-------|
| Framework | None applicable (no app code changes). Validation = artifact-completeness checks + SQL static safety review. The repo's app-level test runner (Vitest in web-portal; `deno test --node-modules-dir=none -A` for edge fns) is NOT exercised by this phase. |
| Config file | none — see Wave 0 |
| Quick run command | `bash -n`-style review of the `.sql` (Postgres has no `-n`; use the read-only-transaction guard + manual SELECT-only grep instead) |
| Full suite command | N/A — completeness checklist below is the gate |

### Phase Requirements → Validation Map
| Req ID | Behavior to validate | Validation type | Automated/Manual check | Exists? |
|--------|----------------------|-----------------|------------------------|---------|
| ASSESS-01 | Every CONCERNS finding has a verdict + evidence | completeness | `git grep -c '^###'`-style count: FINDINGS detail-section count >= CONCERNS finding count (~26); every summary row has non-empty verdict + evidence cell | ❌ Wave 0 (checklist) |
| ASSESS-01 | No code-assessable verdict cites a stale line number | correctness | Spot-check each cited file:line resolves on current HEAD (`git grep -n` the cited token) | ❌ Wave 0 |
| ASSESS-02 | RLS state captured for all behavioral tables, each labeled by caller | completeness | Block 1 output present for every table in the verified list + the catch-all query returned; each table has a mobile-direct vs service-role-only label | ❌ Wave 0 (checkpoint-gated) |
| ASSESS-03 | pgvector version + webhook coverage captured | completeness | Block 2 + Block 3 output present and transcribed into the register's PENDING sections | ❌ Wave 0 (checkpoint-gated) |
| D-08 safety | SQL script is read-only and syntactically sound | static safety | grep the `.sql` for `INSERT|UPDATE|DELETE|ALTER|DROP|CREATE|TRUNCATE` → must be zero outside comments; `SET TRANSACTION READ ONLY` present; `ROLLBACK`/no `COMMIT` | ❌ Wave 0 |
| D-11/D-12 | Scope edits applied only after user review; no renumber | process gate | ROADMAP phase numbers unchanged pre/post (diff shows annotations only); REQUIREMENTS status edits match approved verdicts | ❌ Wave 0 |

### Reconciliation check (code-first vs deployed)
- For the webhook finding: the register must show BOTH the code-first assessment (invalidate-cache handles 3 tables; header says UPDATE-only) AND the Block-3 deployed dump, and explicitly state whether they agree or drift. A verdict with only one side is incomplete.

### Sampling Rate
- **Per artifact (register):** completeness checklist (every finding row filled; every cited line resolves).
- **Per artifact (SQL):** the write-keyword grep + read-only-guard check before handing to the operator.
- **Phase gate:** all Pass-A rows FINAL; all three Pass-B sections populated from the paste-back; user-approved scope edits applied without renumber.

### Wave 0 Gaps
- [ ] A FINDINGS completeness checklist (finding count parity + filled-cell check) — no such checker exists; create as a manual review step or a tiny grep script.
- [ ] A SQL read-only static check (write-keyword grep + guard presence) — create as a one-line grep gate before the operator runs it.
- [ ] Framework install: none required.

*(No application test infrastructure is added or needed — this is a docs+SQL phase, consistent with the project's minimal-tests decision.)*

## Security Domain

> `security_enforcement` is not set to false anywhere in config.json, so it is treated as enabled. This phase writes no code and changes no security posture — it *assesses* security findings. The controls below describe the safety of the phase's own artifacts.

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | no | No auth code touched (the findings concern it; the phase does not) |
| V3 Session Management | no | — |
| V4 Access Control | indirectly | This phase *captures* RLS state (Block 1) so Phase 3 can enforce access control; it enforces nothing itself |
| V5 Input Validation | no | No user input handled |
| V6 Cryptography | no | No crypto |
| V12/V13 (Files/API) | yes (artifact safety) | The `.sql` artifact must be read-only — `SET TRANSACTION READ ONLY` + zero write keywords; the operator runs it against prod |

### Known Threat Patterns for this phase's artifacts

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Accidental prod write via the probe script | Tampering | `SET TRANSACTION READ ONLY;` + `ROLLBACK;` + header banner + write-keyword grep gate (D-08) |
| Stale/incorrect verdict causing a later phase to break working prod | Tampering (downstream) | Re-grep current HEAD; reconcile code-first with deployed dump; user-gated scope edits |
| Leaking prod data in pasted output | Information Disclosure | Probe selects only catalog metadata (table names, RLS flags, policy expressions, trigger DDL, extension versions) — no row data from user tables |

## Sources

### Primary (HIGH confidence — verified this session)
- `git grep` / file inspection of current HEAD — CORS lines, RLS-absence in migrations, `dish_analytics` schema, deps, invalidate-cache header, web-portal deletion commit `c1a7e3f`, residual doc-reference counts.
- `infra/supabase/migrations/database_schema.sql` — behavioral-table owner columns (`user_id`), zero ENABLE RLS in baseline.
- `.planning/codebase/CONCERNS.md`, CONTEXT.md, REQUIREMENTS.md, ROADMAP.md, PROJECT.md, STATE.md, CLAUDE.md.

### Secondary (MEDIUM confidence)
- [PostgreSQL 15 pg_policies docs](https://www.postgresql.org/docs/15/view-pg-policies.html) — column set for Block 1.
- [PostgreSQL pg_policies (current)](https://www.postgresql.org/docs/current/view-pg-policies.html) — confirms column stability across versions.

### Tertiary (LOW confidence — flagged for checkpoint)
- pgvector `hnsw.iterative_scan` >= 0.8.0 threshold (A1) — confirm against Block 2 output before Phase 7 relies on it.

## Metadata

**Confidence breakdown:**
- Code-assessable verdicts: HIGH — every claim re-verified by `git grep` against current HEAD this session.
- SQL probe design: HIGH — standard catalog queries; `pg_policies` columns cited from PG15 docs.
- Live-state values (RLS per-table, pgvector version, webhook events): LOW until the operator paste-back — genuinely prod-only by design (D-10).

**Research date:** 2026-06-18
**Valid until:** 2026-07-18 for code-assessable findings (stable repo); the three live-state values are point-in-time at the checkpoint and should be re-captured if prod is changed before Phases 3/6/7 execute.
