# Prior-Work Consolidation — EatMe Web Portal v2

_Compiled: 2026-04-23. Source scope: `.agents/planning/` cycles through 2026-04-22._

## 1. Executive summary

Prior work relevant to v2 falls into three buckets:

**Shipped / frozen** — v2 must inherit these as-is:
- Universal dish parent-child model + feed filter (`073_universal_dish_structure.sql`).
- `primary_protein` NOT NULL column + 11-value enum (`110_primary_protein.sql`, `111_primary_protein_user_prefs_and_feed.sql`).
- `@eatme/shared` / `@eatme/database` / `@eatme/tokens` package split, `agent_docs/`, Husky + lint-staged, GitHub Actions CI (all 22 steps of 2026-04-11 are ticked in `.agents/planning/2026-04-11-eatme-code-refactor/implementation/plan.md`).
- Google Places admin ingestion design + `google_place_id` dedup path (2026-04-10-admin-restaurant-ingestion).
- Performance indexes (`076_performance_indexes.sql`, `077_recent_viewed_restaurants_view.sql`).

**Mid-flight** — `2026-04-22-ingestion-improvements` is closing out in v1 via the Ralph loop; all 18 plan-steps are ticked (see `.agents/planning/2026-04-22-ingestion-improvements/implementation/plan.md` lines 20-37 + git log `9804556`, `0f3d891`, `9fcc211`). The new 5-kind enum, `dish_courses` / `dish_course_items`, `saved_dish_ids` / `saved_at` on `menu_scan_jobs`, Zustand-backed review page, and soft-undo endpoint are all landed on `main`. The one outstanding operational step is running `115_tighten_dish_kind_check.sql` in production after admin triage.

**Designed-but-deferred** — shipped as plans only, v2 must selectively absorb:
- Auth-flow fixes (2026-04-12) — a concrete list of 13 v1 defects v2 should prevent by construction.
- Web-portal UI redesign (2026-04-10) — DataTable, useDialog, usePagination, sectioned RestaurantForm; dark-mode token pipeline already landed.
- Menu-scan AI hardening (2026-04-06) — GPT-4o Structured Outputs, 3-layer fuzzy merge, completeness scoring; directly reusable since user stays on GPT.

---

## 2. Active coordination: `2026-04-22-ingestion-improvements`

This is the #1 coordination risk. It's the most recent thing touching v2's exact surface (menu-scan review + dish taxonomy), and it landed Zustand-based state management which conflicts with v2's "Server Components + Server Actions first" posture.

### 2.1 — Exact status, from checklist + git log

Reference: `.agents/planning/2026-04-22-ingestion-improvements/implementation/plan.md` lines 20-37 (all `- [x]`).

