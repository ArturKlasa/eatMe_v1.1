# EatMe Web Portal v2 — Rough Idea

> A brain-dump to seed Prompt Driven Development. Not a spec. Not a plan. The point is to capture intent and constraints so prompts have a north star — implementation choices come later, in prompts, with the AI.

---

## Scope

**Primary: rebuilding the web portal app.**

**Also in scope (coordinated with the rebuild):**
- **Additive Supabase schema changes** to support proper draft state, atomic publishing, and the menu-scan job system. Specifically: new columns on existing tables, new tables for new concerns, new Postgres functions, tightened RLS. **No dropped tables. No removed columns.**
- **Edge Function patches** to teach the consumer-facing data path about draft vs published (`nearby-restaurants`, `feed`, `group-recommendations`, `generate_candidates`).
- **Mobile app patches** strictly required for compatibility with the new draft state (e.g., explicit `status='published'` filters in direct queries). No UX changes; no feature work.

**Out of scope (separate, follow-up projects):**
- Ingredient pipeline relaunch (UI + AI extraction in the portal). DB tables stay intact; mobile keeps using existing ingredient data for legacy dishes.
- Mobile app feature work, redesigns, or non-compatibility refactors.
- Dropping any existing tables or columns.

The rule: **additive, coordinated, non-breaking.** Anything that would force mobile into a redesign or drop existing data is a follow-up project, not v2.

---

## Compatibility constraints

These remain non-negotiable, even with the wider scope:

1. **No tables or columns get dropped.** The ingredient pipeline tables (`ingredients`, `ingredient_concepts`, `ingredient_variants`, `ingredient_aliases_v2`, `dish_ingredients`, `canonical_ingredient_allergens`) and the `dishes.allergens` / `dishes.dietary_tags` columns stay. Existing data and triggers continue to work.
2. **All v2-bundled mobile patches are minimal and mechanical** — adding `status='published'` filters, nothing else. No mobile UX or design work.
3. **`@eatme/shared` and `@eatme/database` may add new exports**, but cannot rename, remove, or change the shape of anything mobile already imports.
4. **Existing v1-created data continues to render correctly in mobile** with no migration required for those rows.
5. **The consumer mobile app is never broken between v2's DB migration deploy and its app deploy.** Migrations and Edge Function patches must be backwards-compatible with the live mobile app at every step (RLS tightening included).

---

## One-liner

A web portal where restaurant owners onboard their business in minutes, manage menus without friction, and get AI-assisted help (menu scanning) that just works — built on top of the EatMe Supabase backend, fully compatible with the consumer mobile app, shipped fast, and structured so adding a feature doesn't break three others.

---

## Why rebuild?

v1 works, but the foundations have cracks that get more expensive every week:

- **Submit isn't transactional** — partial failures leave orphan restaurants with no menus, and the user has no way to retry cleanly.
- **Onboarding draft lives in localStorage and is cleared only on success** — so partial failures + reload = stale draft merged with partial DB state. State is impossible to reason about.
- **Menu scan confirm isn't idempotent** — a retry duplicates every dish. The scan endpoint has no `maxDuration`, so big menus hang Vercel forever.
- **Admin auth on API routes is enforced ad-hoc** — middleware blocks pages, but each `/api/admin/*` handler must remember to check itself. One forgotten check = silent privilege escalation.
- **DishFormDialog has 5 implicit modes** — wizard vs DB, food vs drink, edit vs create — none of it discriminated-union-typed. Bug magnet.
- **No server-side validation** — Zod runs in the browser. The server trusts whatever shape it gets.
- **Ingredient pipeline is built but flag-gated off in the portal UI** — owner-facing UX never shipped, accumulating drift. v2 narrows the portal's scope to ignore it. The DB tables stay populated for legacy dishes; mobile keeps consuming them. New v2 dishes simply have empty allergen/dietary fields.
- **Two draft localStorage keys** drifting apart. Stale planning docs in the repo root.

The right move: keep the data model, **add the small DB pieces that make proper draft state and job processing possible**, throw away the app code, rebuild around a cleaner core.

---

## Who it's for

