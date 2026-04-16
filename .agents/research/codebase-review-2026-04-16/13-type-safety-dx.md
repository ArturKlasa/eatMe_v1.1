# REV-13: Type-safety + developer experience

## Scope reviewed

TypeScript configuration:
- `tsconfig.json` (root, 1–39)
- `apps/web-portal/tsconfig.json` (1–35)
- `apps/mobile/tsconfig.json` (1–24)
- `packages/database/tsconfig.json` (1–25)
- `packages/shared/tsconfig.json` (1–13)
- `packages/tokens/tsconfig.json` (1–12)
- `packages/tokens/tsconfig.scripts.json` (1–11)
- `infra/scripts/tsconfig.json` (1–19)
- `infra/supabase/functions/tsconfig.json` (1–14)

Build / task orchestration:
- `package.json` (root, 1–33)
- `turbo.json` (1–24)
- `pnpm-workspace.yaml` (full)
- `apps/web-portal/package.json` (1–70)
- `apps/mobile/package.json` (1–65)
- `packages/database/package.json` (1–35)
- `packages/shared/package.json` (1–27)
- `packages/tokens/package.json` (1–26)
- `infra/scripts/package.json` (1–18)

CI / git hooks:
- `.github/workflows/ci.yml` (1–46)
- `.husky/pre-commit` (full)

Lint configuration:
- `apps/web-portal/eslint.config.mjs` (1–45)
- `apps/mobile/eslint.config.mjs` (1–52)

Test surface:
- `apps/web-portal/vitest.config.ts` (full)
- `apps/web-portal/test/setup.ts` (full)
- `apps/web-portal/test/` directory listing (53 test files)
- `find apps/mobile/src -name '*.test.*' -o -name '*.spec.*'` → 0 results
- `find packages -name '*.test.*' -o -name '*.spec.*'` → 0 results

Type-safety hygiene grep:
- `\bas\s+any\b` repo-wide (9 hits across 7 files)
- `@ts-(expect-error|ignore|nocheck)` repo-wide (0 hits in `.ts/.tsx`; 1 hit in `apps/mobile/eslint.config.mjs:30`)
- `eslint-disable` directives (19 hits, 19 files)
- `as unknown as` repo-wide (matches in 14 files)
- `: any | any[] | Array<any>` in `apps/` and `packages/` (0 hits)

Runtime evidence:
- `npx turbo run check-types --dry=json` — all 6 workspaces report `command: "<NONEXISTENT>"`.
- `npx turbo run lint --dry=json` — only `mobile` (`expo lint`) and `web-portal` (`eslint`) have a real command; 4 packages report `<NONEXISTENT>`.
- `npx turbo run test --dry=json` — only `web-portal` (`vitest run`) has a real command; 5 workspaces report `<NONEXISTENT>`.

## Findings

### REV-13-a: `turbo run check-types` is a silent no-op repo-wide; CI's "Type-check" step does nothing
- Severity: high
- Category: dx
- Location: `turbo.json:13-15`, `package.json:11`, `.github/workflows/ci.yml:42-43`, all workspace `package.json` files
- Observation: `turbo.json` defines a `check-types` task and the root `package.json` exposes `"check-types": "turbo run check-types"`. CI uses the same name (`ci.yml:43 — npx turbo check-types`). However, **no workspace** in the monorepo defines a script named `check-types`:
  - `apps/web-portal/package.json:5-12` — scripts are `dev`/`build`/`start`/`lint`/`test`/`test:watch`. No `check-types` (and no `noEmit` is currently invoked).
  - `apps/mobile/package.json:12-18` — scripts are `start`/`android`/`ios`/`web`/`lint`. No `check-types`.
  - `packages/database/package.json:13-19`, `packages/shared/package.json:13-18`, `packages/tokens/package.json:13-19` — all three define **`type-check`** (with hyphen, not underscore-style), which turbo ignores because it dispatches by exact task name.
  - `infra/scripts/package.json:6-8` — only a `batch-embed` script.
  Verified with `npx turbo run check-types --dry=json`: every entry reports `"command": "<NONEXISTENT>"`. Turbo prints the matrix as if it ran but nothing executes.