| Step | What it landed | Production run needed? | v2 position |
|---|---|---|---|
| 1 | `114_ingestion_rework.sql` — `dishes.status`, `is_template`, `source_image_index`, `source_region`, relaxed CHECK, auto-rename `combo→bundle` / `template→configurable`, `dish_courses` + `dish_course_items`, FK cascade on `dish_ingredients`, `menu_scan_jobs.saved_dish_ids` + `saved_at`, `generate_candidates()` excludes templates | Yes — migration runs in normal deploy | **Inherit unchanged.** These are the building blocks v2's additive schema plan sits on top of. |
| 2 | Shared `DishKind` transitional 8-value union → narrowed to 5 in step 18 (`packages/shared/src/types/restaurant.ts`, `packages/shared/src/constants/menu.ts DISH_KIND_META`) | N/A | **Inherit.** Matches v2 rough-idea §"What it does" bullet 3. |
| 3 | Menu-scan API route updated with GPT-4o Structured Outputs + 5-kind enum + `source_image_index` + courses; `enrich-dish` Edge Function handles new kinds | N/A | **Inherit the prompt + schema; rebuild the route.** v2 moves this behind an async job worker (see §2.2). |
| 4 | `POST /api/menu-scan/confirm` + `POST /api/menu-scan/undo` (15-min soft-undo) | N/A | **Rebuild.** v2's atomic `confirm_menu_scan(job_id, payload, idempotency_key)` Postgres function supersedes the web-route three-pass insert. The soft-undo pattern may carry forward but wrapped around the new RPC. |
| 5 | `/admin/dishes/experience-triage` page + `POST /api/admin/dishes/triage` + `admin_audit_log` rows | Yes — admin must classify remaining `experience` rows once | **Inherit for the admin app** (`apps/admin/`). Runs once, then the page self-redirects. |
| 6 | `115_tighten_dish_kind_check.sql` authored locally with row-count guard | **Yes — operationally gated, NOT yet run in prod** | v2 depends on this running before its own migration pack ships, because v2 narrows `DishKind` further in its own schema. Coordinate. |
| 7-10 | Zustand `store/` scaffold with `uploadSlice`, `processingSlice`, `reviewSlice`, `draftSlice`, `groupSlice`, selectors; `MenuScanReview` shell reads from store | N/A | **Conflicts with v2.** See §2.2. |
| 11-16 | `DishEditPanelV2` + `KindSelectorV2` + `VariantEditor` + `CourseEditor` + `PageGroupedList` + `FlaggedDuplicatePanel` + `SavePreviewModal` + `UndoToast` + `useKeyboardShortcuts` | N/A | **Port selectively.** The new components solve real UX problems the v1 page never had. Their state coupling to Zustand is the only reason v2 can't reuse them verbatim. |
| 17 | Mobile `DishPhotoModal` `KIND_BADGE` lookup (`b6dbf5e`) | N/A | **Inherit.** Already covered by v2's compat-patch policy. |
| 18 | `DishKind` narrowed to 5 values; legacy exports removed; lint fixes (`9804556`, `73cb2f3`, `0f3d891`) | Depends on step 6 | **Inherit.** `apps/web-portal-v2/` starts on the narrow union from day one. |

### 2.2 — The conflict: Zustand review UI vs v2 async jobs

`.agents/planning/2026-04-22-ingestion-improvements/design/detailed-design.md` §2.4 adopts Zustand explicitly ("replace the review-step state layer (prop-drilling → Zustand)"). v2's rough-idea (`/home/art/Documents/eatMe_v1/apps/rough-idea.md` line 189) explicitly lists Zustand under "Things to not carry over" ("we used it for almost nothing — Server Components + Query covers it").

The tension:

- Step 7-10's Zustand slices are synchronous, localStorage-backed, single-browser-session. They assume the whole scan result is in memory and edited client-side until a one-shot confirm.
- v2 wants the job result to live in `menu_scan_jobs.result` on the server, streamed over Supabase Realtime, and edited via Server Actions hitting the DB directly. Re-opening the tab 3 days later resumes from the DB (rough-idea line 143).

**v2 resolution (proposal):** port the *visual* components from steps 11-16 (`DishEditPanelV2`, `KindSelectorV2`, `CourseEditor`, `PageGroupedList`, `FlaggedDuplicatePanel`, `SavePreviewModal`) as Server Components where possible; for the edit surface, keep one small client boundary that reads from Server Action mutations instead of a Zustand slice. The draft-autosave concern is solved by the DB-as-source-of-truth rule, removing localStorage entirely. `useKeyboardShortcuts` ports as-is.

**v2 ignores:** `store/draftSlice.ts` (localStorage versioned drafts — DB replaces it), `store/uploadSlice.ts` + `store/processingSlice.ts` (replaced by Server Actions + Realtime channel), the 15-min in-browser undo toast (replaced by an idempotent confirm RPC + explicit "Unpublish" on the restaurant).

---

## 3. Locked / already-shipped decisions v2 inherits

