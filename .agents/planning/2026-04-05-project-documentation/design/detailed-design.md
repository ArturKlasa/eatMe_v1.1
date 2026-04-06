# Detailed Design: EatMe v1 Project Documentation

## Overview

This document defines the complete structure, content, and specifications for the EatMe v1 project documentation. The documentation targets developers joining the team and covers all implemented functionality across the monorepo: web portal, mobile app, Supabase backend, and infrastructure.

All files live in `/docs/project/` with numbered kebab-case naming. Workflow documentation is split into individual files in a `workflows/` subdirectory. Every file includes a table of contents and Mermaid sequence diagrams where applicable. Missing information is marked with `<!-- TODO: ... -->` placeholders.

---

## Detailed Requirements

### From Requirements Clarification
1. **Audience:** Developers onboarding to the project
2. **Location:** `/docs/project/`
3. **Scope:** Current implementation only (no planned/future features)
4. **Index:** `README.md` linking all files with brief descriptions
5. **Database depth:** As detailed as possible; placeholders for missing info
6. **Edge functions:** Include example request/response JSON payloads
7. **Diagrams:** Mermaid sequence diagrams (`sequenceDiagram`)
8. **File naming:** Numbered kebab-case (`01-project-overview.md`, etc.)
9. **Workflows:** Separate files in `workflows/` subdirectory
10. **Additional docs:** Environment setup, deployment, contributing guidelines, troubleshooting

### Derived Requirements
- Each file is standalone — can be read without context from other files
- Cross-references use relative markdown links
- Code examples use TypeScript/SQL syntax highlighting
- Tables used for structured data (columns, env vars, CLI commands)
- Sequence diagrams show actor interactions (User, Browser, Server, Supabase, OpenAI, etc.)

---

## Architecture Overview

```
docs/project/
├── README.md                          # Index with links to all docs
├── 01-project-overview.md             # Purpose, value, architecture
├── 02-tech-stack.md                   # All technologies and tools
├── 03-cli-commands.md                 # Every CLI command across monorepo
├── 04-web-portal.md                   # Web portal technical docs
├── 05-mobile-app.md                   # Mobile app technical docs
├── 06-database-schema.md              # Supabase database documentation
├── 07-edge-functions.md               # Edge function reference
├── 08-environment-setup.md            # Environment variables & secrets
├── 09-deployment.md                   # Deployment instructions
├── 10-contributing.md                 # Contributing guidelines
├── 11-troubleshooting.md              # Known issues & solutions
└── workflows/
    ├── auth-flow.md                   # Authentication workflow
    ├── restaurant-onboarding.md       # Restaurant onboarding wizard
    ├── dish-creation-enrichment.md    # Dish creation & AI enrichment
    ├── feed-discovery.md              # Feed recommendation pipeline
    ├── eat-together.md                # Group dining sessions
    ├── menu-management.md             # Menu CRUD & scanning
    ├── preference-learning.md         # Swipe → vector update pipeline
    └── rating-review.md               # Rating & review flow
```

---

## Components and Interfaces

### File Specifications

Each file below defines: purpose, table of contents, content sections, and diagrams to include.

---

### README.md — Documentation Index

**Purpose:** Entry point for all project documentation. Quick navigation.

**Sections:**
1. Title and one-paragraph project summary
2. Quick Links table — file name, description, link
3. Workflows section — list of workflow files with one-line descriptions
4. How to Use — brief note on reading order for new developers

**Diagrams:** None

---

### 01-project-overview.md — Project Purpose & Architecture

**Purpose:** Explain what EatMe is, who it serves, and how the system fits together.

**Sections:**
1. **What is EatMe** — One-paragraph description of the food discovery platform
2. **Value Proposition** — What problems it solves for consumers and restaurant owners
   - Consumers: personalized dish discovery, dietary safety, group dining coordination
   - Restaurant owners: digital menu management, AI-powered enrichment, analytics
3. **Target Users** — Consumer (mobile app), Restaurant Owner (web portal), Admin (web portal)
4. **High-Level Architecture** — Sequence diagram showing how the 4 main systems interact:
   - Mobile App ↔ Supabase (Auth, DB, Realtime) ↔ Edge Functions
   - Web Portal ↔ Supabase ↔ Next.js API Routes ↔ OpenAI
