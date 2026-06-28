---
quick_id: 260628-dvt
slug: delete-dead-code-token-css-generator-get
description: "Delete 5 grep-verified dead-code findings: token CSS generator (writes to deleted apps/web-portal/), getWebClient (zero consumers), shared isAdmin + isDiscoverable (dead except own tests), fromSupabase (mobile, zero callers). Pure deletion, NO behavior change."
date: 2026-06-28
mode: quick
status: planned
---

# Quick Task 260628-dvt — Plan

Pure dead-code deletion across four packages. Every symbol was grep-verified as
having zero real importers before planning; line numbers below were verified
against the current files. **No behavior change** — this only removes code that
nothing reaches.

Four tasks grouped by area → four clean atomic commits. Order is independent;
run them in sequence on the main tree.

**Out of scope (do NOT touch):** `apps/web-portal-v2` `withPublic`/`withPublicRoute`
(live), `apps/admin` `withPublic` (skipped finding), `infra/scripts` phase6 scripts
(deferred), and `apps/admin/src/lib/auth/dal.ts`'s OWN separate `isAdmin` (live —
unrelated to the shared one).

---

## Task 1 — Tokens: remove the CSS-vars generator

The generator targeted `apps/web-portal/` (deleted 2026-06-18). The pre-scripts
that ran it have no other purpose; `build`/`dev` stay as `turbo run build`/`turbo run dev`.

**Files:**
- DELETE `packages/tokens/scripts/generate-css-vars.ts`
- DELETE `packages/tokens/scripts/culori.d.ts` (last file in `scripts/` — remove the now-empty dir)
- EDIT `packages/tokens/package.json`
- EDIT `package.json` (repo root)

**Action:**
1. Delete both files in `packages/tokens/scripts/` and remove the empty `scripts/` directory.
2. In `packages/tokens/package.json`: remove the `generate:css` script line (the `tsx scripts/generate-css-vars.ts` entry); remove `culori` and `tsx` from `devDependencies`. Keep `build`/`dev`/`clean`/`type-check` and the other deps.
3. In the root `package.json`: delete the two `scripts` lines `prebuild` and `predev` (both run `pnpm --filter @eatme/tokens generate:css`). Leave `build`/`dev`/`lint`/`format`/`check-types`/`prepare` untouched.
4. Run `pnpm install` to drop `culori` + `tsx` from `pnpm-lock.yaml`.

**Verify:**
- `test ! -e packages/tokens/scripts` → exits 0 (dir gone)
- `grep -rn "generate:css\|culori\|tsx scripts" packages/tokens/package.json package.json` → empty
- `grep -c "culori\|tsx" pnpm-lock.yaml` → 0 (no other consumer; lockfile re-resolved)

**Done:** `scripts/` dir gone; neither package.json references the generator, culori, or tsx; lockfile no longer pins culori/tsx; `pnpm install` completes clean.

**Commit:** `chore(tokens): remove dead css-vars generator (targeted deleted web-portal)`

---

## Task 2 — Database: remove deprecated `getWebClient`

`@deprecated`, zero consumers — the web surfaces use `createBrowserClient` from
`@supabase/ssr`. Keep `getMobileClient` (live: mobile).

**Files:**
- EDIT `packages/database/src/client.ts`
- EDIT `packages/database/src/index.ts`

**Action:**
1. In `client.ts`: delete the `getWebClient` function and its `@deprecated` docblock (lines 34–63). In the module-level docblock at the top, delete the now-stale "Usage — web portal (Next.js)" example block (lines 14–19) — KEEP the "WHY explicit params" paragraph and the "Usage — mobile (Expo / React Native)" example. KEEP `getMobileClient` and the `createClient`/`Database` imports unchanged.
2. In `index.ts` (line 12): change the re-export `export { getWebClient, getMobileClient } from './client';` to export only `getMobileClient`. (The module-header comment block above it already only mentions `getMobileClient` for mobile — leave it.)

**Verify:**
- `grep -rn "getWebClient" packages apps infra --include='*.ts' --include='*.tsx' | grep -v node_modules` → empty
- `pnpm exec turbo run check-types` → passes

**Done:** `getWebClient` no longer exists or is exported anywhere; `getMobileClient` still exported and typechecks; no consumer breaks (there were none).

**Commit:** `chore(database): remove deprecated unused getWebClient`

