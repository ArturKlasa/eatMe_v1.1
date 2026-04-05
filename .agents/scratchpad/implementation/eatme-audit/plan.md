# Plan

1. **Step 1 — Database Schema & Architecture Docs**
   - Demo: `database-schema.md` documents every table, column, RLS policy, trigger, function; `architecture-overview.md` has system diagram with Mermaid
   - Wave:
     - Read `database_schema.sql` + copilot instructions, write `database-schema.md`
     - Read all source entry points + package.json files, write `architecture-overview.md` with Mermaid diagram

2. **Step 2 — Feature Documentation (Web Portal + Mobile + API + Packages)**
   - Demo: Complete feature docs for all application layers
   - Wave:
     - Read web-portal source, write `web-portal-features.md` (routes, components, flows, auth)
     - Read mobile source, write `mobile-app-features.md` (screens, navigation, stores, Mapbox)
     - Read Supabase client usage across apps, write `api-and-data-layer.md` (queries, RLS patterns)
     - Read packages source, write `shared-packages.md` (current state, adoption, migration path)

3. **Step 3 — Audit Existing Docs & Write Recommendations**
   - Demo: `docs-audit.md` catalogues all stale content; `improvement-recommendations.md` has 15+ findings
   - Wave:
     - Read all `docs/` files, cross-reference against code/schema, write `docs-audit.md`
     - Synthesize all findings from Steps 1-2 into `improvement-recommendations.md` (security, code quality, perf, product, DX)

4. **Step 4 — Onboarding Guide & Final Cross-Reference Check**
   - Demo: `onboarding-guide.md` has complete local dev setup; all cross-references verified
   - Wave:
     - Read package.json files, copilot instructions, env files, write `onboarding-guide.md`
     - Verify all 9 docs exist, cross-references are accurate, TOCs present where needed
