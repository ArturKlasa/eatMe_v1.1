/**
 * Session Store
 *
 * Tracks user viewing sessions - which restaurants and dishes they've viewed.
 * Used to prompt users for ratings after they've likely visited a restaurant.
 * Integrates with Supabase to persist session data.
 */

import { create } from 'zustand';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase } from '../lib/supabase';
import { SessionView, RecentlyViewedRestaurant, RecentlyViewedDish } from '../types/rating';

const SESSION_STORAGE_KEY = 'eatme_session_views';
const SESSION_TIMEOUT_MS = 60 * 60 * 1000; // 1 hour (session ends after 1 hour of inactivity)

interface SessionState {
  // Current session ID from database
  currentSessionId: string | null;

  // Current session views
  views: SessionView[];

  // Recently viewed restaurants (compiled from views)
  recentRestaurants: RecentlyViewedRestaurant[];

  // Session tracking
  startSession: () => Promise<void>;
  endSession: () => Promise<void>;

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
  currentSessionId: null,
  views: [],
  recentRestaurants: [],

  startSession: async () => {
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) {
        console.log('[Session] No user, skipping session start');
        return;
      }

      // Check if there's an active session
      const { data: activeSessions } = await supabase
        .from('user_sessions')
        .select('id')
        .eq('user_id', user.id)
        .eq('is_active', true)
        .order('started_at', { ascending: false })
        .limit(1);

      if (activeSessions && activeSessions.length > 0) {
        // Use existing active session
        set({ currentSessionId: activeSessions[0].id });
        console.log('[Session] Using existing session:', activeSessions[0].id);
        return;
      }

      // Create new session
      const { data: newSession, error } = await supabase
        .from('user_sessions')
        .insert({
          user_id: user.id,
          is_active: true,
        })
        .select('id')
        .single();

      if (error) {
        console.error('[Session] Error creating session:', error);
        return;
      }

      set({ currentSessionId: newSession.id });
      console.log('[Session] Started new session:', newSession.id);
    } catch (error) {
      console.error('[Session] Error in startSession:', error);
    }
  },

  endSession: async () => {
    const { currentSessionId } = get();
    if (!currentSessionId) return;

    try {
      const { error } = await supabase
        .from('user_sessions')
        .update({
          ended_at: new Date().toISOString(),
          is_active: false,
        })
        .eq('id', currentSessionId);

      if (error) {
        console.error('[Session] Error ending session:', error);
        return;
      }

      set({ currentSessionId: null });
      console.log('[Session] Ended session:', currentSessionId);
    } catch (error) {
      console.error('[Session] Error in endSession:', error);
    }
  },

  trackView: async (entityType, entityId) => {
    const { currentSessionId } = get();

    // Track in local state
    const view: SessionView = {
      entityType,
      entityId,
      viewedAt: new Date(),
    };

    set(state => ({
      views: [...state.views, view],
    }));

    // Save to Supabase if we have a session
    if (currentSessionId) {
      try {
        const {
          data: { user },
        } = await supabase.auth.getUser();
        if (!user) return;

        await supabase.from('session_views').insert({
          session_id: currentSessionId,
          user_id: user.id,
          entity_type: entityType,
          entity_id: entityId,
          viewed_at: new Date().toISOString(),
        });

        console.log('[Session] Tracked view:', { entityType, entityId });
      } catch (error) {
        console.error('[Session] Error tracking view:', error);
      }
    }

    get().saveToStorage();
  },

  trackDishView: (restaurantId, dish) => {
    // Track in database
    get().trackView('dish', dish.id);

    // Track in local state for UI
    set(state => {
      const restaurantIndex = state.recentRestaurants.findIndex(r => r.id === restaurantId);

      if (restaurantIndex === -1) {
        return state;
      }

      const updatedRestaurants = [...state.recentRestaurants];
      const restaurant = { ...updatedRestaurants[restaurantIndex] };

      const existingDishIndex = restaurant.viewedDishes.findIndex(d => d.id === dish.id);

      if (existingDishIndex === -1) {
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
        restaurant.viewedDishes = [...restaurant.viewedDishes];
        restaurant.viewedDishes[existingDishIndex] = {
          ...restaurant.viewedDishes[existingDishIndex],
          viewedAt: new Date(),
        };
      }

      updatedRestaurants[restaurantIndex] = restaurant;

      return {
        recentRestaurants: updatedRestaurants,
      };
    });
  },

  trackRestaurantView: restaurant => {
    // Track in database
    get().trackView('restaurant', restaurant.id);

    // Track in local state for UI
    set(state => {
      const existingIndex = state.recentRestaurants.findIndex(r => r.id === restaurant.id);

      let updatedRestaurants: RecentlyViewedRestaurant[];

      if (existingIndex === -1) {
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
        updatedRestaurants = [...state.recentRestaurants];
        updatedRestaurants[existingIndex] = {
          ...updatedRestaurants[existingIndex],
          viewedAt: new Date(),
        };
      }

      return {
        recentRestaurants: updatedRestaurants,
      };
    });
  },
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
