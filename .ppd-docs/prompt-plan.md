# EatMe Prompt-Driven Development Plan

The plan is **mobile-first with mock data**, then incremental backend + web expansion.  
Each phase includes clear validation points.  
**Total Timeline:** ~40 hours (focus on Phase 1 prototype; intermediate experience assumed).  
**Target Platforms:** iOS and Android.  
**Design:** Use Figma UI/UX designs for reference.  
**Budget:** Free/low-cost tools during dev; optimize for production costs.

## Current Strategy Snapshot

- Focus: Mobile app UX validation with mock data before backend spend.
- Why: Core value is map-first navigation and quick dish discovery.
- Backend readiness: Supabase planned; integrate only after UX validated.

## 📈 Phase 1 Progress Status (Updated: September 29, 2025)

**Overall Progress**: 16/27 tasks completed (59% complete)

**Completed Sections:**

- ✅ **1.1 Project Foundation** (4h) - All tasks complete
- ✅ **1.2 Map Implementation** (8h) - All tasks complete
- ✅ **1.3 Navigation & Drawer** (6h) - Mostly complete
- ✅ **1.4 Filter System** (8h) - All tasks complete with enhancements

**Next Priority:**

- 🎯 **1.5 Restaurant/Dish Toggle** (4h) - Ready to start
- 🔄 **1.6 Swipe Recommendation Flow** (10h) - Major feature pending
- 🔄 **1.7 Authentication Screens** (2h) - Stubs pending

**Key Achievements Beyond Plan:**

- 🚀 Two-tier filter architecture (Daily vs Permanent)
- 🚀 Advanced performance optimization with FilterService
- 🚀 Real-time map integration with comprehensive validation
- 🚀 Professional UI with ScrollView, proper spacing, and accessibility

## Setup & Getting Started

1. Initialize monorepo: `npx create-turbo@latest eatme --template` (create basic structure).
2. Set up mobile app: In `/apps/mobile`, run `expo init --template bare-minimum` (choose TypeScript).
3. Install dependencies: `npm install @rnmapbox/maps native-base zustand @react-navigation/native @react-navigation/drawer react-native-deck-swiper @react-native-async-storage/async-storage`.
4. Configure Mapbox: Get free API key from mapbox.com, add to app.json/env.
5. Run dev build: `expo run:ios` or `expo run:android` (test Mapbox integration early).
6. Cost control: use lightweight markers and avoid heavy images to limit Mapbox tile usage.

---

## Phase 1: Mobile UI Prototype (No Backend)

**Goal:** Build a **clickable mobile app** with mock data. (~30-35 hours)

### 1.1 Project Foundation (~4h) ✅ COMPLETED

- [x] Initialize monorepo with Turborepo (~1h) ✅ COMPLETED
  - Run `npx create-turbo@latest eatme --template`
  - Configure base tsconfig.json and package.json
  - Set up workspace structure and shared configs
- [x] Set up mobile app with Expo Bare (~2h) ✅ COMPLETED
  - Navigate to `/apps` and run `expo init mobile --template bare-minimum`
  - Configure TypeScript and basic folder structure
  - Set up iOS and Android native projects
- [x] Install core dependencies (~1h) ✅ COMPLETED
  - Install: `@rnmapbox/maps native-base zustand @react-navigation/native @react-navigation/drawer react-native-deck-swiper @react-native-async-storage/async-storage react-native-safe-area-context react-native-screens`
  - Configure React Navigation dependencies
  - Test basic app startup

### 1.2 Map Implementation (Priority 1) (~8h) ✅ COMPLETED

- [x] Mapbox setup and configuration (~2h) ✅ COMPLETED
  - Create Mapbox account, obtain API key
  - Configure environment variables (app.json/env files)
  - Add Mapbox SDK to iOS and Android projects
  - Test basic map rendering with simple view
- [x] Mock data generation (~2h) ✅ COMPLETED
  - Create `restaurants.json` with 15-20 sample restaurants (5 implemented)
  - Create `dishes.json` with 50+ sample dishes linked to restaurants
  - Include variety: cuisines (Italian, Chinese, Mexican, Indian), price ranges ($-$$$$), dietary tags
  - Add realistic coordinates for local area testing
  - Create ingredient and allergen data
- [x] Map markers and clustering (~3h) ✅ COMPLETED
  - Implement restaurant markers with custom icons/styling
  - Add marker clustering for zoomed-out views (performance)
  - Handle marker tap events → show restaurant info popup
  - Test different marker styles for restaurant vs dish modes
- [x] Map interactions and performance (~1h) ✅ COMPLETED
  - Test pan/zoom smoothness on device
  - Optimize marker rendering for 50+ locations
  - Add map loading states and error handling
  - Implement user location detection and centering

### 1.3 Navigation and Drawer Menu (~6h) ✅ MOSTLY COMPLETED

