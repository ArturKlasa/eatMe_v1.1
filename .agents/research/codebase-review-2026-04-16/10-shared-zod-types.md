# REV-10: shared-zod-types — `@eatme/shared` constants/types/zod review

## Scope reviewed

- `packages/shared/package.json:1-28`
- `packages/shared/src/index.ts:1-3`
- `packages/shared/src/constants/index.ts:1-7`
- `packages/shared/src/constants/calendar.ts:1-13`
- `packages/shared/src/constants/cuisine.ts:1-87`
- `packages/shared/src/constants/dietary.ts:1-43`
- `packages/shared/src/constants/menu.ts:1-107`
- `packages/shared/src/constants/pricing.ts:1-25`
- `packages/shared/src/constants/restaurant.ts:1-69`
- `packages/shared/src/constants/wizard.ts:1-12`
- `packages/shared/src/types/index.ts:1-22`
- `packages/shared/src/types/restaurant.ts:1-199`
- `packages/shared/src/validation/index.ts:1-16`
- `packages/shared/src/validation/restaurant.ts:1-134`
- `apps/mobile/package.json:1-60` (dependency declaration audit)
- `apps/web-portal/package.json` (zod consumer version)
- `apps/mobile/src/constants/index.ts:1-11`
- `apps/mobile/src/constants/icons.ts:1-56`
- `apps/web-portal/lib/icons.ts:1-56`
- `apps/web-portal/lib/ingredients.ts:1-50` (Ingredient redefinition)
- `apps/web-portal/lib/supabase.ts:1-69`
- `apps/mobile/src/lib/supabase.ts:1-128`
- `apps/web-portal/next.config.ts` (transpilePackages spot-check)
- `infra/supabase/migrations/090_expand_dietary_tags.sql:1-21`
- `infra/supabase/migrations/093_unify_allergen_codes.sql:1-108`
- `infra/supabase/migrations/097_add_eggs_fish_allergens.sql:1-15`
- `infra/supabase/migrations/database_schema.sql:343, 355` (restaurant_type / service_speed columns)
- pnpm hoisted store: `node_modules/.pnpm` for `zod@*`, `packages/shared/node_modules/zod` resolution

Cross-references: REV-06 covered web-portal RHF + Zod *consumer* drift. REV-10 focuses on the shared package itself, the peer-dep contract, and consumer/code duplication of types/constants the shared package already owns.

## Findings

### REV-10-a: Allergen icon maps use legacy codes the DB no longer stores

- Severity: high
- Category: correctness
- Location:
  - `apps/mobile/src/constants/icons.ts:10-25` (`tree_nuts`, `soybeans`)
  - `apps/web-portal/lib/icons.ts:10-25` (identical legacy keys)
- Observation: Both `ALLERGEN_ICONS` maps key off legacy codes (`tree_nuts`, `soybeans`). Migration 093 (`infra/supabase/migrations/093_unify_allergen_codes.sql:11-93`) renormalises the canonical allergen codes to short forms (`nuts`, `soy`) and rewrites `dishes.allergens[]`, `dishes.allergens_override[]`, and `user_preferences.allergies[]` to the canonical names. After migration, the DB only stores `nuts`/`soy`; the icon lookup `getAllergenIcon('nuts')` / `getAllergenIcon('soy')` falls back to `⚠️` (icons.ts:48-50). Shared constants are correct: `packages/shared/src/constants/dietary.ts:31-40` already lists canonical `nuts`/`soy` with icons.
- Why it matters: User-visible allergen badges across mobile and web admin render the generic warning emoji instead of the specific allergen icon. Two of the most common allergens (tree nuts, soy) are silently degraded everywhere `ALLERGEN_ICONS` is consulted (e.g., `apps/web-portal/app/admin/menu-scan/components/DishEditPanel.tsx:421`). It also signals broader stale-icon risk because the same files are missing icons for `eggs`/`fish` added in migration 097.
- Suggested direction: Delete both `*/icons.ts` files and have consumers derive icons from the shared `ALLERGENS` / `DIETARY_TAGS` arrays (each entry already carries `icon`). One source of truth fixes this and the next finding in one move.
- Confidence: confirmed
- Evidence:
  - `093_unify_allergen_codes.sql:11-23` ensures canonical codes; lines 62-93 rewrite text[] columns; lines 31-57 delete legacy rows entirely. After this migration runs, no row in `allergens` has code `tree_nuts` or `soybeans`.
  - `apps/mobile/src/constants/icons.ts:15-18` maps `tree_nuts` and `soybeans` (no `nuts`/`soy` key).
  - `apps/web-portal/lib/icons.ts:15-18` identical.
  - `packages/shared/src/constants/dietary.ts:31-40` canonical: `nuts`, `soy`, includes `eggs`, `fish`.

