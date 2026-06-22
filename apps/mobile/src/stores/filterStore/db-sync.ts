import type { StoreApi } from 'zustand';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { debugLog } from '../../config/environment';
import {
  loadUserPreferences,
  saveUserPreferences,
  permanentFiltersToDb,
  dbToPermanentFilters,
} from '../../services/userPreferencesService';
import { LAST_SYNCED_STORAGE_KEY } from './defaults';
import type { FilterState, FilterActions } from './types';

type FilterStore = FilterState & FilterActions;
type Set = StoreApi<FilterStore>['setState'];
type Get = StoreApi<FilterStore>['getState'];

export const createDbSyncSlice = (set: Set, get: Get) => ({
  // Database sync actions (for authenticated users)
  lastSyncedAt: null,
  loadPreferencesFromDB: async (userId: string) => {
    try {
      debugLog('[FilterStore] Loading preferences from database...');
      const result = await loadUserPreferences(userId);

      if (!result.ok) {
        console.error('[FilterStore] Failed to load preferences from DB:', result.error);
        return;
      }

      if (result.data) {
        // Convert DB format to filterStore format and merge with current state
        const dbFilters = dbToPermanentFilters(result.data);
        set(state => ({
          permanent: {
            ...state.permanent,
            ...dbFilters,
          },
        }));
        debugLog('[FilterStore] Loaded preferences from database');
      } else {
        debugLog('[FilterStore] No preferences found in database (first time user)');
      }
    } catch (error) {
      console.error('[FilterStore] Unexpected error loading from DB:', error);
    }
  },

  savePreferencesToDB: async (userId: string) => {
    try {
      debugLog('[FilterStore] Saving preferences to database...');
      const currentState = get();
      const dbPrefs = permanentFiltersToDb(currentState.permanent);

      const result = await saveUserPreferences(userId, dbPrefs);

      if (!result.ok) {
        console.error('[FilterStore] Failed to save preferences to DB:', result.error);
        return;
      }

      debugLog('[FilterStore] Saved preferences to database');
    } catch (error) {
      console.error('[FilterStore] Unexpected error saving to DB:', error);
    }
  },

  syncWithDatabase: async (userId: string | null) => {
    if (!userId) {
      debugLog('[FilterStore] No user ID, skipping database sync');
      return;
    }

    // Load preferences from database on app start/login
    await get().loadPreferencesFromDB(userId);
    const syncTime = Date.now();
    set({ lastSyncedAt: syncTime });
    // Persist immediately so next app restart sees the correct timestamp
    try {
      await AsyncStorage.setItem(LAST_SYNCED_STORAGE_KEY, String(syncTime));
    } catch (e) {
      debugLog('[FilterStore] Failed to persist lastSyncedAt:', e);
    }
  },

  // Helper: Save filters locally AND to database if user is authenticated
  savePermanentFilters: async () => {
    const state = get();
    await state.saveFilters(); // Save to AsyncStorage

    // Also save to database if user is authenticated
    // We'll get the user from authStore
    try {
      const { useAuthStore: getAuthStore } = await import('../authStore');
      const user = getAuthStore.getState().user;
      if (user?.id) {
        await state.savePreferencesToDB(user.id);
      }
    } catch (error) {
      // Auth store might not be ready yet, that's okay
      debugLog('[FilterStore] Could not auto-save to DB:', error);
    }
  },
});
