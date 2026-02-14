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

// Language detection priority: User preference > Device language > Browser language > English
const getLanguageFromStorage = async (): Promise<string | null> => {
  try {
    // First check settings store
    const settingsStore = (await import('../stores/settingsStore')).useSettingsStore.getState();
    if (settingsStore.language) {
      return settingsStore.language;
    }
    // Fallback to AsyncStorage    return await AsyncStorage.getItem('userLanguage');
  } catch {
    return null;
  }
};

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

const initI18n = async () => {
  // Get saved language preference
  const savedLanguage = await getLanguageFromStorage();
  const deviceLanguage = getDeviceLanguage();

  // Priority: saved > device > default
  const initialLanguage = savedLanguage || deviceLanguage;

  i18n.use(initReactI18next).init({
    resources,
    lng: initialLanguage,
    fallbackLng: 'en',

    // Language detection
    detection: {
      order: ['localStorage', 'navigator', 'htmlTag'],
      caches: ['localStorage'],
    },

    interpolation: {
      escapeValue: false, // React already escapes values
    },

    // React options
    react: {
      useSuspense: false,
    },
  });

  return i18n;
};

// Initialize i18n
const i18nInstance = initI18n();

// Export for use in components
export default i18nInstance;

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
  { code: 'en', name: 'English', flag: '🇺🇸', currency: 'USD' },
  { code: 'es', name: 'Español', flag: '🇲🇽', currency: 'MXN' },
  { code: 'pl', name: 'Polski', flag: '🇵🇱', currency: 'PLN' },
];

// Export for use in components
export { i18n };
