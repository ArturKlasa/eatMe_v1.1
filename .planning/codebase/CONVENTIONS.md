# Coding Conventions

**Analysis Date:** 2026-06-19

## Naming Patterns

**Files:**
- React components: PascalCase `.tsx` — e.g., `SectionCard.tsx`, `AutoSaveIndicator.tsx`
- Hooks: camelCase prefixed with `use` — e.g., `useDebounce.ts`, `useRestaurantDraft.ts`
- Services: camelCase noun — e.g., `restaurantService.ts`, `import-service.ts`
- Stores (Zustand): camelCase noun + `Store` suffix — e.g., `filterStore.ts`, `viewModeStore.ts`
- Style files: camelCase noun — e.g., `bases.ts`, `containers.ts`, `factories.ts`
- Test files: mirror the target file name with `.test.{ts,tsx}` extension
- Zod validation schemas: camelCase noun + `Schema` suffix — e.g., `basicInfoSchema`, `dishSchemaV2`

**Functions:**
- camelCase for all functions and hooks — e.g., `loadFormDefaults`, `useDebounce`, `computeWarningFlags`
- Async service functions: verb + noun — e.g., `getRestaurantSummary`, `importRestaurants`, `submitRestaurantProfile`
- Boolean helpers: `is` / `has` prefix — e.g., `isAdmin`, `isDiscoverable`

**Variables:**
- camelCase — local vars and parameters
- SCREAMING_SNAKE_CASE for module-level constants — e.g., `PRIMARY_PROTEINS`, `DAYS_OF_WEEK`, `BANNED_PATTERNS`

**Types / Interfaces:**
- PascalCase — e.g., `DailyFilters`, `MappedRestaurant`, `DashboardRestaurant`, `RawOptionGroup`
- Type aliases used for union types and object shapes interchangeably with interfaces
- Zod inferred types use `z.infer<typeof schema>` pattern, not hand-written duplicates

## Code Style

**Formatting (root `.prettierrc.json`):**
- Single quotes for strings (`singleQuote: true`)
- Semicolons required (`semi: true`)
- Trailing commas in ES5 positions (`trailingComma: "es5"`)
- Print width: 100 characters
- Tab width: 2 spaces, no tabs
- Arrow functions: omit parens for single parameter (`arrowParens: "avoid"`)
- LF line endings (`endOfLine: "lf"`)
- Bracket spacing: `{ key: value }` style

**Linting:**
- Root `tsconfig.json`: `strict: true`, `noUnusedLocals: true`, `noUnusedParameters: true`, `noUncheckedIndexedAccess: true`
- `@typescript-eslint/no-explicit-any: error` — enforced in `apps/web-portal` and `apps/mobile`
- `eslint-plugin-jsdoc` active as warnings (`warn`) in both web-portal and mobile; targets public `FunctionDeclaration` and `ClassDeclaration`. Escalate to `error` when baseline coverage is achieved.
- Next.js config: `eslint-config-next/core-web-vitals` + `eslint-config-next/typescript`
- Mobile: `@typescript-eslint/eslint-plugin` + `@typescript-eslint/parser`
- Custom ESLint rule: `no-unwrapped-action` in `packages/eslint-config-eatme/rules/` — enforces that server action exports are wrapped with `withAuth`, `withAdminAuth`, `withPublic`, or `withAuthRoute`
- No Biome — Prettier + ESLint only

## TypeScript Configuration

**Root `tsconfig.json` settings applied project-wide:**
- `"module": "ESNext"`, `"moduleResolution": "bundler"`
- `"isolatedModules": true` — required for Turbopack/Vite transforms
- `"noUncheckedIndexedAccess": true` — array/object index access may be `undefined`
- `"declaration": true`, `"declarationMap": true`, `"sourceMap": true`
- `infra/` directory excluded from root tsconfig (Deno handles it separately)

## Import Organization

**Order (enforced by convention, not import-sort plugin):**
1. External packages (React, Next.js, Zod, Supabase SDK)
2. Workspace packages (`@eatme/shared`, `@eatme/database`, `@eatme/tokens`)
3. Path-alias imports (`@/lib/...`, `@/components/...`, `@/hooks/...`)
4. Relative imports (`./`, `../`)