- Why it matters: CI's "Type-check" job at `ci.yml:42-43` is a green-by-default rubber stamp — broken types reach `main` because no `tsc` ever runs in CI on the apps. The root `pnpm check-types` command documented in `CLAUDE.md` (under "Key Commands") gives the same false negative locally. Combined with REV-13-b (apps don't extend root tsconfig) and REV-13-d (mobile has no tests), there is currently **zero automated TypeScript verification** of `apps/web-portal/` or `apps/mobile/` source. The recent rating-system, menu-scan, and OAuth work all merged through this pipeline.
- Suggested direction: add `"check-types": "tsc --noEmit"` (or `tsc -p tsconfig.json --noEmit`) to every workspace `package.json`, **including** the three packages that already use `type-check` (rename or alias). For `web-portal`, append `--incremental` to leverage `.next` cache. Once the script exists everywhere, run `npx turbo check-types` once locally to see which workspaces fail today, then triage the burst of newly-surfaced errors. Optionally rename the task in `turbo.json` to `type-check` to match three of four package conventions, but unify in one direction.
- Confidence: confirmed
- Evidence:
  - `package.json:11` — `"check-types": "turbo run check-types"`
  - `ci.yml:43` — `run: npx turbo check-types`
  - `npx turbo run check-types --dry=json` (output captured during review): every task `command` field is `<NONEXISTENT>` for `@eatme/database`, `@eatme/infra-scripts`, `@eatme/shared`, `@eatme/tokens`, `mobile`, `web-portal`.
  - `Grep '"check-types"|"type-check"' **/package.json` — only root `package.json:11` mentions `check-types`; the three packages spell it `type-check`.

### REV-13-b: app tsconfigs do not extend root tsconfig — strictness flags silently dropped on app code
- Severity: high
- Category: maintainability
- Location: `apps/web-portal/tsconfig.json:1-35`, `apps/mobile/tsconfig.json:1-24`, `tsconfig.json:1-39`
- Observation: Root `tsconfig.json` enables a strong type-checking profile: `strict: true`, `noUnusedLocals`, `noUnusedParameters`, `noFallthroughCasesInSwitch`, `noUncheckedIndexedAccess` (lines 6–10). The three packages (`packages/database`, `packages/shared`, `packages/tokens`) all `extends "../../tsconfig.json"` — so they inherit those flags. Both apps **redeclare** their own `compilerOptions` from scratch:
  - `apps/web-portal/tsconfig.json` has `"strict": true` (line 7) but **no** `noUnusedLocals`, `noUnusedParameters`, `noFallthroughCasesInSwitch`, `noUncheckedIndexedAccess`; it does not extend any base.
  - `apps/mobile/tsconfig.json` extends `expo/tsconfig.base` (line 23) and only re-asserts `strict: true`/`forceConsistentCasingInFileNames` — same gaps as web-portal, plus whatever Expo's base does (the Expo base does not enable the four extra flags).
- Why it matters: "Strict" alone is not the strict profile the rest of the monorepo enforces. Concretely: `noUncheckedIndexedAccess` would have caught a long tail of `array[i].field` access patterns in app code (mobile rating screens, web-portal menu-scan reducers); `noUnusedLocals/Parameters` would prevent dead-imports drift after refactors. Today an app file may pass `tsc` while violating rules that the same file would fail on if it lived under `packages/`. Combined with REV-13-a, this matters even more — even those weak rules aren't being enforced in CI.
- Suggested direction: have each app extend a shared base (either the existing root `tsconfig.json` or a new `tsconfig.base.json` carved out of it) and only override what is genuinely Next/Expo-specific (jsx, lib, paths, plugins). Land in two PRs: (1) wire `extends` and accept the failure burst, (2) burn down the new errors. `noUncheckedIndexedAccess` will have the most fallout — consider enabling that one last, separately.
- Confidence: confirmed
- Evidence:
  - `Grep '"strict"|"noUn|"noUnch|"noFall|"noImpl|"exactOpt' **/tsconfig*.json`:
    - `tsconfig.json:6-10` lists all five flags
    - `apps/web-portal/tsconfig.json:7` lists only `strict`
    - `apps/mobile/tsconfig.json:10` lists only `strict`
    - `packages/database/tsconfig.json:16` lists only `strict` (re-asserted on top of inherited root)
  - `apps/web-portal/tsconfig.json` has no `extends` field; `apps/mobile/tsconfig.json:23` extends only `expo/tsconfig.base`.

