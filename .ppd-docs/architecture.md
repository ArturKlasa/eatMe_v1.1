
# EatMe Architecture

## 1. Monorepo Structure
Managed with **Turborepo** for shared caching and CI/CD efficiency.

```
/eatMe
  apps/
    mobile/                    # React Native (Expo Bare) app
    web/                      # Next.js web portal (Phase 3)
  packages/
    ui/                       # Shared UI library (Storybook-powered)
    types/                    # Shared TypeScript types (entities, contracts)
    services/                 # Service layer (repositories, mock & real data sources)
    config/                   # Shared ESLint, Prettier, tsconfig
  infra/
    supabase/                 # Database migrations, policies, edge functions
    ci/                       # GitHub Actions workflows
  docs/                       # Documentation
```

## 2. Clean Architecture Implementation

### Architecture Layers
EatMe follows clean architecture principles with clear separation of concerns:

```
┌─────────────────────────────────────┐
│           UI Layer                   │
│   Components, Screens, Navigation    │
├─────────────────────────────────────┤
│        Application Layer            │
│  Hooks, State Management, Services   │
├─────────────────────────────────────┤
│          Domain Layer               │
│   Business Logic, Entities, Rules   │
├─────────────────────────────────────┤
│       Infrastructure Layer          │
│  Supabase, APIs, External Services  │
└─────────────────────────────────────┘
```

**UI Layer Responsibilities:**
- React Native components and screens
- User interface interactions and navigation
- Presentation logic only (no business rules)

**Application Layer Responsibilities:**  
- Custom React hooks for state management
- Orchestration of business operations
- API service coordination and error handling

**Domain Layer Responsibilities:**
- Core business entities and value objects
- Business rules and validation logic
- Recommendation algorithms and filtering (framework-independent)

**Infrastructure Layer Responsibilities:**
- Supabase database operations and real-time subscriptions
- External API integrations (Mapbox, etc.)
- Device services (location, storage) and platform-specific code

### SOLID Principles Implementation
- **Single Responsibility**: `LocationService` handles only location, `RecommendationEngine` only computes scores
- **Open/Closed**: Recommendation strategies are pluggable via interfaces
- **Interface Segregation**: Separate `ReadableRepository`/`WritableRepository` interfaces
- **Dependency Inversion**: High-level modules depend on abstractions, concrete implementations injected at runtime

## 3. Mobile App Architecture (React Native + Expo Bare)

### Core Technology Implementation
**Phase 1 focus** — all UI flows with mock data:  
- **Map Screen**: Mapbox integration with restaurant/dish markers and clustering
- **Drawer Menu & Filter Bar**: comprehensive filtering with budget, cuisine, dietary toggles  
- **Dish/Restaurant Toggle**: seamless switching between discovery modes  
- **Swipe Flow**: Tinder-like card deck for preference learning (like, dislike, neutral)
- **Auth UI (stub)**: placeholder screens ready for backend integration

### Technology Stack
- **Framework**: React Native 0.73+ with Expo Bare Workflow
- **Language**: TypeScript with strict mode enabled
- **UI Library**: NativeBase for flexible, customizable components
- **State Management**: Zustand for lightweight, scalable state management
- **Navigation**: React Navigation with Drawer + Stack navigators
- **Maps**: @rnmapbox/maps for advanced mapping capabilities
- **Storage**: @react-native-async-storage/async-storage for local persistence

### State Management Architecture
```typescript
// Global State Structure
interface AppState {
  user: UserState;
  filters: FilterState;
  recommendations: RecommendationState;
  preferences: PreferenceState;
}

// Example Store Implementation
export const useAppStore = create<AppState>((set, get) => ({
  user: initialUserState,
  filters: initialFilterState,
  // ... other state slices
}));
```

### Service Layer Design
```typescript
// Domain service interfaces
interface RecommendationService {
  getRecommendations(filters: UserFilters): Promise<Recommendation[]>;
  updatePreferences(preferences: UserPreferences): Promise<void>;
  learnFromInteraction(interaction: UserInteraction): Promise<void>;
}

// Infrastructure implementation
class SupabaseRecommendationService implements RecommendationService {
  constructor(
    private client: SupabaseClient,
    private locationService: LocationService
  ) {}
  // Implementation details...
}
```  

