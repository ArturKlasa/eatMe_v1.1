# EatMe v1 Comprehensive Project Documentation

## Objective

Generate complete developer-facing project documentation for the EatMe v1 monorepo — 20 Markdown files organized in `docs/project/` covering every implemented feature, system, workflow, and operational concern — so that a new developer can understand the entire platform without reading source code.

## Context

EatMe is a food discovery platform built as a pnpm + Turborepo monorepo with:

- **`apps/mobile`** — React Native 0.81 + Expo 54 (bare workflow), Mapbox-based map discovery, Zustand state management, swipe-based preference learning, Eat Together group sessions, i18n (en/es/pl).
- **`apps/web-portal`** — Next.js 16 + React 19 + shadcn/ui, restaurant owner portal for onboarding, menu management, ingredient/allergen tracking, admin dashboard, AI-powered menu scanning (GPT-4o Vision).
- **Backend** — Supabase (PostgreSQL + PostGIS + pgvector), 36 tables, 7 Deno-based Edge Functions (feed, nearby-restaurants, enrich-dish, group-recommendations, swipe, update-preference-vector, batch-update-preference-vectors), Upstash Redis caching.
- **Shared packages** — `packages/database` (Supabase client + generated types), `packages/tokens` (design tokens).
- **Infrastructure** — `infra/supabase/migrations/` (schema + functions), `infra/scripts/` (batch jobs). CI/CD planned but not yet implemented.

A detailed design document exists at `.agents/planning/2026-04-05-project-documentation/design/detailed-design.md` — it specifies the exact file structure, section contents, diagram requirements, and content for every file. **You must follow this design document precisely.**

Research notes with raw data for each area are in `.agents/planning/2026-04-05-project-documentation/research/`:
- `web-portal.md` — Routes, components, contexts, API routes, auth, features
- `mobile-app.md` — Screens, navigation, services, stores, hooks, i18n, features
- `database-schema.md` — All 36 tables, columns, types, functions, views, enums
- `edge-functions.md` — All 7 functions with request/response shapes, algorithms, scoring
- `environment-deployment.md` — Env vars, EAS config, CI/CD status, CLI commands

**Read both the design document and the relevant research file before writing each documentation file.** When the research notes lack detail, read the actual source code to fill gaps.

## Requirements

### Output Structure
All files go in `docs/project/`. Create this exact structure:

```
docs/project/
├── README.md
├── 01-project-overview.md
├── 02-tech-stack.md
├── 03-cli-commands.md
├── 04-web-portal.md
├── 05-mobile-app.md
├── 06-database-schema.md
├── 07-edge-functions.md
├── 08-environment-setup.md
├── 09-deployment.md
├── 10-contributing.md
├── 11-troubleshooting.md
└── workflows/
    ├── auth-flow.md
    ├── restaurant-onboarding.md
    ├── dish-creation-enrichment.md
    ├── feed-discovery.md
    ├── eat-together.md
    ├── menu-management.md
    ├── preference-learning.md
    └── rating-review.md
```

### Content Rules
1. **Audience:** Developers onboarding to the project. Write for someone who has never seen the codebase.
2. **Scope:** Document only what is currently implemented. Do not describe planned or future features.
3. **Diagrams:** Use Mermaid `sequenceDiagram` syntax for all workflow and architecture diagrams. Each workflow file must have at least one sequence diagram.
4. **Standalone files:** Each file must be readable on its own without needing other files for context.
5. **Cross-references:** Use relative Markdown links between files (e.g., `[Database Schema](./06-database-schema.md)`).
6. **Tables:** Use Markdown tables for structured data (columns, env vars, CLI commands, component references).
7. **Code examples:** Use TypeScript/SQL syntax highlighting in fenced code blocks.
8. **Missing information:** Mark with `<!-- TODO: description -->` HTML comments. Do not invent information.
9. **Edge functions:** Include full example JSON request and response payloads for each function (derive from the TypeScript interfaces in the research notes and source code).
10. **Database schema:** Document every table with all columns, types, constraints, and foreign keys. Group by domain (Restaurant/Menu, Ingredient System, User System, Interactions, Eat Together, Admin).

