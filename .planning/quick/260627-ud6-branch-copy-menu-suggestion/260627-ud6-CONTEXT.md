# Quick Task 260627-ud6: Proactive branch copy-menu suggestion (operator issue #1) - Context

**Gathered:** 2026-06-27
**Status:** Ready for planning

<domain>
## Task Boundary

Operator issue #1: when an operator opens a restaurant that has **no menu yet**,
proactively suggest copying the menu from an existing restaurant whose name is
similar (sucursales/branches) — instead of requiring a blind manual search.

**Critical grounding (changes scope):** copy-menu already exists end-to-end.
- RPC `admin_copy_restaurant_menu` (migration 160) deep-clones
  menus → menu_categories → dishes → option_groups → options as **drafts**,
  one-time, with guards (TARGET_HAS_MENUS, SOURCE_IS_TARGET, course-menu abort).
- `CopyMenuSection.tsx` renders on the restaurant detail page **only when
  `menusData.menus.length === 0`** (`apps/admin/.../restaurants/[id]/page.tsx:143`).
- It currently offers a **manual** debounced name search
  (`searchCopySourceRestaurants`, plain `ilike '%q%'`) + pick-list + confirm.
- pg_trgm is installed; `idx_restaurants_name_trgm` GIN index exists
  (migration 116c). No admin "create restaurant" flow exists, so the detail-page
  empty-menu section is the only consistent home for suggestions.

So this task is an **enhancement** to the existing `CopyMenuSection`, NOT a new
feature: auto-rank likely branches by trigram name similarity on load and offer
one-tap copy, with the existing manual search as fallback.

</domain>

<decisions>
## Implementation Decisions

### Match scope
- Search **all restaurants** by name similarity (no owner filter) — mirrors the
  existing manual search; owners aren't set consistently in this single-operator
  model, so owner-scoping would miss real branches.

### Source filter
- A restaurant is eligible as a suggestion only if it has **≥ 1 dish**
  (non-empty), matching the bar the manual search already applies (it disables
  zero-dish results). No published-only restriction — a draft sister branch is a
  valid source.

### Suggestion UX
- Show **up to 3 strongest name matches** as one-tap "Copy from X" cards above
  the manual search box, ranked by similarity. Each card shows name · city ·
  dish count (same metadata as the manual results).
- The block is **dismissible** — dismissing collapses it and reveals just the
  manual search. If no restaurant clears the similarity threshold, the block
  simply doesn't render (silent fallback to manual search; no empty state).

### Claude's Discretion
- **Similarity mechanism + threshold:** add a small SECURITY DEFINER RPC
  `suggest_copy_source_restaurants(p_target_restaurant_id, p_limit)` that orders
  by `similarity(r.name, t.name)` using the `%` trgm operator (GIN index), joins
  dish counts, excludes self + empty restaurants, returns top N. Default
  threshold via `pg_trgm.similarity_threshold` (0.3) or an explicit `>= 0.2`
  floor — tuned to avoid noise; limit 3. (PostgREST can't express
  `similarity()` ordering, so an RPC is required — substring `ilike` of the full
  name wouldn't catch "Tacos X Centro" vs "Tacos X Polanco".)
- **Reuse** the `CopySourceCandidate` shape + the existing copy confirm/handler;
  only the *discovery* path is new. Selecting a suggestion reuses the same
  `setSelected` → confirm → `adminCopyRestaurantMenu` flow.
- Migration is applied **out-of-band by the operator** (no local psql; REST-only).
- Tests: light. Admin tooling, stable copy path already shipped — no heavy test
  scaffolding; a focused action-level test only if cheap.

</decisions>

<specifics>
## Specific Ideas

- Existing manual search: `searchCopySourceRestaurants(targetRestaurantId, q)` in
  `apps/admin/src/app/(admin)/restaurants/[id]/actions/copyMenu.ts`.
- Existing confirm: `adminCopyRestaurantMenu(targetId, sourceId)` → RPC.
- Suggestion cards should visually read as "Looks like a branch of …" but stay
  understated (operator tool, not consumer UI).

</specifics>

<canonical_refs>
## Canonical References

- `infra/supabase/migrations/160_admin_copy_restaurant_menu.sql` — copy RPC.
- `infra/supabase/migrations/116c_restaurants_name_trgm.sql` — trgm index + pg_trgm.
- `apps/admin/src/app/(admin)/restaurants/[id]/CopyMenuSection.tsx` — UI to extend.
- `apps/admin/src/app/(admin)/restaurants/[id]/actions/copyMenu.ts` — actions to extend.
- `apps/admin/src/app/(admin)/restaurants/[id]/page.tsx:143` — render gate.

</canonical_refs>