- [x] React Navigation setup (~2h) ✅ COMPLETED
  - Configure drawer navigator as main navigation container
  - Set up stack navigators for different screen flows
  - Add navigation between map, profile, settings screens
  - Test navigation flow and back button handling
- [x] Drawer menu implementation (~2h) ✅ COMPLETED
  - Create drawer content component with menu items
  - Add user profile section (mock avatar, name, preferences)
  - Style drawer according to design system
  - Add menu items: Map, Filters, Favorites, Profile, Settings
- [x] Filter integration with drawer (~2h) 🔄 PARTIALLY COMPLETED
  - Connect drawer filter controls to global state
  - Implement filter persistence using AsyncStorage
  - Add filter reset and clear all functionality
  - Show active filter count badge in drawer header
  - **NOTE**: Permanent filters implemented in drawer; daily filters via modal FAB

### 1.4 Filter System (~8h) ✅ COMPLETED

- [x] Filter UI components (~3h) ✅ COMPLETED
  - Price range slider component ($ to $$$$)
  - Cuisine type multi-select with checkboxes (Italian, Chinese, etc.)
  - Dietary restriction toggles (Vegan, Vegetarian, Gluten-Free, Dairy-Free)
  - Spicy food preference toggle with heat level indicator
  - Calorie range slider (optional)
- [x] Filter logic and state management (~3h) ✅ COMPLETED
  - Implement Zustand store for filter state management
  - Create filter application logic for mock data
  - Connect filters to restaurant/dish filtering algorithms
  - Add filter validation and error handling
  - **ENHANCED**: Two-tier filter system (Daily vs Permanent)
  - **ENHANCED**: Advanced FilterService with performance optimization
  - **ENHANCED**: Real-time map integration with filtered results
