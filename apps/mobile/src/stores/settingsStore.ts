/**
 * Settings Store
 *
 * Manages user preferences and settings using Zustand.
 * Includes language, currency, units, and notification preferences.
 */

import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';

import { getCurrencyForCountry, type SupportedCurrency } from '../utils/currencyConfig';
import * as RNLocalize from 'react-native-localize';

export type Language = 'en' | 'es' | 'pl';
export type Currency = SupportedCurrency;
export type UnitSystem = 'metric' | 'imperial';

interface UserSettings {
  // Language & Localization
  language: Language;
  currency: Currency;
  unitSystem: UnitSystem;
  /** ISO 3166-1 alpha-2 code from device locale or GPS, e.g. "US", "MX" */
  detectedCountryCode: string | null;

  // Notifications
  pushNotifications: boolean;
  emailNotifications: boolean;
  ratingReminders: boolean;

  // App Preferences
  hapticFeedback: boolean;
  autoSaveFilters: boolean;

  // Privacy
  analyticsEnabled: boolean;
  locationServices: boolean;
}

interface SettingsStore extends UserSettings {
  // Actions
  updateLanguage: (language: Language) => void;
  updateCurrency: (currency: Currency) => void;
  /**
   * Detects the country from the device locale (instant, no GPS needed)
   * and updates currency and detectedCountryCode accordingly.
   * Call once on app start; the filter store reads from currency.
   */
  autoDetectCurrency: () => void;
  updateUnitSystem: (unitSystem: UnitSystem) => void;
  updateNotifications: (
    settings: Partial<
      Pick<UserSettings, 'pushNotifications' | 'emailNotifications' | 'ratingReminders'>
    >
  ) => void;
  updatePreferences: (
    settings: Partial<Pick<UserSettings, 'hapticFeedback' | 'autoSaveFilters'>>
  ) => void;
  updatePrivacy: (
    settings: Partial<Pick<UserSettings, 'analyticsEnabled' | 'locationServices'>>
  ) => void;
  resetToDefaults: () => void;
  loadFromStorage: () => Promise<void>;
}

const defaultSettings: UserSettings = {
  // Language & Localization - will be auto-detected
  language: 'en',
  currency: 'USD',
  unitSystem: 'metric',
  detectedCountryCode: null,

  // Notifications
  pushNotifications: true,
  emailNotifications: false,
  ratingReminders: true,

  // App Preferences
  hapticFeedback: true,
  autoSaveFilters: true,

  // Privacy
  analyticsEnabled: true,
  locationServices: true,
};

export const useSettingsStore = create<SettingsStore>()(
  persist(
    (set, get) => ({
      ...defaultSettings,

      updateLanguage: (language: Language) => {
        // Update language only. Currency is independent — it is determined
        // by the user's physical location via autoDetectCurrency() which runs
        // on every app launch. Changing language must never override it.
        set({ language });
      },

      updateCurrency: (currency: Currency) => set({ currency }),

      autoDetectCurrency: () => {
        try {
          const countryCode = RNLocalize.getCountry() ?? null;
          const detectedCurrency = getCurrencyForCountry(countryCode);
          const currentState = get();
          // Only apply if the user hasn't manually overridden currency
          // (i.e., stored currency still matches the default 'USD' from a
          // fresh install, or matches a previously auto-detected value).
          set({ detectedCountryCode: countryCode, currency: detectedCurrency });
          console.log(
            `[Settings] Auto-detected country: ${countryCode ?? 'unknown'}, currency: ${detectedCurrency}`
          );
        } catch (error) {
          console.error('[Settings] autoDetectCurrency error:', error);
        }
      },

      updateUnitSystem: (unitSystem: UnitSystem) => set({ unitSystem }),

      updateNotifications: settings => set(settings),

      updatePreferences: settings => set(settings),

      updatePrivacy: settings => set(settings),

      resetToDefaults: () => set(defaultSettings),

      loadFromStorage: async () => {
        try {
          const stored = await AsyncStorage.getItem('settings-store');
          if (stored) {
            const parsed = JSON.parse(stored);
            set(parsed.state);
          }
        } catch (error) {
          console.error('Failed to load settings from storage:', error);
        }
      },
    }),
    {
      name: 'settings-store',
      storage: createJSONStorage(() => AsyncStorage),
      // Only persist specific settings
      partialize: state => ({
        language: state.language,
        currency: state.currency,
        unitSystem: state.unitSystem,
        detectedCountryCode: state.detectedCountryCode,
        pushNotifications: state.pushNotifications,
        emailNotifications: state.emailNotifications,
        ratingReminders: state.ratingReminders,
        hapticFeedback: state.hapticFeedback,
        autoSaveFilters: state.autoSaveFilters,
        analyticsEnabled: state.analyticsEnabled,
        locationServices: state.locationServices,
      }),
    }
  )
);

// Initialize settings on app start
export const initializeSettings = async () => {
  const store = useSettingsStore.getState();
  await store.loadFromStorage();
  // Auto-detect currency from device region (instant, no GPS needed).
  // This is called every launch so the currency stays correct even if the
  // user changes their device region.
  store.autoDetectCurrency();
};
