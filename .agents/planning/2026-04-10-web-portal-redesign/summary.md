# Project Summary — Web Portal Redesign

**Date:** 2026-04-10  
**Project:** `2026-04-10-web-portal-redesign`  
**Status:** Planning complete — ready for implementation

---

## What This Project Is

A redesign of the EatMe web-portal (admin + restaurant owner views) with three goals:

1. **Visual modernization** — consistent design language, working dark mode, refined typography and spacing
2. **Developer experience** — unified style system, shared components, ~1,900 lines of code eliminated
3. **UX improvements** — fixed onboarding flow, mobile responsiveness, auth improvements

The existing stack (Next.js 16, React 19, Tailwind v4, Radix UI/shadcn, Supabase) is unchanged. This is an organizational redesign, not a rewrite.

---

## Artifacts Created

```
.agents/planning/2026-04-10-web-portal-redesign/
├── rough-idea.md                      Original concept
├── idea-honing.md                     11 Q&A requirements (self-researched)
├── summary.md                         This document
├── research/
│   ├── current-codebase.md            Full codebase audit (~128 files, ~24,600 LOC)
│   ├── style-issues.md                312+ hardcoded colors, 3 parallel color systems
│   ├── ux-and-components.md           Component duplication, large files, UX gaps
│   ├── tailwind-shadcn-best-practices.md  Tailwind v4 opportunities and className bloat
│   ├── tokens-integration.md          @eatme/tokens gap analysis + integration plan
│   ├── owner-ux-flow.md               Full owner flow audit (2,115 LOC, 50 useState)
│   ├── test-coverage.md               26% coverage, high-risk untested files
│   └── performance.md                 700KB unused deps, 77 client components
├── design/
│   └── detailed-design.md             Full design document (reviewed + revised)
└── implementation/
    └── plan.md                        20-step TDD implementation plan
```

---

## Key Design Decisions

| Decision | Rationale |
|----------|-----------|
| Keep Tailwind + shadcn/ui | Stack is correct; problems are organizational |
| Token pipeline via `culori` script | Bridges `@eatme/tokens` (hex) → CSS (oklch) without Style Dictionary overhead |
| `DataTable` is a pure renderer | Parent pre-filters via hooks; table has no internal state |
| `RestaurantForm` uses `sections` config, not `role` prop | Avoids conditional branching inside component |
| `loading.tsx` over Suspense | All pages are `'use client'`; Suspense requires RSC data fetching |
| `close()` vs `reset()` on `useDialog` | `close()` keeps data for exit animation; `reset()` clears immediately |

---

## Design Overview

### New Files (22 new files)
- `middleware.ts` — auth redirects before page render
- `app/tokens.css` — generated CSS variables from `@eatme/tokens`
- `app/loading.tsx`, `app/admin/loading.tsx` — route-level skeletons
- `app/auth/forgot-password/page.tsx`, `app/auth/reset-password/page.tsx`
- `components/ThemeToggle.tsx`, `DataTable.tsx`, `SearchFilterBar.tsx`
- `components/StatusBadge.tsx`, `InfoBox.tsx`, `SectionCard.tsx`
- `components/LocationFormSection.tsx`
- `hooks/useDialog.ts`, `hooks/usePagination.ts`, `hooks/useFilters.ts`
- `lib/menu-scan-utils.ts`
- `app/admin/menu-scan/hooks/useMenuScanState.ts`
- `app/admin/menu-scan/components/MenuScanUpload.tsx`, `MenuScanProcessing.tsx`, `MenuScanReview.tsx`
- `packages/tokens/scripts/generate-css-vars.ts`

### Deleted Files (2 files)
- `components/admin/NewRestaurantForm.tsx` — merged into unified `RestaurantForm`
- `components/admin/RestaurantTable.tsx` — replaced by `DataTable` used directly in the restaurants page

### Key Modified Files
- `app/layout.tsx` — ThemeProvider wrapper
- `app/globals.css` — token imports + `@layer utilities`
- `components/admin/RestaurantForm.tsx` — unified with sections config + enableDraft
- `components/admin/RestaurantTable.tsx` — uses DataTable + SearchFilterBar
- `components/admin/AdminHeader.tsx`, `AdminSidebar.tsx` — semantic tokens + ThemeToggle
- `app/admin/restaurants/[id]/menus/page.tsx` — useDialog hook
- `app/admin/ingredients/page.tsx` — useDialog + usePagination + useFilters
- `app/admin/menu-scan/page.tsx` — 2,921 → ~80 LOC orchestrator
- `app/onboard/basic-info/page.tsx` — routing fix (→ menu, not review)
- `app/restaurant/edit/page.tsx` — cuisines + service options + payment methods

---

## Implementation Plan Overview

**20 steps, sequenced for incremental progress with a working demo after each step.**

| Steps | Phase | Key deliverable |
|-------|-------|----------------|
| 1 | Quick wins | 700KB removed, middleware active, skeletons |
| 2 | Token pipeline | `generate-css-vars` script, `tokens.css` output |
| 3 | Dark mode | ThemeProvider wired, toggle visible |
| 4–5 | Color migration | Admin shell then full app — dark mode complete |
| 6 | Utility layer | `@layer utilities` in globals.css |
| 7 | Visual components | StatusBadge, InfoBox, SectionCard |
| 8 | Hooks | useDialog, usePagination, useFilters |
| 9 | Hook adoption | menus/page + ingredients/page refactored |
| 10–11 | Table system | DataTable + SearchFilterBar + RestaurantTable |
| 12 | Location | LocationFormSection extracted |
| 13–15 | Forms | Unified RestaurantForm, admin pages, owner edit |
| 16–17 | menu-scan | Utils + hook extracted, page split to 3 steps |
| 18–19 | Auth + UX | Forgot password, onboarding fix, mobile pass |
| 20 | Polish | Spacing, typography, animations, badge sizes |

---

## Estimated Impact

| Metric | Before | After |
|--------|--------|-------|
| Hardcoded color classes | 312+ | 0 |
| Dark mode status | CSS ready, not wired | Fully functional |
| Largest file (menu-scan) | 2,921 LOC | ~80 LOC orchestrator |
| Duplicate restaurant forms | 748 + 622 LOC | ~700 LOC unified |
| Unused bundle weight | ~700KB | Removed |
| Color systems | 3 (tokens, CSS vars, hardcoded) | 1 |
| Total estimated LOC reduction | — | ~1,900 lines |

---

## Areas That May Need Further Refinement

1. **Mobile admin navigation** — Step 19 adds a minimal hamburger for mobile. A full mobile admin sidebar (slide-out drawer) is deferred; the minimal approach works but isn't polished.
2. **Dish photo upload** — Currently URL-only. This is a known gap (no file upload). Deferred — requires storage bucket + upload API, which is out of scope for this redesign.
3. **Menu/dish reordering** — No drag-and-drop ordering. Also deferred — would require a new drag library and schema changes.
4. **Full RSC migration** — All 77 pages are `'use client'`. A full server component migration would improve performance significantly but is a separate project.

---

## Next Steps

1. Read the full design: `.agents/planning/2026-04-10-web-portal-redesign/design/detailed-design.md`
2. Read the implementation plan: `.agents/planning/2026-04-10-web-portal-redesign/implementation/plan.md`
3. Start implementation following the checklist at the top of `plan.md`
4. Add project files to context: `/context add .agents/planning/2026-04-10-web-portal-redesign/**/*.md`