---

## Task 3 — Shared: remove dead `isAdmin` + `isDiscoverable`

Both live in `@eatme/shared`, both dead except their own unit tests (they share
`index.ts` + the one test file, so done together). Note `apps/admin`'s separate
`isAdmin` in `auth/dal.ts` is a different, live impl — do NOT touch it.

**Files:**
- DELETE `packages/shared/src/logic/role.ts`
- DELETE `packages/shared/src/logic/discoverability.ts`
- EDIT `packages/shared/src/index.ts`
- EDIT `packages/shared/src/__tests__/v2-schemas.test.ts`

**Action:**
1. Delete `packages/shared/src/logic/role.ts` and `packages/shared/src/logic/discoverability.ts`.
2. In `index.ts`: remove the two barrel lines `export * from './logic/discoverability';` (line 5) and `export * from './logic/role';` (line 6). Keep the other `export *` lines (constants, types, validation, protein, locale, currency, pricing).
3. In `v2-schemas.test.ts`: remove the two imports at the top — `import { isDiscoverable } from '../logic/discoverability';` (line 2) and `import { isAdmin } from '../logic/role';` (line 3). Remove the `describe('isDiscoverable', …)` block (with its `// ── isDiscoverable ──` section comment) and the `describe('isAdmin', …)` block (with its `// ── isAdmin ──` section comment). Leave the remaining describe blocks (publishPayloadSchema, menuScanJobInputSchema, confirmMenuScanPayloadSchema, dishSchemaV2, restaurantDraftSchema, restaurantPublishableSchema, restaurantBasicsSchema, MenuExtractionSchema) and their imports intact. The file is trimmed, NOT deleted.

**Verify:**
- `grep -rn "logic/role\|logic/discoverability" packages apps --include='*.ts' | grep -v node_modules` → empty
- `grep -rn "isDiscoverable" packages apps --include='*.ts' --include='*.tsx' | grep -v node_modules` → empty
- `cd packages/shared && npx vitest run` → passes (trimmed test file still green)

**Done:** Both logic files gone; barrel no longer exports them; no `isDiscoverable` / shared-`isAdmin` references remain; the remaining schema tests pass; `apps/admin/src/lib/auth/dal.ts` untouched.

**Commit:** `chore(shared): remove dead isAdmin + isDiscoverable helpers`

---

## Task 4 — Mobile: remove `fromSupabase`

Migration helper with zero callers. Keep `Result`/`Ok`/`Err`/`ok`/`err` — live
(userPreferencesService, favoritesService import them).

**Files:**
- EDIT `apps/mobile/src/lib/result.ts`

**Action:** Delete the `fromSupabase` function and its JSDoc (lines 39–52). Keep everything above: the module docblock, the `Ok`/`Err`/`Result` types, and the `ok`/`err` constructors.

**Verify:**
- `grep -rn "fromSupabase" apps/mobile --include='*.ts' --include='*.tsx' | grep -v node_modules` → empty
- `cd apps/mobile && npx tsc --noEmit` → passes (turbo skips mobile, so run it directly)

**Done:** `fromSupabase` gone; `Result`/`ok`/`err` and their two live consumers still typecheck.

**Commit:** `chore(mobile): remove unused fromSupabase result helper`

---

## Final verification gates (whole change)

Run after all four tasks land:

- `grep -rn "generate:css\|tokens.css\|culori\|getWebClient\|isDiscoverable\|fromSupabase" --include='*.ts' --include='*.tsx' --include='*.json' . | grep -v node_modules` → empty (no residue for these names)
- `grep -rn "logic/role\|logic/discoverability" packages apps --include='*.ts' | grep -v node_modules` → empty
- `pnpm exec turbo run check-types` → passes (admin + web-portal-v2 + shared packages)
- `cd packages/shared && npx vitest run` → passes
- `cd apps/mobile && npx tsc --noEmit` → passes (turbo skips mobile)
- `cd apps/admin && npx vitest run` → passes (sanity — admin `auth/dal.ts` `isAdmin` untouched)

## Threat model

Pure deletion of unreachable code. No new trust boundaries, no new dependencies
(`pnpm install` only *removes* culori/tsx). No attack surface added. Disposition:
**accept** — zero net new risk; the only failure mode is deleting something still
live, which the zero-importer greps + four typecheck/test gates above guard against.
