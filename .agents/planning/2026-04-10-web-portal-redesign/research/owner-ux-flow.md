# Restaurant Owner UX Flow Analysis

## Page Inventory

| Page | LOC | useState | useEffect | Complexity |
|------|-----|----------|-----------|------------|
| Dashboard (`app/page.tsx`) | 298 | 3 | 1 | Medium |
| Login (`auth/login/page.tsx`) | 185 | 7 | 0 | Low |
| Signup (`auth/signup/page.tsx`) | 230 | 8 | 0 | Low |
| Basic Info (`onboard/basic-info/page.tsx`) | 165 | 8 | 3 | High |
| Menu (`onboard/menu/page.tsx`) | 561 | 14 | 3 | Very High |
| Review (`onboard/review/page.tsx`) | 401 | 4 | 3 | Medium |
| Edit (`restaurant/edit/page.tsx`) | 265 | 6 | 3 | Medium |
| Menu Manage (`menu/manage/page.tsx`) | 10 | 0 | 0 | Redirect only |
| **Total** | **2,115** | **50** | **13** | |

## Critical UX Issues

### 1. Step Order Broken
Basic Info → Review (skips menu step!). The routing goes from `/onboard/basic-info` directly to `/onboard/review`, bypassing `/onboard/menu`.

### 2. Cannot Upload Dish Photos
`DishPhotoField` only accepts URLs — no file upload. Dead feature for most users.

### 3. Cannot Edit Cuisines Post-Onboarding
Restaurant edit page (`/restaurant/edit`) lacks cuisine selection. Once set during onboarding, cuisines are locked.

### 4. Stats Grid Broken on Mobile
Review page uses `grid grid-cols-3` without responsive breakpoints. Unreadable on phones.

### 5. Draft vs DB State Unclear
Dashboard loads from DB first, falls back to localStorage draft. No clear indication to user which data source is active.

### 6. Menu Page Complexity
561 LOC, 14 useState hooks. Handles: menu CRUD, dish CRUD, dialogs, categories, ingredients, options, saving — all in one component.

### 7. No "Forgot Password"
Login page has no password reset link.

### 8. Restaurant Name Required at Signup
Forces user to think of a name before creating account — unnecessary friction.

### 9. Limited Restaurant Edit
Can't edit: cuisines, restaurant type, payment methods, service speeds. User must recreate restaurant for major changes.

### 10. No Menu/Dish Reordering
Items appear in creation order. No drag-and-drop or manual ordering.

## Mobile Responsiveness

**Very limited:**
- Dashboard: 2 responsive breakpoints (`md:grid-cols-3`, `md:grid-cols-2`)
- Auth pages: None (card stays centered by default)
- Onboarding: None (forms stack naturally)
- Menu: None (tabs scroll horizontally)
- Review: None (3-col grid always, broken on mobile)
- Edit: None (forms stack naturally)

## Loading/Error Handling

**Loading:** All pages use `LoadingSkeleton` with appropriate variants. Good coverage.

**Errors:** Mix of toast notifications and Alert components. Some errors shown in both (OAuth login). No retry mechanisms, no network timeout handling.

## Auto-Save System

Basic Info uses `useRestaurantDraft` hook for real-time localStorage saves with `AutoSaveIndicator` showing timestamp. Good feature, but:
- Silent saves may confuse users
- No explicit "Save Draft" button
- No indication when draft conflicts with DB data
