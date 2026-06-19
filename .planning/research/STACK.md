# Stack Research

**Domain:** Brownfield codebase-hardening (Supabase + Deno edge + Expo/RN + Next.js admin)
**Researched:** 2026-06-18
**Confidence:** HIGH (versions verified against JSR/GitHub/npm registries + official Supabase/pgvector/Deno docs on 2026-06-18)

> Scope note: This is NOT a greenfield stack. The recommendations below are remediation targets for the five hardening areas in the milestone — they tell each phase *which exact version to pin* and *which prescriptive pattern to apply*. No new product dependencies are proposed. The existing stack (Expo 54 / RN 0.81, Next.js 16, Supabase PG15 + PostGIS + pgvector, Zustand 5, Upstash Redis) stays as-is.

---

## Recommended Stack

### Core Technologies (the hardening targets)

| Technology | Recommended Version / Form | Purpose | Why Recommended |
|------------|---------------------------|---------|-----------------|
| **Deno std HTTP** (edge) | **Drop `std/http` entirely → use built-in `Deno.serve`** | HTTP entrypoint for all edge functions | `deno.land/std@0.168.0/http/server.ts` is 4+ years stale and `server.ts`/`serve()` is **deprecated**. The Supabase Edge runtime has native `Deno.serve` (stable since Deno 1.35). Replacing `serve(handler)` with `Deno.serve(handler)` removes the remote import entirely — best possible "pin" is no import. (HIGH) |
| **`@std/http` (only if a std helper is genuinely needed)** | **`jsr:@std/http@1.1.1`** | Cookie/SSE/status helpers if any are used | std moved to JSR; `deno.land/std` now gets security patches only. Pin to exact `1.1.1`. Most EatMe functions only use `serve`, so they need **nothing** here — prefer `Deno.serve`. (HIGH) |
| **`@supabase/supabase-js`** (edge) | **`jsr:@supabase/supabase-js@2.108.2`** (exact) | DB + auth client inside edge functions | Edge functions cannot import the workspace `@eatme/database` package, so they import the client directly. JSR is the **officially recommended** Deno import path (replaces esm.sh). Pin the patch for deterministic cold starts. (HIGH) |
| **`@upstash/redis`** (edge) | **`npm:@upstash/redis@1.38.0`** (exact) — or keep esm.sh pinned form | Feed cache client | `feed/index.ts` already correctly pins `esm.sh/@upstash/redis@1.38.0` (which **is** current latest); `invalidate-cache/index.ts` uses the dangerous `@latest`. Fix the `@latest` to `@1.38.0`. Migrating to `npm:` specifier is preferred but lower priority since the version is already current. (HIGH) |
| **pgvector** | **0.8.0+ `hnsw.iterative_scan`** (confirm installed version on prod first) | ANN + filtered retrieval | 0.8.0 added **iterative index scans** that re-enter the HNSW index when a post-filter (e.g. geo radius) discards too many candidates — directly addresses the `generate_candidates` radius timeout. Supabase supports 0.8.0. **Must verify the installed extension version on prod before relying on this GUC.** (HIGH on feature; MEDIUM on prod availability until verified) |
| **PostGIS** | existing (PG15 managed) — pattern change, not version change | Geo radius filter | No version bump needed. The fix is *query structure* (geo pre-filter into a materialized CTE before/around the ANN scan), not a new dependency. (HIGH) |
| **Zustand** | existing **`^5.0.8`** — no bump | Mobile state | No version change. The fix is *architecture* (slice pattern under one persisted store + `migrate`/`version` discipline), not an upgrade. (HIGH) |

### Supporting Libraries

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `@std/assert` | `jsr:@std/assert@1.x` | Deno test assertions | If/when replacing the stale `deno.land/std@0.168.0/testing/asserts.ts` import in `menu-scan-worker/test.ts`. Same JSR-pin discipline. (MEDIUM — test-only, low risk) |
| `supabase` CLI | latest | Regenerate `packages/database/src/types.ts`; deploy functions | `supabase gen types typescript --project-id $SUPABASE_PROJECT_ID` after migrations through 169 (CONCERNS: stale 3226-line types file). (HIGH) |

### Development Tools