- [x] Quick filter bar (~2h) ✅ COMPLETED
  - Implement modal/bottom sheet for filter interface
  - Show active filter count badge on FAB
  - Add quick preset filters (\"Nearby\", \"Cheap Eats\", \"Healthy\")
  - **ENHANCED**: Comprehensive modal interface with ScrollView
  - **ENHANCED**: Professional styling and UX improvements

### 1.5 Restaurant/Dish Toggle (~4h)

- [ ] Toggle component implementation (~2h)
  - Create segmented control component for Restaurant/Dish modes
  - Position toggle prominently in map header
  - Add smooth transition animations between modes
  - Style toggle to match app design system
- [ ] Mode-specific rendering (~2h)
  - Show restaurants vs individual dishes on map based on toggle
  - Update marker icons and colors for different modes
  - Adjust info panels and popups based on current mode
  - Test data filtering logic for both modes

### 1.6 Swipe Recommendation Flow (~10h)

- [ ] Swipe card components (~4h)
  - Install and configure react-native-deck-swiper
  - Design dish card UI: high-quality food image, dish name, restaurant name, price, brief description
  - Add like/dislike/neutral action buttons with clear icons
  - Implement card stack with smooth swipe animations
  - Add visual feedback for swipe directions
- [ ] Swipe logic and data management (~3h)
  - Handle swipe gestures (left=dislike, right=like, up=neutral)
  - Store swipe preferences in AsyncStorage with timestamps
  - Implement card deck management (shuffle, reload, infinite scroll)
  - Add undo last swipe functionality
- [ ] Preference learning simulation (~2h)
  - Create mock preference scoring algorithm based on swipes
  - Show \"learning your preferences\" feedback to user
  - Display preference insights in user profile
  - Simulate confidence scoring for different food categories
- [ ] Integration with recommendations (~1h)
  - Use accumulated swipe data to influence map recommendations
  - Show \"Recommended for you\" badges on map markers
  - Connect swipe preferences to filter suggestions
  - Test recommendation accuracy with mock data

### 1.7 Authentication Screens (Stubs) (~2h)

- [ ] Login/signup screen layouts (~1h)
  - Create basic login form with email/password fields
  - Create signup form with name, email, password
  - Add \"Sign in with Google\" placeholder button
  - Style forms to match app design system
- [ ] Navigation integration (~1h)
  - Add auth flow to navigation stack
  - Implement mock authentication state management
  - Add logout functionality in drawer menu
  - Test auth flow navigation and state persistence

**Out of Scope for Phase 1:** Real authentication, Supabase integration, real images/photos, analytics, rewards system, social features, real-time updates.

**Validation Criteria:**

- Users can swipe through 10 cards in <30 seconds without errors
- Map loads and renders restaurants in <5 seconds
- Filters apply to map results within 2 seconds
- Smooth 60fps animations throughout all interactions
- No crashes during 10-minute continuous usage session
- Friends/family can navigate core features without instruction
- Toggle between restaurant/dish modes works seamlessly
- Drawer navigation is intuitive and responsive

---

## Phase 2: Backend Integration (Supabase) (~15-20h)

**Goal:** Replace mock data with real backend and implement core user features.

### 2.1 Supabase Setup & Configuration (~4h)

- [ ] Supabase project creation (~1h)
  - Create new Supabase project with appropriate region
  - Configure database settings and connection pooling
  - Set up environment variables for all environments (dev, staging, prod)
  - Test basic connection and authentication
- [ ] Database schema implementation (~3h)
  - Create core tables: users, profiles, restaurants, dishes, reviews, favorites
  - Add PostGIS extension for geospatial queries and location indexing
  - Set up Row Level Security (RLS) policies for data protection
  - Create database indexes for performance (location, cuisine_types, price_level)
  - Import master data tables (cuisines, allergens, dietary_tags)

### 2.2 Authentication System (~4h)

- [ ] Supabase Auth integration (~2h)
  - Install @supabase/supabase-js and configure client
  - Set up auth providers (email/password, Google OAuth)
  - Replace mock authentication with real Supabase auth
  - Handle auth state changes and session management
- [ ] User onboarding flow (~2h)
  - Implement real user registration with profile creation
  - Add profile setup with dietary preferences and restrictions
  - Integrate preference discovery swipe flow with user profiles
  - Handle authentication errors and edge cases

### 2.3 Data Layer Implementation (~5h)

- [ ] Repository pattern implementation (~2h)
  - Create Supabase-backed repository implementations
  - Replace mock repositories with real data fetching from database
  - Implement proper error handling, retry logic, and loading states
  - Add data validation and sanitization
- [ ] Real data population (~2h)
  - Import comprehensive restaurant data into Supabase tables
  - Add detailed dish information with ingredients and allergens
  - Include proper geospatial coordinates for accurate mapping
  - Add high-quality dish images to Supabase Storage
- [ ] Performance optimization (~1h)
  - Implement query optimization with proper indexing
  - Add caching layer for frequently accessed data
  - Optimize image loading and storage access

### 2.4 Core Features (~4h)

- [ ] Favorites system (~2h)
  - Implement add/remove favorites for dishes and restaurants
  - Sync favorites across devices and sessions
  - Add favorites management screen with organized lists
  - Handle favorites for both authenticated and guest users
- [ ] Reviews and ratings (~2h)
  - Create review submission interface with star ratings
  - Implement review display with user avatars and timestamps
  - Add review moderation and reporting functionality
  - Calculate and display average ratings for restaurants/dishes

### 2.5 Advanced Features (~3h)

- [ ] Recommendation engine (~2h)
  - Implement server-side recommendation logic using Edge Functions
  - Create complex queries combining user preferences, location, and ratings
  - Integrate learned preferences from swipe data into recommendations
  - Add real-time recommendation updates based on user behavior
- [ ] Performance monitoring (~1h)
  - Add query performance monitoring and optimization
  - Implement error tracking and logging for database operations
  - Monitor API response times and optimize slow queries
  - Set up alerts for system issues and downtime

**Validation Criteria:**

- Users can register, log in, and maintain authenticated sessions
- Real restaurant data loads on map within 3 seconds
- Favorites sync properly across app restarts and devices
- Reviews submit successfully and display with proper formatting
- No authentication errors or data inconsistencies
- Recommendation accuracy improves with user interaction data

**Cost Optimization:**

- Use PostGIS indexes for efficient geospatial queries
- Implement result pagination to reduce data transfer
- Cache frequently accessed data locally and server-side
- Monitor Supabase usage and optimize expensive queries
- Use image optimization and CDN for faster loading

---

## Phase 3: UX Iteration & Social Features (~12-15h)

**Goal:** Refine user experience and add core social functionality.

### 3.1 User Feedback Integration (~4h)

- [ ] Usability testing sessions (~2h)
  - Conduct 8-10 user tests with target demographic
  - Document navigation pain points and user confusion areas
  - Measure task completion rates and interaction times
  - Gather qualitative feedback on feature value and clarity
  - Test accessibility with assistive technologies
- [ ] UX improvements based on feedback (~2h)
  - Refine map marker design and information density
  - Improve filter discoverability and labeling
  - Optimize swipe card design and onboarding instructions
  - Enhance information hierarchy and visual flow

### 3.2 Advanced UI Components (~4h)

- [ ] Bottom sheet integration (~2h)
  - Add draggable recommendations panel below map
  - Implement smooth gesture animations and snap points
  - Show detailed restaurant/dish information in expandable sheet
  - Add quick actions (favorite, navigate, order) in bottom sheet
- [ ] Search and discovery (~2h)
  - Add text search with autocomplete for restaurants and dishes
  - Implement search history and popular searches
  - Integrate search results with map updates and filtering
  - Add voice search capability for hands-free operation

### 3.3 Social Features Foundation (~4h)

- [ ] Friend system (~2h)
  - Implement friend invite and connection system
  - Add friend discovery through contacts and social networks
  - Create friend list management with status indicators
  - Add privacy controls for friend visibility and sharing
- [ ] Group dining basics (~2h)
  - Create group session creation and invitation flow
  - Implement basic group preference aggregation
  - Add group recommendation display with compromise suggestions
  - Handle group session management and real-time updates

### 3.4 Polish and Performance (~3h)

- [ ] Visual refinements (~1h)
  - Apply consistent design system and color palette
  - Add proper loading states, skeleton screens, and transitions
  - Implement dark mode support and theme switching
- [ ] Performance optimization (~1h)
  - Optimize map rendering and marker clustering algorithms
  - Implement lazy loading for images and data
  - Add offline functionality for cached content
- [ ] Error handling and accessibility (~1h)
  - Add comprehensive error messages and recovery options
  - Implement proper accessibility labels and navigation
  - Test with screen readers and keyboard navigation
  - Add haptic feedback for better tactile experience

**Validation Criteria:**

- 90% of test users complete core tasks without assistance
- App maintains 60fps during all interactions and transitions
- Search returns relevant results within 1 second
- Group features work seamlessly for 2-4 user groups
- Accessibility score >95% in automated testing tools
- No critical UX issues or confusing user flows remaining

## Phase 4: Web Portal & Admin Tools (~15-20h)

**Goal:** Enable restaurant partners and admins to manage content independently.

### 4.1 Admin Portal Foundation (~6h)

- [ ] Admin authentication and authorization (~2h)
  - Set up admin role management in Supabase with proper permissions
  - Create secure admin routes with middleware protection
  - Implement admin dashboard layout with navigation
  - Add audit logging for admin actions
- [ ] Content moderation tools (~2h)
  - Build review moderation interface with approval/rejection
  - Add restaurant approval workflow with verification steps
  - Create user management dashboard with ban/suspend capabilities
  - Implement automated content filtering and reporting
- [ ] Analytics and reporting (~2h)
  - Display comprehensive app usage metrics and KPIs
  - Show restaurant performance data and user engagement
  - Add advanced filtering, sorting, and data export
  - Create custom report generation with scheduling

### 4.2 Restaurant Partner Portal (~8h)

- [ ] Restaurant onboarding (~3h)
  - Create restaurant account registration and verification
  - Build restaurant profile management with photos and descriptions
  - Add business hours, contact information, and location management
  - Implement restaurant verification process with documentation upload
- [ ] Menu management system (~4h)
  - Build comprehensive dish creation and editing interface
  - Add bulk menu import from CSV/Excel with validation
  - Implement photo upload and management with optimization
  - Add detailed dietary tags, allergen information, and ingredients
  - Create menu organization with categories and seasonal items
- [ ] Daily operations (~1h)
  - Create daily specials and limited-time offers management
  - Add real-time menu item availability toggles
  - Implement dynamic pricing and promotion tools
  - Add staff management and role assignment

### 4.3 Integration and Deployment (~6h)

- [ ] API integration and real-time sync (~2h)
  - Connect web portal to Supabase backend with proper authentication
  - Implement real-time updates between mobile app and web portal
  - Add comprehensive error handling and user feedback
  - Test data consistency across platforms
- [ ] Performance and optimization (~2h)
  - Optimize bundle size and implement code splitting
  - Add proper caching strategies for static and dynamic content
  - Implement image optimization and lazy loading
  - Add progressive web app (PWA) capabilities
- [ ] Testing and deployment (~2h)
  - Add comprehensive unit and integration testing
  - Set up automated testing pipeline with GitHub Actions
  - Configure Vercel deployment with environment management
  - Add monitoring and error tracking for production

**Validation Criteria:**

- Restaurant partners can manage complete menus without developer help
- Admin can moderate content and access analytics efficiently
- Changes in web portal reflect in mobile app within 30 seconds
- Web portal loads completely in <3 seconds on desktop
- All admin tools work correctly with proper authorization
- Restaurant verification process is streamlined and secure

---

## Phase 4: CI/CD & Scale

**Goal:** Automate and prepare for production.

- [ ] GitHub Actions for linting, builds, tests
- [ ] Expo EAS for iOS/Android builds + OTA updates
- [ ] Vercel for web portal deployments
- [ ] Optimize Supabase schema, add RLS policies, cost monitoring
- [ ] Performance improvements (map clustering, lazy loading)

**Validation:** Smooth experience for 100+ test users in beta program.

---

## Future Phases (Post-Phase 4)

- **Phase 5: Social Features** - Friend system, group dining, rewards program.
- **Phase 6: Internationalization** - Multi-language support, traveler features.
- **Phase 7: Advanced Features** - Daily menus, integrations, optimization.
- **Phase 8: Launch Preparation** - Testing, security, app store submissions.
