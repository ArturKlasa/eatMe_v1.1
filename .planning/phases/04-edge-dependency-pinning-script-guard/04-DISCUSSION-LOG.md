# Phase 4: Edge Dependency Pinning & Script Guard - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-06-19
**Phase:** 04-edge-dependency-pinning-script-guard
**Areas discussed:** Dep specifier/version pin, Script-guard scope, Script-guard UX/location, Default-direction flip, Write-flag naming

---

## Dependency specifier & version pin (DEBT-05)

| Option | Description | Selected |
|--------|-------------|----------|
| esm.sh @2.39.3 (incumbent) | Standardize all functions on `esm.sh/@supabase/supabase-js@2.39.3` — matches the already-pinned app-config + "prefer incumbent" rule; treats roadmap "JSR" as aspirational | ✓ |
| esm.sh, latest exact 2.x | Same esm.sh style but bump to newest 2.x (e.g. @2.49.x, matching infra/scripts) | |
| jsr: (follow roadmap literally) | Rewrite to `jsr:@supabase/supabase-js@exact`; cleaner long-term but bigger change + JSR-resolution risk on edge runtime | |

**User's choice:** esm.sh @2.39.3 (incumbent)
**Notes:** Roadmap SC#2 literally says "one exact JSR version" — recorded as a deliberate deviation, not literal. `@upstash/redis` pins to `@1.38.0` (the value `feed` already uses), no bump.

---

## Script-guard scope (SEC-03 / F-12)

| Option | Description | Selected |
|--------|-------------|----------|
| All write-path scripts (~11) | Guard every script that mutates prod (all backfills + seed + batch-embed + the 2 flagged); read-only diagnose/verify untouched | ✓ |
| Only the 2 F-12 scripts | Narrowest reading — guard just replay-menu-scan-ab + apply-phase6-flag-fixes | |
| All, but new shared helper only | Build the helper, retrofit only the 2 flagged, leave rest as opt-in follow-up | |

**User's choice:** All write-path scripts (~11)
**Notes:** Planner must classify each script by its actual mutation calls (insert/update/upsert/delete/writing-RPC), NOT by service-role usage — read-only scripts also use the service-role key.

---

## Script-guard UX & location (SEC-03)

| Option | Description | Selected |
|--------|-------------|----------|
| Shared helper + flag, default dry-run | New `infra/scripts/lib/prod-guard.ts` (mirrors `_shared/cors.ts`): default dry-run, explicit `--apply` to write, prints project ref before any mutation | ✓ |
| Shared helper + typed confirmation | Same helper, but writing requires typing the project ref interactively | |
| Inline per-script (no shared lib) | Retrofit each script's own argv parsing; no new lib/ module | |

**User's choice:** Shared helper + flag, default dry-run
**Notes:** First module under `infra/scripts/lib/`. `apply-phase6-flag-fixes.ts` already implements the target shape — generalize it.

---

## Default-direction flip (SEC-03)

| Option | Description | Selected |
|--------|-------------|----------|
| Flip all to default dry-run | Every guarded script defaults to dry-run; writing always needs the explicit flag (the core of SEC-03). Changes the CLI contract of LIVE-default scripts | ✓ |
| Preserve existing defaults | Only layer guard/print-ref on top; don't change which scripts default live vs dry-run | |

**User's choice:** Flip all to default dry-run
**Notes:** `backfill-cuisine-from-dishes` (and peers) currently write unless `--dry-run` — that default inverts. `batch-embed` has no dry-run today → net-new gate. Documented in script headers / rollout.

---

## Write-flag naming (SEC-03)

| Option | Description | Selected |
|--------|-------------|----------|
| --apply (keep --dry-run as no-op) | Standardize on `--apply` to write; keep accepting `--dry-run` as a redundant no-op for muscle memory; matches the script already using `--apply` | ✓ |
| --apply (reject --dry-run) | One way only; `--dry-run` removed/errors | |
| --confirm | New flag name as an acknowledgement-style trigger | |

**User's choice:** --apply (keep --dry-run as no-op)
**Notes:** Exactly one flag means "write to prod" = `--apply`; `--dry-run` must never error.

## Claude's Discretion

- Exact `prod-guard.ts` API shape and project-ref banner format.
- Exact `jsr:@std/assert` version for the migrated test imports.
- Whether to add a tiny smoke test for the guard (minimal-tests decision — only if cheap).

## Deferred Ideas

- Pin `npm:openai@4` in menu-scan-worker (out of DEBT-05 scope).
- Full Deno std → JSR modernization (QUAL-V2-02).
- Lock the other 4 wildcard edge functions' CORS (carried from Phase 2).
- A contributing-docs convention requiring every new write script to call `prod-guard`.