| Tool | Purpose | Notes |
|------|---------|-------|
| `deno test --node-modules-dir=none -A <path>` | Run edge-function Deno tests | Per project memory: deno at `~/.deno`, not on PATH. Run after CORS/import changes to feed/enrich-dish. |
| `pg_tables` / advisor query | RLS audit | `SELECT tablename, rowsecurity FROM pg_tables WHERE schemaname='public'` to confirm which behavioral tables actually have RLS — run read-only against prod via REST/service client (no psql locally). |

---

## Prescriptive Best-Practice Approach (per hardening area)

### 1. Edge-function security: CORS allowlist + pinned imports

**CORS — do this:**
- Replace `'Access-Control-Allow-Origin': '*'` (in `feed/index.ts:20`, `enrich-dish/index.ts:33`) with an **allowlist echo** pattern: read the request `Origin` header, check membership in an allowlist array (production app origin + admin origin), and echo it back only if allowed; otherwise omit the header (or return the first allowed origin). Always send `Vary: Origin`.
- Keep `Access-Control-Allow-Methods` / `Access-Control-Allow-Headers` (`authorization, x-client-info, apikey, content-type`) explicit; handle the `OPTIONS` preflight before auth.
- Put the allowlist in an env var (e.g. `ALLOWED_ORIGINS` comma-split) so origins aren't hardcoded — edge functions cannot import workspace packages, so an env-driven inline helper is the right shape.

**Avoid:** wildcard `*` with credentialed/JWT endpoints; that combination is the specific risk flagged for `feed` (it returns user-vector-tied results). Note `enrich-dish` is service-role-gated so its CORS risk is lower, but pin it the same way for consistency.

**Pinning — do this:**
- `import { serve }` → delete; use `Deno.serve(handler)`.
- `esm.sh/@supabase/supabase-js@2` → `jsr:@supabase/supabase-js@2.108.2`.
- `esm.sh/@upstash/redis@latest` (invalidate-cache) → `@1.38.0`.
- Update `deno-globals.d.ts` ambient module declarations to match whatever import forms survive (or remove them if `Deno.serve` + `jsr:` resolve types natively).

**Avoid:** `@latest` / unpinned `@2` on any remote import (non-deterministic cold starts); leaving `deno.land/std@0.168.0` references anywhere.

### 2. Supabase RLS on per-user + high-write behavioral tables

