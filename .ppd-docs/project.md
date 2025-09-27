# EatMe Project

## Overview
EatMe is a **mobile-first application** that helps users discover restaurants and dishes tailored to their preferences.  
The initial focus is on building a **UI-only mobile prototype with mock data** to validate the user experience.  
**Target Platforms:** iOS and Android.  
**Design Assets:** Figma UI/UX designs available.  
**Budget Approach:** Cost-effective tools during development; production-optimized for low costs (e.g., free tiers, efficient scaling).  
**Development Timeline:** ~40 hours total, focused on Phase 1 prototype.

## Mission
Make food discovery personal, social, and effortless by surfacing the right dishes and places fast, respecting user preferences, and supporting travelers with clear dietary and cultural context.

## Business Objectives
Increase user retention by delivering immediate, relevant food suggestions.

Reduce decision time for users picking where to eat (primary UX KPI).

Drive engagement through reviews, favorites and a rewards program (points for reviews, visits, referrals).

Monetization pathways:
- Short-term: featured placement for restaurants, targeted promotions, affiliate ordering links.
- Long-term: subscription model for restaurants to appear in the app and access premium features.

Viral growth through social sharing and group-suggestion flows.

## Key Features
Map-first home screen showing restaurants with recommended dishes immediately on launch.

Daily quick filters (fast access): price range, cuisine type(s), food type preferences (meat, poultry, fish, seafood, dairy, eggs, vegetarian, vegan), spicy food toggle (🌶️), local cuisine preference toggle, optional calories range.

Permanent filters (settings): allergies, religious requirements, strict veg/vegan, ingredient exclusions.

Dish-level recommendations (not just restaurants) with scores and reasoning (why this dish fits your filters).

Daily Menu feature: restaurants can share daily-changing menus (e.g., weekday lunch menus), and users can quickly access them directly from the map.

Group recommendations: combine friends' filters and produce best-match restaurants & dishes for the group.

Rewards program: points for reviews, photos, visits, referrals; redeem for discounts.

Reviews & Ratings at both dish and restaurant level (stars + text).

Favorites: favorite dishes & restaurants.

Share / Connect with friends: friend lists, invite links, group sessions.

Quick actions: reserve, navigate, or order (expandable integrations later).

Traveler features: local cuisine discovery, dietary restriction translation help, tourist-friendly restaurant identification, cultural dining tips.

Localization: multilingual dish names and descriptions, ingredient translations, allergy communication assistance.

Preference Learning: Tinder-style dish swiping for preference discovery, machine learning from user behavior (ratings, favorites, orders), intelligent recommendation refinement.

## Preference Learning System
**Design goals:** Make preference discovery engaging, quick, and accurate while preserving user control.

### Tinder-Style Dish Discovery Benefits
- **Fun & Engaging**: Gamifies preference discovery, encouraging user participation
- **Implicit Learning**: Captures preferences users might not explicitly state
- **Visual-First**: Food is visual - images convey more than text descriptions
- **Quick & Easy**: Much faster than filling out preference forms
- **Continuous Learning**: Can be offered periodically to refine recommendations

### Implementation Strategy

**Onboarding Flow (Required):**
1. After basic signup, show 10-15 diverse dish cards
2. Include variety: different cuisines, ingredients, preparation methods, spice levels
3. Mix familiar and unfamiliar dishes to gauge adventurousness
4. Don't overwhelm - keep it fun and quick (2-3 minutes max)

**Ongoing Discovery (Optional):**
1. "Discover More" button in profile or settings
2. Triggered suggestion when user seems dissatisfied with recommendations
3. Seasonal/travel prompts: "Discover local dishes in [current city]"
4. Achievement-based: "Unlock new cuisines" after trying several dishes

**Smart Card Selection Algorithm:**
1. **Diversity First**: Ensure coverage across major food categories
2. **Progressive Learning**: Start broad, then focus on areas of uncertainty
3. **Visual Quality**: Only show dishes with high-quality, appetizing photos
4. **Context Awareness**: Consider time of day, location, season