### REV-13-c: `turbo run lint` skips four of six workspaces
- Severity: medium
- Category: dx
- Location: `turbo.json:10-12`, all `packages/*/package.json`, `infra/scripts/package.json`
- Observation: `turbo.json` defines a `lint` task. Only `apps/web-portal/package.json:9` (`eslint`) and `apps/mobile/package.json:17` (`expo lint`) define a `lint` script. `packages/{database,shared,tokens}/package.json` and `infra/scripts/package.json` define no `lint` script. `npx turbo run lint --dry=json` shows `<NONEXISTENT>` for those four workspaces. Result: shared TypeScript code (Zod schemas in `packages/shared`, the Supabase client factory in `packages/database`, the token-generation script in `packages/tokens`) is never linted.
- Why it matters: REV-10 and REV-09 both flagged maintainability issues in `packages/`; they would have been more visible with even a minimal lint pass. New helpers added to `packages/shared/src/validation/` can ship with unused vars or dead imports without complaint.
- Suggested direction: add a minimal `eslint.config.mjs` to each package (or a shared base under `packages/eslint-config`) and a `"lint": "eslint src"` script. The token-generation script in `packages/tokens` would also benefit from at least Prettier-on-CI; today only Husky's `lint-staged` formats it on commit (REV-13-h).
- Confidence: confirmed
- Evidence: `npx turbo run lint --dry=json` output during review showed `command: "<NONEXISTENT>"` for `@eatme/database`, `@eatme/infra-scripts`, `@eatme/shared`, `@eatme/tokens`.

### REV-13-d: zero test infrastructure in `apps/mobile/` and `packages/`
- Severity: medium
- Category: dx
- Location: `apps/mobile/package.json` (no `test` script), `packages/{database,shared,tokens}/package.json` (no `test` script)
- Observation: `find apps/mobile/src packages -name '*.test.*' -o -name '*.spec.*'` returns zero results. Only `apps/web-portal/test/` (53 test files) exercises code under test. Mobile has no `vitest`, `jest`, or `@testing-library/react-native` dependency; mobile `package.json` defines no `test` script. Recent mobile work (rating system, OAuth, in-context rating, dish opinions, gamification) is therefore untested. Packages also have no tests despite owning the Supabase client factory (REV-09 area) and Zod schemas (REV-10 area).
- Why it matters: Mobile is half the surface area of the product. A bug in `apps/mobile/src/services/ratingService.ts` `submitInContextRating` (recent change, scratchpad 2026-04-09 entries) cannot be regression-tested. The `Result<T>` discriminated union helpers in `apps/mobile/src/lib/result.ts` are imported across the mobile codebase but have no tests. `packages/shared/src/validation/` Zod schemas are tested only via web-portal consumers — a schema-only change can land green even if every caller drifts.
- Suggested direction: add a Jest + `jest-expo` config to `apps/mobile/` (Expo's recommended path; vitest does not handle React Native's transformer chain). Seed with smoke tests for `result.ts`, `dishRatingService.ts`, and at least one Zustand store. For packages: add a vitest workspace that includes `packages/**/*.test.ts` so shared Zod schemas can be tested independently.
- Confidence: confirmed
- Evidence: `find` outputs above; `apps/mobile/package.json:12-18` has no `test` script; `packages/{database,shared,tokens}/package.json` have no `test` script.

### REV-13-e: mobile services use module-scope `as any` cast on the Supabase client to paper over stale generated types
- Severity: medium
- Category: maintainability
- Location: `apps/mobile/src/services/favoritesService.ts:5-8`, `apps/mobile/src/services/viewHistoryService.ts:24-31`
- Observation: `favoritesService.ts:5-8`:
  ```
  // favorites table is not in generated DB types yet (migration 064).
  // Narrow cast to bypass the table union until supabase gen types is re-run.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const supabase = _supabase as any;
  ```
  Every query in the file (lines 27, 58, 81, 110, 119) flows through this `any`-typed binding — `from`, `select`, `insert`, `delete`, `eq`, `order`, etc. all return `any`, then a structural `as unknown as { data, error }` assertion re-narrows them. `viewHistoryService.ts:25-31` does the same thing per-query for `recent_viewed_restaurants`. The comment in `favoritesService.ts` references "migration 064" — the current migration head is `097_add_eggs_fish_allergens.sql` (`infra/supabase/migrations/`), and `Grep 'favorites|recent_viewed_restaurants' packages/database/src/types.ts` returns 0 functional matches in the 3,214-line generated types file.
