# EatMe — Codebase Refactor

## Objective

Implement the 22-step codebase refactor per the checklist in:
  `.agents/planning/2026-04-11-eatme-code-refactor/implementation/plan.md`

Work through steps in order, one at a time. Mark each step `[x]` when complete.

## Context

EatMe is a food discovery platform (pnpm + Turborepo monorepo, ~68K LOC). This refactor improves code quality, AI friendliness, comment coverage, and developer productivity across:
- **`packages/shared/`** — NEW package: `@eatme/shared` with constants, types, and validation schemas extracted from both apps
- **`packages/database/`** — JSDoc improvements only
- **`packages/tokens/`** — No changes
- **`apps/web-portal/`** — Next.js 16 + React 19, shadcn/ui, Tailwind CSS v4, Supabase, Vitest (49 test files)
  - Import migration from local constants/types/validation to `@eatme/shared`
  - File splits: `useMenuScanState.ts` (1,378 lines) and `MenuScanReview.tsx` (1,265 lines)
  - JSDoc coverage pass on `lib/`, hooks, API routes
  - Dead code removal, test mock consolidation
- **`apps/mobile/`** — Expo 54 + React Native 0.81, Zustand (zero test files)
  - Import migration from local constants to `@eatme/shared`
  - File splits: `RestaurantDetailScreen.tsx` (1,003 lines) and `common.ts` (1,202 lines)
  - JSDoc coverage pass on services, stores, hooks
- **Root** — CLAUDE.md, agent_docs/, turbo.json, GitHub Actions CI, Husky pre-commit hooks, copilot-instructions.md updates

## Key Documents

- **Implementation plan** (checklist): `.agents/planning/2026-04-11-eatme-code-refactor/implementation/plan.md`
- **Design spec** (authoritative): `.agents/planning/2026-04-11-eatme-code-refactor/design/detailed-design.md`
- **Research**: `.agents/planning/2026-04-11-eatme-code-refactor/research/` (5 files)
- **Requirements Q&A**: `.agents/planning/2026-04-11-eatme-code-refactor/idea-honing.md`

## Phases

**Phase 1: Foundation (Steps 1-7)** — Create `@eatme/shared`, extract constants/types/validation, migrate imports, wire Turbo test task
**Phase 2: AI Readiness (Steps 8-13)** — CLAUDE.md + agent_docs/, update copilot-instructions.md, split 4 oversized files
**Phase 3: Code Quality (Steps 14-19)** — JSDoc passes, magic number docs, dead code removal, test mock consolidation
**Phase 4: Infrastructure (Steps 20-22)** — eslint-plugin-jsdoc, Husky + lint-staged, GitHub Actions CI

## Validation

- Build: `turbo build`
- Lint: `turbo lint`
- Type-check: `turbo check-types`
- Tests: `cd apps/web-portal && npx vitest run`
- Full pipeline: `turbo build && turbo lint && turbo check-types`

## Success Criteria

All 22 checklist items marked `[x]`, full pipeline passes, and:
- `packages/shared/` exists with constants, types, and validation exported via barrel exports
- `@eatme/shared` is in both apps' `package.json` and `next.config.ts` `transpilePackages`
- `apps/web-portal/lib/constants.ts`, `apps/web-portal/types/restaurant.ts`, and `apps/web-portal/lib/validation.ts` are deleted
- `apps/mobile/src/constants/index.ts` only re-exports icons + shared package (no local cuisine definitions)
- No file over 500 lines in the split targets (useMenuScanState hooks, MenuScanReview components, restaurant-detail/, styles/)
- `CLAUDE.md` exists at root, under 100 lines
- `agent_docs/` directory exists with 5 files
- `.github/copilot-instructions.md` has no references to nonexistent packages or wrong version numbers
- `.github/workflows/ci.yml` exists and runs build + lint + check-types + test
- `.husky/pre-commit` exists and runs lint-staged
- `turbo.json` has a `test` task
- All 49 web-portal test files pass