### REV-10-b: Three sources of truth for allergen / dietary-tag icons

- Severity: high
- Category: maintainability
- Location:
  - `packages/shared/src/constants/dietary.ts:2-22, 30-40` (canonical, with `icon`)
  - `apps/mobile/src/constants/icons.ts:1-56`
  - `apps/web-portal/lib/icons.ts:1-56`
- Observation: The shared `DIETARY_TAGS` and `ALLERGENS` arrays already carry an `icon` field per entry. Both `apps/*/icons.ts` files duplicate that map and even document the duplication: `// Keep in sync with apps/web-portal/lib/icons.ts.` (mobile, line 6) and the symmetric note in web. The maps are textually identical and have already drifted from the canonical shared constants (REV-10-a) and from each other in icon choice (e.g., dietary `dairy_free` icon is `🥛` in shared vs `🚫` in icons files; `organic` is `♻️` in shared vs `🌿` in icons files; mobile/web include `raw`/`heart_healthy` codes that have no shared/DB equivalent and are missing `low_sodium`/`nut_free`/`egg_free`/`soy_free`/`buddhist`).
- Why it matters: Manual sync between three files via comments is the failure mode the shared package was created to prevent. The drift in REV-10-a is the first user-visible symptom; future tag additions will continue to show fallback icons.
- Suggested direction: Make shared the single source. Export `getDietaryTagIcon(code)` / `getAllergenIcon(code)` from `@eatme/shared` derived from the canonical arrays. Delete both `*/icons.ts` files. Treat divergent icons (e.g., `dairy_free 🥛` vs `🚫`) as a product decision and pick one in shared.
- Confidence: confirmed
- Evidence: file diffs above; `apps/mobile/src/constants/index.ts:8` re-exports from icons rather than from shared.

### REV-10-c: Zod major-version mismatch between `@eatme/shared` (v3) and consumers (v4)

- Severity: high
- Category: correctness
- Location:
  - `packages/shared/package.json:19-26` (peer `zod: ^3.0.0`)
  - `packages/shared/node_modules/zod/package.json` resolves to `3.25.76`
  - `apps/web-portal/package.json` declares `"zod": "^4.1.12"` → resolves to `zod@4.3.6` (in `node_modules/.pnpm`)
- Observation: `packages/shared/src/validation/restaurant.ts:1` does `import { z } from 'zod'` and emits schemas. With pnpm hoisting, the shared package gets its own `zod@3.25.76` (because the peer range is `^3.0.0`), while the web-portal consumer compiles and runs against `zod@4.3.6`. Web-portal callers like `apps/web-portal/components/forms/DishFormDialog.tsx:51` do `zodResolver(dishSchema)` where `dishSchema` is constructed under v3, but `zodResolver` is invoked from a context where `zod`'s TypeScript types are v4. Same for `apps/web-portal/app/onboard/menu/page.tsx:24` and `apps/web-portal/app/onboard/review/page.tsx:64` calling `basicInfoSchema.safeParse`.
- Why it matters: Zod v4 introduced breaking changes in error shape, `z.infer` semantics for `default()` / `optional()`, and runtime parser internals. Mixing major versions inside one app means: (a) two Zod runtimes are bundled into the web-portal client bundle (~50 KB extra), (b) `instanceof z.ZodError` checks may silently fail when the throwing schema is v3 but the catching code expects v4, (c) TypeScript inference (`z.infer<typeof dishSchema>`) compiles against the consumer's v4 types and may accept fields the v3 schema actually rejects at runtime. `@hookform/resolvers@5.2.2` glues over the gap via Standard Schema, but only because both v3.24+ and v4 implement that interface — the contract is fragile.
- Suggested direction: Pick one Zod major. Either (a) bump shared to `peerDependencies: { zod: ^4 }`, port schemas to v4 idioms (`z.string().regex(...)` is unchanged but `.default()` semantics differ), and align the web-portal version, or (b) pin all apps to v3 until shared is migrated. Add `peerDependencies` enforcement (drop `peerDependenciesMeta.zod.optional`) so installing an incompatible major fails loudly.
- Confidence: confirmed
- Evidence: `cat packages/shared/node_modules/zod/package.json | grep version` → `3.25.76`; `ls node_modules/.pnpm | grep ^zod` → `zod@3.25.76 zod@4.3.6`; `apps/web-portal/package.json` "zod": "^4.1.12".