**Primary: Restaurant owners.**
- Often non-technical. Often setting this up on a phone or laptop between shifts.
- Want to be discoverable on the consumer app *today*, not after a 45-minute setup wizard.
- Will abandon if anything feels broken or slow.

**Secondary: EatMe admins.**
- Power users running menu scans, importing restaurants in bulk, reviewing data quality.
- Tolerant of dense UI; they want speed and inspectability, not hand-holding.
- Should have a clearly separate experience — not bolted onto the owner app.

---

## What it does (the core, not the kitchen sink)

### Owner side
1. **Sign up + sign in** — email/password and OAuth (Google, Facebook). Email confirmation optional.
2. **Onboard a restaurant** — name, location, hours, cuisines, service options. Should feel like 3 minutes, not 30. Restaurant exists in the DB from step 1 with `status='draft'`; mobile never sees it until publish.
3. **Build menus** — multiple menus, categories, dishes. Support all 5 dish kinds (`standard`, `bundle`, `configurable`, `course_menu`, `buffet`) without hiding the model. The owner-facing dish form surfaces `primary_protein` as the only classification field — `allergens`, `dietary_tags`, and `dish_ingredients` aren't shown or edited in the v2 UI but the columns/tables remain in the DB and continue to feed mobile for legacy dishes.
4. **Scan a menu image/PDF** — the killer feature. Background job extracts dishes (name, description, price, dish_kind, primary_protein, spice level, calories if visible), owner reviews, confirms. Real-time status via Supabase Realtime on the new `menu_scan_jobs` table. Atomic confirm via Postgres function with idempotency key — retries can never duplicate.
5. **Publish** — atomic state transition (`draft` → `published`) via a Postgres function. All-or-nothing across restaurant + menus + dishes.
6. **Edit anything later** — same UI for "first time" and "ongoing." No special "onboarding mode" that's different from "edit mode."
7. **Manage profile + photos** — restaurant info, hero image, dish photos.

### Admin side (separate app surface)
1. Restaurant browsing + management
2. Menu scan tool (more powerful than the owner-facing version)
3. Bulk imports (CSV, Google Places)
4. Audit logs

### Out of scope (for v2 web portal)
- Payments / billing
- Analytics dashboards for owners
- Multi-user-per-restaurant teams (one owner per restaurant)
- Native mobile portal (consumer app stays separate)
- Ingredient pipeline UI (covered above in "Build menus" and below in "Known accepted gap"; deferred to a follow-up project)

### Known accepted gap
- New dishes created in v2 won't have allergens / dietary_tags / ingredient links populated. In the consumer mobile app, those dishes will:
  - Not show vegan/vegetarian emoji badges
  - Not match dietary or allergen filters (so they may be hidden if a user has filters set)
  - Not appear in "Ingredients to Avoid" matching
- Legacy v1-created dishes are unaffected. The follow-up ingredient project closes this gap.

---

## What changes outside the portal (the additive surface)

Concrete list of non-portal work that ships **with** v2 (not after):

### DB migrations
- **Add `status` columns** to `restaurants` and `menus` matching what `dishes` already has: `text NOT NULL DEFAULT 'published'` with CHECK (`draft` | `published` | `archived`). Existing rows default to `'published'` — zero impact on legacy data.
- **Indexes** on `(status)` for each of the three tables.
- **New table `menu_scan_jobs`** with `(id, owner_id, restaurant_id, status, input, result, attempts, created_at, updated_at, locked_until)` and Realtime publication enabled.
- **Postgres function `publish_restaurant_draft(restaurant_id uuid)`** — wraps the multi-table draft→published transition in one transaction.
- **Postgres function `confirm_menu_scan(job_id uuid, payload jsonb, idempotency_key text)`** — handles dedup + bulk insert atomically.
- **RLS tightening**: anon-key consumer reads on `restaurants` / `menus` / `dishes` go from `USING (true)` to `USING (status = 'published')`. Owner read policies remain full-access for their own rows.

### Edge Function patches
- `nearby-restaurants`: add `.eq('status', 'published')` to the restaurants query and the nested menus/dishes selects.
- `feed`, `group-recommendations`: same pattern.
- `generate_candidates` RPC: add `AND r.status='published' AND m.status='published' AND d.status='published'`.

