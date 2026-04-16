# Supabase Client Factory

## Scope reviewed

- `packages/database/src/client.ts` (full, 1-94)
- `packages/database/src/index.ts` (full, 1-22)
- `packages/database/src/types.ts` (header only, 1-30 — generated, out of scope for deeper review)
- `packages/database/package.json` (full, 1-35)
- `packages/database/tsconfig.json` (full, 1-26)
- `apps/web-portal/next.config.ts` (full, 1-23)
- `apps/web-portal/lib/supabase.ts` (full, 1-68)
- `apps/web-portal/lib/supabase-server.ts` (full, 1-133)
- `apps/web-portal/middleware.ts` (full, 1-132)
- `apps/web-portal/test/helpers/mockSupabase.ts` (full, 1-45)
- `apps/web-portal/test/helpers/index.ts` (full, 1-14)
- `apps/mobile/metro.config.js` (full, 1-37)
- `apps/mobile/src/lib/supabase.ts` (full, 1-128)
- `apps/mobile/src/services/edgeFunctionsService.ts` (targeted, 1-60 + 140-180)
- `apps/mobile/src/services/interactionService.ts` (targeted, 1-75)
- `apps/web-portal/package.json` (dep listing for `@eatme/tokens`)
- `agent_docs/architecture.md` (full, 1-64 — cross-ref for factory contract)
- Cross-references via Grep for `createClient|createBrowserClient|createServerClient|getMobileClient|getWebClient` across the monorepo (17 files matched; all 5 app/package call sites were read)
- Cross-references via Grep for `process.env.*SUPABASE*` across the monorepo (7 files matched; all read)

## Findings

### REV-09-a: `getWebClient` is exported dead code
- Severity: low
- Category: maintainability
- Location: `packages/database/src/client.ts:49-63`, re-exported at `packages/database/src/index.ts:12`
- Observation: `getWebClient` is annotated `@deprecated` (client.ts:34-48) and the JSDoc explicitly notes "no longer used by any consumer in the monorepo." Grep across `apps/` and `packages/` confirms zero call sites: the web portal uses `createBrowserClient<Database>(...)` from `@supabase/ssr` directly (`apps/web-portal/lib/supabase.ts:15`).
- Why it matters: Dead public API increases the blast radius of future refactors, invites accidental re-adoption of the (deprecated) plain-client path — which would break SSR session-cookie semantics — and keeps the deprecation comment permanently mis-synced with reality.
- Suggested direction: Remove the export from `index.ts`, delete the function from `client.ts`, and either drop the `docs/project/04-web-portal.md` reference (if any) or update it to document the `@supabase/ssr` pattern.
- Confidence: confirmed
- Evidence: `Grep "getWebClient"` returns only the definition and the re-export; `apps/web-portal/lib/supabase.ts:1-18` shows the portal has migrated to `createBrowserClient`.

### REV-09-b: Architecture doc out of sync with actual web-portal client pattern
- Severity: low
- Category: conventions
- Location: `agent_docs/architecture.md:48`, contradicted by `apps/web-portal/lib/supabase.ts:15-18` and `apps/web-portal/lib/supabase-server.ts:18-39`
- Observation: The architecture doc asserts "Each app creates its own typed client via `@eatme/database` factory, passing env vars explicitly." In reality the web portal instantiates `createBrowserClient<Database>` from `@supabase/ssr` directly, bypassing `@eatme/database`'s factory entirely. Only the mobile app still routes through `getMobileClient` (`apps/mobile/src/lib/supabase.ts:13`).
- Why it matters: Future contributors (or future agents) following CLAUDE.md pitfall #5 and architecture.md will look for a factory entrypoint on the web side and find none. The doc drift also hides a real architectural decision (cookie-based PKCE for SSR) that deserves to be documented, not ghosted.
- Suggested direction: Update `agent_docs/architecture.md:46-48` to describe the split explicitly: mobile uses `getMobileClient` from `@eatme/database`; web uses `@supabase/ssr` `createBrowserClient`/`createServerClient` with env vars passed at the call site. Optionally host small web-side wrappers inside `@eatme/database` once `@supabase/ssr` is a peer dep.
- Confidence: confirmed
- Evidence: Direct comparison of architecture.md:48 with the web-portal call sites above; `packages/database/src/client.ts:34-48` admits the web client left the factory.

