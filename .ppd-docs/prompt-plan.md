# EatMe Prompt-Driven Development Plan

The plan is **mobile-first with mock data**, then incremental backend + web expansion.  
Each phase includes clear validation points.  
**Total Timeline:** ~40 hours (focus on Phase 1 prototype; intermediate experience assumed).  
**Target Platforms:** iOS and Android.  
**Design:** Use Figma UI/UX designs for reference.  
**Budget:** Free/low-cost tools during dev; optimize for production costs.

## Current Strategy Snapshot

- **Primary Focus**: Restaurant Partner Portal (web app) for data collection and validation
- **Why Portal First**: Validate database schema with real restaurant data before backend costs
- **Mobile App**: Continue UX development with mock data (59% complete, Phase 1)
- **Database Status**: ✅ Schema complete, migrations ready, Supabase client implemented
- **Backend Integration**: Postponed until after portal collects real-world data
- **Next Steps**: Build web portal (Phase 2), then integrate backend with validated data (Phase 3)

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

## Phase 2: Restaurant Partner Portal (~15-20h)

**Goal:** Build web application for restaurants to enter data, validating our database schema before backend implementation.

**Status**: ✅ **MOSTLY COMPLETED** - Core functionality implemented (December 6, 2025)

**Reference**: See `/docs/restaurant-partner-portal.md` for complete implementation plan

**Actual Time Spent**: ~18h (closely matched estimate)

### Progress Summary

**Completed Features:**

- ✅ Full Next.js project setup with TypeScript, Tailwind CSS, Shadcn/ui
- ✅ Complete Restaurant Information form with 8 comprehensive sections
- ✅ Interactive Leaflet map integration for location selection
- ✅ Advanced filter system with 60+ cuisine types
- ✅ Operating hours management with day-specific controls
- ✅ Service options and speed selection
- ✅ Review page for data verification
- ✅ LocalStorage persistence with auto-save
- ✅ Mobile-responsive design throughout

**Key Achievements Beyond Plan:**

- 🚀 Two-tier filter architecture (Daily vs Permanent filters)
- 🚀 Popular cuisines quick-select feature
- 🚀 Custom cuisine validation with "Other" option
- 🚀 Country selection (US, Canada, Mexico, Poland)
- 🚀 10 curated restaurant type options
- 🚀 Interactive map with user geolocation
- 🚀 Service speed radio options (Fast Food, Regular Restaurant)
- 🚀 Website validation without requiring http/www
- 🚀 Direct "Continue to Review" workflow

**Remaining Work:**

- [ ] Menu entry form (Step 3) - dishes, ingredients, allergens
- [ ] Final export functionality (JSON/CSV generation)
- [ ] Photo upload for dishes (optional)
- [ ] Testing and deployment to Vercel

### Why This Phase Comes Before Backend Integration

1. **Data Validation**: Test database schema with real restaurant information
2. **Zero Cost**: No backend infrastructure needed during data collection
3. **Schema Refinement**: Identify missing/unnecessary fields before committing to backend
4. **Sales Tool**: Functional demo to attract restaurant partners
5. **Real Data**: Collect structured data ready for Supabase import

### 2.1 Portal Foundation (~6h) ✅ COMPLETED

- [x] Next.js project setup in monorepo (~1h) ✅
  - Create `/apps/web-portal` with Next.js 14 (App Router)
  - Configure TypeScript, ESLint, Tailwind CSS
  - Install Shadcn/ui and initialize component library
  - Set up project structure (app/, components/, lib/, types/)
- [x] Core dependencies installation (~0.5h) ✅
  - Install React Hook Form + Zod for form validation
  - Add Leaflet (instead of Mapbox) for location/address selection
  - Install date-fns, clsx for utilities
  - Configure environment variables
- [x] Landing page (~2h) ✅
  - Create welcoming dashboard with navigation cards
  - Add direct access to Restaurant Information and Menu Management
  - Design mobile-responsive layout with clear CTAs
  - Implement progress tracking visualization
- [x] LocalStorage service (~1h) ✅
  - Implement data persistence layer using browser LocalStorage
  - Create save/load/clear utilities in lib/storage.ts
  - Add auto-save functionality with form integration
  - Handle data migration and versioning with FormProgress type