| Decision | Shipped in | File reference |
|---|---|---|
| Parent-child variant model via `parent_dish_id` + `is_parent`; feed excludes `is_parent=true` | migration 073 | `supabase/migrations/073_universal_dish_structure.sql`; enforcement via `generate_candidates()` `WHERE d.is_parent = false` (`114_ingestion_rework.sql` line 315) |
| `primary_protein` single-column 11-value NOT NULL enum + `deriveProteinFields` helper | migrations 110, 111 | `packages/shared/src/logic/protein.ts`; `CLAUDE.md` §"Dish Classification — Primary Protein" |
| `dish_kind` 5-value narrow enum (`standard|bundle|configurable|course_menu|buffet`); `is_template boolean` orthogonal | migrations 114 (relax + auto-rename) + 115 (tighten) | `packages/shared/src/constants/menu.ts DISH_KIND_META`; `CLAUDE.md` §"Dish Kind — Composition Type" |
| `dishes.status` column (`draft|published|archived`, default `'published'`, NOT NULL) | migration 114 lines 22-27 | **Precedent: v2's equivalent columns on `restaurants` and `menus` do NOT yet exist** and are part of v2's additive migration pack. |
| `dish_ingredients` ON DELETE CASCADE | migration 114 lines 68-73 | Required for v2's confirm-RPC rollback |
| `dish_courses` + `dish_course_items` tables with RLS via join-to-owner | migration 114 lines 77-162 | RLS pattern reusable verbatim for any new v2 child table |
| `menu_scan_jobs` table with `status∈{processing, needs_review, completed, failed}`, `result_json`, extraction telemetry, `saved_dish_ids`, `saved_at` | `database_schema.sql` line 253; extended by migrations 087, 089, 114 | **Relevant gap: v2's rough-idea specifies `{id, owner_id, restaurant_id, status, input, result, attempts, created_at, updated_at, locked_until}`. Mapping: `created_by`→keep + add `owner_id` (or rename semantically); `result_json`→`result` is a rename (non-breaking via view/alias); `input`, `attempts`, `locked_until` are new columns.** This is additive, non-breaking. |
| `@eatme/shared` public surface (types, constants, validation, logic) | all 22 steps of 2026-04-11 | `packages/shared/src/index.ts` + `.agents/planning/2026-04-11-eatme-code-refactor/implementation/plan.md` lines 5-26 |
| `agent_docs/` convention: `architecture.md`, `commands.md`, `conventions.md`, `database.md`, `terminology.md` | 2026-04-11 step 8 | v2 extends, doesn't replace |
| Husky + lint-staged + GitHub Actions CI | 2026-04-11 steps 20-22 | v2 must keep both new apps in the pipeline |
| `google_place_id` unique column + warning-flag pattern | migration 080 | `supabase/migrations/080_restaurant_import.sql`; blueprint in §7 |
| Performance indexes (7 new indexes + `recent_viewed_restaurants` view) | migrations 076, 077 | `.agents/planning/2026-04-08-implement-performance-optimizations/summary.md` line 50-57 |
| `enrichment_review_status` column + staged AI-suggestion payload | migration 074 | `.agents/planning/2026-04-06-menu-ingestion-enrichment/design/detailed-design.md` §2.8 |
| Mapbox-only (mobile); Leaflet + mapbox-gl removed from web bundle | 2026-04-10 web-portal-redesign step 1 | 700KB bundle win |

---

## 4. Auth findings v2 must fix by construction

Source: `.agents/planning/2026-04-12-auth-flow-review/research/auth-flow-findings.md` + `summary.md`. v2 prevents each by how the code is structured on day one, not by patching.

