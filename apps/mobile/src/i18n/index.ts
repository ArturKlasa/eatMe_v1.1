/**
 * Internationalization Configuration
 *
 * Sets up i18next with react-i18next for multi-language support.
 * Supports English (USA), Spanish (Mexico), and Polish.
 */

import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import * as RNLocalize from 'react-native-localize';
import AsyncStorage from '@react-native-async-storage/async-storage';

// Import translation files
import en from '../locales/en.json';
import es from '../locales/es.json';
import pl from '../locales/pl.json';

// Language detection priority: persisted settingsStore value → AsyncStorage
// fallback → device locale → English.
// The full resolution happens in loadSavedLanguage() below which awaits
// zustand/persist rehydration before reading the store.

const getDeviceLanguage = (): string => {
  const locales = RNLocalize.getLocales();
  if (locales.length > 0) {
    const primaryLocale = locales[0];
    // Map device languages to our supported languages
    const languageCode = primaryLocale.languageCode.toLowerCase();

    if (languageCode === 'es') return 'es'; // Spanish (Mexico)
    if (languageCode === 'pl') return 'pl'; // Polish
    if (languageCode === 'en') return 'en'; // English (USA)

    // Check for country-specific variants
    if (primaryLocale.countryCode?.toLowerCase() === 'mx' && languageCode === 'es') return 'es';
    if (primaryLocale.countryCode?.toLowerCase() === 'pl') return 'pl';
  }
  return 'en'; // Default fallback
};

const resources = {
  en: { translation: en },
  es: { translation: es },
  pl: { translation: pl },
};

// Initialize i18n synchronously with default language
i18n.use(initReactI18next).init({
  resources,
  lng: 'en', // Start with English, will be updated async
  fallbackLng: 'en',

  interpolation: {
    escapeValue: false, // React already escapes values
  },

  react: {
    useSuspense: false,
  },
});

// Async function to load saved language and update i18n.
// Waits for zustand/persist to finish rehydrating from AsyncStorage before
// reading the store, so a language selected on the login screen is not
// silently overwritten by the default 'en' value that exists before
// rehydration completes.
const loadSavedLanguage = async () => {
  try {
    // Give zustand/persist time to rehydrate (it is also async).
    // useSettingsStore.persist.rehydrate() returns a promise we can await.
    const { useSettingsStore: getStore } = await import('../stores/settingsStore');
    await getStore.persist.rehydrate();

    const savedLanguage = getStore.getState().language;
    // Fallback chain: settingsStore → AsyncStorage key → device locale
    const language =
      savedLanguage || (await AsyncStorage.getItem('userLanguage')) || getDeviceLanguage();

    if (language && i18n.language !== language) {
      await i18n.changeLanguage(language);
    }
  } catch (error) {
    console.error('Failed to load saved language:', error);
  }
};

// Load language preference asynchronously
loadSavedLanguage();

// Export for use in components
export default i18n;

// Export language utilities
export const changeLanguage = async (language: 'en' | 'es' | 'pl') => {
  try {
    await AsyncStorage.setItem('userLanguage', language);
    await i18n.changeLanguage(language);

    // Also update settings store
    const settingsStore = (await import('../stores/settingsStore')).useSettingsStore.getState();
    settingsStore.updateLanguage(language);
  } catch (error) {
    console.error('Failed to save language preference:', error);
  }
};

export const getCurrentLanguage = (): string => i18n.language;

export const getSupportedLanguages = () => [
  { code: 'en', name: 'English', flag: '🇺🇸' },
  { code: 'es', name: 'Español', flag: '🇲🇽' },
  { code: 'pl', name: 'Polski', flag: '🇵🇱' },
];

// Export for use in components
export { i18n };
