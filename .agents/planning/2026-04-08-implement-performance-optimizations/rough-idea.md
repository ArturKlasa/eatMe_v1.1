# Rough Idea

## Source
Research findings from `/home/art/Documents/eatMe_v1/.agents/planning/2026-04-07-optimize-performance/findings`

## Summary
Implement the performance optimizations identified in the 2026-04-07 investigation across the eatMe platform (React Native + Expo mobile app, Next.js web portal, Supabase Edge Functions, PostgreSQL database).

The investigation identified 36 findings across 6 domains:
- **Database**: Missing indexes, RLS overhead, over-fetching with `.select('*')`
- **Edge Functions**: Sequential DB queries, low cache hit rate, unnecessary fields in responses
- **Mobile Rendering**: Zustand selector re-renders, missing image caching library
- **API Payload**: Vector columns in detail fetches (1MB+ payloads), unnecessary feed fields
- **Caching**: Near-zero feed cache hit rate, no client-side restaurant caching
- **Bundle/Startup**: No `expo-image` library

The sprint plan from the findings recommends:
- **Sprint 1** (Quick Wins, ~2 days): 6 easy-effort, high-severity fixes
- **Sprint 2** (Caching & Network, ~3-5 days): 4 medium-effort improvements
- **Sprint 3** (Architecture, future): Long-term structural improvements

## Goal
Turn the research findings into a concrete implementation plan with discrete, testable steps that can be executed incrementally.