- [x] Shadcn components setup (~1.5h) ✅
  - Install required UI components (button, input, form, card, select, radio, etc.)
  - Configure theme and design tokens with orange brand color
  - Create custom component wrappers as needed
  - Test component styling and interactions

### 2.2 Multi-Step Wizard (~8h) ✅ MOSTLY COMPLETED

- [x] Wizard navigation framework (~2h) ✅
  - Create direct navigation from dashboard (no multi-step wizard)
  - Implement progress tracking with currentStep in FormProgress
  - Use single-page forms instead of wizard steps
- [x] Step 1: Basic Information form (~2h) ✅ EXCEEDED EXPECTATIONS (~4h actual)
  - Restaurant name, restaurant type (10 options), country selector
  - Address input with interactive Leaflet map and geolocation
  - Phone, website (with custom validation)
  - Multi-select cuisines from 60+ types with popular section and search
  - Operating hours integrated into same page (7-day schedule)
  - Service options: delivery, takeout, dine-in, reservations
  - Service speed: Fast Food vs Regular Restaurant (radio selection)
  - Form validation with React Hook Form
  - **ENHANCED**: Restaurant type dropdown with descriptions
  - **ENHANCED**: Popular cuisines quick-select
  - **ENHANCED**: Custom "Other" cuisine option
  - **ENHANCED**: Interactive map with click-to-mark location
  - **ENHANCED**: Country-first address model
  - **REMOVED**: Description field (not needed for MVP)
  - **REMOVED**: Price range selector (moved to future features)
- [ ] Step 2: Menu entry form (~2h) 🔄 IN PROGRESS
  - Repeatable dish form (add/remove dishes)
  - Dish fields: name, description, price
  - Dietary tags multi-select
  - Allergens multi-select
  - Ingredients input (comma-separated)
  - Photo upload with preview (optional)
  - Bulk CSV import option
  - **NOTE**: Menu page exists but needs integration with review flow
- [x] Step 3: Review & verification (~0.5h) ✅ COMPLETED
  - Display all entered restaurant information in organized cards
  - Show restaurant type, country, cuisines, operating hours
  - Edit button navigates back to basic-info form
  - Clean, mobile-responsive layout
  - **NOTE**: Menu review section pending menu form completion

### 2.3 Data Export & Integration (~3h) 🔄 PENDING

- [ ] JSON export functionality (~1h)
  - Generate JSON matching Supabase schema structure
  - Include proper data types and validation
  - Handle image data (base64 or URLs)
  - Add metadata (export date, version)
- [ ] CSV export for menus (~1h)
  - Create CSV template for menu items
  - Generate downloadable CSV from form data
  - Include all dish fields in proper format
  - Add import instructions and validation rules
- [ ] Data validation (~1h)
  - Validate completeness before export
  - Check required fields and data formats
  - Show validation errors with specific feedback
  - Add data quality scoring (optional)

### 2.4 Polish & Documentation (~3h) 🔄 PARTIALLY COMPLETED

- [x] UI/UX refinements (~1h) ✅
  - Add loading states and toast notifications
  - Implement responsive design for mobile/tablet
  - Add comprehensive form validation with error messages
  - Professional styling with proper spacing and visual hierarchy
- [ ] Restaurant partner documentation (~1h)
  - Create user guide for portal usage
  - Add FAQ section
  - Provide CSV template and import instructions
  - Include contact information for support
- [ ] Testing and deployment (~1h)
  - Test full flow on different devices/browsers
  - Verify data export formats
  - Deploy to Vercel (free tier)
  - Set up custom domain (optional)

**Deliverables (Updated Dec 6, 2025):**

**Completed:**

- ✅ Functional web portal running locally
- ✅ Restaurant Information form (8 comprehensive sections)
- ✅ Review page for data verification
- ✅ LocalStorage persistence with auto-save
- ✅ Mobile-responsive design
- ✅ Interactive map with Leaflet integration
- ✅ Advanced cuisine selection with 60+ types
- ✅ Service options and speed configuration

**Pending:**

- [ ] Menu entry form completion
- [ ] JSON/CSV export functionality
- [ ] Deployment to Vercel
- [ ] Restaurant partner documentation
- [ ] 5-10 real restaurant data submissions

