# Web Portal Research

## Routes
- `/` — Dashboard (restaurant summary, menu/dish counts, quick actions)
- `/auth/login` — Email/password + OAuth (Google/Facebook)
- `/auth/signup` — Registration with restaurant name
- `/auth/callback` — OAuth PKCE callback handler
- `/onboard/basic-info` — Restaurant identity, address, location picker, cuisines, hours, services
- `/onboard/menu` — Menu & dish management
- `/onboard/review` — Final review before submission
- `/menu/manage` — Primary menu management UI
- `/restaurant/edit` — Edit restaurant basic info and hours
- `/admin` — Dashboard with statistics
- `/admin/restaurants` — List/search/filter restaurants
- `/admin/restaurants/[id]` — Restaurant details
- `/admin/restaurants/[id]/edit` — Edit restaurant
- `/admin/restaurants/[id]/menus` — Manage restaurant menus
- `/admin/restaurants/new` — Create new restaurant
- `/admin/ingredients` — Manage canonical ingredients and aliases
- `/admin/dish-categories` — Manage dish categories
- `/admin/menu-scan` — Review menu scan results

## API Routes
- `POST /api/ingredients` — Create canonical ingredient + aliases (admin)
- `POST /api/menu-scan` — Upload images, GPT-4o Vision extraction, ingredient matching
- `POST /api/menu-scan/suggest-ingredients` — AI ingredient suggestion for single dish
- `POST /api/menu-scan/confirm` — Confirm and persist scanned menu data

## Components
- `ProtectedRoute.tsx` — Auth wrapper, redirects unauthenticated users
- `DishFormDialog.tsx` — Full dish editor (wizard + DB mode)
- `DishCard.tsx` — Dish display with edit/delete/duplicate
- `IngredientAutocomplete.tsx` — Searchable ingredient dropdown
- `LocationPicker.tsx` — Leaflet map with reverse geocoding (Nominatim)
- `AllergenWarnings.tsx` — Allergen badge display
- `DietaryTagBadges.tsx` — Dietary tag display
- `AdminSidebar.tsx` — Admin navigation
- `AdminHeader.tsx` — Admin header with security indicator
- `NewRestaurantForm.tsx` — Admin restaurant creation
- `RestaurantTable.tsx` — Restaurant listing table
- `AddIngredientPanel.tsx` — Admin ingredient creation
- `InlineIngredientSearch.tsx` — Inline search for menu scan review
- `components/ui/` — Full shadcn/ui component library

## Context
- `AuthContext.tsx` — Global auth state (signUp, signIn, signInWithOAuth, signOut)

## Key Libraries
- `restaurantService.ts` — Restaurant/menu/dish CRUD
- `ingredients.ts` — Ingredient search, allergen/dietary tag management
- `menu-scan.ts` — Menu scan types, multi-page merge, dietary hint mapping
- `validation.ts` — Zod schemas (basicInfo, operations, dish, menu, restaurantData)
- `storage.ts` — localStorage draft persistence with auto-save (500ms debounce)
- `constants.ts` — All static UI/business constants
- `supabase.ts` — Browser client with PKCE + cookies
- `supabase-server.ts` — Server client + admin verification

## Auth Flow
1. Signup → Supabase auth → confirmation email → login
2. Login → email/password OR OAuth → PKCE callback → session cookie
3. Session hydrated on mount via getSession() + onAuthStateChange listener
4. ProtectedRoute redirects unauthenticated; admin layout checks role

## Key Features
- Multi-step restaurant onboarding wizard with draft auto-save
- AI-powered menu scanning (GPT-4o Vision + ingredient matching)
- Ingredient autocomplete with allergen/dietary tag calculation
- Dish option groups (template/experience dishes)
- Admin dashboard with full CRUD operations
