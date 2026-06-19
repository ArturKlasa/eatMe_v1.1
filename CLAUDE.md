# EatMe

EatMe is a food discovery platform connecting consumers with restaurants through personalized dish recommendations. Consumers discover dishes via a mobile app; restaurant owners manage menus through a web portal with AI-assisted menu scanning. Built as a pnpm + Turborepo monorepo with Supabase backend.

## Tech Stack

- **Mobile App** (`apps/mobile/`): Expo 54 + React Native 0.81, Zustand, Mapbox, i18next (en/es/pl)
- **Web Portal** (`apps/web-portal/`): Next.js 16 + React 19, shadcn/ui, Tailwind CSS v4, react-hook-form + Zod
- **Backend**: Supabase (PostgreSQL 15 + PostGIS + pgvector), RLS-enforced data ownership
- **Shared Packages**:
  - `packages/database/` — Supabase client factory + generated types (`@eatme/database`)
  - `packages/shared/` — Constants, TypeScript types, Zod validation schemas (`@eatme/shared`)
  - `packages/tokens/` — Design tokens (`@eatme/tokens`)

## Key Commands

```bash
pnpm install              # Install all dependencies
turbo dev                 # Start all apps in dev mode
turbo build               # Build all packages and apps
turbo test                # Run tests (web-portal Vitest suite)
turbo lint                # Lint all packages
turbo check-types         # TypeScript type-checking
```

### App-specific

```bash
cd apps/web-portal && npx vitest run    # Run web-portal tests
cd apps/web-portal && npx vitest        # Watch mode
cd apps/mobile && npx expo start        # Start Expo dev server
```

## Architecture

Monorepo with three packages consumed by two apps. Both apps create their own Supabase client via `@eatme/database` factory (explicit env var passing — see `packages/database/src/client.ts` for why). Shared constants, types, and validation schemas live in `@eatme/shared`.

See `agent_docs/architecture.md` for package relationships and data flow.

## Dish Classification — Primary Protein

Dishes are classified by a single `primary_protein` column (enum, not null) on the `dishes` table. The canonical list of 12 values lives in `packages/shared/src/logic/protein.ts` (`PRIMARY_PROTEINS` constant + `deriveProteinFields` helper). Both apps import from `@eatme/shared`.

- **Web portal**: `primary_protein` is set during menu scan (AI extraction) and editable in the dish form.
- **Mobile**: dishes carry the `primary_protein` enum (used for daily meat-type filters and modifier-option highlighting); there is no permanent protein preference in the personal filters drawer.

The legacy `dish_ingredients` / `canonical_ingredients` / `ingredient_concepts` pipeline has been retired from the mobile + edge runtime (Phase A, 2026-05-17). The DB tables and triggers still exist; Phase B drops the triggers, Phase C drops the schema. See `docs/plans/ingredient-pipeline-phase-*` for the rollout.

## Allergens & Dietary Tags — Abandoned

EatMe is a **discovery + protein-based filtering app, NOT an allergen-safety app.** `primary_protein` is the sole surviving food-classification axis. The dish-level `allergens` / `dietary_tags` arrays, the option-level `adds_allergens` / `removes_dietary_tags` / `adds_dietary_tags` modifiers, and the `user_preferences` columns `allergies` / `diet_types` / `religious_restrictions` / `preferred_dietary_tags` were always empty (no reliable data-entry path — the sole operator can only supply `primary_protein`) and have been removed across all apps + edge functions (2026-06-05).

Diet filtering is now **protein-derived**: vegan = `primary_protein = 'vegan'`; vegetarian = no `meat`/`poultry`/`fish`/`shellfish` protein family (eggs allowed = lacto-ovo). `user_preferences.diet_preference` + `exclude` survive. Migrations **155** (rewrites `generate_candidates` / `get_group_candidates` / `admin_confirm_menu_scan`) and **156** (drops the columns + the orphaned `allergens` / `dietary_tags` / `canonical_ingredient_dietary_tags` tables) complete the DB removal. See `docs/plans/abandon-allergens-dietary.md`.

## Dish Model — Modifier Groups + dining_format

Every dish is a flat row; composition/customization lives in **modifier groups**: `option_groups` (`selection_type` single/multiple, `min_selections`/`max_selections`, `display_in_card`) + `options` (`price_delta` or `price_override`, `primary_protein`, `is_default`). Two presentation-only columns supplement this:

- `dining_format` (nullable text, CHECK) — UX layout hint for mobile: `buffet`, `course_menu`, `interactive_table`, `shared_plates`, `sampler`, or NULL for a normal dish row. Never queried relationally.
- `bundled_items` (nullable jsonb array of `{name, note?}`) — informational "comes with" list. Pure description.

The legacy composition model (`dish_kind`, `parent_dish_id`, `is_parent`, `is_template`, `price_per_person` columns + `dish_courses`/`dish_course_items` tables) was **dropped 2026-06-12** (migration 158 converted parent/variant data to modifier groups; migration 163 dropped the schema). Do not reintroduce parent/variant dishes — size and add-on variants are modifier groups (e.g. a `Tamaño` group with price deltas). `DISH_KIND_META`/`DishKind` shims remain in `@eatme/shared` only for the retired `apps/web-portal` (whose dish create/edit is broken post-163 by design); remove them when that app is deleted. See `docs/plans/dish-model-rewrite-phase-7-cleanup.md`.

## Common Pitfalls

1. **PostGIS POINT format** — `POINT(lng lat)` not `POINT(lat lng)`. Supabase returns `{type: "Point", coordinates: [lng, lat]}`.
2. **RLS on new tables** — Every new table needs RLS enabled with `owner_id` FK to `auth.users`. Default is deny-all.
3. **localStorage keys** — Web portal uses specific keys for draft persistence (`restaurant-draft`, `onboarding-step`). Changing them breaks in-progress onboarding.
4. **Native modules need rebuild** — After adding/updating native dependencies in mobile, run `npx expo prebuild --clean`.
5. **transpilePackages** — Workspace packages using TypeScript source (not compiled) must be listed in `next.config.ts` `transpilePackages`.
6. **primary_protein is NOT NULL** — Every dish must have a `primary_protein` value. Dishes without it (pre-migration legacy data) should be deleted or backfilled before querying.

## Further Reading

- `agent_docs/` — Architecture, commands, conventions, database, terminology
- `docs/project/` — Detailed foundation docs (overview, tech stack, CLI, database schema, contributing, etc.)

<!-- GSD:workflow-start source:GSD defaults -->
## GSD Workflow Enforcement

Before using Edit, Write, or other file-changing tools, start work through a GSD command so planning artifacts and execution context stay in sync.

Use these entry points:
- `/gsd-quick` for small fixes, doc updates, and ad-hoc tasks
- `/gsd-debug` for investigation and bug fixing
- `/gsd-execute-phase` for planned phase work

Do not make direct repo edits outside a GSD workflow unless the user explicitly asks to bypass it.
<!-- GSD:workflow-end -->