**Cost:** $0 (Vercel free tier, no backend required)

**Validation Criteria (Updated):**

**Achieved:**

- ✅ Restaurant completes basic information in <15 minutes
- ✅ Form data persists with LocalStorage
- ✅ Mobile-responsive on phones and tablets
- ✅ Professional UI with clear navigation
- ✅ Comprehensive validation prevents invalid submissions
- ✅ Interactive map simplifies location selection

**Remaining:**

- [ ] Complete menu entry with <10 minutes per restaurant
- [ ] JSON export validates against database schema
- [ ] 90%+ data completeness on submissions
- [ ] Friends/family can use without instruction
- [ ] Deployment to Vercel successful
- [ ] 5-10 real restaurant submissions collected

---

## Phase 3: Backend Integration (Supabase) (~10-15h)

**Goal:** Connect mobile app and web portal to Supabase backend with real data.

**Status**: Database schema complete ✅, ready for integration after Phase 2 data collection

**Database Foundation Completed:**

- ✅ Supabase schema designed (9 tables: profiles, restaurants, dishes, reviews, favorites, + master data)
- ✅ SQL migration file created (`/infra/supabase/migrations/001_initial_schema.sql`)
- ✅ Platform-agnostic Supabase client implemented (`/packages/database`)
- ✅ TypeScript types scaffolded (ready for CLI generation)
- ✅ PostGIS extension configured for geospatial queries
- ✅ RLS policies defined for data security
- ✅ Auto-allergen tagging system with triggers

### 3.1 Supabase Project Setup (~3h)

- [ ] Supabase project creation (~1h)
  - Create new Supabase project with appropriate region
  - Configure database settings and connection pooling
  - Set up environment variables for all environments (dev, staging, prod)
  - Test basic connection and authentication
- [ ] Apply existing database migration (~1h)
  - Run `/infra/supabase/migrations/001_initial_schema.sql` via Supabase Dashboard or CLI
  - Verify all tables created successfully (9 tables)
  - Confirm PostGIS extension enabled
  - Test RLS policies and triggers
  - Validate indexes created properly
- [ ] Import portal data to database (~1h)
  - Parse JSON exports from Restaurant Partner Portal (Phase 2)
  - Bulk import restaurant data into `restaurants` table
  - Import dish data with proper `restaurant_id` foreign keys
  - Validate data integrity and relationships
  - Generate sample user profiles for testing

### 3.2 Authentication System (~4h)

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

### 3.3 Data Layer Implementation (~4h)

- [ ] Repository pattern implementation (~2h)
  - Implement repository interfaces from `/packages/database`
  - Create Supabase-backed repository implementations
  - Replace mock repositories with real data fetching from database
  - Implement proper error handling, retry logic, and loading states
  - Add data validation and sanitization
- [ ] TypeScript types generation (~0.5h)
  - Run Supabase CLI: `supabase gen types typescript`
  - Replace placeholder types in `/packages/database/src/types.ts`
  - Update imports across mobile and web apps
  - Verify type safety with strict TypeScript checks
- [ ] Performance optimization (~1.5h)
  - Test query performance with real data
  - Add caching layer for frequently accessed data
  - Optimize image loading from Supabase Storage
  - Implement pagination for large result sets

### 3.4 Core Features (~4h)

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

### 3.5 Advanced Features (~3h)

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
- Real restaurant data (from Phase 2 portal) loads on map within 3 seconds
- Favorites sync properly across app restarts and devices
- Reviews submit successfully and display with proper formatting
- No authentication errors or data inconsistencies
- Recommendation accuracy improves with user interaction data
- Portal data successfully migrated to database with 100% integrity

**Cost Optimization:**

- Use PostGIS indexes for efficient geospatial queries (already configured)
- Implement result pagination to reduce data transfer
- Cache frequently accessed data locally and server-side
- Monitor Supabase usage and optimize expensive queries
- Use image optimization and CDN for faster loading
- Stay within Supabase free tier limits (500MB storage, 50K MAU)

---

## Phase 4: UX Iteration & Social Features (~12-15h)

**Goal:** Refine user experience and add core social functionality.

### 4.1 User Feedback Integration (~4h)

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

### 4.2 Advanced UI Components (~4h)

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

### 4.3 Social Features Foundation (~4h)

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

