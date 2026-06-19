# Phase 1: Assessment & Findings Register - Pattern Map

**Mapped:** 2026-06-18
**Files analyzed:** 4 (2 new, 2 modified)
**Analogs found:** 4 / 4

> This is a docs + read-only-SQL phase — no application code. "Patterns" here means the **document/file structure and conventions** each artifact should mirror so it cross-references cleanly with what already exists. Match quality reflects structural fit, not runtime role overlap.

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|-------------------|------|-----------|----------------|---------------|
| `.planning/codebase/FINDINGS.md` (NEW) | doc / verdict-register | transform (CONCERNS findings → verdicts) | `.planning/codebase/CONCERNS.md` | exact (parallel overlay) |
| `infra/scripts/assess-live-state.sql` (NEW) | operator probe / config | request-response (read-only prod introspection) | `infra/supabase/migrations/151_retire_ingredient_triggers.sql` (SQL header) + `infra/scripts/verify-phase7.ts` (read-only operator-script ethos) | role-match (no existing `.sql` operator script) |
| `.planning/ROADMAP.md` (MODIFIED) | doc / phase-scope | transform (verdict → scope annotation) | itself — `### Phase N` detail blocks + Progress table | exact (self-analog) |
| `.planning/REQUIREMENTS.md` (MODIFIED) | doc / traceability | transform (verdict → status) | itself — Traceability table + req checklists | exact (self-analog) |

## Pattern Assignments

### `.planning/codebase/FINDINGS.md` (NEW — verdict overlay on CONCERNS.md)

**Analog:** `.planning/codebase/CONCERNS.md` — FINDINGS.md is a verdict layer ON TOP of it (D-01). Keep finding titles aligned so a reader goes finding-by-finding between the two.

**CONCERNS.md top-level section structure to mirror / map back to** (verified headings, in order):
- `# Codebase Concerns` + `**Analysis Date:**` line (line 1-3)
- `## Tech Debt` (line 7) — 7 findings (ingredient schema, DishKind shims, web-portal onboarding-only, two admin codepaths, web-portal-v2 dormant, enrich-dish stale comments, stale types.ts)
- `## Known Bugs` (line 125) — web-portal dish create/edit broken; map view-mode disabled
- `## Security Considerations` (line 156) — feed CORS, RLS audit gap, infra/scripts no guard
- `## Performance Bottlenecks` (line 200) — generate_candidates radius, feed JS ranking, types.ts size
- `## Fragile Areas` (line 240) — BasicMapScreen, filterStore, DailyFilterModal, ReviewDishEditor
- `## Scaling Limits` (line 282) — vector candidate gen, Upstash single namespace
- `## Dependencies at Risk` (line 304) — deno std 0.168.0, supabase-js unpinned
- `## Test Coverage Gaps` (line 329) — mobile, admin, feed Deno tests

**Per-finding detail block shape in CONCERNS.md** (e.g. lines 9-31, 158-168) — each finding is `### Title` then bolded labels: `**Issue:**`/`**Risk:**`/`**Problem:**`/`**Symptoms:**`, `**Files:**` (with file:line), `**Impact:**`, `**Fix:**`/`**Recommendation:**`/`**Scaling path:**`, separated by `---`.