5. **Monorepo Structure** — Directory tree with purpose of each workspace:
   - `apps/web-portal` — Next.js admin/restaurant portal
   - `apps/mobile` — React Native consumer app
   - `packages/database` — Shared Supabase client + types
   - `packages/tokens` — Design tokens
   - `infra/supabase` — Migrations + edge functions
   - `infra/scripts` — Batch maintenance scripts
6. **Key Concepts** — Brief glossary: canonical ingredients, enrichment, preference vectors, Eat Together sessions

**Diagrams:**
- System architecture sequence diagram (Mobile → Supabase → Edge Functions → OpenAI)

---

### 02-tech-stack.md — Technical Stack

**Purpose:** Complete inventory of all technologies, frameworks, and tools.

**Sections:**
1. **Frontend — Web Portal**
   - Next.js 16, React 19, TypeScript, Tailwind CSS 4
   - Radix UI (shadcn/ui), react-hook-form, Zod 4, Sonner (toasts)
   - Mapbox GL (via react-map-gl), Leaflet (LocationPicker)
   - OpenAI SDK (menu scanning)
2. **Frontend — Mobile App**
   - React Native 0.81, Expo 54 (bare workflow), TypeScript
   - React Navigation (drawer + stack)
   - Zustand (state management), AsyncStorage
   - @rnmapbox/maps (native Mapbox)
   - i18next (internationalization: en, es, pl)
   - @react-native-google-signin (OAuth)
3. **Backend & Database**
   - Supabase (PostgreSQL 15 + Auth + Realtime + Storage)
   - PostGIS (geospatial), pgvector (embeddings, 1536-dim)
   - Deno-based Edge Functions (TypeScript)
4. **AI & ML**
   - OpenAI gpt-4o (menu scan vision), gpt-4o-mini (dish enrichment)
   - text-embedding-3-small (1536-dim embeddings)
5. **Infrastructure & DevOps**
   - pnpm 9 workspaces + Turborepo 2.5
   - EAS (Expo Application Services) for mobile builds
   - Upstash Redis (optional feed caching)
6. **Tooling**
   - ESLint, Prettier, TypeScript strict mode
   - Supabase CLI (migrations, type generation, function deployment)

**Diagrams:** None (reference table format)

---

### 03-cli-commands.md — CLI Commands Reference

**Purpose:** Every command a developer needs, organized by workspace.

**Sections:**
1. **Prerequisites** — Node >=18, pnpm 9.0.0, Supabase CLI, EAS CLI
2. **Root Monorepo Commands** — Table: command, description
   - `pnpm install`, `pnpm dev`, `pnpm build`, `pnpm lint`, `pnpm format`, `pnpm check-types`
3. **Web Portal Commands** — `cd apps/web-portal`
   - `pnpm dev`, `pnpm build`, `pnpm start`, `pnpm lint`
4. **Mobile App Commands** — `cd apps/mobile`
   - `pnpm start`, `pnpm android`, `pnpm ios`, `pnpm web`
   - `npx expo prebuild`, `eas build --platform android --profile development`
5. **Database Package Commands** — `cd packages/database`
   - `pnpm build`, `pnpm dev`, `pnpm gen:types`
6. **Supabase CLI Commands**
   - `supabase start`, `supabase db push`, `supabase gen types`
   - `supabase functions deploy`, `supabase functions serve`, `supabase functions logs`
7. **Infrastructure Scripts** — `cd infra/scripts`
   - `pnpm batch-embed`

**Diagrams:** None

---

### 04-web-portal.md — Web Portal Technical Documentation

**Purpose:** Complete technical reference for the Next.js web portal.

**Sections:**
1. **Overview** — Purpose (restaurant owner + admin interface), tech summary
2. **App Router Structure** — Full route tree with file paths and purpose
   - Public routes: `/auth/*`
   - Protected routes: `/`, `/onboard/*`, `/menu/*`, `/restaurant/*`
   - Admin routes: `/admin/*`
   - API routes: `/api/*`
3. **Authentication** — AuthContext implementation
   - Email/password + OAuth (Google, Facebook)
   - PKCE flow with cookie-based sessions
   - Role-based access (consumer, restaurant_owner, admin)
