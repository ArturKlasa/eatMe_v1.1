# EatMe — Documentation Index

_Last updated: March 3, 2026_

This folder contains design documents, reference guides, architecture decisions, and planning notes for the EatMe project.

---

## 📚 Quick Navigation

| Document | Category | Summary |
|---|---|---|
| [schema-erd.md](./schema-erd.md) | Reference | Full database ERD — all tables, columns, and relationships |
| [TERMINAL_COMMANDS_REFERENCE.md](./TERMINAL_COMMANDS_REFERENCE.md) | Reference | All dev commands (pnpm, git, Supabase, Expo) |
| [package-management.md](./package-management.md) | Reference | pnpm monorepo structure and Turborepo setup |
| [mapbox-setup.md](./mapbox-setup.md) | Guide | Mapbox token setup for mobile and web |
| [supabase-setup.md](./supabase-setup.md) | Guide | Supabase project setup and environment config |
| [supabase-integration-status.md](./supabase-integration-status.md) | Status | Current integration state across web, mobile, and DB |
| [TODO_LIST.md](./TODO_LIST.md) | Planning | Current active tasks and next priorities |
| [backend-implementation-plan.md](./backend-implementation-plan.md) | Architecture | Backend analysis: Supabase Edge Functions strategy |
| [EDGE_FUNCTIONS_ARCHITECTURE.md](./EDGE_FUNCTIONS_ARCHITECTURE.md) | Architecture | Edge Functions design: feed, swipe, nearby, recommendations |
| [menu-scan-ai-design.md](./menu-scan-ai-design.md) | Design | AI-powered menu image extraction (GPT-4o Vision) |
| [ADMIN_IMPLEMENTATION.md](./ADMIN_IMPLEMENTATION.md) | Feature | Admin dashboard — what's built, security, pages |
| [ADMIN_SECURITY.md](./ADMIN_SECURITY.md) | Security | Admin auth, RLS policies, audit logging |
| [ADMIN_UI_ALIGNMENT_PLAN.md](./ADMIN_UI_ALIGNMENT_PLAN.md) | Planning | Plan to align admin UI styling with owner onboarding |
| [future-features.md](./future-features.md) | Planning | Deferred features with implementation notes |
| [restaurant-partner-portal.md](./restaurant-partner-portal.md) | Historical | Original portal plan (phases 1→1.5, now complete) |
| [diagrams-index.md](./diagrams-index.md) | Reference | Mermaid diagrams — ERD, data flow, component maps |

---

## 🗂 Categories

### Reference (current, authoritative)
- [schema-erd.md](./schema-erd.md) — **start here** for any DB work
- [TERMINAL_COMMANDS_REFERENCE.md](./TERMINAL_COMMANDS_REFERENCE.md)
- [package-management.md](./package-management.md)

### Guides (setup & how-to)
- [mapbox-setup.md](./mapbox-setup.md)
- [supabase-setup.md](./supabase-setup.md)

### Architecture & Design
- [backend-implementation-plan.md](./backend-implementation-plan.md)
- [EDGE_FUNCTIONS_ARCHITECTURE.md](./EDGE_FUNCTIONS_ARCHITECTURE.md)
- [menu-scan-ai-design.md](./menu-scan-ai-design.md)
- [ADMIN_SECURITY.md](./ADMIN_SECURITY.md)

### Current Status & Planning
- [supabase-integration-status.md](./supabase-integration-status.md)
- [TODO_LIST.md](./TODO_LIST.md)
- [ADMIN_IMPLEMENTATION.md](./ADMIN_IMPLEMENTATION.md)
- [ADMIN_UI_ALIGNMENT_PLAN.md](./ADMIN_UI_ALIGNMENT_PLAN.md)
- [future-features.md](./future-features.md)

### Historical / Context
- [restaurant-partner-portal.md](./restaurant-partner-portal.md) — phases 1 & 1.5 complete
- [diagrams-index.md](./diagrams-index.md)

---

## 🔑 Key Facts

- **Monorepo**: pnpm + Turborepo — `apps/mobile`, `apps/web-portal`, `packages/*`
- **Database**: Supabase (PostgreSQL + PostGIS), **40 migrations** as of March 2026
- **Latest migration**: `040_add_polish_aliases.sql`
- **Edge Functions**: `feed`, `nearby-restaurants`, `swipe`, `group-recommendations` (all deployed)
- **Web Portal**: Live — restaurant onboarding, admin dashboard, ingredient system, menu scan
- **Mobile**: Mapbox + Zustand working; **Supabase connection in progress**