### Mobile patches (mechanical only)
- `apps/mobile/src/stores/restaurantStore.ts`: add `.eq('status', 'published')` to direct table queries (defense in depth — RLS will catch it, but explicit is better).
- That's it. No UX changes.

### Shared package additions
- New `RestaurantStatus` / `MenuStatus` types in `@eatme/shared` matching the enum.
- No removed or renamed exports.

### Release sequencing (must be coordinated)
1. DB migration + RLS tightening + Edge Function patches deploy first. Live mobile must continue working — verify all existing data is `'published'` before flipping RLS.
2. Mobile patch deploys (additive filters; safe whenever).
3. Web portal v2 deploys last.

---

## Design principles

These are the rules prompts should be held against:

1. **The DB is the source of truth, not localStorage.**
   No "draft-first" multi-step submit. Every save writes to the DB immediately as `status='draft'`. If the user closes the tab, they reopen exactly where they left off — because the DB knows. Cross-device works for free.

2. **Every mutation is transactional or idempotent. Pick one. Document which.**
   Multi-table writes go through Postgres functions (true transactions). Network-flaky paths (menu scan confirm) require an idempotency key.

3. **Server-side validation is the validation. Client-side is a UX nicety.**
   Zod schemas live in `@eatme/shared` and run on both sides, but the server is the gate. Never trust the client.

4. **Auth wrappers, not auth checks.**
   Every API route is wrapped in `withAuth(handler)`, `withAdminAuth(handler)`, or explicitly `withPublic(handler)`. Forgetting a check shouldn't be possible — the wrapper is mandatory.

5. **One mode per component.**
   No "this dialog handles 5 different things via optional props." Discriminated unions, or separate components.

6. **Ship feature flags only when there's a plan to flip them.**
   No long-lived dead code behind a flag. If a feature isn't ready in 4 weeks, cut it from v2.

7. **Bundle discipline.**
   Admin-only libs (pdfjs, csv parsing) are dynamic-imported from admin pages only. Owners shouldn't pay for tools they'll never use.

8. **Same UI for first edit and N-th edit.**
   No "onboarding wizard" that's a separate codebase from "edit restaurant." The wizard is the same form pre-filled with empty defaults, with a stepper UI overlay.

9. **PDD-shaped from day one.**
   Every prompt-built unit (page, route, hook, schema) should be small enough to be regenerated from one prompt. Avoid sprawling files where a single prompt change cascades.

10. **Additive, coordinated, non-breaking.**
    DB and mobile changes are in scope, but only as additive migrations and mechanical filter patches. Anything that drops a column, renames a shared type, or forces mobile UX work is out of scope and gets deferred.

---

## Tech stack — leaning toward, not committed

- **Next.js 16** + React 19, App Router, Server Actions for mutations (cuts the "API route boilerplate + client fetcher" pattern in half)
- **Supabase** — same project, additive schema work for v2 (status columns, jobs table, Postgres functions, RLS tightening)
- **Tailwind v4 + shadcn/ui** — proven, owners-recognize-it
- **react-hook-form + Zod** — same as v1, the pattern works
- **TanStack Query** — for client-side data fetching/caching where Server Components don't fit. v1 had no caching strategy at all.
- **Drizzle or Kysely?** — open question. Generated Supabase types work but raw query strings get unwieldy for the menu-scan confirm path. A query builder might pay for itself.
- **Vitest + Playwright** — keep Vitest for units; **add Playwright** for the onboarding + scan happy paths. v1 has zero E2E coverage.
- **AI: Claude Sonnet 4.6 (or 4.7)** for menu scan instead of GPT-4o — vision + structured outputs are both strong and pricing is competitive. Open question, worth a spike.

Things to **not** carry over:
- Zustand (we used it for almost nothing — Server Components + Query covers it)
- Leaflet (Mapbox alone is enough)
- The `eatme_restaurant_draft` legacy key (delete on sight)

---

## Risky areas — spike before committing

These are the "if we get this wrong, the rebuild is just v1 with new bugs" zones:

