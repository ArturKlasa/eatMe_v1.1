# Mobile App Research

## Screens
### Main
- BasicMapScreen — Primary feed with Mapbox map, restaurant/dish markers, daily filters
- FiltersScreen — Permanent filter management (90% modal)
- FavoritesScreen — Placeholder (coming soon)
- ProfileScreen — User info, stats (swipes, likes, dislikes), dietary summary
- ProfileEditScreen — Edit user profile
- EatTogetherScreen — Group dining hub (create/join session)
- SettingsScreen — Language, notifications, privacy toggles
- RestaurantDetailScreen — Full restaurant detail with menus, dishes, hours
- ViewedHistoryScreen — Recently viewed items

### Auth
- LoginScreen — Email/password + Google/Facebook OAuth
- RegisterScreen — Account creation
- ForgotPasswordScreen — Password reset

### Eat Together
- CreateSessionScreen — Host creates session, QR code, share link
- JoinSessionScreen — Join via session code
- SessionLobbyScreen — Waiting room with realtime member updates
- RecommendationsScreen — Restaurant recommendations with compatibility scores
- VotingResultsScreen — Vote tallies and winner

### Onboarding
- OnboardingStep1Screen — Dietary preferences & allergies
- OnboardingStep2Screen — Cuisines, dishes, spice tolerance

## Navigation
```
RootNavigator (Stack)
├── AuthNavigator (Login, Register, ForgotPassword)
└── MainNavigator (Stack)
    ├── Map (main feed)
    ├── Filters, Favorites, Profile (transparent modals)
    ├── EatTogether flow (CreateSession, JoinSession, SessionLobby, Recommendations, VotingResults)
    ├── Settings, RestaurantDetail, ViewedHistory
    └── Onboarding (Step1, Step2)
```

## Services
- edgeFunctionsService — getFeed(), getFilteredRestaurants()
- geoService — fetchNearbyRestaurants(), formatDistance()
- ratingService — uploadPhoto(), createUserVisit(), saveDishOpinions(), submitRating()
- eatTogetherService — Full session lifecycle (create, join, vote, finalize, realtime subscriptions)
- favoritesService — toggleFavorite(), isFavorited(), getUserFavorites()
- filterService — estimateAvgPrice(), filter matching
- userPreferencesService — load/save preferences, DB conversion
- interactionService — recordInteraction()
- dishRatingService — getDishRatingsBatch()
- restaurantRatingService — getRestaurantRating()
- viewHistoryService — Track recently viewed
- ingredientService — Ingredient lookup and mapping
- dishPhotoService — Photo upload management

## Stores (Zustand)
- authStore — Session, auth methods, OAuth, listener management
- filterStore — Two-tier: DailyFilters (session) + PermanentFilters (profile)
- settingsStore — Language, currency, notifications, privacy (persisted via AsyncStorage)
- onboardingStore — Two-step flow, profile completion tracking, 24h prompt cooldown
- sessionStore — App sessions, view tracking, rating prompts
- viewModeStore — Restaurant/dish toggle (default: dish)
- restaurantStore — Restaurants, dishes, nearby results, search state
- storeBindings — Cross-store sync (auth → preferences, settings → filters)

## Hooks
- useUserLocation — GPS with 5-min cache, permission handling
- useDish — Single dish fetching with joins
- useCountryDetection — GPS-based currency detection (Tier 2)
- useSwipeToClose — Pan gesture for modal dismissal

## i18n
- i18next + react-i18next
- Languages: English, Spanish, Polish
- Detection: persisted store → AsyncStorage → device locale → English

## Key Features
- Map-based discovery with Mapbox
- Two-tier filter system (daily + permanent)
- Eat Together group sessions with realtime updates
- Rating flow with photo uploads and points
- Onboarding with profile completion tracking
- Auto currency detection (device locale + GPS refinement)
