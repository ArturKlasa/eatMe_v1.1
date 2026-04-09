# Project Summary: EatMe Rating System Redesign

## Artifacts

```
.agents/planning/2026-04-08-rating-system/
  rough-idea.md              — Original request
  idea-honing.md             — Requirements Q&A (10 questions, all answered)
  research/
    rating-systems-research.md    — Rating scales, dish vs restaurant, UX, gamification, AI
    rating-display-formats.md     — Deep dive on display formats across food apps
  design/
    detailed-design.md       — Full design spec
  implementation/
    plan.md                  — 8-step implementation plan with checklist
  summary.md                 — This file
```

## What's Changing

The core 3-tier model (liked/okay/disliked) is **kept** — it's validated by Netflix and DoorDash Zesty. The redesign adds:

| Change | Description |
|--------|-------------|
| In-context rating | "Tried it?" button on each dish card → 1-tap rating, no navigation needed |
| Note field | Optional 47-char note in the full post-visit flow |
| New display format | `🔥 85% 👍 (47) · Great flavor` — Rotten Tomatoes model, unique in food space |
| Tier badges | 🔥 for ≥90%/20+ ratings; hide ratings below 3 votes |
| Bayesian food score | Restaurant food score derived from dish ratings, not experience questions |
| Updated view schema | `dish_ratings_summary` + `restaurant_ratings_summary` with new columns |
| Streak tracking | Weekly streak with bonuses at 3/7/14 weeks (15/30/50 pts) |
| Trusted Taster badge | Awarded client-side after 20+ tagged ratings over 3+ months |

## Database Changes Summary

**Modified tables:** `dish_opinions` (+`note`, +`source`), `user_visits` (+`source`)

**New tables:** `user_streaks`, `user_badges`

**Rebuilt views:** `dish_ratings_summary` (new columns: `okay_percentage`, `dislike_percentage`, `recent_notes`), `restaurant_ratings_summary` (new Bayesian `food_score` from dishes)

## Implementation Sequence

1. **DB migrations** — all schema changes (foundational)
2. **Types + service layer** — interfaces, `getRatingTier`, `formatRatingText`
3. **submitInContextRating** — new service function + photo points 15→20
4. **InContextRating component** — "Tried it?" widget in RestaurantDetailScreen
5. **Note field** — 47-char note in RateDishScreen + full flow
6. **Display components** — new badge format, tier icons, correct field names
7. **Gamification** — `gamificationService.ts`, streak/badge logic, RatingCompleteScreen
8. **i18n** — new strings in EN/ES/PL

Steps 4 and 5 can be parallelized. Step 8 can start alongside Step 4.

## Next Steps

1. Regenerate `packages/database/src/types.ts` after Step 1 with `supabase gen types typescript`
2. Begin implementation following the checklist in `implementation/plan.md`
3. To start the Ralph loop:
   - `ralph run --config presets/pdd-to-code-assist.yml --prompt "Implement the rating system redesign per .agents/planning/2026-04-08-rating-system/implementation/plan.md"`
   - or: `ralph run -c ralph.yml -H builtin:pdd-to-code-assist -p "Implement rating system per .agents/planning/2026-04-08-rating-system/implementation/plan.md"`