4. **Components Reference** — Table: component, file path, purpose, key props
   - Forms: DishFormDialog, IngredientAutocomplete
   - Display: AllergenWarnings, DietaryTagBadges, DishCard
   - Layout: ProtectedRoute, AdminSidebar, AdminHeader
   - Map: LocationPicker (Leaflet + Nominatim)
5. **Services & Libraries** — Table: module, file path, key functions
   - restaurantService, ingredients, menu-scan, validation, storage
6. **API Routes Reference** — For each route:
   - Method, path, auth requirement, request body, response, side effects
7. **Form Validation** — Zod schemas: basicInfoSchema, dishSchema, menuSchema, restaurantDataSchema
8. **State Management** — localStorage draft system with auto-save
9. **Key Features Detail**
   - Restaurant onboarding wizard (multi-step)
   - Menu scanning (GPT-4o Vision pipeline)
   - Ingredient autocomplete with allergen calculation
   - Admin dashboard

**Diagrams:**
- Restaurant onboarding data flow (sequence)
- Menu scan pipeline (sequence: Upload → GPT-4o → Ingredient matching → Review → Persist)

---

### 05-mobile-app.md — Mobile App Technical Documentation

**Purpose:** Complete technical reference for the React Native mobile app.

**Sections:**
1. **Overview** — Purpose (consumer food discovery), tech summary
2. **Navigation Structure** — Full navigation tree with screen types (stack, modal, transparent modal)
3. **Screens Reference** — Table: screen, file path, purpose, key features
   - Grouped by: Main, Auth, Eat Together, Onboarding
4. **State Management (Zustand)** — For each store:
   - State shape, key actions, persistence strategy
   - Store binding system (cross-store sync)
5. **Services Layer** — Table: service, file path, key functions, edge function calls
6. **Custom Hooks** — Table: hook, purpose, return type, caching behavior
7. **Components Reference** — Grouped by category:
   - Map (markers, controls, footer, header, view toggle, daily filter modal)
   - Rating (flow modal, select screens, rate screens, completion)
   - Common (screen layout, header, empty state, error boundary)
   - Auth (language selector)
8. **Internationalization** — Setup, supported languages, detection chain, usage
9. **Configuration** — Environment validation, Mapbox config, default coordinates
10. **Key Features Detail**
    - Map-based discovery (Mapbox integration)
    - Two-tier filter system (daily + permanent)
    - Eat Together group sessions
    - Rating flow with photo uploads and gamification
    - Onboarding with profile completion tracking
    - Currency auto-detection (Tier 1: locale, Tier 2: GPS)

**Diagrams:**
- App initialization sequence (launch → auth check → store init → map load)
- Filter application flow (sequence: UI → filterStore → edgeFunctionsService → Edge Function → map update)

---

### 06-database-schema.md — Database Schema & Explanation

**Purpose:** Complete database reference with all tables, relationships, and functions.

**Sections:**
1. **Overview** — PostgreSQL + PostGIS + pgvector, Supabase-managed auth, table count
2. **Entity Relationship Overview** — Mermaid ER diagram (simplified: major tables and relationships)
3. **Tables by Domain** — For each table:
   - Purpose (one line)
   - Column table: name, type, constraints, description
   - Foreign keys
   - Notes on usage
   - Grouped into subsections:
     - Core Restaurant/Menu (restaurants, menus, menu_categories, dishes, dish_categories, option_groups, options)
     - Ingredient System (canonical_ingredients, ingredient_aliases, dish_ingredients, allergens, dietary_tags, junction tables)
     - User System (users, user_preferences, user_behavior_profiles, user_points)
     - Interactions & Analytics (user_swipes, user_sessions, session_views, user_dish_interactions, dish_opinions, dish_photos, dish_analytics, user_visits, restaurant_experience_responses, favorites)
     - Eat Together (eat_together_sessions, eat_together_members, eat_together_votes, eat_together_recommendations)
     - Admin & System (admin_audit_log, menu_scan_jobs, security_documentation)
4. **Custom Types & Enums** — All enum definitions with values
5. **Materialized Views** — Purpose, columns, refresh strategy
6. **Key PostgreSQL Functions** — For each:
   - Name, parameters, return type, purpose
   - Grouped by: Recommendation, Analytics, Restaurant/Dish, Group Sessions, Admin, Utility