**Multi-Source Preference Engine:**
Data sources that populate `user.learned_preferences`:

1. **Swipe Data Analysis**:
   - Extract cuisine preferences from liked/disliked dishes
   - Identify ingredient patterns (user likes garlic, dislikes mushrooms)
   - Determine spice tolerance from swipe patterns
   - Assess adventurousness (willingness to try unfamiliar cuisines)

2. **Behavioral Pattern Analysis**:
   - Order history: what cuisines does user actually order?
   - Favorites: explicit preference signals
   - Browse time: longer viewing = higher interest
   - Repeat behavior: restaurants/dishes user returns to

3. **Explicit Feedback Integration**:
   - Star ratings: strong preference signals
   - Reviews: text analysis for ingredient/cuisine sentiment
   - Daily filter usage: temporary vs. consistent patterns

4. **Confidence Scoring System**:
   - More interactions = higher confidence
   - Consistent patterns = higher confidence
   - Contradictory signals = lower confidence
   - Recent data weighted more heavily

**Privacy & Transparency:**
- Show users their learned preferences in settings
- Allow manual override of any learned preference
- Clear explanation of how recommendations work
- Option to reset/retrain preferences

## User Personas
Solo Foodie: wants quick personalized dish suggestions based on dietary choices.

Group Organizer: needs a quick way to choose a place that satisfies everyone.

Health-Conscious Eater: cares about calories and specific ingredients.

Budget Planner: filters heavily by price.

International Traveler: wants to try authentic local cuisine while managing dietary restrictions and language barriers.

## Data Model (Supabase / Postgres)

### Core Tables

**users**
- id (uuid, PK), email (text), created_at (timestamp), profile_id (uuid FK)

**profiles**
- id (uuid, PK), display_name (text), avatar_url (text), reward_points (integer)
- permanent_filters (jsonb): allergies, dietary_restrictions, religious_requirements, disliked_ingredients, medical_restrictions, lifestyle_preferences
- learned_preferences (jsonb): cuisines (liked/disliked with confidence), ingredients, spice_preference, preparation_methods, adventurousness, price_sensitivity, last_updated, total_interactions

**restaurants**
- id (uuid), name (text), name_translations (jsonb), location (geography POINT), address (text), address_translations (jsonb)
- country_code (text), city (text), is_local_cuisine (boolean), tourist_friendly (boolean)
- cuisine_types (text[]), local_cuisine_tags (text[]), cuisine_region (text), price_level (smallint)
- open_hours (jsonb), rating (numeric), dietary_certifications (text[]), allergen_free_options (text[])

**dishes**
- id (uuid), restaurant_id (uuid FK), name (text), name_translations (jsonb), description (text), description_translations (jsonb)
- local_name (text), cultural_significance (text), price (numeric), calories (int)
- ingredients (text[]), allergens (text[]), dietary_tags (text[]), food_composition (jsonb)
- spice_level (smallint), preparation_methods (text[]), tags (text[]), popularity_score (numeric)

**reviews**
- id (uuid), user_id (uuid), subject_type (enum: 'dish'|'restaurant'), subject_id (uuid)
- rating (smallint), text (text), created_at (timestamp)

**favorites**
- id (uuid), user_id (uuid), subject_type ('dish'|'restaurant'), subject_id (uuid)

**group_sessions**
- id (uuid), host_user_id (uuid), member_ids (uuid[]), created_at, filters_snapshot (jsonb)

**user_dish_preferences**
- id (uuid), user_id (uuid), dish_id (uuid), preference_type (enum), preference_score (numeric)
- created_at (timestamp), context (jsonb)

**learned_preferences**
- id (uuid), user_id (uuid), preference_category (text), preference_value (text)
- confidence_score (numeric), source_type (text), last_updated (timestamp), sample_size (integer)

### Master Data Tables
- **ingredients_master**: standardized ingredients with allergen and dietary info
- **allergens_master**: allergen definitions and severity levels
- **dietary_tags_master**: dietary restriction definitions (vegan, kosher, etc.)
- **food_categories_master**: food category hierarchies and dietary implications
- **cuisines_master**: cuisine definitions with translations and traveler info
- **locations_master**: location-specific cuisine and dietary information

