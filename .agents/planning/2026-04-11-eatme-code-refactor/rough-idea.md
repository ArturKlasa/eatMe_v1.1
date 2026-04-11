# Rough Idea: eatMe Codebase Refactor

Refactor the eatMe apps (web portal, mobile, and Supabase/shared packages) to:

1. **Improve code quality** — Follow best coding practices, reduce code duplication, improve structure
2. **AI friendliness** — Make the codebase suitable for AI-assisted development (clear naming, good comment coverage, well-structured modules, consistent patterns)
3. **Well-written comments** — Good comment coverage explaining *why*, not just *what*
4. **Reduce lines of code** — Consolidate, simplify, remove dead code where possible
5. **Improve developer productivity** — Better patterns, shared utilities, clearer conventions

## Codebase Overview

- **Monorepo** (pnpm + Turbo): ~68K LOC across 358 source files
- **Web Portal** (`apps/web-portal`): Next.js 16, React 19, Radix UI, Tailwind v4 — ~31K LOC, 194 files
- **Mobile** (`apps/mobile`): Expo 54, React Native 0.81, Zustand — ~26K LOC, 133 files
- **Packages**: `@eatme/database` (Supabase client + types), `@eatme/tokens` (design tokens) — ~8K LOC, 31 files
- Existing: ESLint, Prettier, strict TypeScript, Vitest (web-portal only)
