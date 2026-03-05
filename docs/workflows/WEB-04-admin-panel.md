# WEB-04 — Admin Panel

## Overview

The admin panel is a separate section of the web portal accessible only to users with the `admin` role. It provides platform-level oversight: viewing aggregated statistics, managing restaurant listings, and managing the ingredient catalogue.

---

## Key Files

| File                                                      | Role                                                  |
| --------------------------------------------------------- | ----------------------------------------------------- |
| `apps/web-portal/app/admin/layout.tsx`                    | Auth guard — validates admin role on every admin page |
| `apps/web-portal/app/admin/page.tsx`                      | Dashboard overview with statistics                    |
| `apps/web-portal/app/admin/restaurants/page.tsx`          | List of all restaurants on the platform               |
| `apps/web-portal/app/admin/restaurants/[id]/page.tsx`     | Individual restaurant detail / moderation             |
| `apps/web-portal/app/admin/restaurants/new/page.tsx`      | Manually create a restaurant (admin-only)             |
| `apps/web-portal/app/admin/ingredients/page.tsx`          | Ingredient catalogue management                       |
| `apps/web-portal/app/admin/menu-scan/page.tsx`            | AI menu scan job management                           |
| `apps/web-portal/components/admin/AdminSidebar.tsx`       | Navigation sidebar                                    |
| `apps/web-portal/components/admin/AdminHeader.tsx`        | Top header bar                                        |
| `apps/web-portal/components/admin/RestaurantTable.tsx`    | Table component for restaurant list                   |
| `apps/web-portal/components/admin/AddIngredientPanel.tsx` | Panel for adding new canonical ingredients            |
| `apps/web-portal/components/admin/NewRestaurantForm.tsx`  | Form for admin-created restaurants                    |

---

## Access Control

The `AdminLayout` component (in `app/admin/layout.tsx`) runs a client-side auth check on every render:

```
Page loads
  → useEffect: supabase.auth.getSession()
  → If no session → redirect to /auth/login?error=unauthorized&redirect=/admin
  → If session but role !== 'admin' → redirect to /?error=admin_only
  → If admin role confirmed → render admin UI
```

The admin role is checked via `session.user.user_metadata.role === 'admin'`. This value is set manually in the Supabase Auth dashboard or via a server-side function — it is not set during normal sign-up.

> ⚠️ **Known Gap**: This is client-side protection only. The layout renders briefly before the redirect fires. Middleware-level protection is not implemented. See improvement items A2 / S1 in `CODEBASE_IMPROVEMENTS.md`.

---

## Admin Dashboard (`/admin`)

Displays a statistics overview by querying the `admin_dashboard_stats` database view:

| Stat                  | Source                                               |
| --------------------- | ---------------------------------------------------- |
| Total restaurants     | `admin_dashboard_stats.total_restaurants`            |
| Active restaurants    | `admin_dashboard_stats.active_restaurants`           |
| Suspended restaurants | `admin_dashboard_stats.suspended_restaurants`        |
| Total dishes          | `admin_dashboard_stats.total_dishes`                 |
| Active dishes         | `admin_dashboard_stats.active_dishes`                |
| Total users           | `restaurant_owners + admin_users` from the same view |

The view is defined in the Supabase DB migrations. If `admin_dashboard_stats` doesn't exist or RLS blocks access, the stats silently stay at zero.

---

## Restaurant Management (`/admin/restaurants`)

Lists all restaurants across the platform (not just the logged-in user's). Because admins bypass RLS (or have a special policy), this query returns all rows.

Actions available per restaurant:

- **View details** → `/admin/restaurants/[id]`
- **Suspend / Activate** — sets an `is_active` or `status` flag on the restaurant row
- **Delete** — hard delete (with confirmation)

Admins can also **manually create** a restaurant on behalf of a partner via `/admin/restaurants/new`, using the `NewRestaurantForm` component.

---

## Ingredient Catalogue (`/admin/ingredients`)

Admins can:

- Browse all canonical ingredients in `canonical_ingredients`
- Search by name
- Add a new canonical ingredient via `AddIngredientPanel` (name, dietary flags, family name)
- View which aliases are linked to each canonical ingredient

This is the primary way new ingredients are introduced to the platform. Restaurant partners cannot add new canonical ingredients — they can only select from existing ones in the `IngredientAutocomplete` component.

---

## Menu Scan (`/admin/menu-scan`)

A management UI for AI-assisted menu scanning jobs. Restaurant partners (or admins) can trigger a scan of a menu PDF/image, and the system populates dishes automatically. The job status is tracked in the `menu_scan_jobs` table (migration `034`).

> **Status**: Menu scan is an in-progress feature. The edge function architecture is defined in `docs/EDGE_FUNCTIONS_ARCHITECTURE.md` and `lib/menu-scan.ts`, but the full integration may not be complete.

---

## Admin Navigation

The `AdminSidebar` provides links to:

- `/admin` — Overview
- `/admin/restaurants` — Restaurants
- `/admin/ingredients` — Ingredients
- `/admin/menu-scan` — Menu Scan
- A "Back to Portal" link to exit the admin section
