# EatMe — Workflows Index

This folder documents every user-facing and system workflow in the EatMe platform. Each document is written so that an engineer new to the project can fully understand the feature without reading the source code first.

---

## Web Portal (`apps/web-portal`) — Restaurant Partner Flows

| File                                                               | Workflow                                                                  |
| ------------------------------------------------------------------ | ------------------------------------------------------------------------- |
| [WEB-01-authentication.md](WEB-01-authentication.md)               | Sign up, sign in (email/password + OAuth), auth callback, sign out        |
| [WEB-02-restaurant-onboarding.md](WEB-02-restaurant-onboarding.md) | 3-step wizard: Basic Info → Menu Builder → Review & Submit                |
| [WEB-03-restaurant-management.md](WEB-03-restaurant-management.md) | Editing an existing restaurant's details and menu                         |
| [WEB-04-admin-panel.md](WEB-04-admin-panel.md)                     | Admin dashboard: statistics, restaurant moderation, ingredient management |

---

## Mobile App (`apps/mobile`) — Consumer Flows

| File                                                       | Workflow                                                                       |
| ---------------------------------------------------------- | ------------------------------------------------------------------------------ |
| [MOB-01-authentication.md](MOB-01-authentication.md)       | Login, registration, OAuth, password reset, sign out                           |
| [MOB-02-user-onboarding.md](MOB-02-user-onboarding.md)     | 2-step preference collection (diet, allergies, cuisines)                       |
| [MOB-03-map-discovery.md](MOB-03-map-discovery.md)         | Map view, restaurant/dish markers, location, view modes                        |
| [MOB-04-swipe.md](MOB-04-swipe.md)                         | Dish feed, swipe left/right, Edge Function integration                         |
| [MOB-05-restaurant-detail.md](MOB-05-restaurant-detail.md) | Restaurant profile, menu browsing, dish photos                                 |
| [MOB-06-filters.md](MOB-06-filters.md)                     | Daily filters (quick session choices) and permanent filters (profile settings) |
| [MOB-07-favorites.md](MOB-07-favorites.md)                 | Saving and viewing favourite restaurants and dishes                            |
| [MOB-08-eat-together.md](MOB-08-eat-together.md)           | Group session: create, join, vote, and decide on a restaurant                  |
| [MOB-09-rating-system.md](MOB-09-rating-system.md)         | Rating dishes and restaurants, photo upload, points                            |
| [MOB-10-profile.md](MOB-10-profile.md)                     | Profile screen, stats, settings, sign out                                      |

---

## Shared / Cross-Platform

| File                                                                               | Workflow                                                         |
| ---------------------------------------------------------------------------------- | ---------------------------------------------------------------- |
| [SHARED-01-ingredient-allergen-system.md](SHARED-01-ingredient-allergen-system.md) | Canonical ingredients, allergen auto-calculation via DB triggers |
| [SHARED-02-database-and-migrations.md](SHARED-02-database-and-migrations.md)       | Database schema overview, RLS, migration conventions             |