## KPIs & Success Metrics
- Decision time: users reach a viable option within 2–3 minutes.
- Map performance: initial map render < 5s; smooth pan/zoom at 60 FPS.
- Swipe session: complete 10 cards in < 30s without errors.
- Crash-free sessions: > 99% in prototype testing.
- Engagement: % of users completing onboarding swipes; filter usage rate.

## Cost Strategy
- Development: prefer free tiers (Mapbox, Supabase), minimal image usage, mock data; leverage OTA updates via EAS to reduce rebuild cycles.
- Production: monitor Mapbox usage, enable clustering/virtualization to reduce tile requests; cache recommendations; index DB for efficient queries; use Supabase Row Level Security and selective fields to cut bandwidth.

## Development Approach
Solo development using prompt-driven development (AI agents) for iterative building and validation. Intermediate coding experience assumed.  

1. **Phase 1 – Mobile UI Prototype**  
   Build the **mobile app UI with mock data only**. No backend.  
   → Goal: Show to friends & family to test usability and core flow.  

2. **Phase 2 – Backend Integration (Supabase)**  
   Add **database + edge functions** once mobile flows are validated.  
   → Goal: Replace mock data with real content, enable auth & storage.  

3. **Phase 3 – Web Portal**  
   Build web apps for **restaurants (menu management)** and **admins (moderation/analytics)**.  
   → Goal: Expand beyond consumer app, allow partners to manage data.  

4. **Phase 4 – CI/CD & Scale**  
   Add CI/CD pipelines, environments, performance tuning, and scaling.  
   → Goal: Production-readiness.  

## Technology Stack

### Frontend / Mobile
- **Framework:** React Native + Expo Bare (SDK 50+, RN 0.73+) + TypeScript
- **UI Library:** NativeBase or React Native Paper + Tailwind-style utility classes
- **Navigation:** React Navigation (drawer + stack)
- **State Management:** Zustand (lightweight) or React Context API
- **Maps:** Mapbox React Native SDK + device geolocation APIs
- **Swipe:** react-native-deck-swiper
- **Storage:** @react-native-async-storage/async-storage
- **Components:** Storybook for shared UI components

### Backend & Database
- **Database:** Supabase (PostgreSQL with PostGIS for geospatial)
- **Authentication:** Supabase Auth (email + OAuth providers)
- **Storage:** Supabase Storage for images/avatars
- **Real-time:** Supabase real-time subscriptions
- **Edge Functions:** Supabase Edge Functions (recommendations, group matching)

### Development & Deployment
- **Monorepo:** Turborepo for shared caching and CI/CD efficiency
- **Version Control:** Git + GitHub (feature-branch PR workflow)
- **CI/CD:** GitHub Actions (lint/test), Expo EAS (mobile builds), Vercel (web portal)
- **Testing:** Jest + React Native Testing Library, Detox for E2E
- **Code Quality:** ESLint, Prettier, Husky (pre-commit hooks), TypeScript strict mode

### Monitoring & Analytics
- **Crash Reporting:** Sentry
- **Analytics:** Mixpanel/Amplitude (planned)
- **Logs:** Supabase logs
- **Performance:** Built-in RN performance monitoring

### Localization
- **i18n:** i18next or React Native Localization
- **Content Management:** Structured translation system for dishes/restaurants  

## Documentation
- `project.md`: Vision and roadmap  
- `architecture.md`: Technical structure and integrations  
- `prompt-plan.md`: Development phases and validation checkpoints  
- `prompts-library.md`: Reusable AI prompts for consistency  

## Glossary
- **Dish-level discovery**: Recommending individual dishes rather than whole restaurants.  
- **Group dining**: Features for multiple users to decide on food together.  
- **Internationalization**: Support for multiple languages and regions.  
- **Mock data**: Placeholder data for UI testing without a real backend.
  