7. **Indexes** — Known indexes (with `<!-- TODO -->` for those not visible in schema dump)
8. **RLS Policies** — Known policies (with `<!-- TODO -->` placeholder)
9. **Design Patterns** — Vector embeddings, PostGIS spatial, soft deletes, enrichment pipeline, dietary/allergen arrays
10. **Type Generation** — How to regenerate TypeScript types (`pnpm gen:types`)

**Diagrams:**
- Entity relationship diagram (Mermaid erDiagram, simplified to show major relationships)
- Dish enrichment data flow (sequence: dish insert → completeness check → AI → embedding → vector update)

---

### 07-edge-functions.md — Edge Functions Reference

**Purpose:** Complete reference for all Supabase Edge Functions with example payloads.

**Sections:**
1. **Overview** — Deno runtime, deployment commands, shared infrastructure (CORS, auth)
2. **Function Reference** — For each of the 7 functions:
   - **Purpose** — One-paragraph description
   - **HTTP Method & URL**
   - **Authentication** — Required headers
   - **Request Parameters** — TypeScript interface + table
   - **Response Shape** — TypeScript interface
   - **Example Request** — Full JSON payload
   - **Example Response** — Full JSON payload
   - **Algorithm** — Step-by-step description of logic
   - **Scoring Weights** (where applicable)
   - **Error Responses** — Status codes and conditions
   - **External Dependencies** — APIs, caches
   - **Database Tables Accessed**
3. **Data Flow Pipelines** — How functions connect:
   - Feed pipeline: swipe → analytics → vector update → feed
   - Enrichment pipeline: dish create → enrich → embed → restaurant vector
   - Group pipeline: session → constraints → candidates → score → vote
4. **Vector & Embedding System** — Model, dimensions, usage across dishes/restaurants/users
5. **Deployment & Testing**
   - Deploy commands
   - Local testing with `supabase functions serve`
   - Environment variables required

**Diagrams:**
- Feed pipeline sequence (User → Mobile → feed function → generate_candidates RPC → JS ranking → response)
- Enrichment pipeline sequence (Dish save → webhook → enrich-dish → OpenAI → DB update)
- Group recommendations sequence (Host → group-recommendations → constraint union → get_group_candidates → scoring → voting UI)

---

### 08-environment-setup.md — Environment Variables & Secrets

**Purpose:** Every environment variable, where it's used, and how to set it up.

**Sections:**
1. **Overview** — Environment variable strategy (EXPO_PUBLIC_, NEXT_PUBLIC_, Deno auto-inject)
2. **Variable Reference** — Master table with columns: variable, scope (root/web/mobile/edge/infra), required, description, example value
3. **Setup by Workspace**
   - Root: `.env.local` with Mapbox, Supabase service role, OpenAI
   - Web Portal: `NEXT_PUBLIC_*` vars
   - Mobile: `EXPO_PUBLIC_*` vars + `eas.json` overrides
   - Edge Functions: Auto-injected + OPENAI_API_KEY in Supabase Dashboard
   - Infrastructure Scripts: `.env` with Supabase + enrich URL
4. **Getting API Keys** — Brief instructions for:
   - Supabase (project settings → API)
   - Mapbox (account → tokens)
   - OpenAI (platform → API keys)
   - Google OAuth (Cloud Console → credentials)
5. **Security Notes** — What should never be committed, `.gitignore` patterns

**Diagrams:** None

---

### 09-deployment.md — Deployment Instructions

**Purpose:** How to build and deploy each part of the system.

**Sections:**
1. **Overview** — Current deployment status and target architecture
2. **Web Portal (Next.js)**
   - Build: `pnpm build`
   - Target: Vercel (planned)
   - `<!-- TODO: Vercel project setup steps -->`
3. **Mobile App (Expo/EAS)**
   - Prebuild: `npx expo prebuild`
   - Development build: `eas build --profile development --platform android`
   - Preview build: `eas build --profile preview --platform android`
   - Production build: `eas build --profile production --platform android`
   - EAS profile differences
4. **Supabase Database**
   - Migrations: `supabase db push --project-ref <REF>`
   - Type generation: `pnpm gen:types` (in packages/database)