| # | Severity | v1 defect | v2 mitigation (by construction) |
|---|---|---|---|
| 1 | CRITICAL | `apps/web-portal/proxy.ts` is dead code — Next.js looks for `middleware.ts` | v2 writes `apps/web-portal-v2/middleware.ts` and `apps/admin/middleware.ts` from the first commit. Both use the `updateSession` pattern from `@supabase/ssr`. |
| 2 | CRITICAL | Admin role checked from `user_metadata.role` which any user can self-mutate via `supabase.auth.updateUser` | All admin checks read `app_metadata.role`. Service-role-only writer. Enforced by a lint rule or typed helper `isAdmin(user)` that only looks at `app_metadata`. Ad-hoc middleware checks are banned — only `withAdminAuth(handler)` wrapper (see rough-idea line 152-155). |
| 3 | HIGH | Mobile Facebook OAuth reads `#access_token` (implicit flow); Supabase returns `?code=` (PKCE) | Out of v2 web-portal scope; note for mobile follow-up. v2 web doesn't touch this code. |
| 4 | HIGH | Mobile `signUp` missing `emailRedirectTo` → verification opens web not app | Out of v2 web-portal scope. |
| 5 | HIGH | Login page ignores `?redirect=` query param (proxy appends it, form drops it) | v2 login form reads `searchParams.redirect` and passes it through; default `'/'`. Covered by Playwright test. |
| 6 | MEDIUM | Double render on web mount (both `getSession()` and `onAuthStateChange` INITIAL_SESSION fire) | v2 uses Server Components for the initial session via server-side cookie read; no client-side `getSession` is ever called for the first paint. |
| 7 | MEDIUM | `ProtectedRoute` client component has no role check — any authed user could reach `/admin` UI once middleware was fixed | No `/admin` exists in `apps/web-portal-v2/`; admin lives in a separate app (`apps/admin/`) whose middleware enforces `app_metadata.role==='admin'` as the top matcher. Two-app split is the mitigation. |
| 8 | MEDIUM | Web `signUp` always shows "check email", even when session auto-creates | v2 signUp handler inspects the Supabase response shape and routes accordingly. |
| 9 | LOW | Unsafe cast in `storage.ts:clearIfStale` | N/A — v2 does not use localStorage for state (rough-idea line 143). |
| 10 | LOW | Facebook OAuth Supabase prerequisites undocumented | Updated in v2's setup doc. |
| 11 | LOW | Mobile `isLoading` not reset in `onAuthStateChange` | Out of v2 scope. |
| 12 | LOW | `/` (dashboard) not edge-protected | v2 middleware matcher includes `/` and `/(owner)/*`. |
| 13 | Doc | Stale admin-role doc in `docs/project/workflows/auth-flow.md` | Update in v2 docs pass. |

---

## 5. Component patterns worth porting

From `.agents/planning/2026-04-10-web-portal-redesign/summary.md` and `.agents/planning/2026-04-09-web-portal-ux-redesign/summary.md`.