### REV-10-d: Optional zod peer + barrel re-export is a runtime trap

- Severity: medium
- Category: conventions
- Location:
  - `packages/shared/package.json:19-26` (`peerDependenciesMeta.zod.optional: true`)
  - `packages/shared/src/index.ts:3` (`export * from './validation'` — unconditional)
  - `packages/shared/src/validation/restaurant.ts:1` (`import { z } from 'zod'`)
  - `apps/mobile/package.json:18-49` — no `zod` dependency declared
- Observation: The shared package marks zod as an *optional* peer but `packages/shared/src/index.ts` always re-exports the validation barrel, which immediately `import { z } from 'zod'`. Mobile's `package.json` declares no zod dependency at any level. It works today only because pnpm installs zod into `packages/shared/node_modules/zod` (since the peer was unsatisfied at the workspace root, pnpm self-installs the peer fallback). Any consumer that does `import { POPULAR_CUISINES } from '@eatme/shared'` (mobile does this at `apps/mobile/src/constants/index.ts:10`) transitively triggers the validation module, which loads zod.
- Why it matters: (a) Switching package managers (npm/yarn) or pnpm `node-linker=hoisted` mode would break the mobile app's bundle resolution. (b) The "optional" claim is false — *every* consumer of the barrel needs zod, regardless of whether they import a schema. (c) Mobile is paying the parse + bundle cost of all schemas for no benefit. (d) This is the same class of issue called out in CLAUDE.md pitfall #4 about transpilePackages — a deploy-time silent break.
- Suggested direction: Either (a) split the package: `@eatme/shared/constants`, `@eatme/shared/types`, `@eatme/shared/validation` as separate entry points so consumers opt in (requires a `package.json` `exports` map and dropping the top-level barrel), or (b) make zod a real `dependencies` entry and drop `peerDependenciesMeta`. Option (a) saves mobile bundle size; option (b) removes the resolution gamble.
- Confidence: confirmed
- Evidence: grep `"zod"` in `apps/mobile/package.json` → no match; `ls packages/shared/node_modules/zod` → present; mobile imports the barrel via `@eatme/shared` re-export chain.

### REV-10-e: `RestaurantType` union duplicated inside `@eatme/shared`

- Severity: medium
- Category: maintainability
- Location:
  - `packages/shared/src/types/restaurant.ts:135-146` (exported canonical `RestaurantType`)
  - `packages/shared/src/constants/restaurant.ts:1-11` (private `type RestaurantType` redeclared)
- Observation: The same 10-value union is declared in two files inside the same package. The constants file's local `RestaurantType` types the `RESTAURANT_TYPES` array; the types file's `RestaurantType` is what consumers import. They happen to match today; nothing forces them to in the future.
- Why it matters: Adding `'food_court'` to one and not the other compiles cleanly, then `RESTAURANT_TYPES` stops covering one of the legal `RestaurantBasicInfo.restaurant_type` values (or vice versa). The comment at `types/restaurant.ts:135` even claims the union must stay in sync with `RESTAURANT_TYPES` — but nothing enforces it.
- Suggested direction: Import the canonical `RestaurantType` from `../types/restaurant` into `constants/restaurant.ts` and delete the local redeclaration. Or invert: derive `RestaurantType` from `(typeof RESTAURANT_TYPES)[number]['value']` so the array is the single source.
- Confidence: confirmed
- Evidence: both blocks open with the identical 10-value union, declared in the same package.