1. **Menu scan job system.**
   New `menu_scan_jobs` table, but the worker pattern is the open question. Options: Supabase Edge Function on a cron, external Inngest/Trigger.dev, or a tiny worker in a Vercel cron. Spike for cold-start, retry semantics, and observability.

2. **RLS tightening rollout safety.**
   Flipping `USING (true)` → `USING (status = 'published')` is a one-way door. If any existing row has `status != 'published'` accidentally, it disappears from the consumer app on the spot. Spike: write a pre-flight check ("how many rows are not 'published'?"), then deploy in three phases — migration with default, audit, RLS flip.

3. **Auth wrapper ergonomics.**
   `withAdminAuth` needs to feel pleasant or no one will use it. Spike the API before committing to the pattern.

4. **Same-form-everywhere UX.**
   The "onboarding wizard = pre-filled edit form" idea is clean in theory. Does it actually feel like onboarding to a real user? Sketch + test before building.

5. **Coordinated release.**
   Three things deploy in strict sequence — Supabase migration (incl. RLS) first, mobile patch second, web portal v2 last. Spike the runbook before launch — what's the rollback story for each step?

---

## What "done" looks like for v2

- A new restaurant owner can go from "signed up" to "first menu live on the consumer app" in **under 5 minutes** without help.
- Closing the browser mid-onboarding and reopening 3 days later just resumes — no data loss, no weird merged state.
- A menu scan with 15 dish images completes (or fails clearly) within 90 seconds, and a retry never duplicates.
- An admin can find any restaurant by name in under 3 seconds.
- Every API route has an auth wrapper. CI fails if a new route is added without one.
- Owner bundle size is under 250 KB gzip on first load. Admin can be larger.
- Playwright covers: signup → onboard → menu scan → publish → re-edit. If those break, deploys block.
- **Zero consumer-app regressions** — verified by running the mobile app against staging post-RLS-flip.
- **Drafts are never visible to the consumer app**, ever — verified by an automated test that creates a draft and queries the consumer-side endpoints.

---

## Open questions to resolve in early prompts

- **Job worker choice:** Supabase Edge Function (cron), Inngest, Trigger.dev, or Vercel cron — each has different cold-start and observability trade-offs.
- **AI model:** Claude vs GPT-4o vs Gemini for menu scan — needs a side-by-side spike on real menus.
- **Drizzle/Kysely vs raw Supabase client** — worth the dependency for the new Postgres function calls?
- **Where do owner and admin live?** Same Next.js app with route segments, or two separate apps in the monorepo?
- **Image handling:** browser-side resize before upload, or server-side via Sharp in an Edge Function?
- **Realtime feedback during scan:** Supabase Realtime channel per job, or polling? Channel is nicer; polling is simpler.
- **Ingredient gap defaults:** when v2 creates dishes without ingredient data, what exactly goes into `dishes.allergens` and `dishes.dietary_tags` (empty array? null?) — driven by what makes mobile rendering cleanest.

---

## Follow-up projects (explicitly deferred)

These are real, but not v2:

- **Ingredient pipeline relaunch** — bring the ingredient picker, allergen editing, and AI ingredient extraction back into the portal UI. Likely with a cleaner data model. Closes the "known accepted gap" for new dishes.
- **Mobile UX improvements** unrelated to v2 compat — better empty states, smarter fallbacks for dishes without ingredient data, etc.
- **Deeper schema refactors** that v2 didn't touch (e.g., consolidating dish variants, re-thinking option groups).

---

## Anti-goals

Things v2 should explicitly **not** become:

- A more "powerful" portal with more features. Same scope as v1 (minus the ingredient pipeline UI), executed cleanly.
- A microservices architecture. It's still one Next.js app on Vercel + Supabase.
- A schema rewrite. The DB grows by additive columns, one new table, and two functions — nothing existing is dropped or renamed.
- A reason to redesign the mobile app. Mobile gets mechanical filter patches, nothing more.
- A SaaS framework. No multi-tenancy beyond what RLS already gives us.
- A justification for trying every shiny library. Each new dep needs a reason that survives a 5-minute argument.