### REV-09-c: Service-role client is untyped (missing `<Database>` generic)
- Severity: medium
- Category: maintainability
- Location: `apps/web-portal/lib/supabase-server.ts:73-90`
- Observation: `createServerSupabaseClient` (the service-role admin client) is declared as `export function createServerSupabaseClient() { ... return createClient(url, serviceKey, { ... }); }`. The `<Database>` generic is not applied, so callers receive `SupabaseClient<any, "public", any>`. The browser client (`apps/web-portal/lib/supabase.ts:15`) and the cookie-session server client (`supabase-server.ts:18`, `:48`) both pass `<Database>` correctly.
- Why it matters: Consumer routes use `ReturnType<typeof createServerSupabaseClient>` as their client type (`apps/web-portal/app/api/menu-scan/route.ts:299,397,416,493,549`, `menu-scan/suggest-ingredients/route.ts:201`, `menu-scan/confirm/route.ts:343`, `admin/import/google/route.ts`, `admin/import/csv/route.ts`, `ingredients/route.ts`). All of these service-role writes — the highest-blast-radius surface in the app, since service role bypasses RLS — lose table/column name checking. A typo like `.from('restarants')` or `.update({ is_verifed: true })` will compile cleanly and fail only at runtime.
- Suggested direction: Change the return statement to `return createClient<Database>(url, serviceKey, { ... })` and import `Database` from `@eatme/database` (already imported in the same file at `:5`). No API change for callers.
- Confidence: confirmed
- Evidence: `supabase-server.ts:1` imports `createClient from '@supabase/supabase-js'`; `:84` shows the untyped call. Compare with `:18` and `:48` which both pass `<Database>`.

### REV-09-d: Inconsistent env-var validation between browser and server clients
- Severity: low
- Category: dx
- Location: `apps/web-portal/lib/supabase-server.ts:19-20` and `:49-50`, compared with `apps/web-portal/lib/supabase.ts:7-13` and `supabase-server.ts:74-81`
- Observation: The browser client and the service-role client both check their env vars explicitly and throw a human-readable error if missing (`supabase.ts:7-13`, `supabase-server.ts:77-81`). The cookie-session clients (`createSupabaseSessionClient` and `createMiddlewareClient`) instead use `process.env.NEXT_PUBLIC_SUPABASE_URL!` with a non-null assertion. If the env var is missing, callers get a TypeScript-erased `undefined` passed into `createServerClient`, which throws a generic "supabaseUrl is required" error deep inside `@supabase/ssr`.
- Why it matters: Inconsistent failure modes across otherwise-symmetric factory functions. In production the middleware runs on every request; an environment misconfiguration will surface as a cryptic 500 rather than a specific "Missing NEXT_PUBLIC_SUPABASE_URL" log, making operational triage slower.
- Suggested direction: Hoist a single helper (e.g. `readSupabaseEnv(): { url: string; anonKey: string }`) in `supabase-server.ts` that validates once, then reuse it in both `createSupabaseSessionClient` and `createMiddlewareClient`. Remove the `!` assertions.
- Confidence: confirmed
- Evidence: Cited lines above.

### REV-09-e: Mobile edge-function services duplicate env-var reads instead of reusing the client
- Severity: low
- Category: maintainability
- Location: `apps/mobile/src/services/edgeFunctionsService.ts:3-5` and `apps/mobile/src/services/interactionService.ts:16-18`
- Observation: Both modules top-level-evaluate `const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL ?? ''` and `const SUPABASE_ANON_KEY = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ?? ''`, then build edge-function URLs by string concatenation (`${SUPABASE_URL}/functions/v1/...`) and manually attach `Authorization: Bearer ${SUPABASE_ANON_KEY}` headers. `apps/mobile/src/lib/supabase.ts:13-17` already reads the same env vars and constructs the client. These services both import `supabase` from `../lib/supabase` anyway, so they could call `supabase.functions.invoke('feed', ...)` instead, which handles the URL, auth header, and anon-key forwarding automatically.
- Why it matters: (1) Three call sites duplicate the env-var contract; a missing URL silently becomes `'/functions/v1/feed'` (relative URL → likely `no-scheme` fetch failure on RN) rather than a clear startup error. (2) The manual `Bearer ${anonKey}` header is wrong for authenticated users — it should carry the session access token so Edge Functions can resolve `auth.uid()`. `supabase.functions.invoke` does that automatically; the current code effectively always runs as anon.
- Suggested direction: Replace the manual `fetch` blocks with `supabase.functions.invoke('feed', { body: request })`. Verify whether the feed/update-preference-vector Edge Functions rely on `auth.uid()`; if so this finding upgrades to a correctness issue (see follow-up question below).
- Confidence: likely (finding is confirmed; the auth-uid consequence is `needs-verification`)
- Evidence: `edgeFunctionsService.ts:150-165` — `Authorization: Bearer ${SUPABASE_ANON_KEY}` with no session token; `interactionService.ts:61-74` — same pattern.