| Pattern | Where from | Rationale | Conflict with v2 RSC-first? |
|---|---|---|---|
| `DataTable` as pure renderer; parent pre-filters via hooks | 2026-04-10 step 10 | No internal state; composes cleanly with Server Components streaming rows | No |
| `SearchFilterBar` | 2026-04-10 step 10 | Reusable for admin list pages | Client component (input focus) but narrow |
| `useDialog` hook with `close()` (keeps data for animation) vs `reset()` (clears immediately) | 2026-04-10 step 8 | Correct modal lifecycle semantics | Client hook — fine, only dialogs need it |
| `usePagination`, `useFilters` | 2026-04-10 step 8 | Reused by menus + ingredients + restaurants list | Client hooks, but small |
| `RestaurantForm` unified via `sections` config + `enableDraft` prop | 2026-04-10 step 13 | Kills the 779+831 LOC duplicate new vs edit forms; avoids branching on `role` | **Partially.** v2 rough-idea line 165 says "Same UI for first edit and N-th edit" — this pattern fits. But v2 replaces `enableDraft` localStorage with DB-as-source-of-truth. Port the sections config; drop `enableDraft`. |
| Menu-scan extraction into `lib/menu-scan-utils.ts` + `useMenuScanState` hook + `MenuScanUpload` / `MenuScanProcessing` / `MenuScanReview` step components | 2026-04-10 steps 16-17 | 2,921 LOC orchestrator → ~80 LOC | **Obsoleted by 2026-04-22.** Port the newer 2026-04-22 components (`DishEditPanelV2`, `PageGroupedList`, etc.) instead. |
| `PageHeader`, `LoadingSkeleton`, `EmptyState`, `ConfirmDialog` | 2026-04-09 step 3 | 11 `window.confirm()` calls replaced → accessible, testable | No |
| `OnboardingStepper` + `/onboard/layout.tsx` | 2026-04-09 step 4 | Matches v2 rough-idea line 165 "wizard is the same form pre-filled with empty defaults, with a stepper UI overlay" | No — layout is a Server Component wrapper |
| `DishFormDialog` decomposition (1,354 LOC → orchestrator + 9 sub-components) | 2026-04-09 step 7 | Addresses rough-idea's "5 implicit modes" bug magnet — but decomposition alone is insufficient; v2 also needs discriminated-union typing on the modes | **Partially.** Port the decomposition *structure*, not the optional-props API |
| `BasicInfo` decomposition + `useRestaurantDraft` hook | 2026-04-09 step 8 | 1,027 LOC → orchestrator + 7 sub-components | `useRestaurantDraft` is localStorage-backed — drop it |
| ThemeProvider + ThemeToggle + token pipeline (`culori` hex→oklch) | 2026-04-10 steps 2-3 | Dark mode already wired | No — inherit wholesale |
| `StatusBadge`, `InfoBox`, `SectionCard` shared components | 2026-04-10 step 7 | Visual consistency | No |
| `LocationFormSection` extracted | 2026-04-10 step 12 | Shared between new/edit/onboard | No |

---

## 6. Menu-scan AI patterns to keep (user stays on GPT)

Source: `.agents/planning/2026-04-06-menu-ingestion-enrichment/design/detailed-design.md` §2.2-2.8 + `research/gpt4o-vision-prompt-engineering.md`.

| Pattern | Reference | Status | v2 action |
|---|---|---|---|
| GPT-4o Vision + `response_format: { type: 'json_schema', strict: true }` — 100% schema compliance vs ~40% free-form | `research/gpt4o-vision-prompt-engineering.md` §1 | Shipped in 2026-04-06 then updated in 2026-04-22 step 3 for 5-kind enum | **Inherit.** Don't re-prompt-engineer. |
| Schema moved out of prompt into `response_format.json_schema` (~500 tokens saved) | `research/gpt4o-vision-prompt-engineering.md` §2 | Shipped | Inherit |
| Decision-tree prompt structure (priority-ordered: template→combo→experience→variants→MP→family→standard) | `detailed-design.md` §2.2 | Updated in 2026-04-22 to 5 new kinds | Inherit |
| 2-3 few-shot examples (standard, template-with-variants, combo) — text-only | `research/gpt4o-vision-prompt-engineering.md` §5 | Shipped | Inherit |
| 3-layer fuzzy category matching (normalize → synonym → string similarity ≥0.85) | `detailed-design.md` §2.3 | Shipped | Inherit |
| Flag same-name-different-price as potential variants (not silent drop) | `detailed-design.md` §2.3 | Shipped; refined by `FlaggedDuplicatePanel` in 2026-04-22 step 14 | Inherit |
| Page-indexed placeholders for null categories instead of merging all nulls | `detailed-design.md` §2.3 | Shipped | Inherit |
| `source_image_index` tagged per dish for image-back-reference | 2026-04-22 step 3 | Shipped | Inherit (column already on `dishes`) |
| Confidence badges + sort-low-first + "Accept all above N%" bulk action | `research/review-ui-patterns.md` | Designed; partially shipped in 2026-04-22 | Port the UI components as Server Components where possible |
| Completeness scoring dish_kind-aware (template/experience "complete" from option-count, not ingredient-count) | `detailed-design.md` §2.7 | Shipped | Inherit — but v2's UI hides ingredients so the completeness check mostly degrades to price+name+kind for new dishes |
| Staged AI suggestions (`enrichment_payload.inferred_allergens`, `enrichment_review_status`) | `detailed-design.md` §2.8 | Shipped (migration 074) | **v2 position: leave dormant.** The UI is not exposed in v2 owner portal (rough-idea §"Out of scope"); admin app can surface later. |
| Structured Outputs via Zod `zodResponseFormat()` helper | `research/gpt4o-vision-prompt-engineering.md` §1 | Shipped | Inherit — fits v2's "Zod-as-server-validator" rule |