**FINDINGS.md structure the planner should specify** (per D-02, mapping back to the above):
1. `# Codebase Findings Register` + `**Assessment Date:**` + a one-line "verdict overlay on CONCERNS.md (2026-06-19)" pointer.
2. **Summary table** (one row per finding, ~26 rows): `ID | CONCERNS finding (title) | area | requirement ID | verdict | gated phase | scope impact`. (ID scheme = Claude's discretion, e.g. `F-01…F-NN`; D-03.)
3. **Per-finding detail sections** — one `### F-NN — <CONCERNS title>` per finding, carrying the CONCERNS label vocabulary PLUS: `**Verdict:**` (confirmed / stale / already-resolved / out-of-scope, D-06), `**Evidence:**` (file:line on current HEAD, or "PENDING — live-state, see Block N" for the three prod-only ones), `**Scope impact:**` (D-11).
4. **Net-new findings** section (D-07) — clearly flagged, routed to backlog, NOT actioned.

**Critical content corrections to bake in** (from RESEARCH — CONCERNS.md is dated and drifted):
- web-portal deleted AND committed (`c1a7e3f`) → `already-resolved` (CONCERNS line 54-63 says "uncommitted" — wrong).
- enrich-dish CORS is line **31** not 33 (CONCERNS line 164).
- `dish_analytics` is dish-keyed (no `user_id`) → NOT a user-owned RLS target (CONCERNS line 174 mislists it).

---

### `infra/scripts/assess-live-state.sql` (NEW — read-only prod probe)

**No existing `.sql` operator script in `infra/scripts/`** (verified: directory is all `.ts`). Two analogs combine:

**(a) SQL header-comment convention** — `infra/supabase/migrations/151_retire_ingredient_triggers.sql` lines 1-10:
```sql
-- 151_retire_ingredient_triggers.sql
-- Created: 2026-06-04
--
-- Phase B of the ingredient pipeline retirement (per
-- docs/plans/ingredient-pipeline-phase-b-trigger-retirement.md).
--
-- Phase A (shipped 2026-05-17) removed all application-level read/write paths
```
Convention: leading `-- <filename>`, `-- Created:` date, blank `--` line, then a prose rationale block citing the source plan. Mirror this: lead with `-- assess-live-state.sql`, date, and a "READ ONLY — run once in Supabase SQL editor, paste full output back" banner.

**(b) Read-only operator-script ethos** — `infra/scripts/verify-phase7.ts` lines 2-7:
```ts
/**
 * verify-phase7.ts — READ-ONLY. Confirms whether migration 163 ...
 *
 * Usage:  cd infra/scripts && pnpm exec ts-node verify-phase7.ts
 */
```
And the dry-run/apply split banner from `apply-phase6-flag-fixes.ts` lines 14-16 (`--dry-run` report vs `--apply` write). The established discipline: every operator script states READ-ONLY-ness and exact run command up front. The `.sql` has no `--apply` path at all — it is read-only-only (D-08).

**Read-only hard-guard pattern** (from RESEARCH Pattern 2, the authored design): wrap in `BEGIN; SET TRANSACTION READ ONLY;` ... `ROLLBACK;` and structure as 4 labeled `SELECT`-only blocks (Block 1 RLS+policies via `pg_tables`/`pg_policies`; Block 2 pgvector via `pg_extension`/`pg_available_extensions`; Block 3 deployed triggers via `information_schema.triggers`; Block 4 owner-column sanity via `information_schema.columns`). Plus the A2 catch-all: `SELECT tablename, rowsecurity FROM pg_tables WHERE schemaname='public' AND rowsecurity=false ORDER BY tablename;`. Full query bodies are in `01-RESEARCH.md` lines 149-200 — the planner copies from there, not from any codebase file.

**Static safety gate before operator runs it:** grep the `.sql` for `INSERT|UPDATE|DELETE|ALTER|DROP|CREATE|TRUNCATE` → must be zero outside comments (RESEARCH Validation map, D-08 safety).

---

### `.planning/ROADMAP.md` (MODIFIED — verdict-driven annotations, D-11/D-12, user-gated)

**Analog:** the file's own existing structure — append annotations WITHOUT renumbering or reformatting (D-12).

**Phase-detail block format to append into** (`### Phase 1` at line 30, pattern repeats per phase):
```
### Phase N: <Name>
**Goal**: ...
**Depends on**: ...
**Requirements**: SEC-02
**Success Criteria** (what must be TRUE):
  1. ...
**Plans**: TBD
```
Annotation pattern (D-12): add a line like `**Scope note (per FINDINGS):** descoped — <reason>` to the relevant `### Phase N` block, or annotate the specific Success Criterion. Do NOT touch the `- [ ] **Phase N: ...**` checklist (lines 17-26) numbering or the **Progress** table phase rows (lines 148-157) numbering — preserve stable phase numbers + audit trail.

**Phases most likely to receive annotations** (from verdict seeds): Phase 3 (RLS — per-table descope if already protected), Phase 7 (pgvector / webhook coverage), Phase 5 (web-portal already-resolved → residual-doc cleanup only).

---

### `.planning/REQUIREMENTS.md` (MODIFIED — traceability status edits, user-gated)

**Analog:** the file's own Traceability table + requirement checklists.

**Traceability table format** (lines 76-98), columns `Requirement | Phase | Status` with `Pending` values:
```
| ASSESS-02 | Phase 1 | Pending |
| SEC-02 | Phase 3 | Pending |
```
Annotation pattern (D-12): flip the `Status` cell from `Pending` to `Satisfied (per FINDINGS — <reason>)` only for requirements a verdict fully resolves. Keep the Phase column unchanged (no renumber). Mirror by also checking the matching `- [ ]` → `- [x]` in the requirement checklist (lines 12-47) where satisfied.

**Coverage block** (lines 100-103) and `**Last updated:**` footer (line 107) — update the date footer; do not alter the 21-total coverage count (verdicts change status, not the requirement set).

## Shared Patterns

### file:line citation discipline
**Source:** `CONCERNS.md` `**Files:**` blocks (e.g. line 163-164 `feed/index.ts (line 20)`, `enrich-dish/index.ts (line 33)`).
**Apply to:** every FINDINGS.md detail section.
Cite file:line on **current HEAD** (re-grep — CONCERNS line numbers have drifted; enrich-dish CORS is now line 31). Prod-only findings cite a probe Block instead of a line.

### READ-ONLY operator banner
**Source:** `verify-phase7.ts:2-3` (`READ-ONLY`) + `apply-phase6-flag-fixes.ts:14-16` (Usage block).
**Apply to:** `assess-live-state.sql` header — state read-only-ness + exact Supabase-SQL-editor run instruction + paste-back ask.

### No-renumber annotation
**Source:** ROADMAP.md phase numbering (lines 9-13 explicitly define the integer/decimal scheme) + REQUIREMENTS Traceability (one req → one phase).
**Apply to:** both modified docs — annotate scope/status in place; never renumber phases or remap requirements (D-12).

## No Analog Found

| File | Role | Data Flow | Reason |
|------|------|-----------|--------|
| `infra/scripts/assess-live-state.sql` (full query bodies) | operator probe | request-response | No `.sql` operator script exists in `infra/scripts/` (all are `.ts` prod-mutation scripts). Header/ethos analogs exist (migration 151, verify-phase7.ts) but the actual catalog-query bodies have no codebase precedent — copy them from `01-RESEARCH.md` lines 149-200 (the authored, cited probe design). |

## Metadata

**Analog search scope:** `.planning/codebase/`, `.planning/`, `infra/scripts/`, `infra/supabase/migrations/`
**Files scanned:** CONCERNS.md, ROADMAP.md, REQUIREMENTS.md, migration 151, verify-phase7.ts, apply-phase6-flag-fixes.ts; `infra/scripts/` listing (24 files, zero `.sql`)
**Pattern extraction date:** 2026-06-18