### REV-10-f: Same payment-method union exported under two different names

- Severity: medium
- Category: maintainability
- Location:
  - `packages/shared/src/types/restaurant.ts:164` (`PaymentMethods = 'cash_only' | 'card_only' | 'cash_and_card'`)
  - `packages/shared/src/constants/restaurant.ts:60` (`PaymentMethodValue = 'cash_and_card' | 'card_only' | 'cash_only'`)
- Observation: Both are publicly exported from `@eatme/shared`. They name the same set of three string literals but under different identifiers. Note even the literal *order* differs, hinting at independent edits.
- Why it matters: Two synonyms is a maintainability smell — pick one. Worse, future divergence (e.g., adding `'mobile_pay'` to one only) silently breaks the type contract because both still export. Consumers may import either name without realising they're aliases.
- Suggested direction: Keep the type-named one (`PaymentMethods`) and have the constants file `import type { PaymentMethods } from '../types/restaurant'`. Or canonicalise on `PaymentMethodValue` and re-export it from types. Eliminate the duplicate.
- Confidence: confirmed
- Evidence: grep above; both names searchable in the public surface.

### REV-10-g: `Ingredient` interface redefined in web-portal

- Severity: medium
- Category: maintainability
- Location:
  - `packages/shared/src/types/restaurant.ts:7-16` (canonical `Ingredient`)
  - `apps/web-portal/lib/ingredients.ts:37-46` (verbatim re-declaration)
- Observation: Both files define the same `Ingredient` interface with identical fields and optionality. Web-portal even re-exports its local one rather than importing from `@eatme/shared`.
- Why it matters: When the canonical type evolves (e.g., adding `is_pescatarian?: boolean`), the web-portal copy stays stale and TypeScript will not flag it because the local one happens to satisfy `Ingredient[]` returns where shared is expected. Every duplicated entity multiplies the surface area for drift.
- Suggested direction: Delete the local `Ingredient` and `import type { Ingredient } from '@eatme/shared'`. Same treatment for the web `Allergen` / `DietaryTag` types — they should live in shared (currently only the *form* tag arrays live there, not the API row shapes).
- Confidence: confirmed
- Evidence: line-by-line comparison.

### REV-10-h: `Option` / `OptionGroup` redefined in mobile with conflicting optionality

- Severity: medium
- Category: maintainability
- Location:
  - `packages/shared/src/types/restaurant.ts:30-57` (canonical, mostly-optional fields)
  - `apps/mobile/src/lib/supabase.ts:47-73` (mobile-local, mostly-required fields)
- Observation: Shared has `Option { id?: string; option_group_id?: string; is_available?: boolean; display_order?: number; ... }` (everything optional). Mobile has `Option { id: string; option_group_id: string; is_available: boolean; display_order: number; ... }` (all required). Same divergence on `OptionGroup` (`min_selections`, `display_order`, `is_active` flip from optional to required; `options` from `Option[]` to mobile-local `Option[]`).
- Why it matters: A function typed with the mobile `Option` cannot accept a shared `Option` (id is `string` vs `string | undefined`) and vice versa, so callers must `as` between them — silent loss of nullability checking. Both shapes ostensibly model the same DB row from `option_groups` / `options`.
- Suggested direction: Either generate the row shape from `Tables<'option_groups'>` / `Tables<'options'>` (single source of truth: Supabase types), or import the shared interface and stop redeclaring. Reserve form-input shapes (everything optional) for the validation module under a different name (`OptionInput`).
- Confidence: confirmed
- Evidence: line-by-line above; mobile file even has a long comment block at lines 27-32 telling readers to derive types from generated `@eatme/database`, then proceeds to redeclare `Option` / `OptionGroup` by hand.