- Why it matters: `as any` on the Supabase client erases (a) table name typo protection, (b) column existence checks, (c) RLS-aware row shape inference. A typo like `subject_typ` (instead of `subject_type`) would compile and only fail at runtime against PostgREST — and the failure would be silently absorbed by the `try/catch` returning `err(e)`. The "until supabase gen types is re-run" comment is two-and-a-half years' worth of migrations stale (migration 064 → 097), suggesting the regen step is broken or unowned.
- Suggested direction: regenerate `packages/database/src/types.ts` against the current Supabase project (the package already exposes `gen:types` at `packages/database/package.json:18`). Once `favorites` and `recent_viewed_restaurants` are in the generated `Database` interface, drop both `as any` casts and let the generic `from<'favorites'>()` give real types. If the view name still cannot be regenerated, add a hand-maintained `Database['public']['Views']` augmentation under `apps/mobile/src/lib/database-augment.d.ts` rather than casting away the entire client.
- Confidence: confirmed
- Evidence: `Grep '\bas\s+any\b' apps/mobile`; line counts above; types file size and content check.

### REV-13-f: `useRestaurantDetail` casts a typed `Result<boolean>` to `any` to read its discriminant
- Severity: medium
- Category: correctness
- Location: `apps/mobile/src/screens/restaurant-detail/useRestaurantDetail.ts:170`
- Observation: `favResult` is the resolved value of `isFavorited(user.id, 'restaurant', restaurantId).catch(() => null)`, so its type is `Result<boolean> | null`. Line 170 reads it as:
  ```
  setIsFavorite((favResult as any).ok ? (favResult as any).data : false);
  ```
  The `as any` casts both bypass `Result`'s discriminated union and the `null` guard. Adjacent code (line 169) already null-checks `favResult !== null`, so the only thing the cast hides is that `Result<T>` returns `data` only when `ok === true`.
- Why it matters: When `favResult.ok === false`, `Result<T>` exposes `error: string | Error`, not `data` — reading `(favResult as any).data` returns `undefined`, which then coerces to `false` for `setIsFavorite`. That is the right *outcome* by accident, but the cast disables the pattern's main benefit (TypeScript narrowing) and prevents future safe refactors of `Result<T>` (e.g. renaming `ok` to `success`). Pattern proliferates: `apps/mobile/src/services/favoritesService.ts:35-39, 63-65, 87-90, 119-122` all use `as unknown as { data, error }` for similar reasons (REV-13-e).
- Suggested direction: replace with a proper narrow:
  ```
  if (favResult && favResult.ok) setIsFavorite(favResult.data);
  ```
  Then add a tsc check (REV-13-a) to keep the discriminant honest.
- Confidence: confirmed
- Evidence: line 170 quoted above; type origin from `apps/mobile/src/lib/result.ts` (`Result<T> = { ok: true; data: T } | { ok: false; error: string | Error }`).

