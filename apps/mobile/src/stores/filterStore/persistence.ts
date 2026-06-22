import type { StoreApi } from 'zustand';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { debugLog } from '../../config/environment';
import { type SupportedCurrency } from '../../utils/currencyConfig';
import {
  DAILY_STORAGE_KEY,
  PERMANENT_STORAGE_KEY,
  LAST_SYNCED_STORAGE_KEY,
  defaultPermanentFilters,
  defaultDailyFilters,
  getDefaultDailyFilters,
} from './defaults';
import type { FilterState, FilterActions } from './types';

type FilterStore = FilterState & FilterActions;
type Set = StoreApi<FilterStore>['setState'];
type Get = StoreApi<FilterStore>['getState'];

// Debounce timer for saveFilters (500ms) — prevents excessive AsyncStorage writes on rapid slider movement
let _saveFiltersTimer: ReturnType<typeof setTimeout> | null = null;

export const createPersistenceSlice = (set: Set, get: Get) => ({
  // Persistence actions
  loadFilters: async () => {
    try {
      // Daily filters are session-only — always start from defaults.
      // Remove any stale key that may have been saved by older app versions.
      await AsyncStorage.removeItem(DAILY_STORAGE_KEY);

      const [permanentStored, lastSyncedStored] = await Promise.all([
        AsyncStorage.getItem(PERMANENT_STORAGE_KEY),
        AsyncStorage.getItem(LAST_SYNCED_STORAGE_KEY),
      ]);

      if (permanentStored) {
        const parsedPermanent = JSON.parse(permanentStored);
        // Phase A migration: strip the retired ingredientsToAvoid field if
        // a pre-Phase-A version of the app saved it. The field/type was
        // removed from PermanentFilters; without this strip, the spread
        // below would keep a stale key on the in-memory state object.
        // Safe to remove this strip after a release cycle where ~all users
        // have re-saved their state.
        delete parsedPermanent.ingredientsToAvoid;
        set(state => ({
          ...state,
          daily: getDefaultDailyFilters(
            (() => {
              try {
                return require('../settingsStore').useSettingsStore.getState()
                  .currency as SupportedCurrency;
              } catch {
                return undefined;
              }
            })()
          ), // ensure daily is always reset on load with correct currency
          permanent: { ...defaultPermanentFilters, ...parsedPermanent },
        }));
        debugLog(
          'Loaded permanent filters from storage; daily filters reset to currency-aware defaults'
        );
      } else {
        // No permanent filters saved yet — still reset daily to be safe
        set(state => ({ ...state, daily: { ...defaultDailyFilters } }));
      }

      // Restore lastSyncedAt so the 30-min debounce survives app restarts
      if (lastSyncedStored) {
        set({ lastSyncedAt: Number(lastSyncedStored) });
        debugLog('[FilterStore] Restored lastSyncedAt from storage:', Number(lastSyncedStored));
      }
    } catch (error) {
      debugLog('Failed to load filters from storage:', error);
    }
  },

  saveFilters: () => {
    // Debounce: coalesce rapid calls (e.g. slider dragging) into a single AsyncStorage write
    if (_saveFiltersTimer !== null) {
      clearTimeout(_saveFiltersTimer);
    }
    _saveFiltersTimer = setTimeout(async () => {
      _saveFiltersTimer = null;
      try {
        // Daily filters are session-only — only permanent filters and sync timestamp are persisted.
        const currentState = get();
        const writes: Promise<void>[] = [
          AsyncStorage.setItem(PERMANENT_STORAGE_KEY, JSON.stringify(currentState.permanent)),
        ];
        if (currentState.lastSyncedAt !== null) {
          writes.push(
            AsyncStorage.setItem(LAST_SYNCED_STORAGE_KEY, String(currentState.lastSyncedAt))
          );
        }
        await Promise.all(writes);
        debugLog('Saved permanent filters and sync timestamp to storage');
      } catch (error) {
        debugLog('Failed to save filters to storage:', error);
      }
    }, 500);
    return Promise.resolve();
  },
});
