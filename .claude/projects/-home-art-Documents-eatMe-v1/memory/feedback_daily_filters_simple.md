---
name: Keep DailyFilterModal simple
description: DailyFilterModal should stay minimal — no additional filter sections beyond what's already there (price, diet/protein, cuisine, meal)
type: feedback
---

Keep DailyFilterModal as simple as possible. Do not add extra filter sections (openNow, groupMeals, spiceLevel, calorieRange, sortBy, maxDistance, scheduleType) to the modal UI.

**Why:** The user wants a clean, focused daily filter experience. Additional filters add complexity without enough value for the daily flow.

**How to apply:** When working on DailyFilterModal, resist adding new sections. If a behavior should always apply (like filtering closed restaurants), handle it at the API/service layer instead of exposing it as a user toggle.