5. **Supabase Edge Functions**
   - Deploy single: `supabase functions deploy <name>`
   - Deploy all: `supabase functions deploy`
   - Setting secrets: `supabase secrets set OPENAI_API_KEY=<key>`
6. **CI/CD Pipeline**
   - Current status: Planned, not implemented
   - Planned architecture summary (GitHub Actions + Vercel + EAS + Supabase CLI)
   - `<!-- TODO: CI/CD implementation details when workflows are created -->`

**Diagrams:**
- Deployment pipeline sequence (Developer → GitHub → CI checks → Deploy targets)

---

### 10-contributing.md — Contributing Guidelines

**Purpose:** How to contribute code to the project.

**Sections:**
1. **Getting Started** — Clone, install, run dev
2. **Project Structure** — Quick reference to monorepo layout
3. **Code Style**
   - TypeScript strict mode
   - ESLint + Prettier (run `pnpm lint` and `pnpm format`)
   - Component naming conventions
4. **Branching Strategy**
   - `<!-- TODO: Document branching model when CI/CD is implemented -->`
5. **Making Changes**
   - Run `pnpm check-types` before committing
   - Run `pnpm lint` to check for issues
   - Test edge functions locally with `supabase functions serve`
6. **Database Changes**
   - Create migration files in `infra/supabase/migrations/`
   - Regenerate types after schema changes
7. **Adding Edge Functions**
   - Create directory in `supabase/functions/`
   - Follow existing CORS and auth patterns
8. **Mobile Development**
   - Prebuild required after native dependency changes
   - Test on physical device for location/map features

**Diagrams:** None

---

### 11-troubleshooting.md — Troubleshooting & Known Issues

**Purpose:** Common problems and their solutions.

**Sections:**
1. **Development Setup Issues**
   - pnpm install failures (node version, workspace resolution)
   - Expo prebuild issues (native modules)
   - Mapbox token errors (pk. vs sk. prefix)
2. **Mobile App Issues**
   - Location permissions denied
   - Google Sign-In configuration
   - Metro bundler cache (`npx expo start --clear`)
   - Android emulator GPS simulation
3. **Web Portal Issues**
   - Supabase connection errors
   - Auth callback redirect issues
   - Menu scan timeout (large images)
4. **Database Issues**
   - Migration ordering conflicts
   - Type generation out of sync
   - PostGIS function errors
5. **Edge Function Issues**
   - CORS errors
   - Missing environment variables
   - Cold start timeouts
   - Redis connection failures (feed function)
6. **Known Limitations**
   - TypeScript types may lag behind latest migrations
   - Favorites and ViewedHistory screens are placeholders
   - CI/CD pipeline not yet implemented
   - `<!-- TODO: Add issues as they are discovered -->`

**Diagrams:** None

---

### Workflow Files

Each workflow file follows a consistent structure:
1. **Overview** — What the workflow accomplishes
2. **Actors** — Systems and users involved
3. **Preconditions** — What must be true before the flow starts
4. **Flow Steps** — Numbered steps with detail
5. **Sequence Diagram** — Mermaid `sequenceDiagram`
6. **Key Files** — Source files involved (with paths)
7. **Error Handling** — What happens when things go wrong
8. **Notes** — Edge cases, limitations

---

#### workflows/auth-flow.md — Authentication

**Actors:** User, Mobile App / Web Browser, Supabase Auth, Google OAuth

**Diagrams (3):**
- Email/password signup sequence (User → App → Supabase Auth → Confirmation Email → Login)
- OAuth login sequence (User → App → Google → Supabase Auth → Session → Redirect)
- Session lifecycle sequence (App mount → getSession → onAuthStateChange → Token refresh)

**Content:**
- Web portal auth (AuthContext, PKCE, cookies, role-based access)
- Mobile auth (authStore, Google Sign-In native, session persistence)
- Differences between web and mobile auth flows

---

#### workflows/restaurant-onboarding.md — Restaurant Onboarding

**Actors:** Restaurant Owner, Web Browser, Next.js Server, Supabase

**Diagrams (1):**
- Multi-step wizard sequence (User → Step 1 (basic info + location) → auto-save → Step 2 (menus + dishes) → auto-save → Step 3 (review) → submit → Supabase)

