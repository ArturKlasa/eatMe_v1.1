# EatMe — Active TODO List

_Last updated: March 3, 2026_

---

## 🔴 High Priority

### Mobile: Connect to Supabase
- [ ] Create `apps/mobile/src/lib/supabase.ts` using `packages/database` or a fresh client with `AsyncStorage`
- [ ] Set `EXPO_PUBLIC_SUPABASE_URL` and `EXPO_PUBLIC_SUPABASE_ANON_KEY` in `apps/mobile/.env`
- [ ] Wire auth screens (`src/screens/auth/`) to `supabase.auth.signInWithPassword` / `signUp`
- [ ] Replace all mock restaurant/dish data in stores with real Supabase queries
- [ ] Call `nearby-restaurants` Edge Function from `BasicMapScreen.tsx`

### Mobile: Swipe Feed with Real Data
- [ ] Connect `SwipeScreen.tsx` to `feed` Edge Function (replace mock array)
- [ ] On swipe action, call `swipe` Edge Function to record `dish_opinions`
- [ ] Show allergen/dietary badges from real `dishes.allergens` / `dishes.dietary_tags`

### Mobile: User Preferences Onboarding
- [ ] Add preferences onboarding screen(s) after sign-up (diet, allergens, cuisines, price)
- [ ] Save selections to `user_preferences` table
- [ ] Pass `user_id` to `feed` Edge Function so results are personalised

---

## 🟡 Medium Priority

### Mobile: Eat Together
- [ ] Wire `EatTogetherScreen.tsx` to `eat_together_sessions` table
- [ ] Implement session creation, join-by-code, and participant location sharing
- [ ] Wire voting step to `eat_together_votes` table
- [ ] Call `group-recommendations` Edge Function for restaurant suggestions

### Mobile: Profile & History
- [ ] Load real user data in `ProfileScreen.tsx` from `users` table
- [ ] Populate `FavoritesScreen.tsx` and `ViewedHistoryScreen.tsx` from `dish_opinions` / `session_views`
- [ ] Allow avatar upload → Supabase Storage

### Admin: Menu Scan Review UI
- [ ] Build result review page at `/admin/menu-scan/[jobId]` — display `result_json`, allow field edits
- [ ] On confirm: bulk-insert dishes from `result_json` into `dishes` + `dish_ingredients`
- [ ] Handle multi-page jobs (merge results from `image_count > 1`)

### Rating Display
- [ ] Show `restaurants.rating` (0–5) in mobile restaurant cards and detail view
- [ ] Show per-dish opinion counts from `dish_ratings_summary` view
- [ ] Add "Was this dish good?" prompt after N swipes in a session

---

## 🟢 Lower Priority / Tech Debt

### Code Cleanup
- [ ] Remove all mock/hardcoded data from `apps/mobile/src/` (restaurants, dishes, etc.)
- [ ] Remove unused `SupabaseTestScreen.tsx` once real integration is verified
- [ ] Audit `apps/web-portal/` for any remaining `console.log` debug statements
- [ ] Run `turbo run check-types` and fix any TypeScript errors across monorepo
- [ ] Run `pnpm lint` and address all warnings

### Shared Supabase Client
- [ ] Migrate web-portal off its own `lib/supabase.ts` to `packages/database` shared client
- [ ] Update mobile to import from `@eatme/database` once package is ready

### TypeScript Types
- [ ] Run `supabase gen types typescript --linked > apps/web-portal/types/database.ts`
- [ ] Keep generated types in sync after each new migration

### Admin UI Alignment
- [ ] Apply onboarding styling (gradient, Card components, icons) to admin create/edit pages
- [ ] See [ADMIN_UI_ALIGNMENT_PLAN.md](./ADMIN_UI_ALIGNMENT_PLAN.md) for full details

---

## ✅ Recently Completed (for context)

- [x] Restaurant onboarding → Supabase (web portal)
- [x] Auth: email + Google/Facebook OAuth
- [x] Admin dashboard with RLS and audit log
- [x] Ingredient system: autocomplete + allergen trigger
- [x] Rating system: `dish_opinions` → `restaurants.rating` trigger (migration 033)
- [x] Eat Together DB tables + `group-recommendations` Edge Function
- [x] Menu scan jobs table + `/admin/menu-scan` upload UI (migration 034)
- [x] Dish categories (migration 025)
- [x] Currency support per restaurant (migration 021)
- [x] Multi-language ingredient aliases (EN/ES/Latin American/Polish — migrations 035–040)
- [x] Neighbourhood + state fields on restaurants (migration 026)
- [x] Edge Functions: `feed`, `nearby-restaurants`, `swipe`, `group-recommendations`
