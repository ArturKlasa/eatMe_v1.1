# EatMe Codebase Audit, Documentation & Improvement Discovery

## Objective

Perform a thorough end-to-end audit of the entire EatMe monorepo, produce comprehensive technical documentation in `/home/art/Documents/eatMe_v1/docs/agentic-docs`, and surface concrete recommendations for code quality, service architecture, product experience, and developer-experience improvements.

## Context

EatMe is a food discovery platform built as a pnpm + Turborepo monorepo with three main components:

- **`apps/mobile`** — React Native 0.81 + Expo Bare, Mapbox for map-based discovery, Zustand for UI state, swipe-based preference learning.
- **`apps/web-portal`** — Next.js 14 + shadcn/ui, restaurant partner portal for onboarding, menu management, and ingredient/allergen tracking.
- **Backend** — Supabase (PostgreSQL + PostGIS), Row-Level Security on every table, ingredient/allergen system via Postgres triggers, migrations in `infra/supabase/migrations/` (001–040, authoritative snapshot at `infra/supabase/migrations/database_schema.sql`).
- **Shared packages** — `packages/database` (Supabase client, partially adopted), `packages/ui` (minimal), `packages/typescript-config`, `packages/eslint-config`.

Key feature areas: restaurant onboarding wizard (multi-step LocalStorage draft → Supabase submission), ingredient autocomplete with allergen/dietary-tag auto-calculation via DB triggers, geospatial restaurant discovery (PostGIS POINT(lng lat)), OAuth + email auth, and a planned swipe/recommendation interface.

The `docs/agentic-docs/` folder is currently empty and is the designated output location for all documentation produced by this task.

## Requirements

1. **Full codebase read-through** — Traverse every file in `apps/mobile/src/`, `apps/web-portal/app/`, `apps/web-portal/components/`, `apps/web-portal/lib/`, `apps/web-portal/contexts/`, `apps/web-portal/types/`, `packages/`, and `infra/supabase/migrations/` (including `database_schema.sql`). Read `docs/` files for existing documentation context before writing new content to avoid duplication.
2. **Produce structured documentation** in `docs/agentic-docs/` covering at minimum:
   - `architecture-overview.md` — System architecture, component boundaries, data flow diagrams (Mermaid), deployment topology.
   - `database-schema.md` — Every table, column, type, index, RLS policy, trigger, and function derived from the authoritative schema snapshot.
   - `api-and-data-layer.md` — Supabase client usage, RLS patterns, all queries/mutations in the web portal and mobile app, edge function stubs.
   - `web-portal-features.md` — Route map, component inventory, form flows (onboarding wizard, ingredient system), auth lifecycle, LocalStorage draft strategy.
   - `mobile-app-features.md` — Screen inventory, navigation structure, Zustand store map, Mapbox integration, planned Supabase integration points.
   - `shared-packages.md` — Current state of each package, what is and is not yet shared, migration path for `packages/database`.
   - `improvement-recommendations.md` — Ranked list of findings (see Requirements 3 & 4).
   - `docs-audit.md` — Catalogue of outdated, inaccurate, or superseded content found across the existing `docs/` folder (see Requirement 5).
   - `onboarding-guide.md` — How to set up a local dev environment from scratch, run each app, apply migrations, and run the test scenarios described in the copilot instructions.
3. **Code & service improvement analysis** — Identify and document:
   - Security issues (OWASP Top 10 lens): missing RLS policies, unvalidated inputs, insecure storage, exposed secrets in env files, SSRF risks from Mapbox token handling, etc.
   - TypeScript type gaps, `any` usage, missing Zod schemas, unhandled promise rejections.
   - Dead code, duplicate logic, components that could be consolidated.
   - Error handling gaps (missing try-catch, silent failures, unhandled Supabase errors).
   - Performance concerns (unnecessary re-renders, missing indexes, N+1 query patterns, large bundle contributors).
   - Accessibility issues in web portal components (missing ARIA labels, keyboard nav gaps).