### REV-10-i: `Location` JSDoc misrepresents PostGIS layout

- Severity: low
- Category: maintainability
- Location: `packages/shared/src/types/restaurant.ts:1-5`
- Observation: The comment reads `Geographic coordinate pair. Matches the PostGIS POINT(lng lat) layout used in Supabase.` The interface itself is `{ lat: number; lng: number }` — fields are declared lat-first. The DB POINT layout is `(lng lat)` per CLAUDE.md pitfall #1; the JS object property *order* in TS is irrelevant, but the comment conflates the two.
- Why it matters: A reader looking at the type comment may assume the JS shape is also lng-first and pass `{ lng: 0, lat: 0 }` to a function that destructures `{ lat, lng }`. The comment should state the DB convention separately from the JS shape.
- Suggested direction: Reword: `JS coordinate pair, lat-first. Mapped to PostGIS POINT(lng, lat) on persistence — see formatLocationForSupabase.`
- Confidence: confirmed
- Evidence: text quoted above; CLAUDE.md pitfall #1.

### REV-10-j: `RestaurantType` doc claims a Postgres enum that doesn't exist

- Severity: low
- Category: correctness
- Location:
  - `packages/shared/src/types/restaurant.ts:135` (`Must stay in sync with RESTAURANT_TYPES constant and Postgres enum.`)
  - `infra/supabase/migrations/database_schema.sql:343` (`restaurant_type text` — no enum, no CHECK)
- Observation: There is no Postgres enum or CHECK constraint on `restaurants.restaurant_type`. The doc comment promising sync is wishful — the DB will accept any string.
- Why it matters: Two failure modes: (a) future maintainers searching for the "enum" find nothing and waste time, (b) the absence of a DB constraint means the TS union is the only guard, and any insert that bypasses Zod (raw SQL, server actions, AI ingest) can write arbitrary strings.
- Suggested direction: Either update the comment to acknowledge the column is untyped at the DB level (and recommend a future CHECK constraint migration), or actually add a CHECK in a new migration: `CHECK (restaurant_type = ANY(ARRAY['restaurant','cafe',...]))` with one entry per enum value. New migration only — do not edit existing.
- Confidence: confirmed
- Evidence: grep `restaurant_type` across all migrations returns only the bare column declaration; no enum type exists in `database_schema.sql`.

### REV-10-k: `CUISINES` is an undeclared backwards-compat alias

- Severity: low
- Category: maintainability
- Location: `packages/shared/src/constants/cuisine.ts:86-87`
- Observation: `export const CUISINES = ALL_CUISINES;` with the comment `Backward-compatible alias — web-portal code imports CUISINES.`
- Why it matters: A second name for the same export is technical debt that will never be reclaimed unless a deliberate cleanup pass renames consumers. Both names will live forever.
- Suggested direction: One-shot rename in web-portal (`grep -l "CUISINES" apps/web-portal | xargs sed -i 's/\bCUISINES\b/ALL_CUISINES/g'`), then delete the alias. Trivial change scope.
- Confidence: confirmed
- Evidence: comment and export quoted above.

### REV-10-l: `dishSchema.allergens` / `dishSchema.dietary_tags` are unconstrained string arrays

- Severity: low
- Category: correctness
- Location: `packages/shared/src/validation/restaurant.ts:59-60`
- Observation: `dietary_tags: z.array(z.string())` and `allergens: z.array(z.string())` accept any string. The shared package already has the canonical `DIETARY_TAGS` / `ALLERGENS` enums (`packages/shared/src/constants/dietary.ts:24, 42`); the validation module ignores them.
- Why it matters: A typo or a stale legacy code (e.g., `'tree_nuts'` from REV-10-a) silently passes Zod validation and ends up in the persisted text[] column. Migration 093 introduced `validate_allergen_codes()` (`infra/supabase/migrations/093_unify_allergen_codes.sql:99-107`) but it isn't a CHECK constraint and isn't called from the upsert path.
- Suggested direction: Tighten the schemas: `z.array(z.enum(DIETARY_TAGS.map(t => t.value) as [DietaryTagCode, ...DietaryTagCode[]]))`. Same for allergens with `AllergenCode`. Forms get instant client-side rejection of unknown codes.
- Confidence: confirmed
- Evidence: schema lines quoted; canonical enums already exist.