### REV-09-f: Silent fallbacks mask missing Expo env vars
- Severity: low
- Category: dx
- Location: `apps/mobile/src/lib/supabase.ts:13-17`
- Observation: `getMobileClient(process.env.EXPO_PUBLIC_SUPABASE_URL ?? '', process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ?? '', AsyncStorage)`. The `?? ''` fallbacks turn missing env vars into empty strings. `getMobileClient` then throws at client.ts:80-85 because the guard sees an empty string as falsy — but the guard message says "Pass process.env.EXPO_PUBLIC_SUPABASE_URL..." without indicating which variable is missing.
- Why it matters: During a fresh `expo start` without a `.env`, the failure message is one step removed from the root cause. Mobile dev loop cost is small but real. The `edgeFunctionsService`/`interactionService` copies (REV-09-e) use the same `?? ''` fallback but skip the guard entirely, so they silently issue malformed requests.
- Suggested direction: Either (a) keep the `?? ''` and enhance the factory guard to report which field is empty, or (b) drop the fallbacks and pass the raw values, so an undefined propagates into the clearer `createClient` error path. Option (a) is less invasive.
- Confidence: confirmed
- Evidence: cited lines; factory guard at `packages/database/src/client.ts:80-85`.

### REV-09-g: `createSupabaseMock` test helper is exported but has no consumers
- Severity: low
- Category: dx
- Location: `apps/web-portal/test/helpers/mockSupabase.ts:14-45`, re-exported at `apps/web-portal/test/helpers/index.ts:13`
- Observation: `createSupabaseMock` returns a mock shaped around `createClient` from `@supabase/supabase-js` (it exposes `createClient: vi.fn().mockReturnValue(mockChain)`). Grep across the repo finds no consumer — every test that mocks Supabase builds its own chain locally (see `apps/web-portal/test/import-service.test.ts:248-311` which declares its own `createMockSupabase` inside the test). The helper also won't correctly intercept the production code path, which uses `createBrowserClient` from `@supabase/ssr`, not `createClient` from `@supabase/supabase-js`.
- Why it matters: Dead export + wrong shape = a trap for whoever next adds a Supabase-touching test. They'll import it, it'll appear to work (the chain resolves `null`), and their assertions will pass because nothing is being mocked properly.
- Suggested direction: Delete `mockSupabase.ts` and the re-export from `test/helpers/index.ts`. If a shared helper is still wanted, build it around `createBrowserClient` / `createServerClient` and add at least one consuming test.
- Confidence: confirmed
- Evidence: `Grep "createSupabaseMock"` returns only the definition and re-export; `import-service.test.ts:302` uses a local `createMockSupabase` (different symbol).

## No issues found in

- `apps/web-portal/next.config.ts` `transpilePackages: ['@eatme/database', '@eatme/shared']` — matches every workspace package currently imported by the portal (`@eatme/tokens` is declared as a dep in `package.json:16` but never imported, so its absence from the list is correct today).
- `apps/mobile/metro.config.js` — `watchFolders`, `unstable_enableSymlinks`, and `nodeModulesPaths` are correctly configured for pnpm workspaces; no Supabase client wiring lives here.
- `packages/database/src/index.ts` export surface — `Database`, `Json`, `Tables`, `TablesInsert`, `TablesUpdate`, `Enums`, `Constants` are all re-exported; consumers never reach into `./types` directly.
- `packages/database/package.json` — `main`/`types` both point at `./src/index.ts` (TS source, as expected for a `transpilePackages`-consumed workspace package); `@supabase/supabase-js` is a regular dep; `react` is an optional peer dep (unused today but harmless).
- `packages/database/tsconfig.json` — `composite: true`, `declaration: true`, strict mode; no `moduleResolution` footguns.
- `apps/web-portal/middleware.ts` — consumer of `createMiddlewareClient` is correctly wired, runs `auth.getUser()` every request to refresh cookies. (Any deeper middleware findings belong to REV-02.)
- `infra/scripts/batch-embed.ts` — service-role CLI script; typed-client loss here is acceptable since it operates on two hard-coded tables and uses RPC by name. Out of scope for the "client factory contract" review.
- Literal-key static-replacement contract — every call site reads `process.env.NEXT_PUBLIC_SUPABASE_*` / `process.env.EXPO_PUBLIC_SUPABASE_*` with literal keys (verified across 7 files via Grep); no computed-key regressions of the CLAUDE.md pitfall #4 class.

## Follow-up questions

1. Do the `feed`, `update-preference-vector`, and other mobile-invoked Edge Functions rely on `auth.uid()` or a Bearer session token rather than the anon key? If yes, REV-09-e upgrades from maintainability to correctness/security because every request from `edgeFunctionsService.ts:156` and `interactionService.ts:67` currently carries only the anon key. (Needs-verification: inspect the Deno function handlers for `const { data: { user } } = await supabase.auth.getUser(token)` or similar — partially in REV-05's scope but the client-side smell belongs here.)
2. Is `@eatme/tokens` expected to become a runtime dep of the web portal? If so, `next.config.ts` `transpilePackages` should be expanded to include it before the first import, otherwise the first `import { colors } from '@eatme/tokens'` will break SSR at build time.
3. Is the deprecation of `getWebClient` permanent, or is there a roadmap to fold `createBrowserClient<Database>` / `createServerClient<Database>` wrappers back into `@eatme/database` so both apps share a single factory package? The current state pays ongoing doc-drift cost for no structural benefit.
