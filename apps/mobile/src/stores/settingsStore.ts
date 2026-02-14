/**
 * Settings Store
 *
 * Manages user preferences and settings using Zustand.
 * Includes language, currency, units, and notification preferences.
 */

import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';

export type Language = 'en' | 'es' | 'pl';
export type Currency = 'USD' | 'MXN' | 'PLN';
export type UnitSystem = 'metric' | 'imperial';

interface UserSettings {
  // Language & Localization
  language: Language;
  currency: Currency;
  unitSystem: UnitSystem;

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
        set({ language });
        // Also update currency based on language
        const currencyMap: Record<Language, Currency> = {
          en: 'USD',
          es: 'MXN',
          pl: 'PLN',
        };
        set({ currency: currencyMap[language] });
      },

      updateCurrency: (currency: Currency) => set({ currency }),

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
};
