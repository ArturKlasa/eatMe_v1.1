# Edge Functions Research

## Overview
7 Deno-based Supabase Edge Functions. All use CORS headers, service role for admin operations.

## Functions

### 1. feed (POST)
- Two-stage personalized dish recommendations
- Stage 1: generate_candidates RPC (PostGIS + vector ANN) → 200 candidates
- Stage 2: JS ranking (weighted scoring) → diversity cap (3/restaurant) → top N
- Scoring: similarity(0.4) + rating(0.2) + popularity(0.15) + distance(0.15) + quality(0.1)
- Soft boosts: cuisine (+0.20), diet (+0.50), craving (+0.25), protein (+0.20), etc.
- Supports dishes and restaurants mode
- Redis caching (300s TTL), parallel user context loading
- Cold-start handling redistributes similarity weight

### 2. nearby-restaurants (POST)
- Geospatial restaurant search with Haversine distance
- Filters: cuisines, price range, rating, dietary tags, allergens, service types
- Returns restaurants with nested menus/dishes
- Sorted by distance (nearest first)

### 3. enrich-dish (POST)
- AI-powered dish enrichment pipeline
- Triggered by DB webhook or direct call
- Evaluates ingredient completeness (complete ≥3, partial 1-2, sparse 0)
- AI enrichment via gpt-4o-mini (sparse/partial only)
- Embedding generation: text-embedding-3-small (1536 dim)
- Updates restaurant vector via RPC
- 8-second debounce for rapid saves

### 4. group-recommendations (POST)
- Restaurant recommendations for Eat Together sessions
- Group constraints: strictest diet, union of allergens/religious
- Group vector: average of members' preference_vectors
- Scoring: vector_similarity(0.4) + cuisine(0.3) + distance(0.2) + rating(0.1)
- Auto-expands radius 2× if no results
- Saves to eat_together_recommendations, updates session to 'voting'

### 5. swipe (POST)
- Records user swipe (left/right/super)
- Sync: insert user_swipes
- Async: increment dish_analytics, update user_behavior_profiles

### 6. update-preference-vector (POST)
- Computes personalized preference vector from interaction history
- Time-decayed weights: saved(3.0), liked(1.5), viewed(0.5)
- Decay: weight × e^(-0.01 × days)
- Normalizes to unit vector (1536 dim)
- Computes preferred_cuisines (top 5) and preferred_price_range
- 5-minute debounce

### 7. batch-update-preference-vectors (POST)
- Nightly cron job fallback
- Finds users with stale vectors (>24h) + recent interactions
- Sequential processing (200ms delay, 200 user limit)
- Calls update-preference-vector for each user

## External Dependencies
- OpenAI (gpt-4o-mini for enrichment, text-embedding-3-small for embeddings)
- Upstash Redis (feed caching)
- Supabase PostgreSQL + PostGIS + pgvector

## Deployment
- Deploy single: `supabase functions deploy <name>`
- Deploy all: `supabase functions deploy`
- Local test: `supabase functions serve <name>`
- Logs: `supabase functions logs <name> --tail`