**Owner policy — do this (the 2025–2026 canonical form):**
```sql
-- Wrap auth.uid() in a scalar subselect so the planner caches it as an initPlan
create policy "owner_select" on user_dish_interactions
  for select to authenticated
  using ((select auth.uid()) = user_id);
```
- **Always** `(select auth.uid())`, never bare `auth.uid()` — the subselect turns a per-row function call into a single cached initPlan (Supabase's own lint `0003_auth_rls_initplan` flags the bare form). Measured 100x+ improvement on large tables.
- **Index the owner column**: `create index on user_dish_interactions (user_id);` — RLS predicates only fly if the filtered column is indexed. Critical for high-write behavioral tables (`user_dish_interactions`, `dish_opinions`, `favorites`, `session_views`).
- Specify roles (`to authenticated`) and split policies per-command (separate `select`/`insert`/`update`/`delete`) rather than one `for all`.
- For tables written by edge functions via the **service-role** client (which bypasses RLS), still enable RLS + add owner policies so the REST/anon path is locked even though the service path is unaffected.

**Avoid:** bare `auth.uid()` in policies; `auth.uid() in (select ...)` join shapes (invert to `team_id in (select ... where user_id = auth.uid())`); leaving any behavioral table with RLS disabled (default-deny only protects if RLS is *enabled*). For unindexed join-heavy checks, push the lookup into a `security definer` helper.

**Assess first:** several of these tables may already have RLS (enabled in dashboard or an uncaptured migration). Run the `pg_tables.rowsecurity` audit before authoring any `ENABLE ROW LEVEL SECURITY` migration — this is an assessment-first finding.

### 3. Vector + geo retrieval (`generate_candidates` timeout past ~5km)

Two complementary, prescriptive options — recommend doing **both**:

**(a) Geo-first materialized CTE (works on any pgvector version).** Filter to in-radius dishes first using the PostGIS `geometry(Point,4326)` + GiST index (`ST_DWithin` on `geography`, or `&&` bbox + `ST_DWithin`), materialize that set, *then* run the `<=>` ANN ordering over the reduced set. Migration 169 already started this pushdown; the prescription is to make the geo filter authoritatively reduce the candidate set before the vector sort, so HNSW isn't scanning the whole catalog. Ensure a **GiST index on the location column** exists.

**(b) Iterative HNSW scan (pgvector 0.8.0+).** Set `SET LOCAL hnsw.iterative_scan = 'relaxed_order';` (or `strict_order`) inside the RPC so Postgres re-enters the HNSW index when the geo post-filter discards too many rows — eliminates the "too few rows after filter" failure mode that forces full scans. Tune `hnsw.max_scan_tuples` / `hnsw.ef_search` to bound latency. **Verify prod pgvector ≥ 0.8.0 first** (assessment step) — if older, ship (a) and a tiered-radius fallback.

**Tiered-radius fallback (no extension dependency):** try 3 km, expand to 6/10 km only if `< N` results. Caps the worst-case scan in dense areas and is the lowest-risk scaling lever.

**Avoid:** relying on HNSW post-filtering alone (the documented root cause — geo filter applied *after* the ANN pass yields timeouts/empty results); raising the default radius; per-query `ORDER BY <=> ... LIMIT` over the full catalog without a geo pre-reduction.

### 4. Mobile maintainability: splitting large Zustand stores without breaking persisted state

**Do this — slices under ONE persisted store:**
- Keep a **single `create()(persist(...))`** store and compose it from **slice creators** (`StateCreator` functions merged in the root). This is the official Zustand "slices pattern" and it does **not** change the serialized shape, so existing AsyncStorage-persisted user filter state survives. This is the safe way to break up `filterStore.ts` (927 lines) by axis (price / protein / diet / spice / cuisine slices) without a storage migration.
- Apply `persist` **only at the combined store**, never inside individual slices (multiple persist layers corrupt rehydration).
- Keep `partialize` excluding transient state; if any **stored field name changes**, bump `persist({ version })` and supply a `migrate(persistedState, version)` to remap old keys (CONCERNS explicitly warns store changes can break user-persisted preferences on app update).

**Avoid:** splitting `filterStore` into multiple *separate* `create()` stores when the goal is behavior-preserving — that changes storage keys/shape and risks dropping persisted user prefs. Only use separate stores for genuinely independent, differently-persisted domains. Avoid touching `partialize`/key names without a `version` bump + `migrate`. All splits are behavior-preserving and **verified on-device by the user** (no emulator in the agent loop).

---

## Installation / Pin Changes (no npm installs — edge import-string edits)

```text
# Edge functions (infra/supabase/functions/*/index.ts) — replace import strings:
- import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
+ // (removed) use Deno.serve(handler) directly

- import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
+ import { createClient } from 'jsr:@supabase/supabase-js@2.108.2';

- import { Redis } from 'https://esm.sh/@upstash/redis@latest';   // invalidate-cache
+ import { Redis } from 'npm:@upstash/redis@1.38.0';

# menu-scan-worker/test.ts:
- from 'https://deno.land/std@0.168.0/testing/asserts.ts'
+ from 'jsr:@std/assert@1'

# Types regen (after migrations through 169):
supabase gen types typescript --project-id $SUPABASE_PROJECT_ID > packages/database/src/types.ts
```

> Pin all edge functions to the **same** `@supabase/supabase-js@2.108.2` so cold-start behavior is uniform (currently they drift: app-config pins `2.39.3`, others use bare `@2`).

## Alternatives Considered

| Recommended | Alternative | When to Use Alternative |
|-------------|-------------|-------------------------|
| `Deno.serve` (no std import) | `jsr:@std/http@1.1.1` `serve` | Only if you need std HTTP helpers beyond serving (cookies/SSE/status). EatMe functions don't — prefer native. |
| `jsr:@supabase/supabase-js@2.108.2` | `npm:@supabase/supabase-js@2.108.2` | `npm:` specifier is equally official; choose it if a transitive dep resolves better under npm. Both beat esm.sh. |
| pgvector 0.8.0 iterative scan | Tiered-radius app-level fallback | If prod pgvector is < 0.8.0 and can't be upgraded promptly — ship tiered radius + geo-first CTE instead. |
| Geo-first CTE + GiST | Move ANN to a dedicated geo-aware vector store | Only at far larger scale than current catalog; out of scope this milestone (over-engineering for a hardening pass). |
| Slices under one persisted store | Multiple separate stores | Only for independent domains with different persistence needs — NOT for behavior-preserving `filterStore` split. |

## What NOT to Use

| Avoid | Why | Use Instead |
|-------|-----|-------------|
| `deno.land/std@0.168.0/http/server.ts` | 4+ yrs stale, `serve()` deprecated, security-patch-only channel | `Deno.serve` (native) |
| `esm.sh/@supabase/supabase-js@2` (unpinned) | Non-deterministic cold starts; esm.sh de-emphasized by Supabase | `jsr:@supabase/supabase-js@2.108.2` |
| `esm.sh/@upstash/redis@latest` | `@latest` = silent breaking upgrade on cold start | `@1.38.0` (current latest, pinned) |
| Bare `auth.uid() = user_id` in RLS | Per-row function eval; Supabase lint flags it | `(select auth.uid()) = user_id` + index on owner col |
| `Access-Control-Allow-Origin: '*'` on JWT/feed endpoints | Any origin can call a user-data endpoint | Env-driven origin allowlist echo + `Vary: Origin` |
| HNSW post-filter-only for geo | Root cause of the >5km timeout | Geo-first CTE + iterative scan / tiered radius |
| Splitting `filterStore` into separate `create()` stores | Changes storage shape → drops persisted user prefs | Slice pattern under one `persist` + `version`/`migrate` |

## Version Compatibility

| Package A | Compatible With | Notes |
|-----------|-----------------|-------|
| `Deno.serve` | Supabase Edge runtime | Native since Deno 1.35; Edge runtime supports it. No remote import. |
| `jsr:@supabase/supabase-js@2.108.2` | Deno (Edge runtime) | JSR is the officially supported Deno path; v2 line, same major as current `^2.x` clients in apps. |
| pgvector 0.8.0 `hnsw.iterative_scan` | PostgreSQL 15 (Supabase) | GUC set per-transaction (`SET LOCAL`); **confirm installed extension version on prod**. |
| Zustand `^5.0.8` persist | RN AsyncStorage | Slices pattern preserves serialized shape; bump `version` + `migrate` on any stored-key rename. |
| `@upstash/redis@1.38.0` | Deno (npm:/esm.sh) | Already the pinned version in `feed/index.ts`; align `invalidate-cache`. |

## Sources

- https://supabase.com/docs/guides/functions — JSR/npm imports preferred over esm.sh/deno.land (HIGH)
- https://jsr.io/@supabase/supabase-js — official Deno import path (HIGH); latest `2.108.2` via GitHub releases API (verified 2026-06-18)
- https://jsr.io/@std/http + https://github.com/denoland/std/releases — `@std/http` latest `1.1.1`; `server.ts`/`serve` deprecated, std moved to JSR (HIGH; meta.json verified)
- https://docs.deno.com/runtime/reference/cli/serve/ — `Deno.serve` is the modern native HTTP approach (HIGH)
- https://supabase.com/docs/guides/troubleshooting/rls-performance-and-best-practices-Z5Jjwv — `(select auth.uid())` initPlan caching + index owner column (HIGH)
- https://supabase.com/docs/guides/database/database-advisors (lint 0003_auth_rls_initplan) — bare `auth.uid()` flagged (HIGH)
- https://www.postgresql.org/about/news/pgvector-080-released-2952 + https://www.thenile.dev/blog/pgvector-080 — 0.8.0 iterative index scans / `hnsw.iterative_scan` (HIGH)
- https://supabase.com/docs/guides/ai/vector-indexes/hnsw-indexes — Supabase HNSW + 0.8.0 features (HIGH)
- https://zustand.docs.pmnd.rs/learn/guides/slices-pattern + https://github.com/pmndrs/zustand/blob/main/docs/integrations/persisting-store-data.md — slices under one persisted store, persist only at combined store, `version`/`migrate` (HIGH)
- npm registry `@upstash/redis` latest `1.38.0` (verified 2026-06-18)

---
*Stack research for: EatMe codebase-hardening milestone*
*Researched: 2026-06-18*