### Mapbox Integration Patterns
- Use `MapView` + `ShapeSource` + `SymbolLayer` for scalable marker rendering; enable clustering when zoomed out.
- Request location permissions (Android/iOS) via platform APIs; watch position for subtle UX boosts, cache last known location.
- Keep markers lightweight (no heavy images) during dev to control Mapbox usage and maintain performance.

## Web Portal (Next.js + TailwindCSS) – Phase 3
- **Restaurant Portal**: menu uploads, tagging, photo management  
- **Admin Portal**: moderation, analytics, feedback tools  
- **Optional User Portal**: profiles, reviews  

## Backend (Supabase) – Phase 2
- **Database**: Postgres with schemas for users, restaurants, dishes, reviews  
- **Auth**: Supabase Auth (email + OAuth)  
- **Storage**: images for menus, avatars, reviews  
- **Edge Functions**: recommendations, group dining sessions, notifications  
- **Security**: RLS policies per user/restaurant  

## Data Flow
- Phase 1: repositories in `/packages/services` return mock JSON  
- Phase 2: repositories switch to Supabase-backed implementations  
- Phase 3: web + mobile share the same backend  
- Phase 4: CI/CD automates deployments  

**Mock Data Specification**:  
- `restaurants.json`: [{id: string, name: string, location: {lat: number, lng: number}, dishes: string[]}]  
- `dishes.json`: [{id: string, name: string, ingredients: string[], restaurantId: string}]  
- `ingredients.json`: [{id: string, name: string, dietary: string[]}] (e.g., dietary: ["vegan", "gluten-free"])  
- Load via mock repository classes; use 10-20 items for UI testing.  

### Clean Architecture Principles (Summary)
- Single Responsibility: e.g., `LocationService` only handles location; `RecommendationEngine` only computes scores.
- Open/Closed: extend filters and recommendation strategies without modifying existing code via interfaces.
- Interface Segregation: focused contracts (e.g., `ReadableRepository`/`WritableRepository`).
- Dependency Inversion: high-level modules depend on abstractions; inject concrete impls at runtime.

## CI/CD – Phase 4
- GitHub Actions → lint, test, build pipelines  
- Expo EAS → OTA updates, iOS/Android builds  
- Vercel → deploy web portal  
- Environments: local, staging, production  

## Troubleshooting & FAQs
- **Mapbox not rendering in Expo Bare**: Ensure native linking (run `npx react-native link @rnmapbox/maps` or use autolinking). Check API key setup.  
- **Swipe gestures not working**: Verify react-native-deck-swiper installation and gesture handler setup.  
- **State not persisting**: Use AsyncStorage for local storage of preferences.  
- **Build errors**: Clear cache with `expo r -c` and check Expo SDK compatibility.  

## Clean Architecture Layers
EatMe follows clean architecture principles with clear separation of concerns across four distinct layers:

**UI Layer (React Native Components):** Components, screens, navigation, presentation logic only.

**Application Layer:** Hooks, state management, services, orchestration of business operations.

**Domain Layer:** Business logic, entities, rules, recommendation algorithms.

**Infrastructure Layer:** Supabase, APIs, external services, device services.

## Testing Strategy
**Unit Tests (60-70%):** Domain & application layers, using Jest + React Native Testing Library.

**Integration Tests (20-30%):** Service interactions, component behavior.

**End-to-End Tests (5-10%):** Critical user flows, using Detox.

## Performance Considerations
- Cache recommendations locally for fast cold start.
- Use Supabase indexes on location, cuisine_types, price_level.
- Lazy-load screens/components.
- Minimize map re-renders with memoized data layers.
 - Use marker clustering/virtualization to reduce Mapbox requests and improve UX.

## Security
- Strict RLS on Supabase tables.
- No secrets in client; Edge Functions for server-side keys.
- HTTPS enforced.
- Data minimization: location stored temporarily.
- GDPR/CCPA: data export & deletion endpoints.  

## Example Directory Layout (Mobile)

## Documentation & Code Comments

- All code should be well-commented, especially for complex logic, public APIs, and architectural decisions.
- Maintain up-to-date documentation files in the `docs/` folder for architecture, setup, package management, and feature guides.
- Use clear, descriptive commit messages and document major changes in a changelog or ADR (Architecture Decision Record) when relevant.
- Prefer doc comments (JSDoc/TypeDoc) for TypeScript interfaces, classes, and functions.
- Keep README files updated for each major package and app.

Good documentation and comments help onboard new contributors, reduce bugs, and make future maintenance easier.