---

## 7. Admin bulk-import inheritance

Source: `.agents/planning/2026-04-10-admin-restaurant-ingestion/design/detailed-design.md` + `summary.md`.

v2's admin app (`apps/admin/`) should adopt the 10-step blueprint largely verbatim. Specifics:

| Asset | Where | v2 admin action |
|---|---|---|
| `google_place_id text UNIQUE` column on `restaurants` | migration 080 | Already shipped; dedup via this column |
| Nearby Search (New) + FieldMask header (single call returns full details — no separate Place Details lookup; ~95% cost cut) | `detailed-design.md` §Data Sourcing | Inherit |
| Enterprise Plus tier field set (`dineIn`, `delivery`, `takeout`, `reservable`) at $40/1K, first 1,000/mo free | `summary.md` Cost Projections | Inherit — budget $10 for 5,000-restaurant seed |
| Dedup strategy: exact `google_place_id` silently skipped; fuzzy name+200m proximity inserted but flagged as `possible_duplicate` | `summary.md` Key Decisions | Inherit |
| Warning flags computed at query time (`missing_cuisine`, `missing_hours`, `missing_contact`, `missing_menu`, `possible_duplicate`) | `detailed-design.md` §Import Behavior | Inherit — no stale flags after edits |
| No blocking review step — insert immediately, flag for post-import review | `summary.md` Key Decisions | Inherit |
| `restaurant_import_jobs` job-tracking table + `google_api_usage` for cost control | migration 080 | Inherit |
| CSV import as secondary path with same dedup/flag logic | `detailed-design.md` §CSV Upload | Inherit |
| "Scan Menu" quick-link from restaurant row → `/admin/menu-scan?restaurant_id=xxx` | `summary.md` Step 8 | Inherit, but v2 admin menu-scan uses the new async job system |

**Where v2 diverges:** v2 admin menu-scan posts to the new `menu_scan_jobs`-backed async worker rather than the synchronous `/api/menu-scan` handler. Same input UX, different backend shape.

---

## 8. Deferred / irrelevant prior work

Per task brief, only noted here; not mined.

| Planning dir | One-line reason for skipping |
|---|---|
| `2026-04-05-project-documentation` | Superseded by `agent_docs/` + `CLAUDE.md` landed via 2026-04-11 |
| `2026-04-05-universal-dish-structure` | Already shipped (migration 073); v2 inherits the parent-child primary-dimension contract via §3 |
| `2026-04-07-fix-eat-together` | Mobile-consumer feature; migration 075 shipped; out of v2 scope |
| `2026-04-07-optimize-performance` | Research-only, superseded by 2026-04-08 (which v2 inherits via §3) |
| `2026-04-08-rating-system` | Consumer feature (migration 079 shipped); no v2 touch-points |
| `2026-04-15-parent-child-variants` | Refinement of 073; relevant only if v2 were redesigning the dish model, which it isn't |

---

## 9. V2 action list — things v2 must do / absorb / avoid

**Must do (by construction):**