4. **Product & developer-experience improvement analysis** — Identify and document:
   - UX flows that could be simplified or made more resilient (e.g., onboarding draft recovery, ingredient search latency).
   - Missing features that are referenced in docs/workflows but not yet implemented (swipe interface, mobile Supabase auth, recommendation engine, eat-together feature).
   - Monorepo hygiene: dependency version mismatches, unused packages, missing turbo pipeline tasks.
   - Testing strategy gaps and concrete suggestions for unit/integration/E2E coverage.
   - CI/CD readiness (referring to `docs/todos/cicd-implementation-plan.md`).
5. **Audit & flag outdated documentation** — Treat the entire `docs/` folder (including `docs/workflows/`, `docs/todos/`, and all top-level `.md` files) as potentially stale. For every doc file reviewed:
   - Compare stated facts against the actual codebase and database schema.
   - Flag any content that is outdated, no longer accurate, or superseded by a later migration or code change.
   - Produce a dedicated `docs/agentic-docs/docs-audit.md` file cataloguing each outdated section: the source file path, the inaccurate claim, what the code/schema actually shows, and a suggested correction or deletion.
   - Where existing documentation is merely incomplete (correct but missing detail), note it as a gap rather than an error.

## Constraints

- Do not modify any source code or migration files — this is a read-only audit; all output goes to `docs/agentic-docs/` as new Markdown files.
- Do not run the database schema SQL file (`database_schema.sql`) — read it for documentation purposes only.
- Do not expose or log any secret values found in `.env*` files; reference their existence and key names only.
- Migration numbering is sequential 001–040; document the current highest number and flag any gaps or naming inconsistencies found.
- All Mermaid diagrams must be valid and renderable (test mentally before writing).
- Each `agentic-docs/` output file must be self-contained with a table of contents for files longer than 100 lines.

## Success Criteria

The task is complete when:

- [ ] All required `docs/agentic-docs/` files listed in Requirement 2 exist and are populated with accurate, non-trivial content derived from the actual codebase.
- [ ] `database-schema.md` documents every table and RLS policy present in `database_schema.sql`.
- [ ] `improvement-recommendations.md` contains at least 15 distinct, actionable findings across security, code quality, performance, product, and DX categories — each with a severity rating (Critical / High / Medium / Low), affected file(s), and a suggested remedy.
- [ ] `architecture-overview.md` includes at least one Mermaid diagram accurately representing data flow or system topology.
- [ ] `onboarding-guide.md` contains step-by-step instructions that a new developer could follow to run the full stack locally.
- [ ] No source files outside `docs/agentic-docs/` have been created or modified.
- [ ] All cross-references to existing `docs/` files are accurate (correct filenames, no broken links).
- [ ] `docs-audit.md` exists in `docs/agentic-docs/` and lists every identified outdated, inaccurate, or superseded claim found across the `docs/` folder, with file path, the stale claim, ground-truth finding, and suggested fix.

## Notes

- Start by reading `infra/supabase/migrations/database_schema.sql` and the copilot instructions (`/.github/copilot-instructions.md`) to establish ground truth before reading individual migration files.
- The `docs/workflows/` folder contains intended user journey specs (MOB-01 through MOB-10, SHARED-01, SHARED-02, etc.) — use these to identify gaps between spec and implementation.
- `docs/todos/` contains implementation plans at various stages of completion — cross-reference against the actual code to determine what has and has not been built.
- The `shelf/swipe-feature/` folder may contain shelved work relevant to the planned swipe interface — include it in the audit.
- Prefer reading large file sections in parallel to avoid unnecessary sequential reads.
- If a concept appears in multiple layers (e.g., "ingredient" in DB schema, lib/ingredients.ts, IngredientAutocomplete.tsx, and workflow docs), document it holistically in a single place and cross-reference from other documents.
- Many docs were written ahead of implementation and may describe planned features as if completed, or reference file paths that no longer exist. Treat "last updated" dates and status claims (e.g., "✅ complete") with scepticism and verify against actual code.
- Pay particular attention to `docs/supabase-integration-status.md`, `INTEGRATION_COMPLETE_SUMMARY.md`, `docs/todos/*.md`, and any workflow doc that references a screen or component — these are the most likely to be stale.

---

The orchestrator will continue iterations until limits are reached.
