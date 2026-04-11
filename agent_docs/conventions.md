# Conventions

## Naming

- **Files**: kebab-case for utilities (`import-validation.ts`), PascalCase for React components (`DishCard.tsx`)
- **Directories**: kebab-case (`menu-scan/`, `web-portal/`)
- **Types/Interfaces**: PascalCase (`RestaurantFormData`, `DishKind`)
- **Constants**: UPPER_SNAKE_CASE (`ALL_CUISINES`, `MAX_MENU_ITEMS`)
- **Hooks**: `use` prefix, camelCase (`useRestaurantDraft`, `useDishFormData`)
- **Database columns**: snake_case (`owner_id`, `created_at`)

## Error Handling

- Supabase calls: check `{ data, error }` return. Throw or display via Sonner toast.
- API routes: return `NextResponse.json({ error: message }, { status: code })`
- Mobile services: return result objects, let UI layer handle error display
- PGRST116 error code means "no rows found" — handle as empty result, not error

## State Management

- **Web Portal**: React state + react-hook-form for forms, LocalStorage for draft persistence
- **Mobile**: Zustand stores for global state, React state for local UI
- **Forms**: react-hook-form with Zod resolver for validation. Schemas in `@eatme/shared/validation/`

## Component Patterns

- Web portal uses shadcn/ui primitives (Button, Dialog, Select, etc.)
- Form sections are extracted into focused components (`DishBasicFields`, `DishDietarySection`)
- Mobile screens follow React Navigation stack/drawer pattern

## Barrel Exports

Each package and major directory uses `index.ts` barrel exports. When splitting files, always update the barrel to maintain external import paths.

## JSDoc Style

Follow the pattern in `packages/database/src/client.ts`: focus on "why" explanations, not restating what the code does. Document non-obvious decisions, magic numbers, and platform-specific workarounds.

See `docs/project/10-contributing.md` for the full contributing guide.