1. Write `apps/web-portal-v2/middleware.ts` and `apps/admin/middleware.ts` from commit 1 — no `proxy.ts` filename ever.
2. Admin role check reads only `app_metadata.role`; expose a single `isAdmin(user)` helper in `@eatme/shared`; ban `user_metadata.role` via ESLint `no-restricted-properties` or equivalent.
3. All mutation entry points wrapped in `withAuth(handler)` / `withAdminAuth(handler)` / `withPublic(handler)`. CI fails if a new route-handler or Server Action lacks a wrapper (rough-idea line 220 target).
4. v2's additive migration pack adds `status` column to `restaurants` and `menus` matching `dishes.status` (default `'published'`, CHECK `draft|published|archived`, NOT NULL). Add indexes. `dishes.status` is already there.
5. v2's additive migration pack extends `menu_scan_jobs`: add `owner_id`, `input jsonb`, `attempts int`, `locked_until timestamptz`; use existing `result_json` for result (or add a view `result` aliasing it — non-breaking).
6. Author `publish_restaurant_draft(restaurant_id uuid)` + `confirm_menu_scan(job_id uuid, payload jsonb, idempotency_key text)` Postgres functions. Both transactional.
7. RLS tightening: `restaurants` / `menus` / `dishes` public-read changes from `USING (true)` to `USING (status = 'published')`. Owner policies unchanged. Pre-flight row-count check is mandatory — see rough-idea Risky Areas §2.
8. Edge Function patches on `nearby-restaurants`, `feed`, `group-recommendations`, `generate_candidates`.
9. Mobile patches: add `.eq('status', 'published')` in direct queries in `apps/mobile/src/stores/restaurantStore.ts`. Mechanical only.
10. Coordinate with 2026-04-22's step 6 (`115_tighten_dish_kind_check.sql`) — must run in prod before v2's migration pack if v2 relies on the narrow enum.
11. Playwright E2E covers: signup → onboard → menu-scan → publish → re-edit. CI gates deploys on these. v1 has zero E2E.

**Absorb (port):**

- GPT-4o Vision prompt + Zod Structured Outputs + 3-layer fuzzy merge + `source_image_index` tagging (all from 2026-04-06 + 2026-04-22 step 3).
- UI components from 2026-04-22 steps 11-16 (`DishEditPanelV2`, `KindSelectorV2`, `VariantEditor`, `CourseEditor`, `PageGroupedList`, `FlaggedDuplicatePanel`, `SavePreviewModal`, `useKeyboardShortcuts`) — **but** replace their Zustand store bindings with Server Action / Supabase Realtime reads.
- From 2026-04-10-redesign: `DataTable`, `SearchFilterBar`, `useDialog`, `usePagination`, `useFilters`, sectioned `RestaurantForm`, `StatusBadge`, `InfoBox`, `SectionCard`, `LocationFormSection`, ThemeProvider/toggle, token pipeline.
- From 2026-04-09-ux: `PageHeader`, `LoadingSkeleton`, `EmptyState`, `ConfirmDialog`, `OnboardingStepper`, `OperatingHoursEditor`, `CuisineSelector`, `DishFormDialog` decomposition *structure*.
- From 2026-04-10-admin-ingestion: Google Places Nearby-Search-with-FieldMask pattern; `google_place_id` dedup; warning flags; CSV secondary path.
- From 2026-04-11: `@eatme/shared`, `agent_docs/`, Husky, lint-staged, CI — keep, extend to two new apps.

**Avoid (from prior plans):**

- Zustand in v2 web-portal-v2 app (rough-idea line 189).
- localStorage-backed draft persistence — DB is the source of truth.
- 15-minute in-browser soft-undo pattern — replace with idempotent confirm + explicit unpublish.
- Synchronous `/api/menu-scan` route handler that hangs Vercel on big menus (rough-idea line 50). Replace with `menu_scan_jobs`-backed async worker (Supabase Edge Function + `pg_cron`).
- `DishFormDialog`'s "5 implicit modes via optional props" API — replace with discriminated unions or separate components (rough-idea design principle 5).
- Client-side-only Zod validation — server is the gate.
- The `eatme_restaurant_draft` legacy localStorage key — delete on sight (rough-idea line 190).
- Ingredient pipeline UI surface — deferred per rough-idea §"Follow-up projects". DB tables stay populated for legacy dishes; new v2 dishes have empty allergen/dietary fields.

---

_End of consolidation. For any concrete claim above, see the cited file paths for primary source._