**Path Aliases:**
- `@/` — maps to app root in web-portal and admin (`vitest.config.ts` + `tsconfig.json`)
- `@eatme/shared`, `@eatme/database`, `@eatme/tokens` — workspace package aliases

**Barrel Files:**
- `packages/shared/src/index.ts` re-exports everything: constants, types, validation, logic modules
- `packages/shared/src/validation/index.ts` and `src/types/index.ts` — sub-barrel exports
- Mobile and web-portal styles: `src/styles/index.ts` barrel present in mobile

**Type-only imports:**
- `import type { ... }` used consistently when importing types/interfaces that emit no JS

## Zod Validation Pattern

Zod schemas live in `packages/shared/src/validation/` and are the single source of truth for shared contracts. Apps consume them via `@eatme/shared`.

```typescript
// packages/shared/src/validation/restaurant.ts
import { z } from 'zod';

export const basicInfoSchema = z.object({
  name: z.string().min(2, 'Restaurant name must be at least 2 characters'),
  // Optional fields: .optional().or(z.literal('')) for empty-string-safe optionals
  description: z.string().min(10, '...').optional().or(z.literal('')),
});

// Inferred types used in app code
export type BasicInfoFormData = z.infer<typeof basicInfoSchema>;
```

React Hook Form integration in web-portal:
```typescript
// apps/web-portal/app/onboard/basic-info/page.tsx
import { useForm, FormProvider } from 'react-hook-form';
// zodResolver used at form level; schema.safeParse used for imperative validation
const methods = useForm<BasicInfoFormData>({ ... });
```

`safeParse` used for non-throwing imperative validation (e.g., review page pre-flight checks). `parse` used when errors should throw.

## Error Handling

**Service layer pattern — throw on Supabase error:**
```typescript
// apps/web-portal/lib/restaurantService.ts
const { data, error } = await supabase.from('restaurants').select('...');
if (error) throw new Error(`Failed to load restaurant: ${error.message}`);
```

**Caller layer — try/catch with console.error and optional toast:**
```typescript
// apps/web-portal/lib/hooks/useDishFormData.ts
try {
  await saveOptionGroup(group);
} catch (error) {
  console.error('[DishForm] Failed to save option group:', error);
  // toast.error shown to user
}
```

**Pattern summary:**
- Services throw `Error` with context prefix: `Failed to <action>: <message>`
- Hooks/components catch and log with `[ModuleName]` bracket prefix
- UI uses `sonner` toast for user-facing error messages
- `console.warn` used for non-fatal degradations (e.g., data not found but recoverable)
- Integration tests: check `error` is non-null; assert `error.message` matches `/check|constraint/i` for DB constraint violations

## Logging

**No dedicated logging library** — `console.*` throughout.

**Patterns:**
- `console.error('[ModuleName] Description:', error)` — tagged errors in services and hooks
- `console.warn('[Storage] Description:', error)` — recoverable issues
- Mobile uses `debugLog` from `src/config/environment.ts` — wraps `console.log` behind an env flag (suppressed in production)
- No structured JSON logging or log levels beyond `console.{error,warn,log}`

## Comments

**When to Comment:**
- JSDoc on exported functions (enforced as warn by ESLint): `@returns`, `@param` tags required for public functions
- Module-level block comments describe the two-tier architecture (e.g., filterStore.ts `/** Filter Store — ... */`)
- Inline `// ── Section Name ────` divider comments used in larger files to separate logical groups (common in test files and service files)
- Inline comments explain non-obvious decisions: business rules, PostGIS quirks, migration context

**JSDoc example:**
```typescript
/** @returns The debounced value after `delay` ms of inactivity. */
export function useDebounce<T>(value: T, delay = 300): T { ... }
```

## Module Design

**Exports:**
- Named exports preferred throughout — no default exports for utilities, services, schemas, or hooks
- React components: default export (`export default function ComponentName`)
- Zustand stores: named export of the `create(...)` result — e.g., `export const useFilterStore = create(...)`

**Barrel files:** Used in `packages/shared` and mobile styles. Not used in app-level `lib/` or `components/` — import directly from source files.

**Server vs client:**
- `'use client'` directive at top of client components in Next.js apps
- `'server-only'` package imported in DAL modules to prevent accidental client bundling (tested in admin via `vi.mock('server-only', () => ({}))`)

---

*Convention analysis: 2026-06-19*
