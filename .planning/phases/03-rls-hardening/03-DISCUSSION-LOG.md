# Phase 3: RLS Hardening - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-06-19
**Phase:** 3-rls-hardening
**Areas discussed:** Codification fidelity, Mirror vs. better baseline, Owner-column index, Safety + dry-run validation

---

## Area selection

| Option | Description | Selected |
|--------|-------------|----------|
| Codification fidelity | Functional from probe vs byte-exact mirror | ✓ |
| Mirror vs. better baseline | Bare auth.uid()/roles/admin override vs cleaner | ✓ |
| Owner-column index | Add-where-missing vs uniform single-col | ✓ |
| Safety + dry-run validation | Idempotency, table-precondition, validation method | ✓ |

**User's choice:** All four areas.

---

## Codification fidelity

| Option | Description | Selected |
|--------|-------------|----------|
| Functional from F-11 probe | Reproduce access semantics from per-table cmd→role→predicate; no new probe; names/text may differ | ✓ |
| Byte-exact mirror of prod | Literal policy DDL (names/roles/predicates); needs fresh pg_policies + pg_get_expr probe; db diff == 0 | |
| Functional + capture exact names | Functional predicates but reuse prod policy names; needs name-list probe | |

**User's choice:** Functional from F-11 probe.
**Notes:** The F-11 probe table is the source of truth — no further prod round-trip. Not targeting a byte-exact `supabase db diff`.

---

## Mirror prod vs. author the cleaner baseline

### Admin override

| Option | Description | Selected |
|--------|-------------|----------|
| No admin override | Pure own-row, faithful to prod; no access expansion to user-private data; service-role bypasses RLS for backend | ✓ |
| Add is_admin() override | Match 091/119 convention; widens read access to user-private data; diverges from prod's behavioral-table shape | |

**User's choice:** No admin override.

### Role-target handling

| Option | Description | Selected |
|--------|-------------|----------|
| Normalize own-row to authenticated | All own-row policies TO authenticated; keep USING(true) public-read where prod genuinely has it | ✓ |
| Preserve prod's exact roles | Reproduce public vs authenticated verbatim, inconsistencies included | |

**User's choice:** Normalize own-row to authenticated.
**Notes:** SC#2's `(select auth.uid())` InitPlan form is mandatory regardless (the one deliberate divergence from prod's bare form). Genuine public reads preserved on dish_opinions/dish_photos/dish_analytics.

---

## Owner-column index

| Option | Description | Selected |
|--------|-------------|----------|
| Add only where missing | CREATE INDEX IF NOT EXISTS on 7 untracked tables; rely on 076 composites for favorites/user_dish_interactions/session_views | ✓ |
| Uniform single-col on all 10 | Dedicated user_id index on every owner table incl. the 3 with composites (3 redundant) | |
| Add missing + verify composites | Add-where-missing plus an operator probe note to confirm 076 composites are deployed | |

**User's choice:** Add only where missing.

---

## Safety + dry-run validation

### Dry-run validation method (no local psql)

| Option | Description | Selected |
|--------|-------------|----------|
| Operator validates on branch | Author + static self-review locally; operator runs migration on a Supabase branch/shadow/prod-clone | ✓ |
| Static/syntax review only | SQL review + pnpm check-types, no DB execution | |
| Supabase CLI local db | supabase db reset / local Postgres; likely fails — pre-071 CREATE TABLE missing | |

**User's choice:** Operator validates on branch.

### Missing CREATE TABLE drift (history starts at 071)

| Option | Description | Selected |
|--------|-------------|----------|
| Document precondition + defer | Header note that 11 tables assumed preexisting; log pre-071 table-DDL drift as separate deferred item | ✓ |
| Fold in CREATE TABLE DDL | Capture exact table DDL from prod (another probe); make migration self-sufficient; expands scope | |

**User's choice:** Document precondition + defer.

### Idempotency / safety posture

| Option | Description | Selected |
|--------|-------------|----------|
| Defensive + REVERSE pair | DROP POLICY IF EXISTS, idempotent ENABLE, BEGIN/COMMIT, 170_REVERSE_ONLY_ pair | ✓ |
| Plain CREATE, no guards | Straight ENABLE/CREATE; not re-runnable, not prod-safe | |

**User's choice:** Defensive + REVERSE pair.

---

## Claude's Discretion

- Exact policy names (functional fidelity per D-01).
- Whether to include the explicit `ALL TO service_role` policies prod has (redundant since service-role bypasses RLS) — lean include-for-fidelity.
- Comment/section layout and REVERSE-pair ordering within the migration.

## Deferred Ideas

- Pre-071 table-DDL drift (11 tables' CREATE TABLE missing from repo migrations) — separate future cycle.
- Byte-exact prod parity (`db diff == 0`) — rejected for functional fidelity.
- Automated RLS regression suite — QUAL-V2-01 (v2).
- Confirming 076 composite indexes' prod deployment — optional during branch validation.
