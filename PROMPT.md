# EatMe — Rating System Redesign

## Objective

Implement the 8-step rating system redesign per the checklist in:
  `.agents/planning/2026-04-08-rating-system/implementation/plan.md`

Work through steps in order, one at a time. Mark each step `[x]` when complete.

## Context

EatMe is a food discovery platform (pnpm + Turborepo monorepo):
- **`apps/mobile`** — React Native + Expo (SDK 54), Zustand stores, Supabase client
- **`apps/web-portal`** — Next.js, restaurant owner onboarding and admin dashboard
- **Backend** — Supabase (PostgreSQL + PostGIS), Edge Functions (Deno/TypeScript)

## Key Documents

- **Implementation plan** (checklist): `.agents/planning/2026-04-08-rating-system/implementation/plan.md`
- **Design spec** (authoritative): `.agents/planning/2026-04-08-rating-system/design/detailed-design.md`

## Steps

1. Database migrations (`079_rating_system_redesign.sql`)
2. Type system + display service layer
3. `submitInContextRating` + updated `submitRating`
4. `InContextRating` component + `RestaurantDetailScreen` wiring
5. Full flow enhancement — note field
6. Updated display components (`DishRatingBadge` + `RestaurantRatingBadge`)
7. Gamification — streaks + Trusted Taster badge
8. i18n strings (EN / ES / PL)

## Success Criteria

All 8 checklist items marked `[x]` and `pnpm tsc --noEmit` exits clean.