### REV-10-m: Validation barrel exports are tree-shake-hostile for mobile

- Severity: info
- Category: performance
- Location: `packages/shared/src/index.ts:1-3`
- Observation: The package barrel re-exports `./constants`, `./types`, and `./validation` unconditionally. Importing `POPULAR_CUISINES` (mobile does this at `apps/mobile/src/constants/index.ts:10`) drags zod and every form schema into the Metro bundle, even though mobile uses no schema at runtime.
- Why it matters: Bundle bloat (zod + schemas ≈ tens of KB after gzip), longer Metro builds, worse cold-start. Tree-shaking helps for `import { POPULAR_CUISINES }` only when bundlers understand re-exports cross-file (Metro is conservative with `export *`).
- Suggested direction: Add `package.json` `exports` subpaths: `./constants`, `./types`, `./validation`. Mobile imports from `@eatme/shared/constants` and never pulls validation.
- Confidence: likely
- Evidence: `apps/mobile/src/constants/index.ts:10` is a barrel import; Metro's tree-shaking of `export *` is well-known to be incomplete.

## No issues found in

- `packages/shared/src/constants/calendar.ts` — `DAYS_OF_WEEK` matches `OperatingHours` keys verbatim (`packages/shared/src/types/restaurant.ts:60-68`); the derived `DayKey` type is sound.
- `packages/shared/src/constants/pricing.ts` — `SPICE_LEVELS` values match `dishSchema` enum (`['none', 'mild', 'hot']`) and DB CHECK (`database_schema.sql:137`). `DISPLAY_PRICE_PREFIXES` values match `dishSchema.display_price_prefix` enum and the `DisplayPricePrefix` type union.
- `packages/shared/src/constants/menu.ts` — `DISH_KINDS`, `SELECTION_TYPES` align with `dishSchema` enums and the `DishKind` type union. `MENU_CATEGORIES` values match the `Menu.category` field comment ("all_day, breakfast, lunch, dinner, drinks, happy_hours").
- `packages/shared/src/constants/wizard.ts` — `WIZARD_STEPS` shape aligns with `WizardStep` type (id/title/path); `isComplete` is a runtime-derived field per consumer.
- `packages/shared/src/types/restaurant.ts` `OperatingHours` keys vs `DAYS_OF_WEEK` keys — match.
- `packages/shared/src/types/restaurant.ts` `Dish.spice_level` vs validation enum vs DB CHECK — all three agree.
- `apps/web-portal/next.config.ts` `transpilePackages: ['@eatme/database', '@eatme/shared']` — both TS-source packages are listed, satisfying CLAUDE.md pitfall #5.
- `RELIGIOUS_REQUIREMENTS` (`packages/shared/src/constants/dietary.ts:27`) — every entry is also present in `DIETARY_TAGS`.

## Follow-up questions

- For REV-10-c (zod major mismatch): is the v4 bump in `apps/web-portal/package.json` intentional (an in-progress migration) or accidental? If the former, what's the timeline for porting the shared schemas to v4? Touching this needs a coordinated PR across the workspace.
- For REV-10-d (optional zod peer): does the loop intentionally support installing `@eatme/shared` outside the monorepo (e.g., a future SDK pkg), or is it always a workspace consumer? If always workspace, the "optional" ergonomic has no payoff.
- For REV-10-l (unconstrained allergen codes): are there import paths (e.g., AI menu-scan ingestion) that bypass `dishSchema` and write `dishes.allergens[]` directly? If so, tightening the form schema alone won't catch the drift — the AI extractor needs the same enum guard. (REV-04 may have surfaced this.)
- For REV-10-b (icon drift): are `raw` and `heart_healthy` (codes only present in the local icon maps) intentional product concepts that are missing from `DIETARY_TAGS`, or are they dead code from an earlier iteration? Resolution determines whether shared needs to grow or icons need to shrink.
