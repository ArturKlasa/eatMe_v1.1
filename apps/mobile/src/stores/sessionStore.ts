/**
 * Session Store
 *
 * Tracks user viewing sessions - which restaurants and dishes they've viewed.
 * Used to prompt users for ratings after they've likely visited a restaurant.
 */

import { create } from 'zustand';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { SessionView, RecentlyViewedRestaurant, RecentlyViewedDish } from '../types/rating';

const SESSION_STORAGE_KEY = 'eatme_session_views';
const SESSION_TIMEOUT_MS = 24 * 60 * 60 * 1000; // 24 hours

interface SessionState {
  // Current session views
  views: SessionView[];

  // Recently viewed restaurants (compiled from views)
  recentRestaurants: RecentlyViewedRestaurant[];

  // Track a view
  trackView: (entityType: 'restaurant' | 'dish' | 'menu', entityId: string) => void;

  // Track dish view within a restaurant context
  trackDishView: (
    restaurantId: string,
    dish: { id: string; name: string; price: number; imageUrl?: string }
  ) => void;

  // Track restaurant view
  trackRestaurantView: (restaurant: {
    id: string;
    name: string;
    cuisine: string;
    imageUrl?: string;
  }) => void;

  // Get recently viewed restaurants for rating prompt
  getRecentRestaurantsForRating: () => RecentlyViewedRestaurant[];

  // Clear session (after app closes and reopens)
  clearOldSessions: () => void;

  // Load from storage
  loadFromStorage: () => Promise<void>;

  // Save to storage
  saveToStorage: () => Promise<void>;
}

export const useSessionStore = create<SessionState>((set, get) => ({
  views: [],
  recentRestaurants: [],

  trackView: (entityType, entityId) => {
    const view: SessionView = {
      entityType,
      entityId,
      viewedAt: new Date(),
    };

    set(state => ({
      views: [...state.views, view],
    }));

    get().saveToStorage();
  },

  trackDishView: (restaurantId, dish) => {
    set(state => {
      // Find the restaurant in recent views
      const restaurantIndex = state.recentRestaurants.findIndex(r => r.id === restaurantId);

      if (restaurantIndex === -1) {
        // Restaurant not yet tracked, skip (trackRestaurantView should be called first)
        return state;
      }

      const updatedRestaurants = [...state.recentRestaurants];
      const restaurant = { ...updatedRestaurants[restaurantIndex] };

      // Check if dish already viewed
      const existingDishIndex = restaurant.viewedDishes.findIndex(d => d.id === dish.id);

      if (existingDishIndex === -1) {
        // Add new dish
        restaurant.viewedDishes = [
          ...restaurant.viewedDishes,
          {
            id: dish.id,
            name: dish.name,
            price: dish.price,
            imageUrl: dish.imageUrl,
            viewedAt: new Date(),
          },
        ];
      } else {
        // Update view time
        restaurant.viewedDishes = [...restaurant.viewedDishes];
        restaurant.viewedDishes[existingDishIndex] = {
          ...restaurant.viewedDishes[existingDishIndex],
          viewedAt: new Date(),
        };
      }

      updatedRestaurants[restaurantIndex] = restaurant;

      // Also track in generic views
      const view: SessionView = {
        entityType: 'dish',
        entityId: dish.id,
        viewedAt: new Date(),
      };

      return {
        views: [...state.views, view],
        recentRestaurants: updatedRestaurants,
      };
    });

    get().saveToStorage();
  },

  trackRestaurantView: restaurant => {
    set(state => {
      // Check if restaurant already in recent views
      const existingIndex = state.recentRestaurants.findIndex(r => r.id === restaurant.id);

      let updatedRestaurants: RecentlyViewedRestaurant[];

      if (existingIndex === -1) {
        // Add new restaurant
        const newRestaurant: RecentlyViewedRestaurant = {
          id: restaurant.id,
          name: restaurant.name,
          cuisine: restaurant.cuisine,
          imageUrl: restaurant.imageUrl,
          viewedAt: new Date(),
          viewedDishes: [],
        };
        updatedRestaurants = [...state.recentRestaurants, newRestaurant];
      } else {
        // Update view time
        updatedRestaurants = [...state.recentRestaurants];
        updatedRestaurants[existingIndex] = {
          ...updatedRestaurants[existingIndex],
          viewedAt: new Date(),
        };
      }

      // Also track in generic views
      const view: SessionView = {
        entityType: 'restaurant',
        entityId: restaurant.id,
        viewedAt: new Date(),
      };

      return {
        views: [...state.views, view],
        recentRestaurants: updatedRestaurants,
      };
    });

    get().saveToStorage();
  },

  getRecentRestaurantsForRating: () => {
    const { recentRestaurants } = get();
    const now = new Date().getTime();

    // Filter to restaurants viewed in the last 24 hours
    // Sort by most recently viewed first
    return recentRestaurants
      .filter(r => now - new Date(r.viewedAt).getTime() < SESSION_TIMEOUT_MS)
      .sort((a, b) => new Date(b.viewedAt).getTime() - new Date(a.viewedAt).getTime());
  },

  clearOldSessions: () => {
    const now = new Date().getTime();

    set(state => ({
      views: state.views.filter(v => now - new Date(v.viewedAt).getTime() < SESSION_TIMEOUT_MS),
      recentRestaurants: state.recentRestaurants.filter(
        r => now - new Date(r.viewedAt).getTime() < SESSION_TIMEOUT_MS
      ),
    }));

    get().saveToStorage();
  },

  loadFromStorage: async () => {
    try {
      const stored = await AsyncStorage.getItem(SESSION_STORAGE_KEY);
      if (stored) {
        const data = JSON.parse(stored);

        // Convert date strings back to Date objects
        const views = (data.views || []).map((v: SessionView) => ({
          ...v,
          viewedAt: new Date(v.viewedAt),
        }));

        const recentRestaurants = (data.recentRestaurants || []).map(
          (r: RecentlyViewedRestaurant) => ({
            ...r,
            viewedAt: new Date(r.viewedAt),
            viewedDishes: r.viewedDishes.map(d => ({
              ...d,
              viewedAt: new Date(d.viewedAt),
            })),
          })
        );

        set({ views, recentRestaurants });

        // Clear old sessions after loading
        get().clearOldSessions();
      }
    } catch (error) {
      console.error('[SessionStore] Failed to load from storage:', error);
    }
  },

  saveToStorage: async () => {
    try {
      const { views, recentRestaurants } = get();
      await AsyncStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify({ views, recentRestaurants }));
    } catch (error) {
      console.error('[SessionStore] Failed to save to storage:', error);
    }
  },
}));