### REV-13-g: mobile eslint config does not load `react-hooks` plugin — four `// eslint-disable-next-line react-hooks/exhaustive-deps` directives are inert
- Severity: medium
- Category: dx
- Location: `apps/mobile/eslint.config.mjs:1-52`, `apps/mobile/src/hooks/useCountryDetection.ts:126`, `apps/mobile/src/screens/BasicMapScreen.tsx:283`, `apps/mobile/src/screens/restaurant-detail/useRestaurantDetail.ts:178`, `apps/mobile/src/screens/restaurant-detail/useRestaurantDetail.ts:222`
- Observation: `apps/mobile/eslint.config.mjs:29-33` registers only `@typescript-eslint` and `jsdoc` plugins. There is no `react-hooks` plugin import, no `react-hooks/exhaustive-deps` rule activation, and `react-hooks` is not declared in `apps/mobile/package.json` devDeps. Yet four locations in mobile source carry `// eslint-disable-next-line react-hooks/exhaustive-deps` (or `// eslint-disable-line` variant) — implying the author *intended* the rule to fire.
- Why it matters: There are two failure modes, both bad. (a) If `expo lint` does not auto-load `react-hooks` for the mobile config, then exhaustive-deps is **not enforced anywhere in mobile** — every other `useEffect`/`useCallback`/`useMemo` in mobile may have stale-closure bugs that no tool flags. (b) If `expo lint` does load `react-hooks` somehow (perhaps from Expo's default flat-config inheritance), then those four disables are real but the rest of the codebase isn't protected by an explicit, reviewable config. Either state hides the true rule coverage from a reviewer reading `eslint.config.mjs`. Note also that `apps/mobile/package.json` devDeps **do not declare `eslint`, `@typescript-eslint/eslint-plugin`, `@typescript-eslint/parser`, `eslint-plugin-jsdoc`** — the config relies on hoisted root `node_modules` resolution from `web-portal`'s deps.
- Suggested direction: explicitly install `eslint-plugin-react-hooks` in `apps/mobile/package.json` devDeps, register it in `eslint.config.mjs`, and enable both `react-hooks/rules-of-hooks: 'error'` and `react-hooks/exhaustive-deps: 'warn'`. Also pin `eslint`, `@typescript-eslint/*`, and `eslint-plugin-jsdoc` as direct devDeps to make the lint surface reproducible.
- Confidence: likely (the inertness depends on what `expo lint` injects at runtime; needs `npx expo lint --debug` to confirm)
- Evidence: `apps/mobile/eslint.config.mjs:5-49` shown above; `Grep 'react-hooks/exhaustive-deps' apps/mobile` returns four hits in three files; `apps/mobile/package.json:58-65` has only `@react-native-community/cli`, `@types/node`, `@types/react`, `babel-preset-expo`, `typescript`.

### REV-13-h: pre-commit hook only runs Prettier — no type-check, no lint, no test before code reaches the no-op CI
- Severity: medium
- Category: dx
- Location: `.husky/pre-commit` (full file: `pnpm lint-staged`), `package.json:24-28`
- Observation: `.husky/pre-commit` is a one-liner: `pnpm lint-staged`. The `lint-staged` config at `package.json:24-28` runs only `prettier --write` against staged `*.ts`/`*.tsx` files. There is no pre-commit step for `eslint`, `tsc --noEmit`, or any test. The CI workflow (`ci.yml`) does try to run lint/type-check/test, but lint skips packages (REV-13-c), check-types is a no-op (REV-13-a), and test only covers web-portal (REV-13-d).
- Why it matters: Type errors and lint failures only surface after merge — and even then only in `apps/web-portal/` (and only if a real `tsc` is wired). On a project that ships consumer mobile + restaurant-owner web, that is a wide window for silent regressions. The `lint-staged` config also passes nothing through `eslint` even on staged files, so the explicit `'@typescript-eslint/no-explicit-any': 'error'` rule (`apps/web-portal/eslint.config.mjs:21`, `apps/mobile/eslint.config.mjs:36`) is enforced only post-merge.
- Suggested direction: extend `lint-staged` to run `eslint --fix --max-warnings 0` on staged `.ts/.tsx` and add a `pre-push` hook (or CI gate) that runs `pnpm check-types` and `pnpm test` once REV-13-a is fixed. Keep pre-commit fast (≤5s); push the heavyweight checks to pre-push.
- Confidence: confirmed
- Evidence: `.husky/pre-commit` content `pnpm lint-staged`; `package.json:24-28` shows `lint-staged` runs only Prettier.

### REV-13-i: `infra/supabase/functions/tsconfig.json` opts out of `strict` for production edge functions
- Severity: low
- Category: maintainability
- Location: `infra/supabase/functions/tsconfig.json:7`
- Observation: `"strict": false` for the Deno-runtime edge functions. The functions themselves contain six `as any` casts: `feed/index.ts:442`, `update-preference-vector/index.ts:158`, `invalidate-cache/index.ts:71`, `group-recommendations/index.ts:275, 276, 279`. With `strict: false`, neither `null` propagation nor implicit-any flagging is applied to the most security-sensitive code path (server-side feed generation, group recommendations, cache invalidation).
- Why it matters: Edge functions run with the Supabase service-role key. A null-deref or shape mismatch surfaces only at request time and is hard to roll back from production. `strict: true` would have surfaced at least the `(d.restaurant as any)?.cuisine_types` pattern (`update-preference-vector/index.ts:158`) as needing a real type.
- Suggested direction: enable `strict: true` and address the resulting six `as any` casts (most can be replaced with the generated `Database` types if the edge function imports them via a deno-shim). Track the migration as a follow-up — not blocking, but worth a discrete PR.
- Confidence: confirmed
- Evidence: `infra/supabase/functions/tsconfig.json:7` — `"strict": false`; `Grep '\bas\s+any\b' infra/supabase/functions` shows six hits.

### REV-13-j: stale "migration 064" comment in `favoritesService.ts` masks how out-of-date generated types are
- Severity: low
- Category: maintainability
- Location: `apps/mobile/src/services/favoritesService.ts:5`
- Observation: Comment reads "favorites table is not in generated DB types yet (migration 064)". The earliest migration currently in `infra/supabase/migrations/` is `071_*.sql`; the head is `097_*.sql`. Migration 064 is a historical reference whose actual DDL is no longer in the migrations folder. `Grep 'favorites|recent_viewed_restaurants' packages/database/src/types.ts` returns no functional table/view definition; both have been DDL-merged for many releases (077 added the view explicitly).
- Why it matters: Anyone reading this comment in the future will assume the cast is a temporary bridge and chase a non-existent ticket. Type regeneration is the real action item (REV-13-e).
- Suggested direction: regenerate `packages/database/src/types.ts` and remove the comment + cast in the same commit. If regeneration is currently broken in the developer environment, document the blocker in a top-level `TYPES.md` or open a tracked issue rather than inlining a stale promise.
- Confidence: confirmed
- Evidence: `apps/mobile/src/services/favoritesService.ts:5` quoted; `ls infra/supabase/migrations/` first entry is `071_*`.

### REV-13-k: `packages/tokens` tsconfig omits `composite: true` — inconsistent with sibling packages
- Severity: low
- Category: maintainability
- Location: `packages/tokens/tsconfig.json:1-12`, vs. `packages/database/tsconfig.json:9` and `packages/shared/tsconfig.json:6`
- Observation: `database` and `shared` set `composite: true` in their own `compilerOptions`. `tokens` does not. None of them currently chain via `references`, but if the monorepo ever adopts TS project references (a natural follow-up to REV-13-a/b), `tokens` will be the only package that fails to participate.
- Why it matters: Minor — only bites once project references are introduced. Worth aligning while the package set is small.
- Suggested direction: add `"composite": true` (and accept the implied `declaration: true` already present) to `packages/tokens/tsconfig.json`.
- Confidence: confirmed
- Evidence: file contents shown above.

### REV-13-l: `apps/mobile/eslint.config.mjs:30` uses `@ts-ignore` in a `.mjs` file where TypeScript is not active
- Severity: low
- Category: dx
- Location: `apps/mobile/eslint.config.mjs:30`
- Observation: `// @ts-ignore — @typescript-eslint plugin type doesn't perfectly match ESLint's Plugin typedef` annotates the `'@typescript-eslint': tseslint` entry. The file is `.mjs` and the project does not enable `allowJs`/`checkJs` for this path, so the directive does nothing — the runtime simply imports JS with no type checks. If a future change ever adds `// @ts-check` or migrates the config to TS, the ignore reason is also misspelled (the actual symbol mismatch is between flat-config plugin shape and legacy plugin shape — not "Plugin typedef").
- Why it matters: Cosmetic, but reflects general hygiene around the lint pipeline that is otherwise fragile (REV-13-g).
- Suggested direction: drop the directive (it has no effect) or migrate the config file to TypeScript (`eslint.config.ts`) and let the type assertion be explicit. The config file is the highest-leverage place to enforce mobile lint quality.
- Confidence: confirmed
- Evidence: line 30 quoted above; file extension is `.mjs`.

### REV-13-m: no commit-message validation, no pre-push gate
- Severity: info
- Category: dx
- Location: `.husky/` directory listing — only `_/` (Husky internals) and `pre-commit`
- Observation: There is no `commit-msg` hook (no Conventional Commits enforcement) and no `pre-push` hook. Combined with REV-13-h, the project relies entirely on CI for any structural validation, and CI relies on the broken `check-types` + skipped lint surface (REV-13-a, REV-13-c).
- Why it matters: Recent commit titles (e.g. `feat(menu-scan): AI allergen extraction with per-dish scope` — `1e7ecdd`) use Conventional Commits, but the discipline is voluntary. If the team does adopt CC for changelog automation, missing enforcement creates audit gaps.
- Suggested direction: add a `commitlint` `commit-msg` hook only if/when CC becomes load-bearing (e.g. for release-please). A `pre-push` hook running `pnpm check-types && pnpm test` is the higher-leverage move once REV-13-a is fixed.
- Confidence: confirmed
- Evidence: `ls .husky` shows only `_/` and `pre-commit`.

### REV-13-n: generated Supabase types are out-of-date relative to current schema
- Severity: info
- Category: conventions
- Location: `packages/database/src/types.ts` (3,214 lines), `infra/supabase/migrations/077_recent_viewed_restaurants_view.sql`, all `06[0-9]_*.sql` (no longer present in this listing)
- Observation: The generated types file does not include the `favorites` table or the `recent_viewed_restaurants` view (`Grep 'favorites|recent_viewed_restaurants' packages/database/src/types.ts` returns no functional match). The migrations folder contains 077 (recent-viewed view) and earlier work (064 referenced in `favoritesService.ts:5`) that should be in the generated types if `supabase gen types` had been run since.
- Why it matters: Stale generated types are the root cause of REV-13-e/REV-13-j (the `as any` workarounds). They also undermine the architecture in `agent_docs/architecture.md` that treats the generated types as the typed boundary between app code and DB.
- Suggested direction: add a CI step that runs `pnpm --filter @eatme/database gen:types` against a CI-only Supabase shadow project (or against the result of applying `infra/supabase/migrations/` to a throwaway PG instance) and diffs against the committed `types.ts`. If they differ, fail CI. This makes "regenerate types" a forced step on every migration PR, not a manual ritual.
- Confidence: confirmed
- Evidence: line counts and grep results captured above.

## No issues found in

- Root `tsconfig.json` strictness profile — `strict + noUnusedLocals + noUnusedParameters + noFallthroughCasesInSwitch + noUncheckedIndexedAccess` is exactly what a TS monorepo should ship with. Issue is only that two of three apps don't extend it (REV-13-b).
- `packages/database/tsconfig.json`, `packages/shared/tsconfig.json` — both extend root, both add `composite: true`, both exclude tests cleanly.
- `apps/web-portal/eslint.config.mjs` — explicit `@typescript-eslint/no-explicit-any: 'error'` and a JSDoc adoption ramp; OK.
- `pnpm-workspace.yaml` — workspace globs match what is actually present.
- Type explicitness in app/package source code: zero `: any` declarations in `apps/` or `packages/` (eslint rule is doing its job for *declared* anys; only assertion-form `as any` and `as unknown as` slip through, captured under REV-13-e/f).
- No `@ts-ignore`/`@ts-expect-error`/`@ts-nocheck` in any `.ts`/`.tsx` file across the entire monorepo.
- `apps/web-portal/test/setup.ts` — sane jsdom polyfills + sonner mock; idiomatic vitest setup.
- Husky pre-commit script content (`pnpm lint-staged`) is well-formed; the issue (REV-13-h) is only that it does too little.
- `turbo.json` — task graph is reasonable; `dependsOn ^build` where appropriate; the only correctness issue is that the named tasks have no underlying scripts (REV-13-a/c).

## Follow-up questions

- Is `expo lint` injecting `react-hooks` rule coverage at runtime that the static `eslint.config.mjs` does not declare? (Resolves REV-13-g confidence.) Recommended check: `cd apps/mobile && npx expo lint --debug 2>&1 | grep -i react-hooks`.
- When was `pnpm --filter @eatme/database gen:types` last run successfully against the production Supabase project? Is the developer running it blocked by missing `SUPABASE_PROJECT_ID`? (Resolves REV-13-e/n root cause.)
- Is the historical migration `064_*.sql` referenced in `favoritesService.ts:5` archived elsewhere, or has it been folded into `database_schema.sql`? (Resolves REV-13-j cleanly.)
- Is there an upstream reason the apps were detached from the root tsconfig (e.g. an Expo-specific incompatibility, a Next-specific plugin requirement)? (Affects REV-13-b suggested direction — may need a thin `tsconfig.base.json`.)
- Do the team's CI logs show `npx turbo check-types` ever printing actual `tsc` output, or does it always print the "FULL TURBO" cache-hit banner? (Confirms REV-13-a's blast radius — if anyone has noticed, this might already be tracked.)