### Workflow File Structure
Each workflow file must follow this template:
1. Overview — What the workflow accomplishes
2. Actors — Systems and users involved
3. Preconditions — What must be true before the flow starts
4. Flow Steps — Numbered steps with detail
5. Sequence Diagram — Mermaid `sequenceDiagram`
6. Key Files — Source file paths involved
7. Error Handling — Failure modes
8. Notes — Edge cases, limitations

### Execution Order
Write files in this order to build context incrementally:
1. `README.md` (index — update links as files are created)
2. `01-project-overview.md`
3. `02-tech-stack.md`
4. `03-cli-commands.md`
5. `08-environment-setup.md`
6. `06-database-schema.md` (foundation for other docs)
7. `07-edge-functions.md`
8. `04-web-portal.md`
9. `05-mobile-app.md`
10. All 8 workflow files in `workflows/`
11. `09-deployment.md`
12. `10-contributing.md`
13. `11-troubleshooting.md`
14. Final pass: update `README.md` with all links and descriptions

## Constraints

- **Read-only on source code** — Do not modify any source files, migrations, or configs. Only create/modify files in `docs/project/`.
- **No secrets** — Reference environment variable names only; never log or include actual secret values.
- **Valid Mermaid** — All diagrams must use correct Mermaid syntax and render without errors. Test by reviewing syntax before writing.
- **No duplication** — If a concept (e.g., "canonical ingredients") appears in multiple docs, define it fully in one place and cross-reference from others.
- **Accuracy** — Cross-reference against actual source code. If research notes conflict with code, trust the code.
- **Table of contents** — Include a TOC at the top of any file longer than 100 lines.
- **File size** — Keep individual files manageable. The database schema doc will be the longest; aim for clear organization over brevity.

## Success Criteria

The task is complete when:

- [ ] All 20 files exist in `docs/project/` (12 root + 8 workflows) and contain substantive, accurate content
- [ ] `README.md` links to every file with a brief description
- [ ] `06-database-schema.md` documents all 36 tables with columns, types, and constraints
- [ ] `07-edge-functions.md` includes example request/response JSON for all 7 functions
- [ ] Every workflow file contains at least one Mermaid `sequenceDiagram`
- [ ] `01-project-overview.md` includes a system architecture sequence diagram
- [ ] `04-web-portal.md` documents all routes, components, services, and API routes
- [ ] `05-mobile-app.md` documents all screens, stores, services, and hooks
- [ ] All cross-references between files use valid relative links
- [ ] No source files outside `docs/project/` have been created or modified
- [ ] All `<!-- TODO -->` placeholders clearly describe what information is missing

## Progress Log

- [x] README.md created
- [x] 01-project-overview.md
- [x] 02-tech-stack.md
- [x] 03-cli-commands.md
- [x] 08-environment-setup.md
- [x] 06-database-schema.md
- [x] 07-edge-functions.md
- [x] 04-web-portal.md
- [x] 05-mobile-app.md
- [x] workflows/auth-flow.md
- [x] workflows/restaurant-onboarding.md
- [x] workflows/dish-creation-enrichment.md
- [x] workflows/feed-discovery.md
- [x] workflows/eat-together.md
- [x] workflows/menu-management.md
- [x] workflows/preference-learning.md
- [x] workflows/rating-review.md
- [x] 09-deployment.md
- [x] 10-contributing.md
- [x] 11-troubleshooting.md
- [x] Final README.md update with all links

## Notes

- Start by reading the detailed design at `.agents/planning/2026-04-05-project-documentation/design/detailed-design.md` to understand the exact specifications for each file.
- Read the corresponding research file before writing each doc. When research is insufficient, read the actual source code.
- The database schema source of truth is `infra/supabase/migrations/database_schema.sql` and `packages/database/src/types.ts`.
- Edge function source code is in both `supabase/functions/` and `infra/supabase/functions/` (mirrored).
- For environment variables, check `.env.example` files, `eas.json`, and grep for `process.env` / `EXPO_PUBLIC_` / `NEXT_PUBLIC_` / `Deno.env`.
- Mermaid sequence diagram tips: use `participant` for actors, `->>`  for async calls, `-->>` for responses, `Note over` for annotations, `alt`/`else` for branching.
- Mark the Progress Log checkboxes as you complete each file so the orchestrator can track progress.

---

The orchestrator will continue iterations until limits are reached.