**Content:**
- Three-step wizard flow
- localStorage draft persistence with 500ms auto-save
- Location picker (Leaflet + Nominatim reverse geocoding)
- Ingredient autocomplete and allergen calculation
- Final submission to Supabase

---

#### workflows/dish-creation-enrichment.md — Dish Creation & AI Enrichment

**Actors:** Restaurant Owner / Admin, Web Portal, Supabase, enrich-dish Edge Function, OpenAI

**Diagrams (2):**
- Dish creation sequence (User → DishFormDialog → ingredients → allergen calc → save to DB)
- AI enrichment sequence (DB webhook → enrich-dish → completeness check → GPT-4o-mini → embedding → restaurant vector update)

**Content:**
- Dish form (wizard mode vs DB mode)
- Ingredient linking and allergen/dietary tag calculation
- Enrichment pipeline: completeness evaluation (complete/partial/sparse)
- AI enrichment via gpt-4o-mini (sparse/partial only)
- Embedding generation (text-embedding-3-small, 1536-dim)
- Restaurant vector aggregation

---

#### workflows/feed-discovery.md — Feed & Discovery

**Actors:** Consumer, Mobile App, feed Edge Function, Supabase (PostGIS + pgvector), Redis

**Diagrams (1):**
- Two-stage feed pipeline sequence (User opens map → location → feed request → Stage 1: generate_candidates RPC → Stage 2: JS ranking → diversity cap → response → map markers)

**Content:**
- Stage 1: SQL-level filtering (PostGIS radius + vector ANN + hard filters) → 200 candidates
- Stage 2: JS ranking (similarity, rating, popularity, distance, quality) + soft boosts
- Scoring weights and boost values
- Cold-start handling
- Redis caching (300s TTL)
- Dishes mode vs restaurants mode
- Daily filters vs permanent filters application

---

#### workflows/eat-together.md — Eat Together Group Dining

**Actors:** Host, Members, Mobile App, Supabase (Realtime), group-recommendations Edge Function

**Diagrams (2):**
- Session lifecycle sequence (Host creates → Members join via code → Realtime sync → Host triggers recommendations → Voting → Finalize)
- Recommendation algorithm sequence (Load members → Union constraints → get_group_candidates RPC → Score → Save → Update status to voting)

**Content:**
- Session creation (code generation, location mode selection)
- Join flow (QR code, share link, manual code entry)
- Realtime member tracking (Supabase Postgres Changes)
- Location modes: host_location, midpoint, max_radius
- Group constraint computation (strictest diet, union allergens/religious)
- Scoring algorithm and weights
- Voting and finalization

---

#### workflows/menu-management.md — Menu Management & Scanning

**Actors:** Restaurant Owner / Admin, Web Portal, Next.js API, GPT-4o Vision, Supabase

**Diagrams (2):**
- Manual menu management sequence (User → menu/manage page → create menu → add dishes → ingredient autocomplete → save)
- Menu scan sequence (Admin uploads images → /api/menu-scan → GPT-4o Vision → extract dishes → ingredient matching → review UI → /api/menu-scan/confirm → persist)

**Content:**
- Manual CRUD (menus, categories, dishes)
- Menu scan pipeline:
  - Image upload to Supabase Storage
  - GPT-4o Vision extraction (parallel per image)
  - Multi-page merge algorithm
  - Ingredient matching: exact → partial → AI translation
  - Currency inference by country
  - Review UI with editing
  - Confirmation and persistence

---

#### workflows/preference-learning.md — Preference Learning Pipeline

**Actors:** Consumer, Mobile App, swipe Edge Function, update-preference-vector Edge Function, Supabase, pg_cron

**Diagrams (1):**
- Full preference pipeline sequence (User swipes → swipe function → user_swipes + dish_analytics + behavior_profiles → update-preference-vector → time-decayed weighted average → preference_vector → used in next feed request)

**Content:**
- Swipe recording (left/right/super with context)
- Analytics updates (dish_analytics counters, behavior profile)
- Real-time vector update trigger
- Time-decay algorithm: weight = base × e^(-0.01 × days)
- Base weights: saved(3.0), liked(1.5), viewed(0.5)
- Normalization to unit vector
- Preferred cuisines and price range extraction
- Batch fallback (nightly cron, 200 users/run)
- Debounce mechanisms (5-min for vector, 8-sec for enrichment)

