import { useState, useEffect, useMemo, useCallback } from 'react';
import { useShallow } from 'zustand/react/shallow';
import type { UserLocation } from '../../../hooks/useUserLocation';
import { useFilterStore } from '../../../stores/filterStore';
import { useAuthStore } from '../../../stores/authStore';
import { debugLog } from '../../../config/environment';
import {
  composeCardName,
  getCombinedFeedAutoExpand,
  ServerDish,
  ServerRestaurant,
} from '../../../services/edgeFunctionsService';

/**
 * useDishFeed
 *
 * Owns the combined dish/restaurant feed fetch, client-side dedup/keyword filtering,
 * paging, and the map-pin projection. `userLocation` is passed in by the screen (it
 * comes from useMapCamera).
 */
export function useDishFeed(userLocation: UserLocation | null) {
  const [feedDishes, setFeedDishes] = useState<ServerDish[]>([]);
  const [feedLoading, setFeedLoading] = useState(false);
  const [filteredRestaurants, setFilteredRestaurants] = useState<ServerRestaurant[]>([]);

  const user = useAuthStore(state => state.user);

  // Use shallow selectors to reduce re-renders
  const { daily, permanent } = useFilterStore(
    useShallow(state => ({ daily: state.daily, permanent: state.permanent }))
  );

  // Map edge-function ServerDish results into the shape MapFooter expects.
  // Full deduped list (one dish per restaurant); the footer/map page through it in
  // batches of PAGE_SIZE via "Get more dishes".
  // Drinks and desserts are excluded server-side (generate_candidates) but we
  // also apply a lightweight client-side check as a safety net for uncategorised items.
  const allRecommendedDishes = useMemo(() => {
    const DRINK_KEYWORDS =
      /\b(coffee|espresso|latte|cappuccino|americano|macchiato|mocha|tea|chai|matcha|juice|smoothie|milkshake|soda|cola|lemonade|limeade|water|sparkling|mocktail|cocktail|beer|wine|sangria|margarita|mojito|spritz|kombucha|hot chocolate|iced tea)\b/i;
    const DESSERT_KEYWORDS =
      /\b(cake|cupcake|brownie|cookie|ice cream|gelato|sorbet|tiramisu|cheesecake|pudding|mousse|crème brûlée|creme brulee|macaron|donut|doughnut|muffin|pie à la mode|sundae|churro|baklava|flan|panna cotta|parfait)\b/i;

    const seen = new Set<string>();
    const result: ReturnType<typeof buildDish>[] = [];

    for (const dish of feedDishes ?? []) {
      if (seen.has(dish.restaurant_id)) continue;
      // Skip drinks and desserts that slipped past the server filter
      if (DRINK_KEYWORDS.test(dish.name) || DESSERT_KEYWORDS.test(dish.name)) continue;
      seen.add(dish.restaurant_id);
      result.push(buildDish(dish));
    }
    return result;
  }, [feedDishes]);

  // "Get more dishes" pages through the already-fetched feed, PAGE_SIZE restaurants
  // at a time. Resets to page 0 whenever a fresh feed loads (see the feed effect).
  const PAGE_SIZE = 5;
  const [dishPage, setDishPage] = useState(0);
  const recommendedDishes = useMemo(
    () => allRecommendedDishes.slice(dishPage * PAGE_SIZE, dishPage * PAGE_SIZE + PAGE_SIZE),
    [allRecommendedDishes, dishPage]
  );
  const hasMoreDishes = allRecommendedDishes.length > (dishPage + 1) * PAGE_SIZE;
  const handleShowMore = useCallback(() => setDishPage(p => p + 1), []);

  function buildDish(dish: ServerDish) {
    // The Edge Function may return restaurant info nested (restaurant.name)
    // or flat (restaurant_name) depending on version. Handle both.
    const flatDish = dish as ServerDish & {
      restaurant_name?: string;
      restaurant_cuisines?: string[];
      restaurant_rating?: number;
    };
    return {
      id: dish.id,
      // Compose the card name from applied_options (Hybrid A+C). Falls back
      // to dish.name when no descriptors qualify.
      name: composeCardName(dish),
      restaurantId: dish.restaurant_id,
      restaurantName: dish.restaurant?.name || flatDish.restaurant_name || 'Unknown Restaurant',
      // Prefer the feed-resolved effective_price (default options applied);
      // fall back to base price when the feed didn't customise.
      price: dish.effective_price ?? dish.price,
      cuisine:
        dish.restaurant?.cuisine_types?.[0] || flatDish.restaurant_cuisines?.[0] || 'Unknown',
      currencyCode: dish.restaurant?.currency_code ?? null,
      imageUrl: dish.image_url || undefined,
      isAvailable: dish.is_available,
    };
  }

  // Pins follow the dishes currently shown in the footer (recommendedDishes), so the
  // map shows only the ~5 restaurants backing the visible cards — not the whole feed.
  // Coordinates come from filteredRestaurants (dishes don't carry location); cuisine
  // rides along for the marker emoji.
  const mapPinDishes = useMemo(() => {
    const coordsMap = new Map<string, [number, number]>();
    for (const r of filteredRestaurants) {
      if (r.location?.lat != null && r.location?.lng != null) {
        coordsMap.set(r.id, [r.location.lng, r.location.lat]);
      }
    }
    return recommendedDishes
      .filter(d => coordsMap.has(d.restaurantId))
      .map(d => ({
        id: d.id,
        name: d.name,
        restaurantId: d.restaurantId,
        coordinates: coordsMap.get(d.restaurantId)!,
        price: d.price,
        cuisine: d.cuisine,
      }));
  }, [recommendedDishes, filteredRestaurants]);

  // Fetch dishes + restaurants in a single combined call whenever location or filters change.
  // Keyed on a primitive signature (rounded coords + serialized filters + user id) rather than
  // object identity: GPS returns a fresh userLocation object for near-identical coords, and the
  // filter store spreads new daily/permanent on every interaction, so identity deps re-fire the
  // /feed call spuriously. ~110m rounding matches the feed cache's geohash granularity.
  // LANDMINE — do NOT "fix"; see 09-CONTEXT.md D-11.1 (primitive-signature deps + 300ms debounce + cancelled flag)
  const feedLat = userLocation ? userLocation.latitude.toFixed(3) : null;
  const feedLng = userLocation ? userLocation.longitude.toFixed(3) : null;
  const dailyKey = JSON.stringify(daily);
  const permanentKey = JSON.stringify(permanent);
  useEffect(() => {
    if (!userLocation) return;

    let cancelled = false;
    const timeoutId = setTimeout(async () => {
      setFeedLoading(true);
      try {
        // Start at 1.5km and auto-expand (→3→5km) only if a radius yields no dishes. Hard-capped
        // at 5km inside the helper — past that generate_candidates hits the statement timeout.
        const response = await getCombinedFeedAutoExpand(
          { lat: userLocation.latitude, lng: userLocation.longitude },
          daily,
          permanent,
          user?.id,
          daily.maxDistance, // ceiling (helper caps at min(5, this))
          () => cancelled
        );
        if (!cancelled && response) {
          const dishes = response.dishes ?? [];
          const restaurants = response.restaurants ?? [];
          setFeedDishes(dishes);
          setFilteredRestaurants(restaurants);
          setDishPage(0); // reset "get more" paging on a fresh feed
          debugLog(
            `[BasicMapScreen] Feed loaded @${response.radiusUsedKm}km: ${dishes.length} dishes + ${restaurants.length} restaurants (personalized: ${response.metadata?.personalized})`
          );
        }
      } catch (err) {
        console.error('[BasicMapScreen] Failed to load feed from Edge Function:', err);
      } finally {
        if (!cancelled) setFeedLoading(false);
      }
    }, 300); // debounce rapid filter changes

    return () => {
      cancelled = true;
      clearTimeout(timeoutId);
    };
    // Deps are the primitive signature, NOT the objects: it IS the semantic identity of
    // (location, filters, user), and depending on the objects is exactly what re-fires /feed
    // on identity churn. userLocation/daily/permanent are read from the closure, consistent
    // with the signature. (The repo has no react-hooks/exhaustive-deps rule, so no disable.)
  }, [feedLat, feedLng, dailyKey, permanentKey, user?.id]);

  return {
    recommendedDishes,
    mapPinDishes,
    hasMoreDishes,
    handleShowMore,
    feedLoading,
    filteredRestaurants,
  };
}