### 4.4 Polish and Performance (~3h)

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

## Phase 5: Enhanced Partner Portal & Admin Tools (~12-15h)

**Goal:** Upgrade Partner Portal (from Phase 2) with authentication, database integration, and admin tools.

**Note:** This phase builds upon the LocalStorage-based portal from Phase 2, adding Supabase backend.

### 5.1 Admin Portal Foundation (~6h)

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

### 5.2 Partner Portal Backend Integration (~6h)

- [ ] Authentication integration (~2h)
  - Replace LocalStorage with Supabase authentication
  - Implement restaurant owner account creation
  - Add login/logout flows with session management
  - Link portal submissions to authenticated users
- [ ] Database persistence (~2h)
  - Replace JSON export with direct Supabase saves
  - Implement real-time sync between portal and database
  - Add edit functionality for existing restaurant profiles
  - Handle image uploads to Supabase Storage
- [ ] Enhanced menu management (~2h)
  - Enable editing of previously submitted menus
  - Add menu versioning and change history
  - Implement real-time availability toggles
  - Create daily specials and promotions interface

### 5.3 Integration and Deployment (~3h)

- [ ] Testing and deployment (~1.5h)
  - Test full flow with Supabase backend
  - Verify data consistency between portal and mobile app
  - Add error tracking and monitoring
  - Redeploy to Vercel with environment variables
- [ ] Migration utilities (~1.5h)
  - Create scripts to migrate old JSON exports to database
  - Build admin tools for bulk data import/export
  - Add data validation and cleanup utilities
  - Document migration process for existing partners

**Validation Criteria:**

- Restaurant partners can create accounts and manage profiles independently
- Changes in portal reflect in mobile app within 30 seconds
- Admin can moderate and approve restaurant submissions
- Image uploads work correctly with Supabase Storage
- All existing JSON exports successfully migrated to database
- Portal loads completely in <3 seconds on desktop

---

## Phase 6: CI/CD & Scale (~10h)

**Goal:** Automate and prepare for production.

- [ ] GitHub Actions for linting, builds, tests
- [ ] Expo EAS for iOS/Android builds + OTA updates
- [ ] Vercel for web portal deployments
- [ ] Optimize Supabase schema, add RLS policies, cost monitoring
- [ ] Performance improvements (map clustering, lazy loading)

**Validation:** Smooth experience for 100+ test users in beta program.

---

## Future Phases (Post-Phase 6)

- **Phase 7: Social Features** - Friend system, group dining, rewards program.
- **Phase 8: Internationalization** - Multi-language support, traveler features.
- **Phase 9: Advanced Features** - Daily menus, integrations, ML recommendations.
- **Phase 10: Launch Preparation** - Testing, security, app store submissions.

---

## Key Documentation References

- **Restaurant Partner Portal**: `/docs/restaurant-partner-portal.md` - Complete portal implementation plan
- **Future Features**: `/docs/future-features.md` - Database fields and features deferred from MVP
- **Database Schema**: `/infra/supabase/migrations/001_initial_schema.sql` - Complete SQL migration
- **Database Package**: `/packages/database/` - Platform-agnostic Supabase client and types

---

## Strategic Decision Log

### November 16, 2024: Pivot to Web Portal First

**Decision:** Build Restaurant Partner Portal (Phase 2) before integrating backend (Phase 3)

**Rationale:**

1. Validate database schema with real restaurant data before infrastructure costs
2. Collect structured data matching our schema design
3. Zero-cost data collection phase (LocalStorage + Vercel free tier)
4. Identify schema issues early (missing fields, wrong data types)
5. Create sales/demo tool for restaurant acquisition

**Impact on Timeline:**

- Phase 2 (Backend) → Phase 3 (now 10-15h instead of 15-20h due to ready schema)
- New Phase 2: Restaurant Portal (~15-20h)
- Overall timeline: +15-20h, but reduces risk and validates approach
- Database foundation already complete, reducing Phase 3 complexity

**Completed Pre-work:**

- ✅ Database schema designed and documented (9 tables)
- ✅ SQL migrations created with PostGIS, RLS, triggers
- ✅ Platform-agnostic Supabase client implemented
- ✅ TypeScript types scaffolded
- ✅ Future features documented for post-MVP phases