---

#### workflows/rating-review.md — Rating & Review Flow

**Actors:** Consumer, Mobile App, Supabase Storage, Supabase DB

**Diagrams (1):**
- Rating flow sequence (Session tracks views → Rating banner → Select restaurant → Select dishes → Rate each dish → Upload photos → Restaurant questions → Award points → Save all)

**Content:**
- Session-based view tracking (sessionStore)
- Rating prompt trigger (recently viewed restaurants)
- Multi-step rating flow:
  1. Select restaurant from recent visits
  2. Select dishes eaten
  3. Rate each dish (opinion: liked/okay/disliked + tags)
  4. Optional photo upload (Supabase Storage)
  5. Restaurant experience questions (service, cleanliness, value, etc.)
  6. Points awarded (dish_rating, photo, first_rating_bonus, etc.)
- Data persistence: user_visits, dish_opinions, dish_photos, restaurant_experience_responses, user_points
- Materialized view refresh for aggregated ratings

---

## Data Models

The documentation itself is pure Markdown with no runtime data models. The key data relationships documented are:

1. **Restaurant → Menus → Menu Categories → Dishes** (hierarchical)
2. **Dishes ↔ Canonical Ingredients** (many-to-many via dish_ingredients)
3. **Canonical Ingredients ↔ Allergens / Dietary Tags** (many-to-many via junction tables)
4. **Users → Preferences, Behavior Profiles, Swipes, Opinions** (one-to-many)
5. **Eat Together Sessions → Members, Recommendations, Votes** (one-to-many)
6. **Dishes → Embeddings → Feed Ranking** (vector similarity)
7. **User Interactions → Preference Vectors → Personalization** (aggregation pipeline)

---

## Error Handling

- Missing information in the codebase is marked with `<!-- TODO: description of what's missing -->` HTML comments
- Each workflow file includes an "Error Handling" section covering failure modes
- Edge function documentation includes HTTP error status codes and conditions

---

## Testing Strategy

Since this is a documentation-only project, testing involves:
1. **Link validation** — All relative links between files are valid
2. **Mermaid validation** — All diagrams render correctly (test in GitHub preview or Mermaid Live Editor)
3. **Accuracy review** — Cross-reference documented interfaces with actual source code
4. **Completeness check** — Every route, component, service, store, table, and function is covered

---

## Appendices

### A. Technology Choices

| Area | Choice | Rationale |
|------|--------|-----------|
| Documentation format | Markdown | Native GitHub rendering, version-controlled, developer-friendly |
| Diagrams | Mermaid (sequenceDiagram) | Renders in GitHub, version-controlled as text, user preference |
| File organization | Numbered kebab-case + workflows/ subdir | Clear reading order, separate workflow files per user request |
| Placeholders | HTML comments `<!-- TODO -->` | Invisible in rendered output, easy to find with grep |

### B. Research Findings Summary

- **Web Portal:** 16 routes, 4 API endpoints, full shadcn/ui component library, AuthContext with PKCE
- **Mobile App:** 17 screens, 8 Zustand stores, 13 services, 4 hooks, i18n (en/es/pl)
- **Database:** 36 tables, 5 materialized views, 20+ PostgreSQL functions, pgvector + PostGIS
- **Edge Functions:** 7 functions covering feed, enrichment, group recommendations, analytics
- **Infrastructure:** pnpm + Turborepo monorepo, EAS for mobile, CI/CD planned but not implemented

### C. Alternative Approaches Considered

| Approach | Rejected Because |
|----------|-----------------|
| Single monolithic doc file | Too large, hard to navigate, user requested separate files |
| Flowchart diagrams | User specifically requested sequence diagrams |
| Auto-generated API docs (TypeDoc) | Doesn't capture workflows and architecture context |
| Wiki-based documentation | Less portable, not version-controlled with code |

### D. Constraints and Limitations

- RLS policies are not fully visible in the schema dump — documented with TODO placeholders
- TypeScript types in `packages/database` are generated from migration 041 but schema includes up to 071
- CI/CD pipeline is planned but not implemented — deployment docs include TODOs
- Some screens (Favorites, ViewedHistory) are placeholder implementations
- Edge function test coverage is limited to manual curl scripts
