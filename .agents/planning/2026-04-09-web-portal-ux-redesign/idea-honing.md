# Idea Honing — Web Portal UX/UI Redesign

Requirements clarification through Q&A.

---

## Q1: What specific UX pain points should we prioritize?

**Proposed answer:** Based on code analysis, the highest-impact issues are:
1. **No onboarding progress indicator** — users don't know they're on step 2/3
2. **Inconsistent error/loading states** — some forms show toasts, others fail silently, loading is a generic spinner
3. **Destructive actions without confirmation** — deleting menus/dishes uses no confirmation dialog
4. **Incomplete features visible in UI** — Quick Actions (Download Template, Settings) shown but non-functional
5. **Draft vs. database confusion** — two data systems (localStorage + Supabase) with unclear "last saved" meaning
6. **No pagination** — tables will break with many restaurants/ingredients

**CONFIRMED**

---

## Q2: What does "more modern" mean for this project?

**Proposed answer:** Based on the current stack (shadcn/ui + Tailwind CSS 4), the portal already has a solid foundation. "More modern" likely means:
- **Loading skeletons** instead of spinners
- **Smooth transitions/animations** for dialogs, page transitions, and state changes
- **Better visual hierarchy** — reduce excessive warning banners, clearer section headings
- **Consistent spacing and typography** — standardize card padding (currently mixes p-3, p-4, p-6), border colors (gray-200 vs gray-300)
- **Empty states with illustrations** instead of blank areas
- Keeping the existing orange brand palette but refining its usage

**CONFIRMED**

---

## Q3: What does "organized better" mean — layout restructuring or code organization or both?

**Proposed answer:** Both, based on the issues found:

**Layout/UX organization:**
- Add breadcrumbs/progress stepper to onboarding flow
- Standardize page layouts (consistent max-widths, header patterns)
- Improve admin sidebar — remove "Coming Soon" items, cleaner grouping
- Better form section grouping with collapsible sections for complex forms

**Code organization:**
- Extract oversized components (DishFormDialog is 500+ lines, BasicInfoPage 300+)
- Create shared form patterns (OperatingHoursEditor, CuisineSelector as reusable components)
- Standardize error handling (one pattern for toasts, inline errors, loading states)
- Move hardcoded values (colors for ingredient families, SVG icons) into shared constants/components

**CONFIRMED**

---

## Q4: Should we redesign the navigation structure or keep the current approach?

**Proposed answer:** Keep the current structure but improve it:
- **Admin:** Keep sidebar nav but clean it up — remove disabled "Coming Soon" items (Users, Settings), reduce security banners from 5 to 1 concise notice
- **Restaurant Owner:** Keep card-based dashboard navigation but add a persistent top nav bar with breadcrumbs for multi-step flows (onboarding, menu editing)
- **No major route restructuring** — the `/admin/*` and `/onboard/*` patterns are solid

**CONFIRMED**

---

## Q5: Which forms need the most attention?

**Proposed answer:** Based on complexity and usage frequency:
1. **DishFormDialog** (highest priority) — 500+ lines, 10+ form sections, two parallel code paths (wizard vs DB mode), no field-level validation feedback
2. **Onboarding BasicInfo** — complex state with auto-save, operating hours UI is dense, location picker has no loading feedback
3. **Admin Restaurant Edit/New** — duplicated code between edit and new forms, should share a single form component
4. **Ingredients management** — modal dialogs are basic HTML overlays instead of shadcn Dialog, inconsistent with rest of app

**CONFIRMED**

---

## Q6: Should we address accessibility as part of this redesign?

**Proposed answer:** Yes, at a practical level (not a full WCAG audit). Key fixes:
- Add `aria-label` to icon-only buttons (edit, delete, duplicate)
- Don't rely on color alone for status (add text labels alongside red/green badges)
- Replace emoji-based semantics (⚠️ for allergens, 🌱 for vegan) with proper icons + text
- Ensure dialog focus trapping works correctly
- Add labels to map container and time inputs

**CONFIRMED**

---

## Q7: Should we add dark mode support?

**Proposed answer:** No, not in this iteration. The globals.css already defines dark mode CSS variables, but the components use hardcoded light-mode Tailwind classes (bg-white, bg-gray-50, text-gray-700). A proper dark mode would require touching every component. Better to defer this and focus on the light-mode UX improvements.

**CONFIRMED**

---

## Q8: How should we handle the admin Menu Scan page?

**Proposed answer:** Light touch only. The menu scan workflow (upload → AI processing → review/accept/reject dishes) is the most complex page in the portal with batch operations, confidence scoring, inline editing, and ingredient matching. A full redesign would be a separate project. For this iteration:
- Improve the BatchToolbar layout and filter discoverability
- Add better visual progress for multi-page PDF uploads
- Standardize the DishGroupCard styling to match the rest of the design system
- Leave the core workflow and interaction patterns unchanged

**CONFIRMED**

---

## Q9: Should we implement the unfinished features (audit logs, Quick Actions, suspend functionality)?

**Proposed answer:** No new feature implementation in this UX redesign. Instead:
- **Remove** placeholder Quick Actions cards (Download Template, Settings) from the dashboard — showing non-functional UI is worse than not showing it
- **Remove** "Coming Soon" sidebar items (Users, Settings) from admin nav
- **Keep** the audit log nav item but add a proper "Coming Soon" empty state page instead of a dead link
- The suspend TODO in RestaurantTable should be left as-is (it's a feature gap, not a UX issue)

**CONFIRMED**

---

## Q10: What's the scope boundary — which pages/components are in vs. out?

**Proposed answer:**

**In scope:**
- Admin: Dashboard, Sidebar, Header, Restaurant list/detail/edit/new, Ingredients, Dish Categories
- Restaurant Owner: Dashboard, Auth (login/signup), Onboarding (all 3 steps), Restaurant Edit
- Shared: DishCard, DishFormDialog, IngredientAutocomplete, LocationPicker, AllergenWarnings, DietaryTagBadges, ProtectedRoute
- Global: globals.css theming, layout.tsx, loading/error patterns

**Out of scope (light touch only):**
- Menu Scan workflow (too complex, separate project)
- OAuth callback handler (functional, no UI)
- API routes (no UI)
- Database schema changes
- New feature development

**CONFIRMED**

---

## Q11: Should we extract a design system / component library, or improve components in-place?

**Proposed answer:** Improve in-place, with targeted extraction:
- **Don't** create a separate design system package — overkill for a single app
- **Do** create shared constants (color maps for ingredient families, badge color maps for dietary tags)
- **Do** extract reusable form patterns: `OperatingHoursEditor`, `CuisineSelector`, `RestaurantForm` (shared between admin new/edit)
- **Do** standardize the modal/dialog pattern (replace raw HTML overlays in Ingredients page with shadcn Dialog)
- **Do** consolidate inline SVGs in auth pages into icon components

**CONFIRMED**

---

## Q12: What testing strategy should accompany the UI changes?

**Proposed answer:** Since there are no existing UI tests in the codebase, a pragmatic approach:
- Add visual smoke tests for key pages (admin dashboard, restaurant owner dashboard, onboarding steps)
- Add component tests for extracted/refactored components (DishFormDialog, OperatingHoursEditor)
- Use the existing Zod schemas for form validation testing
- No E2E tests in this iteration (would require test infrastructure setup)

**CONFIRMED**

---
