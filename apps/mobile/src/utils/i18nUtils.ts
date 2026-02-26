/**
 * Internationalization Utilities
 *
 * Utility functions for formatting currencies, dates, times, and handling regional preferences.
 */

import { getCurrentLanguage, getSupportedLanguages } from '../i18n';
import { formatPrice, getCurrencyInfo, type SupportedCurrency } from './currencyConfig';
import { useSettingsStore } from '../stores/settingsStore';

// Currency formatting
// Delegates to currencyConfig.formatPrice which uses the correct locale per currency.
export const formatCurrency = (amount: number, currencyCode?: string): string => {
  // Prefer explicitly passed code, then settingsStore currency, then language fallback.
  const storeCurrency = (() => {
    try {
      return useSettingsStore.getState().currency as SupportedCurrency;
    } catch {
      return undefined;
    }
  })();

  const supportedLanguages = getSupportedLanguages();
  const currentLanguage = getCurrentLanguage();
  const langCurrency = supportedLanguages.find(lang => lang.code === currentLanguage)?.currency;

  const currency = (currencyCode ?? storeCurrency ?? langCurrency ?? 'USD') as SupportedCurrency;
  return formatPrice(amount, currency);
};

// Time formatting based on region
export const formatTime = (date: Date, options?: { use24Hour?: boolean }): string => {
  const currentLanguage = getCurrentLanguage();

  // Use 12-hour format for USA, 24-hour for others
  const use24Hour = options?.use24Hour !== undefined ? options.use24Hour : currentLanguage !== 'en';

  try {
    return new Intl.DateTimeFormat(
      currentLanguage === 'en' ? 'en-US' : currentLanguage === 'es' ? 'es-MX' : 'pl-PL',
      {
        hour: 'numeric',
        minute: '2-digit',
        hour12: !use24Hour,
      }
    ).format(date);
  } catch (error) {
    // Fallback to basic formatting
    const hours = date.getHours();
    const minutes = date.getMinutes().toString().padStart(2, '0');

    if (use24Hour) {
      return `${hours}:${minutes}`;
    } else {
      const period = hours >= 12 ? 'PM' : 'AM';
      const displayHours = hours % 12 || 12;
      return `${displayHours}:${minutes} ${period}`;
    }
  }
};

// Date formatting
export const formatDate = (date: Date): string => {
  const currentLanguage = getCurrentLanguage();

  try {
    return new Intl.DateTimeFormat(
      currentLanguage === 'en' ? 'en-US' : currentLanguage === 'es' ? 'es-MX' : 'pl-PL',
      {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric',
      }
    ).format(date);
  } catch (error) {
    // Fallback to basic formatting
    return date.toLocaleDateString();
  }
};

// Opening hours formatting
export const formatOpeningHours = (openTime: string, closeTime: string): string => {
  const currentLanguage = getCurrentLanguage();

  try {
    // Parse times (assuming HH:MM format)
    const [openHour, openMinute] = openTime.split(':').map(Number);
    const [closeHour, closeMinute] = closeTime.split(':').map(Number);

    const openDate = new Date();
    openDate.setHours(openHour, openMinute, 0, 0);

    const closeDate = new Date();
    closeDate.setHours(closeHour, closeMinute, 0, 0);

    const formattedOpen = formatTime(openDate, { use24Hour: currentLanguage !== 'en' });
    const formattedClose = formatTime(closeDate, { use24Hour: currentLanguage !== 'en' });

    return `${formattedOpen} - ${formattedClose}`;
  } catch (error) {
    // Fallback to original format
    return `${openTime} - ${closeTime}`;
  }
};

// Regional cuisine preferences
export const getRegionalCuisineOrder = (): string[] => {
  const currentLanguage = getCurrentLanguage();

  // Define regional preferences for cuisine ordering
  const regionalPreferences = {
    en: [
      // USA preferences
      'American',
      'Italian',
      'Chinese',
      'Japanese',
      'Mexican',
      'Thai',
      'Mediterranean',
      'French',
      'Indian',
      'Greek',
      'Spanish',
      'BBQ',
    ],
    es: [
      // Mexico preferences
      'Mexican',
      'American',
      'Italian',
      'Chinese',
      'Japanese',
      'Thai',
      'Latin American',
      'Spanish',
      'French',
      'Mediterranean',
      'BBQ',
      'Indian',
    ],
    pl: [
      // Poland preferences
      'Polish',
      'Italian',
      'American',
      'Chinese',
      'Japanese',
      'Thai',
      'German',
      'French',
      'Mediterranean',
      'Indian',
      'Mexican',
      'BBQ',
    ],
  };

  return (
    regionalPreferences[currentLanguage as keyof typeof regionalPreferences] ||
    regionalPreferences.en
  );
};

// Pluralization helper
export const pluralize = (count: number, singular: string, plural: string): string => {
  return count === 1 ? singular : plural;
};

// Distance formatting
export const formatDistance = (meters: number): string => {
  const currentLanguage = getCurrentLanguage();

  if (meters < 1000) {
    return currentLanguage === 'en'
      ? `${meters}m`
      : currentLanguage === 'es'
        ? `${meters}m`
        : `${meters}m`;
  } else {
    const km = (meters / 1000).toFixed(1);
    return currentLanguage === 'en' ? `${km}km` : currentLanguage === 'es' ? `${km}km` : `${km}km`;
  }
};

// Number formatting
export const formatNumber = (num: number): string => {
  const currentLanguage = getCurrentLanguage();

  try {
    return new Intl.NumberFormat(
      currentLanguage === 'en' ? 'en-US' : currentLanguage === 'es' ? 'es-MX' : 'pl-PL'
    ).format(num);
  } catch (error) {
    return num.toString();
  }
};

// Get currency symbol
export const getCurrencySymbol = (currencyCode?: string): string => {
  const storeCurrency = (() => {
    try {
      return useSettingsStore.getState().currency as SupportedCurrency;
    } catch {
      return undefined;
    }
  })();
  const supportedLanguages = getSupportedLanguages();
  const currentLanguage = getCurrentLanguage();
  const langCurrency = supportedLanguages.find(lang => lang.code === currentLanguage)?.currency;
  const currency = (currencyCode ?? storeCurrency ?? langCurrency ?? 'USD') as SupportedCurrency;
  return getCurrencyInfo(currency).symbol;
};

// Get locale for specific formatting
export const getLocale = (): string => {
  const currentLanguage = getCurrentLanguage();
  return currentLanguage === 'en' ? 'en-US' : currentLanguage === 'es' ? 'es-MX' : 'pl-PL';
};
